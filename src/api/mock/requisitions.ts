// §18 — the requisition pipeline: unconverted PRs per entity. The row count derives from the pinned §7.4 stage counts
// (PR − PO), so this module can never disagree with the P2P cockpit's stage cards or the commitments watch. Each row
// carries one cause from the PR-stage set (§18.1, verbatim — distinct from §6.1, which describes exceptions downstream)
// with an age and an owner; values are allocated at read time in index.ts so Σ rows ties to
// PR.inFlightValue − PO.inFlightValue. Seeded deterministically on stable keys (mulberry32(fnv1a(...)), mirroring
// mock/agents.ts) — no Math.random().

import type { PrCause, PrChaseState, PrCauseKey } from '../types';
import { entities, fnv1a, mulberry32 } from './entities';
import { requestOwnerPool } from './requests';
import { stagesFor } from './stages';

// §18.1 — the PR-stage cause set, verbatim.
export const PR_CAUSES: PrCause[] = [
  { key: 'budget', name: 'Budget', detail: 'no budget availability at the cost centre' },
  { key: 'approval', name: 'Approval', detail: 'sitting with a requisition approver' },
  { key: 'completeness', name: 'Completeness', detail: 'missing cost centre, GL account or delivery date' },
  { key: 'sourcing', name: 'Sourcing', detail: 'no vendor determined, or no contract reference' },
  { key: 'catalogue', name: 'Catalogue', detail: 'free-text for something under contract' },
  { key: 'duplicate', name: 'Duplicate', detail: 'another PR covers the same need' },
];

const CAUSE_ORDER: PrCauseKey[] = ['budget', 'approval', 'completeness', 'sourcing', 'catalogue', 'duplicate'];

export interface RawRequisitionRow {
  id: string; // 'JGL-PR-001'
  causeKey: PrCauseKey;
  ageDays: number;
  owner: string;
  weight: number; // value-allocation input — consumed at read time, not part of the public row shape
  chaseState: PrChaseState;
}

function buildRows(entityCode: string, n: number): RawRequisitionRow[] {
  const rand = mulberry32(fnv1a(`requisitions:${entityCode}`));
  const pool = requestOwnerPool(entityCode);
  // Rotate the per-entity offset so entities do not all open on the same cause.
  const offset = fnv1a(entityCode) % CAUSE_ORDER.length;
  return Array.from({ length: n }, (_, i) => {
    // The first six rows cover the whole cause set, the rest are seeded picks — every entity with a pool of six or
    // more shows all six causes.
    const causeKey = i < 6 ? CAUSE_ORDER[(i + offset) % 6] : CAUSE_ORDER[Math.floor(rand() * 6)];
    const ageDays = 2 + Math.floor(rand() * 40); // 2–41 days unconverted
    const chaseState: PrChaseState = ageDays < 7 ? 'waiting' : ageDays < 21 ? (rand() < 0.5 ? 'waiting' : 'chased') : rand() < 0.6 ? 'chased' : 'escalated';
    return { id: `${entityCode}-PR-${String(i + 1).padStart(3, '0')}`, causeKey, ageDays, owner: pool[i % pool.length], weight: 0.5 + rand(), chaseState };
  });
}

export const rawRequisitionRows: Record<string, RawRequisitionRow[]> = Object.fromEntries(
  entities.map((e) => {
    const stages = stagesFor(e.code);
    const pr = stages.find((s) => s.processKey === 'p2p' && s.step === 'PR')!;
    const po = stages.find((s) => s.processKey === 'p2p' && s.step === 'PO')!;
    return [e.code, buildRows(e.code, pr.inFlight - po.inFlight)];
  }),
);
