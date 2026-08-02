import { SetMetadata } from '@nestjs/common';
import { Role } from '../types/enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Annotates a route with the roles permitted to access it.
 * Consumed by RolesGuard (common/guards/roles.guard.ts).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
