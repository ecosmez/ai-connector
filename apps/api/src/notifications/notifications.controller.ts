import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { NotificationsService } from "./notifications.service";

@Controller()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("organizations/:orgId/notifications")
  list(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    return this.notificationsService.list(auth.user.id, orgId, {
      unreadOnly: unreadOnly === "1" || unreadOnly === "true",
    });
  }

  @Post("organizations/:orgId/notifications/:notificationId/read")
  markRead(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("notificationId") notificationId: string,
  ) {
    return this.notificationsService.markRead(
      auth.user.id,
      orgId,
      notificationId,
    );
  }
}
