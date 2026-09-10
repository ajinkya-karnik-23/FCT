import type { Entity, Trend } from '../types';

// §7.14 — six-point series are seeded walks, deterministic across runs and machines
// (integer-only math; no Math.random). series[5] === current, series[4] === previous;
// every point stays within max(25% of current, the metric's floor) so a small movement
// on a small denominator never reads as a large swing. When previous > current the walk
// is capped at previous — a pinned one-month improvement must not sit inside a run of
// declines that would contradict a stated recurrence. elevatedLast floors the last N
// points at current where a cause's stated recurrence forbids a clean decline (JGL missing-gr).
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TrendOpts { decimals?: number; floor?: number; elevatedLast?: number }

function trend(entityCode: string, key: string, current: number, previous?: number, opts: TrendOpts = {}): Trend {
  const prev = previous ?? current;
  const u = 10 ** -(opts.decimals ?? 1); // rounding unit: 0.1 for ₹ cr, 1 for days / %
  const round = (n: number) => Math.round(n / u) * u;
  const bound = Math.max(0.25 * current, opts.floor ?? 0); // §7.14 — max(25% of current, absolute floor)
  const lo = Math.max(0, Math.ceil((current - bound) / u - 1e-9) * u);
  const hi = Math.floor((current + bound) / u + 1e-9) * u;
  const cap = prev > current ? Math.min(hi, prev) : hi; // a pinned drop ends any run of declines
  const rand = mulberry32(fnv1a(entityCode + key)); // seed = entityCode + metricKey (§7.14)
  const series = new Array(6).fill(0);
  series[5] = current;
  series[4] = prev;
  for (let i = 3; i >= 0; i--) {
    let p = series[i + 1] + round((rand() * 2 - 1) * 0.07 * current);
    const floor = opts.elevatedLast !== undefined && i >= 6 - opts.elevatedLast ? Math.max(lo, current) : lo;
    p = Math.min(cap, Math.max(floor, p));
    series[i] = round(p);
  }
  return { current, previous: prev, series };
}

