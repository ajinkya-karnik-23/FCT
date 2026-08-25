import type { AgeingBucket, CashOpportunity, GroupSummary, PayableReason, RecurringCause, ServiceControl } from '../types';

// spec/03 — Other datasets. All values are reference data for the bid demo.

export const blockedInvoiceAgeing: AgeingBucket[] = [
  { label: '0-15 d', value: 5.9 },
  { label: '16-30 d', value: 4.2 },
  { label: '31-60 d', value: 4.1 },
  { label: '61-90 d', value: 2.6 },
  { label: '> 90 d', value: 1.8 },
];

export const receivablesAgeing: AgeingBucket[] = [
  { label: '0-30 d', value: 24.1 },
  { label: '31-60 d', value: 11.6 },
  { label: '61-90 d', value: 8.2 },
  { label: '91-180 d', value: 7.4 },
  { label: '> 180 d', value: 5.0 },
];

export const payablesByReason: PayableReason[] = [
  { name: 'Missing GR', value: 6.3 },
  { name: 'PO price mismatch', value: 4.1 },
  { name: 'Approval pending', value: 3.2 },
  { name: 'Vendor master', value: 1.8 },
  { name: 'Duplicate / tax', value: 1.6 },
];

export const cashOpportunities: CashOpportunity[] = [
  { name: 'Release invoices where GR posted this week', value: 4.2, items: 38, effort: 'Low', owner: 'P2P tower' },
  { name: 'Apply matched receipts to open AR', value: 2.1, items: 19, effort: 'Low', owner: 'Cash application' },
  { name: 'Settle pricing disputes under ₹10 lakh', value: 1.4, items: 27, effort: 'Medium', owner: 'Collections' },
  { name: 'Clear intercompany netting with Ingrevia', value: 3.6, items: 4, effort: 'Medium', owner: 'R2R tower' },
];

export const recurringCauses: RecurringCause[] = [
  { name: 'Missing GR', processKey: 'p2p', sharePct: 26 },
  { name: 'Pricing disputes', processKey: 'o2c', sharePct: 21 },
  { name: 'Interface breaks', processKey: 'r2r', sharePct: 18 },
  { name: 'Approval delays', processKey: 'p2p', sharePct: 14 },
];

export const serviceControl: ServiceControl = {
  slaInvoiceBookingPct: 93.1,
  queriesOverdue: 27,
  duplicatePaymentRiskCr: 0.9,
  manualPaymentRuns: 4,
};

// spec/03 — Group aggregates shown on the group view (score is the mean of entity scores).
export const groupSummary: GroupSummary = {
  score: 76.5,
  valueAtRiskCr: 92.4,
  openExceptions: 1486,
  closeProgress: { pct: 71, totalTasks: 214, overdue: 19, blockers: 6, entitiesAtRisk: 3 },
  transformationHealth: { automationRatePct: 68, repeatExceptionsQoqPct: -14, causesEliminated: '11 of 34', touchlessInvoicesPct: 54 },
};
