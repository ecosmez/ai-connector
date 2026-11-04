import { HttpStatus, Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@ai-connector/shared";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { AuditService } from "../audit/audit.service";
import { ApiException } from "../common/errors";
import { createId } from "../common/id";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  SCIM_LIST_SCHEMA,
  SCIM_USER_SCHEMA,
  ScimListResponse,
  ScimUserResource,
} from "./scim.types";

type ScimWriteBody = {
  userName?: string;
  displayName?: string;
  active?: boolean;
  name?: { formatted?: string; givenName?: string; familyName?: string };
  emails?: Array<{ value?: string; primary?: boolean }>;
};

@Injectable()
export class ScimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  private apiBase(): string {
    return (
      process.env.API_PUBLIC_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
      "http://localhost:3001"
    );
  }

  private hashToken(raw: string) {
    return createHash("sha256").update(raw).digest("hex");
  }

  async listTokens(userId: string, organizationId: string) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.ORGANIZATION_MANAGE,
    );
    const items = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.organizationScimToken.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            tokenPrefix: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
          },
        }),
    );
    return { items };
  }

  async createToken(
    userId: string,
    organizationId: string,
    name = "SCIM",
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.ORGANIZATION_MANAGE,
    );
    const raw = `scim_${randomBytes(32).toString("base64url")}`;
    const tokenHash = this.hashToken(raw);
    const tokenPrefix = raw.slice(0, 12);
    const row = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.organizationScimToken.create({
          data: {
            id: createId(),
            organizationId,
            name,
            tokenHash,
            tokenPrefix,
            createdByUserId: userId,
          },
        }),
    );
    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "scim.token_created",
      resourceType: "scim_token",
      resourceId: row.id,
      metadata: { name, tokenPrefix },
    });
    return {
      id: row.id,
      name: row.name,
      tokenPrefix: row.tokenPrefix,
      createdAt: row.createdAt,
      /** Shown once — store in the IdP immediately. */
      token: raw,
    };
  }

  async revokeToken(userId: string, organizationId: string, tokenId: string) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.ORGANIZATION_MANAGE,
    );
    const row = await this.prisma.withOrganizationContext(
      organizationId,
      async (tx) => {
        const existing = await tx.organizationScimToken.findFirst({
          where: { id: tokenId, organizationId },
        });
        if (!existing) {
          throw new ApiException(
            HttpStatus.NOT_FOUND,
            "scim_token_not_found",
            "Token SCIM no encontrado",
          );
        }
        return tx.organizationScimToken.update({
          where: { id: tokenId },
          data: { revokedAt: new Date() },
        });
      },
    );
    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "scim.token_revoked",
      resourceType: "scim_token",
      resourceId: row.id,
    });
    return { id: row.id, revokedAt: row.revokedAt };
  }

  private displayNameFrom(body: ScimWriteBody, email: string): string {
    if (body.displayName?.trim()) return body.displayName.trim();
    if (body.name?.formatted?.trim()) return body.name.formatted.trim();
    const parts = [body.name?.givenName, body.name?.familyName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (parts) return parts;
    return email.split("@")[0] || email;
  }

  private emailFrom(body: ScimWriteBody): string {
    const primary = body.emails?.find((e) => e.primary)?.value;
    const first = body.emails?.[0]?.value;
    const raw = (primary || first || body.userName || "").trim().toLowerCase();
    if (!raw.includes("@")) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "scim_invalid_user",
        "Se requiere un correo (emails/userName)",
      );
    }
    return raw;
  }

  private toResource(
    organizationId: string,
    user: { id: string; email: string; name: string; createdAt: Date; updatedAt: Date },
    active: boolean,
  ): ScimUserResource {
    const location = `${this.apiBase()}/scim/v2/Users/${user.id}`;
    return {
      schemas: [SCIM_USER_SCHEMA],
      id: user.id,
      userName: user.email,
      displayName: user.name,
      name: { formatted: user.name },
      active,
      emails: [{ value: user.email, primary: true, type: "work" }],
      meta: {
        resourceType: "User",
        created: user.createdAt.toISOString(),
        lastModified: user.updatedAt.toISOString(),
        location,
      },
    };
  }

  private async ensureMemberRole(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ) {
    for (const key of Object.values(PERMISSIONS)) {
      await tx.permission.upsert({
        where: { key },
        create: { key },
        update: {},
      });
    }
    let role = await tx.role.findFirst({
      where: { organizationId, key: "org_member" },
    });
    if (!role) {
      role = await tx.role.create({
        data: {
          id: createId(),
          organizationId,
          key: "org_member",
          name: "Miembro (SCIM/SSO)",
          isSystem: true,
        },
      });
      const memberPerms = [
        PERMISSIONS.ORGANIZATION_READ,
        PERMISSIONS.COMPANY_READ,
        PERMISSIONS.DASHBOARD_READ,
        PERMISSIONS.SEMANTIC_READ,
        PERMISSIONS.GOAL_READ,
        PERMISSIONS.ASSISTANT_USE,
        PERMISSIONS.NOTIFICATION_READ,
        PERMISSIONS.AUDIT_READ,
      ] as const;
      for (const permissionKey of memberPerms) {
        const permission = await tx.permission.findUniqueOrThrow({
          where: { key: permissionKey },
        });
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
    const binding = await tx.roleBinding.findFirst({
      where: { organizationId, userId, roleId: role.id },
    });
    if (!binding) {
      await tx.roleBinding.create({
        data: {
          id: createId(),
          organizationId,
          userId,
          roleId: role.id,
        },
      });
    }
  }

  async listUsers(
    organizationId: string,
    tokenId: string,
    query: { filter?: string; startIndex?: number; count?: number },
  ): Promise<ScimListResponse> {
    const startIndex = Math.max(1, query.startIndex ?? 1);
    const count = Math.min(100, Math.max(1, query.count ?? 100));

    let emailFilter: string | undefined;
    if (query.filter) {
      const m = /userName\s+eq\s+"([^"]+)"/i.exec(query.filter);
      if (m) emailFilter = m[1].toLowerCase();
    }

    const memberships = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.membership.findMany({
          where: {
            organizationId,
            ...(emailFilter
              ? { user: { email: emailFilter } }
              : {}),
          },
          include: { user: true },
          orderBy: { createdAt: "asc" },
        }),
    );

    const slice = memberships.slice(startIndex - 1, startIndex - 1 + count);
    const Resources = slice.map((m) =>
      this.toResource(organizationId, m.user, m.status === "active"),
    );

    await this.auditService.record({
      organizationId,
      action: "scim.users_listed",
      resourceType: "scim_token",
      resourceId: tokenId,
      metadata: { count: Resources.length },
    });

    return {
      schemas: [SCIM_LIST_SCHEMA],
      totalResults: memberships.length,
      startIndex,
      itemsPerPage: Resources.length,
      Resources,
    };
  }

  async getUser(
    organizationId: string,
    tokenId: string,
    userId: string,
  ): Promise<ScimUserResource> {
    const membership = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.membership.findFirst({
          where: { organizationId, userId },
          include: { user: true },
        }),
    );
    if (!membership) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "scim_user_not_found",
        "Usuario SCIM no encontrado",
      );
    }
    await this.auditService.record({
      organizationId,
      action: "scim.user_read",
      resourceType: "user",
      resourceId: userId,
      metadata: { tokenId },
    });
    return this.toResource(
      organizationId,
      membership.user,
      membership.status === "active",
    );
  }

  async createUser(
    organizationId: string,
    tokenId: string,
    body: ScimWriteBody,
  ): Promise<ScimUserResource> {
    const email = this.emailFrom(body);
    const name = this.displayNameFrom(body, email);
    const active = body.active !== false;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;

      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            id: createId(),
            email,
            name,
            passwordHash: null,
          },
        });
      } else if (user.name !== name) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { name },
        });
      }

      let membership = await tx.membership.findFirst({
        where: { organizationId, userId: user.id, companyId: null },
      });
      if (!membership) {
        membership = await tx.membership.create({
          data: {
            id: createId(),
            organizationId,
            userId: user.id,
            status: active ? "active" : "suspended",
          },
        });
      } else {
        membership = await tx.membership.update({
          where: { id: membership.id },
          data: { status: active ? "active" : "suspended" },
        });
      }

      if (active) {
        await this.ensureMemberRole(tx, organizationId, user.id);
      }

      return { user, membership };
    });

    await this.auditService.record({
      organizationId,
      action: "scim.user_created",
      resourceType: "user",
      resourceId: result.user.id,
      metadata: { tokenId, email, active },
    });

    return this.toResource(
      organizationId,
      result.user,
      result.membership.status === "active",
    );
  }

  async replaceUser(
    organizationId: string,
    tokenId: string,
    userId: string,
    body: ScimWriteBody,
  ): Promise<ScimUserResource> {
    const email = this.emailFrom(body);
    const name = this.displayNameFrom(body, email);
    const active = body.active !== false;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;

      const membership = await tx.membership.findFirst({
        where: { organizationId, userId },
        include: { user: true },
      });
      if (!membership) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          "scim_user_not_found",
          "Usuario SCIM no encontrado",
        );
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: { email, name },
      });
      const updatedMembership = await tx.membership.update({
        where: { id: membership.id },
        data: { status: active ? "active" : "suspended" },
      });
      if (active) {
        await this.ensureMemberRole(tx, organizationId, userId);
      }
      return { user, membership: updatedMembership };
    });

    await this.auditService.record({
      organizationId,
      action: "scim.user_replaced",
      resourceType: "user",
      resourceId: userId,
      metadata: { tokenId, email, active },
    });

    return this.toResource(
      organizationId,
      result.user,
      result.membership.status === "active",
    );
  }

  async patchUser(
    organizationId: string,
    tokenId: string,
    userId: string,
    body: {
      Operations?: Array<{
        op?: string;
        path?: string;
        value?: unknown;
      }>;
      active?: boolean;
      displayName?: string;
    },
  ): Promise<ScimUserResource> {
    const membership = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.membership.findFirst({
          where: { organizationId, userId },
          include: { user: true },
        }),
    );
    if (!membership) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "scim_user_not_found",
        "Usuario SCIM no encontrado",
      );
    }

    let active = membership.status === "active";
    let name = membership.user.name;

    if (typeof body.active === "boolean") active = body.active;
    if (typeof body.displayName === "string") name = body.displayName;

    for (const op of body.Operations ?? []) {
      const operation = (op.op ?? "replace").toLowerCase();
      if (operation !== "replace" && operation !== "add") continue;
      if (op.path?.toLowerCase() === "active" || (!op.path && typeof op.value === "object" && op.value && "active" in (op.value as object))) {
        const v =
          op.path?.toLowerCase() === "active"
            ? op.value
            : (op.value as { active?: boolean }).active;
        if (typeof v === "boolean") active = v;
      }
      if (op.path?.toLowerCase() === "displayname" && typeof op.value === "string") {
        name = op.value;
      }
      if (
        !op.path &&
        typeof op.value === "object" &&
        op.value &&
        "displayName" in (op.value as object)
      ) {
        const v = (op.value as { displayName?: string }).displayName;
        if (typeof v === "string") name = v;
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
      const user = await tx.user.update({
        where: { id: userId },
        data: { name },
      });
      const updatedMembership = await tx.membership.update({
        where: { id: membership.id },
        data: { status: active ? "active" : "suspended" },
      });
      if (active) {
        await this.ensureMemberRole(tx, organizationId, userId);
      }
      return { user, membership: updatedMembership };
    });

    await this.auditService.record({
      organizationId,
      action: "scim.user_patched",
      resourceType: "user",
      resourceId: userId,
      metadata: { tokenId, active },
    });

    return this.toResource(
      organizationId,
      result.user,
      result.membership.status === "active",
    );
  }

  async deleteUser(
    organizationId: string,
    tokenId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.withOrganizationContext(organizationId, async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { organizationId, userId },
      });
      if (!membership) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          "scim_user_not_found",
          "Usuario SCIM no encontrado",
        );
      }
      await tx.membership.update({
        where: { id: membership.id },
        data: { status: "suspended" },
      });
    });
    await this.auditService.record({
      organizationId,
      action: "scim.user_deleted",
      resourceType: "user",
      resourceId: userId,
      metadata: { tokenId, soft: true },
    });
  }
}
