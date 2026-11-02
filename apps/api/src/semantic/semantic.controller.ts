import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { SemanticService } from "./semantic.service";

@Controller()
@UseGuards(AuthGuard)
export class SemanticController {
  constructor(private readonly semanticService: SemanticService) {}

  @Get("organizations/:orgId/connections/:connectionId/semantic-model")
  get(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("connectionId") connectionId: string,
  ) {
    return this.semanticService.getByConnection(
      auth.user.id,
      orgId,
      connectionId,
      auth.session.activeCompanyId,
    );
  }

  @Post("organizations/:orgId/connections/:connectionId/semantic-model")
  ensure(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("connectionId") connectionId: string,
  ) {
    return this.semanticService.ensureForConnection(
      auth.user.id,
      orgId,
      connectionId,
      auth.session.activeCompanyId,
    );
  }
}
