import type { Attribution, ControlSignificance, Exception, TimelineEvent } from '../types';
import { fnv1a, mulberry32 } from './entities';

// spec/03 — Exceptions: twelve rows per entity (§7.17), process p2p; §18.3 adds the O2C sample (twelve rows per
// entity, pool o2cExceptionCount). JGL's rows are literals for both processes; the other five entities are generated
// deterministically from the entity code (no Math.random).
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
// Keys are composite (process:key) so a key ever reused across processes cannot serve one process's semantics to both.
const CAUSE_ATTRIBUTION: Record<string, { attribution: Attribution; reason: string }> = {
  'p2p:missing-gr': { attribution: 'client', reason: 'Goods receipts are posted by client plant stores — the block sits with the client' },
  'p2p:po-price-mismatch': { attribution: 'client', reason: 'The PO rate is set by client procurement; the invoice deviates from it' },
  'p2p:approval-pending': { attribution: 'client', reason: 'Release waits on a client-side approval step' },
  'p2p:vendor-master': { attribution: 'provider', reason: 'Vendor master records are maintained in the provider-run AP process' },
  'p2p:duplicate-suspicion': { attribution: 'system', reason: 'Flagged automatically by the invoice-dedup control' },
  'p2p:tax-mismatch': { attribution: 'provider', reason: 'Tax validation runs in the provider-run invoice-processing step' },
  // §6.1 — O2C causes; customer behaviour sits with the client, the provider-run O2C process owns credit, cash and master data.
  'o2c:pricing-disputes': { attribution: 'client', reason: 'Contract rates are set by client commercial; the revision never reached billing' },
  'o2c:deductions': { attribution: 'client', reason: 'Customers deduct at payment without reference to an approved credit note' },
  'o2c:billing-errors': { attribution: 'client', reason: 'Order entry and customer detail sit with the client; invoices inherit their gaps' },
  'o2c:credit-block': { attribution: 'provider', reason: 'Credit limits are reviewed in the provider-run O2C process' },
  'o2c:cash-application': { attribution: 'provider', reason: 'Receipts are applied in the provider-run cash application step' },
  'o2c:customer-master': { attribution: 'provider', reason: 'Customer master records are maintained in the provider-run O2C process' },
};

export function attributionReason(processKey: Exception['processKey'], reasonKey: string): string {
  return CAUSE_ATTRIBUTION[`${processKey}:${reasonKey}`].reason;
}

// Reproduces JGL's stored significance values exactly (verified against all twelve rows). O2C causes follow the same
// shape — age and value decide; no spec pins their levels. Switches on the composite key for the same reason as above.
function significanceFor(processKey: Exception['processKey'], reasonKey: string, ageDays: number, amount: number): ControlSignificance {
  switch (`${processKey}:${reasonKey}`) {
    case 'p2p:missing-gr': return ageDays > 30 ? 'High' : 'Medium';
    case 'p2p:vendor-master': return amount >= 0.9 ? 'Medium' : 'Low';
    case 'p2p:duplicate-suspicion': return 'High';
    case 'p2p:po-price-mismatch': return 'Medium';
    // O2C — disputes and deductions carry the ageing risk; credit holds are Medium by nature of the block.
    case 'o2c:pricing-disputes': return ageDays > 30 ? 'High' : 'Medium';
    case 'o2c:deductions': return amount >= 1 ? 'Medium' : 'Low';
    case 'o2c:credit-block': return 'Medium';
    case 'o2c:cash-application': return ageDays > 20 ? 'Medium' : 'Low';
    default: return 'Low'; // p2p approval-pending, tax-mismatch; o2c billing-errors, customer-master
  }
}

// Lifecycle beats per cause, offset in days from bookedOn. The first two also seed evidence[].
interface Beat { offsetDays: number; text: (x: Exception) => string; tone: 'ok' | 'bad' }

