import { HttpStatus, Injectable } from "@nestjs/common";
import { Permission } from "@ai-connector/shared";
import { ApiException } from "../common/errors";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async listPermissions(
    userId: string,
    organizationId: string,
    companyId?: string | null,
  ): Promise<Set<string>> {
    const now = new Date();
    const bindings = await this.prisma.roleBinding.findMany({
      where: {
        userId,
        organizationId,
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          {
            OR: companyId
              ? [{ companyId: null }, { companyId }]
              : [{ companyId: null }],
          },
        ],
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const binding of bindings) {
      for (const rp of binding.role.permissions) {
        permissions.add(rp.permission.key);
      }
    }
    return permissions;
  }

  async assertPermission(
    userId: string,
    organizationId: string,
    permission: Permission,
    companyId?: string | null,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "active",
        OR: companyId
          ? [{ companyId: null }, { companyId }]
          : undefined,
      },
    });
    if (!membership) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        "not_a_member",
        "No pertenece a esta organización",
      );
    }

    const permissions = await this.listPermissions(
      userId,
      organizationId,
      companyId,
    );
    if (!permissions.has(permission)) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        "forbidden",
        "Permiso insuficiente",
      );
    }
  }
}
