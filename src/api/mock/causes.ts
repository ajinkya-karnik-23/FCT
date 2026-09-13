import type { CauseNode } from '../types';

// spec/03 — P2P root-cause taxonomy (6, fixed); spec/08 Part C — O2C taxonomy (6).
// §6.1 — R2R taxonomy (8), wired in Step 24 with the third process cockpit. For O2C nodes `plants` carries
// customer segments and `vendors` cause drivers; for R2R nodes `plants` carries the plant split and `vendors`
// the close-process drivers. AI classifies within this set and never invents a cause.
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
  // §6.1 — R2R taxonomy (8). JGL-anchored like the other taxonomies; rupee figures tie to §7.2 / §8.2 where the
  // spec pins them (recon exposure, intercompany exposure), the rest are dataset values for this prototype.
  {
    processKey: 'r2r',
    key: 'reconciliation',
    name: 'Reconciliation breaks',
    sharePct: 24,
    valueAtRisk: 14.3, // §7.2 — JGL recon exposure; the REC stage pins the same figure per entity
    avgDelayDays: 28,
    recurrence: 6,
    concentration: '18 aged breaks',
    concentrationCount: 18, // §7.2 — JGL reconAgedBreaks
    narrative:
      'Eighteen reconciliation breaks are aged at close, the oldest at 61 days; bank and intercompany lines hold most of the ₹14.3 cr, and the same accounts have broken in six consecutive closes.',
    plants: [
      { name: 'Nanjangud', pct: 41 },
      { name: 'Roorkee', pct: 27 },
      { name: 'Noida', pct: 19 },
      { name: 'Ambernath', pct: 13 },
    ],
    vendors: [
      { name: 'Bank breaks', pct: 46 },
      { name: 'Intercompany', pct: 28 },
      { name: 'Suspense', pct: 15 },
      { name: 'Other', pct: 11 },
    ],
    actions: [
      'Daily break review against the reconciliation platform feed',
      'Auto-clear matched bank lines within tolerance',
      'Escalate intercompany breaks to both entity controllers',
    ],
  },
  {
    processKey: 'r2r',
    key: 'interface',
    name: 'Interface breaks', // one cause, one name — matches the group view's recurring-cause row (§6.1)
    sharePct: 18,
    valueAtRisk: 4.4,
    avgDelayDays: 5.5,
    recurrence: 6,
    concentration: '12 failed IDocs',
    concentrationCount: 12, // §7.27 — JGL interface check, last 7 days
    narrative:
      'Twelve IDocs failed in the last seven days and the sub-ledger feed is running late (last success 31 Aug, 09:20); missing transactions surface as unexplained trial-balance movement at close.',
    plants: [
      { name: 'Nanjangud', pct: 37 },
      { name: 'Roorkee', pct: 28 },
      { name: 'Noida', pct: 20 },
      { name: 'Ambernath', pct: 15 },
    ],
    vendors: [
      { name: 'Failed IDocs', pct: 47 },
      { name: 'Late file drops', pct: 31 },
      { name: 'Stale runs', pct: 22 },
    ],
    actions: [
      'Retry queue with a named owner for failed IDocs',
      'Alert when a feed lands after the day-one cut-off',
      'Reconcile interface counts to sub-ledger totals daily',
    ],
  },
  {
    processKey: 'r2r',
    key: 'journal',
    name: 'Journal risk',
    sharePct: 14,
    valueAtRisk: 4.8,
    avgDelayDays: 6.5,
    recurrence: 4,
    concentration: '12 high-risk journals',
    concentrationCount: 12, // §7.2 — JGL highRiskJEs; the population of 847 is pinned in stages.ts (§16.5)
    narrative:
      'Twelve of the 847 adjusting journals posted this period carry a risk flag — top-side entries and round numbers lead; each waits on manual review before close.',
    plants: [
      { name: 'Nanjangud', pct: 38 },
      { name: 'Roorkee', pct: 29 },
      { name: 'Noida', pct: 18 },
      { name: 'Ambernath', pct: 15 },
    ],
    vendors: [
      { name: 'Top-side entries', pct: 37 },
      { name: 'Round numbers', pct: 26 },
      { name: 'Backdated', pct: 21 },
      { name: 'Other flags', pct: 16 },
    ],
    actions: [
      'Score every journal against the seven risk flags at posting',
      'Route top-side entries above materiality to same-day review',
      'Block preparer-equals-approver journals in SAP',
    ],
  },
  {
    processKey: 'r2r',
    key: 'close-dependency',
    name: 'Close dependencies',
    sharePct: 13,
    valueAtRisk: 5.2,
    avgDelayDays: 4.8,
    recurrence: 5,
    concentration: '7 open blockers',
    concentrationCount: 7, // §7.2 — JGL closeBlockers
    narrative:
      'Seven tasks sit on the critical path waiting on upstream work — sub-ledger feeds and intercompany matching lead; each blocked task names what is blocking it and who owns that.',
    plants: [
      { name: 'Nanjangud', pct: 39 },
      { name: 'Roorkee', pct: 26 },
      { name: 'Noida', pct: 19 },
      { name: 'Ambernath', pct: 16 },
    ],
    vendors: [
      { name: 'Sub-ledger feeds', pct: 42 },
      { name: 'Intercompany matching', pct: 27 },
      { name: 'Client data', pct: 19 },
      { name: 'Other', pct: 12 },
    ],
    actions: [
      'Show the blocking task and its owner on every blocked item',
      'Escalate critical-path tasks on a timer to the escalation contact',
      'Freeze non-critical changes after day 3',
    ],
  },
  {
    processKey: 'r2r',
    key: 'source-data',
    name: 'Source data',
    sharePct: 10,
    valueAtRisk: 3.9,
    avgDelayDays: 7.2,
    recurrence: 5,
    concentration: 'sub-ledger and manual feeds',
    narrative:
      'Sub-ledger figures reach the general ledger late or by manual entry; unmapped accounts force rework on day one and push close tasks past their due dates.',
    plants: [
      { name: 'Nanjangud', pct: 40 },
      { name: 'Roorkee', pct: 27 },
      { name: 'Noida', pct: 18 },
      { name: 'Ambernath', pct: 15 },
    ],
    vendors: [
      { name: 'Late sub-ledger feeds', pct: 46 },
      { name: 'Manual journal entries', pct: 30 },
      { name: 'Unmapped accounts', pct: 24 },
    ],
    actions: [
      'Cut off sub-ledger feeds at a fixed time each day',
      'Route manual entries through a single validated template',
      'Map new cost centres before period end',
    ],
  },
  {
    processKey: 'r2r',
    key: 'intercompany',
    name: 'Intercompany',
    sharePct: 9,
    valueAtRisk: 3.6, // §8.2 — JGL unmatched intercompany with related parties; the ICO stage pins it per entity
    avgDelayDays: 12,
    recurrence: 6,
    concentration: 'Ingrevia and two group entities',
    narrative:
      '₹3.6 cr of intercompany balances are unmatched at close; the Ingrevia netting — a related party, not a group entity — is the largest single piece, with group-entity timing differences behind it.',
    plants: [
      { name: 'Nanjangud', pct: 35 },
      { name: 'Roorkee', pct: 26 },
      { name: 'Noida', pct: 21 },
      { name: 'Ambernath', pct: 18 },
    ],
    vendors: [
      { name: 'Netting not posted', pct: 48 },
      { name: 'Timing differences', pct: 30 },
      { name: 'FX translation', pct: 22 },
    ],
    actions: [
      'Post the agreed netting entry before sign-off',
      'Match group-entity balances on a fixed day-3 cut-off',
      'Age unmatched lines and report them by counterparty',
    ],
  },
  {
    processKey: 'r2r',
    key: 'judgement',
    name: 'Judgement',
    sharePct: 7,
    valueAtRisk: 3.8,
    avgDelayDays: 8,
    recurrence: 4,
    concentration: 'provisions and cut-off entries',
    narrative:
      '₹3.8 cr of accruals and provisions at close lack supporting evidence or failed to reverse automatically; provision adequacy runs against actual utilisation, and cut-off entries span the period end.',
    plants: [
      { name: 'Nanjangud', pct: 42 },
      { name: 'Roorkee', pct: 26 },
      { name: 'Noida', pct: 18 },
      { name: 'Ambernath', pct: 14 },
    ],
    vendors: [
      { name: 'Provision adequacy', pct: 41 },
      { name: 'Cut-off entries', pct: 33 },
      { name: 'Unreversed accruals', pct: 26 },
    ],
    actions: [
      'Tie every provision to utilisation evidence before sign-off',
      'Run an auto-reversal check on prior-period accruals',
      'Flag postings spanning period end for cut-off review',
    ],
  },
  {
    processKey: 'r2r',
    key: 'master-data',
    name: 'Master data',
    sharePct: 5,
    valueAtRisk: 1.7,
    avgDelayDays: 9,
    recurrence: 3,
    concentration: 'GL and cost-centre records',
    narrative:
      'Missing cost-centre defaults and unmapped GL accounts force manual coding at close; misposted lines surface as unexplained trial-balance movement.',
    plants: [
      { name: 'Nanjangud', pct: 36 },
      { name: 'Roorkee', pct: 27 },
      { name: 'Noida', pct: 19 },
      { name: 'Ambernath', pct: 18 },
    ],
    vendors: [
      { name: 'Cost-centre defaults', pct: 45 },
      { name: 'GL account mapping', pct: 31 },
      { name: 'Plant hierarchy', pct: 24 },
    ],
    actions: [
      'Enforce complete master data before period end',
      'Validate cost-centre defaults on every new record',
      'Review dormant GL accounts quarterly',
    ],
  },
];
