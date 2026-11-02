import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
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
    request.auth = resolved;
    return true;
  }
}
