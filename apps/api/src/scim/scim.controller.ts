import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { CreateScimTokenDto } from "./dto";
import { CurrentScim } from "./current-scim.decorator";
import { ScimAuthContext, ScimBearerGuard } from "./scim.guard";
import { ScimService } from "./scim.service";

@Controller()
export class ScimController {
  constructor(private readonly scimService: ScimService) {}

  // --- Admin token management (session auth) ---

  @Get("organizations/:orgId/scim/tokens")
  @UseGuards(AuthGuard)
  listTokens(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    return this.scimService.listTokens(auth.user.id, orgId);
  }

  @Post("organizations/:orgId/scim/tokens")
  @UseGuards(AuthGuard)
  createToken(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Body() body: CreateScimTokenDto,
  ) {
    return this.scimService.createToken(
      auth.user.id,
      orgId,
      body.name?.trim() || "SCIM",
    );
  }

  @Post("organizations/:orgId/scim/tokens/:tokenId/revoke")
  @UseGuards(AuthGuard)
  revokeToken(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Param("tokenId") tokenId: string,
  ) {
    return this.scimService.revokeToken(auth.user.id, orgId, tokenId);
  }

  // --- SCIM 2.0 Users ---

  @Get("scim/v2/Users")
  @UseGuards(ScimBearerGuard)
  listUsers(
    @CurrentScim() scim: ScimAuthContext,
    @Query("filter") filter?: string,
    @Query("startIndex") startIndex?: string,
    @Query("count") count?: string,
  ) {
    return this.scimService.listUsers(scim.organizationId, scim.tokenId, {
      filter,
      startIndex: startIndex ? Number(startIndex) : undefined,
      count: count ? Number(count) : undefined,
    });
  }

  @Get("scim/v2/Users/:id")
  @UseGuards(ScimBearerGuard)
  getUser(
    @CurrentScim() scim: ScimAuthContext,
    @Param("id") id: string,
  ) {
    return this.scimService.getUser(scim.organizationId, scim.tokenId, id);
  }

  @Post("scim/v2/Users")
  @UseGuards(ScimBearerGuard)
  @HttpCode(201)
  createUser(
    @CurrentScim() scim: ScimAuthContext,
    @Body() body: Record<string, unknown>,
  ) {
    return this.scimService.createUser(
      scim.organizationId,
      scim.tokenId,
      body as never,
    );
  }

  @Put("scim/v2/Users/:id")
  @UseGuards(ScimBearerGuard)
  replaceUser(
    @CurrentScim() scim: ScimAuthContext,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.scimService.replaceUser(
      scim.organizationId,
      scim.tokenId,
      id,
      body as never,
    );
  }

  @Patch("scim/v2/Users/:id")
  @UseGuards(ScimBearerGuard)
  patchUser(
    @CurrentScim() scim: ScimAuthContext,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.scimService.patchUser(
      scim.organizationId,
      scim.tokenId,
      id,
      body as never,
    );
  }

  @Delete("scim/v2/Users/:id")
  @UseGuards(ScimBearerGuard)
  async deleteUser(
    @CurrentScim() scim: ScimAuthContext,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    await this.scimService.deleteUser(
      scim.organizationId,
      scim.tokenId,
      id,
    );
    return res.status(204).send();
  }
}
