import { HttpStatus, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { ApiException } from "../common/errors";
import { PrismaService } from "../prisma/prisma.service";
import { AuthSession, AuthUser } from "./auth.types";

const SESSION_DAYS = 14;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private toUser(user: { id: string; email: string; name: string }): AuthUser {
    return { id: user.id, email: user.email, name: user.name };
  }

  async register(email: string, password: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "email_taken",
        "El correo ya está registrado",
      );
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, name },
    });
    return this.createSession(user.id);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "invalid_credentials",
        "Credenciales inválidas",
      );
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "invalid_credentials",
        "Credenciales inválidas",
      );
    }
    return this.createSession(user.id);
  }

  async createSession(userId: string): Promise<{ token: string; user: AuthUser }> {
    const token = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

    const membership = await this.prisma.membership.findFirst({
      where: { userId, status: "active" },
      orderBy: { createdAt: "asc" },
    });

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        activeOrganizationId: membership?.organizationId ?? null,
        activeCompanyId: membership?.companyId ?? null,
      },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { token, user: this.toUser(user) };
  }

  async logout(token: string) {
    const tokenHash = this.hashToken(token);
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async resolveSession(token: string): Promise<{
    user: AuthUser;
    session: AuthSession;
  } | null> {
    const tokenHash = this.hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }
    return {
      user: this.toUser(session.user),
      session: {
        id: session.id,
        token,
        userId: session.userId,
        activeOrganizationId: session.activeOrganizationId,
        activeCompanyId: session.activeCompanyId,
        expiresAt: session.expiresAt,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: "active" },
      include: {
        organization: true,
        company: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return {
      user: this.toUser(user),
      memberships: memberships.map((m) => ({
        id: m.id,
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        companyId: m.companyId,
        companyName: m.company?.name ?? null,
      })),
    };
  }

  async switchContext(
    sessionId: string,
    userId: string,
    organizationId: string,
    companyId?: string | null,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "active",
        OR: companyId
          ? [{ companyId }, { companyId: null }]
          : [{ companyId: null }, { companyId: { not: null } }],
      },
    });
    if (!membership) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        "not_a_member",
        "No pertenece a esta organización",
      );
    }

    if (companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: companyId, organizationId },
      });
      if (!company) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          "company_not_found",
          "Compañía no encontrada en la organización",
        );
      }
      const companyScoped = await this.prisma.membership.findFirst({
        where: {
          userId,
          organizationId,
          status: "active",
          OR: [{ companyId: null }, { companyId }],
        },
      });
      if (!companyScoped) {
        throw new ApiException(
          HttpStatus.FORBIDDEN,
          "company_forbidden",
          "Sin acceso a esta compañía",
        );
      }
    }

    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        activeOrganizationId: organizationId,
        activeCompanyId: companyId ?? null,
      },
    });

    return {
      activeOrganizationId: session.activeOrganizationId,
      activeCompanyId: session.activeCompanyId,
    };
  }
}
