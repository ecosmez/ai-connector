import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GoalsModule } from "../goals/goals.module";
import { PolicyModule } from "../policy/policy.module";
import { SemanticModule } from "../semantic/semantic.module";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";

@Module({
  imports: [AuthModule, PolicyModule, SemanticModule, GoalsModule],
  controllers: [DashboardsController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
