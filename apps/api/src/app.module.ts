import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AssistantModule } from "./assistant/assistant.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ConnectorsModule } from "./connectors/connectors.module";
import { DashboardsModule } from "./dashboards/dashboards.module";
import { GoalsModule } from "./goals/goals.module";
import { HealthController } from "./health.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { PolicyModule } from "./policy/policy.module";
import { PrismaModule } from "./prisma/prisma.module";
import { redisConnection } from "./redis";
import { SemanticModule } from "./semantic/semantic.module";
import { SyncModule } from "./sync/sync.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { WorkflowsModule } from "./workflows/workflows.module";

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
    SemanticModule,
    GoalsModule,
    DashboardsModule,
    AssistantModule,
    WorkflowsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
