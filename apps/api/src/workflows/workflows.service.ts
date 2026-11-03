import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PERMISSIONS } from "@ai-connector/shared";
import { Prisma } from "@prisma/client";
import { ApiException } from "../common/errors";
import { AuditService } from "../audit/audit.service";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import { executeStep, parseSteps } from "./steps";
import {
  RUN_STATUS,
  STEP_STATUS,
  WORKFLOW_QUEUE,
  WORKFLOW_STEP_TYPES,
  WorkflowJobData,
  WorkflowScheduledJobData,
  WorkflowStepDef,
} from "./workflow.types";

const CRON_PATTERN = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
    @InjectQueue(WORKFLOW_QUEUE) private readonly queue: Queue,
  ) {}

  private inlineMode() {
    return process.env.WORKFLOW_MODE === "inline";
  }

  private validateSteps(steps: WorkflowStepDef[]) {
    if (steps.length === 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "steps_required",
        "Se requiere al menos un paso",
      );
    }
    const keys = new Set<string>();
    for (const step of steps) {
      if (keys.has(step.key)) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "duplicate_step_key",
          `Paso duplicado: ${step.key}`,
        );
      }
      keys.add(step.key);
      if (!(WORKFLOW_STEP_TYPES as readonly string[]).includes(step.type)) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "invalid_step_type",
          `Tipo de paso no permitido: ${step.type}`,
        );
      }
    }
  }

  async createDefinition(
    userId: string,
    organizationId: string,
    input: {
      name: string;
      description?: string;
      steps: WorkflowStepDef[];
      companyId?: string | null;
    },
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.WORKFLOW_MANAGE,
      input.companyId,
    );
    this.validateSteps(input.steps);

    const definition = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.workflowDefinition.create({
          data: {
            organizationId,
            companyId: input.companyId ?? null,
            name: input.name,
            description: input.description ?? null,
            steps: input.steps as unknown as Prisma.InputJsonValue,
            status: "active",
          },
        }),
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "workflow.definition_created",
      resourceType: "workflow_definition",
      resourceId: definition.id,
      metadata: { name: definition.name, stepCount: input.steps.length },
    });

    return definition;
  }

  async listDefinitions(
    userId: string,
    organizationId: string,
    companyId?: string | null,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.WORKFLOW_MANAGE,
      companyId,
    );
    return this.prisma.withOrganizationContext(organizationId, (tx) =>
      tx.workflowDefinition.findMany({
        where: { organizationId, status: "active" },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async startRun(
    userId: string,
    organizationId: string,
    definitionId: string,
    options: {
      dryRun?: boolean;
      idempotencyKey?: string | null;
      companyId?: string | null;
    },
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.WORKFLOW_MANAGE,
      options.companyId,
    );

    if (options.idempotencyKey) {
      const existing = await this.prisma.withOrganizationContext(
        organizationId,
        (tx) =>
          tx.workflowRun.findFirst({
            where: {
              organizationId,
              idempotencyKey: options.idempotencyKey!,
            },
          }),
      );
      if (existing) return existing;
    }

    const definition = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.workflowDefinition.findFirst({
          where: { id: definitionId, organizationId, status: "active" },
        }),
    );
    if (!definition) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "workflow_not_found",
        "Automatización no encontrada",
      );
    }

    const steps = parseSteps(definition.steps);
    this.validateSteps(steps);

    const run = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const created = await tx.workflowRun.create({
          data: {
            organizationId,
            companyId: definition.companyId,
            definitionId: definition.id,
            triggeredByUserId: userId,
            status: RUN_STATUS.QUEUED,
            dryRun: Boolean(options.dryRun),
            idempotencyKey: options.idempotencyKey ?? null,
            context: {},
          },
        });
        for (const step of steps) {
          await tx.workflowStepRun.create({
            data: {
              organizationId,
              runId: created.id,
              stepKey: step.key,
              stepType: step.type,
              status: STEP_STATUS.PENDING,
            },
          });
        }
        return created;
      },
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "workflow.run_started",
      resourceType: "workflow_run",
      resourceId: run.id,
      metadata: { definitionId, dryRun: run.dryRun },
    });

    await this.dispatch(run.id, organizationId);
    if (this.inlineMode()) {
      return this.prisma.withOrganizationContext(organizationId, (tx) =>
        tx.workflowRun.findUniqueOrThrow({ where: { id: run.id } }),
      );
    }
    return run;
  }

  private async dispatch(runId: string, organizationId: string) {
    const data: WorkflowJobData = { runId, organizationId };
    if (this.inlineMode()) {
      await this.processRun(data);
      return;
    }
    await this.queue.add("advance", data, {
      jobId: `wf-${runId}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: "exponential", delay: 1500 },
    });
  }

  async getRun(userId: string, organizationId: string, runId: string) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.WORKFLOW_MANAGE,
    );
    const run = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.workflowRun.findFirst({
          where: { id: runId, organizationId },
          include: {
            stepRuns: { orderBy: { createdAt: "asc" } },
            approvals: { orderBy: { createdAt: "asc" } },
            definition: true,
          },
        }),
    );
    if (!run) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "workflow_run_not_found",
        "Ejecución no encontrada",
      );
    }
    return run;
  }

  async listRuns(userId: string, organizationId: string) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.WORKFLOW_MANAGE,
    );
    return this.prisma.withOrganizationContext(organizationId, (tx) =>
      tx.workflowRun.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { definition: { select: { id: true, name: true } } },
      }),
    );
  }

  async listApprovals(
    userId: string,
    organizationId: string,
    status = "pending",
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.WORKFLOW_MANAGE,
    );
    return this.prisma.withOrganizationContext(organizationId, (tx) =>
      tx.approvalRequest.findMany({
        where: { organizationId, status },
        orderBy: { createdAt: "asc" },
        include: {
          run: { include: { definition: { select: { name: true } } } },
        },
      }),
    );
  }

  async decideApproval(
    userId: string,
    organizationId: string,
    approvalId: string,
    decision: "approved" | "rejected",
    note?: string,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.WORKFLOW_MANAGE,
    );

    const approval = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.approvalRequest.findFirst({
          where: { id: approvalId, organizationId },
        }),
    );
    if (!approval) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "approval_not_found",
        "Aprobación no encontrada",
      );
    }
    if (approval.status !== "pending") {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "approval_not_pending",
        "La aprobación ya fue decidida",
      );
    }

    await this.prisma.withOrganizationContext(organizationId, async (tx) => {
      await tx.approvalRequest.update({
        where: { id: approvalId },
        data: {
          status: decision,
          decidedByUserId: userId,
          decidedAt: new Date(),
          note: note ?? approval.note,
        },
      });
      if (decision === "rejected") {
        await tx.workflowStepRun.update({
          where: { id: approval.stepRunId },
          data: {
            status: STEP_STATUS.FAILED,
            errorMessage: "approval_rejected",
            finishedAt: new Date(),
            output: { decision, note: note ?? null },
          },
        });
        await tx.workflowRun.update({
          where: { id: approval.runId },
          data: {
            status: RUN_STATUS.FAILED,
            errorMessage: "approval_rejected",
            finishedAt: new Date(),
          },
        });
      } else {
        await tx.workflowStepRun.update({
          where: { id: approval.stepRunId },
          data: {
            status: STEP_STATUS.SUCCEEDED,
            finishedAt: new Date(),
            output: { decision, note: note ?? null },
          },
        });
        await tx.workflowRun.update({
          where: { id: approval.runId },
          data: { status: RUN_STATUS.RUNNING },
        });
      }
    });

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: `workflow.approval_${decision}`,
      resourceType: "approval_request",
      resourceId: approvalId,
      metadata: { runId: approval.runId },
    });

    if (decision === "approved") {
      await this.dispatch(approval.runId, organizationId);
    }

    return this.prisma.withOrganizationContext(organizationId, (tx) =>
      tx.approvalRequest.findUniqueOrThrow({ where: { id: approvalId } }),
    );
  }

  async processRun(job: WorkflowJobData) {
    const { runId, organizationId } = job;
    try {
      const run = await this.prisma.withOrganizationContext(
        organizationId,
        (tx) =>
          tx.workflowRun.findFirst({
            where: { id: runId, organizationId },
            include: {
              definition: true,
              stepRuns: { orderBy: { createdAt: "asc" } },
            },
          }),
      );
      if (!run) return;
      if (
        run.status === RUN_STATUS.SUCCEEDED ||
        run.status === RUN_STATUS.FAILED ||
        run.status === RUN_STATUS.CANCELLED
      ) {
        return;
      }

      const steps = parseSteps(run.definition.steps);
      await this.prisma.withOrganizationContext(organizationId, (tx) =>
        tx.workflowRun.update({
          where: { id: runId },
          data: {
            status: RUN_STATUS.RUNNING,
            startedAt: run.startedAt ?? new Date(),
          },
        }),
      );

      let context =
        run.context && typeof run.context === "object" && !Array.isArray(run.context)
          ? ({ ...(run.context as Record<string, unknown>) } as Record<
              string,
              unknown
            >)
          : {};
      context.workflowName = run.definition.name;

      for (const step of steps) {
        const stepRun = run.stepRuns.find((s) => s.stepKey === step.key);
        if (!stepRun) continue;
        if (stepRun.status === STEP_STATUS.SUCCEEDED) {
          if (stepRun.output && typeof stepRun.output === "object") {
            context[step.key] = stepRun.output;
          }
          continue;
        }
        if (stepRun.status === STEP_STATUS.WAITING) {
          // Still waiting on approval — do not advance.
          await this.prisma.withOrganizationContext(organizationId, (tx) =>
            tx.workflowRun.update({
              where: { id: runId },
              data: {
                status: RUN_STATUS.WAITING_APPROVAL,
                currentStepKey: step.key,
              },
            }),
          );
          return;
        }
        if (stepRun.status === STEP_STATUS.FAILED) {
          return;
        }

        await this.prisma.withOrganizationContext(organizationId, (tx) =>
          tx.workflowStepRun.update({
            where: { id: stepRun.id },
            data: {
              status: STEP_STATUS.RUNNING,
              attempt: { increment: 1 },
              startedAt: new Date(),
              input: step.config as Prisma.InputJsonValue,
            },
          }),
        );

        const result = await executeStep({
          prisma: this.prisma,
          organizationId,
          runId,
          stepRunId: stepRun.id,
          step,
          dryRun: run.dryRun,
          triggeredByUserId: run.triggeredByUserId,
          context,
        });

        if (result.status === "waiting") {
          await this.prisma.withOrganizationContext(organizationId, (tx) =>
            tx.workflowStepRun.update({
              where: { id: stepRun.id },
              data: {
                status: STEP_STATUS.WAITING,
                output: result.output as Prisma.InputJsonValue,
              },
            }),
          );
          await this.prisma.withOrganizationContext(organizationId, (tx) =>
            tx.workflowRun.update({
              where: { id: runId },
              data: {
                status: RUN_STATUS.WAITING_APPROVAL,
                currentStepKey: step.key,
                context: context as Prisma.InputJsonValue,
              },
            }),
          );
          return;
        }

        if (result.status === "failed") {
          await this.prisma.withOrganizationContext(organizationId, (tx) =>
            tx.workflowStepRun.update({
              where: { id: stepRun.id },
              data: {
                status: STEP_STATUS.FAILED,
                errorMessage: result.error,
                output: (result.output ?? {}) as Prisma.InputJsonValue,
                finishedAt: new Date(),
              },
            }),
          );
          await this.prisma.withOrganizationContext(organizationId, (tx) =>
            tx.workflowRun.update({
              where: { id: runId },
              data: {
                status: RUN_STATUS.FAILED,
                errorMessage: result.error,
                currentStepKey: step.key,
                context: context as Prisma.InputJsonValue,
                finishedAt: new Date(),
              },
            }),
          );
          return;
        }

        context[step.key] = result.output;
        await this.prisma.withOrganizationContext(organizationId, (tx) =>
          tx.workflowStepRun.update({
            where: { id: stepRun.id },
            data: {
              status: STEP_STATUS.SUCCEEDED,
              output: result.output as Prisma.InputJsonValue,
              finishedAt: new Date(),
            },
          }),
        );
        await this.prisma.withOrganizationContext(organizationId, (tx) =>
          tx.workflowRun.update({
            where: { id: runId },
            data: {
              currentStepKey: step.key,
              context: context as Prisma.InputJsonValue,
            },
          }),
        );
      }

      await this.prisma.withOrganizationContext(organizationId, (tx) =>
        tx.workflowRun.update({
          where: { id: runId },
          data: {
            status: RUN_STATUS.SUCCEEDED,
            finishedAt: new Date(),
            context: context as Prisma.InputJsonValue,
          },
        }),
      );

      await this.auditService.record({
        organizationId,
        action: "workflow.run_succeeded",
        resourceType: "workflow_run",
        resourceId: runId,
        metadata: { dryRun: run.dryRun },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "workflow_failed";
      this.logger.error(`Workflow ${runId} failed: ${message}`);
      await this.prisma.withOrganizationContext(organizationId, (tx) =>
        tx.workflowRun.update({
          where: { id: runId },
          data: {
            status: RUN_STATUS.FAILED,
            errorMessage: message,
            finishedAt: new Date(),
          },
        }),
      );
    }
  }

  scheduledJobId(definitionId: string) {
    return `scheduled-workflow:${definitionId}`;
  }

  async updateSchedule(
    userId: string,
    organizationId: string,
    definitionId: string,
    input: { enabled: boolean; cron?: string; timezone?: string },
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.WORKFLOW_MANAGE,
    );

    const cron = input.cron?.trim() || "0 8 * * *";
    if (input.enabled && !CRON_PATTERN.test(cron)) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "invalid_cron",
        "Cron inválido (se esperan 5 campos)",
      );
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    const timezone =
      input.timezone?.trim() || org?.timezone || "America/Puerto_Rico";

    const definition = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const existing = await tx.workflowDefinition.findFirst({
          where: { id: definitionId, organizationId },
        });
        if (!existing) return null;
        return tx.workflowDefinition.update({
          where: { id: existing.id },
          data: {
            scheduleEnabled: input.enabled,
            scheduleCron: input.enabled ? cron : null,
            scheduleTimezone: input.enabled ? timezone : null,
          },
        });
      },
    );

    if (!definition) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "workflow_not_found",
        "Automatización no encontrada",
      );
    }

    await this.syncScheduler(definition);

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "workflow.schedule_updated",
      resourceType: "workflow_definition",
      resourceId: definition.id,
      metadata: {
        enabled: definition.scheduleEnabled,
        cron: definition.scheduleCron,
        timezone: definition.scheduleTimezone,
      },
    });

    return definition;
  }

  private async syncScheduler(definition: {
    id: string;
    organizationId: string;
    scheduleEnabled: boolean;
    scheduleCron: string | null;
    scheduleTimezone: string | null;
  }) {
    if (this.inlineMode()) return;
    const schedulerId = this.scheduledJobId(definition.id);
    if (!definition.scheduleEnabled || !definition.scheduleCron) {
      try {
        await this.queue.removeJobScheduler(schedulerId);
      } catch {
        // Scheduler may not exist yet.
      }
      return;
    }
    await this.queue.upsertJobScheduler(
      schedulerId,
      {
        pattern: definition.scheduleCron,
        tz: definition.scheduleTimezone ?? "America/Puerto_Rico",
      },
      {
        name: "scheduled",
        data: {
          definitionId: definition.id,
          organizationId: definition.organizationId,
          createRun: true,
        } as WorkflowScheduledJobData,
        opts: {
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      },
    );
  }

  /** Fired by BullMQ scheduler — creates a real (non dry-run) run. */
  async handleScheduledTick(organizationId: string, definitionId: string) {
    const definition = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.workflowDefinition.findFirst({
          where: {
            id: definitionId,
            organizationId,
            status: "active",
            scheduleEnabled: true,
          },
        }),
    );
    if (!definition) return null;

    const steps = parseSteps(definition.steps);
    this.validateSteps(steps);

    const run = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const created = await tx.workflowRun.create({
          data: {
            organizationId,
            companyId: definition.companyId,
            definitionId: definition.id,
            triggeredByUserId: null,
            status: RUN_STATUS.QUEUED,
            dryRun: false,
            context: { trigger: "schedule" },
          },
        });
        for (const step of steps) {
          await tx.workflowStepRun.create({
            data: {
              organizationId,
              runId: created.id,
              stepKey: step.key,
              stepType: step.type,
              status: STEP_STATUS.PENDING,
            },
          });
        }
        return created;
      },
    );

    await this.auditService.record({
      organizationId,
      action: "workflow.run_started",
      resourceType: "workflow_run",
      resourceId: run.id,
      metadata: { definitionId, dryRun: false, trigger: "schedule" },
    });

    await this.dispatch(run.id, organizationId);
    if (this.inlineMode()) {
      return this.prisma.withOrganizationContext(organizationId, (tx) =>
        tx.workflowRun.findUniqueOrThrow({ where: { id: run.id } }),
      );
    }
    return run;
  }
}
