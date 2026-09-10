// Public API surface for the Finance Control Tower (spec/03).
// Components import ONLY from this module — never from ./mock/*.
// These are synchronous mock accessors over the fabricated reference data.

import { entities } from './mock/entities';
import { costCentres, counterparties, plants } from './mock/counterparties';
import { stagesFor } from './mock/stages';
import { ANCHOR, addDays, closingLine, endOfMonth, exceptions, fmtDate, isoDate, seededTimeline, SEEDED_EVIDENCE_LINES } from './mock/exceptions';
import { causes } from './mock/causes';
import { causeBacklogRows, earlyOpenExceptions } from './mock/causeBacklog';
import { complianceItems } from './mock/compliance';
import { dataQualityItems, interfaceHealth } from './mock/dataQuality';
import { apEffectiveness, controlSignals } from './mock/controls';
import {
  blockedInvoiceAgeingByEntity,
  cashOpportunities,
  closeProgress,
  forecasts,
  o2cKpis,
  o2cServiceControl,
  payablesByReason,
  receivablesAgeingByEntity,
  recurringCauses,
  serviceControl,
  serviceMetricsByEntity,
  transformationHealth,
} from './mock/misc';
import { deflectedSelfServed, requests } from './mock/requests';
import { agents, agentActionLog, COVERAGE_STRIP, sessionOverrideCount } from './mock/agents';
import { poActionLog } from './mock/commitments';
import { jglLeverStages, touchFunnel } from './mock/touchEconomics';

import { computeScore, DIMENSION_KEYS, groupScore, groupScorePrevious, openExceptions, openExceptionsPrevious, valueAtRisk } from './score';
import { requestSlaStatusWord, type RequestSlaWord } from '../theme/derive';

import type {
  AgeingBucket,
  Agent,
  AgentAction,
  AgentGovernanceSummary,
  AgentWorkforceSummary,
  Attribution,
  CashOpportunity,
  CauseBacklogRow,
  CauseElimination,
  CauseNode,
  ComplianceItem,
  CostCentre,
  Counterparty,
  ControlSignal,
  CoverageStrip,
  DataQualityItem,
  DimensionKey,
  DriverAssumption,
  Effort,
  Entity,
  Exception,
  Forecast,
  ForecastDriver,
  Grouping,
  GroupRow,
  GroupSummary,
  InterfaceHealth,
  O2cKpis,
  O2cServiceControl,
  PayableReason,
  PlantCounterparty,
  ProcessKey,
  ProcessStage,
  RecurringCause,
  Request,
  ServiceControl,
  ServiceMetric,
  TimelineEvent,
  TouchFunnelRow,
  TouchLeverStage,
  Trend,
} from './types';

export type {
  AgeingBucket,
  Agent,
  AgentAction,
  AgentCheck,
  AgentGovernanceSummary,
  AgentLane,
  AgentMetrics,
  AgentProcess,
  AgentStatus,
  AgentType,
  AgentWorkforceSummary,
  ApControlEffectiveness,
  Attribution,
  CashOpportunity,
  CauseBacklogRow,
  CloseProgress,
  CostCentre,
  Counterparty,
  ControlCategory,
  ControlSignal,
  ControlSignificance,
  CoverageStage,
  CoverageStrip,
  CauseElimination,
  CauseNode,
  ComplianceItem,
  DataQualityItem,
  Delegation,
  DimensionKey,
  DriverAssumption,
  Effort,
  Entity,
  Exception,
  Forecast,
  ForecastDriver,
  Grouping,
  GroupRow,
  GroupSummary,
  InterfaceHealth,
  O2cKpis,
  O2cServiceControl,
  PayableReason,
  PlantCounterparty,
  PoChaseState,
  PoExchange,
  PurchaseOrder,
  ProcessKey,
  ProcessStage,
  RankedAction,
  RecurringCause,
  Request,
  SensitivityItem,
  ServiceControl,
  ServiceMetric,
  Status,
  TimelineEvent,
  TouchFunnelRow,
  TouchLeverStage,
  TransformationHealth,
  Trend,
  Veto,
  WalkthroughEvent,
  WalkthroughStep,
  WorklistAgentCounts,
} from './types';

export { applySensitivity, computeScore, DIMENSION_DEFINITIONS, DIMENSION_KEYS, DIMENSION_LABELS, DIMENSION_WEIGHTS, groupScore, GROUP_SCORE_DEFINITION, groupScorePrevious, openExceptions, OPEN_EXCEPTIONS_DEFINITION, openExceptionsPrevious, pointDirection, priorScore, stageExceptionPct, trendDelta, valueAtRisk, VALUE_AT_RISK_DEFINITION } from './score';

export type { ScoreResult, SensitivityStep, TrendDelta } from './score';

export function listEntities(): Entity[] {
  return entities;
}

export function getEntity(code: string): Entity | undefined {
  return entities.find((e) => e.code === code);
}

