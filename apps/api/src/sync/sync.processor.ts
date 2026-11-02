import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { CONNECTION_SYNC_QUEUE, SyncJobData } from "./sync.constants";
import { SyncService } from "./sync.service";

@Processor(CONNECTION_SYNC_QUEUE)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncService: SyncService) {
    super();
  }

  async process(job: Job<SyncJobData & { createRun?: boolean }>) {
    this.logger.debug(`Processing sync job ${job.id} name=${job.name}`);
    if (job.name === "scheduled" || job.data.createRun || !job.data.syncRunId) {
      await this.syncService.handleScheduledTick(
        job.data.organizationId,
        job.data.connectionId,
      );
      return;
    }
    await this.syncService.executeSyncRun(job.data);
  }
}