const CAUSE_BEATS: Record<string, Beat[]> = {
  'p2p:missing-gr': [
    { offsetDays: 1, text: () => 'Three-way match failed — no goods receipt', tone: 'bad' },
    { offsetDays: 2, text: (x) => `Query raised with ${x.plant} stores`, tone: 'ok' },
    { offsetDays: 14, text: () => 'Vendor follow-up, no GR posted', tone: 'bad' },
  ],
  'p2p:po-price-mismatch': [
    { offsetDays: 1, text: () => 'Invoice price deviates from PO rate', tone: 'bad' },
    { offsetDays: 3, text: () => 'Rate query sent to procurement', tone: 'ok' },
  ],
  'p2p:approval-pending': [
    { offsetDays: 2, text: () => 'Release held at approval step', tone: 'bad' },
    { offsetDays: 4, text: () => 'Approver reminder sent', tone: 'ok' },
  ],
  'p2p:vendor-master': [
    { offsetDays: 1, text: () => 'Vendor master field incomplete', tone: 'bad' },
    { offsetDays: 3, text: () => 'Master data fix requested', tone: 'ok' },
  ],
  'p2p:duplicate-suspicion': [
    { offsetDays: 1, text: () => 'Duplicate invoice flag raised by dedup control', tone: 'bad' },
    { offsetDays: 4, text: () => 'Second copy under review', tone: 'ok' },
  ],
  'p2p:tax-mismatch': [
    { offsetDays: 2, text: () => 'Tax code mismatch on vendor master', tone: 'bad' },
    { offsetDays: 5, text: () => 'Tax registration correction requested', tone: 'ok' },
  ],
  // §6.1 — O2C lifecycle beats; the first two seed evidence[] like their P2P counterparts.
  'o2c:pricing-disputes': [
    { offsetDays: 1, text: () => 'Customer short-paid against the revised contract rate', tone: 'bad' },
    { offsetDays: 3, text: () => 'Rate revision query raised with commercial', tone: 'ok' },
    { offsetDays: 10, text: () => 'Dispute escalated — pricing evidence requested', tone: 'bad' },
  ],
  'o2c:deductions': [
    { offsetDays: 1, text: () => 'Deduction posted without a credit-note reference', tone: 'bad' },
    { offsetDays: 2, text: () => 'Claim validation started against the approval register', tone: 'ok' },
    { offsetDays: 9, text: () => 'Adjudication pending with the customer', tone: 'bad' },
  ],
  'o2c:billing-errors': [
    { offsetDays: 1, text: () => 'Invoice rejected on receipt — detail incomplete', tone: 'bad' },
    { offsetDays: 2, text: () => 'Correction requested at order entry', tone: 'ok' },
    { offsetDays: 6, text: () => 'Re-issue queued after master validation', tone: 'bad' },
  ],
  'o2c:credit-block': [
    { offsetDays: 1, text: () => 'Order held on credit block awaiting review', tone: 'bad' },
    { offsetDays: 2, text: () => 'Limit review requested from the credit desk', tone: 'ok' },
    { offsetDays: 5, text: () => 'Awaiting manual release decision', tone: 'bad' },
  ],
  'o2c:cash-application': [
    { offsetDays: 1, text: () => 'Receipt posted without remittance advice', tone: 'bad' },
    { offsetDays: 3, text: () => 'Matching query raised with the treasury desk', tone: 'ok' },
    { offsetDays: 8, text: () => 'Unapplied — awaiting customer reference', tone: 'bad' },
  ],
  'o2c:customer-master': [
    { offsetDays: 1, text: () => 'Customer record incomplete at billing', tone: 'bad' },
    { offsetDays: 2, text: () => 'Master data fix requested', tone: 'ok' },
    { offsetDays: 7, text: () => 'Billing blocked on registry validation', tone: 'bad' },
  ],
};

