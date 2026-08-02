import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

const DEFAULT_OPTIONS: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  transformOptions: { enableImplicitConversion: true },
};

/**
 * Global DTO validation pipe (AI_RULES.md §17). Registered once in main.ts
 * and applied to every incoming payload — no endpoint accepts unvalidated
 * raw JSON.
 */
export class GlobalValidationPipe extends ValidationPipe {
  constructor(options: ValidationPipeOptions = {}) {
    super({ ...DEFAULT_OPTIONS, ...options });
  }
}
