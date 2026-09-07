// §15 — the agent workforce: eighteen roles, nine live in this prototype, nine specified but not built. Every card
// states which; the honesty is what makes the coverage credible (§15.2). The spec pins no per-agent figures, so value
// caps, per-period volumes and action logs are seeded deterministically on stable keys (mulberry32(fnv1a(...)),
// mirroring mock/requests.ts) — §0 sanctions adding numbers to the dataset module first. No Math.random().

import type { Agent, AgentAction, AgentCheck, AgentLane, AgentMetrics, CoverageStrip, Exception, WalkthroughStep, WorklistAgentCounts } from '../types';
import { ANCHOR, addDays, escalationHours, exceptions, fmtDate, isoDate, seededTimeline } from './exceptions';
import { entities, fnv1a, mulberry32 } from './entities';
import { requestOwnerPool, requests } from './requests';
import { counterparties } from './counterparties';

// §7.17 supervisor pools are per-entity; an Agent carries no entityCode (§15.5's shape), so each roster number maps
// to a pool by position: three agents per entity, cycling JGL → JBL → JPS → JCP → JHS → JRP.
const ENTITY_CYCLE = ['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP'];

function supervisorFor(number: number): string {
  const pool = requestOwnerPool(ENTITY_CYCLE[Math.floor((number - 1) / 3)]);
  return pool[((number - 1) % 3) % pool.length];
}

// §0-sanctioned dataset figures — the spec pins no per-agent value caps.
function seededCap(id: string, min: number, max: number): number {
  const rand = mulberry32(fnv1a(`agents:cap:${id}`));
  return Math.round((min + rand() * (max - min)) * 10) / 10;
}

const APPROVAL_CAP = seededCap('approval-routing', 2, 6);
const PROVISIONING_CAP = seededCap('provisioning', 3, 8);
const DEDUCTION_CAP = seededCap('deduction-triage', 0.5, 2.5);

// Per-agent action-volume ranges for the nine live roles — follow-up works the largest pool because GR and approval
// are the most automatable causes (§15.4).
const ACTION_RANGES: Record<string, [number, number]> = {
  'follow-up': [300, 420],
  'master-data': [20, 60],
  commitments: [80, 160],
  'approval-routing': [200, 350],
  'match-resolution': [150, 300],
  'duplicate-adjudication': [40, 90],
  provisioning: [60, 140],
  'credit-release': [20, 70],
  'cash-application': [120, 260],
};

// Value acted on (₹ cr) — zero where the agent has no financial effect (§15.2: follow-up "nothing", master data
// completes records, commitments amends dates only).
const VALUE_RANGES: Record<string, [number, number]> = {
  'approval-routing': [40, 90],
  'match-resolution': [60, 140],
  provisioning: [25, 70],
  'credit-release': [8, 30],
  'cash-application': [30, 80],
};

function buildMetrics(id: string): AgentMetrics {
  const rand = mulberry32(fnv1a(`agents:${id}`));
  const [lo, hi] = ACTION_RANGES[id];
  const actionsThisPeriod = Math.round(lo + rand() * (hi - lo));
  const resolvedWithoutHuman = Math.round(actionsThisPeriod * (0.55 + rand() * 0.3)); // 55–85%
  const remaining = actionsThisPeriod - resolvedWithoutHuman;
  const escalated = Math.max(1, Math.round(remaining * (0.5 + rand() * 0.4))); // the rest is still awaiting
  const overriddenByHuman = Math.round(resolvedWithoutHuman * (0.01 + rand() * 0.03));
  const reversed = Math.round(resolvedWithoutHuman * (0.005 + rand() * 0.02));
  const valueActedOnCr = id in VALUE_RANGES ? Math.round((VALUE_RANGES[id][0] + rand() * (VALUE_RANGES[id][1] - VALUE_RANGES[id][0])) * 10) / 10 : 0;
  const valueActedOnWithoutReviewCr = Math.round(valueActedOnCr * (0.7 + rand() * 0.25) * 10) / 10; // 70–95% of it
  const currentPct = Math.round((resolvedWithoutHuman / actionsThisPeriod) * 100);
  const startPct = Math.max(0, currentPct - (2 + Math.floor(rand() * 7)));
  const resolvedShareTrend = Array.from({ length: 6 }, (_, i) => Math.round(startPct + ((currentPct - startPct) * i) / 5));
  // §15.6 — the three rate trends feed the governance slice on Risk & control. Each series ends at its current rate;
  // a rising one is interpreted there, not just displayed (override/reversal → the delegation may be set wrong;
  // escalation → the policy needs updating). Three agents carry a rise so each reading appears in this dataset:
  // match-resolution (override), approval-routing (reversals of auto-approvals — the value threshold may be set too
  // high), credit-release (escalation — it releases only a codified set, so more escalations mean that set is too
  // narrow). The rest are flat. delegationBreaches stays zero:
  // every logged action carries withinDelegation: true (§15.1.2's record includes that it stayed inside), so a nonzero
  // count would contradict the dataset's own evidence.
  const escalationRate = Math.round((escalated / actionsThisPeriod) * 100);
  // Override and reversal are the same kind of event — a human undoing agent-closed work after the fact — so both
  // rate against resolvedWithoutHuman, not all actions.
  const overrideRate = Math.round((overriddenByHuman / resolvedWithoutHuman) * 100);
  const reversalRate = Math.round((reversed / resolvedWithoutHuman) * 100);
  const rateTrend = (current: number, signal: boolean): number[] => {
    const startPct = signal ? Math.max(0, current - (4 + Math.floor(rand() * 3))) : current;
    return Array.from({ length: 6 }, (_, i) => Math.round(startPct + ((current - startPct) * i) / 5));
  };
  const escalationRateTrend = rateTrend(escalationRate, id === 'credit-release');
  const overrideRateTrend = rateTrend(overrideRate, id === 'match-resolution');
  const reversalRateTrend = rateTrend(reversalRate, id === 'approval-routing');
  return { actionsThisPeriod, resolvedWithoutHuman, escalated, overriddenByHuman, reversed, valueActedOnCr, valueActedOnWithoutReviewCr, delegationBreaches: 0, resolvedShareTrend, escalationRateTrend, overrideRateTrend, reversalRateTrend };
}

