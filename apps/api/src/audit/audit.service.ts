import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

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
    return this.prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata,
      },
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
}
