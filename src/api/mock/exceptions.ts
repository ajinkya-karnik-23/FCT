import type { Attribution, ControlSignificance, Exception, TimelineEvent } from '../types';
import { fnv1a, mulberry32 } from './entities';

// spec/03 — Exceptions: twelve rows per entity (§7.17), process p2p. JGL's twelve are the original
// literals; the other five entities are generated deterministically from the entity code (no Math.random).
// §7.6 — attribution follows the cause mapping below; every row carries evidence[] and status.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// §7.21 — the demo clock is relative: every seeded timestamp derives from today (start of day), so
// evidence and ageing always agree whenever the prototype opens. Deterministic within a single day.
export const ANCHOR = (() => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
})();

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Calendar arithmetic through the Date constructor — no UTC drift across month boundaries.
export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function fmtDate(d: Date): string {
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; // '14 Jul 2026'
}

// Last day of the month containing d — the horizon every §7.3 driver is tested against.
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; // 'YYYY-MM-DD' — lexicographic compare = chronological
}

function fmtDayMonth(d: Date): string {
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]}`; // '15 Jul'
}

function parseBookedOn(s: string): Date {
  const [dd, mon, yyyy] = s.split(' ');
  return new Date(Number(yyyy), MONTHS.indexOf(mon), Number(dd));
}

// §7.6 — attribution per cause; the reason is what the detail screen shows next to it.
const CAUSE_ATTRIBUTION: Record<string, { attribution: Attribution; reason: string }> = {
  'missing-gr': { attribution: 'client', reason: 'Goods receipts are posted by client plant stores — the block sits with the client' },
  'po-price-mismatch': { attribution: 'client', reason: 'The PO rate is set by client procurement; the invoice deviates from it' },
  'approval-pending': { attribution: 'client', reason: 'Release waits on a client-side approval step' },
  'vendor-master': { attribution: 'provider', reason: 'Vendor master records are maintained in the provider-run AP process' },
  'duplicate-suspicion': { attribution: 'system', reason: 'Flagged automatically by the invoice-dedup control' },
  'tax-mismatch': { attribution: 'provider', reason: 'Tax validation runs in the provider-run invoice-processing step' },
};

export function attributionReason(reasonKey: string): string {
  return CAUSE_ATTRIBUTION[reasonKey].reason;
}

// Reproduces JGL's stored significance values exactly (verified against all twelve rows).
function significanceFor(reasonKey: string, ageDays: number, amount: number): ControlSignificance {
  switch (reasonKey) {
    case 'missing-gr': return ageDays > 30 ? 'High' : 'Medium';
    case 'vendor-master': return amount >= 0.9 ? 'Medium' : 'Low';
    case 'duplicate-suspicion': return 'High';
    case 'po-price-mismatch': return 'Medium';
    default: return 'Low'; // approval-pending, tax-mismatch
  }
}

// Lifecycle beats per cause, offset in days from bookedOn. The first two also seed evidence[].
interface Beat { offsetDays: number; text: (x: Exception) => string; tone: 'ok' | 'bad' }

const CAUSE_BEATS: Record<string, Beat[]> = {
  'missing-gr': [
    { offsetDays: 1, text: () => 'Three-way match failed — no goods receipt', tone: 'bad' },
    { offsetDays: 2, text: (x) => `Query raised with ${x.plant} stores`, tone: 'ok' },
    { offsetDays: 14, text: () => 'Vendor follow-up, no GR posted', tone: 'bad' },
  ],
  'po-price-mismatch': [
    { offsetDays: 1, text: () => 'Invoice price deviates from PO rate', tone: 'bad' },
    { offsetDays: 3, text: () => 'Rate query sent to procurement', tone: 'ok' },
  ],
  'approval-pending': [
    { offsetDays: 2, text: () => 'Release held at approval step', tone: 'bad' },
    { offsetDays: 4, text: () => 'Approver reminder sent', tone: 'ok' },
  ],
  'vendor-master': [
    { offsetDays: 1, text: () => 'Vendor master field incomplete', tone: 'bad' },
    { offsetDays: 3, text: () => 'Master data fix requested', tone: 'ok' },
  ],
  'duplicate-suspicion': [
    { offsetDays: 1, text: () => 'Duplicate invoice flag raised by dedup control', tone: 'bad' },
    { offsetDays: 4, text: () => 'Second copy under review', tone: 'ok' },
  ],
  'tax-mismatch': [
    { offsetDays: 2, text: () => 'Tax code mismatch on vendor master', tone: 'bad' },
    { offsetDays: 5, text: () => 'Tax registration correction requested', tone: 'ok' },
  ],
};

// §7.19 — the open line says what is still waiting; when resolvable today, the same cause reads as one action away.
const OPEN_LINE_PREFIX: Record<string, string> = {
  'missing-gr': 'Awaiting GR',
  'po-price-mismatch': 'Awaiting rate confirmation',
  'approval-pending': 'Awaiting approver release',
  'vendor-master': 'Awaiting master data fix',
  'duplicate-suspicion': 'Awaiting dedup review outcome',
  'tax-mismatch': 'Awaiting tax correction',
};

// The escalation timer is the item's own: older items escalate sooner, so lanes differ instead of all reading six hours.
export function escalationHours(ageDays: number): number {
  return Math.max(1, 47 - ageDays);
}

// §7.19 — prospective: the clearing action is available and quick; nothing has posted yet.
const CLOSING_LINE_RESOLVABLE: Record<string, string> = {
  'missing-gr': 'Receipt available — one post clears it',
  'po-price-mismatch': 'Variance within tolerance — ready to approve',
  'approval-pending': 'Approver active — one nudge releases it',
  'vendor-master': 'Master data fix prepared — one validation releases it',
  'duplicate-suspicion': 'Void prepared — one confirmation releases it',
  'tax-mismatch': 'Tax correction prepared — one validation releases it',
};

export function closingLine(reasonKey: string, resolvableToday = false, ageDays?: number): string {
  if (resolvableToday) return CLOSING_LINE_RESOLVABLE[reasonKey];
  const hours = escalationHours(ageDays ?? 0);
  return `${OPEN_LINE_PREFIX[reasonKey]} — escalation due in ${hours} hour${hours === 1 ? '' : 's'}`;
}

// One seeded clock per (row, offset) so evidence and timeline stamp the same event identically.
function beatTime(x: Exception, offsetDays: number): { date: Date; hh: number; mm: number } {
  const rand = mulberry32(fnv1a(`${x.id}:beat:${offsetDays}`));
  let d = addDays(parseBookedOn(x.bookedOn), offsetDays);
  if (d.getTime() > ANCHOR.getTime()) d = new Date(ANCHOR); // young rows never show future events
  return { date: d, hh: 8 + Math.floor(rand() * 9), mm: Math.floor(rand() * 60) };
}

function stampOf(t: { date: Date; hh: number; mm: number }): string {
  return `${pad2(t.date.getDate())}-${MONTHS[t.date.getMonth()]} ${pad2(t.hh)}:${pad2(t.mm)}`; // '15-Jul 09:41'
}

// §7.6 — every row carries a three-line audit trail: booking plus the first two cause beats.
export const SEEDED_EVIDENCE_LINES = 3;

function seedEvidence(x: Exception): string[] {
  const lines = [`Invoice received via vendor portal ${stampOf(beatTime(x, 0))}`];
  for (const beat of CAUSE_BEATS[x.reasonKey].slice(0, 2)) {
    lines.push(`${beat.text(x)} ${stampOf(beatTime(x, beat.offsetDays))}`);
  }
  return lines;
}

// The lifecycle timeline the detail screen renders: PO release, booking and every cause beat.
export function seededTimeline(x: Exception): TimelineEvent[] {
  const booked = parseBookedOn(x.bookedOn);
  const events: TimelineEvent[] = [
    { dateLabel: fmtDayMonth(addDays(booked, -12)), text: 'PO released to vendor', tone: 'ok' },
  ];
  const received = beatTime(x, 0);
  events.push({ dateLabel: fmtDayMonth(received.date), time: `${pad2(received.hh)}:${pad2(received.mm)}`, text: 'Invoice received via vendor portal', tone: 'ok' });
  for (const beat of CAUSE_BEATS[x.reasonKey]) {
    const t = beatTime(x, beat.offsetDays);
    events.push({ dateLabel: fmtDayMonth(t.date), time: `${pad2(t.hh)}:${pad2(t.mm)}`, text: beat.text(x), tone: beat.tone });
  }
  return events;
}

// spec/03 — the original twelve JGL rows, kept first so dataset order stays stable for consumers.
// §7.21 — bookedOn is derived (today − ageDays) in the export below; only the day count is pinned here.
// §7.19 — four rows are resolvable today (the clearing action is available and quick; nothing has posted yet).
const jglExceptions: Omit<Exception, 'bookedOn'>[] = [
  { id: 'AP-104281', entityCode: 'JGL', processKey: 'p2p', vendor: 'Suraksha Chemicals Pvt Ltd', amount: 2.84, ageDays: 41, reasonKey: 'missing-gr', plant: 'Nanjangud', owner: 'P. Nair', controlSignificance: 'High', attribution: 'client', po: 'PO-4471902', resolvableToday: false },
  { id: 'AP-104306', entityCode: 'JGL', processKey: 'p2p', vendor: 'Zenith Packaging Industries', amount: 1.96, ageDays: 37, reasonKey: 'po-price-mismatch', plant: 'Roorkee', owner: 'A. Sethi', controlSignificance: 'Medium', attribution: 'client', po: 'PO-4472118', resolvableToday: false },
  { id: 'AP-104355', entityCode: 'JGL', processKey: 'p2p', vendor: 'Meridian Logistics Services', amount: 1.42, ageDays: 34, reasonKey: 'approval-pending', plant: 'Ambernath', owner: 'R. Iyer', controlSignificance: 'Low', attribution: 'client', po: 'PO-4472884', resolvableToday: true },
  { id: 'AP-104402', entityCode: 'JGL', processKey: 'p2p', vendor: 'Kaveri Solvents Ltd', amount: 1.28, ageDays: 52, reasonKey: 'missing-gr', plant: 'Nanjangud', owner: 'P. Nair', controlSignificance: 'High', attribution: 'client', po: 'PO-4470553', resolvableToday: false },
  { id: 'AP-104417', entityCode: 'JGL', processKey: 'p2p', vendor: 'Orion Instruments Pvt Ltd', amount: 0.96, ageDays: 29, reasonKey: 'vendor-master', plant: 'Noida', owner: 'S. Rao', controlSignificance: 'Medium', attribution: 'provider', po: 'PO-4473201', resolvableToday: false },
  { id: 'AP-104458', entityCode: 'JGL', processKey: 'p2p', vendor: 'Balaji Engineering Works', amount: 0.88, ageDays: 46, reasonKey: 'missing-gr', plant: 'Roorkee', owner: 'A. Sethi', controlSignificance: 'High', attribution: 'client', po: 'PO-4471044', resolvableToday: false },
  { id: 'AP-104473', entityCode: 'JGL', processKey: 'p2p', vendor: 'Deccan Speciality Gases', amount: 0.74, ageDays: 21, reasonKey: 'duplicate-suspicion', plant: 'Nanjangud', owner: 'P. Nair', controlSignificance: 'High', attribution: 'system', po: 'PO-4473688', resolvableToday: true },
  { id: 'AP-104501', entityCode: 'JGL', processKey: 'p2p', vendor: 'Trident Maintenance Co', amount: 0.68, ageDays: 18, reasonKey: 'approval-pending', plant: 'Ambernath', owner: 'R. Iyer', controlSignificance: 'Low', attribution: 'client', po: 'PO-4473912', resolvableToday: false },
  { id: 'AP-104522', entityCode: 'JGL', processKey: 'p2p', vendor: 'Nova Analytical Labs', amount: 0.61, ageDays: 33, reasonKey: 'po-price-mismatch', plant: 'Noida', owner: 'S. Rao', controlSignificance: 'Medium', attribution: 'client', po: 'PO-4472470', resolvableToday: false },
  { id: 'AP-104570', entityCode: 'JGL', processKey: 'p2p', vendor: 'Shakti Power Systems', amount: 0.54, ageDays: 12, reasonKey: 'tax-mismatch', plant: 'Roorkee', owner: 'A. Sethi', controlSignificance: 'Low', attribution: 'provider', po: 'PO-4474355', resolvableToday: true },
  { id: 'AP-104588', entityCode: 'JGL', processKey: 'p2p', vendor: 'Ganga Freight Movers', amount: 0.47, ageDays: 27, reasonKey: 'missing-gr', plant: 'Ambernath', owner: 'R. Iyer', controlSignificance: 'Medium', attribution: 'client', po: 'PO-4472996', resolvableToday: true },
  { id: 'AP-104611', entityCode: 'JGL', processKey: 'p2p', vendor: 'Vertex Lab Consumables', amount: 0.39, ageDays: 9, reasonKey: 'vendor-master', plant: 'Noida', owner: 'S. Rao', controlSignificance: 'Low', attribution: 'provider', po: 'PO-4474612', resolvableToday: false },
];

const ROWS = 12;

// §7.5 proportions on twelve rows — four goods-receipt rows keep the accrual drill populated (§7.17).
const CAUSE_MIX = ['missing-gr', 'missing-gr', 'missing-gr', 'missing-gr', 'po-price-mismatch', 'po-price-mismatch', 'po-price-mismatch', 'approval-pending', 'approval-pending', 'vendor-master', 'duplicate-suspicion', 'tax-mismatch'];

// §7.19 — the causes with a tabulated resolvable-today state; nine of the twelve rows carry one, so a
// three-row resolvable budget always lands exactly on three (the resolvable-today set per entity).
const TABULATED_CAUSES = ['missing-gr', 'po-price-mismatch', 'approval-pending'];

// §7.17 — shown value ₹cr and max age per entity; plants and vendor pools from the spec's tables.
interface Seed { code: string; totalCr: number; maxAge: number; plants: string[]; vendors: string[]; owners: string[]; idBase: number; poPrefix: string }

const INDIA_VENDORS = ['Sahyadri Biosciences', 'Konark Glassware', 'Prabhat Cold Chain', 'Indus Analytical', 'Varsha Packaging', 'Aravalli Reagents'];
// §7.17 — JPS's own pool: a Singapore holding entity buying from Indian chemical vendors is the kind of detail a client notices.
const SINGAPORE_VENDORS = ['Straits Facilities', 'Raffles Professional Services', 'Kallang Freight', 'Tanjong Technology Services'];
const US_VENDORS = ['Cascade Packaging', 'Alcott Laboratories', 'Northgate Logistics', 'Sentinel Instruments', 'Harbor Chemical', 'Fairmont Sterile Supply'];
const CA_US_VENDORS = ['Laurentian Isotopes', 'Beaufort Medical Gases', 'Cartier Packaging', 'Ridgeway Cold Chain', 'Saint-Lambert Shielding'];

// §7.17 — owners pinned per entity (two each, as in the spec's table).
const SEEDS: Seed[] = [
  { code: 'JBL', totalCr: 7.8, maxAge: 61, plants: ['Bengaluru', 'Noida'], vendors: INDIA_VENDORS, owners: ['M. Kulkarni', 'S. Rao'], idBase: 204000, poPrefix: '51' },
  { code: 'JPS', totalCr: 4.7, maxAge: 34, plants: ['Singapore'], vendors: SINGAPORE_VENDORS, owners: ['W. Tan', 'L. Cheong'], idBase: 305000, poPrefix: '62' },
  { code: 'JCP', totalCr: 1.4, maxAge: 18, plants: ['Salisbury, MD'], vendors: US_VENDORS, owners: ['D. Whitfield', 'K. Moreau'], idBase: 406000, poPrefix: '73' },
  { code: 'JHS', totalCr: 2.9, maxAge: 27, plants: ['Spokane, WA', 'Montreal, QC'], vendors: US_VENDORS, owners: ['J. Halloran', 'T. Bergstrom'], idBase: 507000, poPrefix: '84' },
  { code: 'JRP', totalCr: 10.1, maxAge: 74, plants: ['Kirkland, QC', 'US radiopharmacy network'], vendors: CA_US_VENDORS, owners: ['C. Tremblay', 'N. Okafor'], idBase: 608000, poPrefix: '95' },
];

// §7.17 — the named people per entity (JGL's four from its pinned rows). Exported so other datasets (PO owners in
// commitments) reuse the same pool instead of inventing new names.
export const OWNER_POOLS: Record<string, string[]> = {
  JGL: ['P. Nair', 'A. Sethi', 'R. Iyer', 'S. Rao'],
  ...Object.fromEntries(SEEDS.map((s) => [s.code, s.owners])),
};

// Splits totalCr into twelve non-increasing values (2dp) that sum exactly to the shown value.
function splitValues(totalCr: number, rand: () => number): number[] {
  const totalCents = Math.round(totalCr * 100); // integer math keeps the sum exact
  const weights = Array.from({ length: ROWS }, () => 0.5 + rand());
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / weightSum) * totalCents).sort((a, b) => b - a);
  const floors = raw.map((r) => Math.floor(r + 1e-9));
  const remainder = totalCents - floors.reduce((a, b) => a + b, 0); // integer in [0, ROWS)
  return raw.map((_, i) => (floors[i] + (i < remainder ? 1 : 0)) / 100);
}

// Ages: the oldest row equals apBlockedOldestDays exactly; the rest stay below it (§7.17).
function splitAges(maxAge: number, rand: () => number): number[] {
  const rest = Array.from({ length: ROWS - 1 }, (_, i) => {
    const v = Math.round(maxAge * (1 - i / (ROWS - 1)) * (0.55 + 0.45 * rand()));
    return Math.min(Math.max(v, 2), maxAge - 1);
  }).sort((a, b) => b - a);
  return [maxAge, ...rest];
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

function generateEntity(seed: Seed): Omit<Exception, 'bookedOn'>[] {
  const rand = mulberry32(fnv1a(`${seed.code}:exceptions`)); // §7.17 — seeded from the entity code
  const values = splitValues(seed.totalCr, rand);
  const ages = splitAges(seed.maxAge, rand);
  const causes = shuffle(CAUSE_MIX, rand);
  let resolvableBudget = 3; // no rand draws here — values, ages and picks stay exactly as before
  return values.map((amount, i) => {
    const ageDays = ages[i];
    const reasonKey = causes[i];
    const resolvableToday = resolvableBudget > 0 && TABULATED_CAUSES.includes(reasonKey);
    if (resolvableToday) resolvableBudget -= 1;
    return {
      id: `AP-${seed.idBase + i}`,
      entityCode: seed.code,
      processKey: 'p2p' as const,
      vendor: pick(seed.vendors, rand),
      amount,
      ageDays,
      reasonKey,
      plant: pick(seed.plants, rand),
      owner: pick(seed.owners, rand),
      controlSignificance: significanceFor(reasonKey, ageDays, amount),
      attribution: CAUSE_ATTRIBUTION[reasonKey].attribution,
      po: `PO-${seed.poPrefix}${10000 + Math.floor(rand() * 90000)}`,
      resolvableToday,
    };
  });
}

// §7.21 — every seeded timestamp is today − ageDays; derived once for all rows so evidence and ageing agree.
const withBookedOn = [...jglExceptions, ...SEEDS.flatMap(generateEntity)].map((x) => ({
  ...x,
  bookedOn: fmtDate(addDays(ANCHOR, -x.ageDays)),
}));

export const exceptions: Exception[] = withBookedOn.map((x) => ({ ...x, status: 'open' as const, evidence: seedEvidence(x) }));
