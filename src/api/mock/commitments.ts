import type { AgentAction, PurchaseOrder } from '../types';
import { agents } from './agents';
import { costCentres, counterparties } from './counterparties';
import { ANCHOR, OWNER_POOLS, addDays, fmtDate, isoDate } from './exceptions';
import { fnv1a, mulberry32 } from './entities';
import { stagesFor } from './stages';

// §15.2.1/§15.7 — the commitments agent's watch: open POs by delivery date, chase state, amendments made and value at
// risk of slipping past period-end. The named rows are the cost-centre pool (same PO ids, same values), so the watch
// reconciles to the PO stage in-flight figure (§7.4) and to every cost-centre page. All dates derive from ANCHOR, so
// "due in nine days" is true whenever the prototype opens; all randomness is seeded (no Math.random).

const COMMITMENTS_AGENT = agents.find((a) => a.id === 'commitments')!;
const THRESHOLD = COMMITMENTS_AGENT.delegation.confidenceThreshold ?? 0.85;
const SUPERVISOR = COMMITMENTS_AGENT.supervisor;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (d: Date) => MONTHS[d.getMonth()];
const firstOfNextMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1);

// Ordered timestamps within one day: a base time seeded per exchange, then fixed offsets so ask < reply < post always.
function stampSeq(dayOffset: number, seed: string, stepMin: number): string {
  const r = mulberry32(fnv1a(`commitments:time:${seed}`));
  const startMin = 8 * 60 + Math.floor(r() * 4 * 60); // 08:00–12:00
  const t = startMin + stepMin;
  return `${isoDate(addDays(ANCHOR, dayOffset))}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00`;
}

// Confidence lands deterministically on the right side of the threshold: above → [0.86, 0.96] (the band the step-19
// exception records already use), below → [0.58, 0.82].
function confidenceFor(poId: string, above: boolean): number {
  const r = mulberry32(fnv1a(`commitments:conf:${poId}`))();
  return Math.round((above ? 0.86 + r * 0.1 : 0.58 + r * 0.24) * 100) / 100;
}

function vendorFor(entityCode: string, poId: string): string {
  const pool = counterparties.filter((c) => c.type === 'vendor' && c.entityCode === entityCode);
  return pool[Math.floor(mulberry32(fnv1a(`commitments:vendor:${poId}`))() * pool.length)].name;
}

function ownerFor(entityCode: string, poId: string): string {
  const pool = OWNER_POOLS[entityCode] ?? [];
  return pool[Math.floor(mulberry32(fnv1a(`commitments:owner:${poId}`))() * pool.length)];
}

// On-track delivery dates spread over +3..+40 days from today.
function onTrackDate(poId: string): Date {
  return addDays(ANCHOR, 3 + Math.floor(mulberry32(fnv1a(`commitments:date:${poId}`))() * 38));
}

const askText = (poId: string, orig: Date) =>
  `PO ${poId} delivery is due ${fmtDate(orig)}. If it will slip, flag it now so we can amend the date before period-end.`;

// The owner is told exactly what changed — date only (§15.2.1).
const notifyText = (poId: string, from: Date, to: Date) =>
  `Delivery date on ${poId} amended from ${fmtDate(from)} to ${fmtDate(to)}. No other field was changed — value, quantity and vendor stand as released.`;

type Plan =
  | { kind: 'amended'; dayOffset: number; origDaysOut: number; newFromOrig: (orig: Date) => Date; replyFor: (newD: Date) => string }
  | { kind: 'proposed'; dayOffset: number; origDaysOut: number; proposedDeltaDays: number; reply: string }
  | { kind: 'chased'; dayOffset: number; origDaysOut: number };

