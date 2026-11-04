import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import {
  WORKFLOW_QUEUE,
  WorkflowJobData,
  WorkflowScheduledJobData,
} from "./workflow.types";
import { WorkflowsService } from "./workflows.service";

@Processor(WORKFLOW_QUEUE)
export class WorkflowsProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowsProcessor.name);

  constructor(private readonly workflowsService: WorkflowsService) {
    super();
  }

  async process(
    job: Job<WorkflowJobData | WorkflowScheduledJobData>,
  ) {
    if (job.name === "scheduled" || ("createRun" in job.data && job.data.createRun)) {
      const data = job.data as WorkflowScheduledJobData;
      this.logger.debug(
        `Scheduled workflow tick definition=${data.definitionId}`,
      );
      await this.workflowsService.handleScheduledTick(
        data.organizationId,
        data.definitionId,
      );
      return;
    }
    this.logger.debug(`Processing workflow job ${job.id}`);
    await this.workflowsService.processRun(job.data as WorkflowJobData);
  }
}
