import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { SemanticController } from "./semantic.controller";
import { SemanticService } from "./semantic.service";

@Module({
  imports: [AuthModule, PolicyModule, forwardRef(() => AuditModule)],
  controllers: [SemanticController],
  providers: [SemanticService],
  exports: [SemanticService],
})
export class SemanticModule {}
