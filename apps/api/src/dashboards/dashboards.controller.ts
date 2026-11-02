import {
  Controller,
  Get,
  Headers,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { DashboardsService } from "./dashboards.service";

@Controller()
@UseGuards(AuthGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get("organizations/:orgId/dashboards")
  list(@CurrentAuth() auth: RequestAuth, @Param("orgId") orgId: string) {
    return this.dashboardsService.listDashboards(
      auth.user.id,
      orgId,
      auth.session.activeCompanyId,
    );
  }

  @Get("organizations/:orgId/dashboards/:dashboardId")
  async get(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("dashboardId") dashboardId: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const view = await this.dashboardsService.getDashboard(
      auth.user.id,
      orgId,
      dashboardId,
      auth.session.activeCompanyId,
    );

    if (view.etag) {
      res.setHeader("ETag", `"${view.etag}"`);
      const clientTag = ifNoneMatch?.replaceAll('"', "").trim();
      if (clientTag && clientTag === view.etag) {
        res.status(304);
        return undefined;
      }
    }

    return view;
  }
}
