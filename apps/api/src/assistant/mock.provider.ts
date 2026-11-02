import { createHash, randomBytes } from "crypto";
import {
  LlmCompletion,
  LlmMessage,
  LlmProvider,
  LlmToolDefinition,
} from "./llm.types";

function formatToolSummary(toolName: string, data: unknown): string {
  if (toolName === "get_dashboard_overview" && data && typeof data === "object") {
    const d = data as {
      name?: string;
      connection?: string;
      lastSyncedAt?: string | null;
      kpis?: Array<{ label: string; value: number | null; unit?: string | null }>;
      goals?: Array<{
        name: string;
        actualValue: number | null;
        targetValue: number;
        statusLabel: string;
      }>;
    };
    const kpiLines =
      d.kpis
        ?.map(
          (k) =>
            `- ${k.label}: ${k.value ?? "—"}${k.unit ? ` ${k.unit}` : ""}`,
        )
        .join("\n") ?? "";
    const goalLines =
      d.goals
        ?.map(
          (g) =>
            `- ${g.name}: ${g.actualValue ?? "—"} / meta ${g.targetValue} (${g.statusLabel})`,
        )
        .join("\n") ?? "";
    return [
      `Panel «${d.name ?? "dashboard"}» (${d.connection ?? "conexión"}).`,
      d.lastSyncedAt
        ? `Última sincronización: ${d.lastSyncedAt}.`
        : "Sin sincronización registrada.",
      kpiLines ? `KPIs:\n${kpiLines}` : "Sin KPIs disponibles.",
      goalLines ? `Metas:\n${goalLines}` : "Sin metas activas.",
    ].join("\n");
  }
  if (toolName === "list_goals" && Array.isArray(data)) {
    if (data.length === 0) return "No hay metas activas en esta organización.";
    return (
      "Metas activas:\n" +
      data
        .map(
          (g: { name?: string; metricKey?: string; targetValue?: number }) =>
            `- ${g.name}: ${g.metricKey} → ${g.targetValue}`,
        )
        .join("\n")
    );
  }
  if (toolName === "list_dashboards" && Array.isArray(data)) {
    if (data.length === 0) return "No hay dashboards todavía.";
    return (
      "Dashboards:\n" +
      data
        .map(
          (d: { name?: string; connectionName?: string }) =>
            `- ${d.name} (${d.connectionName ?? "sin conexión"})`,
        )
        .join("\n")
    );
  }
  if (
    toolName === "list_semantic_metrics" &&
    data &&
    typeof data === "object" &&
    "metrics" in data
  ) {
    const metrics = (data as { name?: string; metrics: Array<{ label: string; key: string }> })
      .metrics;
    return (
      `Modelo «${(data as { name?: string }).name ?? "semántico"}»:\n` +
      metrics.map((m) => `- ${m.label} (${m.key})`).join("\n")
    );
  }
  return `Datos (${toolName}): ${JSON.stringify(data).slice(0, 1200)}`;
}

/**
 * Deterministic provider for tests/dev without OPENAI_API_KEY.
 * Emits allowlisted tool calls when the user asks about KPIs/metas/dashboards.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async complete(input: {
    messages: LlmMessage[];
    tools: LlmToolDefinition[];
  }): Promise<LlmCompletion> {
    const allowed = new Set(input.tools.map((t) => t.name));
    const toolMessages = input.messages.filter((m) => m.role === "tool");
    const lastTool = toolMessages[toolMessages.length - 1];
    const lastUser = [...input.messages]
      .reverse()
      .find((m) => m.role === "user");
    const text = (lastUser?.content ?? "").toLowerCase();

    if (lastTool && lastTool.role === "tool") {
      // After listing dashboards, fetch overview of the first one.
      if (
        lastTool.name === "list_dashboards" &&
        allowed.has("get_dashboard_overview")
      ) {
        try {
          const payload = JSON.parse(lastTool.content) as {
            ok?: boolean;
            data?: Array<{ id: string }>;
          };
          const firstId = payload.ok ? payload.data?.[0]?.id : undefined;
          if (firstId) {
            return {
              content: null,
              toolCalls: [
                {
                  id: `call_${randomBytes(6).toString("hex")}`,
                  name: "get_dashboard_overview",
                  argumentsJson: JSON.stringify({ dashboardId: firstId }),
                },
              ],
              provider: this.name,
              model: "mock-assistant-v1",
            };
          }
        } catch {
          // fall through to summary
        }
      }

      let summary = "Consulté las herramientas permitidas.";
      try {
        const payload = JSON.parse(lastTool.content) as {
          ok?: boolean;
          data?: unknown;
          error?: string;
        };
        if (payload.ok && payload.data) {
          summary = formatToolSummary(lastTool.name, payload.data);
        } else {
          summary = `No pude obtener datos (${payload.error ?? "error"}).`;
        }
      } catch {
        summary = `Resultado de ${lastTool.name}: ${lastTool.content.slice(0, 800)}`;
      }
      return {
        content: summary,
        toolCalls: [],
        provider: this.name,
        model: "mock-assistant-v1",
      };
    }

    const wantsDashboard =
      /dashboard|panel|kpi|venta|inventario|fresc|métric|metric|análisis|analisis/.test(
        text,
      );
    const wantsGoals = /meta|objetivo|goal|cumpl/.test(text);
    const wantsSemantic = /semánt|semant|modelo/.test(text);

    if (wantsDashboard && allowed.has("list_dashboards")) {
      return {
        content: null,
        toolCalls: [
          {
            id: `call_${randomBytes(6).toString("hex")}`,
            name: "list_dashboards",
            argumentsJson: "{}",
          },
        ],
        provider: this.name,
        model: "mock-assistant-v1",
      };
    }
    if (wantsGoals && allowed.has("list_goals")) {
      return {
        content: null,
        toolCalls: [
          {
            id: `call_${randomBytes(6).toString("hex")}`,
            name: "list_goals",
            argumentsJson: "{}",
          },
        ],
        provider: this.name,
        model: "mock-assistant-v1",
      };
    }
    if (wantsSemantic && allowed.has("list_semantic_metrics")) {
      return {
        content: null,
        toolCalls: [
          {
            id: `call_${randomBytes(6).toString("hex")}`,
            name: "list_semantic_metrics",
            argumentsJson: "{}",
          },
        ],
        provider: this.name,
        model: "mock-assistant-v1",
      };
    }

    const fingerprint = createHash("sha1")
      .update(text)
      .digest("hex")
      .slice(0, 8);
    return {
      content:
        "Soy el asistente de AI Connector. Puedo consultar dashboards, KPIs, metas y el modelo semántico de tu organización (solo lectura). Pregunta por ventas, frescura o metas para usar las herramientas." +
        ` [${fingerprint}]`,
      toolCalls: [],
      provider: this.name,
      model: "mock-assistant-v1",
    };
  }
}