// §7.19 — the open line says what is still waiting; when resolvable today, the same cause reads as one action away.
const OPEN_LINE_PREFIX: Record<string, string> = {
  'p2p:missing-gr': 'Awaiting GR',
  'p2p:po-price-mismatch': 'Awaiting rate confirmation',
  'p2p:approval-pending': 'Awaiting approver release',
  'p2p:vendor-master': 'Awaiting master data fix',
  'p2p:duplicate-suspicion': 'Awaiting dedup review outcome',
  'p2p:tax-mismatch': 'Awaiting tax correction',
  // O2C — the wait each cause is stuck on; nothing in this build flags an O2C item resolvable today.
  'o2c:pricing-disputes': 'Awaiting rate confirmation from commercial',
  'o2c:deductions': 'Awaiting claim adjudication',
  'o2c:billing-errors': 'Awaiting invoice re-issue',
  'o2c:credit-block': 'Awaiting credit release decision',
  'o2c:cash-application': 'Awaiting remittance reference',
  'o2c:customer-master': 'Awaiting master data fix',
};

// The escalation timer is the item's own: older items escalate sooner, so lanes differ instead of all reading six hours.
export function escalationHours(ageDays: number): number {
  return Math.max(1, 47 - ageDays);
}

// §7.19 — prospective: the clearing action is available and quick; nothing has posted yet.
const CLOSING_LINE_RESOLVABLE: Record<string, string> = {
  'p2p:missing-gr': 'Receipt available — one post clears it',
  'p2p:po-price-mismatch': 'Variance within tolerance — ready to approve',
  'p2p:approval-pending': 'Approver active — one nudge releases it',
  'p2p:vendor-master': 'Master data fix prepared — one validation releases it',
  'p2p:duplicate-suspicion': 'Void prepared — one confirmation releases it',
  'p2p:tax-mismatch': 'Tax correction prepared — one validation releases it',
};

