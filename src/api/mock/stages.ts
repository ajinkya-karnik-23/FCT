import type { ProcessStage } from '../types';
import { entities } from './entities';

// spec/03 — P2P stages (7); spec/08 — O2C stages (7). §7.4 — items IN FLIGHT per stage;
// exception % is derived at render time via stageExceptionPct(), never stored.
// §16.2 — R2R stages (8): SUB → ACC → REC → ICO → JRN → TB → PCK → SGN. Its table carries counts only, so
// rupee values appear where the spec pins them (§7.2 recon exposure / high-risk JEs, §8.2 accrual and
// intercompany exposure) and nowhere else.
// §7.25 — the base table below is JGL's. Every other entity scales it, then pins its own tie points, so each
// cockpit agrees with its own entity metrics instead of rendering JGL's figures on every entity.

const BASE: ProcessStage[] = [
  { processKey: 'p2p', step: 'PR', name: 'Requisition', inFlight: 412, inFlightValue: 62.1, inException: 16, exceptionValue: 2.4, status: 'GREEN' },
  { processKey: 'p2p', step: 'PO', name: 'Purchase order', inFlight: 386, inFlightValue: 58.4, inException: 23, exceptionValue: 3.5, status: 'GREEN' },
  { processKey: 'p2p', step: 'GR', name: 'Goods receipt', inFlight: 349, inFlightValue: 51.2, inException: 66, exceptionValue: 9.7, status: 'RED' },
  { processKey: 'p2p', step: 'INV', name: 'Invoice', inFlight: 1258, inFlightValue: 71.5, inException: 327, exceptionValue: 18.6, status: 'RED' },
  { processKey: 'p2p', step: 'MTC', name: 'Three-way match', inFlight: 241, inFlightValue: 14.2, inException: 53, exceptionValue: 3.1, status: 'AMBER' },
  { processKey: 'p2p', step: 'APR', name: 'Approval', inFlight: 178, inFlightValue: 8.9, inException: 21, exceptionValue: 1.1, status: 'AMBER' },
  { processKey: 'p2p', step: 'PAY', name: 'Payment', inFlight: 96, inFlightValue: 6.1, inException: 3, exceptionValue: 0.2, status: 'GREEN' },
  // spec/08 Part B — O2C stage flow.
  { processKey: 'o2c', step: 'ORD', name: 'Order', inFlight: 508, inFlightValue: 71.4, inException: 15, exceptionValue: 2.1, status: 'GREEN' },
  { processKey: 'o2c', step: 'CRD', name: 'Credit check', inFlight: 486, inFlightValue: 68.9, inException: 39, exceptionValue: 5.5, status: 'AMBER' },
  { processKey: 'o2c', step: 'DLV', name: 'Delivery', inFlight: 461, inFlightValue: 64.2, inException: 28, exceptionValue: 3.9, status: 'GREEN' },
  { processKey: 'o2c', step: 'BIL', name: 'Billing', inFlight: 437, inFlightValue: 61.8, inException: 61, exceptionValue: 8.7, status: 'AMBER' },
  { processKey: 'o2c', step: 'DSP', name: 'Invoice dispatch', inFlight: 421, inFlightValue: 59.6, inException: 38, exceptionValue: 5.4, status: 'AMBER' },
  { processKey: 'o2c', step: 'COL', name: 'Collection', inFlight: 1183, inFlightValue: 56.3, inException: 284, exceptionValue: 28.4, status: 'RED' },
  { processKey: 'o2c', step: 'CSH', name: 'Cash application', inFlight: 196, inFlightValue: 19.7, inException: 41, exceptionValue: 3.1, status: 'RED' },
  // §16.2 — R2R stage flow (JGL base). Counts only; the rupee tie points are pinned per entity below.
  { processKey: 'r2r', step: 'SUB', name: 'Sub-ledger close', inFlight: 96, inException: 14, status: 'AMBER' },
  { processKey: 'r2r', step: 'ACC', name: 'Accruals & provisions', inFlight: 48, inException: 12, status: 'RED' },
  { processKey: 'r2r', step: 'REC', name: 'Reconciliations', inFlight: 176, inException: 18, status: 'AMBER' },
  { processKey: 'r2r', step: 'ICO', name: 'Intercompany', inFlight: 64, inException: 13, status: 'RED' },
  { processKey: 'r2r', step: 'JRN', name: 'Adjusting journals', inFlight: 847, inException: 12, status: 'GREEN' },
  { processKey: 'r2r', step: 'TB', name: 'Trial balance', inFlight: 340, inException: 17, status: 'GREEN' },
  { processKey: 'r2r', step: 'PCK', name: 'Reporting pack', inFlight: 52, inException: 8, status: 'AMBER' },
  { processKey: 'r2r', step: 'SGN', name: 'Sign-off', inFlight: 64, inException: 13, status: 'AMBER' },
];

