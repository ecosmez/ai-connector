import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiException } from "../common/errors";
import { AuthService } from "./auth.service";

const MFA_ENROLL_ALLOWLIST = [
  /^\/auth\/mfa(\/|$)/,
  /^\/auth\/me$/,
  /^\/auth\/logout$/,
];

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      url?: string;
      path?: string;
      originalUrl?: string;
      auth?: unknown;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "missing_token",
        message: "Token requerido",
      });
    }
    const token = header.slice("Bearer ".length).trim();
    const resolved = await this.authService.resolveSession(token);
    if (!resolved) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "invalid_token",
        message: "Sesión inválida o expirada",
      });
    }

    // Password sessions in requireMfa orgs must have TOTP (SSO exempt).
    if (
      resolved.session.authMethod === "password" &&
      resolved.session.activeOrganizationId
    ) {
      const requires = await this.authService.organizationRequiresMfa(
        resolved.session.activeOrganizationId,
      );
      if (requires) {
        const hasMfa = await this.authService.userHasEnabledMfa(
          resolved.user.id,
        );
        if (!hasMfa) {
          const path =
            request.path ||
            (request.originalUrl ?? request.url ?? "").split("?")[0];
          const allowed = MFA_ENROLL_ALLOWLIST.some((re) => re.test(path));
          if (!allowed) {
            throw new ApiException(
              HttpStatus.FORBIDDEN,
              "mfa_enrollment_required",
              "Tu organización exige MFA. Complétalo en Seguridad.",
            );
          }
        }
      }
    }

    request.auth = resolved;
    return true;
  }
}
