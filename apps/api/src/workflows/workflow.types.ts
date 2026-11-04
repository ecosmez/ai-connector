export const WORKFLOW_QUEUE = "workflow-runs";

export const WORKFLOW_STEP_TYPES = [
  "check_goal",
  "notify",
  "wait_approval",
] as const;

export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

export type WorkflowStepDef = {
  key: string;
  type: WorkflowStepType;
  config?: Record<string, unknown>;
};

export type WorkflowJobData = {
  runId: string;
  organizationId: string;
};

export type WorkflowScheduledJobData = {
  definitionId: string;
  organizationId: string;
  createRun: true;
};

export const RUN_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  WAITING_APPROVAL: "waiting_approval",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const STEP_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  WAITING: "waiting",
  SKIPPED: "skipped",
} as const;