// §7.25 — pinned in-flight values per entity (PO ties to Σ cost-centre committed; collection to total open AR).
const PO_IN_FLIGHT_CR: Record<string, number> = { JGL: 58.4, JBL: 35.5, JPS: 21.4, JCP: 6.6, JHS: 13.2, JRP: 46.2 };
const COLLECTION_IN_FLIGHT_CR: Record<string, number> = { JGL: 56.3, JBL: 40.4, JPS: 23.2, JCP: 8.6, JHS: 17.3, JRP: 48.1 };
// §16.5 — the journal population per entity; high-risk counts tie to §7.2's highRiskJEs (asserted in tests).
const R2R_JOURNAL_POP: Record<string, number> = { JGL: 847, JBL: 692, JPS: 418, JCP: 264, JHS: 391, JRP: 913 };
// §18.1 — the requisition pipeline per entity, pinned so the P2P stage cards and the requisition screen (which derives
// unconverted = PR − PO) can never disagree; the spec asserts both ties to these counts.
const REQUISITION_PIPELINE: Record<string, { pr: number; po: number }> = {
  JGL: { pr: 412, po: 386 },
  JBL: { pr: 358, po: 335 },
  JPS: { pr: 196, po: 184 },
  JCP: { pr: 142, po: 133 },
  JHS: { pr: 224, po: 210 },
  JRP: { pr: 441, po: 413 },
};

const round1 = (x: number) => Math.round(x * 10) / 10;

export function stagesFor(entityCode: string): ProcessStage[] {
  const e = entities.find((x) => x.code === entityCode) ?? entities[0];
  // §7.25 — PO in-flight scales with blocked AP; collection in-flight with AR over 90 days. JGL's ratio is 1, so its
  // table stays byte-identical to the §7.4 base and every existing JGL pin holds unchanged. R2R scales with recon
  // exposure — the close gets bigger where more balance sheet needs reconciling.
  const p2pScale = e.metrics.apBlocked.current / 18.6;
  const o2cScale = e.metrics.arOver90.current / 12.4;
  const r2rScale = e.metrics.reconValue.current / 14.3;
  return BASE.map((s) => {
    const scale = s.processKey === 'p2p' ? p2pScale : s.processKey === 'o2c' ? o2cScale : r2rScale;
    return { ...s, inFlight: Math.round(s.inFlight * scale), inFlightValue: s.inFlightValue != null ? round1(s.inFlightValue * scale) : undefined, inException: Math.round(s.inException * scale), exceptionValue: s.exceptionValue != null ? round1(s.exceptionValue * scale) : undefined };
  }).map((s) => {
    // §7.25 — pinned tie points override the scaled values so each cockpit agrees with its entity metrics.
    const pipe = REQUISITION_PIPELINE[e.code];
    if (s.processKey === 'p2p' && s.step === 'PR') return { ...s, inFlight: pipe.pr }; // §18.1
    if (s.processKey === 'p2p' && s.step === 'PO') return { ...s, inFlight: pipe.po, inFlightValue: PO_IN_FLIGHT_CR[e.code] }; // §18.1 + §7.25
    if (s.processKey === 'p2p' && s.step === 'INV') return { ...s, inException: e.metrics.apBlockedCount, exceptionValue: e.metrics.apBlocked.current };
    if (s.processKey === 'o2c' && s.step === 'COL') return { ...s, inException: e.metrics.o2cExceptionCount, inFlightValue: COLLECTION_IN_FLIGHT_CR[e.code] };
    if (s.processKey === 'o2c' && s.step === 'CSH') return { ...s, exceptionValue: e.metrics.cashUnapplied.current };
    // §16.2/§7.2 — R2R tie points: breaks and their value to the recon metrics, journals to the §16.5 population
    // with high-risk counts from §7.2, accruals and intercompany to the §8.2 exposures.
    if (s.processKey === 'r2r' && s.step === 'REC') return { ...s, inException: e.metrics.reconAgedBreaks, exceptionValue: e.metrics.reconValue.current };
    if (s.processKey === 'r2r' && s.step === 'JRN') return { ...s, inFlight: R2R_JOURNAL_POP[e.code], inException: e.metrics.highRiskJEs };
    if (s.processKey === 'r2r' && s.step === 'ACC' && e.metrics.accrualExposure != null) return { ...s, exceptionValue: e.metrics.accrualExposure };
    if (s.processKey === 'r2r' && s.step === 'ICO' && e.metrics.fxIntercompanyExposure != null) return { ...s, exceptionValue: e.metrics.fxIntercompanyExposure };
    return s;
  });
}

export const stages: ProcessStage[] = stagesFor('JGL');
