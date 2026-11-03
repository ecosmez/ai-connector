import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createId } from "../common/id";
import { PrismaService } from "../prisma/prisma.service";
import {
  AUDIT_GENESIS_HASH,
  computeEventHash,
  verifyEventChain,
} from "./audit-hash";

type RecordInput = {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordInput) {
    const organizationId = input.organizationId ?? null;
    const id = createId();
    const createdAt = new Date();

    // Serialize chain tips per org (advisory lock keyed by org/platform).
    const lockKey = organizationId ?? "platform";
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const last = await tx.auditEvent.findFirst({
        where: {
          organizationId,
          eventHash: { not: null },
        },
        orderBy: { createdAt: "desc" },
      });
      const prevHash = last?.eventHash ?? AUDIT_GENESIS_HASH;
      const eventHash = computeEventHash({
        prevHash,
        id,
        organizationId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        metadata: (input.metadata as Prisma.JsonValue) ?? null,
        createdAt,
      });

      return tx.auditEvent.create({
        data: {
          id,
          organizationId,
          actorUserId: input.actorUserId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          metadata: input.metadata,
          prevHash,
          eventHash,
          createdAt,
        },
      });
    });
  }

  async listForOrganization(organizationId: string, limit = 50) {
    return this.prisma.withOrganizationContext(organizationId, (tx) =>
      tx.auditEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    );
  }

  async exportForOrganization(organizationId: string) {
    const events = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.auditEvent.findMany({
          where: { organizationId },
          orderBy: { createdAt: "asc" },
        }),
    );
    const verification = verifyEventChain(events);
    return {
      organizationId,
      exportedAt: new Date().toISOString(),
      chainValid: verification.valid,
      eventsChecked: verification.checked,
      firstInvalidId: verification.firstInvalidId,
      events,
    };
  }

  async verifyForOrganization(organizationId: string) {
    const events = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.auditEvent.findMany({
          where: { organizationId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            organizationId: true,
            actorUserId: true,
            action: true,
            resourceType: true,
            resourceId: true,
            metadata: true,
            prevHash: true,
            eventHash: true,
            createdAt: true,
          },
        }),
    );
    const verification = verifyEventChain(events);
    return {
      organizationId,
      valid: verification.valid,
      eventsChecked: verification.checked,
      firstInvalidId: verification.firstInvalidId,
      totalEvents: events.length,
    };
  }
}
