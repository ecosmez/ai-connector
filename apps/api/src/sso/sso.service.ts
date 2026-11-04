import { HttpStatus, Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@ai-connector/shared";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { AuditService } from "../audit/audit.service";
import { encryptSecret, decryptSecret } from "../auth/mfa-crypto";
import { ApiException } from "../common/errors";
import { createId } from "../common/id";
import { PolicyService } from "../policy/policy.service";
import { PrismaService } from "../prisma/prisma.service";
import { pkceChallenge, randomUrlSafe } from "./pkce";

const STATE_TTL_MINUTES = 10;
const CODE_TTL_MINUTES = 5;

@Injectable()
export class SsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  private apiPublicBase(): string {
    return (
      process.env.API_PUBLIC_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
      "http://localhost:3001"
    );
  }

  private webPublicBase(): string {
    return (
      process.env.WEB_PUBLIC_URL?.replace(/\/$/, "") ||
      "http://localhost:3000"
    );
  }

  private mockIssuer(organizationId: string): string {
    return `${this.apiPublicBase()}/auth/sso/mock/${organizationId}`;
  }

  async getConfig(userId: string, organizationId: string) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.ORGANIZATION_READ,
    );
    const config = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.organizationSsoConfig.findUnique({ where: { organizationId } }),
    );
    if (!config) {
      return {
        enabled: false,
        provider: "mock" as const,
        jitProvisioning: true,
        issuer: null,
        clientId: null,
        configured: false,
      };
    }
    return {
      enabled: config.enabled,
      provider: config.provider,
      jitProvisioning: config.jitProvisioning,
      issuer: config.issuer,
      clientId: config.clientId,
      configured: true,
    };
  }

  async upsertConfig(
    userId: string,
    organizationId: string,
    input: {
      enabled: boolean;
      provider?: "mock";
      jitProvisioning?: boolean;
    },
  ) {
    await this.policyService.assertPermission(
      userId,
      organizationId,
      PERMISSIONS.ORGANIZATION_MANAGE,
    );

    const provider = input.provider ?? "mock";
    if (provider !== "mock") {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_provider_unsupported",
        "Solo el proveedor mock está disponible en S9",
      );
    }

    const issuer = this.mockIssuer(organizationId);
    const existing = await this.prisma.organizationSsoConfig.findUnique({
      where: { organizationId },
    });

    const clientId = existing?.clientId ?? `mock-${organizationId.slice(0, 8)}`;
    const clientSecretPlain =
      existing != null
        ? decryptSecret(existing.clientSecretCiphertext)
        : randomBytes(24).toString("base64url");

    const config = await this.prisma.withOrganizationContext(
      organizationId,
      (tx) =>
        tx.organizationSsoConfig.upsert({
          where: { organizationId },
          create: {
            id: createId(),
            organizationId,
            provider,
            issuer,
            clientId,
            clientSecretCiphertext: encryptSecret(clientSecretPlain),
            enabled: input.enabled,
            jitProvisioning: input.jitProvisioning ?? true,
          },
          update: {
            provider,
            issuer,
            enabled: input.enabled,
            ...(input.jitProvisioning !== undefined
              ? { jitProvisioning: input.jitProvisioning }
              : {}),
          },
        }),
    );

    await this.auditService.record({
      organizationId,
      actorUserId: userId,
      action: "sso.config_updated",
      resourceType: "organization_sso",
      resourceId: config.id,
      metadata: {
        enabled: config.enabled,
        provider: config.provider,
        jitProvisioning: config.jitProvisioning,
      },
    });

    return {
      enabled: config.enabled,
      provider: config.provider,
      jitProvisioning: config.jitProvisioning,
      issuer: config.issuer,
      clientId: config.clientId,
      configured: true,
    };
  }

  /** Public: whether org has SSO enabled (no secrets). */
  async publicStatus(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!org) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "organization_not_found",
        "Organización no encontrada",
      );
    }
    const config = await this.prisma.organizationSsoConfig.findUnique({
      where: { organizationId },
    });
    return {
      organizationId: org.id,
      organizationName: org.name,
      enabled: Boolean(config?.enabled),
      provider: config?.provider ?? null,
    };
  }

  async start(organizationId: string) {
    const config = await this.prisma.organizationSsoConfig.findUnique({
      where: { organizationId },
    });
    if (!config?.enabled) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_not_enabled",
        "SSO no está habilitado para esta organización",
      );
    }

    const state = randomUrlSafe(24);
    const codeVerifier = randomUrlSafe(32);
    const nonce = randomUrlSafe(16);
    const redirectUri = `${this.apiPublicBase()}/auth/sso/callback`;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + STATE_TTL_MINUTES);

    await this.prisma.ssoAuthState.create({
      data: {
        id: createId(),
        state,
        codeVerifier,
        nonce,
        organizationId,
        redirectUri,
        expiresAt,
      },
    });

    const challenge = pkceChallenge(codeVerifier);
    const authorizeUrl = new URL(`${config.issuer}/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("scope", "openid email profile");
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("nonce", nonce);

    return { authorizeUrl: authorizeUrl.toString(), state };
  }

  /** Mock IdP authorize — issues a one-time code and redirects to redirect_uri. */
  async mockAuthorize(params: {
    organizationId: string;
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    email: string;
    name?: string;
  }) {
    const config = await this.prisma.organizationSsoConfig.findUnique({
      where: { organizationId: params.organizationId },
    });
    if (!config?.enabled || config.provider !== "mock") {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_mock_unavailable",
        "IdP mock no disponible",
      );
    }
    if (config.clientId !== params.clientId) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_invalid_client",
        "client_id inválido",
      );
    }

    const email = params.email.trim().toLowerCase();
    if (!email.includes("@")) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_invalid_email",
        "Correo inválido",
      );
    }
    const name =
      params.name?.trim() ||
      email.split("@")[0] ||
      "Usuario SSO";
    const subject = `mock:${createHash("sha256").update(email).digest("hex").slice(0, 24)}`;
    const code = randomUrlSafe(24);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CODE_TTL_MINUTES);

    await this.prisma.ssoAuthorizationCode.create({
      data: {
        id: createId(),
        code,
        organizationId: params.organizationId,
        email,
        name,
        subject,
        codeChallenge: params.codeChallenge,
        redirectUri: params.redirectUri,
        expiresAt,
      },
    });

    const target = new URL(params.redirectUri);
    target.searchParams.set("code", code);
    target.searchParams.set("state", params.state);
    return { redirectUrl: target.toString() };
  }

  async callback(code: string, state: string) {
    const authState = await this.prisma.ssoAuthState.findUnique({
      where: { state },
    });
    if (!authState || authState.expiresAt < new Date()) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_state_invalid",
        "Estado SSO inválido o expirado",
      );
    }

    const config = await this.prisma.organizationSsoConfig.findUnique({
      where: { organizationId: authState.organizationId },
    });
    if (!config?.enabled) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_not_enabled",
        "SSO no está habilitado",
      );
    }

    const claims = await this.exchangeCode({
      config,
      code,
      codeVerifier: authState.codeVerifier,
      redirectUri: authState.redirectUri,
    });

    await this.prisma.ssoAuthState.delete({ where: { id: authState.id } });

    const session = await this.provisionAndLogin({
      organizationId: authState.organizationId,
      issuer: config.issuer,
      subject: claims.subject,
      email: claims.email,
      name: claims.name,
      jitProvisioning: config.jitProvisioning,
    });

    await this.auditService.record({
      organizationId: authState.organizationId,
      actorUserId: session.user.id,
      action: "user.login_sso",
      resourceType: "user",
      resourceId: session.user.id,
      metadata: { provider: config.provider, issuer: config.issuer },
    });

    return {
      ...session,
      organizationId: authState.organizationId,
      webRedirect: `${this.webPublicBase()}/auth/sso/complete`,
    };
  }

  private async exchangeCode(input: {
    config: {
      provider: string;
      organizationId: string;
      clientId: string;
      clientSecretCiphertext: string;
      issuer: string;
    };
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }) {
    if (input.config.provider !== "mock") {
      throw new ApiException(
        HttpStatus.NOT_IMPLEMENTED,
        "sso_oidc_not_wired",
        "Proveedor OIDC externo aún no configurado",
      );
    }

    const row = await this.prisma.ssoAuthorizationCode.findUnique({
      where: { code: input.code },
    });
    if (
      !row ||
      row.consumedAt ||
      row.expiresAt < new Date() ||
      row.organizationId !== input.config.organizationId ||
      row.redirectUri !== input.redirectUri
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_code_invalid",
        "Código de autorización inválido",
      );
    }

    const expected = pkceChallenge(input.codeVerifier);
    if (expected !== row.codeChallenge) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "sso_pkce_failed",
        "Verificación PKCE fallida",
      );
    }

    // Validate client secret exists (mock accepts matching decrypt).
    decryptSecret(input.config.clientSecretCiphertext);

    await this.prisma.ssoAuthorizationCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });

    return {
      subject: row.subject,
      email: row.email,
      name: row.name,
    };
  }

  private async provisionAndLogin(input: {
    organizationId: string;
    issuer: string;
    subject: string;
    email: string;
    name: string;
    jitProvisioning: boolean;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${input.organizationId}, true)`;

      let identity = await tx.userSsoIdentity.findUnique({
        where: {
          issuer_subject: { issuer: input.issuer, subject: input.subject },
        },
        include: { user: true },
      });

      let user = identity?.user ?? null;

      if (!user) {
        user = await tx.user.findUnique({ where: { email: input.email } });
      }

      if (!user) {
        if (!input.jitProvisioning) {
          throw new ApiException(
            HttpStatus.FORBIDDEN,
            "sso_user_unknown",
            "Usuario no provisionado y JIT deshabilitado",
          );
        }
        user = await tx.user.create({
          data: {
            id: createId(),
            email: input.email,
            name: input.name,
            passwordHash: null,
          },
        });
      }

      const membership = await tx.membership.findFirst({
        where: {
          userId: user.id,
          organizationId: input.organizationId,
          status: "active",
        },
      });

      if (!membership) {
        if (!input.jitProvisioning) {
          throw new ApiException(
            HttpStatus.FORBIDDEN,
            "sso_not_a_member",
            "Sin membresía en la organización",
          );
        }
        await this.ensureMemberRole(tx, input.organizationId, user.id);
      }

      if (!identity) {
        identity = await tx.userSsoIdentity.create({
          data: {
            id: createId(),
            userId: user.id,
            organizationId: input.organizationId,
            issuer: input.issuer,
            subject: input.subject,
            email: input.email,
          },
          include: { user: true },
        });
      }

      // Session created outside RLS tx via AuthService after commit — do inline:
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);
      await tx.session.create({
        data: {
          id: createId(),
          userId: user.id,
          tokenHash,
          expiresAt,
          activeOrganizationId: input.organizationId,
          activeCompanyId: null,
        },
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isPlatformAdmin: Boolean(user.isPlatformAdmin),
        },
      };
    });
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
          name: "Miembro (SSO)",
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

    await tx.membership.create({
      data: {
        id: createId(),
        organizationId,
        userId,
      },
    });
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
