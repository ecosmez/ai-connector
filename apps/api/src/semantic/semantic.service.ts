import { HttpStatus, Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@ai-connector/shared";
import { Prisma } from "@prisma/client";
import { ApiException } from "../common/errors";
import { AuditService } from "../audit/audit.service";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import { MOCK_METRIC_BOOTSTRAP, resolveKpis } from "./kpi-resolve";

@Injectable()
export class SemanticService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  /** Create default semantic model + metrics for a mock connection (S2). */
  async bootstrapMockModel(
    tx: Prisma.TransactionClient,
    organizationId: string,
    connectionId: string,
    connectionName: string,
  ) {
    const model = await tx.semanticModel.create({
      data: {
        organizationId,
        connectionId,
        name: `Modelo · ${connectionName}`,
        status: "active",
      },
    });
    for (const metric of MOCK_METRIC_BOOTSTRAP) {
      await tx.metricDefinition.create({
        data: {
          organizationId,
          semanticModelId: model.id,
          key: metric.key,
          label: metric.label,
          sourcePath: metric.sourcePath,
          aggregation: metric.aggregation ?? "latest",
          unit: metric.unit,
          format: metric.format,
          sortOrder: metric.sortOrder,
        },
      });
    }
    return model;
  }

  async getByConnection(
    userId: string,
    organizationId: string,
    connectionId: string,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.SEMANTIC_READ,
      companyId,
    );
    const model = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.semanticModel.findFirst({
          where: { organizationId, connectionId },
          include: {
            metrics: { orderBy: { sortOrder: "asc" } },
          },
        }),
    );
    if (!model) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "semantic_model_not_found",
        "Modelo semántico no encontrado",
      );
    }
    return model;
  }

  async ensureForConnection(
    userId: string,
    organizationId: string,
    connectionId: string,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.SEMANTIC_MANAGE,
      companyId,
    );

    return this.prisma.withOrganizationContext(organizationId, async (tx) => {
      const existing = await tx.semanticModel.findFirst({
        where: { organizationId, connectionId },
        include: { metrics: { orderBy: { sortOrder: "asc" } } },
      });
      if (existing) return existing;

      const connection = await tx.connection.findFirst({
        where: { id: connectionId, organizationId },
      });
      if (!connection) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          "connection_not_found",
          "Conexión no encontrada",
        );
      }
      await this.bootstrapMockModel(
        tx,
        organizationId,
        connectionId,
        connection.name,
      );
      return tx.semanticModel.findFirstOrThrow({
        where: { organizationId, connectionId },
        include: { metrics: { orderBy: { sortOrder: "asc" } } },
      });
    }).then(async (model) => {
      await this.auditService.record({
        organizationId,
        actorUserId: userId,
        action: "semantic_model.ensured",
        resourceType: "semantic_model",
        resourceId: model.id,
        metadata: { connectionId },
      });
      return model;
    });
  }

  async resolveKpisForConnection(
    organizationId: string,
    connectionId: string,
    payload: unknown,
  ) {
    const model = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.semanticModel.findFirst({
          where: { organizationId, connectionId },
          include: { metrics: { orderBy: { sortOrder: "asc" } } },
        }),
    );
    if (!model) return [];
    return resolveKpis(payload, model.metrics);
  }
}