export function closingLine(processKey: Exception['processKey'], reasonKey: string, resolvableToday = false, ageDays?: number): string {
  const k = `${processKey}:${reasonKey}`;
  if (resolvableToday) return CLOSING_LINE_RESOLVABLE[k];
  const hours = escalationHours(ageDays ?? 0);
  return `${OPEN_LINE_PREFIX[k]} — escalation due in ${hours} hour${hours === 1 ? '' : 's'}`;
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

// The two framing beats read per process — P2P books an invoice from a vendor, O2C issues one to a customer.
function bookingLines(x: Exception): { first: string; booked: string } {
  return x.processKey === 'o2c'
    ? { first: 'Order confirmed by customer', booked: 'Invoice issued to customer' }
    : { first: 'PO released to vendor', booked: 'Invoice received via vendor portal' };
}

function seedEvidence(x: Exception): string[] {
  const lines = [`${bookingLines(x).booked} ${stampOf(beatTime(x, 0))}`];
  for (const beat of CAUSE_BEATS[`${x.processKey}:${x.reasonKey}`].slice(0, 2)) {
    lines.push(`${beat.text(x)} ${stampOf(beatTime(x, beat.offsetDays))}`);
  }
  return lines;
}

// The lifecycle timeline the detail screen renders: order/PO release, booking and every cause beat.
export function seededTimeline(x: Exception): TimelineEvent[] {
  const booked = parseBookedOn(x.bookedOn);
  const lines = bookingLines(x)
  const events: TimelineEvent[] = [
    { dateLabel: fmtDayMonth(addDays(booked, -12)), text: lines.first, tone: 'ok' },
  ];
  const received = beatTime(x, 0);
  events.push({ dateLabel: fmtDayMonth(received.date), time: `${pad2(received.hh)}:${pad2(received.mm)}`, text: lines.booked, tone: 'ok' });
  for (const beat of CAUSE_BEATS[`${x.processKey}:${x.reasonKey}`]) {
    const t = beatTime(x, beat.offsetDays);
    events.push({ dateLabel: fmtDayMonth(t.date), time: `${pad2(t.hh)}:${pad2(t.mm)}`, text: beat.text(x), tone: beat.tone });
  }
  return events;
}

// spec/03 — the original twelve JGL rows, kept first so dataset order stays stable for consumers.
// §7.21 — bookedOn is derived (today − ageDays) in the export below; only the day count is pinned here.
// §7.19 — four rows are resolvable today (the clearing action is available and quick; nothing has posted yet).
const jglExceptions: Omit<Exception, 'bookedOn'>[] = [
  { id: 'AP-104281', entityCode: 'JGL', processKey: 'p2p', vendor: 'Suraksha Chemicals Pvt Ltd', amount: 2.84, ageDays: 41, reasonKey: 'missing-gr', plant: 'Nanjangud', owner: 'P. Nair', controlSignificance: 'High', attribution: 'client', po: 'PO-4471902', resolvableToday: false, rootCauseId: 'RC-002', traversal: ['three-way match failed — no goods receipt', 'goods at plant, held in QC release', 'GR will post when QC releases'] },
  { id: 'AP-104306', entityCode: 'JGL', processKey: 'p2p', vendor: 'Zenith Packaging Industries', amount: 1.96, ageDays: 37, reasonKey: 'po-price-mismatch', plant: 'Roorkee', owner: 'A. Sethi', controlSignificance: 'Medium', attribution: 'client', po: 'PO-4472118', resolvableToday: false, rootCauseId: 'RC-004', traversal: ['invoice price deviates from PO rate', 'contract escalation signed but not in the info record', 'variance within the reset tolerance band'] },
  { id: 'AP-104355', entityCode: 'JGL', processKey: 'p2p', vendor: 'Meridian Logistics Services', amount: 1.42, ageDays: 34, reasonKey: 'approval-pending', plant: 'Ambernath', owner: 'R. Iyer', controlSignificance: 'Low', attribution: 'client', po: 'PO-4472884', resolvableToday: true, rootCauseId: 'RC-007', traversal: ['release held at the approval step', 'approver on travel, delegation lapsed', 'released by auto-approval within DOA'] },
  { id: 'AP-104402', entityCode: 'JGL', processKey: 'p2p', vendor: 'Kaveri Solvents Ltd', amount: 1.28, ageDays: 52, reasonKey: 'missing-gr', plant: 'Nanjangud', owner: 'P. Nair', controlSignificance: 'High', attribution: 'client', po: 'PO-4470553', resolvableToday: false },
  { id: 'AP-104417', entityCode: 'JGL', processKey: 'p2p', vendor: 'Orion Instruments Pvt Ltd', amount: 0.96, ageDays: 29, reasonKey: 'vendor-master', plant: 'Noida', owner: 'S. Rao', controlSignificance: 'Medium', attribution: 'provider', po: 'PO-4473201', resolvableToday: false, rootCauseId: 'RC-010', traversal: ['vendor record created outside the standard workflow', 'tax registration missing at creation', 'one-time service vendor onboarded by email'] },
  { id: 'AP-104458', entityCode: 'JGL', processKey: 'p2p', vendor: 'Balaji Engineering Works', amount: 0.88, ageDays: 46, reasonKey: 'missing-gr', plant: 'Roorkee', owner: 'A. Sethi', controlSignificance: 'High', attribution: 'client', po: 'PO-4471044', resolvableToday: false, rootCauseId: 'RC-001', traversal: ['no GR document against the PO line', 'PO terms show consignment stock', 'GR only posts on consumption — vendor bills ahead of it'] },
  { id: 'AP-104473', entityCode: 'JGL', processKey: 'p2p', vendor: 'Deccan Speciality Gases', amount: 0.74, ageDays: 21, reasonKey: 'duplicate-suspicion', plant: 'Nanjangud', owner: 'P. Nair', controlSignificance: 'High', attribution: 'system', po: 'PO-4473688', resolvableToday: true, rootCauseId: 'RC-013', traversal: ['duplicate flag raised by the dedup control', 'same IRN across portal and email intake', 'cleared on the distinguishing PO line'] },
  { id: 'AP-104501', entityCode: 'JGL', processKey: 'p2p', vendor: 'Trident Maintenance Co', amount: 0.68, ageDays: 18, reasonKey: 'approval-pending', plant: 'Ambernath', owner: 'R. Iyer', controlSignificance: 'Low', attribution: 'client', po: 'PO-4473912', resolvableToday: false, rootCauseId: 'RC-008', traversal: ['release held at the approval step', 'approver absent beyond the chase window', 'rerouted to the delegate'] },
  { id: 'AP-104522', entityCode: 'JGL', processKey: 'p2p', vendor: 'Nova Analytical Labs', amount: 0.61, ageDays: 33, reasonKey: 'po-price-mismatch', plant: 'Noida', owner: 'S. Rao', controlSignificance: 'Medium', attribution: 'client', po: 'PO-4472470', resolvableToday: false },
  { id: 'AP-104570', entityCode: 'JGL', processKey: 'p2p', vendor: 'Shakti Power Systems', amount: 0.54, ageDays: 12, reasonKey: 'tax-mismatch', plant: 'Roorkee', owner: 'A. Sethi', controlSignificance: 'Low', attribution: 'provider', po: 'PO-4474355', resolvableToday: true },
  { id: 'AP-104588', entityCode: 'JGL', processKey: 'p2p', vendor: 'Ganga Freight Movers', amount: 0.47, ageDays: 27, reasonKey: 'missing-gr', plant: 'Ambernath', owner: 'R. Iyer', controlSignificance: 'Medium', attribution: 'client', po: 'PO-4472996', resolvableToday: true, rootCauseId: 'RC-003', traversal: ['no GR document against the PO line', 'inbound delivery ETA slipped past the PO date', 'PO date stale against confirmed slippage'] },
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
      controlSignificance: significanceFor('p2p', reasonKey, ageDays, amount),
      attribution: CAUSE_ATTRIBUTION[`p2p:${reasonKey}`].attribution,
      po: `PO-${seed.poPrefix}${10000 + Math.floor(rand() * 90000)}`,
      resolvableToday,
    };
  });
}

