import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PolicyModule } from "../policy/policy.module";
import { SemanticModule } from "../semantic/semantic.module";
import { SyncModule } from "../sync/sync.module";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorsService } from "./connectors.service";

@Module({
  imports: [
    AuthModule,
    PolicyModule,
    forwardRef(() => AuditModule),
    forwardRef(() => SyncModule),
    SemanticModule,
  ],
  controllers: [ConnectorsController],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
