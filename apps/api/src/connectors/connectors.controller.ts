import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { ConnectorsService } from "./connectors.service";
import { CreateConnectionDto } from "./dto";

@Controller()
@UseGuards(AuthGuard)
export class ConnectorsController {
  constructor(private readonly connectorsService: ConnectorsService) {}

  @Get("organizations/:orgId/connections")
  list(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    return this.connectorsService.listConnections(
      auth.user.id,
      orgId,
      auth.session.activeCompanyId,
    );
  }

  @Post("organizations/:orgId/connections")
  create(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Body() body: CreateConnectionDto,
  ) {
    return this.connectorsService.createConnection(
      auth.user.id,
      orgId,
      body.name,
      body.companyId ?? auth.session.activeCompanyId,
    );
  }

  @Get("organizations/:orgId/connections/:connectionId")
  get(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("connectionId") connectionId: string,
  ) {
    return this.connectorsService.getConnection(
      auth.user.id,
      orgId,
      connectionId,
      auth.session.activeCompanyId,
    );
  }
}
