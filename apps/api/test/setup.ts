import "reflect-metadata";

// Process sync jobs in-process during tests (Redis still required for BullMQ DI).
process.env.SYNC_MODE = "inline";
process.env.WORKFLOW_MODE = "inline";
process.env.AI_PROVIDER = "mock";
process.env.AI_ENABLED = "1";
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
}