// §2 — rows for the Group view's Entity | Segment | Geography toggle. Aggregated groups keep
// first-appearance dataset order; scores, dimensions and close % are means of members, money
// columns and breaches are sums. Metric trends aggregate pointwise per period (§8.3).
const GEOGRAPHY_BUCKET: Record<string, string> = {
  India: 'India',
  Singapore: 'Singapore',
  'United States': 'North America',
  'US / Canada': 'North America',
};

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// §8.3 — pointwise trend aggregation for grouped rows: money sums per period (1dp), close % means per period.
function sumTrends(trends: Trend[]): Trend {
  const series = trends[0].series.map((_, i) => Math.round(trends.reduce((sum, t) => sum + t.series[i], 0) * 10) / 10);
  return { current: series[5], previous: series[4], series };
}

function meanTrend(trends: Trend[]): Trend {
  const series = trends[0].series.map((_, i) => Math.round(mean(trends.map((t) => t.series[i]))));
  return { current: series[5], previous: series[4], series };
}

// §8.6.1 — what an aggregated (segment/geography) row counts (§3.7): means for scores and percentages,
// sums for money and counts — verifiable by averaging the entity rows above it.
export const AGGREGATED_ROW_DEFINITION = 'Aggregated row: score and dimension values are the mean of member entities’ displayed integers; AP blocked, AR >90D, unapplied cash and breaches sum across members.';

export function groupRows(by: Grouping): GroupRow[] {
  if (by === 'entity') {
    return entities.map((e) => ({
      key: e.code,
      label: e.name,
      entityCodes: [e.code],
      score: computeScore(e).displayed,
      dimensions: { ...e.dimensions },
      dimensionsPrevious: { ...e.dimensionsPrevious },
      apBlockedCr: e.metrics.apBlocked,
      arOver90Cr: e.metrics.arOver90,
      cashUnappliedCr: e.metrics.cashUnapplied,
      closePercent: e.metrics.closePercent,
      controlBreaches: e.metrics.controlBreaches,
    }));
  }
  const labelOf = (e: Entity) => (by === 'segment' ? e.segment : GEOGRAPHY_BUCKET[e.geography]);
  const groups: { label: string; members: Entity[] }[] = [];
  for (const e of entities) {
    const label = labelOf(e);
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, members: [] };
      groups.push(group);
    }
    group.members.push(e);
  }
  return groups.map(({ label, members }) => ({
    key: label,
    label,
    entityCodes: members.map((m) => m.code),
    score: Math.round(mean(members.map((m) => computeScore(m).displayed))),
    dimensions: Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, Math.round(mean(members.map((m) => m.dimensions[k])))])
    ) as Record<DimensionKey, number>,
    dimensionsPrevious: Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, Math.round(mean(members.map((m) => m.dimensionsPrevious[k])))])
    ) as Record<DimensionKey, number>,
    apBlockedCr: sumTrends(members.map((m) => m.metrics.apBlocked)),
    arOver90Cr: sumTrends(members.map((m) => m.metrics.arOver90)),
    cashUnappliedCr: sumTrends(members.map((m) => m.metrics.cashUnapplied)),
    closePercent: meanTrend(members.map((m) => m.metrics.closePercent)),
    controlBreaches: members.reduce((sum, m) => sum + m.metrics.controlBreaches, 0),
  }));
}

// §7.25 — per-entity stage tables; defaults to JGL so existing callers keep their figures.
export function listStages(processKey: ProcessKey = 'p2p', entityCode?: string): ProcessStage[] {
  return stagesFor(entityCode ?? 'JGL').filter((s) => s.processKey === processKey);
}

export function listExceptions(entityCode?: string, processKey?: Exception['processKey']): Exception[] {
  return exceptions.filter(
    (x) => (!entityCode || x.entityCode === entityCode) && (!processKey || x.processKey === processKey),
  );
}

export function getException(id: string): Exception | undefined {
  return exceptions.find((x) => x.id === id);
}

// §8.9 — worklist row actions; session-local state on the shared exception objects (no persistence).
export { applyWorklistAction, resetWorklistActionStore } from './actions';
export type { WorklistAction } from './actions';

// §7.6 — attribution reason per cause (single source: mock/exceptions.ts).
export { attributionReason } from './mock/exceptions';

// §7.19 — effort is a property of the item, not the cause: same cause, different resolvable state.
// The spec's eight-situation table pins these values; vendor master / duplicate / tax share one row each.
const ITEM_EFFORT: Record<string, { open: Effort; resolvable: Effort }> = {
  'missing-gr': { open: 'High', resolvable: 'Low' }, // receipt not yet available → chase the plant; awaiting posting → one action, no chasing
  'po-price-mismatch': { open: 'High', resolvable: 'Low' }, // outside tolerance → renegotiate or raise a debit note; inside → approve the variance
  'approval-pending': { open: 'Medium', resolvable: 'Low' }, // approver absent → reroute the delegation; active → one nudge
  'vendor-master': { open: 'Medium', resolvable: 'Low' }, // not resolvable today → correction plus re-validation; prepared → one validation
  'duplicate-suspicion': { open: 'Medium', resolvable: 'Low' },
  'tax-mismatch': { open: 'Medium', resolvable: 'Low' },
};

