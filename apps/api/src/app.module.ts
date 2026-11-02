import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ConnectorsModule } from "./connectors/connectors.module";
import { DashboardsModule } from "./dashboards/dashboards.module";
import { HealthController } from "./health.controller";
import { PolicyModule } from "./policy/policy.module";
import { PrismaModule } from "./prisma/prisma.module";
import { redisConnection } from "./redis";
import { SyncModule } from "./sync/sync.module";
import { TenancyModule } from "./tenancy/tenancy.module";

@Module({
  imports: [
    BullModule.forRoot({
      connection: redisConnection(),
    }),
    PrismaModule,
    AuthModule,
    TenancyModule,
    PolicyModule,
    AuditModule,
    ConnectorsModule,
    SyncModule,
    DashboardsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
