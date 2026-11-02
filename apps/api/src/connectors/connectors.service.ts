import { HttpStatus, Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@ai-connector/shared";
import { ApiException } from "../common/errors";
import { AuditService } from "../audit/audit.service";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import { SyncService } from "../sync/sync.service";

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
    private readonly syncService: SyncService,
  ) {}

  async listConnections(
    userId: string,
    organizationId: string,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.CONNECTION_MANAGE,
      companyId,
    );

    return this.prisma.withOrganizationContext(organizationId, async (tx) => {
      const memberships = await tx.membership.findMany({
        where: { userId, organizationId, status: "active" },
      });
      const hasOrgWide = memberships.some((m) => m.companyId == null);
      const companyIds = memberships
        .map((m) => m.companyId)
        .filter((id): id is string => Boolean(id));

      return tx.connection.findMany({
        where: {
          organizationId,
          ...(hasOrgWide
            ? companyId
              ? { OR: [{ companyId: null }, { companyId }] }
              : {}
            : {
                OR: [
                  { companyId: null },
                  { companyId: { in: companyIds } },
                ],
              }),
        },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  async getConnection(
    userId: string,
    organizationId: string,
    connectionId: string,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.CONNECTION_MANAGE,
      companyId,
    );
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
    return connection;
  }

  async createConnection(
    userId: string,
    organizationId: string,
    name: string,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.CONNECTION_MANAGE,
      companyId,
    );

    if (companyId) {
      const company = await this.prisma.withOrganizationContext(
        organizationId,
        (tx) =>
          tx.company.findFirst({
            where: { id: companyId, organizationId },
          }),
      );
      if (!company) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          "company_not_found",
          "Compañía no encontrada en la organización",
        );
      }
    }

    const result = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const org = await tx.organization.findUnique({
          where: { id: organizationId },
        });
        if (!org) {
          throw new ApiException(
            HttpStatus.NOT_FOUND,
            "organization_not_found",
            "Organización no encontrada",
          );
        }

        let timezone = org.timezone;
        if (companyId) {
          const company = await tx.company.findFirst({
            where: { id: companyId, organizationId },
          });
          if (company?.timezone) timezone = company.timezone;
        }

        const connection = await tx.connection.create({
          data: {
            organizationId,
            companyId: companyId ?? null,
            name,
            provider: "mock",
            status: "active",
            config: { kind: "mock", locale: "es" },
          },
        });

        const dashboard = await tx.dashboard.create({
          data: {
            organizationId,
            companyId: companyId ?? null,
            connectionId: connection.id,
            name: "Panel de frescura",
            staleAfterHours: 26,
          },
        });

        return { connection, dashboard, timezone };
      },
    );

    await this.syncService.scheduleDailySync(
      result.connection.id,
      organizationId,
      result.timezone,
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "connection.created",
      resourceType: "connection",
      resourceId: result.connection.id,
      metadata: {
        name: result.connection.name,
        provider: result.connection.provider,
        dashboardId: result.dashboard.id,
      },
    });

    return {
      ...result.connection,
      dashboardId: result.dashboard.id,
    };
  }
}