// §15.2 — the eighteen roles. scope is the table's "Acts on" / "What it does"; boundedBy is the "Bounded by" column;
// both verbatim. Built ✓ in the spec = live here (1, 2, 3, 7, 8, 9, 11, 16, 17); the other nine are designed.
export const agents: Agent[] = [
  {
    number: 1, id: 'follow-up', name: 'Follow-up & escalation', process: 'shared', type: 'reactive',
    scope: 'Chases owners, escalates on timer',
    boundedBy: 'Nothing — no financial effect',
    delegation: { requiresDualControl: false, neverActsOn: ['anything with a financial effect'], escalatesWhen: ['owner unresponsive past the chase timer'] },
    supervisor: supervisorFor(1), status: 'live', metrics: buildMetrics('follow-up'),
  },
  {
    number: 2, id: 'master-data', name: 'Master data', process: 'shared', type: 'reactive',
    scope: 'Completes vendor and customer records',
    boundedBy: 'Never bank details. Dual control',
    delegation: { requiresDualControl: true, neverActsOn: ['vendor bank details', 'customer bank details'], escalatesWhen: ['any bank detail change request'] },
    supervisor: supervisorFor(2), status: 'live', metrics: buildMetrics('master-data'),
  },
  {
    number: 3, id: 'commitments', name: 'Commitments', process: 'p2p', type: 'preventive',
    scope: 'Watches delivery dates, chases owners, amends confirmed slippage',
    boundedBy: "Date only. Requires the owner's reply as evidence",
    delegation: { confidenceThreshold: 0.85, requiresDualControl: false, neverActsOn: ['price', 'quantity', 'vendor'], escalatesWhen: ['no owner reply to confirm slippage', 'owner reply below the confidence threshold'] },
    supervisor: supervisorFor(3), status: 'live', metrics: buildMetrics('commitments'),
  },
  {
    number: 4, id: 'buying-compliance', name: 'Buying compliance', process: 'p2p', type: 'preventive', advisoryOnly: true,
    scope: 'Retrospective-PO risk, PO splitting, off-contract spend, terms deviation',
    boundedBy: 'Flags only — never blocks a requisition',
    delegation: { requiresDualControl: false, neverActsOn: ['requisitions', 'purchase orders'], escalatesWhen: [] },
    supervisor: supervisorFor(4), status: 'designed',
  },
  {
    number: 5, id: 'receipt-discipline', name: 'Receipt discipline', process: 'p2p', type: 'preventive', advisoryOnly: true,
    scope: 'GR posting lag by plant and vendor; nudges before the invoice arrives',
    boundedBy: 'Advisory. Cannot post a receipt',
    delegation: { requiresDualControl: false, neverActsOn: ['goods receipts'], escalatesWhen: [] },
    supervisor: supervisorFor(5), status: 'designed',
  },
  {
    number: 6, id: 'contract-price-sync', name: 'Contract price sync', process: 'p2p', type: 'preventive',
    scope: 'Checks PO price against contract at release',
    boundedBy: 'Tolerance band; escalates outside it',
    delegation: { requiresDualControl: false, toleranceBand: 'contract price variance', neverActsOn: ['price amendments'], escalatesWhen: ['variance outside the tolerance band'] },
    supervisor: supervisorFor(6), status: 'designed',
  },
  {
    number: 7, id: 'approval-routing', name: 'Approval routing', process: 'p2p', type: 'reactive',
    scope: 'Reroutes on delegation timeout, auto-approves within DOA',
    boundedBy: 'Value threshold, approver-absent test',
    delegation: { valueCapCr: APPROVAL_CAP, requiresDualControl: false, neverActsOn: ['approvals above the DOA threshold'], escalatesWhen: ['value above the cap', 'approver absent test fails'] },
    supervisor: supervisorFor(7), status: 'live', metrics: buildMetrics('approval-routing'),
  },
  {
    number: 8, id: 'match-resolution', name: 'Match resolution', process: 'p2p', type: 'reactive',
    scope: 'Accepts price and quantity variance inside tolerance',
    boundedBy: 'Tolerance band, contract price precedent',
    delegation: { requiresDualControl: false, toleranceBand: 'price and quantity variance', neverActsOn: ['variance outside the tolerance band'], escalatesWhen: ['no contract price precedent'] },
    supervisor: supervisorFor(8), status: 'live', metrics: buildMetrics('match-resolution'),
  },
  {
    number: 9, id: 'duplicate-adjudication', name: 'Duplicate adjudication', process: 'p2p', type: 'reactive',
    scope: 'Clears false positives',
    boundedBy: 'Must evidence the distinguishing attribute',
    delegation: { requiresDualControl: false, neverActsOn: ['invoices without a distinguishing attribute'], escalatesWhen: ['no evidence of the distinguishing attribute'] },
    supervisor: supervisorFor(9), status: 'live', metrics: buildMetrics('duplicate-adjudication'),
  },
  {
    number: 10, id: 'tax-determination', name: 'Tax determination', process: 'p2p', type: 'reactive',
    scope: 'Resolves tax code, HSN and registration mismatches',
    boundedBy: 'Codified rules only; jurisdiction-aware (§7.26)',
    delegation: { requiresDualControl: false, neverActsOn: ['cases outside codified rules'], escalatesWhen: ['no codified rule for the jurisdiction'] },
    supervisor: supervisorFor(10), status: 'designed',
  },
  {
    number: 11, id: 'provisioning', name: 'Provisioning', process: 'p2p', type: 'reactive',
    scope: 'Posts reversing accruals; SES in a narrow band',
    boundedBy: 'Value cap, recurring-service test, prior-period precedent',
    delegation: { valueCapCr: PROVISIONING_CAP, requiresDualControl: false, neverActsOn: ['Service Entry Sheets outside the narrow band', 'provisions requiring judgment'], escalatesWhen: ['value above the cap', 'no prior-period precedent'] },
    supervisor: supervisorFor(11), status: 'live', metrics: buildMetrics('provisioning'),
  },
  {
    number: 12, id: 'payment-proposal', name: 'Payment proposal', process: 'p2p', type: 'reactive', proposesOnly: true,
    scope: 'Assembles the run — due, discountable, MSMED, critical supply, against balance',
    boundedBy: 'Proposes only. A human releases the run',
    delegation: { requiresDualControl: true, neverActsOn: ['releasing a payment run'], escalatesWhen: [] },
    supervisor: supervisorFor(12), status: 'designed',
  },
  {
    number: 13, id: 'credit-watch', name: 'Credit watch', process: 'o2c', type: 'preventive', advisoryOnly: true,
    scope: 'Flags customers approaching limits before a block occurs',
    boundedBy: 'Advisory. Cannot change a limit',
    delegation: { requiresDualControl: false, neverActsOn: ['credit limits'], escalatesWhen: [] },
    supervisor: supervisorFor(13), status: 'designed',
  },
  {
    number: 14, id: 'billing-readiness', name: 'Billing readiness', process: 'o2c', type: 'preventive', advisoryOnly: true,
    scope: 'Pre-bill validation: PO reference, ship-to, tax registration, contract price',
    boundedBy: 'Flags only; cannot amend an order',
    delegation: { requiresDualControl: false, neverActsOn: ['order amendments'], escalatesWhen: [] },
    supervisor: supervisorFor(14), status: 'designed',
  },
  {
    number: 15, id: 'collections-outreach', name: 'Collections outreach', process: 'o2c', type: 'preventive',
    scope: 'Pre-due reminders sequenced by payment behaviour, then dunning',
    boundedBy: 'Communication only. No settlement authority',
    delegation: { requiresDualControl: false, neverActsOn: ['settlements', 'write-offs'], escalatesWhen: [] },
    supervisor: supervisorFor(15), status: 'designed',
  },
  {
    number: 16, id: 'credit-release', name: 'Credit release', process: 'o2c', type: 'reactive',
    scope: 'Releases policy-defect blocks',
    boundedBy: 'Policy only, never against exposure',
    delegation: { requiresDualControl: false, neverActsOn: ['credit release against exposure'], escalatesWhen: ['block caused by exposure over limit'] },
    supervisor: supervisorFor(16), status: 'live', metrics: buildMetrics('credit-release'),
  },
  {
    number: 17, id: 'cash-application', name: 'Cash application', process: 'o2c', type: 'reactive',
    scope: 'Matches unapplied receipts to open AR',
    boundedBy: 'Match confidence threshold, no write-off',
    delegation: { requiresDualControl: false, neverActsOn: ['write-offs'], escalatesWhen: ['match below the confidence threshold'] },
    supervisor: supervisorFor(17), status: 'live', metrics: buildMetrics('cash-application'),
  },
  {
    number: 18, id: 'deduction-triage', name: 'Deduction triage', process: 'o2c', type: 'reactive',
    scope: 'Categorises deductions, auto-clears below threshold, routes the rest',
    boundedBy: 'Value threshold; disputes always to a human',
    delegation: { valueCapCr: DEDUCTION_CAP, requiresDualControl: false, neverActsOn: ['disputed deductions'], escalatesWhen: ['deduction is disputed'] },
    supervisor: supervisorFor(18), status: 'designed',
  },
];