// §18.3 — O2C exceptions: twelve rows per entity, the same sample shape as the blocked-invoice worklist. The pool is
// o2cExceptionCount (§7.2); customers are only those already named in this entity's forecast drivers (§7.23), so every
// customer cell drills to an existing counterparty page instead of inventing names.
const O2C_CAUSE_MIX = ['pricing-disputes', 'pricing-disputes', 'pricing-disputes', 'deductions', 'deductions', 'deductions', 'billing-errors', 'billing-errors', 'credit-block', 'credit-block', 'cash-application', 'customer-master'];

// §18.3 — the shown sample value scales with the pool (JGL pinned at ₹9.6 cr against its 284); maxAge is the entity's
// arOver90OldestDays, the AR-side analogue of apBlockedOldestDays for the P2P sample.
interface O2cSeed { code: string; totalCr: number; maxAge: number; customers: string[]; idBase: number }

const O2C_SEEDS: O2cSeed[] = [
  { code: 'JBL', totalCr: 6.6, maxAge: 172, customers: ['Nirmal Wholesale', 'Vindhya Medical Supplies'], idBase: 715000 },
  { code: 'JPS', totalCr: 2.8, maxAge: 112, customers: ['Straits Healthcare Group', 'Pasir Distribution'], idBase: 726000 },
  { code: 'JCP', totalCr: 1.0, maxAge: 98, customers: ['Beacon Pharmacy Services', 'Lakeshore Distributors'], idBase: 737000 },
  { code: 'JHS', totalCr: 1.8, maxAge: 104, customers: ['Ridgeline Health Partners', 'Cornerstone Wholesale'], idBase: 748000 },
  { code: 'JRP', totalCr: 8.1, maxAge: 210, customers: ['Mont-Royal Imaging', 'Great Lakes Nuclear Medicine', 'Saint-Denis Health Network'], idBase: 759000 },
];

