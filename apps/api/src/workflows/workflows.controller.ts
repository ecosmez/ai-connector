import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import {
  CreateWorkflowDto,
  DecideApprovalDto,
  StartWorkflowRunDto,
  UpdateWorkflowScheduleDto,
} from "./dto";
import { WorkflowsService } from "./workflows.service";

@Controller()
@UseGuards(AuthGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post("organizations/:orgId/workflows")
  create(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Body() body: CreateWorkflowDto,
  ) {
    return this.workflowsService.createDefinition(auth.user.id, orgId, {
      name: body.name,
      description: body.description,
      steps: body.steps,
      companyId: body.companyId ?? auth.session.activeCompanyId,
    });
  }

  @Get("organizations/:orgId/workflows")
  list(@CurrentAuth() auth: RequestAuth, @Param("orgId") orgId: string) {
    return this.workflowsService.listDefinitions(
      auth.user.id,
      orgId,
      auth.session.activeCompanyId,
    );
  }

  @Post("organizations/:orgId/workflows/:workflowId/schedule")
  updateSchedule(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("workflowId") workflowId: string,
    @Body() body: UpdateWorkflowScheduleDto,
  ) {
    return this.workflowsService.updateSchedule(
      auth.user.id,
      orgId,
      workflowId,
      {
        enabled: body.enabled,
        cron: body.cron,
        timezone: body.timezone,
      },
    );
  }

  @Post("organizations/:orgId/workflows/:workflowId/runs")
  startRun(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("workflowId") workflowId: string,
    @Body() body: StartWorkflowRunDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.workflowsService.startRun(auth.user.id, orgId, workflowId, {
      dryRun: body.dryRun,
      idempotencyKey: idempotencyKey ?? null,
      companyId: auth.session.activeCompanyId,
    });
  }

  @Get("organizations/:orgId/workflow-runs")
  listRuns(@CurrentAuth() auth: RequestAuth, @Param("orgId") orgId: string) {
    return this.workflowsService.listRuns(auth.user.id, orgId);
  }

  @Get("organizations/:orgId/workflow-runs/:runId")
  getRun(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("runId") runId: string,
  ) {
    return this.workflowsService.getRun(auth.user.id, orgId, runId);
  }

  @Get("organizations/:orgId/approvals")
  listApprovals(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Query("status") status?: string,
  ) {
    return this.workflowsService.listApprovals(
      auth.user.id,
      orgId,
      status ?? "pending",
    );
  }

  @Post("organizations/:orgId/approvals/:approvalId/decide")
  decide(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("approvalId") approvalId: string,
    @Body() body: DecideApprovalDto,
  ) {
    return this.workflowsService.decideApproval(
      auth.user.id,
      orgId,
      approvalId,
      body.decision,
      body.note,
    );
  }
}
