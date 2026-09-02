import { entities } from './entities';
import { ANCHOR, addDays, endOfMonth, fmtDate, isoDate } from './exceptions';

import type {
  AgeingBucket,
  Attribution,
  CashOpportunity,
  CloseProgress,
  Forecast,
  O2cKpis,
  O2cServiceControl,
  PayableReason,
  RecurringCause,
  ServiceControl,
  ServiceMetric,
  TransformationHealth,
} from '../types';

// spec/03 — Other datasets. All values are reference data for the bid demo.

// §7.31 — per-entity ageing profiles (the JGL-only arrays rendered on every entity were a defect). Blocked-invoice
// buckets are shares of the entity's blocked AP, allocated with largest-remainder in decicr so each profile sums
// exactly to apBlocked.current; the array length encodes how far the pool oldest reaches (§7.13) — JCP/JHS stop at
// 31-60 d, JPS at 61-90 d, and JGL/JBL/JRP run into > 90 d. Receivables buckets tie to §7.25: the last two sum to
// arOver90.current and all five to total open AR (the O2C Collection stage value).

const BLOCKED_BUCKET_LABELS = ['0-15 d', '16-30 d', '31-60 d', '61-90 d', '> 90 d'];
const RECEIVABLES_BUCKET_LABELS = ['0-30 d', '31-60 d', '61-90 d', '91-180 d', '> 180 d'];

// §7.31 — blocked-invoice bucket shares per entity (sum to 100; length = buckets the profile reaches).
const BLOCKED_AGEING_SHARES: Record<string, number[]> = {
  JCP: [52, 33, 15],
  JHS: [44, 30, 26],
  JPS: [36, 26, 24, 14],
  JGL: [31.7, 22.6, 22.0, 14.0, 9.7], // reproduces the pinned ₹5.9 / 4.2 / 4.1 / 2.6 / 1.8 cr exactly
  JBL: [26, 22, 23, 17, 12],
  JRP: [20, 19, 22, 20, 19], // nearly flat — the oldest bucket is no bigger than any other
};

// Largest-remainder allocation of totalCr across sharesPct in decicr (0.1 cr) units; ties go to the earlier bucket.
function allocateAgeing(totalCr: number, sharesPct: number[]): AgeingBucket[] {
  const totalDeci = Math.round(totalCr * 10);
  const raw = sharesPct.map((p) => (totalDeci * p) / 100);
  const rows = raw.map(Math.floor);
  let remainder = totalDeci - rows.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order.slice(0, remainder)) rows[i] += 1;
  return sharesPct.map((_, i) => ({ label: BLOCKED_BUCKET_LABELS[i], value: rows[i] / 10 }));
}

export const blockedInvoiceAgeingByEntity: Record<string, AgeingBucket[]> = Object.fromEntries(
  entities.map((e) => [e.code, allocateAgeing(e.metrics.apBlocked.current, BLOCKED_AGEING_SHARES[e.code])])
);

// §7.31 — receivables buckets per entity (₹ cr). Subtotals are pinned: b1–b3 / b4+b5 (= arOver90) / all five (= total open AR).
const RECEIVABLES_AGEING_CR: Record<string, number[]> = {
  JGL: [24.1, 11.6, 8.2, 7.4, 5.0], // pinned — the existing profile
  JBL: [17.6, 8.4, 5.5, 5.0, 3.9],
  JPS: [10.2, 4.6, 3.3, 2.9, 2.2],
  JCP: [3.9, 1.7, 1.1, 1.1, 0.8],
  JHS: [7.6, 3.4, 2.5, 2.2, 1.6],
  JRP: [15.8, 11.7, 10.0, 5.9, 4.7], // flatter — matches its weaker collections profile
};

export const receivablesAgeingByEntity: Record<string, AgeingBucket[]> = Object.fromEntries(
  entities.map((e) => [e.code, RECEIVABLES_AGEING_CR[e.code].map((value, i) => ({ label: RECEIVABLES_BUCKET_LABELS[i], value }))])
);

