import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import {
  CreateCompanyDto,
  CreateOrganizationDto,
  UpdateSecurityPolicyDto,
} from "./dto";
import { TenancyService } from "./tenancy.service";

@Controller()
@UseGuards(AuthGuard)
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get("organizations")
  listOrgs(@CurrentAuth() auth: RequestAuth) {
    return this.tenancyService.listOrganizationsForUser(auth.user.id);
  }

  @Post("organizations")
  createOrg(
    @CurrentAuth() auth: RequestAuth,
    @Body() body: CreateOrganizationDto,
  ) {
    return this.tenancyService.createOrganization(
      auth.user.id,
      body.name,
      body.timezone ?? "America/Puerto_Rico",
    );
  }

  @Get("organizations/:id")
  getOrg(@CurrentAuth() auth: RequestAuth, @Param("id") id: string) {
    return this.tenancyService.getOrganization(auth.user.id, id);
  }

  @Get("organizations/:orgId/security-policy")
  getSecurityPolicy(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    return this.tenancyService.getSecurityPolicy(auth.user.id, orgId);
  }

  @Put("organizations/:orgId/security-policy")
  updateSecurityPolicy(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Body() body: UpdateSecurityPolicyDto,
  ) {
    return this.tenancyService.updateSecurityPolicy(
      auth.user.id,
      orgId,
      body.requireMfa,
    );
  }

  @Get("organizations/:orgId/companies")
  listCompanies(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    return this.tenancyService.listCompanies(auth.user.id, orgId);
  }

  @Post("organizations/:orgId/companies")
  createCompany(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
    @Body() body: CreateCompanyDto,
  ) {
    return this.tenancyService.createCompany(
      auth.user.id,
      orgId,
      body.name,
      body.timezone,
    );
  }
}
