export const ERROR_MESSAGES = {
  VALIDATION_FAILED: 'Validation failed.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'A conflicting resource already exists.',
  DUPLICATE_RESOURCE: 'This resource already exists.',
  INVALID_IDENTIFIER: 'The provided identifier is invalid.',
  INVALID_OBJECT_ID: 'The provided identifier is not a valid ID.',
  DATABASE_ERROR: 'A database error occurred. Please try again later.',
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again later.',
} as const;
