import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as publicly accessible, bypassing JwtAuthGuard.
 * Default posture is deny (AI_RULES.md §23) — every route requires this
 * decorator explicitly to skip authentication.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
