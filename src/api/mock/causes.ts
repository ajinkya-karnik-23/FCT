import type { CauseNode } from '../types';

// spec/03 — P2P root-cause taxonomy (6, fixed); spec/08 Part C — O2C taxonomy (6).
// AI classifies within this set and never invents a cause. For O2C nodes the `plants`
// field carries customer segments and `vendors` carries cause drivers (spec/08 Part C).
export const causes: CauseNode[] = [
  {
    processKey: 'p2p',
    key: 'missing-gr',
    name: 'Missing GR',
    sharePct: 34,
    valueAtRisk: 6.4,
    avgDelayDays: 8.4,
    recurrence: 5,
    concentration: '11 vendors',
    agentResolvablePct: 75, // §15.4 — JGL mix
    narrative:
      'Invoices at Nanjangud and Roorkee remain blocked because goods receipts are posted after invoice receipt; the two plants account for 72% of affected value. Eleven vendors drive the pattern, led by consignment chemicals at 38%; average GR lag is 8.4 days and it has repeated for five consecutive months.',
    plants: [
      { name: 'Nanjangud', pct: 43 },
      { name: 'Roorkee', pct: 29 },
      { name: 'Ambernath', pct: 18 },
      { name: 'Noida', pct: 10 },
    ],
    vendors: [
      { name: 'Consignment chemicals', pct: 38 },
      { name: 'Packaging', pct: 27 },
      { name: 'Logistics', pct: 21 },
      { name: 'Other', pct: 14 },
    ],
    actions: [
      'GR compliance alert for the top 11 vendor/plant pairs',
      'Auto-escalate to plant controller after 48 hours',
      'Move consignment vendors to GR-based invoicing',
    ],
  },
  {
    processKey: 'p2p',
    key: 'po-price-mismatch',
    name: 'PO price mismatch',
    sharePct: 22,
    valueAtRisk: 4.1,
    avgDelayDays: 6.1,
    recurrence: 3,
    concentration: '4 vendors',
    agentResolvablePct: 60, // §15.4 — JGL mix
    narrative:
      'Price differences arise where contract escalations were signed but not loaded into the purchasing info record. Four vendors account for all of the ₹4.1 cr; buyers resolve them manually each cycle and the pattern has repeated for three consecutive months.',
    plants: [
      { name: 'Roorkee', pct: 41 },
      { name: 'Noida', pct: 27 },
      { name: 'Nanjangud', pct: 20 },
      { name: 'Ambernath', pct: 12 },
    ],
    vendors: [
      { name: 'Solvents', pct: 34 },
      { name: 'Instruments', pct: 28 },
      { name: 'Packaging', pct: 22 },
      { name: 'Other', pct: 16 },
    ],
    actions: [
      'Sync contract escalations to info records monthly',
      'Tolerance review with category managers',
      'Block PO release when the price source is stale',
    ],
  },
  {
    processKey: 'p2p',
    key: 'approval-pending',
    name: 'Approval pending',
    sharePct: 18,
    valueAtRisk: 3.3,
    avgDelayDays: 5.2,
    recurrence: 2,
    concentration: '2 plants',
    agentResolvablePct: 80, // §15.4 — JGL mix
    byGroup: [{ name: 'Approvers', count: 7, pct: 64 }],
    narrative:
      'Approvals stall with seven approvers who hold 64% of the ₹3.3 cr value, concentrated in indirect spend above ₹10 lakh. Delegation is not maintained during travel.',
    plants: [
      { name: 'Ambernath', pct: 36 },
      { name: 'Noida', pct: 31 },
      { name: 'Roorkee', pct: 19 },
      { name: 'Nanjangud', pct: 14 },
    ],
    vendors: [
      { name: 'Services', pct: 44 },
      { name: 'Maintenance', pct: 26 },
      { name: 'Logistics', pct: 18 },
      { name: 'Other', pct: 12 },
    ],
    actions: [
      'Enforce the delegation-of-authority calendar',
      'Reminder at 24h, escalation at 72h',
      'Reduce approval tiers below ₹10 lakh',
    ],
  },
  {
    processKey: 'p2p',
    key: 'vendor-master',
    name: 'Vendor master',
    sharePct: 11,
    valueAtRisk: 2.0,
    avgDelayDays: 9.7,
    recurrence: 4,
    concentration: '7 vendors',
    agentResolvablePct: 50, // §15.4 — JGL mix
    recordsCreatedQuarter: 23, // §7.13 — backs "23 vendor records created in the last quarter"
    narrative:
      'Bank and GST details fail validation on 23 vendor records created in the last quarter, mostly for one-time service vendors onboarded outside the standard workflow.',
    plants: [
      { name: 'Noida', pct: 39 },
      { name: 'Ambernath', pct: 28 },
      { name: 'Roorkee', pct: 21 },
      { name: 'Nanjangud', pct: 12 },
    ],
    vendors: [
      { name: 'Services', pct: 51 },
      { name: 'Consumables', pct: 24 },
      { name: 'Logistics', pct: 15 },
      { name: 'Other', pct: 10 },
    ],
    actions: [
      'Close the manual onboarding route',
      'Validate bank details at creation, not at payment',
      'Quarterly dormant-vendor purge',
    ],
  },
  {
    processKey: 'p2p',
    key: 'duplicate-suspicion',
    name: 'Duplicate suspicion',
    sharePct: 8,
    valueAtRisk: 1.5,
    avgDelayDays: 3.1,
    recurrence: 1,
    concentration: '9 invoice pairs', // §7.13 — was '—'; count stored in concentrationCount
    concentrationCount: 9,
    agentResolvablePct: 85, // §15.4 — JGL mix
    narrative:
      'Nine invoice pairs are flagged where the same document is submitted through both the vendor portal and email intake. All are held pending manual confirmation.',
    plants: [
      { name: 'Nanjangud', pct: 34 },
      { name: 'Roorkee', pct: 30 },
      { name: 'Noida', pct: 22 },
      { name: 'Ambernath', pct: 14 },
    ],
    vendors: [
      { name: 'Chemicals', pct: 40 },
      { name: 'Packaging', pct: 25 },
      { name: 'Services', pct: 20 },
      { name: 'Other', pct: 15 },
    ],
    actions: [
      'Single intake channel per vendor',
      'Fuzzy duplicate check at capture',
      'Auto-clear matched pairs after 5 days',
    ],
  },
  {
    processKey: 'p2p',
    key: 'tax-mismatch',
    name: 'Tax mismatch',
    sharePct: 7,
    valueAtRisk: 1.3,
    avgDelayDays: 4.4,
    recurrence: 2,
    concentration: '3 vendors',
    agentResolvablePct: 65, // §15.4 — JGL mix
    // §7.13 — backs "two states"; shares normalized from the plant split (Roorkee 46 + Noida 24), summing to the ₹1.3 cr value
    byGroup: [
      { name: 'Uttarakhand', pct: 66 },
      { name: 'Uttar Pradesh', pct: 34 },
    ],
    narrative:
      'GST place-of-supply is misapplied on interstate service invoices in two states, requiring credit notes before booking.',
    plants: [
      { name: 'Roorkee', pct: 46 },
      { name: 'Noida', pct: 24 },
      { name: 'Ambernath', pct: 18 },
      { name: 'Nanjangud', pct: 12 },
    ],
    vendors: [
      { name: 'Services', pct: 55 },
      { name: 'Logistics', pct: 23 },
      { name: 'Other', pct: 22 },
    ],
    actions: [
      'Place-of-supply rule in the capture template',
      'Vendor education pack for two states',
      'Pre-booking tax validation',
    ],
  },
  // spec/08 Part C — O2C taxonomy. `plants` carries customer segments, `vendors` cause drivers.
  {
    processKey: 'o2c',
    key: 'pricing-disputes',
    name: 'Pricing disputes',
    sharePct: 31,
    valueAtRisk: 5.4,
    avgDelayDays: 11.2,
    recurrence: 6,
    concentration: '9 customers',
    // §7.13 — the customer cut (9 @ 64%) is a different cut from the Distribution segment share (41% in plants)
    concentrationCount: 9,
    concentrationPctOfValue: 64,
    narrative:
      'Customers short-pay against contracted rates that were revised mid-quarter but not reflected on the invoice. Nine customers account for 64% of disputed value, 41% of it in Distribution; each dispute takes an average of 11.2 days to resolve because pricing evidence sits outside the billing system.',
    plants: [
      { name: 'Distribution', pct: 41 },
      { name: 'Institutional', pct: 28 },
      { name: 'Export', pct: 19 },
      { name: 'Retail', pct: 12 },
    ],
    vendors: [
      { name: 'Rate revision lag', pct: 44 },
      { name: 'Contract not loaded', pct: 26 },
      { name: 'Scheme mismatch', pct: 18 },
      { name: 'Other', pct: 12 },
    ],
    actions: [
      'Load contract revisions to billing before the effective date',
      'Attach pricing evidence to the invoice at issue',
      'Escalate disputes above ₹10 lakh to the commercial owner in 48 hours',
    ],
  },
  {
    processKey: 'o2c',
    key: 'deductions',
    name: 'Deductions & short-pay',
    sharePct: 24,
    valueAtRisk: 4.1,
    avgDelayDays: 9.6,
    recurrence: 5,
    concentration: '14 customers',
    acceptanceRatePct: 71, // §7.13 — backs "71% of deductions are eventually accepted"
    narrative:
      'Customers deduct scheme, damage and freight claims at payment without reference to an approved credit note. 71% of deductions are eventually accepted, meaning the dispute cycle adds cost without changing the outcome.',
    plants: [
      { name: 'Retail', pct: 38 },
      { name: 'Distribution', pct: 31 },
      { name: 'Institutional', pct: 20 },
      { name: 'Export', pct: 11 },
    ],
    vendors: [
      { name: 'Scheme claims', pct: 42 },
      { name: 'Damage claims', pct: 27 },
      { name: 'Freight', pct: 19 },
      { name: 'Other', pct: 12 },
    ],
    actions: [
      'Pre-approve recurring scheme deductions',
      'Auto-clear deductions below the write-off threshold',
      'Monthly claim reconciliation with the top 14 customers',
    ],
  },
  {
    processKey: 'o2c',
    key: 'billing-errors',
    name: 'Billing errors',
    sharePct: 17,
    valueAtRisk: 2.9,
    avgDelayDays: 6.8,
    recurrence: 3,
    concentration: '4 order types',
    narrative:
      'Invoices are rejected on receipt for missing purchase order references, incorrect GST registration or wrong ship-to detail. Four order types created outside the standard flow generate most of the rework.',
    plants: [
      { name: 'Institutional', pct: 44 },
      { name: 'Export', pct: 24 },
      { name: 'Distribution', pct: 20 },
      { name: 'Retail', pct: 12 },
    ],
    vendors: [
      { name: 'Missing PO reference', pct: 39 },
      { name: 'Tax detail', pct: 28 },
      { name: 'Ship-to detail', pct: 21 },
      { name: 'Other', pct: 12 },
    ],
    actions: [
      'Mandatory PO reference at order entry for institutional customers',
      'Validate customer tax registration at master creation',
      'Close the manual order-entry route',
    ],
  },
  {
    processKey: 'o2c',
    key: 'credit-block',
    name: 'Credit block delays',
    sharePct: 12,
    valueAtRisk: 2.1,
    avgDelayDays: 4.4,
    recurrence: 2,
    concentration: '18 orders',
    narrative:
      'Orders sit on credit block awaiting manual review because exposure limits were last reviewed a year ago. Eighteen orders are currently held, most for customers with a clean payment record.',
    plants: [
      { name: 'Distribution', pct: 46 },
      { name: 'Retail', pct: 25 },
      { name: 'Institutional', pct: 18 },
      { name: 'Export', pct: 11 },
    ],
    vendors: [
      { name: 'Stale credit limit', pct: 51 },
      { name: 'Awaiting approval', pct: 29 },
      { name: 'Security expired', pct: 20 },
    ],
    actions: [
      'Annual credit limit refresh, risk-scored',
      'Auto-release for customers with a 12-month clean record',
      'Same-day review SLA for held orders',
    ],
  },
  {
    processKey: 'o2c',
    key: 'cash-application',
    name: 'Cash application mismatch',
    sharePct: 9,
    valueAtRisk: 3.1,
    avgDelayDays: 5.1,
    recurrence: 4,
    concentration: '19 receipts',
    narrative:
      'Receipts arrive without remittance advice or covering multiple invoices, leaving ₹3.1 cr unapplied. Nineteen receipts are currently open, the oldest for 22 days.',
    plants: [
      { name: 'Distribution', pct: 37 },
      { name: 'Retail', pct: 29 },
      { name: 'Institutional', pct: 22 },
      { name: 'Export', pct: 12 },
    ],
    vendors: [
      { name: 'No remittance advice', pct: 48 },
      { name: 'Part payment', pct: 27 },
      { name: 'Multi-invoice receipt', pct: 25 },
    ],
    actions: [
      'Request structured remittance advice from the top 20 payers',
      'Tolerance-based auto-matching for part payments',
      'Daily unapplied cash review with a named owner',
    ],
  },
  {
    processKey: 'o2c',
    key: 'customer-master',
    name: 'Customer master',
    sharePct: 7,
    valueAtRisk: 1.2,
    avgDelayDays: 3.9,
    recurrence: 3,
    concentration: '16 records',
    narrative:
      'Sixteen customer records carry incomplete tax registration or credit terms, blocking clean billing and distorting the ageing view.',
    plants: [
      { name: 'Retail', pct: 41 },
      { name: 'Distribution', pct: 27 },
      { name: 'Institutional', pct: 19 },
      { name: 'Export', pct: 13 },
    ],
    vendors: [
      { name: 'Tax registration', pct: 45 },
      { name: 'Credit terms', pct: 33 },
      { name: 'Ship-to hierarchy', pct: 22 },
    ],
    actions: [
      'Complete-record enforcement at customer creation',
      'Quarterly master data review with commercial',
      'Block billing on incomplete records',
    ],
  },
];
