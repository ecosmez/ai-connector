import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { ScimBearerGuard } from "./scim.guard";
import { ScimController } from "./scim.controller";
import { ScimService } from "./scim.service";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => AuditModule),
    PolicyModule,
  ],
  controllers: [ScimController],
  providers: [ScimService, ScimBearerGuard],
  exports: [ScimService],
})
export class ScimModule {}