export function itemEffort(x: Pick<Exception, 'reasonKey' | 'resolvableToday'>): Effort {
  const row = ITEM_EFFORT[x.reasonKey] ?? { open: 'Medium', resolvable: 'Low' };
  return x.resolvableToday ? row.resolvable : row.open;
}

// §7.6/§8.9 — the detail screen's timeline: seeded lifecycle + session action lines + today's status.
export function exceptionTimeline(x: Exception): TimelineEvent[] {
  const events = [...seededTimeline(x)];
  for (const line of (x.evidence ?? []).slice(SEEDED_EVIDENCE_LINES)) {
    const m = /^(.*) (\d{2}-[A-Za-z]{3}) (\d{2}:\d{2})$/.exec(line);
    if (m) events.push({ dateLabel: m[2].replace('-', ' '), time: m[3], text: m[1], tone: 'ok' });
  }
  if ((x.status ?? 'open') !== 'released') {
    // §7.19 — a resolvable-today item reads as one action away (green), not as still waiting.
    // The open line carries the item's own escalation timer — the same figure the worklist lane shows.
    events.push({ dateLabel: 'Today', text: closingLine(x.reasonKey, x.resolvableToday, x.ageDays), tone: x.resolvableToday ? 'ok' : 'now' });
  }
  return events;
}

export function listCauses(processKey: ProcessKey = 'p2p'): CauseNode[] {
  return causes.filter((c) => c.processKey === processKey);
}

export function getCause(key: string): CauseNode | undefined {
  return causes.find((c) => c.key === key);
}

// §7.20 — denominators follow the filter: filtered to a cause, the pool is that cause's own pool, not the entity-wide one.
// Counts are largest-remainder over (sharePct × apBlockedCount), so they sum exactly to the entity's blocked count; value is
// the taxonomy node's value at risk — the same figure the root-cause page shows for every entity.
export function causePool(entityCode: string, causeKey: string): { count: number; valueCr: number } | undefined {
  const entity = getEntity(entityCode);
  const node = getCause(causeKey);
  if (!entity || !node || node.processKey !== 'p2p') return undefined;
  const causes = listCauses('p2p');
  const total = entity.metrics.apBlockedCount;
  const raw = causes.map((c) => (c.sharePct / 100) * total);
  const counts = raw.map((v) => Math.floor(v + 1e-9));
  let remainder = total - counts.reduce((a, b) => a + b, 0); // integer in [0, causes.length)
  const byFrac = raw.map((v, i) => ({ frac: v - Math.floor(v), i })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFrac) {
    if (remainder <= 0) break;
    counts[i] += 1;
    remainder -= 1;
  }
  return { count: counts[causes.findIndex((c) => c.key === causeKey)], valueCr: node.valueAtRisk };
}

export function getCashOpportunities(): CashOpportunity[] {
  return cashOpportunities;
}

// §7.18 — cause elimination backlog; notStarted is derived, never stored (identified − eliminated − inProgress).
export function causeBacklog(ce: CauseElimination): { identified: number; eliminated: number; inProgress: number; notStarted: number } {
  return { ...ce, notStarted: ce.identified - ce.eliminated - ce.inProgress };
}

// §7.30 — the register row as rendered: the stored row plus name / value at risk / recurrence joined from the
// group taxonomy at read time (the register holds entity-level rows; the taxonomy holds the twelve group nodes).
export interface CauseBacklogEntry extends CauseBacklogRow {
  name: string;
  valueAtRisk: number; // ₹ cr — from the taxonomy node
  recurrence: number; // months — displayed via formatRecurrence() (§7.12)
}

// §7.30 — cause elimination backlog register (thirty-four entity-level rows, mock/causeBacklog.ts).
export function listCauseBacklog(): CauseBacklogEntry[] {
  return causeBacklogRows.map((row) => {
    const node = getCause(row.causeKey);
    return { ...row, name: node?.name ?? row.causeKey, valueAtRisk: node?.valueAtRisk ?? 0, recurrence: node?.recurrence ?? 0 };
  });
}

// §7.30 — headline counts derived from the register rows (never stored): 34 identified · 11 eliminated ·
// 6 in progress · 17 not started, matching the per-entity pins in §7.18.
export function causeBacklogCounts(): { identified: number; eliminated: number; inProgress: number; notStarted: number } {
  const identified = causeBacklogRows.length;
  const eliminated = causeBacklogRows.filter((r) => r.status === 'eliminated').length;
  const inProgress = causeBacklogRows.filter((r) => r.status === 'in-progress').length;
  return { identified, eliminated, inProgress, notStarted: identified - eliminated - inProgress };
}