// Action-log targets are picked from the live datasets at module load so every link in a record opens (§15.2.1:
// "precedent must be readable"). Non-JGL exception ids are seed-dependent, so nothing is hardcoded by id — only by
// reason key and position within that key's rows (JGL's pinned rows come first).
const byReason = (key: string) => exceptions.filter((x) => x.reasonKey === key);

const missingGr = byReason('missing-gr');
const vendorMaster = byReason('vendor-master');
const approvalPending = byReason('approval-pending');
const priceMismatch = byReason('po-price-mismatch');
const duplicateSuspicion = byReason('duplicate-suspicion');

// Existence is guaranteed by the seeded categories in requests.ts (masterData/dispute/query are all in VOLUME);
// a missing row would throw at module load, which the test suite catches immediately.
const bankChangeRequest = requests.find((r) => r.type === 'masterData' && r.category === 'Vendor bank change') ?? requests.find((r) => r.type === 'masterData')!;
const serviceCreditRequest = requests.find((r) => r.type === 'dispute' && r.category === 'Service credit') ?? requests.find((r) => r.type === 'dispute')!;
const balanceEnquiryRequest = requests.find((r) => r.type === 'query' && r.category === 'Balance enquiry') ?? requests.find((r) => r.type === 'query')!;

// Credit-blocked customers are the forecast-driver rows surfaced as customer counterparties (§7.23/§7.24).
const blockedCustomers = counterparties.filter((c) => c.type === 'customer' && c.creditBlocked);

function daysAgo(k: number): string {
  return isoDate(addDays(ANCHOR, -k));
}

// §15.5 — the action logs of the live agents, seeded against the exceptions that already sit in every entity's worklist
// (§15.7: agent activity lives where the work already is). Every entry cites precedents a human can open and evidence
// (§15.2.1); exception-targeted entries carry the §15.1.2 decision record — trigger, checks with thresholds and actuals,
// declined, reversibility. The log is a period record: with no write-back (§15.1), a "resolved" entry does not remove the
// item from the seeded worklist; it drives the row's agent lane instead.
const cr2 = (n: number) => `₹${n.toFixed(2)} cr`;

// A precedent for an exception action: a same-cause sibling on the same entity first, then any same-cause row — never itself.
function causePrecedent(x: Exception): string[] {
  const siblings = exceptions.filter((o) => o.id !== x.id && o.reasonKey === x.reasonKey);
  const sameEntity = siblings.find((o) => o.entityCode === x.entityCode);
  return [sameEntity ? sameEntity.id : siblings[0].id];
}

// A precedent for a request action: another intake of the same type, preferring the same entity.
function priorIntake(r: { id: string; type: string; entityCode: string }): string[] {
  const pool = requests.filter((o) => o.id !== r.id);
  return [(pool.find((o) => o.type === r.type && o.entityCode === r.entityCode) ?? pool.find((o) => o.type === r.type)!).id];
}

// §15.2.1 — the commitments record shows "the reply quoted, the extracted intent, and the confidence in that reading".
function commitmentsConfidence(id: string): number {
  return Math.round((0.86 + mulberry32(fnv1a(`agents:conf:${id}`))() * 0.1) * 100) / 100; // seeded per row, 0.86–0.96
}

function commitmentsEvidence(x: Exception): string[] {
  return [
    'owner reply quoted: “delivery will slip — revised date confirmed”',
    'extracted intent: amend the delivery date only',
    `confidence in that reading: ${commitmentsConfidence(x.id).toFixed(2)}`,
  ];
}

type DecisionRecord = Pick<AgentAction, 'trigger' | 'checks' | 'rationale' | 'declined' | 'reversibility'>;

function followUpRecord(x: Exception, outcome: 'awaiting' | 'escalated' | 'resolved', nudges = 2): DecisionRecord {
  const replied = outcome === 'resolved';
  const nudgeWord = nudges === 1 ? 'one nudge' : `${nudges} nudges`;
  return {
    trigger: `Goods receipt outstanding — invoice blocked for ${x.ageDays} days`,
    checks: [
      { test: 'Financial effect of the action', threshold: 'none — this agent has no financial effect', actual: 'chase and escalation only; nothing posted', pass: true },
      { test: 'Owner response inside the chase window', threshold: 'reply before the chase timer expires', actual: replied ? 'owner reply received' : outcome === 'escalated' ? `${nudgeWord} unanswered — timer expired` : `no reply to ${nudgeWord} so far`, pass: replied },
    ],
    rationale: replied
      ? 'The chase worked — the owner confirmed receipt in writing; posting the GR stays with plant stores, outside this agent.'
      : outcome === 'escalated'
        ? 'Two nudges unanswered; escalation is the agent’s terminal action — it has no financial effect either way.'
        : nudges === 1
          ? 'The owner has not answered the first nudge; the agent keeps chasing until it replies or the escalation fires.'
          : 'GR outstanding past the chase timer; the owner has not answered. The agent keeps chasing until it replies or the escalation fires.',
    declined: 'I did not post a goods receipt on anyone’s behalf — the GR is the plant’s fact, not mine to assert.',
    reversibility: 'A chase changes no record; if the read of the reply was wrong there is nothing posted that needs undoing.',
  };
}

