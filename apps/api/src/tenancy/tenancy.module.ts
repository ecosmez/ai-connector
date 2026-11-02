import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { TenancyController } from "./tenancy.controller";
import { TenancyService } from "./tenancy.service";

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => AuditModule)],
  controllers: [TenancyController],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
