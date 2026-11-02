import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { RequestAuth } from "./auth.types";

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestAuth => {
    const request = ctx.switchToHttp().getRequest<{ auth: RequestAuth }>();
    return request.auth;
  },
);
