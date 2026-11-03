import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { WORKFLOW_QUEUE } from "./workflow.types";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsProcessor } from "./workflows.processor";
import { WorkflowsService } from "./workflows.service";

@Module({
  imports: [
    BullModule.registerQueue({ name: WORKFLOW_QUEUE }),
    AuthModule,
    PolicyModule,
    forwardRef(() => AuditModule),
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowsProcessor],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
