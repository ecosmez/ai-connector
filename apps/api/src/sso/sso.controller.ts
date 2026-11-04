import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { UpsertSsoConfigDto } from "./dto";
import { SsoService } from "./sso.service";

@Controller()
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Get("organizations/:orgId/sso")
  @UseGuards(AuthGuard)
  getConfig(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    return this.ssoService.getConfig(auth.user.id, orgId);
  }

  @Put("organizations/:orgId/sso")
  @UseGuards(AuthGuard)
  upsertConfig(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Body() body: UpsertSsoConfigDto,
  ) {
    return this.ssoService.upsertConfig(auth.user.id, orgId, body);
  }

  @Get("auth/sso/status")
  status(@Query("organizationId") organizationId: string) {
    return this.ssoService.publicStatus(organizationId);
  }

  @Get("auth/sso/start")
  start(@Query("organizationId") organizationId: string) {
    return this.ssoService.start(organizationId);
  }

  /** Mock IdP authorize endpoint (HTML form + POST). */
  @Get("auth/sso/mock/:orgId/authorize")
  @Header("Content-Type", "text/html; charset=utf-8")
  mockAuthorizeForm(
    @Param("orgId") orgId: string,
    @Query("client_id") clientId: string,
    @Query("redirect_uri") redirectUri: string,
    @Query("state") state: string,
    @Query("code_challenge") codeChallenge: string,
    @Query("email") email: string | undefined,
    @Query("name") name: string | undefined,
    @Res() res: Response,
  ) {
    // If email present (form submit or API test), auto-approve.
    if (email) {
      return this.ssoService
        .mockAuthorize({
          organizationId: orgId,
          clientId,
          redirectUri,
          state,
          codeChallenge,
          email,
          name,
        })
        .then((r) => res.redirect(302, r.redirectUrl))
        .catch((err: Error & { getStatus?: () => number; message?: string }) => {
          const status =
            typeof err.getStatus === "function" ? err.getStatus() : 400;
          res.status(status).type("html").send(
            `<!doctype html><html lang="es"><body><h1>Error SSO mock</h1><p>${err.message ?? "error"}</p></body></html>`,
          );
        });
    }

    const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/><title>SSO mock — AI Connector</title>
<style>
body{font-family:system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem}
label{display:block;margin:.75rem 0} input{width:100%;padding:.5rem}
button{margin-top:1rem;padding:.6rem 1rem}
</style></head>
<body>
  <h1>IdP mock</h1>
  <p>Organización <code>${orgId}</code></p>
  <form method="get" action="/auth/sso/mock/${orgId}/authorize">
    <input type="hidden" name="client_id" value="${clientId ?? ""}"/>
    <input type="hidden" name="redirect_uri" value="${redirectUri ?? ""}"/>
    <input type="hidden" name="state" value="${state ?? ""}"/>
    <input type="hidden" name="code_challenge" value="${codeChallenge ?? ""}"/>
    <label>Correo <input name="email" type="email" required/></label>
    <label>Nombre <input name="name" type="text"/></label>
    <button type="submit">Continuar</button>
  </form>
</body></html>`;
    res.status(200).send(html);
  }

  @Get("auth/sso/callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("format") format: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.ssoService.callback(code, state);
    if (format === "json") {
      return res.json({
        token: result.token,
        user: result.user,
        organizationId: result.organizationId,
      });
    }
    const target = new URL(result.webRedirect);
    target.searchParams.set("token", result.token);
    return res.redirect(302, target.toString());
  }
}