// §7.30 — the mechanism trend over the six periods: cumulative causes eliminated (derived from the register's
// eliminatedInPeriod marks) against group open exceptions. The exception series joins the four early points with
// the live previous/current values, so both lines share exactly the same six points — which is what makes the
// asserted relationship ("as eliminations rise, open exceptions fall") checkable point by point.
export function causeEliminationTrend(): { eliminatedSeries: number[]; openExceptionsSeries: number[] } {
  const eliminatedSeries = [1, 2, 3, 4, 5, 6].map((p) =>
    causeBacklogRows.filter((r) => r.status === 'eliminated' && (r.eliminatedInPeriod ?? 0) <= p).length
  );
  return { eliminatedSeries, openExceptionsSeries: [...earlyOpenExceptions, openExceptionsPrevious(), openExceptions()] };
}

// §7.30 — the overclaim guard, as data: the defensible claim is about the causes eliminated THIS period (period
// 6) — they generated N exceptions last period and none in this one. "Volume fell because we eliminated causes"
// would be a different, unsupported claim; this accessor only ever produces the first kind.
export function currentPeriodEliminations(): { count: number; generatedLastPeriod: number } {
  const rows = causeBacklogRows.filter((r) => r.status === 'eliminated' && r.eliminatedInPeriod === 6);
  return { count: rows.length, generatedLastPeriod: rows.reduce((s, r) => s + (r.generatedLastPeriod ?? 0), 0) };
}

// §7.2 — group aggregates are computed, never stored (score.ts is the single decider).
export function getGroupSummary(): GroupSummary {
  return {
    score: groupScore(),
    scorePrevious: groupScorePrevious(), // §7.15 — computed from dimensionsPrevious + prior-active vetoes
    valueAtRiskCr: valueAtRisk(),
    // §7.14 — VaR is the only header KPI with pinned priors; it aggregates entity trends per period.
    valueAtRiskTrend: sumTrends(entities.flatMap((e) => [e.metrics.apBlocked, e.metrics.arOver90])),
    openExceptions: openExceptions(),
    openExceptionsPrevious: openExceptionsPrevious(), // §7.16 — computed from prior-period counts
    closeProgress,
    transformationHealth,
  };
}

// Supporting datasets (spec/03 "Other datasets"). §7.31 — ageing profiles are per entity, not group-wide.
export function getBlockedInvoiceAgeing(entityCode: string): AgeingBucket[] {
  return blockedInvoiceAgeingByEntity[entityCode] ?? [];
}

export function getReceivablesAgeing(entityCode: string): AgeingBucket[] {
  return receivablesAgeingByEntity[entityCode] ?? [];
}

export function getPayablesByReason(): PayableReason[] {
  return payablesByReason;
}

export function getServiceControl(): ServiceControl {
  return serviceControl;
}

// spec/08 — O2C cockpit datasets.
export function getO2cKpis(): O2cKpis {
  return o2cKpis;
}

export function getO2cServiceControl(): O2cServiceControl {
  return o2cServiceControl;
}

export function getRecurringCauses(): RecurringCause[] {
  return recurringCauses;
}

// §7.7/§7.22 — per-entity service metrics (day-one vs measuring / needs-register).
export function getServiceMetrics(entityCode: string): ServiceMetric[] {
  return serviceMetricsByEntity[entityCode] ?? [];
}

// §4 — the two objects are separate and never merged (§8.6.1: definition lives with the accessor, not the component).
export const HEALTH_SCORE_DEFINITION = "The state of the client's finance operation, including problems the client's own organisation causes. Diagnostic.";
export const SERVICE_SCORECARD_DEFINITION = 'Contractual SLA/TAT performance, net of delay the provider does not control.';

// §4/§7.22 — service scorecard per entity. Gross is the mean of day-one achieved % (the contractual figure);
// net applies the attribution formula per SLA — 100 − (100 − achieved) × share counted against us — then averages, so a
// breach we did not cause does not count against us. The exclusion set is a contract term: net excludes client, system and
// third-party delay; altNet is the narrower reading where an interface failure still counts against the provider (it depends
// on who operates the interface). JGL: gross 95.2, net 98.6, altNet 98.0 — the two readings differ by 0.6 points there and by
// up to 2.1 across entities. A row with no breaches has nothing to net out and keeps its achieved value.
export function serviceScorecard(entityCode: string): { gross: number; net: number; altNet: number } {
  const dayOne = getServiceMetrics(entityCode).filter((s) => s.measurability === 'day-one' && typeof s.achieved === 'number');
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const gross = round1(mean(dayOne.map((s) => s.achieved!))); // JGL: (93.1+96.4+98.2+91.0+97.5)/5 = 95.2
  const score = (counted: Attribution[]) =>
    round1(
      mean(
        dayOne.map((s) => {
          const breaches = s.breaches ?? 0;
          if (!breaches) return s.achieved!;
          const share = counted.reduce((sum, k) => sum + (s.attributionSplit?.[k] ?? 0), 0) / breaches;
          return 100 - (100 - s.achieved!) * share;
        })
      )
    );
  return { gross, net: score(['provider']), altNet: score(['provider', 'system']) };
}

