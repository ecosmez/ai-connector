import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { CreateGoalDto } from "./dto";
import { GoalsService } from "./goals.service";

@Controller()
@UseGuards(AuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get("organizations/:orgId/goals")
  list(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Query("dashboardId") dashboardId?: string,
  ) {
    return this.goalsService.listGoals(
      auth.user.id,
      orgId,
      dashboardId,
      auth.session.activeCompanyId,
    );
  }

  @Post("organizations/:orgId/goals")
  create(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Body() body: CreateGoalDto,
  ) {
    return this.goalsService.createGoal(auth.user.id, orgId, {
      name: body.name,
      metricKey: body.metricKey,
      targetValue: body.targetValue,
      comparator: body.comparator,
      dashboardId: body.dashboardId ?? null,
      companyId: body.companyId ?? auth.session.activeCompanyId,
    });
  }
}
