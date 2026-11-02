import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";

@Module({
  imports: [AuthModule, PolicyModule, forwardRef(() => AuditModule)],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
