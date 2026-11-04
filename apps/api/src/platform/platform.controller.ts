import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(AuthGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get("overview")
  overview(@CurrentAuth() auth: RequestAuth) {
    return this.platformService.overview(auth.user.id);
  }

  @Get("organizations")
  organizations(@CurrentAuth() auth: RequestAuth) {
    return this.platformService.listOrganizations(auth.user.id);
  }

  @Get("health")
  health(@CurrentAuth() auth: RequestAuth) {
    return this.platformService.health(auth.user.id);
  }
}
