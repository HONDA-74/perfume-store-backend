/**
 * Generates a human-readable, sortable order number (API_BLUEPRINT.md §9
 * — "generated server-side, human-readable, unique (e.g. ORD-2026-000123)").
 * Module-local per IMPLEMENTATION_PLAN.md M9 ("likely module-local since
 * only Orders uses it") — no other module needs this format.
 */
export function generateOrderNumber(
  sequence: number,
  year: number = new Date().getFullYear(),
): string {
  return `ORD-${year}-${String(sequence).padStart(6, '0')}`;
}
