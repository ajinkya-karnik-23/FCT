import type { CauseBacklogRow } from '../types';
import { ANCHOR, addDays, isoDate } from './exceptions';

// §7.30 — the cause elimination backlog register: thirty-four identified causes across the six entities, one row
// per entity-level cause (the group taxonomy holds twelve nodes; the same cause can be open at several entities).
// Per-entity tallies are pinned by §7.18 — JGL 8 · JBL 7 · JPS 5 · JCP 3 · JHS 4 · JRP 7, i.e. 34 identified /
// 11 eliminated / 6 in progress / 17 not started. Owners are named people from the owning entity's §7.17 pool —
// departments would be the accountability gap this screen exists to close (same rule as §7.29). Target dates are
// relative per §7.21, spread across the next two quarters; in-progress rows carry one and identified-but-not-
// started rows do not — a blank is more honest than an invented commitment. eliminatedInPeriod places each
// elimination on the six-period trend (cumulative 3 · 5 · 6 · 8 · 9 · 11, pinned by §7.30); generatedLastPeriod
// backs the mechanism claim for the two causes eliminated this period — they generated 47 exceptions last period
// and none in this one.

const TARGET = (days: number): string => isoDate(addDays(ANCHOR, days)); // relative per §7.21

export const causeBacklogRows: CauseBacklogRow[] = [
  // JGL — 8 causes: 3 eliminated · 2 in progress · 3 not started (§7.18)
  { id: 'CB-JGL-01', entityCode: 'JGL', processKey: 'p2p', causeKey: 'po-price-mismatch', owner: 'P. Nair', status: 'in-progress', targetDate: TARGET(70) },
  { id: 'CB-JGL-02', entityCode: 'JGL', processKey: 'o2c', causeKey: 'pricing-disputes', owner: 'A. Sethi', status: 'in-progress', targetDate: TARGET(125) },
  { id: 'CB-JGL-03', entityCode: 'JGL', processKey: 'p2p', causeKey: 'approval-pending', owner: 'R. Iyer', status: 'identified' },
  { id: 'CB-JGL-04', entityCode: 'JGL', processKey: 'o2c', causeKey: 'deductions', owner: 'P. Nair', status: 'identified' },
  { id: 'CB-JGL-05', entityCode: 'JGL', processKey: 'o2c', causeKey: 'cash-application', owner: 'A. Sethi', status: 'identified' },
  { id: 'CB-JGL-06', entityCode: 'JGL', processKey: 'p2p', causeKey: 'missing-gr', owner: 'P. Nair', status: 'eliminated', eliminatedInPeriod: 1 },
  { id: 'CB-JGL-07', entityCode: 'JGL', processKey: 'p2p', causeKey: 'vendor-master', owner: 'A. Sethi', status: 'eliminated', eliminatedInPeriod: 2 },
  { id: 'CB-JGL-08', entityCode: 'JGL', processKey: 'p2p', causeKey: 'tax-mismatch', owner: 'R. Iyer', status: 'eliminated', eliminatedInPeriod: 4 },

  // JBL — 7 causes: 2 eliminated · 1 in progress · 4 not started (§7.18)
  { id: 'CB-JBL-01', entityCode: 'JBL', processKey: 'p2p', causeKey: 'vendor-master', owner: 'M. Kulkarni', status: 'in-progress', targetDate: TARGET(45) },
  { id: 'CB-JBL-02', entityCode: 'JBL', processKey: 'p2p', causeKey: 'po-price-mismatch', owner: 'S. Rao', status: 'identified' },
  { id: 'CB-JBL-03', entityCode: 'JBL', processKey: 'o2c', causeKey: 'billing-errors', owner: 'M. Kulkarni', status: 'identified' },
  { id: 'CB-JBL-04', entityCode: 'JBL', processKey: 'o2c', causeKey: 'credit-block', owner: 'S. Rao', status: 'identified' },
  { id: 'CB-JBL-05', entityCode: 'JBL', processKey: 'o2c', causeKey: 'customer-master', owner: 'M. Kulkarni', status: 'identified' },
  { id: 'CB-JBL-06', entityCode: 'JBL', processKey: 'p2p', causeKey: 'missing-gr', owner: 'M. Kulkarni', status: 'eliminated', eliminatedInPeriod: 1 },
  { id: 'CB-JBL-07', entityCode: 'JBL', processKey: 'p2p', causeKey: 'duplicate-suspicion', owner: 'S. Rao', status: 'eliminated', eliminatedInPeriod: 5 },

  // JPS — 5 causes: 2 eliminated · 1 in progress · 2 not started (§7.18)
  { id: 'CB-JPS-01', entityCode: 'JPS', processKey: 'p2p', causeKey: 'missing-gr', owner: 'W. Tan', status: 'in-progress', targetDate: TARGET(95) },
  { id: 'CB-JPS-02', entityCode: 'JPS', processKey: 'o2c', causeKey: 'pricing-disputes', owner: 'L. Cheong', status: 'identified' },
  { id: 'CB-JPS-03', entityCode: 'JPS', processKey: 'o2c', causeKey: 'deductions', owner: 'W. Tan', status: 'identified' },
  { id: 'CB-JPS-04', entityCode: 'JPS', processKey: 'p2p', causeKey: 'tax-mismatch', owner: 'W. Tan', status: 'eliminated', eliminatedInPeriod: 1 },
  { id: 'CB-JPS-05', entityCode: 'JPS', processKey: 'p2p', causeKey: 'approval-pending', owner: 'L. Cheong', status: 'eliminated', eliminatedInPeriod: 3 },

  // JCP — 3 causes: 2 eliminated · 1 in progress (none) · 1 not started (§7.18)
  { id: 'CB-JCP-01', entityCode: 'JCP', processKey: 'o2c', causeKey: 'cash-application', owner: 'D. Whitfield', status: 'identified' },
  { id: 'CB-JCP-02', entityCode: 'JCP', processKey: 'p2p', causeKey: 'vendor-master', owner: 'D. Whitfield', status: 'eliminated', eliminatedInPeriod: 2 },
  { id: 'CB-JCP-03', entityCode: 'JCP', processKey: 'p2p', causeKey: 'duplicate-suspicion', owner: 'K. Moreau', status: 'eliminated', eliminatedInPeriod: 6, generatedLastPeriod: 18 },

  // JHS — 4 causes: 1 eliminated · 1 in progress · 2 not started (§7.18)
  { id: 'CB-JHS-01', entityCode: 'JHS', processKey: 'o2c', causeKey: 'billing-errors', owner: 'T. Bergstrom', status: 'in-progress', targetDate: TARGET(150) },
  { id: 'CB-JHS-02', entityCode: 'JHS', processKey: 'p2p', causeKey: 'missing-gr', owner: 'J. Halloran', status: 'identified' },
  { id: 'CB-JHS-03', entityCode: 'JHS', processKey: 'o2c', causeKey: 'credit-block', owner: 'T. Bergstrom', status: 'identified' },
  { id: 'CB-JHS-04', entityCode: 'JHS', processKey: 'p2p', causeKey: 'po-price-mismatch', owner: 'J. Halloran', status: 'eliminated', eliminatedInPeriod: 4 },

  // JRP — 7 causes: 1 eliminated · 1 in progress · 5 not started (§7.18)
  { id: 'CB-JRP-01', entityCode: 'JRP', processKey: 'o2c', causeKey: 'customer-master', owner: 'N. Okafor', status: 'in-progress', targetDate: TARGET(180) },
  { id: 'CB-JRP-02', entityCode: 'JRP', processKey: 'p2p', causeKey: 'missing-gr', owner: 'C. Tremblay', status: 'identified' },
  { id: 'CB-JRP-03', entityCode: 'JRP', processKey: 'p2p', causeKey: 'po-price-mismatch', owner: 'N. Okafor', status: 'identified' },
  { id: 'CB-JRP-04', entityCode: 'JRP', processKey: 'p2p', causeKey: 'approval-pending', owner: 'C. Tremblay', status: 'identified' },
  { id: 'CB-JRP-05', entityCode: 'JRP', processKey: 'o2c', causeKey: 'pricing-disputes', owner: 'N. Okafor', status: 'identified' },
  { id: 'CB-JRP-06', entityCode: 'JRP', processKey: 'o2c', causeKey: 'deductions', owner: 'C. Tremblay', status: 'identified' },
  { id: 'CB-JRP-07', entityCode: 'JRP', processKey: 'p2p', causeKey: 'tax-mismatch', owner: 'C. Tremblay', status: 'eliminated', eliminatedInPeriod: 6, generatedLastPeriod: 29 },
];

// §7.30 — the first four points of the group open-exception series over the same six trend periods. The last two
// are live (openExceptionsPrevious() / openExceptions() in score.ts) and are assembled by causeEliminationTrend();
// together the six points fall as cumulative eliminations rise — 2158 · 2117 · 2069 · 2034 · 2012 · 1980.
export const earlyOpenExceptions = [2158, 2117, 2069, 2034];
