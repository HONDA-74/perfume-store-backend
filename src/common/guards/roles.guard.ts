import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../types/enums/role.enum';
import { RequestWithUser } from '../types/request-with-user.type';

/**
 * Authorizes requests based on the roles declared via @Roles().
 * Must run after JwtAuthGuard so that request.user is already populated.
 * Routes without an explicit @Roles() annotation are allowed through
 * (authentication alone is sufficient) — default-deny for role checks is
 * enforced at the route-annotation level, per AI_RULES.md §23.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    return !!user && requiredRoles.includes(user.role);
  }
}