// The engagement plan, keyed by PO id. JGL carries the two demo beats (the nine-day amendment and the ambiguous-reply
// escalation); every other entity gets a deterministic mix so the agent has already run everywhere (§15.1.1). Precedent
// chronology runs JBL(−5d) → JRP-proposed(−4d) → JGL-48260(−3d) → JHS/JPS(−2d) → JRP-amended(−1d) → JGL beats(today).
const PLAN: Record<string, Plan> = {
  'PO-48115': { kind: 'amended', dayOffset: 0, origDaysOut: 9, newFromOrig: (o) => addDays(firstOfNextMonth(o), 6), replyFor: (n) => `Vendor confirmed the batch is pushed into ${monthName(n)} — should land around ${fmtDate(n)}.` },
  'PO-48260': { kind: 'amended', dayOffset: -3, origDaysOut: 10, newFromOrig: (o) => addDays(firstOfNextMonth(o), 4), replyFor: (n) => `Vendor slipped the line into next month — ${fmtDate(n)} on their revised schedule.` },
  'PO-50988': { kind: 'amended', dayOffset: -5, origDaysOut: 14, newFromOrig: (o) => addDays(o, 9), replyFor: (n) => `Vendor confirmed delivery moves to ${fmtDate(n)} — schedule updated on our side.` },
  'PO-90233': { kind: 'amended', dayOffset: -2, origDaysOut: 12, newFromOrig: (o) => addDays(o, 8), replyFor: (n) => `Confirmed with the vendor — new date is ${fmtDate(n)}.` },
  'PO-60118': { kind: 'amended', dayOffset: -1, origDaysOut: 13, newFromOrig: (o) => addDays(o, 10), replyFor: (n) => `The line slips to ${fmtDate(n)}; vendor has reconfirmed in writing.` },
  'PO-48307': { kind: 'proposed', dayOffset: 0, origDaysOut: 6, proposedDeltaDays: 10, reply: 'Might slip, checking with vendor — will confirm once they respond.' },
  'PO-60245': { kind: 'proposed', dayOffset: -4, origDaysOut: 8, proposedDeltaDays: 10, reply: 'Not sure yet. Vendor says it could move a week or so, still checking.' },
  'PO-73021': { kind: 'proposed', dayOffset: -2, origDaysOut: 9, proposedDeltaDays: 7, reply: 'Could be late — vendor is looking into it, no firm date yet.' },
  'PO-47902': { kind: 'chased', dayOffset: -1, origDaysOut: 5 },
  'PO-48644': { kind: 'chased', dayOffset: 0, origDaysOut: 7 },
  'PO-51204': { kind: 'chased', dayOffset: -1, origDaysOut: 8 },
  'PO-51377': { kind: 'chased', dayOffset: 0, origDaysOut: 11 },
  'PO-73155': { kind: 'chased', dayOffset: 0, origDaysOut: 6 },
  'PO-81042': { kind: 'chased', dayOffset: -1, origDaysOut: 9 },
  'PO-90102': { kind: 'chased', dayOffset: 0, origDaysOut: 7 },
};

// §15.2.1 — precedent must be readable: each engaged PO cites an earlier case of the same outcome (group-wide).
const PRECEDENTS: Record<string, string[]> = {
  'PO-48260': ['PO-50988'],
  'PO-90233': ['PO-50988'],
  'PO-60118': ['PO-48260'],
  'PO-48115': ['PO-48260'],
  'PO-73021': ['PO-60245'],
  'PO-48307': ['PO-73021'],
};

function buildPo(entityCode: string, costCentreId: string, poId: string, valueCr: number): PurchaseOrder {
  const plan = PLAN[poId];
  let owner = ownerFor(entityCode, poId);
  // An ambiguous reply escalates to a human — not back to the person who gave it. Same pool, next seat; no new names.
  if (plan?.kind === 'proposed' && owner === SUPERVISOR) {
    const pool = OWNER_POOLS[entityCode] ?? [];
    owner = pool[(pool.indexOf(owner) + 1) % pool.length];
  }
  const base: PurchaseOrder = {
    id: poId, entityCode, costCentreId, vendorName: vendorFor(entityCode, poId), ownerName: owner,
    valueCr, deliveryDate: isoDate(onTrackDate(poId)), chaseState: 'on-track',
  };
  if (!plan) return base;

  const orig = addDays(ANCHOR, plan.origDaysOut);
  if (plan.kind === 'chased') {
    return { ...base, deliveryDate: isoDate(orig), chaseState: 'chased', exchange: { askedAt: stampSeq(plan.dayOffset, poId, 0), askText: askText(poId, orig) } };
  }

  const replyAt = stampSeq(plan.dayOffset, poId, 95);
  if (plan.kind === 'proposed') {
    const proposedTo = addDays(orig, plan.proposedDeltaDays);
    const conf = confidenceFor(poId, false);
    return {
      ...base, deliveryDate: isoDate(orig), chaseState: 'proposed',
      exchange: {
        askedAt: stampSeq(plan.dayOffset, poId, 0), askText: askText(poId, orig),
        reply: { at: replyAt, text: plan.reply }, extractedDate: isoDate(proposedTo), confidence: conf,
        understoodAt: stampSeq(plan.dayOffset, poId, 105),
        amendment: { from: isoDate(orig), to: isoDate(proposedTo) }, // no postedAt — a proposal changes nothing in SAP
        proposedAt: stampSeq(plan.dayOffset, poId, 112),
      },
    };
  }

  const newD = plan.newFromOrig(orig);
  const conf = confidenceFor(poId, true);
  return {
    ...base, deliveryDate: isoDate(newD), originalDeliveryDate: isoDate(orig), chaseState: 'amended',
    exchange: {
      askedAt: stampSeq(plan.dayOffset, poId, 0), askText: askText(poId, orig),
      reply: { at: replyAt, text: plan.replyFor(newD) }, extractedDate: isoDate(newD), confidence: conf,
      understoodAt: stampSeq(plan.dayOffset, poId, 105),
      amendment: { from: isoDate(orig), to: isoDate(newD), postedAt: stampSeq(plan.dayOffset, poId, 112) },
      notificationText: notifyText(poId, orig, newD), notifiedAt: stampSeq(plan.dayOffset, poId, 113),
    },
  };
}

