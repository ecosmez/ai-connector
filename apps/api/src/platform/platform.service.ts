import { Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import Redis from "ioredis";

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  private async assertAdmin(userId: string) {
    await this.policyService.assertPlatformAdmin(userId);
  }

  async overview(userId: string) {
    await this.assertAdmin(userId);
    const [
      organizations,
      users,
      companies,
      connections,
      workflowDefinitions,
      workflowRuns,
      platformAdmins,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.company.count(),
      this.prisma.connection.count(),
      this.prisma.workflowDefinition.count(),
      this.prisma.workflowRun.count(),
      this.prisma.user.count({ where: { isPlatformAdmin: true } }),
    ]);

    await this.auditService.record({
      actorUserId: userId,
      action: "platform.console_viewed",
      resourceType: "platform",
      resourceId: "overview",
    });

    return {
      organizations,
      users,
      companies,
      connections,
      workflowDefinitions,
      workflowRuns,
      platformAdmins,
    };
  }

  async listOrganizations(userId: string) {
    await this.assertAdmin(userId);
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        timezone: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            companies: true,
            connections: true,
          },
        },
      },
    });

    await this.auditService.record({
      actorUserId: userId,
      action: "platform.console_viewed",
      resourceType: "platform",
      resourceId: "organizations",
    });

    return {
      items: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        timezone: o.timezone,
        createdAt: o.createdAt,
        memberCount: o._count.memberships,
        companyCount: o._count.companies,
        connectionCount: o._count.connections,
      })),
    };
  }

  async health(userId: string) {
    await this.assertAdmin(userId);
    let database: "ok" | "error" = "ok";
    let redis: "ok" | "error" = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
    }
    // lazyConnect + explicit connect avoids the race where ping() runs before
    // the socket is writable (enableOfflineQueue:false would reject that).
    const client = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      lazyConnect: true,
      family: 4,
    });
    try {
      await client.connect();
      const pong = await client.ping();
      if (pong !== "PONG") redis = "error";
    } catch {
      redis = "error";
    } finally {
      client.disconnect();
    }
    return {
      status: database === "ok" && redis === "ok" ? "ok" : "degraded",
      database,
      redis,
      service: "ai-connector-api",
    };
  }
}
