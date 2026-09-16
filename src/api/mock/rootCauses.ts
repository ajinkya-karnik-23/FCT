import type { RootCauseEntry } from '../types';
import { ANCHOR, addDays, isoDate } from './exceptions';

// §17 — the root cause register: one row per root cause under a §6.1 cause, at group level (§17.2). Twelve causes to
// start (six P2P + six O2C), three entries each; it grows as the register works. valueCr and affectedItems tie to the
// parent cause (§17.6): across a cause's entries they sum exactly to the taxonomy node's valueAtRisk and to that
// cause's §7.20 pool in the reference entity (JGL — 327 blocked invoices, 284 O2C exceptions), so "missing GR is
// ₹6.4 cr" reads as its three root causes summing to ₹6.4 cr over 111 invoices. The ties are asserted in tests, not
// enforced here, because the pools derive from entities.ts at read time (no circular import).
// §7.21 — targetDate is relative: every date derives from today via ANCHOR, so a "+12 d" target never goes stale.
const t = (days: number) => isoDate(addDays(ANCHOR, days));

export const rootCauses: RootCauseEntry[] = [
  // P2P — missing GR (pool 111 · ₹6.4 cr)
  { id: 'RC-001', parentCause: 'missing-gr', process: 'P2P', why: 'Consignment stock — GR only on consumption', entityCodes: ['JGL', 'JBL'], valueCr: 3.0, affectedItems: 50, fix: 'Move the eleven consignment vendors to GR-based invoicing', owner: 'A. Sethi · Commercial', state: 'eliminated', newArrivals: 0 },
  { id: 'RC-002', parentCause: 'missing-gr', process: 'P2P', why: 'Goods received, held in QC release', entityCodes: ['JGL'], valueCr: 2.9, affectedItems: 36, fix: 'Auto-hold invoicing until QC posts the release; chase QC on the held receipts', owner: 'P. Nair · Quality', agentId: 'follow-up', state: 'fixed-at-source', newArrivals: 0, residueTrend: [28, 25, 21, 17, 13, 9] },
  { id: 'RC-003', parentCause: 'missing-gr', process: 'P2P', why: 'Delivery slipped, PO date stale', entityCodes: ['JGL', 'JBL'], valueCr: 0.5, affectedItems: 25, fix: 'Amend the PO delivery date once slippage is confirmed', owner: 'R. Iyer · Procurement', agentId: 'commitments', state: 'in-progress', newArrivals: 4, targetDate: t(12) },

  // P2P — PO price mismatch (pool 72 · ₹4.1 cr)
  { id: 'RC-004', parentCause: 'po-price-mismatch', process: 'P2P', why: 'Contract escalation signed but never loaded into the info record', entityCodes: ['JGL'], valueCr: 2.3, affectedItems: 32, fix: 'Load contract escalations at signature and reset the match tolerance to the contracted band', owner: 'A. Sethi · Procurement', agentId: 'match-resolution', state: 'eliminated', newArrivals: 0 },
  { id: 'RC-005', parentCause: 'po-price-mismatch', process: 'P2P', why: 'Off-contract rates negotiated but not yet re-papered', entityCodes: ['JGL', 'JBL'], valueCr: 1.3, affectedItems: 23, fix: 'Re-paper the four vendors at contracted rates or raise debit notes', owner: 'P. Nair · Procurement', agentId: 'contract-price-sync', state: 'in-progress', newArrivals: 6, targetDate: t(21) },
  { id: 'RC-006', parentCause: 'po-price-mismatch', process: 'P2P', why: 'Price lists versioned per plant, not per contract', entityCodes: ['JGL'], valueCr: 0.5, affectedItems: 17, fix: 'Version price lists against contracts at load time', owner: 'S. Rao · Procurement', state: 'identified', newArrivals: 3 },

  // P2P — approval pending (pool 59 · ₹3.3 cr)
  { id: 'RC-007', parentCause: 'approval-pending', process: 'P2P', why: 'Delegation not maintained while approvers travel', entityCodes: ['JGL', 'JBL', 'JPS'], valueCr: 1.6, affectedItems: 26, fix: 'Sync the delegation matrix from the travel calendar automatically', owner: 'R. Iyer · AP ops', agentId: 'approval-routing', state: 'eliminated', newArrivals: 0 },
  { id: 'RC-008', parentCause: 'approval-pending', process: 'P2P', why: 'Approver absent beyond the chase window', entityCodes: ['JGL'], valueCr: 1.1, affectedItems: 19, fix: 'Auto-reroute to the delegate after 48 hours without release', owner: 'P. Nair · AP ops', agentId: 'approval-routing', state: 'fixed-at-source', newArrivals: 0, residueTrend: [21, 18, 15, 12, 9, 6] },
  { id: 'RC-009', parentCause: 'approval-pending', process: 'P2P', why: 'Indirect spend above ₹10 lakh has no DOA band', entityCodes: ['JGL', 'JBL'], valueCr: 0.6, affectedItems: 14, fix: 'Add the missing DOA band for indirect spend', owner: 'S. Rao · Finance controller', state: 'identified', newArrivals: 2 },

  // P2P — vendor master (pool 36 · ₹2.0 cr)
  { id: 'RC-010', parentCause: 'vendor-master', process: 'P2P', why: 'One-time service vendors onboarded outside the standard workflow', entityCodes: ['JGL'], valueCr: 1.2, affectedItems: 16, fix: 'Gate all vendor creation through the standard validation flow', owner: 'A. Sethi · Master data', agentId: 'master-data', state: 'eliminated', newArrivals: 0 },
  { id: 'RC-011', parentCause: 'vendor-master', process: 'P2P', why: 'Legacy vendor records carry stale bank and GST details', entityCodes: ['JGL', 'JBL'], valueCr: 0.5, affectedItems: 12, fix: 'Bulk re-validation of the legacy record set against IRN history', owner: 'P. Nair · Master data', agentId: 'master-data', state: 'fixed-at-source', newArrivals: 0, residueTrend: [14, 12, 9, 7, 5, 3] },
  { id: 'RC-012', parentCause: 'vendor-master', process: 'P2P', why: 'Vendor portal self-service updates bypass validation', entityCodes: ['JGL', 'JPS'], valueCr: 0.3, affectedItems: 8, fix: 'Route portal edits through the same validation as standard onboarding', owner: 'R. Iyer · Master data', state: 'identified', newArrivals: 3 },

  // P2P — duplicate suspicion (pool 26 · ₹1.5 cr)
  { id: 'RC-013', parentCause: 'duplicate-suspicion', process: 'P2P', why: 'Email intake duplicates the portal submission', entityCodes: ['JGL'], valueCr: 0.9, affectedItems: 12, fix: 'Dedup on IRN plus PO line across both intakes', owner: 'S. Rao · AP ops', agentId: 'duplicate-adjudication', state: 'fixed-at-source', newArrivals: 0, residueTrend: [11, 9, 8, 6, 4, 2] },
  { id: 'RC-014', parentCause: 'duplicate-suspicion', process: 'P2P', why: 'Portal allows the same invoice to be submitted twice', entityCodes: ['JGL'], valueCr: 0.4, affectedItems: 9, fix: 'Block a second submission while the first is in flight', owner: 'A. Sethi · AP ops', agentId: 'duplicate-adjudication', state: 'in-progress', newArrivals: 7, targetDate: t(9) },
  { id: 'RC-015', parentCause: 'duplicate-suspicion', process: 'P2P', why: 'Vendors reuse e-invoice IRNs across documents', entityCodes: ['JGL', 'JBL'], valueCr: 0.2, affectedItems: 5, fix: 'Flag IRN reuse at intake and query the vendor', owner: 'P. Nair · AP ops', state: 'identified', newArrivals: 4 },

  // P2P — tax mismatch (pool 23 · ₹1.3 cr)
  { id: 'RC-016', parentCause: 'tax-mismatch', process: 'P2P', why: 'GSTIN not validated when the invoice is booked', entityCodes: ['JGL'], valueCr: 0.6, affectedItems: 10, fix: 'Validate GST registration at booking, before the block forms', owner: 'R. Iyer · AP & tax', agentId: 'tax-determination', state: 'identified', newArrivals: 8 },
  { id: 'RC-017', parentCause: 'tax-mismatch', process: 'P2P', why: 'State-wise rate tables drift from the e-invoice registry', entityCodes: ['JGL', 'JBL'], valueCr: 0.4, affectedItems: 7, fix: 'Sync rate tables from the registry each period', owner: 'S. Rao · AP & tax', state: 'identified', newArrivals: 5 },
  { id: 'RC-018', parentCause: 'tax-mismatch', process: 'P2P', why: 'E-invoice tax codes map to the wrong SAP codes', entityCodes: ['JGL'], valueCr: 0.3, affectedItems: 6, fix: 'Rebuild the e-invoice-to-SAP tax code map', owner: 'A. Sethi · AP & tax', state: 'identified', newArrivals: 2 },

  // O2C — pricing disputes (pool 88 · ₹5.4 cr)
  { id: 'RC-019', parentCause: 'pricing-disputes', process: 'O2C', why: 'Mid-quarter rate revisions not pushed to billing before the invoice run', entityCodes: ['JGL', 'JBL'], valueCr: 2.4, affectedItems: 40, fix: 'Push contracted-rate revisions to billing ahead of each invoice run', owner: 'W. Tan · Commercial', agentId: 'billing-readiness', state: 'fixed-at-source', newArrivals: 0, residueTrend: [38, 32, 26, 20, 15, 10] },
  { id: 'RC-020', parentCause: 'pricing-disputes', process: 'O2C', why: 'Pricing evidence sits outside the billing system', entityCodes: ['JGL'], valueCr: 1.9, affectedItems: 28, fix: 'Attach contract pricing evidence at dispute intake', owner: 'L. Cheong · Commercial', agentId: 'collections-outreach', state: 'in-progress', newArrivals: 6, targetDate: t(15) },
  { id: 'RC-021', parentCause: 'pricing-disputes', process: 'O2C', why: 'Contract versions not tracked across the nine customers', entityCodes: ['JGL', 'JCP'], valueCr: 1.1, affectedItems: 20, fix: 'Track contract versions per customer at signature', owner: 'D. Whitfield · Commercial', state: 'identified', newArrivals: 4 },

  // O2C — deductions (pool 68 · ₹4.1 cr)
  { id: 'RC-022', parentCause: 'deductions', process: 'O2C', why: 'Deductions posted without reference to an approved credit note', entityCodes: ['JGL', 'JBL'], valueCr: 1.8, affectedItems: 31, fix: 'Require the credit-note reference at deduction posting', owner: 'K. Moreau · Collections', agentId: 'deduction-triage', state: 'in-progress', newArrivals: 5, targetDate: t(18) },
  { id: 'RC-023', parentCause: 'deductions', process: 'O2C', why: 'Scheme claims deducted without an approval trail', entityCodes: ['JGL', 'JHS'], valueCr: 1.5, affectedItems: 22, fix: 'Reconcile scheme deductions against the approved claim register', owner: 'J. Halloran · Collections', state: 'identified', newArrivals: 7 },
  { id: 'RC-024', parentCause: 'deductions', process: 'O2C', why: 'Freight and damage claims adjudicated after payment', entityCodes: ['JGL'], valueCr: 0.8, affectedItems: 15, fix: 'Adjudicate freight and damage claims before the deduction posts', owner: 'T. Bergstrom · Collections', agentId: 'deduction-triage', state: 'identified', newArrivals: 3 },

  // O2C — billing errors (pool 48 · ₹2.9 cr)
  { id: 'RC-025', parentCause: 'billing-errors', process: 'O2C', why: 'Invoices created without PO reference or valid GST registration', entityCodes: ['JGL', 'JRP'], valueCr: 1.3, affectedItems: 22, fix: 'Validate PO reference and GST registration at invoice creation', owner: 'C. Tremblay · Billing', agentId: 'billing-readiness', state: 'fixed-at-source', newArrivals: 0, residueTrend: [19, 16, 13, 10, 7, 4] },
  { id: 'RC-026', parentCause: 'billing-errors', process: 'O2C', why: 'Ship-to detail wrong on non-standard order types', entityCodes: ['JGL'], valueCr: 1.1, affectedItems: 16, fix: 'Standardise ship-to capture at order entry', owner: 'N. Okafor · Billing', agentId: 'billing-readiness', state: 'in-progress', newArrivals: 9, targetDate: t(14) },
  { id: 'RC-027', parentCause: 'billing-errors', process: 'O2C', why: 'Four order types created outside the standard flow', entityCodes: ['JGL', 'JBL'], valueCr: 0.5, affectedItems: 10, fix: 'Bring the four order types into the standard billing flow', owner: 'W. Tan · Billing', state: 'identified', newArrivals: 4 },

  // O2C — credit block (pool 34 · ₹2.1 cr)
  { id: 'RC-028', parentCause: 'credit-block', process: 'O2C', why: 'Exposure limits last reviewed a year ago', entityCodes: ['JGL', 'JPS'], valueCr: 0.9, affectedItems: 15, fix: 'Refresh exposure limits from the payment record automatically', owner: 'L. Cheong · Credit', agentId: 'credit-watch', state: 'fixed-at-source', newArrivals: 0, residueTrend: [15, 13, 10, 8, 6, 4] },
  { id: 'RC-029', parentCause: 'credit-block', process: 'O2C', why: 'Clean-payment customers held for manual review', entityCodes: ['JGL'], valueCr: 0.8, affectedItems: 12, fix: 'Fast-path release for customers with a clean payment record', owner: 'D. Whitfield · Credit', agentId: 'credit-release', state: 'in-progress', newArrivals: 5, targetDate: t(11) },
  { id: 'RC-030', parentCause: 'credit-block', process: 'O2C', why: 'Limit reviews run annually, not quarterly', entityCodes: ['JGL', 'JBL'], valueCr: 0.4, affectedItems: 7, fix: 'Move limit reviews to a quarterly cadence', owner: 'K. Moreau · Credit', state: 'identified', newArrivals: 3 },

  // O2C — cash application (pool 26 · ₹3.1 cr)
  { id: 'RC-031', parentCause: 'cash-application', process: 'O2C', why: 'Receipts arrive without remittance advice', entityCodes: ['JGL', 'JBL'], valueCr: 1.4, affectedItems: 12, fix: 'Parse remittance advice from bank feeds at receipt', owner: 'J. Halloran · Treasury', agentId: 'cash-application', state: 'in-progress', newArrivals: 2, targetDate: t(24) },
  { id: 'RC-032', parentCause: 'cash-application', process: 'O2C', why: 'One receipt covers multiple invoices with no reference', entityCodes: ['JGL'], valueCr: 1.0, affectedItems: 9, fix: 'Split multi-invoice receipts against the open invoice list', owner: 'T. Bergstrom · Treasury', agentId: 'cash-application', state: 'identified', newArrivals: 4 },
  { id: 'RC-033', parentCause: 'cash-application', process: 'O2C', why: 'Bank statement formats vary across banks', entityCodes: ['JGL', 'JCP'], valueCr: 0.7, affectedItems: 5, fix: 'Normalise statement formats at the bank feed layer', owner: 'C. Tremblay · Treasury', state: 'identified', newArrivals: 5 },

  // O2C — customer master (pool 20 · ₹1.2 cr)
  { id: 'RC-034', parentCause: 'customer-master', process: 'O2C', why: 'Credit terms not standardised across the customer base', entityCodes: ['JGL', 'JRP'], valueCr: 0.5, affectedItems: 9, fix: 'Standardise credit terms at onboarding and review', owner: 'N. Okafor · Master data', agentId: 'master-data', state: 'identified', newArrivals: 8 },
  { id: 'RC-035', parentCause: 'customer-master', process: 'O2C', why: 'Customer records onboarded without tax registration checks', entityCodes: ['JGL'], valueCr: 0.4, affectedItems: 6, fix: 'Check tax registration completeness at customer onboarding', owner: 'W. Tan · Master data', state: 'identified', newArrivals: 6 },
  { id: 'RC-036', parentCause: 'customer-master', process: 'O2C', why: 'Stale customer records distort the ageing view', entityCodes: ['JGL', 'JPS'], valueCr: 0.3, affectedItems: 5, fix: 'Re-validate the oldest customer records against the registry', owner: 'L. Cheong · Master data', state: 'identified', newArrivals: 3 },
];

// §7.30 — group open-exception counts for periods 1–4 (periods 5–6 are live from score.ts). Moved here with the
// register it now feeds; the definition string stays in score.ts so every screen cites one definition (§8.6.1).
export const earlyOpenExceptions = [2158, 2117, 2069, 2034];

// §17.3 — root causes closed (eliminated + fixed at source), cumulative across the six periods. The endpoint ties to
// the live register: it must equal eliminated + fixed-at-source in rootCauseCounts(), which the tests assert.
export const closedByPeriod = [1, 2, 4, 6, 9, 11];

// §7.30 overclaim guard — the exceptions generated last period by the root causes closed this period (and none in this one).
export const closedThisPeriodGeneratedLastPeriod = 37;