// §7.8 — risk & control signals; eight rows across the five categories, all values pinned in the spec table.
export function getControlSignals(): ControlSignal[] {
  return controlSignals;
}

// §7.8/§1 — effectiveness of the AP automation tool's own controls (duplicate check, three-way match). The platform
// monitors override and bypass only — it never re-runs a control the source system enforces (§1 "What it is NOT").
export function apControlEffectiveness(): {
  duplicate: { flaggedYtd: number; overriddenYtd: number; overrideRatePct: number };
  threeWayMatch: { failedYtd: number; overriddenYtd: number; overrideRatePct: number };
  valuePreventedYtdCr: number;
} {
  const rate = (overriddenYtd: number, totalYtd: number) => Math.round((overriddenYtd / totalYtd) * 1000) / 10;
  return {
    duplicate: { ...apEffectiveness.duplicate, overrideRatePct: rate(apEffectiveness.duplicate.overriddenYtd, apEffectiveness.duplicate.flaggedYtd) },
    threeWayMatch: { ...apEffectiveness.threeWayMatch, overrideRatePct: rate(apEffectiveness.threeWayMatch.overriddenYtd, apEffectiveness.threeWayMatch.failedYtd) },
    valuePreventedYtdCr: apEffectiveness.valuePreventedYtdCr,
  };
}

// §7.3 — forecast anchors, drivers and ranked actions per entity/metric.
export function getForecast(entityCode: string): Forecast | undefined {
  return forecasts.find((f) => f.entityCode === entityCode);
}

// §7.3 — the month-end horizon every driver is tested against; 'YYYY-MM-DD' so a string compare is chronological.
export function monthEndIso(): string {
  return isoDate(endOfMonth(ANCHOR));
}

// §7.3 — whether one driver still counts against month-end DSO under a given assumption: it is open unless it is
// marked resolved or assumed to settle by month-end ('' or an absent override falls back to the base-case date).
export function driverOpenAtMonthEnd(d: ForecastDriver, a: DriverAssumption): boolean {
  if (a.resolved) return false;
  const settle = a.settleIso || d.baseSettleIso;
  return !(settle && settle <= monthEndIso());
}

// §7.3 — projected DSO under a set of contested assumptions: base plus the impact of every driver still open at
// month-end. Rounded to 1dp against float drift. Assumptions are keyed by driver id, not label: labels repeat across
// entities ('Cash awaiting application') and the page is reused when only :code changes.
export function projectDsoDays(forecast: Forecast, assumptions: Record<string, DriverAssumption>): number {
  let days = forecast.current;
  for (const d of forecast.drivers) {
    if (!driverOpenAtMonthEnd(d, assumptions[d.id] ?? {})) continue;
    days += d.impact;
  }
  return Math.round(days * 10) / 10;
}

// §7.11 — attribution split computed from stored counts; total and pct are derived, never stored.
export interface SlaBreachSplit {
  counts: Record<Attribution, number>;
  total: number;
  pct: Record<Attribution, number>;
}

const ATTRIBUTION_KEYS: Attribution[] = ['client', 'provider', 'system', 'thirdParty'];

export function slaBreachSplit(entityCode?: string): SlaBreachSplit {
  const scope = entityCode ? entities.filter((e) => e.code === entityCode) : entities;
  const counts: Record<Attribution, number> = { client: 0, provider: 0, system: 0, thirdParty: 0 };
  for (const e of scope) for (const k of ATTRIBUTION_KEYS) counts[k] += e.metrics.slaBreachCounts[k];
  const total = ATTRIBUTION_KEYS.reduce((sum, k) => sum + counts[k], 0);
  const pct: Record<Attribution, number> = { client: 0, provider: 0, system: 0, thirdParty: 0 };
  for (const k of ATTRIBUTION_KEYS) pct[k] = total ? Math.round((counts[k] / total) * 100) : 0;
  return { counts, total, pct };
}

// §7.29 — the Finance Service Desk: one structured intake for every request into the service. Rows are seeded per
// entity (mock/requests.ts); everything below is derived at read time, never stored.

// Step 14 carry-over — the named owner pool for an entity (§7.17 people, not departments). The desk's new-request
// form assigns from this pool so a fresh intake carries a name, matching every seeded row.
export { requestOwnerPool } from './mock/requests';

export function listRequests(entityCode?: string, type?: Request['type']): Request[] {
  return requests.filter((r) => (!entityCode || r.entityCode === entityCode) && (!type || r.type === type));
}

// §7.29 — the three desk SLAs and the request types that feed them; fixed asset / price change / urgent payment
// carry no committed TAT, so their queue rows show a dimmed dash rather than an invented target.
const SLA_REQUEST_TYPE: Record<string, Request['type']> = {
  'Vendor master creation': 'masterData',
  'Query resolution': 'query',
  'Dispute resolution': 'dispute',
};