// Ties to §7.5 root-cause values (sum ₹18.6 cr = JGL blocked AP).
export const payablesByReason: PayableReason[] = [
  { name: 'Missing GR', value: 6.4 },
  { name: 'PO price mismatch', value: 4.1 },
  { name: 'Approval pending', value: 3.3 },
  { name: 'Vendor master', value: 2.0 },
  { name: 'Duplicate / tax', value: 2.8 },
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
  { name: 'Approval pending', processKey: 'p2p', sharePct: 14 }, // §6.1 — one cause, one name (matches causes.ts)
];

export const serviceControl: ServiceControl = {
  slaInvoiceBookingPct: 93.1,
  duplicatePaymentRiskCr: 0.9,
  manualPaymentRuns: 4,
};

// spec/08 Part B — O2C cockpit header KPIs and service & control rows.
export const o2cKpis: O2cKpis = {
  dsoDays: 62,
  overdueArCr: 20.6,
  unappliedCr: 3.1,
};

export const o2cServiceControl: O2cServiceControl = {
  billingAccuracyPct: 96.4,
  openDisputes: 34,
  ordersOnCreditBlock: 18,
  unappliedReceipts: 19,
};

// spec/03 — Group aggregates shown on the group view. Score / value at risk / open
// exceptions are computed in src/api/score.ts, never stored here (§7.2).
export const closeProgress: CloseProgress = { pct: 71, totalTasks: 214, overdue: 19, blockers: 6, entitiesAtRisk: 3 };

// §7.5 — group cause-elimination backlog; per-entity rows in entities.ts must sum to these figures (§7.18).
export const transformationHealth: TransformationHealth = { automationRatePct: 68, repeatExceptionsQoqPct: -14, causeElimination: { identified: 34, eliminated: 11, inProgress: 6 }, touchlessInvoicesPct: 54 };

// §7.7 — JGL service metrics. 'measuring' rows (the Finance Service Desk's three SLAs, §7.29) and 'needs-register'
// rows carry no achieved or breach values by design (§8.6 honesty).
export const serviceMetrics: ServiceMetric[] = [
  { sla: 'Invoice processing TAT', process: 'p2p', target: '3 business days', achieved: 93.1, breaches: 22, attributionSplit: { client: 18, provider: 3, system: 1, thirdParty: 0 }, measurability: 'day-one' },
  { sla: 'Urgent invoice TAT', process: 'p2p', target: '1 business day', achieved: 96.4, breaches: 4, attributionSplit: { client: 3, provider: 1, system: 0, thirdParty: 0 }, measurability: 'day-one' },
  { sla: 'Payment processing', process: 'p2p', target: '2 business days', achieved: 98.2, breaches: 3, attributionSplit: { client: 1, provider: 1, system: 0, thirdParty: 1 }, measurability: 'day-one' },
  { sla: 'Sub-ledger close TAT', process: 'r2r', target: 'Day 2', achieved: 91.0, breaches: 2, attributionSplit: { client: 1, provider: 1, system: 0, thirdParty: 0 }, measurability: 'day-one' },
  { sla: 'Bank reconciliation TAT', process: 'r2r', target: 'Day 3', achieved: 97.5, breaches: 1, attributionSplit: { client: 0, provider: 0, system: 1, thirdParty: 0 }, measurability: 'day-one' },
  { sla: 'Vendor master creation', process: 'p2p', target: '2 business days', measurability: 'measuring' },
  { sla: 'Query resolution', target: '5 business days', measurability: 'measuring' },
  { sla: 'Dispute resolution', process: 'o2c', target: '10 business days', measurability: 'measuring' },
  { sla: 'Invoice processing accuracy', process: 'p2p', target: '99.5%', measurability: 'needs-register' },
  { sla: 'Audit findings', target: 'Zero high severity', measurability: 'needs-register' },
];

// §7.22 — per-entity service metrics. JGL's five day-one rows are the pinned §7.7 values and never move;
// the other entities are generated deterministically so that, for every entity:
//   (a) per-SLA breach counts sum to its slaBreachCounts total,
//   (b) per-SLA attribution sums to its stored attribution counts,
//   (c) the mean of the five gross achievements equals its §7.22 service-dimension value,
//   (d) measuring / needs-register rows carry no achieved or breach values — the desk supplies a clock start but not yet a full period, and the register is manual.