// spec/03 — Entities (6). Canonical names per §2, dimensions per §7.1, metrics per §7.2–§7.3.
export const entities: Entity[] = [
  {
    code: 'JGL',
    name: 'Jubilant Generics Ltd',
    segment: 'Generics',
    geography: 'India',
    dimensions: { operational: 74, service: 78, risk: 62, workingCapital: 58, dataQuality: 90, compliance: 96 },
    dimensionsPrevious: { operational: 71, service: 74, risk: 58, workingCapital: 60, dataQuality: 89, compliance: 96 }, // §7.15 — prior score 72
    vetoes: [],
    metrics: {
      apBlocked: trend('JGL', 'apBlocked', 18.6, 22.1, { elevatedLast: 5, floor: 0.5 }), // missing-gr has recurred five months — the series stays elevated (§7.14)
      apBlockedCount: 327,
      apBlockedCountPrevious: 389, // §7.16
      o2cExceptionCount: 284,
      o2cExceptionCountPrevious: 301, // §7.16
      arOver90: trend('JGL', 'arOver90', 12.4, 11.2, { floor: 0.5 }),
      arOver90Customers: 41,
      cashUnapplied: trend('JGL', 'cashUnapplied', 3.1, 2.6, { floor: 0.5 }),
      cashUnappliedReceipts: 19,
      closePercent: trend('JGL', 'closePercent', 78, 74, { decimals: 0, floor: 5 }),
      closeBlockers: 7,
      reconValue: trend('JGL', 'reconValue', 14.3, 15.8, { floor: 0.5 }),
      reconAgedBreaks: 18,
      reconAgedBreaksPrevious: 21, // §7.16
      controlBreaches: 4,
      highRiskJEs: 12,
      apBlockedOldestDays: 118, // §7.13 — pool oldest (the sampled rows only need to stay ≤ it, §7.17); JCP lowest / JRP highest on all four
      arOver90OldestDays: 148,
      cashUnappliedOldestDays: 22,
      reconOldestDays: 61,
      slaBreachCounts: { client: 23, provider: 6, system: 2, thirdParty: 1 },
      touchlessRate: trend('JGL', 'touchlessRate', 54, 49, { decimals: 0, floor: 5 }),
      slaBreaches: trend('JGL', 'slaBreaches', 32, 38, { decimals: 0, floor: 5 }),
      dso: trend('JGL', 'dso', 62, 59, { decimals: 0, floor: 5 }),
      dpo: trend('JGL', 'dpo', 48, 45, { decimals: 0, floor: 5 }),
      dpoAdjusted: 41,
      releasableCash: 4.2, // §7.19 — resolvable-today release value (all six entities tabulated)
      releasableItems: 38, // §7.19 — "Releasable cash ₹4.2 cr, 38 items, low effort"
      queriesOverdue: 27, // §7.31 — overdue service queries; tracks the service dimension inversely
      accrualExposure: 6.4, // §8.2 — exactly the missing-GR cause value in §7.5; one number, one meaning
      revenueAtRisk: 8.7, // §8.2 — open disputes and credit blocks
      provisionAdequacyPct: 92, // §8.2 — provision vs actual utilisation
      fxIntercompanyExposure: 3.6, // §8.2 — unmatched intercompany with related parties
      accrualExposureNote: '34% of blocked AP — no goods receipt means no accrual', // §8.2 — ties to the §7.5 missing-GR share
      unpostedGr: { vendors: 11, recurrenceMonths: 5 }, // §7.18 — value is accrualExposure itself (§8.2), stored once
      causeElimination: { identified: 8, eliminated: 3, inProgress: 2 }, // §7.18 — notStarted derived (8 − 3 − 2 = 3)
      cashOpportunity: { value: 11.3, items: 88 }, // §7.18 — sum of the working-capital rows
    },
    sensitivity: [
      { action: 'Clear GR compliance on 11 consignment vendors', dimension: 'workingCapital', dimensionMovement: 35, effort: 'Low' },
      { action: 'Close 18 aged reconciliation breaks', dimension: 'risk', dimensionMovement: 15, effort: 'Medium' },
      { action: 'Apply matched receipts to open AR', dimension: 'workingCapital', dimensionMovement: 5, effort: 'Low' },
      { action: 'Resolve 12 high-risk manual journals', dimension: 'risk', dimensionMovement: 10, effort: 'Low' },
    ],
  },
  {
    code: 'JBL',
    name: 'Jubilant Biosys Ltd',
    segment: 'CRDMO',
    geography: 'India',
    dimensions: { operational: 66, service: 72, risk: 54, workingCapital: 54, dataQuality: 82, compliance: 88 },
    dimensionsPrevious: { operational: 69, service: 74, risk: 58, workingCapital: 55, dataQuality: 82, compliance: 88 }, // §7.15 — prior score 69
    vetoes: [],
    metrics: {
      apBlocked: trend('JBL', 'apBlocked', 11.3, 10.4, { floor: 0.5 }),
      apBlockedCount: 214,
      apBlockedCountPrevious: 197, // §7.16
      o2cExceptionCount: 196,
      o2cExceptionCountPrevious: 188, // §7.16
      arOver90: trend('JBL', 'arOver90', 8.9, 9.6, { floor: 0.5 }),
      arOver90Customers: 28,
      cashUnapplied: trend('JBL', 'cashUnapplied', 2.4, 2.9, { floor: 0.5 }),
      cashUnappliedReceipts: 14,
      closePercent: trend('JBL', 'closePercent', 61, 66, { decimals: 0, floor: 5 }),
      closeBlockers: 9,
      reconValue: trend('JBL', 'reconValue', 9.8, 8.9, { floor: 0.5 }),
      reconAgedBreaks: 21,
      reconAgedBreaksPrevious: 19, // §7.16
      controlBreaches: 6,
      highRiskJEs: 15,
      apBlockedOldestDays: 142,
      arOver90OldestDays: 172,
      cashUnappliedOldestDays: 31,
      reconOldestDays: 79,
      slaBreachCounts: { client: 29, provider: 7, system: 3, thirdParty: 2 },
      touchlessRate: trend('JBL', 'touchlessRate', 46, 44, { decimals: 0, floor: 5 }),
      slaBreaches: trend('JBL', 'slaBreaches', 41, 39, { decimals: 0, floor: 5 }),
      dso: trend('JBL', 'dso', 68, 71, { decimals: 0, floor: 5 }),
      dpo: trend('JBL', 'dpo', 52, 50, { decimals: 0, floor: 5 }),
      dpoAdjusted: 46,
      releasableCash: 2.6, // §7.19 — resolvable-today release value (all six entities tabulated)
      releasableItems: 25, // §7.19 — item count behind releasableCash
      queriesOverdue: 34, // §7.31 — overdue service queries; tracks the service dimension inversely
      accrualExposure: 4.1, // §8.2 — blocked payables with no goods receipt posted
      revenueAtRisk: 6.4, // §8.2 — open disputes and credit blocks
      provisionAdequacyPct: 88, // §8.2 — provision vs actual utilisation
      fxIntercompanyExposure: 2.4, // §8.2 — unmatched intercompany with related parties
      unpostedGr: { vendors: 8, recurrenceMonths: 4 }, // §7.18 — value is accrualExposure itself (§8.2), stored once
      causeElimination: { identified: 7, eliminated: 2, inProgress: 1 }, // §7.18 — notStarted derived (7 − 2 − 1 = 4)
      cashOpportunity: { value: 7.4, items: 61 }, // §7.18
    },
    sensitivity: [
      { action: 'Clear SoD conflict on vendor creation and payment release', dimension: 'risk', dimensionMovement: 25, effort: 'Medium' },
      { action: 'Reduce approval cycle at Ambernath', dimension: 'operational', dimensionMovement: 15, effort: 'Medium' },
      { action: 'Settle 9 open close blockers', dimension: 'operational', dimensionMovement: 10, effort: 'High' },
    ],
  },
  {
    code: 'JPS',
    name: 'Jubilant Pharma Ltd',
    segment: 'Holding',
    geography: 'Singapore',
    dimensions: { operational: 82, service: 84, risk: 75, workingCapital: 73, dataQuality: 88, compliance: 90 },
    dimensionsPrevious: { operational: 80, service: 82, risk: 73, workingCapital: 74, dataQuality: 87, compliance: 90 }, // §7.15 — prior score 80
    vetoes: [],
    metrics: {
      apBlocked: trend('JPS', 'apBlocked', 6.8, 7.9, { floor: 0.5 }),
      apBlockedCount: 96,
      apBlockedCountPrevious: 112, // §7.16
      o2cExceptionCount: 84,
      o2cExceptionCountPrevious: 92, // §7.16
      arOver90: trend('JPS', 'arOver90', 5.1, 4.8, { floor: 0.5 }),
      arOver90Customers: 12,
      cashUnapplied: trend('JPS', 'cashUnapplied', 1.2, 1.5, { floor: 0.5 }),
      cashUnappliedReceipts: 6,
      closePercent: trend('JPS', 'closePercent', 88, 85, { decimals: 0, floor: 5 }),
      closeBlockers: 3,
      reconValue: trend('JPS', 'reconValue', 4.1, 4.6, { floor: 0.5 }),
      reconAgedBreaks: 7,
      reconAgedBreaksPrevious: 8, // §7.16
      controlBreaches: 2,
      highRiskJEs: 5,
      apBlockedOldestDays: 76,
      arOver90OldestDays: 112,
      cashUnappliedOldestDays: 14,
      reconOldestDays: 38,
      slaBreachCounts: { client: 9, provider: 2, system: 0, thirdParty: 1 },
      touchlessRate: trend('JPS', 'touchlessRate', 62, 58, { decimals: 0, floor: 5 }),
      slaBreaches: trend('JPS', 'slaBreaches', 12, 14, { decimals: 0, floor: 5 }),
      dso: trend('JPS', 'dso', 54, 52, { decimals: 0, floor: 5 }),
      dpo: trend('JPS', 'dpo', 41, 42, { decimals: 0, floor: 5 }),
      dpoAdjusted: 38,
      releasableCash: 1.5, // §7.19 — resolvable-today release value (all six entities tabulated)
      releasableItems: 11, // §7.19 — item count behind releasableCash
      queriesOverdue: 11, // §7.31 — overdue service queries; tracks the service dimension inversely
      accrualExposure: 2.1, // §8.2 — blocked payables with no goods receipt posted
      revenueAtRisk: 3.3, // §8.2 — open disputes and credit blocks
      provisionAdequacyPct: 94, // §8.2 — provision vs actual utilisation
      fxIntercompanyExposure: 5.8, // §8.2 — unmatched intercompany with related parties (Singapore holding entity)
      unpostedGr: { vendors: 5, recurrenceMonths: 2 }, // §7.18 — value is accrualExposure itself (§8.2), stored once
      causeElimination: { identified: 5, eliminated: 2, inProgress: 1 }, // §7.18 — notStarted derived (5 − 2 − 1 = 2)
      cashOpportunity: { value: 4.3, items: 34 }, // §7.18
    },
    sensitivity: [
      { action: 'Complete intercompany matching with JGL', dimension: 'workingCapital', dimensionMovement: 20, effort: 'Medium' },
      { action: 'Clear 7 aged reconciliation breaks', dimension: 'risk', dimensionMovement: 10, effort: 'Low' },
    ],
  },
  {
    code: 'JCP',
    name: 'Jubilant Cadista Pharmaceuticals Inc',
    segment: 'Generics',
    geography: 'United States',
    dimensions: { operational: 92, service: 94, risk: 88, workingCapital: 86, dataQuality: 94, compliance: 96 },
    dimensionsPrevious: { operational: 91, service: 93, risk: 87, workingCapital: 85, dataQuality: 93, compliance: 96 }, // §7.15 — prior score 90
    vetoes: [],
    metrics: {
      apBlocked: trend('JCP', 'apBlocked', 2.1, 2.4, { floor: 0.5 }),
      apBlockedCount: 41,
      apBlockedCountPrevious: 47, // §7.16
      o2cExceptionCount: 31,
      o2cExceptionCountPrevious: 34, // §7.16
      arOver90: trend('JCP', 'arOver90', 1.9, 2.1, { floor: 0.5 }),
      arOver90Customers: 7,
      cashUnapplied: trend('JCP', 'cashUnapplied', 0.3, 0.4, { floor: 0.5 }),
      cashUnappliedReceipts: 2,
      closePercent: trend('JCP', 'closePercent', 96, 95, { decimals: 0, floor: 5 }),
      closeBlockers: 1,
      reconValue: trend('JCP', 'reconValue', 1.4, 1.6, { floor: 0.5 }),
      reconAgedBreaks: 2,
      reconAgedBreaksPrevious: 2, // §7.16 — flat
      controlBreaches: 0,
      highRiskJEs: 2,
      apBlockedOldestDays: 34,
      arOver90OldestDays: 98,
      cashUnappliedOldestDays: 8,
      reconOldestDays: 16,
      slaBreachCounts: { client: 2, provider: 1, system: 0, thirdParty: 0 },
      touchlessRate: trend('JCP', 'touchlessRate', 78, 74, { decimals: 0, floor: 5 }),
      slaBreaches: trend('JCP', 'slaBreaches', 3, 4, { decimals: 0, floor: 5 }),
      dso: trend('JCP', 'dso', 47, 49, { decimals: 0, floor: 5 }),
      dpo: trend('JCP', 'dpo', 38, 39, { decimals: 0, floor: 5 }),
      dpoAdjusted: 37,
      releasableCash: 0.5, // §7.19 — resolvable-today release value (all six entities tabulated)
      releasableItems: 5, // §7.19 — item count behind releasableCash
      queriesOverdue: 4, // §7.31 — overdue service queries; tracks the service dimension inversely
      accrualExposure: 0.6, // §8.2 — blocked payables with no goods receipt posted
      revenueAtRisk: 1.1, // §8.2 — open disputes and credit blocks
      provisionAdequacyPct: 98, // §8.2 — provision vs actual utilisation
      fxIntercompanyExposure: 1.9, // §8.2 — unmatched intercompany with related parties
      unpostedGr: { vendors: 2, recurrenceMonths: 1 }, // §7.18 — value is accrualExposure itself (§8.2), stored once
      causeElimination: { identified: 3, eliminated: 2, inProgress: 0 }, // §7.18 — notStarted derived (3 − 2 − 0 = 1)
      cashOpportunity: { value: 1.5, items: 12 }, // §7.18
    },
    sensitivity: [
      { action: 'Close 2 open reconciliation breaks', dimension: 'risk', dimensionMovement: 5, effort: 'Low' },
      { action: 'Apply 2 unapplied receipts', dimension: 'workingCapital', dimensionMovement: 5, effort: 'Low' },
    ],
  },
  {
    code: 'JHS',
    name: 'Jubilant HollisterStier LLC',
    segment: 'CDMO Sterile Injectables',
    geography: 'US / Canada', // §2 corrected in Step 13 — matches the Spokane and Montreal sites (§7.17/§7.26)
    dimensions: { operational: 88, service: 88, risk: 86, workingCapital: 84, dataQuality: 92, compliance: 94 },
    dimensionsPrevious: { operational: 88, service: 90, risk: 88, workingCapital: 86, dataQuality: 92, compliance: 94 }, // §7.15 — prior score 89
    vetoes: [],
    metrics: {
      apBlocked: trend('JHS', 'apBlocked', 4.2, 4.0, { floor: 0.5 }),
      apBlockedCount: 68,
      apBlockedCountPrevious: 65, // §7.16
      o2cExceptionCount: 52,
      o2cExceptionCountPrevious: 49, // §7.16
      arOver90: trend('JHS', 'arOver90', 3.8, 4.1, { floor: 0.5 }),
      arOver90Customers: 11,
      cashUnapplied: trend('JHS', 'cashUnapplied', 0.6, 0.5, { floor: 0.5 }),
      cashUnappliedReceipts: 4,
      closePercent: trend('JHS', 'closePercent', 94, 91, { decimals: 0, floor: 5 }),
      closeBlockers: 2,
      reconValue: trend('JHS', 'reconValue', 2.7, 2.5, { floor: 0.5 }),
      reconAgedBreaks: 4,
      reconAgedBreaksPrevious: 4, // §7.16 — flat
      controlBreaches: 0,
      highRiskJEs: 3,
      apBlockedOldestDays: 51,
      arOver90OldestDays: 104,
      cashUnappliedOldestDays: 11,
      reconOldestDays: 22,
      slaBreachCounts: { client: 5, provider: 1, system: 0, thirdParty: 0 },
      touchlessRate: trend('JHS', 'touchlessRate', 71, 68, { decimals: 0, floor: 5 }),
      slaBreaches: trend('JHS', 'slaBreaches', 6, 5, { decimals: 0, floor: 5 }),
      dso: trend('JHS', 'dso', 51, 50, { decimals: 0, floor: 5 }),
      dpo: trend('JHS', 'dpo', 40, 40, { decimals: 0, floor: 5 }),
      dpoAdjusted: 38,
      releasableCash: 0.9, // §7.19 — resolvable-today release value (all six entities tabulated)
      releasableItems: 8, // §7.19 — item count behind releasableCash
      queriesOverdue: 8, // §7.31 — overdue service queries; tracks the service dimension inversely
      accrualExposure: 1.3, // §8.2 — blocked payables with no goods receipt posted
      revenueAtRisk: 2.3, // §8.2 — open disputes and credit blocks
      provisionAdequacyPct: 97, // §8.2 — provision vs actual utilisation
      fxIntercompanyExposure: 2.2, // §8.2 — unmatched intercompany with related parties
      unpostedGr: { vendors: 3, recurrenceMonths: 2 }, // §7.18 — value is accrualExposure itself (§8.2), stored once
      causeElimination: { identified: 4, eliminated: 1, inProgress: 1 }, // §7.18 — notStarted derived (4 − 1 − 1 = 2)
      cashOpportunity: { value: 2.9, items: 24 }, // §7.18
    },
    sensitivity: [
      { action: 'Clear 4 aged reconciliation breaks', dimension: 'risk', dimensionMovement: 10, effort: 'Low' },
      { action: 'Resolve GR timing on the sterile line', dimension: 'operational', dimensionMovement: 10, effort: 'Medium' },
    ],
  },
  {
    code: 'JRP',
    name: 'Jubilant Radiopharma',
    segment: 'Radiopharma',
    geography: 'US / Canada',
    dimensions: { operational: 64, service: 66, risk: 46, workingCapital: 48, dataQuality: 74, compliance: 60 },
    // §7.15 — prior period had only the GST/HST veto active (cap 60); the bank change was detected this period → prior score 60
    dimensionsPrevious: { operational: 66, service: 68, risk: 52, workingCapital: 51, dataQuality: 75, compliance: 60 },
    vetoes: [
      {
        id: 'gstOverdue',
        rule: 'Any statutory return filed late or overdue',
        reason: 'GST/HST return overdue',
        cap: 60,
        active: true,
      },
      {
        id: 'bankChange',
        rule: 'Unauthorised or unverified vendor bank detail change, unresolved',
        reason: 'unauthorised vendor bank change, unresolved',
        cap: 55,
        active: true,
        detectedThisPeriod: true, // §7.15 — the prior period's score was capped only by gstOverdue (60)
      },
    ],
    metrics: {
      apBlocked: trend('JRP', 'apBlocked', 14.7, 13.2, { floor: 0.5 }),
      apBlockedCount: 268,
      apBlockedCountPrevious: 241, // §7.16
      o2cExceptionCount: 241,
      o2cExceptionCountPrevious: 220, // §7.16
      arOver90: trend('JRP', 'arOver90', 10.6, 9.8, { floor: 0.5 }),
      arOver90Customers: 34,
      cashUnapplied: trend('JRP', 'cashUnapplied', 4.0, 3.4, { floor: 0.5 }),
      cashUnappliedReceipts: 23,
      closePercent: trend('JRP', 'closePercent', 52, 58, { decimals: 0, floor: 5 }),
      closeBlockers: 11,
      reconValue: trend('JRP', 'reconValue', 12.6, 11.2, { floor: 0.5 }),
      reconAgedBreaks: 26,
      reconAgedBreaksPrevious: 23, // §7.16
      controlBreaches: 7,
      highRiskJEs: 19,
      apBlockedOldestDays: 168,
      arOver90OldestDays: 210,
      cashUnappliedOldestDays: 44,
      reconOldestDays: 94,
      slaBreachCounts: { client: 33, provider: 8, system: 5, thirdParty: 2 },
      touchlessRate: trend('JRP', 'touchlessRate', 41, 39, { decimals: 0, floor: 5 }),
      slaBreaches: trend('JRP', 'slaBreaches', 48, 48, { decimals: 0, floor: 5 }),
      dso: trend('JRP', 'dso', 74, 69, { decimals: 0, floor: 5 }),
      dpo: trend('JRP', 'dpo', 56, 52, { decimals: 0, floor: 5 }),
      dpoAdjusted: 50,
      releasableCash: 3.3, // §7.19 — resolvable-today release value (all six entities tabulated)
      releasableItems: 31, // §7.19 — item count behind releasableCash
      queriesOverdue: 41, // §7.31 — overdue service queries; tracks the service dimension inversely
      accrualExposure: 5.7, // §8.2 — blocked payables with no goods receipt posted
      revenueAtRisk: 8.3, // §8.2 — open disputes and credit blocks
      provisionAdequacyPct: 84, // §8.2 — provision vs actual utilisation
      fxIntercompanyExposure: 4.7, // §8.2 — unmatched intercompany with related parties
      unpostedGr: { vendors: 14, recurrenceMonths: 6 }, // §7.18 — value is accrualExposure itself (§8.2), stored once
      causeElimination: { identified: 7, eliminated: 1, inProgress: 1 }, // §7.18 — notStarted derived (7 − 1 − 1 = 5)
      cashOpportunity: { value: 9.2, items: 79 }, // §7.18
    },
    sensitivity: [
      { action: 'Resolve the unauthorised vendor bank change', dimension: null, dimensionMovement: 0, clearsVeto: 'bankChange', effort: 'High' },
      { action: 'File the overdue GST/HST return', dimension: 'compliance', dimensionMovement: 40, clearsVeto: 'gstOverdue', effort: 'Low' },
      { action: 'Clear 26 aged reconciliation breaks', dimension: 'risk', dimensionMovement: 20, effort: 'Medium' },
    ],
  },
];
