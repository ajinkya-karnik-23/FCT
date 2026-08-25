// Domain types for the Finance Control Tower data layer (spec/03).
// Values are reference data only — colors and status words are derived at render time.

export type Status = 'GREEN' | 'AMBER' | 'RED';
export type ProcessKey = 'p2p' | 'o2c' | 'r2r';
export type ControlImpact = 'High' | 'Medium' | 'Low';
export type Effort = 'Low' | 'Medium' | 'High';

export interface Entity {
  code: string; // 'JGL'
  name: string;
  score: number; // 0-100
  status: Status; // derived from score, stored here only for convenience
  dims: [number, number, number, number, number]; // Close, Control, WorkingCapital, Process, Service
  apBlocked: number; // ₹ cr
  arOver90: number;
  cashUnapplied: number;
  closePct: number;
  controlBreaches: number;
}

export interface ProcessStage {
  processKey: ProcessKey;
  step: string; // 'INV'
  name: string; // 'Invoice'
  volume: number;
  value: number; // ₹ cr
  exceptionPct: number;
  status: Status;
}

export interface Exception {
  id: string; // 'AP-104281'
  entityCode: string;
  processKey: 'p2p';
  vendor: string;
  amount: number; // ₹ cr
  ageDays: number;
  reasonKey: string; // taxonomy key
  plant: string;
  owner: string;
  controlImpact: ControlImpact;
  po: string;
  bookedOn: string; // '14 Jul 2026'
}

export interface CauseNode {
  processKey: ProcessKey;
  key: string; // 'missing-gr'
  name: string; // 'Missing GR'
  sharePct: number;
  valueAtRisk: number; // ₹ cr
  avgDelayDays: number;
  recurrence: string; // '5th month'
  concentration: string; // '11 vendors'
  narrative: string;
  plants: { name: string; pct: number }[];
  vendors: { name: string; pct: number }[];
  actions: string[];
}

export interface CashOpportunity {
  name: string;
  value: number; // ₹ cr
  items: number;
  effort: Effort;
  owner: string;
}

// --- Supporting datasets (spec/03 "Other datasets") ---

export interface AgeingBucket {
  label: string; // '0-15 d'
  value: number; // ₹ cr
}

export interface PayableReason {
  name: string; // 'Missing GR'
  value: number; // ₹ cr
}

export interface RecurringCause {
  name: string; // 'Missing GR' — the "(P2P)" suffix is composed at render time from processKey
  processKey: ProcessKey;
  sharePct: number;
}

export interface CloseProgress {
  pct: number; // 71
  totalTasks: number; // 214
  overdue: number; // 19
  blockers: number; // 6
  entitiesAtRisk: number; // 3
}

export interface TransformationHealth {
  automationRatePct: number; // 68 (trending up)
  repeatExceptionsQoqPct: number; // -14
  causesEliminated: string; // '11 of 34'
  touchlessInvoicesPct: number; // 54
}

export interface ServiceControl {
  slaInvoiceBookingPct: number; // 93.1
  queriesOverdue: number; // 27
  duplicatePaymentRiskCr: number; // 0.9
  manualPaymentRuns: number; // 4
}

export interface GroupSummary {
  score: number; // 76.5
  valueAtRiskCr: number; // 92.4
  openExceptions: number; // 1486
  closeProgress: CloseProgress;
  transformationHealth: TransformationHealth;
}
