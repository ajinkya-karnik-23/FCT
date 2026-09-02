import { statusWord, type StatusWord } from '../theme/derive';
import { entities } from './mock/entities';
import type { DimensionKey, Entity, ProcessStage, SensitivityItem, Trend, Veto } from './types';

// §3.1 — the six scored dimensions in display order.
export const DIMENSION_KEYS = [
  'operational',
  'service',
  'risk',
  'workingCapital',
  'dataQuality',
  'compliance',
] as const;

// §3.1 — display names, shown next to every bar and in the weights disclosure.
export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  operational: 'Operational',
  service: 'Service & attribution',
  risk: 'Risk & control',
  workingCapital: 'Working capital',
  dataQuality: 'Data & MDM quality',
  compliance: 'Compliance',
};

// §8.6.1 — what each dimension score counts, per the §3.1 coverage table; exposed on hover wherever a
// dimension bar renders so one number has one definition everywhere it appears.
export const DIMENSION_DEFINITIONS: Record<DimensionKey, string> = {
  operational: 'Volume, throughput, exception rate, ageing, touchless / straight-through rate, first-time-right, rework, backlog.',
  service: 'SLA and TAT performance, breaches, escalations, query resolution — split by originating cause.',
  risk: 'Control effectiveness and bypass, authority breaches, sensitive master data changes, SoD, cut-off integrity, undisclosed exposure.',
  workingCapital: 'Value locked in exceptions, ageing profiles, DSO/DPO components under service control, releasable cash.',
  dataQuality: 'Vendor and customer master completeness, duplicates, dormancy, tax registration validity, payment term integrity, interface health.',
  compliance: 'Statutory obligations with deadlines and penalties — GST and ITC at risk, TDS, MSMED ageing, e-invoicing failures, certifications.',
};

// §3.2 — contractual weights, displayed to the user and used by the §7.10 sensitivity check.
export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  operational: 0.2,
  service: 0.15,
  risk: 0.2,
  workingCapital: 0.2,
  dataQuality: 0.1,
  compliance: 0.15,
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface ScoreResult {
  raw: number; // weighted sum before vetoes (§3.4)
  displayed: number; // Math.round(min(raw, active veto caps))
  band: StatusWord;
  cappedBy: Veto | null; // the binding active veto, if any
}

function scoreFrom(dimensions: Record<DimensionKey, number>, activeVetoes: Veto[]): ScoreResult {
  const raw = DIMENSION_KEYS.reduce((sum, key) => sum + dimensions[key] * DIMENSION_WEIGHTS[key], 0);
  const cap = activeVetoes.length ? Math.min(...activeVetoes.map((v) => v.cap)) : Infinity;
  const displayed = Math.round(Math.min(raw, cap));
  return {
    raw: round1(raw),
    displayed,
    band: statusWord(displayed),
    cappedBy: cap < raw ? activeVetoes.find((v) => v.cap === cap)! : null,
  };
}

export function computeScore(entity: Entity): ScoreResult {
  return scoreFrom(entity.dimensions, entity.vetoes.filter((v) => v.active));
}

// §7.15 — prior-period score: the same formula over dimensionsPrevious and the vetoes active last period
// (active && !detectedThisPeriod), so a veto detected this period never caps the prior figure.
export function priorScore(entity: Entity): ScoreResult {
  return scoreFrom(entity.dimensionsPrevious, entity.vetoes.filter((v) => v.active && !v.detectedThisPeriod));
}

// §7.10 — deltas are computed, never stored: apply the movement and deactivate the named veto, then recompute.
// state is the transformed entity so a cascade (§7.10.1) can thread steps through it in order.
export interface SensitivityStep {
  score: ScoreResult; // recomputed after this one action
  state: Entity; // movement applied / veto cleared — feed into the next applySensitivity call
}

export function applySensitivity(entity: Entity, item: SensitivityItem): SensitivityStep {
  const dimensions = { ...entity.dimensions };
  if (item.dimension !== null) dimensions[item.dimension] += item.dimensionMovement;
  const vetoes = item.clearsVeto
    ? entity.vetoes.map((v) => (v.id === item.clearsVeto ? { ...v, active: false } : v))
    : entity.vetoes;
  const state: Entity = { ...entity, dimensions, vetoes };
  return { score: computeScore(state), state };
}

