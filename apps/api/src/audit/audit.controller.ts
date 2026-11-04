import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { PERMISSIONS } from "@ai-connector/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { RequestAuth } from "../auth/auth.types";
import { PolicyService } from "../policy/policy.service";
import { AuditService } from "./audit.service";

@Controller()
@UseGuards(AuthGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly policyService: PolicyService,
  ) {}

  @Get("organizations/:orgId/audit-events")
  async list(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    await this.policyService.assertPermission(
      auth.user.id,
      orgId,
      PERMISSIONS.AUDIT_READ,
      auth.session.activeCompanyId,
    );
    const events = await this.auditService.listForOrganization(orgId);
    return { items: events };
  }

  @Get("organizations/:orgId/audit-events/export")
  async export(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    await this.policyService.assertPermission(
      auth.user.id,
      orgId,
      PERMISSIONS.AUDIT_READ,
      auth.session.activeCompanyId,
    );
    return this.auditService.exportForOrganization(orgId);
  }

  @Get("organizations/:orgId/audit-events/verify")
  async verify(
    @CurrentAuth() auth: RequestAuth,
    @Param("orgId") orgId: string,
  ) {
    await this.policyService.assertPermission(
      auth.user.id,
      orgId,
      PERMISSIONS.AUDIT_READ,
      auth.session.activeCompanyId,
    );
    return this.auditService.verifyForOrganization(orgId);
  }
}
