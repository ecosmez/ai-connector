import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ScimAuthContext } from "./scim.guard";

export const CurrentScim = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ScimAuthContext => {
    const req = ctx.switchToHttp().getRequest<{ scimAuth: ScimAuthContext }>();
    return req.scimAuth;
  },
);
