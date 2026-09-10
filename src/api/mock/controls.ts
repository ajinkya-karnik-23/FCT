import type { ApControlEffectiveness, ControlSignal } from '../types';
import { ANCHOR, addDays, fmtDate } from './exceptions';

// spec/07 §7.8 — Risk & control signals: eight rows across the five categories, titles and values pinned verbatim in
// the spec table. Detection dates derive as today − N days (§7.21) so they stay inside a recent window whenever the
// prototype opens; the N values preserve the original Jul/Aug 2026 spread (newest first). JRP carries the unauthorised
// bank change that triggers its veto (§7.10); the two system-category rows have no quantifiable value.

export const controlSignals: ControlSignal[] = [
  {
    id: 'cs-bank-change',
    category: 'payment',
    title: 'Vendor bank detail changed 3 days before payment run',
    detail: 'The change bypassed the vendor-master approval step and lands ahead of the scheduled payment run.',
    severity: 'High',
    valueAtRiskCr: 2.4,
    entityCode: 'JRP',
    detectedOn: fmtDate(addDays(ANCHOR, -12)),
  },
  {
    id: 'cs-first-payee',
    category: 'payment',
    title: 'First-time payee above ₹50 lakh threshold',
    detail: 'A first-time payee cleared for payment before onboarding verification completed.',
    severity: 'Medium',
    valueAtRiskCr: 0.8,
    entityCode: 'JGL',
    detectedOn: fmtDate(addDays(ANCHOR, -21)),
  },
  {
    id: 'cs-po-split',
    category: 'authority',
    title: 'PO split into 3 below approval threshold',
    detail: 'Each part clears on its own authority level; the combined value does not.',
    severity: 'High',
    valueAtRiskCr: 1.9,
    entityCode: 'JBL',
    detectedOn: fmtDate(addDays(ANCHOR, -34)),
  },
  {
    id: 'cs-retro-po',
    category: 'authority',
    title: 'Retrospective PO — dated after invoice',
    detail: 'The purchase order was created after the invoice it covers, reversing the required sequence.',
    severity: 'Medium',
    valueAtRiskCr: 0.6,
    entityCode: 'JGL',
    detectedOn: fmtDate(addDays(ANCHOR, -46)),
  },
  {
    id: 'cs-sod-conflict',
    category: 'system',
    title: 'SoD conflict: same user creates vendor and releases payment',
    detail: 'One user id can create a vendor master record and release its first payment.',
    severity: 'High',
    entityCode: 'JBL',
    detectedOn: fmtDate(addDays(ANCHOR, -28)),
  },
  {
    id: 'cs-terms-change',
    category: 'system',
    title: 'Payment terms changed on 7 vendors without approval',
    detail: 'Terms were edited outside the change-approval workflow.',
    severity: 'Medium',
    entityCode: 'JRP',
    detectedOn: fmtDate(addDays(ANCHOR, -40)),
  },
  {
    id: 'cs-cutoff-grs',
    category: 'cutoff',
    title: '14 goods receipts posted across period end',
    detail: 'Receipts landed on both sides of the cut-off and shift expense between periods.',
    severity: 'High',
    valueAtRiskCr: 3.1,
    entityCode: 'JGL',
    detectedOn: fmtDate(addDays(ANCHOR, -30)),
  },
  {
    id: 'cs-grni-ageing',
    category: 'exposure',
    title: 'Goods received not invoiced, ageing beyond 90 days',
    detail: 'Received goods without a matching invoice; the related liability is not in the recorded AP balance.',
    severity: 'High',
    valueAtRiskCr: 5.2,
    entityCode: 'JRP',
    detectedOn: fmtDate(addDays(ANCHOR, -25)),
  },
];

// §7.8.1 — pinned counts behind the effectiveness metrics (41/2, 67/5, ₹23.4 cr prevented YTD); rates are computed
// from the counts in index.ts, never stored. The prevented figure carries into the benefits case and must not move.
export const apEffectiveness: ApControlEffectiveness = {
  duplicate: { flaggedYtd: 41, overriddenYtd: 2 },
  threeWayMatch: { failedYtd: 67, overriddenYtd: 5 },
  valuePreventedYtdCr: 23.4,
};
