import { HttpStatus, Injectable } from "@nestjs/common";
import {
  ORG_OWNER_PERMISSIONS,
  PERMISSIONS,
} from "@ai-connector/shared";
import { ApiException } from "../common/errors";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { PolicyService } from "../policy/policy.service";

@Injectable()
export class TenancyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  async listOrganizationsForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: "active" },
      include: { organization: true },
    });
    const unique = new Map<string, { id: string; name: string; timezone: string }>();
    for (const m of memberships) {
      unique.set(m.organization.id, {
        id: m.organization.id,
        name: m.organization.name,
        timezone: m.organization.timezone,
      });
    }
    return [...unique.values()];
  }

  async getOrganization(userId: string, organizationId: string) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.ORGANIZATION_READ,
    );
    return this.prisma.withOrganizationContext(organizationId, async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!org) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          "organization_not_found",
          "Organización no encontrada",
        );
      }
      return org;
    });
  }

  async createOrganization(
    userId: string,
    name: string,
    timezone = "America/Puerto_Rico",
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name, timezone },
      });

      for (const key of Object.values(PERMISSIONS)) {
        await tx.permission.upsert({
          where: { key },
          create: { key },
          update: {},
        });
      }

      const role = await tx.role.create({
        data: {
          organizationId: org.id,
          key: "org_owner",
          name: "Propietario de organización",
          isSystem: true,
        },
      });

      for (const permissionKey of ORG_OWNER_PERMISSIONS) {
        const permission = await tx.permission.findUniqueOrThrow({
          where: { key: permissionKey },
        });
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }

      await tx.membership.create({
        data: { organizationId: org.id, userId },
      });
      await tx.roleBinding.create({
        data: {
          organizationId: org.id,
          userId,
          roleId: role.id,
        },
      });

      return org;
    });

    await this.auditService.record({
      organizationId: result.id,
      actorUserId: userId,
      action: "organization.created",
      resourceType: "organization",
      resourceId: result.id,
      metadata: { name: result.name },
    });

    return result;
  }

  async listCompanies(userId: string, organizationId: string) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.COMPANY_READ,
    );

    return this.prisma.withOrganizationContext(organizationId, async (tx) => {
      const memberships = await tx.membership.findMany({
        where: { userId, organizationId, status: "active" },
      });
      const companyIds = memberships
        .map((m) => m.companyId)
        .filter((id): id is string => Boolean(id));
      const hasOrgWide = memberships.some((m) => m.companyId == null);

      return tx.company.findMany({
        where: {
          organizationId,
          ...(hasOrgWide ? {} : { id: { in: companyIds } }),
        },
        orderBy: { name: "asc" },
      });
    });
  }

  async createCompany(
    userId: string,
    organizationId: string,
    name: string,
    timezone?: string,
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.COMPANY_CREATE,
    );

    const company = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const org = await tx.organization.findUnique({
          where: { id: organizationId },
        });
        if (!org) {
          throw new ApiException(
            HttpStatus.NOT_FOUND,
            "organization_not_found",
            "Organización no encontrada",
          );
        }
        return tx.company.create({
          data: {
            organizationId,
            name,
            timezone: timezone ?? null,
          },
        });
      },
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "company.created",
      resourceType: "company",
      resourceId: company.id,
      metadata: { name: company.name },
    });

    return company;
  }

  /**
   * Hard rule: company.organizationId cannot change silently.
   * Exposed for tests / future admin tooling — always rejects.
   */
  async assertOrganizationImmutable(_companyId: string, _newOrgId: string) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      "organization_immutable",
      "No se puede cambiar organizationId de una compañía",
    );
  }
}
