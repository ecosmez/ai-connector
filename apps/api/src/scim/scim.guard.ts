import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { createHash } from "crypto";
import { ApiException } from "../common/errors";
import { PrismaService } from "../prisma/prisma.service";

export type ScimAuthContext = {
  organizationId: string;
  tokenId: string;
};

@Injectable()
export class ScimBearerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      scimAuth?: ScimAuthContext;
    }>();
    const header = req.headers.authorization ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "scim_unauthorized",
        "Bearer token requerido",
      );
    }
    const raw = match[1].trim();
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const row = await this.prisma.organizationScimToken.findUnique({
      where: { tokenHash },
    });
    if (!row || row.revokedAt) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "scim_unauthorized",
        "Token SCIM inválido",
      );
    }
    await this.prisma.organizationScimToken.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });
    req.scimAuth = {
      organizationId: row.organizationId,
      tokenId: row.id,
    };
    return true;
  }
}