// §8.6.1 — what the group score counts (§3.7): a simple mean over displayed integers, so it is verifiable
// by averaging the entity rows on screen.
export const GROUP_SCORE_DEFINITION = 'Round(mean of the six entities’ displayed scores). A simple mean — each legal entity counts equally regardless of size; vetoes already cap each member score.';

// §3.7 — mean of the displayed scores; computed, never hardcoded.
export function groupScore(): number {
  const total = entities.reduce((sum, e) => sum + computeScore(e).displayed, 0);
  return Math.round(total / entities.length);
}

// §7.15 — mean of the prior displayed scores; computed, never hardcoded (parallel to groupScore()).
export function groupScorePrevious(): number {
  const total = entities.reduce((sum, e) => sum + priorScore(e).displayed, 0);
  return Math.round(total / entities.length);
}

// §8.6.1 — what the group value-at-risk counts (§7.2): the two exposure pools, summed across entities.
export const VALUE_AT_RISK_DEFINITION = 'Sum across all six entities of blocked AP invoices plus receivables over 90 days, current period (₹ cr).';

// §7.2 — Σ (apBlocked + arOver90), ₹ cr.
export function valueAtRisk(): number {
  const total = entities.reduce((sum, e) => sum + e.metrics.apBlocked.current + e.metrics.arOver90.current, 0);
  return round1(total);
}

// §8.6.1 — what the group open-exception count counts (§7.2): three pools, summed across entities.
export const OPEN_EXCEPTIONS_DEFINITION = 'Open exceptions: blocked AP invoices + O2C exceptions + aged R2R reconciliation breaks, counted across all six entities.';

// §7.2 — Σ (apBlockedCount + o2cExceptionCount + reconAgedBreaks).
export function openExceptions(): number {
  return entities.reduce(
    (sum, e) => sum + e.metrics.apBlockedCount + e.metrics.o2cExceptionCount + e.metrics.reconAgedBreaks,
    0,
  );
}

// §7.16 — the same sum over prior-period counts; computed, never stored.
export function openExceptionsPrevious(): number {
  return entities.reduce(
    (sum, e) => sum + e.metrics.apBlockedCountPrevious + e.metrics.o2cExceptionCountPrevious + e.metrics.reconAgedBreaksPrevious,
    0,
  );
}

// §8.5.1 — direction of travel for a headline trend. Pass inverse=true when lower is better
// (down-is-good metrics); null = direction-neutral (DPO) — colouring it would assert something
// the data cannot defend, so it renders in textMuted whichever way it moves.
export interface TrendDelta {
  direction: 'improving' | 'worsening' | 'flat' | 'neutral';
  percent: number; // change vs previous period, one decimal
}

export function trendDelta(trend: Trend, inverse: boolean | null): TrendDelta {
  const { current, previous } = trend;
  if (current === previous) return { direction: 'flat', percent: 0 };
  const percent = Math.round(((current - previous) / previous) * 1000) / 10;
  if (inverse === null) return { direction: 'neutral', percent };
  const improving = inverse ? current < previous : current > previous; // §8.5.1 — true when lower is better
  return { direction: improving ? 'improving' : 'worsening', percent };
}

// §7.15/§7.16 — direction of travel for a two-point figure (score, exception count): the same polarity
// rules as trendDelta, but no series is required — §7.15/§7.16 pin exactly current + previous per figure.
export function pointDirection(current: number, previous: number, inverse: boolean): TrendDelta['direction'] {
  if (current === previous) return 'flat';
  const improving = inverse ? current < previous : current > previous; // §8.5.1 — true when lower is better
  return improving ? 'improving' : 'worsening';
}

// §7.4 — exception % is derived, never stored.
export function stageExceptionPct(stage: ProcessStage): number {
  return Math.round((stage.inException / stage.inFlight) * 100);
}
