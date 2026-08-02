import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Authenticates requests via the "jwt" Passport strategy and attaches the
 * decoded payload to `request.user`. Requests to routes annotated with
 * @Public() bypass authentication entirely.
 *
 * The concrete JwtStrategy (token verification) is registered by the Auth
 * module — see IMPLEMENTATION_PLAN.md M2. This guard's contract (401 on
 * failure, request.user populated on success) is a common/ concern and is
 * intentionally written ahead of the strategy's existence, per
 * SYSTEM_ARCHITECTURE.md §3 M1 note.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
