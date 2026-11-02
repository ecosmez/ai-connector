import { HttpStatus, Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@ai-connector/shared";
import { ApiException } from "../common/errors";
import { AuditService } from "../audit/audit.service";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  evaluateGoal,
  goalStatusLabelEs,
  ResolvedKpi,
} from "../semantic/kpi-resolve";

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  async listGoals(
    userId: string,
    organizationId: string,
    dashboardId?: string,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.GOAL_READ,
      companyId,
    );
    return this.prisma.withOrganizationContext(organizationId, (tx) =>
      tx.goal.findMany({
        where: {
          organizationId,
          status: "active",
          ...(dashboardId ? { dashboardId } : {}),
        },
        orderBy: { createdAt: "asc" },
      }),
    );
  }

  async createGoal(
    userId: string,
    organizationId: string,
    input: {
      name: string;
      metricKey: string;
      targetValue: number;
      comparator?: string;
      dashboardId?: string | null;
      companyId?: string | null;
    },
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.GOAL_MANAGE,
      input.companyId,
    );

    const goal = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        if (input.dashboardId) {
          const dashboard = await tx.dashboard.findFirst({
            where: { id: input.dashboardId, organizationId },
          });
          if (!dashboard) {
            throw new ApiException(
              HttpStatus.NOT_FOUND,
              "dashboard_not_found",
              "Dashboard no encontrado",
            );
          }
        }
        return tx.goal.create({
          data: {
            organizationId,
            companyId: input.companyId ?? null,
            dashboardId: input.dashboardId ?? null,
            metricKey: input.metricKey,
            name: input.name,
            targetValue: input.targetValue,
            comparator: input.comparator ?? "gte",
            status: "active",
          },
        });
      },
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "goal.created",
      resourceType: "goal",
      resourceId: goal.id,
      metadata: {
        metricKey: goal.metricKey,
        targetValue: goal.targetValue,
      },
    });

    return goal;
  }

  evaluateAgainstKpis(
    goals: Array<{
      id: string;
      name: string;
      metricKey: string;
      targetValue: number;
      comparator: string;
      dashboardId: string | null;
    }>,
    kpis: ResolvedKpi[],
  ) {
    const byKey = new Map(kpis.map((k) => [k.key, k]));
    return goals.map((g) => {
      const kpi = byKey.get(g.metricKey);
      const actual = kpi?.value ?? null;
      const status = evaluateGoal(actual, g.targetValue, g.comparator);
      const progress =
        actual == null || g.targetValue === 0
          ? null
          : Math.min(100, Math.round((actual / g.targetValue) * 100));
      return {
        id: g.id,
        name: g.name,
        metricKey: g.metricKey,
        metricLabel: kpi?.label ?? g.metricKey,
        targetValue: g.targetValue,
        actualValue: actual,
        unit: kpi?.unit ?? null,
        comparator: g.comparator,
        status,
        statusLabel: goalStatusLabelEs(status),
        progressPercent: progress,
        dashboardId: g.dashboardId,
      };
    });
  }
}