// Gross achievement mean per entity; tracks the service dimension in entities.ts (§7.22).
const SERVICE_GROSS_MEAN: Record<string, number> = { JCP: 98.8, JHS: 97.6, JPS: 96.8, JGL: 95.2, JBL: 94.0, JRP: 92.4 };

// Breach-row shape follows JGL's pinned distribution (its 32 breaches across the five day-one SLAs).
const BREACH_ROW_WEIGHTS = [22 / 32, 4 / 32, 3 / 32, 2 / 32, 1 / 32];

// Zero-sum offsets spread each entity's gross mean across the five rows; sub-ledger close stays
// the weakest row, mirroring JGL's story. Sum is exactly 0 so constraint (c) holds by construction.
const ACHIEVED_OFFSETS = [0.6, -0.2, 0.5, -1.4, 0.5];

// Largest-remainder allocation of the entity's breach total across the five rows; ties go to the earlier row.
function allocateBreaches(total: number): number[] {
  const raw = BREACH_ROW_WEIGHTS.map((w) => w * total);
  const rows = raw.map(Math.floor);
  let remainder = total - rows.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order.slice(0, remainder)) rows[i] += 1;
  return rows;
}

// Greedy margin-fill: walk rows in order and categories client → provider → system → third party,
// taking min(row remaining, category remaining). Exact because both sides sum to the entity total.
function allocateAttribution(breachRows: number[], counts: Record<Attribution, number>): Array<Record<Attribution, number>> {
  const cols = { ...counts };
  return breachRows.map((rowTotal) => {
    const split: Record<Attribution, number> = { client: 0, provider: 0, system: 0, thirdParty: 0 };
    let remaining = rowTotal;
    for (const k of ['client', 'provider', 'system', 'thirdParty'] as Attribution[]) {
      const take = Math.min(remaining, cols[k]);
      split[k] = take;
      cols[k] -= take;
      remaining -= take;
    }
    return split;
  });
}

export const serviceMetricsByEntity: Record<string, ServiceMetric[]> = Object.fromEntries(
  entities.map((e) => {
    if (e.code === 'JGL') return [e.code, serviceMetrics]; // pinned §7.7 rows — never regenerated
    const m = e.metrics.slaBreachCounts;
    const breachRows = allocateBreaches(m.client + m.provider + m.system + m.thirdParty);
    const splits = allocateAttribution(breachRows, m);
    const base = SERVICE_GROSS_MEAN[e.code];
    return [
      e.code,
      serviceMetrics.map((row, i) => {
        if (row.measurability !== 'day-one') return row; // constraint (d): no achieved / breach values on any entity
        const achieved = Math.round((base + ACHIEVED_OFFSETS[i]) * 10) / 10;
        return { ...row, achieved, breaches: breachRows[i], attributionSplit: splits[i] };
      }),
    ];
  })
);

// §7.23 — DSO forecasts for all six entities. Base-case settlement dates derive as month-end + N days (§7.21): every
// driver is still open at month-end in the base case, so each pinned headline holds whenever the prototype opens. The
// spec pins no settlement dates — the N values are a judgment call; they only need to sit after month-end, and their
// spread (largest dispute longest) keeps the table readable. Driver names come from the §7.23 customer pools,
// geography-matched, so Step 11's customer pages can drill to them. JGL's drivers and actions are the pinned §7.3
// values; the other five are generated against the §7.23 constraints (impacts sum exactly to the deterioration; driver
// values ≈ 1.5× AR-over-90 + cash-unapplied; actions ranked by days recovered per unit of effort, not by size).
function baseSettle(n: number): { baseSettleOn: string; baseSettleIso: string } {
  const d = addDays(endOfMonth(ANCHOR), n);
  return { baseSettleOn: fmtDate(d), baseSettleIso: isoDate(d) };
}

