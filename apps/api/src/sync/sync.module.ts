import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { CONNECTION_SYNC_QUEUE } from "./sync.constants";
import { SyncController } from "./sync.controller";
import { SyncProcessor } from "./sync.processor";
import { SyncService } from "./sync.service";

@Module({
  imports: [
    BullModule.registerQueue({ name: CONNECTION_SYNC_QUEUE }),
    AuthModule,
    PolicyModule,
    forwardRef(() => AuditModule),
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncProcessor],
  exports: [SyncService],
})
export class SyncModule {}
