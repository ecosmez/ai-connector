import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { PolicyModule } from "./policy/policy.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TenancyModule } from "./tenancy/tenancy.module";

@Module({
  imports: [PrismaModule, AuthModule, TenancyModule, PolicyModule, AuditModule],
  controllers: [HealthController],
})
export class AppModule {}
