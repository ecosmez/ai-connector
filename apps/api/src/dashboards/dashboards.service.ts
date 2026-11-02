import { HttpStatus, Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@ai-connector/shared";
import { ApiException } from "../common/errors";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import { computeFreshness, freshnessLabelEs } from "./freshness";

export type DashboardView = {
  id: string;
  organizationId: string;
  companyId: string | null;
  connectionId: string;
  name: string;
  staleAfterHours: number;
  freshness: "fresh" | "stale" | "never";
  freshnessLabel: string;
  lastSyncedAt: string | null;
  etag: string | null;
  snapshot: {
    id: string;
    version: number;
    rowCount: number;
    createdAt: string;
    payload: unknown;
  } | null;
  connection: {
    id: string;
    name: string;
    provider: string;
    status: string;
  };
};

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
  ) {}

  async listDashboards(
    userId: string,
    organizationId: string,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.DASHBOARD_READ,
      companyId,
    );

    const dashboards = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const memberships = await tx.membership.findMany({
          where: { userId, organizationId, status: "active" },
        });
        const hasOrgWide = memberships.some((m) => m.companyId == null);
        const companyIds = memberships
          .map((m) => m.companyId)
          .filter((id): id is string => Boolean(id));

        return tx.dashboard.findMany({
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
          include: { connection: true },
          orderBy: { createdAt: "asc" },
        });
      },
    );

    return Promise.all(
      dashboards.map((d) => this.toView(organizationId, d.id)),
    );
  }

  async getDashboard(
    userId: string,
    organizationId: string,
    dashboardId: string,
    companyId?: string | null,
  ): Promise<DashboardView> {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.DASHBOARD_READ,
      companyId,
    );
    return this.toView(organizationId, dashboardId);
  }

  private async toView(
    organizationId: string,
    dashboardId: string,
  ): Promise<DashboardView> {
    const data = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const dashboard = await tx.dashboard.findFirst({
          where: { id: dashboardId, organizationId },
          include: { connection: true },
        });
        if (!dashboard) return null;
        const snapshot = await tx.dataSnapshot.findFirst({
          where: { connectionId: dashboard.connectionId, organizationId },
          orderBy: { version: "desc" },
        });
        return { dashboard, snapshot };
      },
    );

    if (!data) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "dashboard_not_found",
        "Dashboard no encontrado",
      );
    }

    const { dashboard, snapshot } = data;
    const freshness = computeFreshness(
      dashboard.connection.lastSyncedAt,
      dashboard.staleAfterHours,
    );

    return {
      id: dashboard.id,
      organizationId: dashboard.organizationId,
      companyId: dashboard.companyId,
      connectionId: dashboard.connectionId,
      name: dashboard.name,
      staleAfterHours: dashboard.staleAfterHours,
      freshness,
      freshnessLabel: freshnessLabelEs(freshness),
      lastSyncedAt: dashboard.connection.lastSyncedAt?.toISOString() ?? null,
      etag: snapshot?.etag ?? null,
      snapshot: snapshot
        ? {
            id: snapshot.id,
            version: snapshot.version,
            rowCount: snapshot.rowCount,
            createdAt: snapshot.createdAt.toISOString(),
            payload: snapshot.payload,
          }
        : null,
      connection: {
        id: dashboard.connection.id,
        name: dashboard.connection.name,
        provider: dashboard.connection.provider,
        status: dashboard.connection.status,
      },
    };
  }
}