function commitmentsRecord(x: Exception): DecisionRecord {
  return {
    trigger: 'Delivery date on the PO line has slipped',
    checks: [
      { test: 'Owner reply confirming slippage', threshold: 'reply required as evidence — never acts without it', actual: `owner replied; intent extracted (confidence ${commitmentsConfidence(x.id).toFixed(2)})`, pass: true },
      { test: 'Scope of the amendment', threshold: 'date only — never price, quantity or vendor', actual: 'delivery date amended; no other field touched', pass: true },
    ],
    rationale: 'The owner confirmed the slippage in writing; the agent amends the delivery date and waits for the revised GR.',
    declined: 'I did not amend price or quantity — this agent touches a date and nothing else, and it acts only on the owner’s reply.',
    reversibility: 'A date amendment is reversible — the original delivery date stays in the PO history.',
  };
}

function provisioningRecord(x: Exception): DecisionRecord {
  return {
    trigger: 'Service invoice blocked with no goods receipt, inside the pre-close window',
    checks: [
      { test: 'Recurring service', threshold: 'the vendor supplies this service in prior periods too', actual: 'same vendor and service line posted in prior periods', pass: true },
      { test: 'Existing purchase order on file', threshold: 'a released PO covers the invoice', actual: `${x.po} on file, released before booking`, pass: true },
      { test: 'Price within tolerance', threshold: 'invoice price inside the contract variance band', actual: 'invoice price measured inside the band', pass: true },
      { test: 'Prior-period delivery pattern', threshold: 'a matching accrual in a prior period', actual: 'prior-period accrual found for the same vendor and service', pass: true },
      { test: 'Value inside the agent cap', threshold: `≤ ${cr2(PROVISIONING_CAP)} (agent cap)`, actual: cr2(x.amount), pass: x.amount <= PROVISIONING_CAP },
    ],
    rationale: 'The accounting outcome at close is the same either way; an accrual keeps nothing irreversible on the books while the GR question stays open.',
    declined: 'I posted an accrual rather than a Service Entry Sheet because an SES would assert the service was delivered.',
    reversibility: 'The accrual carries a scheduled reversal for the next period — if the read is wrong it unwinds itself.',
  };
}

function matchResolutionRecord(outcome: 'resolved' | 'escalated'): DecisionRecord {
  const hasPrecedent = outcome === 'resolved';
  return {
    trigger: 'Invoice price deviates from the PO rate',
    checks: [
      { test: 'Variance inside the tolerance band', threshold: 'price and quantity variance within the band', actual: 'variance measured inside the band', pass: true },
      { test: 'Contract price precedent on file', threshold: 'a readable contract price for this vendor', actual: hasPrecedent ? 'contract price found and cited' : 'no contract on file for this vendor', pass: hasPrecedent },
    ],
    rationale: hasPrecedent
      ? 'Variance inside the band with a contract price precedent — both bounds of the delegation are met.'
      : 'Inside the band would be enough — but without a readable precedent the agent does not act.',
    declined: hasPrecedent
      ? 'I did not amend the PO rate — I accepted the variance against the contract, and the rate stays as procurement set it.'
      : 'I did not accept the variance on judgement — inside the band is necessary, not sufficient; the precedent must be readable.',
    reversibility: hasPrecedent
      ? 'Accepting a variance posts nothing new; the match decision can be reopened against the same contract line.'
      : 'An escalation posts nothing; it only moves the item up the human chain.',
  };
}

function approvalRoutingRecord(x: Exception, outcome: 'resolved' | 'awaiting' | 'escalated'): DecisionRecord {
  const checks: AgentCheck[] = [
    { test: 'Value inside the auto-approve cap', threshold: `≤ ${cr2(APPROVAL_CAP)} (agent cap)`, actual: cr2(x.amount), pass: x.amount <= APPROVAL_CAP },
  ];
  if (outcome === 'escalated') {
    checks.push({ test: 'Approver-absent test', threshold: 'a delegate holds the band while the primary is absent', actual: 'no delegate holds the band for this value', pass: false });
  } else {
    checks.push({ test: 'Approver-absent test', threshold: 'primary absent past the delegation window, delegate inside DOA', actual: outcome === 'resolved' ? 'test passed — auto-approval authorised' : 'delegate inside the DOA for this band', pass: true });
  }
  return {
    trigger: 'Release held at the approval step',
    checks,
    rationale:
      outcome === 'resolved'
        ? 'Value inside the cap and the approver-absent test passed — auto-approval authorised within DOA · not yet posted.'
        : outcome === 'awaiting'
          ? 'Primary approver absent; the delegate is inside the DOA for this value band. Rerouted on delegation timeout.'
          : 'Inside the cap, but with no delegate to hold the band the approver-absent test fails — the agent proposes nothing and hands it up.',
    declined:
      outcome === 'escalated'
        ? 'I did not auto-approve — inside the cap, but with no delegate to hold the band the approver-absent test fails.'
        : 'I did not raise the value band or pick an approver outside DOA — routing stays inside the delegation matrix.',
    reversibility: outcome === 'resolved'
      ? 'An auto-approval inside DOA can be revoked by the same authority that granted it; if revoked, the approval log keeps both entries.'
      : 'A reroute or escalation posts nothing; it only moves the item along the human chain.',
  };
}

function masterDataRecord(x: Exception): DecisionRecord {
  return {
    trigger: `Vendor master field incomplete — invoice blocked for ${x.ageDays} days`,
    checks: [
      { test: 'Field is not a bank detail', threshold: 'never acts on vendor or customer bank details', actual: 'tax registration field; no bank field in scope', pass: true },
      { test: 'Source evidence on file', threshold: 'a verifiable source for the value written', actual: 'IRN history shows a consistent GSTIN', pass: true },
    ],
    rationale: 'Registration number sourced from the vendor’s e-invoice IRN history; no bank field touched.',
    declined: 'I did not touch any bank field — bank details are the one thing this agent never writes, and they route to dual control instead.',
    reversibility: 'A master-data completion is reversible — the prior value is retained in the change log.',
  };
}