// spec/03 shape — JGL's twelve O2C rows pinned first; seven trace to register entries (one per cause, pricing twice),
// the rest stay unattributed like their P2P counterparts. Oldest row equals arOver90OldestDays exactly.
const jglO2cExceptions: Omit<Exception, 'bookedOn'>[] = [
  { id: 'AR-704001', entityCode: 'JGL', processKey: 'o2c', vendor: 'Amrit Distributors', amount: 1.84, ageDays: 148, reasonKey: 'pricing-disputes', plant: 'Nanjangud', owner: 'A. Sethi', controlSignificance: 'High', attribution: 'client', po: 'PO-6102384', resolvableToday: false, rootCauseId: 'RC-019', traversal: ['invoice billed at the pre-revision rate', 'mid-quarter revision never pushed to billing before the run', 'customer short-paid against the contracted rate'] },
  { id: 'AR-704002', entityCode: 'JGL', processKey: 'o2c', vendor: 'Sanjeevani Healthcare', amount: 1.42, ageDays: 96, reasonKey: 'pricing-disputes', plant: 'Roorkee', owner: 'P. Nair', controlSignificance: 'High', attribution: 'client', po: 'PO-6104117', resolvableToday: false, rootCauseId: 'RC-020', traversal: ['dispute intake without contract evidence attached', 'pricing evidence sits outside the billing system', 'commercial owner engaged for the rate file'] },
  { id: 'AR-704003', entityCode: 'JGL', processKey: 'o2c', vendor: 'Deccan Pharma Retail', amount: 1.18, ageDays: 61, reasonKey: 'deductions', plant: 'Nanjangud', owner: 'R. Iyer', controlSignificance: 'Medium', attribution: 'client', po: 'PO-6105892', resolvableToday: false, rootCauseId: 'RC-022', traversal: ['scheme deduction posted at payment', 'no credit-note reference on the posting', 'claim register shows no approval trail'] },
  { id: 'AR-704004', entityCode: 'JGL', processKey: 'o2c', vendor: 'Amrit Distributors', amount: 0.96, ageDays: 84, reasonKey: 'deductions', plant: 'Noida', owner: 'S. Rao', controlSignificance: 'Low', attribution: 'client', po: 'PO-6107446', resolvableToday: false },
  { id: 'AR-704005', entityCode: 'JGL', processKey: 'o2c', vendor: 'Sanjeevani Healthcare', amount: 0.84, ageDays: 42, reasonKey: 'billing-errors', plant: 'Roorkee', owner: 'P. Nair', controlSignificance: 'Low', attribution: 'client', po: 'PO-6109213', resolvableToday: false, rootCauseId: 'RC-025', traversal: ['invoice created without a PO reference', 'institutional order type outside the standard flow', 're-issue queued after master validation'] },
  { id: 'AR-704006', entityCode: 'JGL', processKey: 'o2c', vendor: 'Deccan Pharma Retail', amount: 0.72, ageDays: 118, reasonKey: 'credit-block', plant: 'Nanjangud', owner: 'A. Sethi', controlSignificance: 'Medium', attribution: 'provider', po: 'PO-6111508', resolvableToday: false, rootCauseId: 'RC-028', traversal: ['order held on a stale exposure limit', 'limit last reviewed a year ago', 'payment record shows twelve clean months'] },
  { id: 'AR-704007', entityCode: 'JGL', processKey: 'o2c', vendor: 'Amrit Distributors', amount: 0.61, ageDays: 33, reasonKey: 'cash-application', plant: 'Nanjangud', owner: 'R. Iyer', controlSignificance: 'Medium', attribution: 'provider', po: 'PO-6113274', resolvableToday: false, rootCauseId: 'RC-031', traversal: ['receipt posted without remittance advice', 'covers three open invoices with no reference', 'treasury desk matched two of the three'] },
  { id: 'AR-704008', entityCode: 'JGL', processKey: 'o2c', vendor: 'Sanjeevani Healthcare', amount: 0.54, ageDays: 27, reasonKey: 'deductions', plant: 'Ambernath', owner: 'S. Rao', controlSignificance: 'Low', attribution: 'client', po: 'PO-6115961', resolvableToday: false },
  { id: 'AR-704009', entityCode: 'JGL', processKey: 'o2c', vendor: 'Deccan Pharma Retail', amount: 0.47, ageDays: 19, reasonKey: 'billing-errors', plant: 'Noida', owner: 'P. Nair', controlSignificance: 'Low', attribution: 'client', po: 'PO-6117405', resolvableToday: false },
  { id: 'AR-704010', entityCode: 'JGL', processKey: 'o2c', vendor: 'Amrit Distributors', amount: 0.39, ageDays: 52, reasonKey: 'credit-block', plant: 'Roorkee', owner: 'A. Sethi', controlSignificance: 'Medium', attribution: 'provider', po: 'PO-6119832', resolvableToday: false },
  { id: 'AR-704011', entityCode: 'JGL', processKey: 'o2c', vendor: 'Sanjeevani Healthcare', amount: 0.33, ageDays: 12, reasonKey: 'customer-master', plant: 'Nanjangud', owner: 'R. Iyer', controlSignificance: 'Low', attribution: 'provider', po: 'PO-6121467', resolvableToday: false, rootCauseId: 'RC-034', traversal: ['credit terms missing on the customer record', 'onboarded before complete-record enforcement', 'billing holds until terms are standardised'] },
  { id: 'AR-704012', entityCode: 'JGL', processKey: 'o2c', vendor: 'Deccan Pharma Retail', amount: 0.3, ageDays: 8, reasonKey: 'pricing-disputes', plant: 'Ambernath', owner: 'S. Rao', controlSignificance: 'Medium', attribution: 'client', po: 'PO-6123094', resolvableToday: false },
];