export const purchaseOrders: PurchaseOrder[] = costCentres.flatMap((cc) =>
  cc.openPos.map(({ po, valueCr }) => buildPo(cc.entityCode, cc.id, po, valueCr)),
);

// §15.2.1 — the record shows what the agent understood: the reply quoted, the extracted intent, and the confidence in
// that reading. Below threshold the same shape carries a failing check instead of an amendment.
function amendedRecord(po: PurchaseOrder): Pick<AgentAction, 'trigger' | 'checks' | 'rationale' | 'declined' | 'reversibility'> {
  const ex = po.exchange!;
  return {
    trigger: `Delivery on ${po.id} due ${fmtDate(parseIso(po.originalDeliveryDate!))}`,
    checks: [
      { test: 'Owner reply confirming slippage', threshold: "reply required as evidence — never acts without it", actual: 'owner replied; slippage confirmed in writing', pass: true },
      { test: 'Confidence in the reading', threshold: `≥ ${THRESHOLD} (agent delegation)`, actual: `${ex.confidence!.toFixed(2)} — above threshold`, pass: ex.confidence! >= THRESHOLD },
      { test: 'Scope of the amendment', threshold: 'date only — never price, quantity or vendor', actual: 'delivery date amended; no other field touched', pass: true },
    ],
    rationale: 'The owner confirmed the slippage in plain language and the reading clears the confidence threshold; amending keeps committed spend, accrual planning and close exposure on a true delivery date.',
    declined: "I did not amend price or quantity — this agent touches a date and nothing else, and it acts only on the owner's reply.",
    reversibility: 'A date amendment is reversible — the original delivery date stays in the PO history, and the accrual estimate reverts with it.',
  };
}

function proposedRecord(po: PurchaseOrder): Pick<AgentAction, 'trigger' | 'checks' | 'rationale' | 'declined' | 'reversibility'> {
  const ex = po.exchange!;
  return {
    trigger: `Delivery on ${po.id} due ${fmtDate(parseIso(po.deliveryDate))}; owner reply does not confirm a date`,
    checks: [
      { test: 'Owner reply received', threshold: "reply required as evidence — never acts without it", actual: 'owner replied', pass: true },
      { test: 'Confidence in the reading', threshold: `≥ ${THRESHOLD} (agent delegation)`, actual: `${ex.confidence!.toFixed(2)} — below threshold`, pass: ex.confidence! >= THRESHOLD },
      { test: 'Scope of any amendment', threshold: 'date only — never price, quantity or vendor', actual: 'proposed delivery date only; no other field touched', pass: true },
    ],
    rationale: `The reply does not confirm a date — it is a possibility, not a commitment. Below the ${THRESHOLD} confidence threshold the agent proposes and escalates to ${SUPERVISOR} rather than amending.`,
    declined: 'I did not amend the PO — an ambiguous reply is not evidence of slippage, and a wrong reading would corrupt exactly the commitment data this agent exists to protect.',
    reversibility: 'A proposal changes nothing in SAP; the delivery date stands until a human confirms it or the owner replies with a firm date.',
  };
}