function duplicateRecord(outcome: 'resolved' | 'escalated'): DecisionRecord {
  const evidenced = outcome === 'resolved';
  return {
    trigger: 'Duplicate invoice flag raised by the dedup control',
    checks: [
      { test: 'Distinguishing attribute present', threshold: 'an attribute that separates the two invoices', actual: evidenced ? 'PO line numbers differ across the pair' : 'amount, date and vendor all match', pass: evidenced },
      { test: 'Attribute evidenced in the record', threshold: 'the evidence must be openable, not asserted', actual: evidenced ? 'both PO lines cited from the invoice images' : 'no attribute found to cite', pass: evidenced },
    ],
    rationale: evidenced
      ? 'The two invoices carry different PO line numbers; the suspicion was a same-vendor, same-day coincidence.'
      : 'Without a distinguishing attribute the agent cannot clear it — clearing a true duplicate would pay twice.',
    declined: evidenced
      ? 'I did not void either invoice on the strength of the flag alone — clearance rests only on the differing lines.'
      : 'I did not guess which copy was genuine — with no evidence, escalation is the only safe move.',
    reversibility: evidenced
      ? 'Once posted, clearance returns both invoices to normal processing; either can be re-held if the read was wrong.'
      : 'An escalation posts nothing; it only moves the item up the human chain.',
  };
}

// §15.2.1 — release against policy, never against exposure: the releasable set is codified (a block whose cause is an
// uncleared invoice not yet due), and everything else escalates with the failing check shown in the record.
function creditReleaseRecord(outcome: 'resolved' | 'escalated'): DecisionRecord {
  const releasable = outcome === 'resolved';
  return {
    trigger: 'Credit block on an open customer order',
    checks: [
      { test: 'Cause inside the releasable set', threshold: 'block caused by a policy defect, not by exposure', actual: releasable ? 'block caused by an uncleared invoice that is not yet due' : 'block caused by exposure over the customer limit', pass: releasable },
      { test: 'Policy cited in the record', threshold: 'the action cites the policy it acts under', actual: releasable ? 'policy cited — uncleared invoice, not yet due' : 'policy cited — credit release against exposure is never automated', pass: true },
    ],
    rationale: releasable
      ? 'The block was caused by an uncleared invoice that is not yet due; a policy defect, not a credit judgment.'
      : 'Release against exposure is never the agent’s call — codify the releasable set, escalate everything else.',
    declined: releasable
      ? 'I did not raise the customer’s limit or clear any exposure — I authorised only the release whose cause sits inside the releasable set.'
      : 'I did not release the block against exposure — over-limit is a credit judgment, never the agent’s call.',
    reversibility: releasable
      ? 'A release lifts the block; if the read was wrong it can be re-applied and nothing has been paid or written off.'
      : 'An escalation posts nothing; it only moves the item up the human chain.',
  };
}

