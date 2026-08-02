import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../types/interfaces/jwt-payload.interface';

/**
 * Extracts the authenticated user (attached to the request by JwtAuthGuard)
 * or a single field of it, e.g. @CurrentUser('sub').
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof JwtPayload | undefined,
    ctx: ExecutionContext,
  ): JwtPayload | JwtPayload[keyof JwtPayload] => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return data ? user?.[data] : user;
  },
);
