/**
 * Fragrance concentration type (DATABASE_DESIGN.md §4.4). Module-local
 * (not common/) since, unlike Role/OrderStatus/PerfumeGender, it is not
 * referenced outside the Products module (SYSTEM_ARCHITECTURE.md §6.2).
 */
export enum ProductConcentration {
  PARFUM = 'PARFUM',
  EDP = 'EDP',
  EDT = 'EDT',
  EDC = 'EDC',
}
