import type { ConnectionOptions } from "bullmq";

/** Connection options for BullMQ (Queue and Worker each open their own client). */
export function redisConnection(): ConnectionOptions {
  return {
    url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    maxRetriesPerRequest: null,
  };
}