export const forecasts: Forecast[] = [
  {
    metric: 'dso',
    entityCode: 'JRP',
    current: 74,
    projected: 86,
    unit: 'days',
    drivers: [
      { id: 'jrp-mont-royal', label: 'Mont-Royal Imaging — pricing dispute', valueCr: 9.8, impact: 5.6, assumptionEditable: true, ...baseSettle(10) },
      { id: 'jrp-great-lakes', label: 'Great Lakes Nuclear Medicine — deduction unresolved', valueCr: 7.0, impact: 3.4, assumptionEditable: true, ...baseSettle(6) },
      { id: 'jrp-saint-denis', label: 'Saint-Denis Health Network — credit block', valueCr: 4.1, impact: 2.6, assumptionEditable: true, ...baseSettle(4) },
      { id: 'jrp-cash', label: 'Cash awaiting application', valueCr: 1.3, impact: 0.4, assumptionEditable: true, ...baseSettle(2) },
    ],
    actions: [
      { rank: 1, action: 'Settle deduction with Great Lakes Nuclear Medicine', owner: 'Collections', effort: 'Low', improvement: 3.4, unit: 'days' },
      { rank: 2, action: 'Release credit block on Saint-Denis Health Network', owner: 'Entity controller', effort: 'Medium', improvement: 2.6, unit: 'days' },
      { rank: 3, action: 'Escalate Mont-Royal Imaging to commercial', owner: 'Business partner', effort: 'High', improvement: 5.0, unit: 'days' },
      { rank: 4, action: 'Apply matched receipts to open AR', owner: 'Cash application', effort: 'Low', improvement: 0.4, unit: 'days' },
    ],
  },
  {
    metric: 'dso',
    entityCode: 'JBL',
    current: 68,
    projected: 79,
    unit: 'days',
    drivers: [
      { id: 'jbl-nirmal', label: 'Nirmal Wholesale — pricing dispute', valueCr: 7.6, impact: 4.8, assumptionEditable: true, ...baseSettle(8) },
      { id: 'jbl-vindhya', label: 'Vindhya Medical Supplies — deduction unresolved', valueCr: 5.2, impact: 3.9, assumptionEditable: true, ...baseSettle(5) },
      { id: 'jbl-cash', label: 'Cash awaiting application', valueCr: 4.4, impact: 2.3, assumptionEditable: true, ...baseSettle(2) },
    ],
    actions: [
      { rank: 1, action: 'Apply matched receipts to open AR', owner: 'Cash application', effort: 'Low', improvement: 2.3, unit: 'days' },
      { rank: 2, action: 'Settle pricing dispute with Nirmal Wholesale', owner: 'Collections', effort: 'Medium', improvement: 4.4, unit: 'days' },
      { rank: 3, action: 'Escalate Vindhya Medical Supplies deduction to commercial', owner: 'Business partner', effort: 'High', improvement: 3.9, unit: 'days' },
    ],
  },
  {
    metric: 'dso',
    entityCode: 'JGL',
    current: 62,
    projected: 72,
    unit: 'days',
    drivers: [
      { id: 'jgl-amrit', label: 'Amrit Distributors — pricing dispute', valueCr: 9.4, impact: 4.1, assumptionEditable: true, ...baseSettle(9) },
      { id: 'jgl-sanjeevani', label: 'Sanjeevani Healthcare — deduction unresolved', valueCr: 6.2, impact: 2.7, assumptionEditable: true, ...baseSettle(5) },
      { id: 'jgl-deccan', label: 'Deccan Pharma Retail — credit block', valueCr: 4.8, impact: 2.1, assumptionEditable: true, ...baseSettle(3) },
      { id: 'jgl-cash', label: 'Cash awaiting application', valueCr: 3.1, impact: 1.1, assumptionEditable: true, ...baseSettle(2) },
    ],
    actions: [
      { rank: 1, action: 'Settle two disputes under ₹10 lakh', owner: 'Collections', effort: 'Low', improvement: 6.0, unit: 'days' },
      { rank: 2, action: 'Apply matched receipts to open AR', owner: 'Cash application', effort: 'Low', improvement: 1.1, unit: 'days' },
      { rank: 3, action: 'Release credit block on Deccan Pharma Retail', owner: 'Entity controller', effort: 'Medium', improvement: 2.1, unit: 'days' },
      { rank: 4, action: 'Escalate Amrit Distributors to commercial', owner: 'Business partner', effort: 'High', improvement: 4.1, unit: 'days' },
    ],
  },
  {
    metric: 'dso',
    entityCode: 'JPS',
    current: 54,
    projected: 59,
    unit: 'days',
    drivers: [
      { id: 'jps-straits', label: 'Straits Healthcare Group — deduction unresolved', valueCr: 4.4, impact: 2.4, assumptionEditable: true, ...baseSettle(7) },
      { id: 'jps-pasir', label: 'Pasir Distribution — credit block', valueCr: 3.6, impact: 1.9, assumptionEditable: true, ...baseSettle(4) },
      { id: 'jps-cash', label: 'Cash awaiting application', valueCr: 1.6, impact: 0.7, assumptionEditable: true, ...baseSettle(2) },
    ],
    actions: [
      { rank: 1, action: 'Release credit block on Pasir Distribution', owner: 'Entity controller', effort: 'Medium', improvement: 1.9, unit: 'days' },
      { rank: 2, action: 'Apply matched receipts to open AR', owner: 'Cash application', effort: 'Low', improvement: 0.7, unit: 'days' },
      { rank: 3, action: 'Escalate Straits Healthcare Group deduction to commercial', owner: 'Business partner', effort: 'High', improvement: 2.4, unit: 'days' },
    ],
  },
  {
    metric: 'dso',
    entityCode: 'JHS',
    current: 51,
    projected: 55,
    unit: 'days',
    drivers: [
      { id: 'jhs-ridgeline', label: 'Ridgeline Health Partners — deduction unresolved', valueCr: 3.4, impact: 2.4, assumptionEditable: true, ...baseSettle(6) },
      { id: 'jhs-cornerstone', label: 'Cornerstone Wholesale — credit block', valueCr: 1.9, impact: 0.9, assumptionEditable: true, ...baseSettle(3) },
      { id: 'jhs-cash', label: 'Cash awaiting application', valueCr: 1.4, impact: 0.7, assumptionEditable: true, ...baseSettle(2) },
    ],
    actions: [
      { rank: 1, action: 'Apply matched receipts to open AR', owner: 'Cash application', effort: 'Low', improvement: 0.7, unit: 'days' },
      { rank: 2, action: 'Escalate Ridgeline Health Partners deduction to commercial', owner: 'Business partner', effort: 'High', improvement: 2.4, unit: 'days' },
      { rank: 3, action: 'Release credit block on Cornerstone Wholesale', owner: 'Entity controller', effort: 'Medium', improvement: 0.9, unit: 'days' },
    ],
  },
  {
    metric: 'dso',
    entityCode: 'JCP',
    current: 47,
    projected: 50,
    unit: 'days',
    drivers: [
      { id: 'jcp-beacon', label: 'Beacon Pharmacy Services — deduction unresolved', valueCr: 1.7, impact: 1.4, assumptionEditable: true, ...baseSettle(5) },
      { id: 'jcp-lakeshore', label: 'Lakeshore Distributors — credit block', valueCr: 0.9, impact: 1.0, assumptionEditable: true, ...baseSettle(3) },
      { id: 'jcp-cash', label: 'Cash awaiting application', valueCr: 0.7, impact: 0.6, assumptionEditable: true, ...baseSettle(1) },
    ],
    actions: [
      { rank: 1, action: 'Apply matched receipts to open AR', owner: 'Cash application', effort: 'Low', improvement: 0.6, unit: 'days' },
      { rank: 2, action: 'Release credit block on Lakeshore Distributors', owner: 'Entity controller', effort: 'Medium', improvement: 1.0, unit: 'days' },
      { rank: 3, action: 'Escalate Beacon Pharmacy Services deduction to commercial', owner: 'Business partner', effort: 'High', improvement: 1.4, unit: 'days' },
    ],
  },
];