function generateO2cEntity(seed: O2cSeed): Omit<Exception, 'bookedOn'>[] {
  const rand = mulberry32(fnv1a(`${seed.code}:o2c-exceptions`)); // seeded from the entity code, like the P2P sample
  const values = splitValues(seed.totalCr, rand);
  const ages = splitAges(seed.maxAge, rand);
  const causes = shuffle(O2C_CAUSE_MIX, rand);
  return values.map((amount, i) => {
    const ageDays = ages[i];
    const reasonKey = causes[i];
    return {
      id: `AR-${seed.idBase + i}`,
      entityCode: seed.code,
      processKey: 'o2c' as const,
      vendor: seed.customers[i % seed.customers.length], // cycled so every named customer carries rows and stays drillable
      amount,
      ageDays,
      reasonKey,
      plant: pick(SEEDS.find((s) => s.code === seed.code)!.plants, rand),
      owner: pick(OWNER_POOLS[seed.code]!, rand),
      controlSignificance: significanceFor('o2c', reasonKey, ageDays, amount),
      attribution: CAUSE_ATTRIBUTION[`o2c:${reasonKey}`].attribution,
      po: `PO-${seed.idBase + 4000 + i}`,
      resolvableToday: false, // §7.19's tabulated set is P2P's; nothing in this build flags an O2C item one action away
    };
  });
}

// §7.21 — every seeded timestamp is today − ageDays; derived once for all rows so evidence and ageing agree.
const withBookedOn = [
  ...jglExceptions,
  ...SEEDS.flatMap(generateEntity),
  ...jglO2cExceptions,
  ...O2C_SEEDS.flatMap(generateO2cEntity),
].map((x) => ({
  ...x,
  bookedOn: fmtDate(addDays(ANCHOR, -x.ageDays)),
}));

export const exceptions: Exception[] = withBookedOn.map((x) => ({ ...x, status: 'open' as const, evidence: seedEvidence(x) }));
