import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { SyncService } from "./sync.service";

@Controller()
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post("organizations/:orgId/connections/:connectionId/sync")
  triggerSync(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("connectionId") connectionId: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.syncService.enqueueManualSync(
      auth.user.id,
      orgId,
      connectionId,
      idempotencyKey ?? null,
      auth.session.activeCompanyId,
    );
  }

  @Get("organizations/:orgId/sync-runs")
  listRuns(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Query("connectionId") connectionId?: string,
  ) {
    return this.syncService.listSyncRuns(
      auth.user.id,
      orgId,
      connectionId,
    );
  }

  @Get("organizations/:orgId/sync-runs/:syncRunId")
  getRun(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("syncRunId") syncRunId: string,
  ) {
    return this.syncService.getSyncRun(auth.user.id, orgId, syncRunId);
  }
}
