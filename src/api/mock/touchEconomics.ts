import type { TouchFunnelRow, TouchLeverStage } from '../types';

// §15.4 — the per-entity touch funnel. Every row reconciles: agentResolvedPct + humanPct = manualPct,
// and touches per 1,000 are manual × 10 today / human × 10 after. The commit is to touches per thousand,
// not to an automation percentage.
export const touchFunnel: TouchFunnelRow[] = [
  { code: 'JCP', touchlessPct: 78, manualPct: 22, agentResolvedPct: 16.5, humanPct: 5.5, touchesTodayPer1000: 220, touchesAfterPer1000: 55 },
  { code: 'JHS', touchlessPct: 71, manualPct: 29, agentResolvedPct: 21.5, humanPct: 7.5, touchesTodayPer1000: 290, touchesAfterPer1000: 75 },
  { code: 'JPS', touchlessPct: 62, manualPct: 38, agentResolvedPct: 27.4, humanPct: 10.6, touchesTodayPer1000: 380, touchesAfterPer1000: 106 },
  { code: 'JGL', touchlessPct: 54, manualPct: 46, agentResolvedPct: 32.2, humanPct: 13.8, touchesTodayPer1000: 460, touchesAfterPer1000: 138 },
  { code: 'JBL', touchlessPct: 46, manualPct: 54, agentResolvedPct: 36.7, humanPct: 17.3, touchesTodayPer1000: 540, touchesAfterPer1000: 173 },
  { code: 'JRP', touchlessPct: 41, manualPct: 59, agentResolvedPct: 39.5, humanPct: 19.5, touchesTodayPer1000: 590, touchesAfterPer1000: 195 },
];

// §15.3 — JGL's illustrative glide path, the two levers shown separately because they compound and cost differently.
// Only JGL carries these stages; no other entity has lever-stage figures in the dataset.
export const jglLeverStages: TouchLeverStage[] = [
  { label: 'Today', touchlessPct: 54, touchesPer1000: 460 },
  { label: 'After cause elimination', touchlessPct: 62, touchesPer1000: 380 },
  { label: 'Effective — agents on the residue', touchlessPct: 89, touchesPer1000: 114 },
];
