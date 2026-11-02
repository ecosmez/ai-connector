import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { CurrentAuth } from "./current-auth.decorator";
import { LoginDto, RegisterDto, SwitchContextDto } from "./dto";
import { RequestAuth } from "./auth.types";
import { AuditService } from "../audit/audit.service";

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Post("auth/register")
  async register(@Body() body: RegisterDto) {
    const result = await this.authService.register(
      body.email.toLowerCase(),
      body.password,
      body.name,
    );
    await this.auditService.record({
      actorUserId: result.user.id,
      action: "user.registered",
      resourceType: "user",
      resourceId: result.user.id,
    });
    return result;
  }

  @Post("auth/login")
  async login(@Body() body: LoginDto) {
    const result = await this.authService.login(
      body.email.toLowerCase(),
      body.password,
    );
    await this.auditService.record({
      actorUserId: result.user.id,
      action: "user.login",
      resourceType: "user",
      resourceId: result.user.id,
    });
    return result;
  }

  @Post("auth/logout")
  @UseGuards(AuthGuard)
  async logout(@CurrentAuth() auth: RequestAuth) {
    await this.authService.logout(auth.session.token);
    await this.auditService.record({
      actorUserId: auth.user.id,
      organizationId: auth.session.activeOrganizationId,
      action: "user.logout",
      resourceType: "session",
      resourceId: auth.session.id,
    });
    return { ok: true };
  }

  @Get("auth/me")
  @UseGuards(AuthGuard)
  me(@CurrentAuth() auth: RequestAuth) {
    return this.authService.me(auth.user.id);
  }

  @Post("sessions/context")
  @UseGuards(AuthGuard)
  async switchContext(
    @CurrentAuth() auth: RequestAuth,
    @Body() body: SwitchContextDto,
  ) {
    const result = await this.authService.switchContext(
      auth.session.id,
      auth.user.id,
      body.organizationId,
      body.companyId,
    );
    await this.auditService.record({
      actorUserId: auth.user.id,
      organizationId: result.activeOrganizationId,
      action: "session.context_switched",
      resourceType: "session",
      resourceId: auth.session.id,
      metadata: {
        organizationId: result.activeOrganizationId,
        companyId: result.activeCompanyId,
      },
    });
    return result;
  }
}
