import type { CauseNode } from '../types';

// spec/03 — P2P root-cause taxonomy (6, fixed). AI classifies within this set and never invents a cause.
export const causes: CauseNode[] = [
  {
    processKey: 'p2p',
    key: 'missing-gr',
    name: 'Missing GR',
    sharePct: 34,
    valueAtRisk: 6.3,
    avgDelayDays: 8.4,
    recurrence: '5th month',
    concentration: '11 vendors',
    narrative:
      'Invoices for Nanjangud and Roorkee remain blocked because goods receipts are posted after invoice receipt. 62% of affected invoices relate to 11 vendors on consignment terms; average GR lag is 8.4 days and the pattern has repeated for five consecutive months.',
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
    recurrence: '3rd month',
    concentration: '4 contracts',
    narrative:
      'Price differences arise where contract escalations were signed but not loaded into the purchasing info record. Four contracts account for 71% of the variance value; buyers resolve them manually each cycle.',
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
    valueAtRisk: 3.2,
    avgDelayDays: 5.3,
    recurrence: '2nd month',
    concentration: '7 approvers',
    narrative:
      'Approvals stall with seven approvers who hold 64% of pending items, concentrated in indirect spend above ₹10 lakh. Delegation is not maintained during travel.',
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
    valueAtRisk: 1.8,
    avgDelayDays: 4.2,
    recurrence: '4th month',
    concentration: '23 records',
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
    valueAtRisk: 0.9,
    avgDelayDays: 3.6,
    recurrence: '1st month',
    concentration: '9 pairs',
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
    valueAtRisk: 0.7,
    avgDelayDays: 4.9,
    recurrence: '2nd month',
    concentration: '2 states',
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
];
