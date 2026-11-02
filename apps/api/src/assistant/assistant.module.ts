import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";

@Module({
  imports: [AuthModule, PolicyModule, forwardRef(() => AuditModule)],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