export function requestTypeForSla(sla: string): Request['type'] | undefined {
  return SLA_REQUEST_TYPE[sla];
}

const DAY_MS = 86400000;

// Local midnight of the date part — calendar-day arithmetic, so 'raised yesterday' is one day old whenever the
// prototype opens (§7.21). A closed request ages to its resolution date: that span is what its TAT is judged on.
function dayStart(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function requestAgeDays(r: Request): number {
  const endIso = r.status === 'closed' && r.resolvedOn ? r.resolvedOn : isoDate(ANCHOR);
  return Math.max(0, Math.round((dayStart(endIso) - dayStart(r.raisedOn)) / DAY_MS));
}

// §5's attribution logic applied to requests — stop-clock hours subtract from the age, which is what makes the
// stop-clock defensible rather than contested.
export function effectiveAgeDays(r: Request): number {
  return Math.max(0, requestAgeDays(r) - r.clockStoppedHours / 24);
}

// §7.29 — live current-period-to-date figures for the desk SLAs: open count, oldest effective age, mean resolution
// days over closed rows, stop-clock hours. Derived from the request rows at read time (never stored on ServiceMetric).
export function serviceDeskStats(entityCode: string, type: Request['type']): { open: number; oldestEffectiveDays: number; avgResolutionDays: number; stoppedHours: number } {
  const rows = listRequests(entityCode, type);
  const openRows = rows.filter((r) => r.status !== 'closed');
  const closedRows = rows.filter((r) => r.status === 'closed' && r.resolvedOn);
  return {
    open: openRows.length,
    oldestEffectiveDays: Math.round(openRows.reduce((m, r) => Math.max(m, effectiveAgeDays(r)), 0) * 10) / 10,
    avgResolutionDays: closedRows.length ? Math.round(mean(closedRows.map(requestAgeDays)) * 10) / 10 : 0,
    stoppedHours: rows.reduce((s, r) => s + r.clockStoppedHours, 0),
  };
}

// §7.29 — deflection counter: requests answered by self-service versus routed to the service team. The rate is
// derived, never stored; it carries into the operating-model argument (Step 16).
export function deflection(entityCode?: string): { selfServed: number; routed: number; ratePct: number } {
  const codes = entityCode ? [entityCode] : Object.keys(deflectedSelfServed);
  const selfServed = codes.reduce((s, c) => s + (deflectedSelfServed[c] ?? 0), 0);
  const routed = codes.reduce((s, c) => s + listRequests(c).length, 0);
  return { selfServed, routed, ratePct: Math.round((selfServed / (selfServed + routed)) * 100) };
}

// §7.29 — the measuring window for the desk SLAs: measurement began mid-period, so each carries 'measuring since
// <date> · first full-period report from <next period>'. Single derivation site; both values derive from today (§7.21).
const PERIOD_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function serviceDeskWindow(): { measuringSince: string; nextPeriod: string } {
  const m = ANCHOR.getMonth() + 1; // 1-12
  return {
    measuringSince: fmtDate(addDays(ANCHOR, -5)), // the desk went live five days into the period
    nextPeriod: `${PERIOD_MONTHS[m % 12]}-${ANCHOR.getFullYear() + Math.floor(m / 12)}`,
  };
}

// §7.29 — per-request SLA status against its type's committed TAT; the band itself is decided in theme/derive, and
// undefined where the type carries no committed target (the queue shows a dimmed dash there).
const REQUEST_TYPE_SLA: Record<Request['type'], string | undefined> = {
  masterData: 'Vendor master creation',
  query: 'Query resolution',
  dispute: 'Dispute resolution',
  fixedAsset: undefined,
  priceChange: undefined,
  urgentPayment: undefined,
};

export function requestSlaStatus(r: Request): RequestSlaWord | undefined {
  const sla = REQUEST_TYPE_SLA[r.type];
  if (!sla) return undefined;
  const metric = getServiceMetrics(r.entityCode).find((s) => s.sla === sla);
  if (!metric) return undefined;
  const targetDays = parseInt(metric.target, 10);
  if (Number.isNaN(targetDays)) return undefined;
  return requestSlaStatusWord(effectiveAgeDays(r), targetDays, r.status === 'closed');
}

// §7.12 — EntityHome tile sub-labels are composed from dataset counts in the data layer.
export function entityTileSubs(entity: Entity): { cashUnapplied: string; apBlocked: string; arOver90: string; close: string; recon: string; controls: string } {
  const m = entity.metrics;
  return {
    cashUnapplied: `${m.cashUnappliedReceipts} receipts · oldest ${m.cashUnappliedOldestDays} d`,
    apBlocked: `${m.apBlockedCount} invoices · oldest ${m.apBlockedOldestDays} d`,
    arOver90: `${m.arOver90Customers} customers · oldest ${m.arOver90OldestDays} d`,
    close: `${m.closeBlockers} blockers`,
    recon: `${m.reconAgedBreaks} aged breaks · oldest ${m.reconOldestDays} d`,
    controls: `${m.highRiskJEs} high-risk JEs`,
  };
}

// §7.24 — counterparty pages (vendor / customer), reached by drill only (§9.1).
export function listCounterparties(entityCode?: string, type?: Counterparty['type']): Counterparty[] {
  return counterparties.filter((c) => (!entityCode || c.entityCode === entityCode) && (!type || c.type === type));
}

export function getCounterparty(id: string): Counterparty | undefined {
  return counterparties.find((c) => c.id === id);
}

// §7.24 — plant pages; plants tie to the entity's blocked-AP pool via the overall plant shares (mock/counterparties.ts).
export function listPlants(entityCode?: string): PlantCounterparty[] {
  return plants.filter((p) => !entityCode || p.entityCode === entityCode);
}

// §7.24 — plant detail: the worklist rows at this plant plus the blocked value by cause (integer-paise sums, sorted desc).
export function getPlantDetail(entityCode: string, id: string): { plant: PlantCounterparty; items: Exception[]; byCause: { causeKey: string; amountCr: number }[] } | undefined {
  const plant = plants.find((p) => p.entityCode === entityCode && p.id === id);
  if (!plant) return undefined;
  const items = exceptions.filter((x) => x.entityCode === entityCode && x.plant === plant.name);
  const byCausePaise = new Map<string, number>();
  for (const x of items) byCausePaise.set(x.reasonKey, (byCausePaise.get(x.reasonKey) ?? 0) + Math.round(x.amount * 100));
  const byCause = [...byCausePaise.entries()].map(([causeKey, p]) => ({ causeKey, amountCr: p / 100 })).sort((a, b) => b.amountCr - a.amountCr);
  return { plant, items, byCause };
}

// §7.24 — cost centre pages; committed spend ties to the PO stage in-flight value (§7.4).
export function listCostCentres(entityCode?: string): CostCentre[] {
  return costCentres.filter((c) => !entityCode || c.entityCode === entityCode);
}

// §9.1 — drill routes for counterparty pages (no rail entries; the palette and process screens link here).
export function vendorRoute(entityCode: string, name: string): string | undefined {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return counterparties.some((c) => c.entityCode === entityCode && c.type === 'vendor' && c.id === id) ? `/entity/${entityCode}/vendor/${id}` : undefined;
}

export function plantRoute(entityCode: string, name: string): string | undefined {
  const id = `${entityCode.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
  return plants.some((p) => p.entityCode === entityCode && p.id === id) ? `/entity/${entityCode}/plant/${id}` : undefined;
}

// §7.26 — statutory obligations per entity; jurisdiction-matched in the dataset, only JRP overdue.
export function listCompliance(entityCode?: string): ComplianceItem[] {
  return complianceItems.filter((c) => !entityCode || c.entityCode === entityCode);
}

// §7.27 — master-data and interface quality checks; fail rates order inversely with the data-quality dimension.
export function listDataQuality(entityCode?: string, domain?: DataQualityItem['domain']): DataQualityItem[] {
  return dataQualityItems.filter((d) => (!entityCode || d.entityCode === entityCode) && (!domain || d.domain === domain));
}

// §7.27 — interface health per entity (failed IDocs come from the interface check above).
export function getInterfaceHealth(entityCode: string): InterfaceHealth | undefined {
  return interfaceHealth.find((h) => h.entityCode === entityCode);
}

// §15.2 — the agent workforce; eighteen roles, nine live in this prototype.
export function listAgents(): Agent[] {
  return agents;
}

export function getAgent(id: string): Agent | undefined {
  return agents.find((a) => a.id === id);
}

// §15.5 — an agent's own action log, most recent first. Designed agents have none (honest absence). The commitments
// agent's PO-targeted actions (§15.2.1) join the same log so its record page shows all of its work.
export function agentActions(agentId: string): AgentAction[] {
  return [...agentActionLog, ...poActionLog].filter((x) => x.agentId === agentId).sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
}

// §15.7/§15.1 — the worklist's agent lane: per-row state, pool counts and the one demo cycle control; the detail
// screen's decision record with its override exit (§15.1.2). Session-local, reset by tests like the worklist store.
export { agentCycleRan, creditBlockDecisionFor, decisionOverridden, decisionRecordFor, exceptionWalkthrough, laneForException, overrideDecision, resetAgentLaneStore, runNextAgentCycle, worklistAgentCounts } from './mock/agents';

// §15.7 — commitments watch: open POs by delivery date, chase state, amendments and value at risk of slipping past
// period-end; the PO detail page's decision record (the agent–owner exchange).
export { commitmentsWatch, getPurchaseOrder, poActionLog, poDaysOut, poDecisionFor, purchaseOrders } from './mock/commitments';

// §15.2.0 — the lifecycle coverage strip: seven P2P and seven O2C stages with agents positioned where they act.
export function coverageStrip(): CoverageStrip {
  return COVERAGE_STRIP;
}

// §15.5.1 — workforce summary line, computed at read time from live metrics (never stored).
export function agentWorkforceSummary(): AgentWorkforceSummary {
  const live = agents.filter((a) => a.status === 'live');
  let actionsThisPeriod = 0;
  let resolvedWithoutHuman = 0;
  let escalated = 0;
  let overriddenByHuman = 0;
  let reversed = 0;
  for (const a of live) {
    const m = a.metrics!;
    actionsThisPeriod += m.actionsThisPeriod;
    resolvedWithoutHuman += m.resolvedWithoutHuman;
    escalated += m.escalated;
    overriddenByHuman += m.overriddenByHuman;
    reversed += m.reversed;
  }
  return {
    liveRoles: live.length,
    totalRoles: agents.length,
    preventive: agents.filter((a) => a.type === 'preventive').length,
    actionsThisPeriod,
    resolvedWithoutHuman,
    escalated,
    overriddenByHuman,
    reversed,
  };
}

// §15.5.1 — the rates that find a mis-set delegation (integer %); nulls for designed agents. Session overrides from
// the detail screen's override control feed the numerator (§15.6).
export function agentRates(a: Agent): { escalationPct: number | null; overridePct: number | null; resolvedSharePct: number | null } {
  if (!a.metrics) return { escalationPct: null, overridePct: null, resolvedSharePct: null };
  const m = a.metrics;
  const overriddenByHuman = m.overriddenByHuman + sessionOverrideCount(a.id);
  return {
    escalationPct: Math.round((m.escalated / m.actionsThisPeriod) * 100),
    overridePct: Math.round((overriddenByHuman / m.resolvedWithoutHuman) * 100),
    resolvedSharePct: Math.round((m.resolvedWithoutHuman / m.actionsThisPeriod) * 100),
  };
}

// §15.6 — the governance slice on Risk & control carries only what needs attention: delegation breaches, reversals,
// overrides and value acted on without human review (the figure an auditor asks for first). Volume and resolution
// rates stay on the Agents screen — they are performance, not exposure. Raw metrics, no session overrides: this is
// the period's record, not a live demo state.
export function agentGovernanceSummary(): AgentGovernanceSummary {
  const live = agents.filter((a) => a.status === 'live');
  let delegationBreaches = 0;
  let reversed = 0;
  let overriddenByHuman = 0;
  let valueActedOnWithoutReviewCr = 0;
  let actionsThisPeriod = 0;
  let resolvedWithoutHuman = 0;
  let valueActedOnCr = 0;
  for (const a of live) {
    const m = a.metrics!;
    delegationBreaches += m.delegationBreaches;
    reversed += m.reversed;
    overriddenByHuman += m.overriddenByHuman;
    valueActedOnWithoutReviewCr += m.valueActedOnWithoutReviewCr;
    actionsThisPeriod += m.actionsThisPeriod;
    resolvedWithoutHuman += m.resolvedWithoutHuman;
    valueActedOnCr += m.valueActedOnCr;
  }
  return { delegationBreaches, reversed, overriddenByHuman, valueActedOnWithoutReviewCr, actionsThisPeriod, resolvedWithoutHuman, valueActedOnCr };
}

// §15.6 — interpret the rates rather than just displaying them: a rising override or reversal rate means a
// delegation is set wrong; a rising escalation rate means the policy needs updating, not that the agent is failing.
// A rise of two points or more across the six-period trend counts as rising.
export function governanceInterpretation(a: Agent): string | null {
  const m = a.metrics;
  if (!m) return null;
  const rise = (t?: number[]) => (t && t.length === 6 ? t[5] - t[0] : 0);
  if (rise(m.overrideRateTrend) >= 2) {
    const t = m.overrideRateTrend!;
    return `override rate has risen from ${t[0]}% to ${t[5]}% — the delegation may be set wrong`;
  }
  if (rise(m.reversalRateTrend) >= 2) {
    const t = m.reversalRateTrend!;
    return `reversal rate has risen from ${t[0]}% to ${t[5]}% — the delegation may be set wrong`;
  }
  if (rise(m.escalationRateTrend) >= 2) {
    const t = m.escalationRateTrend!;
    return `escalation rate has risen from ${t[0]}% to ${t[5]}% — the policy needs updating, not the agent`;
  }
  return null;
}

// §15.2 — whether an agent's actions are reversible, stated per card; advisory agents change nothing at all.
export function agentReversibility(a: Agent): string {
  if (a.advisoryOnly) return 'changes nothing';
  if (a.proposesOnly) return 'proposes only — a human releases the run';
  return 'reversible';
}

// §15.4 — the per-entity touch funnel; the commit is to touches per thousand, not an automation percentage.
export function listTouchFunnel(): TouchFunnelRow[] {
  return touchFunnel;
}

// §15.3 — JGL's illustrative glide path with the two levers separate; no other entity carries lever-stage figures.
export function getTouchLeverStages(code: string): TouchLeverStage[] | undefined {
  return code === 'JGL' ? jglLeverStages : undefined;
}