const baseActionLog: AgentAction[] = [
  { id: 'follow-up-act1', agentId: 'follow-up', targetType: 'exception', targetId: missingGr[0].id, entityCode: missingGr[0].entityCode, takenAt: daysAgo(2), action: 'Chased plant stores, 2nd nudge', outcome: 'awaiting', precedents: causePrecedent(missingGr[0]), evidence: ['GR not posted against the PO line'], reversible: true, withinDelegation: true, ...followUpRecord(missingGr[0], 'awaiting') },
  { id: 'follow-up-act2', agentId: 'follow-up', targetType: 'exception', targetId: missingGr[1].id, entityCode: missingGr[1].entityCode, takenAt: daysAgo(4), action: 'Escalated to the plant controller after the chase timer expired', outcome: 'escalated', precedents: causePrecedent(missingGr[1]), evidence: ['chase log: 2 nudges, no reply'], reversible: true, withinDelegation: true, ...followUpRecord(missingGr[1], 'escalated') },
  { id: 'follow-up-act3', agentId: 'follow-up', targetType: 'exception', targetId: missingGr[2].id, entityCode: missingGr[2].entityCode, takenAt: daysAgo(6), action: 'Chase closed on the owner’s reply', outcome: 'resolved', precedents: causePrecedent(missingGr[2]), evidence: ['owner reply quoted in the record'], reversible: true, withinDelegation: true, ...followUpRecord(missingGr[2], 'resolved') },
  { id: 'follow-up-act4', agentId: 'follow-up', targetType: 'exception', targetId: missingGr[1].id, entityCode: missingGr[1].entityCode, takenAt: daysAgo(6), action: 'Chased plant stores, 1st nudge', outcome: 'awaiting', precedents: causePrecedent(missingGr[1]), evidence: ['GR not posted against the PO line'], reversible: true, withinDelegation: true, ...followUpRecord(missingGr[1], 'awaiting', 1) },

  { id: 'master-data-act1', agentId: 'master-data', targetType: 'exception', targetId: vendorMaster[0].id, entityCode: vendorMaster[0].entityCode, takenAt: daysAgo(3), action: 'Tax registration sourced · not yet posted', outcome: 'resolved', precedents: causePrecedent(vendorMaster[0]), evidence: ['IRN history shows a consistent GSTIN'], reversible: true, withinDelegation: true, ...masterDataRecord(vendorMaster[0]) },
  { id: 'master-data-act2', agentId: 'master-data', targetType: 'request', targetId: bankChangeRequest.id, entityCode: bankChangeRequest.entityCode, takenAt: daysAgo(1), action: 'Escalated the bank detail change request to dual control', outcome: 'escalated', rationale: 'Bank details are the one field this agent never touches — the first line of what must never be automated. Dual control is the only path.', precedents: priorIntake(bankChangeRequest), evidence: ['request cites a vendor-issued bank mandate'], reversible: true, withinDelegation: true },

  { id: 'approval-routing-act1', agentId: 'approval-routing', targetType: 'exception', targetId: approvalPending[0].id, entityCode: approvalPending[0].entityCode, takenAt: daysAgo(5), action: 'Auto-approved within DOA · not yet posted', outcome: 'resolved', precedents: [approvalPending[1].id], evidence: ['DOA matrix row for this value band'], reversible: true, withinDelegation: true, ...approvalRoutingRecord(approvalPending[0], 'resolved') },
  { id: 'approval-routing-act2', agentId: 'approval-routing', targetType: 'exception', targetId: approvalPending[1].id, entityCode: approvalPending[1].entityCode, takenAt: daysAgo(2), action: 'Rerouted to the delegate on delegation timeout', outcome: 'awaiting', precedents: causePrecedent(approvalPending[1]), evidence: ['delegation log shows the reroute'], reversible: true, withinDelegation: true, ...approvalRoutingRecord(approvalPending[1], 'awaiting') },
  { id: 'approval-routing-act3', agentId: 'approval-routing', targetType: 'exception', targetId: approvalPending[2].id, entityCode: approvalPending[2].entityCode, takenAt: daysAgo(1), action: 'Escalated: approver absent test fails', outcome: 'escalated', precedents: causePrecedent(approvalPending[2]), evidence: ['value vs cap and the delegation matrix shown in the record'], reversible: true, withinDelegation: true, ...approvalRoutingRecord(approvalPending[2], 'escalated') },

  { id: 'match-resolution-act1', agentId: 'match-resolution', targetType: 'exception', targetId: priceMismatch[0].id, entityCode: priceMismatch[0].entityCode, takenAt: daysAgo(3), action: 'Variance accepted within tolerance · not yet posted', outcome: 'resolved', precedents: [priceMismatch[1].id], evidence: ['contract price vs PO price shown in the record'], reversible: true, withinDelegation: true, ...matchResolutionRecord('resolved') },
  { id: 'match-resolution-act2', agentId: 'match-resolution', targetType: 'exception', targetId: priceMismatch[1].id, entityCode: priceMismatch[1].entityCode, takenAt: daysAgo(1), action: 'Escalated: no contract price precedent for the vendor', outcome: 'escalated', precedents: causePrecedent(priceMismatch[1]), evidence: ['no contract on file for this vendor'], reversible: true, withinDelegation: true, ...matchResolutionRecord('escalated') },

  { id: 'duplicate-adjudication-act1', agentId: 'duplicate-adjudication', targetType: 'exception', targetId: duplicateSuspicion[0].id, entityCode: duplicateSuspicion[0].entityCode, takenAt: daysAgo(4), action: 'Clearance authorised · not yet posted', outcome: 'resolved', precedents: causePrecedent(duplicateSuspicion[0]), evidence: ['PO line numbers differ across the two invoices'], reversible: true, withinDelegation: true, ...duplicateRecord('resolved') },
  { id: 'duplicate-adjudication-act2', agentId: 'duplicate-adjudication', targetType: 'exception', targetId: duplicateSuspicion[1].id, entityCode: duplicateSuspicion[1].entityCode, takenAt: daysAgo(0), action: 'Escalated: no evidence of a distinguishing attribute', outcome: 'escalated', precedents: causePrecedent(duplicateSuspicion[1]), evidence: ['matched fields listed in the record'], reversible: true, withinDelegation: true, ...duplicateRecord('escalated') },

  { id: 'provisioning-act1', agentId: 'provisioning', targetType: 'request', targetId: serviceCreditRequest.id, entityCode: serviceCreditRequest.entityCode, takenAt: daysAgo(2), action: 'Posted a reversing accrual rather than a Service Entry Sheet', outcome: 'resolved', rationale: 'An SES would assert the service was delivered; the accounting outcome at close is the same and nothing irreversible happens.', precedents: priorIntake(serviceCreditRequest), evidence: ['accrual posted with reversal scheduled for the next period'], reversible: true, withinDelegation: true },

  { id: 'cash-application-act1', agentId: 'cash-application', targetType: 'request', targetId: balanceEnquiryRequest.id, entityCode: balanceEnquiryRequest.entityCode, takenAt: daysAgo(1), action: 'Matched an unapplied receipt to open AR before the balance was stated', outcome: 'resolved', rationale: 'Above the match confidence threshold; matching changes no balance — it only states one correctly.', precedents: priorIntake(balanceEnquiryRequest), evidence: ['match score and matched fields in the record'], reversible: true, withinDelegation: true },

  { id: 'credit-release-act1', agentId: 'credit-release', targetType: 'creditBlock', targetId: blockedCustomers[0].id, entityCode: blockedCustomers[0].entityCode, takenAt: daysAgo(3), action: 'Release approved · not yet posted', outcome: 'resolved', precedents: [blockedCustomers[1].id], evidence: ['invoice due date after the block date'], reversible: true, withinDelegation: true, ...creditReleaseRecord('resolved') },
  { id: 'credit-release-act2', agentId: 'credit-release', targetType: 'creditBlock', targetId: blockedCustomers[1].id, entityCode: blockedCustomers[1].entityCode, takenAt: daysAgo(0), action: 'Escalated: block caused by exposure over limit', outcome: 'escalated', precedents: [blockedCustomers[0].id], evidence: ['exposure vs limit shown in the record'], reversible: true, withinDelegation: true, ...creditReleaseRecord('escalated') },
];

// §15.7 — the seven P2P-domain live agents have already run on every entity's exceptions when the page opens (§15.1.1).
// JGL's pinned rows get two additions (provisioning supersedes follow-up's escalation on the oldest GR row; commitments
// amends a confirmed slippage); the other five entities follow one deterministic pattern per cause, so all four lane
// states of §15.1.1 appear in every worklist without a hardcoded id anywhere.
const SEED_ORDER = ['JBL', 'JPS', 'JCP', 'JHS', 'JRP'];

