import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { createHash, randomBytes } from "crypto";
import { PERMISSIONS } from "@ai-connector/shared";
import { Prisma } from "@prisma/client";
import { ApiException } from "../common/errors";
import { AuditService } from "../audit/audit.service";
import { fetchMockConnectorData } from "../connectors/mock-connector";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CONNECTION_SYNC_QUEUE,
  SYNC_STATUSES,
  SYNC_TRIGGERS,
  SyncJobData,
} from "./sync.constants";

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
    @InjectQueue(CONNECTION_SYNC_QUEUE) private readonly syncQueue: Queue,
  ) {}

  private inlineMode() {
    return process.env.SYNC_MODE === "inline";
  }

  async enqueueManualSync(
    userId: string,
    organizationId: string,
    connectionId: string,
    idempotencyKey?: string | null,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.CONNECTION_MANAGE,
      companyId,
    );

    if (idempotencyKey) {
      const existing = await this.prisma.withOrganizationContext(
        organizationId,
        (tx) =>
          tx.syncRun.findFirst({
            where: { organizationId, idempotencyKey },
          }),
      );
      if (existing) {
        return existing;
      }
    }

    const connection = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.connection.findFirst({
          where: { id: connectionId, organizationId },
        }),
    );
    if (!connection) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "connection_not_found",
        "Conexión no encontrada",
      );
    }
    if (connection.status !== "active") {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "connection_inactive",
        "La conexión no está activa",
      );
    }

    const syncRun = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.syncRun.create({
          data: {
            organizationId,
            connectionId,
            trigger: SYNC_TRIGGERS.MANUAL,
            status: SYNC_STATUSES.QUEUED,
            idempotencyKey: idempotencyKey ?? null,
          },
        }),
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "sync.manual_enqueued",
      resourceType: "sync_run",
      resourceId: syncRun.id,
      metadata: { connectionId },
    });

    await this.dispatch(syncRun.id, organizationId, connectionId);

    if (this.inlineMode()) {
      const refreshed = await this.prisma.withOrganizationContext(
        organizationId,
        (tx) => tx.syncRun.findUniqueOrThrow({ where: { id: syncRun.id } }),
      );
      return refreshed;
    }
    return syncRun;
  }

  async enqueueScheduledSync(organizationId: string, connectionId: string) {
    const syncRun = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.syncRun.create({
          data: {
            organizationId,
            connectionId,
            trigger: SYNC_TRIGGERS.SCHEDULED,
            status: SYNC_STATUSES.QUEUED,
          },
        }),
    );
    await this.dispatch(syncRun.id, organizationId, connectionId);
    return syncRun;
  }

  private async dispatch(
    syncRunId: string,
    organizationId: string,
    connectionId: string,
  ) {
    const data: SyncJobData = { syncRunId, organizationId, connectionId };
    if (this.inlineMode()) {
      await this.executeSyncRun(data);
      return;
    }
    await this.syncQueue.add("run", data, {
      jobId: syncRunId,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
  }

  async getSyncRun(userId: string, organizationId: string, syncRunId: string) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.CONNECTION_MANAGE,
    );
    const run = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.syncRun.findFirst({
          where: { id: syncRunId, organizationId },
        }),
    );
    if (!run) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "sync_run_not_found",
        "Ejecución de sincronización no encontrada",
      );
    }
    return run;
  }

  async listSyncRuns(
    userId: string,
    organizationId: string,
    connectionId?: string,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.CONNECTION_MANAGE,
    );
    return this.prisma.withOrganizationContext(organizationId, (tx) =>
      tx.syncRun.findMany({
        where: {
          organizationId,
          ...(connectionId ? { connectionId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  }

  async executeSyncRun(job: SyncJobData) {
    const { syncRunId, organizationId, connectionId } = job;
    const startedAt = new Date();

    try {
      await this.prisma.withOrganizationContext(organizationId, async (tx) => {
        await tx.syncRun.update({
          where: { id: syncRunId },
          data: { status: SYNC_STATUSES.RUNNING, startedAt },
        });
      });

      const connection = await this.prisma.withOrganizationContext(
        organizationId,
        (tx) =>
          tx.connection.findFirst({
            where: { id: connectionId, organizationId },
          }),
      );
      if (!connection) {
        throw new Error("connection_not_found");
      }

      const config =
        connection.config &&
        typeof connection.config === "object" &&
        !Array.isArray(connection.config)
          ? (connection.config as Record<string, unknown>)
          : {};

      const payload =
        connection.provider === "mock"
          ? fetchMockConnectorData(connection.id, config)
          : fetchMockConnectorData(connection.id, config);

      const etag = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex")
        .slice(0, 32);

      const snapshot = await this.prisma.withOrganizationContext(
        organizationId,
        async (tx) => {
          const latest = await tx.dataSnapshot.findFirst({
            where: { connectionId },
            orderBy: { version: "desc" },
          });
          const version = (latest?.version ?? 0) + 1;
          const created = await tx.dataSnapshot.create({
            data: {
              organizationId,
              connectionId,
              version,
              rowCount: payload.rows.length,
              payload: payload as unknown as Prisma.InputJsonValue,
              etag,
            },
          });
          await tx.connection.update({
            where: { id: connectionId },
            data: { lastSyncedAt: new Date() },
          });
          await tx.syncRun.update({
            where: { id: syncRunId },
            data: {
              status: SYNC_STATUSES.SUCCEEDED,
              snapshotId: created.id,
              finishedAt: new Date(),
              errorMessage: null,
            },
          });
          return created;
        },
      );

      await this.auditService.record({
        organizationId,
        action: "sync.succeeded",
        resourceType: "sync_run",
        resourceId: syncRunId,
        metadata: {
          connectionId,
          snapshotId: snapshot.id,
          version: snapshot.version,
        },
      });

      return snapshot;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "sync_failed_unknown";
      this.logger.error(`Sync ${syncRunId} failed: ${message}`);
      await this.prisma.withOrganizationContext(organizationId, async (tx) => {
        await tx.syncRun.update({
          where: { id: syncRunId },
          data: {
            status: SYNC_STATUSES.FAILED,
            errorMessage: message,
            finishedAt: new Date(),
          },
        });
      });
      await this.auditService.record({
        organizationId,
        action: "sync.failed",
        resourceType: "sync_run",
        resourceId: syncRunId,
        metadata: { connectionId, error: message },
      });
      throw error;
    }
  }

  /** Stable job id for midnight-per-timezone schedule. */
  scheduledJobId(connectionId: string) {
    return `scheduled-sync:${connectionId}`;
  }

  async scheduleDailySync(
    connectionId: string,
    organizationId: string,
    timezone: string,
  ) {
    if (this.inlineMode()) {
      return;
    }
    const schedulerId = this.scheduledJobId(connectionId);
    await this.syncQueue.upsertJobScheduler(
      schedulerId,
      { pattern: "0 0 * * *", tz: timezone },
      {
        name: "scheduled",
        data: {
          syncRunId: "",
          organizationId,
          connectionId,
          createRun: true,
        } as SyncJobData & { createRun?: boolean },
        opts: {
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      },
    );
  }

  /** Used when a scheduled tick fires without a pre-created SyncRun. */
  async handleScheduledTick(organizationId: string, connectionId: string) {
    const connection = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.connection.findFirst({
          where: { id: connectionId, organizationId, status: "active" },
        }),
    );
    if (!connection) return null;
    return this.enqueueScheduledSync(organizationId, connectionId);
  }
}

export function newIdempotencyKey() {
  return randomBytes(16).toString("hex");
}
