import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { WORKFLOW_QUEUE, WorkflowJobData } from "./workflow.types";
import { WorkflowsService } from "./workflows.service";

@Processor(WORKFLOW_QUEUE)
export class WorkflowsProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowsProcessor.name);

  constructor(private readonly workflowsService: WorkflowsService) {
    super();
  }

  async process(job: Job<WorkflowJobData>) {
    this.logger.debug(`Processing workflow job ${job.id}`);
    await this.workflowsService.processRun(job.data);
  }
}
