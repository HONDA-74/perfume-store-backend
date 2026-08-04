/**
 * DATABASE_DESIGN.md §4.7 — Orders.paymentStatus. Placed in common/ (not
 * module-local) because the future Payments module (SYSTEM_ARCHITECTURE.md
 * §4.2 "Payments: Orders") will also reference this concept, mirroring how
 * Role/OrderStatus are already shared here.
 */
export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}