function chasedRecord(po: PurchaseOrder): Pick<AgentAction, 'trigger' | 'checks' | 'rationale' | 'declined' | 'reversibility'> {
  const daysOut = Math.round((parseIso(po.deliveryDate).getTime() - ANCHOR.getTime()) / 86400000);
  return {
    trigger: `Delivery on ${po.id} due in ${daysOut} days — inside the pre-close window`,
    checks: [
      { test: 'Inside the watch window', threshold: 'delivery within 21 days of today', actual: `${daysOut} days to delivery`, pass: true },
    ],
    rationale: 'The date is close enough that a slip would land past period-end; the owner is asked to flag slippage now, before it becomes an exception.',
    declined: 'I did not amend anything — there is no reply yet, and this agent never acts without one.',
    reversibility: 'A chase message changes no record; nothing to unwind.',
  };
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const poActionLog: AgentAction[] = purchaseOrders
  .filter((po) => po.chaseState !== 'on-track')
  .map((po): AgentAction => {
    const ex = po.exchange!;
    const takenAt = po.chaseState === 'amended' ? ex.amendment!.postedAt! : po.chaseState === 'proposed' ? ex.proposedAt! : ex.askedAt;
    const common = { id: `commitments-po-${po.id}`, agentId: 'commitments', targetType: 'po' as const, targetId: po.id, entityCode: po.entityCode, takenAt, reversible: true, withinDelegation: true as const };
    if (po.chaseState === 'amended') {
      return { ...common, action: 'Amended the PO delivery date after the owner confirmed slippage', outcome: 'resolved', precedents: PRECEDENTS[po.id] ?? [], evidence: [`owner reply quoted: “${ex.reply!.text}”`, `extracted intent: amend the delivery date only → ${fmtDate(parseIso(ex.extractedDate!))}`, `confidence in that reading: ${ex.confidence!.toFixed(2)}`], ...amendedRecord(po) };
    }
    if (po.chaseState === 'proposed') {
      return { ...common, action: 'Proposed a new delivery date and escalated — reply below confidence threshold', outcome: 'escalated', precedents: PRECEDENTS[po.id] ?? [], evidence: [`owner reply quoted: “${ex.reply!.text}”`, `extracted intent (uncertain): delivery may move ~${Math.round((parseIso(ex.amendment!.to).getTime() - parseIso(ex.amendment!.from).getTime()) / 86400000)} days — no firm date stated`, `confidence in that reading: ${ex.confidence!.toFixed(2)} — below the ${THRESHOLD} threshold`], ...proposedRecord(po) };
    }
    return { ...common, action: 'Chased the PO owner for a slippage flag', outcome: 'awaiting', precedents: [], evidence: ['chase message logged in the PO exchange; awaiting the owner’s reply'], ...chasedRecord(po) };
  });

// §15.7 — the watch screen's read model: the stage pool it reconciles to, the named rows by delivery date, and the
// value at risk of slipping past period-end (chased or proposed — the dates that are not yet confirmed).
export function commitmentsWatch(entityCode: string) {
  const poStage = stagesFor(entityCode).find((s) => s.processKey === 'p2p' && s.step === 'PO')!;
  const pos = purchaseOrders.filter((po) => po.entityCode === entityCode).sort((a, b) => (a.deliveryDate < b.deliveryDate ? -1 : 1));
  const atRisk = pos.filter((po) => po.chaseState === 'chased' || po.chaseState === 'proposed');
  return {
    openPosCount: poStage.inFlight, // the full pool (§7.4) — the named rows are its sample
    committedCr: poStage.inFlightValue, // ties to Σ cost-centre committed spend
    pos,
    chasedCount: atRisk.filter((po) => po.chaseState === 'chased').length,
    proposedCount: atRisk.filter((po) => po.chaseState === 'proposed').length,
    amendedCount: pos.filter((po) => po.chaseState === 'amended').length,
    valueAtRiskCr: Math.round(atRisk.reduce((sum, po) => sum + po.valueCr, 0) * 10) / 10,
  };
}

export function getPurchaseOrder(id: string): PurchaseOrder | undefined {
  return purchaseOrders.find((po) => po.id === id);
}

// Days from today to the PO's current delivery date (negative = past). Derived at read time against ANCHOR.
export function poDaysOut(po: PurchaseOrder): number {
  return Math.round((parseIso(po.deliveryDate).getTime() - ANCHOR.getTime()) / 86400000);
}

// §15.2.1 — the decision record a PO detail page carries: one for every engaged PO (chased rows carry their working
// record); undefined only while the agent has not yet touched the PO.
export function poDecisionFor(poId: string): { action: AgentAction; agent: (typeof agents)[number] } | undefined {
  const act = poActionLog.find((a) => a.targetId === poId);
  if (!act) return undefined;
  return { action: act, agent: COMMITMENTS_AGENT };
}