function seededExceptionActions(): AgentAction[] {
  const counters: Record<string, number> = {
    'follow-up': 4, 'master-data': 2, commitments: 0, 'approval-routing': 3,
    'match-resolution': 2, 'duplicate-adjudication': 2, provisioning: 1,
  };
  const out: AgentAction[] = [];
  const push = (a: Omit<AgentAction, 'id' | 'reversible' | 'withinDelegation'>) => {
    counters[a.agentId] += 1;
    out.push({ ...a, id: `${a.agentId}-act${counters[a.agentId]}`, reversible: true, withinDelegation: true });
  };

  push({ agentId: 'provisioning', targetType: 'exception', targetId: missingGr[1].id, entityCode: missingGr[1].entityCode, takenAt: daysAgo(1), action: 'Posted a reversing accrual rather than a Service Entry Sheet', outcome: 'resolved', precedents: causePrecedent(missingGr[1]), evidence: ['accrual posted with reversal scheduled for the next period'], ...provisioningRecord(missingGr[1]) });
  push({ agentId: 'commitments', targetType: 'exception', targetId: missingGr[3].id, entityCode: missingGr[3].entityCode, takenAt: daysAgo(2), action: 'Amended the PO delivery date after the owner confirmed slippage', outcome: 'awaiting', precedents: causePrecedent(missingGr[3]), evidence: commitmentsEvidence(missingGr[3]), ...commitmentsRecord(missingGr[3]) });

  SEED_ORDER.forEach((code, e) => {
    const rows = (key: string) => exceptions.filter((x) => x.entityCode === code && x.reasonKey === key);
    const mg = rows('missing-gr');
    push({ agentId: 'provisioning', targetType: 'exception', targetId: mg[0].id, entityCode: code, takenAt: daysAgo(1 + (e % 3)), action: 'Posted a reversing accrual rather than a Service Entry Sheet', outcome: 'resolved', precedents: causePrecedent(mg[0]), evidence: ['accrual posted with reversal scheduled for the next period'], ...provisioningRecord(mg[0]) });
    push({ agentId: 'follow-up', targetType: 'exception', targetId: mg[1].id, entityCode: code, takenAt: daysAgo(2 + (e % 3)), action: 'Chased plant stores, 2nd nudge', outcome: 'awaiting', precedents: causePrecedent(mg[1]), evidence: ['GR not posted against the PO line'], ...followUpRecord(mg[1], 'awaiting') });
    push({ agentId: 'follow-up', targetType: 'exception', targetId: mg[2].id, entityCode: code, takenAt: daysAgo(3 + (e % 3)), action: 'Chase closed on the owner’s reply', outcome: 'resolved', precedents: causePrecedent(mg[2]), evidence: ['owner reply quoted in the record'], ...followUpRecord(mg[2], 'resolved') });
    push({ agentId: 'commitments', targetType: 'exception', targetId: mg[3].id, entityCode: code, takenAt: daysAgo(1 + ((e + 1) % 3)), action: 'Amended the PO delivery date after the owner confirmed slippage', outcome: 'awaiting', precedents: causePrecedent(mg[3]), evidence: commitmentsEvidence(mg[3]), ...commitmentsRecord(mg[3]) });

    const pp = rows('po-price-mismatch');
    push({ agentId: 'match-resolution', targetType: 'exception', targetId: pp[0].id, entityCode: code, takenAt: daysAgo(2 + (e % 3)), action: 'Variance accepted within tolerance · not yet posted', outcome: 'resolved', precedents: causePrecedent(pp[0]), evidence: ['contract price vs PO price shown in the record'], ...matchResolutionRecord('resolved') });
    push({ agentId: 'match-resolution', targetType: 'exception', targetId: pp[1].id, entityCode: code, takenAt: daysAgo(e % 3), action: 'Escalated: no contract price precedent for the vendor', outcome: 'escalated', precedents: causePrecedent(pp[1]), evidence: ['no contract on file for this vendor'], ...matchResolutionRecord('escalated') });
    push({ agentId: 'match-resolution', targetType: 'exception', targetId: pp[2].id, entityCode: code, takenAt: daysAgo(3 + ((e + 1) % 3)), action: 'Variance accepted within tolerance · not yet posted', outcome: 'resolved', precedents: causePrecedent(pp[2]), evidence: ['contract price vs PO price shown in the record'], ...matchResolutionRecord('resolved') });

    const ap = rows('approval-pending');
    if (code !== 'JBL') {
      push({ agentId: 'approval-routing', targetType: 'exception', targetId: ap[0].id, entityCode: code, takenAt: daysAgo(2 + ((e + 2) % 3)), action: 'Auto-approved within DOA · not yet posted', outcome: 'resolved', precedents: causePrecedent(ap[0]), evidence: ['DOA matrix row for this value band'], ...approvalRoutingRecord(ap[0], 'resolved') });
    }
    push({ agentId: 'approval-routing', targetType: 'exception', targetId: ap[1].id, entityCode: code, takenAt: daysAgo(1 + ((e + 2) % 3)), action: 'Auto-approved within DOA · not yet posted', outcome: 'resolved', precedents: causePrecedent(ap[1]), evidence: ['DOA matrix row for this value band'], ...approvalRoutingRecord(ap[1], 'resolved') });

    const vm = rows('vendor-master');
    push({ agentId: 'master-data', targetType: 'exception', targetId: vm[0].id, entityCode: code, takenAt: daysAgo(2 + (e % 2)), action: 'Tax registration sourced · not yet posted', outcome: 'resolved', precedents: causePrecedent(vm[0]), evidence: ['IRN history shows a consistent GSTIN'], ...masterDataRecord(vm[0]) });

    if (code !== 'JBL') {
      const dup = rows('duplicate-suspicion');
      push({ agentId: 'duplicate-adjudication', targetType: 'exception', targetId: dup[0].id, entityCode: code, takenAt: daysAgo(3 + (e % 2)), action: 'Clearance authorised · not yet posted', outcome: 'resolved', precedents: causePrecedent(dup[0]), evidence: ['PO line numbers differ across the two invoices'], ...duplicateRecord('resolved') });
    }
  });

  return out;
}

export const agentActionLog: AgentAction[] = [...baseActionLog, ...seededExceptionActions()];

// §15.8 — vendor bank detail changes are never automated; the row that carries it is JGL's lower-value vendor-master
// exception (byReason order pins it). No other row in this dataset touches a bank field, so no id list is needed.
const BANK_DETAIL_ID = vendorMaster[1].id;

function actionsFor(x: Exception): AgentAction[] {
  return agentActionLog.filter((a) => a.targetType === 'exception' && a.targetId === x.id);
}

// §15.7 — the worklist's per-row agent lane, derived at read time from the action log (never stored per row). Four
// states per §15.1.1: working (with its next escalation timer), escalated (with the reason), resolved (what it did),
// never-automated (§15.8, or no live agent for the cause in this build).
export function laneForException(x: Exception): AgentLane {
  if (x.id === BANK_DETAIL_ID) return { state: 'never-automated', detail: 'Vendor bank detail change — never automated (§15.8)' };
  const acts = actionsFor(x);
  if (acts.length === 0) return { state: 'never-automated', detail: 'No live agent for this cause in this build' };
  const latest = acts.reduce((a, b) => (b.takenAt >= a.takenAt ? b : a));
  if (cycleResolvedIds.has(x.id)) return { state: 'resolved', agentId: latest.agentId, detail: `Cleared in the last cycle — ${latest.action}` };
  switch (latest.outcome) {
    case 'awaiting':
      // The timer is the item's own — older items escalate sooner, so no two lanes read alike.
      return { state: 'working', agentId: latest.agentId, detail: `escalates in ${escalationHours(x.ageDays)} h` };
    case 'escalated':
      return { state: 'escalated', agentId: latest.agentId, detail: latest.action.replace(/^Escalated:\s*/, '') };
    default:
      return { state: 'resolved', agentId: latest.agentId, detail: latest.action };
  }
}

// §15.1.2 — the decision record an exception's detail page carries: its most recent agent action plus that agent.
export function decisionRecordFor(exceptionId: string): { action: AgentAction; agent: Agent } | undefined {
  const acts = agentActionLog.filter((a) => a.targetType === 'exception' && a.targetId === exceptionId);
  if (acts.length === 0) return undefined;
  const latest = acts.reduce((a, b) => (b.takenAt >= a.takenAt ? b : a));
  const agent = agents.find((g) => g.id === latest.agentId)!;
  return { action: latest, agent };
}

