import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Cross-field DTO validator: ensures the decorated property (discountPrice)
 * is strictly less than another property on the same object (price), per
 * API_BLUEPRINT.md §4 ("discountPrice must be < price when present").
 *
 * Permissive when either value is undefined — PATCH requests may update
 * only one of the two fields, in which case the authoritative comparison
 * against the *effective* (possibly pre-existing) price happens in
 * ProductsService (documented as "validated at DTO/service level").
 */
export function IsLessThanPrice(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isLessThanPrice',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (value === undefined || value === null) {
            return true;
          }

          const [relatedPropertyName] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];

          if (typeof relatedValue !== 'number') {
            return true;
          }

          return typeof value === 'number' && value < relatedValue;
        },
        defaultMessage(args: ValidationArguments): string {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} must be less than ${relatedPropertyName}`;
        },
      },
    });
  };
}
