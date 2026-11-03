import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { CurrentAuth } from "./current-auth.decorator";
import {
  LoginDto,
  MfaDisableDto,
  MfaEnableDto,
  MfaVerifyLoginDto,
  RegisterDto,
  SwitchContextDto,
} from "./dto";
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
    if ("mfaRequired" in result && result.mfaRequired) {
      await this.auditService.record({
        actorUserId: result.user.id,
        action: "user.login_mfa_challenge",
        resourceType: "user",
        resourceId: result.user.id,
      });
      return result;
    }
    await this.auditService.record({
      actorUserId: result.user.id,
      action: "user.login",
      resourceType: "user",
      resourceId: result.user.id,
    });
    return result;
  }

  @Post("auth/mfa/verify")
  async verifyMfa(@Body() body: MfaVerifyLoginDto) {
    const result = await this.authService.verifyMfaLogin(
      body.mfaToken,
      body.code,
    );
    await this.auditService.record({
      actorUserId: result.user.id,
      action: "user.login_mfa",
      resourceType: "user",
      resourceId: result.user.id,
    });
    return result;
  }

  @Get("auth/mfa")
  @UseGuards(AuthGuard)
  mfaStatus(@CurrentAuth() auth: RequestAuth) {
    return this.authService.mfaStatus(auth.user.id);
  }

  @Post("auth/mfa/setup")
  @UseGuards(AuthGuard)
  setupMfa(@CurrentAuth() auth: RequestAuth) {
    return this.authService.setupMfa(auth.user.id);
  }

  @Post("auth/mfa/enable")
  @UseGuards(AuthGuard)
  async enableMfa(
    @CurrentAuth() auth: RequestAuth,
    @Body() body: MfaEnableDto,
  ) {
    const result = await this.authService.enableMfa(auth.user.id, body.code);
    await this.auditService.record({
      actorUserId: auth.user.id,
      organizationId: auth.session.activeOrganizationId,
      action: "user.mfa_enabled",
      resourceType: "user",
      resourceId: auth.user.id,
    });
    return result;
  }

  @Post("auth/mfa/disable")
  @UseGuards(AuthGuard)
  async disableMfa(
    @CurrentAuth() auth: RequestAuth,
    @Body() body: MfaDisableDto,
  ) {
    const result = await this.authService.disableMfa(
      auth.user.id,
      body.password,
      body.code,
    );
    await this.auditService.record({
      actorUserId: auth.user.id,
      organizationId: auth.session.activeOrganizationId,
      action: "user.mfa_disabled",
      resourceType: "user",
      resourceId: auth.user.id,
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