// Step 22 — the O2C beat: a customer's credit-block decision record, same shape as decisionRecordFor but for blocks.
export function creditBlockDecisionFor(customerId: string): { action: AgentAction; agent: Agent } | undefined {
  const acts = agentActionLog.filter((a) => a.targetType === 'creditBlock' && a.targetId === customerId);
  if (acts.length === 0) return undefined;
  const latest = acts.reduce((a, b) => (b.takenAt >= a.takenAt ? b : a));
  const agent = agents.find((g) => g.id === latest.agentId)!;
  return { action: latest, agent };
}

// §7.21 — display labels for seeded timestamps; manual parse keeps the date local (no UTC drift from new Date(iso)).
function isoLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return fmtDate(new Date(y, m - 1, d));
}

// Step 22 — the demo beat as steps: one missing-GR exception resolved without a human. Only the row that carries the
// full arc (nudge → escalation → reversing accrual) gets it; every other row returns undefined.
export function exceptionWalkthrough(x: Exception): WalkthroughStep[] | undefined {
  if (x.reasonKey !== 'missing-gr') return undefined;
  const acts = actionsFor(x);
  const nudge = acts.find((a) => a.agentId === 'follow-up' && a.outcome === 'awaiting');
  const escalation = acts.find((a) => a.agentId === 'follow-up' && a.outcome === 'escalated');
  const provisioned = acts.find((a) => a.agentId === 'provisioning' && a.outcome === 'resolved');
  if (!nudge || !escalation || !provisioned) return undefined;
  const timeline = seededTimeline(x);
  return [
    { title: 'Exception raised', events: [{ dateLabel: timeline[1].dateLabel, actor: 'system', text: timeline[1].text }, { dateLabel: timeline[2].dateLabel, actor: 'system', text: timeline[2].text }] },
    { title: 'Follow-up chases plant stores', events: [{ dateLabel: isoLabel(nudge.takenAt), actor: 'agent', text: nudge.action }] },
    { title: 'No response at 48 hours', events: [{ dateLabel: isoLabel(escalation.takenAt), actor: 'agent', text: escalation.action }] },
    { title: 'The pre-close window opens', events: [{ actor: 'system', text: 'Pre-close readiness — 3 days to close' }] },
    { title: 'Provisioning tests the case', caption: (provisioned.checks ?? []).map((c) => c.test).join('; ') },
    { title: 'A reversing accrual is posted', events: [{ dateLabel: isoLabel(provisioned.takenAt), actor: 'agent', text: provisioned.action }] },
    { title: 'Logged for audit', caption: `Flagged agent-posted for audit sampling. Accrual exposure falls ${cr2(x.amount)}.` },
    { title: 'Supervision', supervision: true },
  ];
}

// §15.1.1 — 'run the next cycle' is the one permitted trigger and it is explicitly a demo control: one-shot per session,
// so the header's drop (86 → 79 on JGL) happens once and the lanes update with it. Session-local like actions.ts; no write-back.
const cycleRan = new Set<string>();
const cycleResolvedIds = new Set<string>();
const overriddenDecisions = new Set<string>();

// The shares are chosen so JGL reproduces the spec's pinned header exactly — 327 blocked · 241 resolved by agents · 86 need you,
// one cycle taking 86 to 79; other entities scale off their own §7.17 pools.
const NEED_YOU_SHARE = 0.263; // round(327 × 0.263) = 86
const CYCLE_DROP_SHARE = 0.08; // round(86 × 0.08) = 7 → 86 − 7 = 79

export function worklistAgentCounts(entityCode: string): WorklistAgentCounts {
  const pool = entities.find((e) => e.code === entityCode)?.metrics.apBlockedCount ?? 0;
  const baseNeedYou = Math.round(pool * NEED_YOU_SHARE);
  const drop = cycleRan.has(entityCode) ? Math.round(baseNeedYou * CYCLE_DROP_SHARE) : 0;
  const needYou = Math.max(0, baseNeedYou - drop);
  return { pool, cleared: pool - needYou, needYou };
}

export function runNextAgentCycle(entityCode: string): void {
  if (cycleRan.has(entityCode)) return; // one-shot per session
  cycleRan.add(entityCode);
  const pool = entities.find((e) => e.code === entityCode)?.metrics.apBlockedCount ?? 0;
  const drop = Math.round(Math.round(pool * NEED_YOU_SHARE) * CYCLE_DROP_SHARE);
  // The visible rows are a sample of the pool: flip up to `drop` working lanes, highest value first.
  const working = exceptions
    .filter((x) => x.entityCode === entityCode && laneForException(x).state === 'working')
    .sort((a, b) => b.amount - a.amount);
  for (const x of working.slice(0, drop)) cycleResolvedIds.add(x.id);
}

// The demo cycle button stays disabled after its one press even across navigation, because the store is the source of truth.
export function agentCycleRan(entityCode: string): boolean {
  return cycleRan.has(entityCode)
}

// §15.1.2 — the override control is the human's exit; it feeds the agent's override rate (§15.6).
export function overrideDecision(actionId: string): void {
  overriddenDecisions.add(actionId);
}

export function decisionOverridden(actionId: string): boolean {
  return overriddenDecisions.has(actionId);
}

// §15.6 — session overrides per agent; the API layer adds this to the stored count when computing the override rate.
export function sessionOverrideCount(agentId: string): number {
  return agentActionLog.filter((a) => a.agentId === agentId && overriddenDecisions.has(a.id)).length;
}

export function resetAgentLaneStore(): void {
  cycleRan.clear();
  cycleResolvedIds.clear();
  overriddenDecisions.clear();
}

// §15.2.0 — the lifecycle coverage strip, derived from §15.2's stage column (the spec's ASCII leaves the O2C
// alignment ambiguous; the tables are authoritative). DLV and DSP carry no agent — visible gaps a client reads in
// three seconds. "+ 1, 2 across all" is rendered as a legend by the screen, not stored per stage.
export const COVERAGE_STRIP: CoverageStrip = {
  p2p: [
    { code: 'PR', agents: ['buying-compliance'] },
    { code: 'PO', agents: ['commitments', 'buying-compliance', 'contract-price-sync'] },
    { code: 'GR', agents: ['receipt-discipline'] },
    { code: 'INV', agents: ['duplicate-adjudication', 'tax-determination'], preClose: ['provisioning'] },
    { code: 'MTC', agents: ['match-resolution'] },
    { code: 'APR', agents: ['approval-routing'] },
    { code: 'PAY', agents: ['payment-proposal'] },
  ],
  o2c: [
    { code: 'ORD', agents: ['billing-readiness'] },
    { code: 'CRD', agents: ['credit-watch', 'credit-release'] },
    { code: 'DLV', agents: [] },
    { code: 'BIL', agents: ['billing-readiness'] },
    { code: 'DSP', agents: [] },
    { code: 'COL', agents: ['collections-outreach', 'deduction-triage'] },
    { code: 'CSH', agents: ['cash-application'] },
  ],
};
