import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  evaluateGoal,
  goalStatusLabelEs,
  resolveKpis,
} from "../semantic/kpi-resolve";
import { WorkflowStepDef } from "./workflow.types";

export type StepResult =
  | { status: "succeeded"; output: Record<string, unknown> }
  | { status: "failed"; error: string; output?: Record<string, unknown> }
  | { status: "waiting"; output: Record<string, unknown> };

export async function executeStep(input: {
  prisma: PrismaService;
  organizationId: string;
  runId: string;
  stepRunId: string;
  step: WorkflowStepDef;
  dryRun: boolean;
  triggeredByUserId: string | null;
  context: Record<string, unknown>;
}): Promise<StepResult> {
  const { step, dryRun } = input;
  switch (step.type) {
    case "check_goal":
      return runCheckGoal(input);
    case "notify":
      return runNotify(input);
    case "wait_approval":
      return runWaitApproval(input);
    default:
      return { status: "failed", error: `unknown_step_type:${step.type}` };
  }
}

async function runNotify(input: {
  prisma: PrismaService;
  organizationId: string;
  runId: string;
  step: WorkflowStepDef;
  dryRun: boolean;
  context: Record<string, unknown>;
}): Promise<StepResult> {
  const channel = String(input.step.config?.channel ?? "in_app");
  const message = String(
    input.step.config?.message ?? "Notificación de automatización",
  );
  const title = String(
    input.step.config?.title ??
      (typeof input.context.workflowName === "string"
        ? input.context.workflowName
        : "Automatización"),
  );

  if (input.dryRun || channel === "audit") {
    return {
      status: "succeeded",
      output: { channel, message, title, simulated: true },
    };
  }

  const notification = await input.prisma.withOrganizationContext(
    input.organizationId,
    (tx) =>
      tx.notification.create({
        data: {
          organizationId: input.organizationId,
          title,
          body: message,
          channel: "in_app",
          sourceType: "workflow_run",
          sourceId: input.runId,
        },
      }),
  );

  return {
    status: "succeeded",
    output: {
      channel: "in_app",
      message,
      title,
      simulated: false,
      notificationId: notification.id,
    },
  };
}

async function runCheckGoal(input: {
  prisma: PrismaService;
  organizationId: string;
  step: WorkflowStepDef;
}): Promise<StepResult> {
  const metricKey =
    typeof input.step.config?.metricKey === "string"
      ? input.step.config.metricKey
      : "ventas_dia";
  const requireOnTrack = input.step.config?.requireOnTrack !== false;

  return input.prisma.withOrganizationContext(
    input.organizationId,
    async (tx) => {
      const goal = await tx.goal.findFirst({
        where: {
          organizationId: input.organizationId,
          status: "active",
          metricKey,
        },
        orderBy: { createdAt: "asc" },
      });
      if (!goal) {
        return {
          status: "failed" as const,
          error: "goal_not_found",
          output: { metricKey },
        };
      }

      const dashboard = goal.dashboardId
        ? await tx.dashboard.findFirst({
            where: { id: goal.dashboardId, organizationId: input.organizationId },
          })
        : await tx.dashboard.findFirst({
            where: { organizationId: input.organizationId },
            orderBy: { createdAt: "asc" },
          });

      let actual: number | null = null;
      if (dashboard) {
        const snapshot = await tx.dataSnapshot.findFirst({
          where: {
            organizationId: input.organizationId,
            connectionId: dashboard.connectionId,
          },
          orderBy: { version: "desc" },
        });
        const model = await tx.semanticModel.findFirst({
          where: {
            organizationId: input.organizationId,
            connectionId: dashboard.connectionId,
          },
          include: { metrics: true },
        });
        if (model && snapshot) {
          const kpis = resolveKpis(snapshot.payload, model.metrics);
          actual = kpis.find((k) => k.key === metricKey)?.value ?? null;
        }
      }

      const status = evaluateGoal(actual, goal.targetValue, goal.comparator);
      const output = {
        goalId: goal.id,
        goalName: goal.name,
        metricKey,
        actualValue: actual,
        targetValue: goal.targetValue,
        status,
        statusLabel: goalStatusLabelEs(status),
      };

      if (requireOnTrack && status !== "on_track") {
        return {
          status: "failed" as const,
          error: "goal_off_track",
          output,
        };
      }
      return { status: "succeeded" as const, output };
    },
  );
}

async function runWaitApproval(input: {
  prisma: PrismaService;
  organizationId: string;
  runId: string;
  stepRunId: string;
  step: WorkflowStepDef;
  dryRun: boolean;
  triggeredByUserId: string | null;
}): Promise<StepResult> {
  if (input.dryRun) {
    return {
      status: "succeeded",
      output: {
        simulated: true,
        decision: "approved",
        note: "Aprobación simulada (dry-run)",
      },
    };
  }

  await input.prisma.withOrganizationContext(input.organizationId, (tx) =>
    tx.approvalRequest.create({
      data: {
        organizationId: input.organizationId,
        runId: input.runId,
        stepRunId: input.stepRunId,
        status: "pending",
        requestedByUserId: input.triggeredByUserId,
        note:
          typeof input.step.config?.prompt === "string"
            ? input.step.config.prompt
            : "Se requiere aprobación humana para continuar.",
      },
    }),
  );

  return {
    status: "waiting",
    output: { awaiting: "approval" },
  };
}

export function parseSteps(raw: Prisma.JsonValue): WorkflowStepDef[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkflowStepDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const key = typeof rec.key === "string" ? rec.key : "";
    const type = typeof rec.type === "string" ? rec.type : "";
    if (!key || !type) continue;
    out.push({
      key,
      type: type as WorkflowStepDef["type"],
      config:
        rec.config && typeof rec.config === "object" && !Array.isArray(rec.config)
          ? (rec.config as Record<string, unknown>)
          : {},
    });
  }
  return out;
}
