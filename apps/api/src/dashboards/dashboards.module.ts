import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { DashboardsController } from "./dashboards.controller";
import { DashboardsService } from "./dashboards.service";

@Module({
  imports: [AuthModule, PolicyModule],
  controllers: [DashboardsController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
