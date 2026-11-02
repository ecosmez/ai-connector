export const CONNECTION_SYNC_QUEUE = "connection-sync";

export type SyncJobData = {
  syncRunId: string;
  organizationId: string;
  connectionId: string;
};

export const SYNC_TRIGGERS = {
  MANUAL: "manual",
  SCHEDULED: "scheduled",
} as const;

export const SYNC_STATUSES = {
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
} as const;
