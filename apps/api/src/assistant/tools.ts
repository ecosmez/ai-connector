import { LlmToolDefinition } from "./llm.types";
import { PrismaService } from "../prisma/prisma.service";
import { resolveKpis } from "../semantic/kpi-resolve";
import {
  evaluateGoal,
  goalStatusLabelEs,
} from "../semantic/kpi-resolve";

/** Read-only allowlist — no mutations / no workflow activation in S3. */
export const ASSISTANT_TOOL_NAMES = [
  "list_dashboards",
  "get_dashboard_overview",
  "list_goals",
  "list_semantic_metrics",
] as const;

export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];

export const ASSISTANT_TOOLS: LlmToolDefinition[] = [
  {
    name: "list_dashboards",
    description:
      "Lista dashboards de la organización activa (nombre, conexión, frescura).",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_dashboard_overview",
    description:
      "Obtiene KPIs, frescura y metas evaluadas de un dashboard por id.",
    parameters: {
      type: "object",
      properties: {
        dashboardId: { type: "string" },
      },
      required: ["dashboardId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_goals",
    description: "Lista metas activas (objetivos) de la organización.",
    parameters: {
      type: "object",
      properties: {
        dashboardId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_semantic_metrics",
    description:
      "Lista métricas del modelo semántico de una conexión (o la primera disponible).",
    parameters: {
      type: "object",
      properties: {
        connectionId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

export async function executeAssistantTool(
  prisma: PrismaService,
  organizationId: string,
  name: string,
  argumentsJson: string,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  if (!(ASSISTANT_TOOL_NAMES as readonly string[]).includes(name)) {
    return { ok: false, error: `tool_not_allowed:${name}` };
  }

  const args = parseArgs(argumentsJson);

  return prisma.withOrganizationContext(organizationId, async (tx) => {
    switch (name as AssistantToolName) {
      case "list_dashboards": {
        const dashboards = await tx.dashboard.findMany({
          where: { organizationId },
          include: { connection: true },
          orderBy: { createdAt: "asc" },
          take: 20,
        });
        return {
          ok: true as const,
          data: dashboards.map((d) => ({
            id: d.id,
            name: d.name,
            connectionId: d.connectionId,
            connectionName: d.connection.name,
            lastSyncedAt: d.connection.lastSyncedAt?.toISOString() ?? null,
          })),
        };
      }
      case "get_dashboard_overview": {
        const dashboardId =
          typeof args.dashboardId === "string" ? args.dashboardId : "";
        if (!dashboardId) {
          return { ok: false as const, error: "dashboardId_required" };
        }
        const dashboard = await tx.dashboard.findFirst({
          where: { id: dashboardId, organizationId },
          include: { connection: true },
        });
        if (!dashboard) {
          return { ok: false as const, error: "dashboard_not_found" };
        }
        const snapshot = await tx.dataSnapshot.findFirst({
          where: { connectionId: dashboard.connectionId, organizationId },
          orderBy: { version: "desc" },
        });
        const model = await tx.semanticModel.findFirst({
          where: {
            organizationId,
            connectionId: dashboard.connectionId,
          },
          include: { metrics: { orderBy: { sortOrder: "asc" } } },
        });
        const kpis = model
          ? resolveKpis(snapshot?.payload ?? null, model.metrics)
          : [];
        const goals = await tx.goal.findMany({
          where: {
            organizationId,
            status: "active",
            OR: [{ dashboardId }, { dashboardId: null }],
          },
        });
        const byKey = new Map(kpis.map((k) => [k.key, k]));
        return {
          ok: true as const,
          data: {
            id: dashboard.id,
            name: dashboard.name,
            connection: dashboard.connection.name,
            lastSyncedAt:
              dashboard.connection.lastSyncedAt?.toISOString() ?? null,
            kpis,
            goals: goals.map((g) => {
              const actual = byKey.get(g.metricKey)?.value ?? null;
              const status = evaluateGoal(actual, g.targetValue, g.comparator);
              return {
                name: g.name,
                metricKey: g.metricKey,
                targetValue: g.targetValue,
                actualValue: actual,
                status,
                statusLabel: goalStatusLabelEs(status),
              };
            }),
          },
        };
      }
      case "list_goals": {
        const dashboardId =
          typeof args.dashboardId === "string" ? args.dashboardId : undefined;
        const goals = await tx.goal.findMany({
          where: {
            organizationId,
            status: "active",
            ...(dashboardId ? { dashboardId } : {}),
          },
          orderBy: { createdAt: "asc" },
          take: 50,
        });
        return {
          ok: true as const,
          data: goals.map((g) => ({
            id: g.id,
            name: g.name,
            metricKey: g.metricKey,
            targetValue: g.targetValue,
            comparator: g.comparator,
            dashboardId: g.dashboardId,
          })),
        };
      }
      case "list_semantic_metrics": {
        const connectionId =
          typeof args.connectionId === "string" ? args.connectionId : undefined;
        const model = await tx.semanticModel.findFirst({
          where: {
            organizationId,
            ...(connectionId ? { connectionId } : {}),
          },
          include: { metrics: { orderBy: { sortOrder: "asc" } } },
          orderBy: { createdAt: "asc" },
        });
        if (!model) {
          return { ok: false as const, error: "semantic_model_not_found" };
        }
        return {
          ok: true as const,
          data: {
            id: model.id,
            name: model.name,
            connectionId: model.connectionId,
            metrics: model.metrics.map((m) => ({
              key: m.key,
              label: m.label,
              sourcePath: m.sourcePath,
              unit: m.unit,
            })),
          },
        };
      }
      default:
        return { ok: false as const, error: "tool_not_allowed" };
    }
  });
}
