// Domain types for the Finance Control Tower data layer (spec/03, §6).
// Values are reference data only — colors and status words are derived at render time.

export type Status = 'GREEN' | 'AMBER' | 'RED';
export type ProcessKey = 'p2p' | 'o2c' | 'r2r';
export type DimensionKey = 'operational' | 'service' | 'risk' | 'workingCapital' | 'dataQuality' | 'compliance';
export type Attribution = 'provider' | 'client' | 'system' | 'thirdParty';
export type ControlSignificance = 'High' | 'Medium' | 'Low';
export type Effort = 'Low' | 'Medium' | 'High';

// Last six periods; series[5] === current, series[4] === previous.
export interface Trend {
  current: number;
  previous: number;
  series: number[];
}

export interface Veto {
  id: string; // stable key so sensitivity items can name the veto they clear (§7.10)
  rule: string; // §3.5 condition text
  reason: string; // shown in the CAPPED badge next to the score
  cap: number;
  active: boolean;
  detectedThisPeriod?: boolean; // §7.15 — true when the failure appeared this period (excluded from the prior-period score)
}

// §7.10 — deltas are computed, never stored: a stored delta cannot survive a veto.
export interface SensitivityItem {
  action: string;
  dimension: DimensionKey | null; // null when the item only clears a veto (no weighted movement)
  dimensionMovement: number; // points on that dimension; resulting score is recomputed, not added
  clearsVeto?: Veto['id']; // deactivates this veto in the recompute
  effort: Effort;
}

export interface EntityMetrics {
  apBlocked: Trend; // ₹ cr
  apBlockedCount: number;
  apBlockedCountPrevious: number; // §7.16 — prior period
  o2cExceptionCount: number;
  o2cExceptionCountPrevious: number; // §7.16 — prior period
  arOver90: Trend; // ₹ cr
  arOver90Customers: number;
  cashUnapplied: Trend; // ₹ cr
  cashUnappliedReceipts: number;
  closePercent: Trend;
  closeBlockers: number;
  reconValue: Trend; // ₹ cr
  reconAgedBreaks: number;
  reconAgedBreaksPrevious: number; // §7.16 — prior period
  controlBreaches: number;
  highRiskJEs: number;
  apBlockedOldestDays: number; // §7.13 — oldest blocked invoice, days (surfaced in Step 4)
  arOver90OldestDays: number;
  cashUnappliedOldestDays: number;
  reconOldestDays: number;
  slaBreachCounts: Record<Attribution, number>; // §7.11 — counts only; total and pct are derived
  dso: Trend; // days — §7.14 full set, ordered with the working-capital dimension (JCP best / JRP worst)
  dpo: Trend; // days — §7.14 full set, same ordering as DSO; direction-neutral (§8.5.1)
  dpoAdjusted: number; // days — §8.6 headline DPO net of blocked-invoice inflation
  touchlessRate: Trend; // % — §7.14, orders with the operational dimension (JCP highest / JRP lowest)
  slaBreaches: Trend; // count — §7.14, current = sum of slaBreachCounts; group moves 148 → 142
  releasableCash: number; // ₹ cr — §7.19, all six entities (JGL 4.2)
  releasableItems: number; // item count behind releasableCash — §7.19, all six entities (JGL 38)
  queriesOverdue: number; // overdue service queries — §7.31, per entity (JGL 27); tracks the service dimension inversely
  accrualExposure?: number; // ₹ cr — §8.2, all six entities
  revenueAtRisk?: number; // ₹ cr — §8.2, all six entities
  provisionAdequacyPct?: number; // % — §8.2, all six entities
  fxIntercompanyExposure?: number; // ₹ cr — §8.2, all six entities
  accrualExposureNote?: string; // §8.2 — JGL tie line: the missing-GR share of blocked AP (no goods receipt means no accrual)
  unpostedGr?: { vendors: number; recurrenceMonths: number }; // §7.18 — value is accrualExposure itself (§8.2), stored once
  causeElimination?: CauseElimination; // §7.18 — per-entity backlog; notStarted derived
  cashOpportunity?: { value: number; items: number }; // §7.18 — ₹ cr / item count, scales with value at risk
}

export interface Entity {
  code: string; // 'JGL'
  name: string; // 'Jubilant Generics Ltd'
  segment: string;
  geography: string;
  dimensions: Record<DimensionKey, number>; // 0-100
  dimensionsPrevious: Record<DimensionKey, number>; // §7.15 — prior period, same keys
  vetoes: Veto[];
  metrics: EntityMetrics;
  sensitivity: SensitivityItem[];
}

// §2 — Group view grouping toggle; aggregated rows are computed in index.ts.
export type Grouping = 'entity' | 'segment' | 'geography';

export interface GroupRow {
  key: string; // entity code, or the segment / geography label for aggregated groups
  label: string;
  entityCodes: string[];
  score: number; // mean of member entities' displayed scores, rounded
  dimensions: Record<DimensionKey, number>; // per-dimension means, rounded
  dimensionsPrevious: Record<DimensionKey, number>; // §7.15 — prior-period per-dimension means, rounded
  apBlockedCr: Trend; // sum of members per period
  arOver90Cr: Trend; // sum of members per period
  cashUnappliedCr: Trend; // sum of members per period
  closePercent: Trend; // mean of members per period, rounded
  controlBreaches: number; // sum of members
}

export interface ProcessStage {
  processKey: ProcessKey;
  step: string; // 'INV'
  name: string; // 'Invoice'
  inFlight: number;
  inFlightValue: number; // ₹ cr
  inException: number;
  exceptionValue: number; // ₹ cr — exception % is derived (inException / inFlight), never stored
  status: Status;
}

// §7.6/§8.9 — one row of the exception lifecycle timeline (detail screen).
export interface TimelineEvent {
  dateLabel: string; // '15 Jul' or 'Today'
  time?: string; // 'HH:mm' for stamped rows
  text: string;
  tone: 'ok' | 'bad' | 'now';
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
  controlSignificance: ControlSignificance;
  attribution: Attribution;
  resolvableToday: boolean; // §7.19 — the clearing action is available and quick (receipt ready to post, variance within tolerance…); nothing has posted yet; effort derives from cause + this flag
  evidence?: string[]; // §7.6 — populated in a later step
  status?: 'open' | 'assigned' | 'chased' | 'released'; // §7.6 — populated in a later step
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
  recurrence: number; // months — displayed via formatRecurrence() (§7.12)
  concentration: string; // '11 vendors'
  concentrationCount?: number; // §7.13 — numeric cut behind a claim (e.g. nine customers)
  concentrationPctOfValue?: number; // §7.13 — % of value held by that count; a different cut from the segment split
  recordsCreatedQuarter?: number; // §7.13 — vendor-master: records created last quarter
  acceptanceRatePct?: number; // §7.13 — deductions: % eventually accepted
  agentResolvablePct?: number; // §15.4 — share of this cause an agent can resolve without a human (JGL mix)
  byGroup?: { name: string; count?: number; pct: number }[]; // §7.12/§7.13 — stored split so the narrative derives from data
  narrative: string;
  plants: { name: string; pct: number }[];
  vendors: { name: string; pct: number }[];
  actions: string[];
  eliminationStatus?: 'identified' | 'in-progress' | 'eliminated'; // §7.5 backlog — populated in a later step
  eliminationOwner?: string;
  eliminationTargetDate?: string;
}

// --- Forecast and service metrics (§6) ---

export interface ForecastDriver {
  id: string; // stable driver identity — rows and controls are selected by id, never by position (§7.23)
  label: string;
  valueCr: number;
  impact: number; // days
  assumptionEditable: true;
  assumptionNote?: string;
  baseSettleOn?: string; // '14 Jul 2026' — the assumed settlement date in the base case (§7.3)
  baseSettleIso?: string; // 'YYYY-MM-DD' of the same date — comparable against month-end, lexicographic = chronological
}

// §7.3 — a controller's contestation of one driver's assumption; absent or empty fields fall back to the base case.
export interface DriverAssumption {
  resolved?: boolean; // marked resolved — its impact drops out of the projection entirely
  settleIso?: string; // 'YYYY-MM-DD' user override of the settlement date; '' = cleared, falls back to baseSettleIso
}

export interface RankedAction {
  rank: number;
  action: string;
  owner: string;
  effort: Effort;
  improvement: number;
  unit: string; // 'days'
}

export interface Forecast {
  metric: 'dso' | 'dpo' | 'closeDate' | 'accrualExposure';
  entityCode: string;
  current: number;
  projected: number;
  unit: string;
  drivers: ForecastDriver[];
  actions: RankedAction[];
}

export interface ServiceMetric {
  sla: string; // 'Invoice processing TAT'
  process?: ProcessKey;
  target: string;
  achieved?: number; // percent — day-one rows only (§7.7)
  breaches?: number;
  attributionSplit?: Record<Attribution, number>;
  // §7.29 — 'measuring': the Finance Service Desk now supplies the clock start, so these SLAs report live to-date
  // figures but no achievement % until a full period has elapsed (and they stay out of the §7.11 breach totals).
  measurability: 'day-one' | 'measuring' | 'needs-register';
}

// §6 — one structured intake for every request into the service (§7.29). raisedOn is the SLA clock start;
// clockStoppedHours accrues only while awaiting-client — §5's attribution logic applied to requests, which is what
// makes the stop-clock defensible rather than contested.
export interface Request {
  id: string;
  type: 'query' | 'dispute' | 'masterData' | 'fixedAsset' | 'priceChange' | 'urgentPayment';
  entityCode: string;
  raisedBy: string;
  raisedOn: string; // ISO datetime — this is the SLA clock start
  category: string;
  owner: string;
  status: 'open' | 'in-progress' | 'awaiting-client' | 'closed';
  clockStoppedHours: number; // stop-clock while awaiting client
  resolvedOn?: string;
}

// --- Supporting datasets (spec/03 "Other datasets") ---

export interface CashOpportunity {
  name: string;
  value: number; // ₹ cr
  items: number;
  effort: Effort;
  owner: string;
}

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

// §7.5/§7.18 — cause elimination backlog counts; notStarted is derived (identified − eliminated − inProgress), never stored.
export interface CauseElimination {
  identified: number; // total causes in the elimination backlog
  eliminated: number; // fully eliminated
  inProgress: number; // elimination underway
}

// §7.30 — cause elimination backlog register: one row per identified cause, at entity level (the group taxonomy
// holds twelve nodes; the register holds thirty-four entity-specific rows). name / valueAtRisk / recurrence join
// from the taxonomy (mock/causes.ts) at read time and are never stored here. Owners are named people from the
// owning entity's §7.17 pool — not departments, same rule as §7.29. targetDate is relative per §7.21 and exists
// only on in-progress rows: a blank is more honest than an invented commitment. eliminatedInPeriod (1–6) places
// the elimination on the six-period trend; generatedLastPeriod backs the mechanism claim — the causes eliminated
// this period generated N exceptions last period and none in this one.
export interface CauseBacklogRow {
  id: string; // 'CB-JGL-01'
  entityCode: string;
  processKey: ProcessKey;
  causeKey: string; // taxonomy key — name / valueAtRisk / recurrence join at read time
  owner: string; // named person from the owning entity's §7.17 pool
  status: 'identified' | 'in-progress' | 'eliminated';
  targetDate?: string; // ISO date, relative per §7.21 — in-progress rows only
  eliminatedInPeriod?: number; // 1–6 — which trend period the elimination landed in (eliminated rows only)
  generatedLastPeriod?: number; // exceptions this cause generated last period (causes eliminated this period only)
}

export interface TransformationHealth {
  automationRatePct: number; // 68 (trending up)
  repeatExceptionsQoqPct: number; // -14
  causeElimination: CauseElimination; // §7.5 — group backlog figures; notStarted derived
  touchlessInvoicesPct: number; // 54
}

export interface ServiceControl {
  slaInvoiceBookingPct: number; // 93.1
  duplicatePaymentRiskCr: number; // 0.9
  manualPaymentRuns: number; // 4
}

// spec/08 — O2C cockpit header KPIs (labels and colors composed at render time).
export interface O2cKpis {
  dsoDays: number; // 62
  overdueArCr: number; // 20.6
  unappliedCr: number; // 3.1
}

// spec/08 — O2C service & control rows (labels composed at render time, as for P2P).
export interface O2cServiceControl {
  billingAccuracyPct: number; // 96.4
  openDisputes: number; // 34
  ordersOnCreditBlock: number; // 18
  unappliedReceipts: number; // 19
}

export interface GroupSummary {
  score: number; // computed — groupScore()
  scorePrevious: number; // §7.15 — computed — groupScorePrevious()
  valueAtRiskCr: number; // computed — valueAtRisk()
  valueAtRiskTrend: Trend; // §7.14 — sum of entity apBlocked + arOver90 trends per period
  openExceptions: number; // computed — openExceptions()
  openExceptionsPrevious: number; // §7.16 — computed — openExceptionsPrevious()
  closeProgress: CloseProgress;
  transformationHealth: TransformationHealth;
}

// --- Risk & control (§7.8) ---

export type ControlCategory = 'payment' | 'authority' | 'system' | 'cutoff' | 'exposure';

export interface ControlSignal {
  id: string;
  category: ControlCategory;
  title: string; // pinned verbatim in §7.8
  detail: string;
  severity: ControlSignificance;
  valueAtRiskCr?: number; // absent where the exposure cannot be quantified (SoD conflict, unapproved terms change)
  entityCode: string;
  detectedOn: string; // '14 Jul 2026' — derives as today − N days (§7.21), so it stays inside a recent window whenever the prototype opens
}

// §7.8 item 6 — stored counts behind the AP automation tool's own controls; rates are computed in index.ts.
export interface ApControlEffectiveness {
  duplicate: { flaggedYtd: number; overriddenYtd: number };
  threeWayMatch: { failedYtd: number; overriddenYtd: number };
  valuePreventedYtdCr: number; // payments stopped by these controls year to date
}

// §6/§7.24 — counterparty pages (vendor / customer), reached by drill only (§9.1). Vendors derive from the
// §7.17 exception rows; customers are the ones named in the §7.23 forecast drivers, so a driver drills to a page that exists.
export interface Counterparty {
  id: string; // vendor ids are name slugs; customer ids reuse the forecast driver's id (§7.23)
  name: string;
  type: 'vendor' | 'customer';
  entityCode: string;
  openCommitmentsCr: number; // vendors: open POs not yet invoiced (ties to the PO stage in-flight value); customers: 0
  blockedCr: number; // vendors: Σ of the vendor's exception amounts; customers: 0
  disputesCr: number; // vendors: po-price-mismatch share; customers: dispute/deduction exposure
  ageingBuckets: AgeingBucket[]; // sums to blockedCr (vendors) / exposureCr (customers)
  lastPaymentDate?: string; // vendors only — '14 Jul 2026'
  ytdSpendCr?: number; // vendors only
  exposureCr?: number; // customers only — the forecast driver's value
  creditBlocked?: boolean; // customers only
  paymentBehaviour?: string; // customers only — reuses the O2C cause narrative vocabulary
  releasePath?: string; // customers with a credit block — the forecast action that releases it, with owner
  openItems: string[]; // Exception ids (vendors); empty for customers
}

// §7.24 — plant counterparty page. JGL's blocked split follows the §7.5 missing-GR plant distribution; other entities group-sum their rows.
export interface PlantCounterparty {
  id: string; // `${entityCode}-${slug(name)}` — the entity prefix disambiguates same-named sites (JGL/JBL Noida)
  name: string;
  entityCode: string;
  blockedCr: number; // Σ of the plant's exception amounts (ties to the worklist shown value per entity)
  grCompliancePct: number; // goods receipt compliance — worst at the plant carrying most of the block
  openItems: string[]; // Exception ids at this plant
}

// §7.24 — cost centre page. Committed spend is open POs not yet invoiced — per entity it ties to the PO stage in-flight value (§7.4).
export interface CostCentre {
  id: string; // `${entityCode}-${slug(name)}`
  name: string;
  entityCode: string;
  budgetCr: number;
  bookedSpendCr: number;
  committedSpendCr: number; // Σ of openPos values — the part most tools miss and the part a controller trusts
  openPos: { po: string; valueCr: number }[];
}

// §15.2.1/§15.7 — commitments watch: one open PO from the cost-centre pool, with its delivery date, chase state and
// (once the agent engages) the full owner exchange. The named rows are a sample of the stage's in-flight pool; their
// values tie to CostCentre.openPos exactly, so the watch reconciles to the same ₹ figure as the cost-centre pages.
export type PoChaseState = 'on-track' | 'chased' | 'amended' | 'proposed';

export interface PoExchange {
  askedAt: string; // ISO — the agent's chase message to the PO owner
  askText: string; // what the agent asked, in plain language
  reply?: { at: string; text: string }; // the quoted owner reply (absent while awaiting)
  extractedDate?: string; // ISO — the date the agent read out of the reply (§15.2.1: what it understood)
  confidence?: number; // 0–1 — the agent's reading of the reply; compared against the delegation threshold
  understoodAt?: string; // ISO — when the agent logged its reading (amended and proposed alike)
  amendment?: { from: string; to: string; postedAt?: string }; // DATE ONLY — postedAt absent for a proposal
  proposedAt?: string; // ISO — when the proposal was escalated (proposed only)
  notificationText?: string; // what the owner was told about exactly what changed (amended only)
  notifiedAt?: string; // ISO — when that notification went out (amended only)
}

export interface PurchaseOrder {
  id: string; // 'PO-48115'
  entityCode: string;
  costCentreId: string; // ties to the cost-centre page's pool — same PO, same value
  vendorName: string;
  ownerName: string; // the client-side PO owner the agent chases (§7.17 pool)
  valueCr: number; // equals the CostCentre.openPos entry exactly
  deliveryDate: string; // ISO — current SAP state (for an amended PO, the new date)
  originalDeliveryDate?: string; // present when amended — the stale date that would have corrupted the accrual
  chaseState: PoChaseState;
  exchange?: PoExchange; // present once the agent has engaged with the owner
}

// §6/§7.26 — statutory obligations per entity, jurisdiction-matched in the dataset; only JRP carries an overdue item
// (§7.26). valueAtRiskCr follows the §7.26 exposure table (ITC / input tax at risk, MSMED ageing); failCount carries
// count-based operational failures where the spec states a number rather than a rupee figure — e-invoice IRN failures
// are India-only, the US/Canada equivalent being Form 1099 TIN mismatches; failureLabel names each kind.
export interface ComplianceItem {
  obligation: string;
  entityCode: string;
  dueDate: string; // 'YYYY-MM-DD' — ISO so a string compare is chronological
  status: 'filed' | 'due' | 'overdue';
  valueAtRiskCr?: number;
  failCount?: number;
  failureLabel?: string; // e.g. 'IRN failures' / 'TIN mismatches' — rendered as `${failCount} ${failureLabel}`
  evidenceRef?: number;
}

// §6/§7.27 — master-data and interface quality checks per entity/domain. JGL anchors are pinned in the spec; the other
// entities scale by (100 − dataQuality) / 10 so fail rates order inversely with the dimension (§7.27).
export interface DataQualityItem {
  check: string;
  domain: 'vendor' | 'customer' | 'gl' | 'interface';
  entityCode: string;
  failCount: number;
  totalCount: number;
  impact: string; // downstream consequence, stated per §7.27's table
}

// §7.27 — interface health per entity (failed IDocs come from the interface DataQualityItem above).
export interface InterfaceHealth {
  entityCode: string;
  status: 'on schedule' | 'delayed' | 'stale';
  lastSuccessfulRun: string; // '31 Aug 2026, 04:00'
}

// --- §15 — the agent workforce ---
// The task mandates status 'live' | 'designed' (nine live in this prototype, nine specified but not built); that
// overrides §15.5's 'active' | 'paused' | 'shadow'. metrics is optional: only live agents carry them — designed
// agents render the honest-absence pattern of §7.7. process / type / boundedBy / advisoryOnly / proposesOnly extend
// §15.5's shape with the roster-grouping and boundary facts from §15.2 / §15.2.1.

export type AgentProcess = 'shared' | 'p2p' | 'o2c';

export type AgentType = 'preventive' | 'reactive';

export type AgentStatus = 'live' | 'designed';

// §15.5 — delegation of authority, verbatim from the spec's shape.
export interface Delegation {
  valueCapCr?: number;
  toleranceBand?: string;
  confidenceThreshold?: number; // §15.2.1 — commitments only: below it the agent proposes and escalates rather than amending
  requiresDualControl: boolean;
  neverActsOn: string[]; // e.g. ['vendor bank details']
  escalatesWhen: string[];
}

// §15.5 — per-period performance, live agents only. resolvedShareTrend is a six-period series (series[5] === the
// current resolved share %) feeding the Metric sparkline, mirroring Trend's shape. The three rate trends feed the
// governance slice on Risk & control (§15.6): each ends at its current rate, and a rising one is interpreted there,
// not just displayed. delegationBreaches counts actions outside the stated authority — zero in this dataset, where
// every logged action carries withinDelegation: true.
export interface AgentMetrics {
  actionsThisPeriod: number;
  resolvedWithoutHuman: number;
  escalated: number;
  overriddenByHuman: number;
  reversed: number;
  valueActedOnCr: number;
  valueActedOnWithoutReviewCr: number;
  delegationBreaches: number; // §15.6 — zero in this dataset (every logged action is withinDelegation)
  resolvedShareTrend?: number[]; // six periods, series[5] === current resolved share %
  escalationRateTrend?: number[]; // six periods, series[5] === current escalation rate % (§15.6)
  overrideRateTrend?: number[]; // six periods, series[5] === current override rate % (§15.6)
  reversalRateTrend?: number[]; // six periods, series[5] === current reversal rate % (§15.6)
}

// §15.2 — agents are staff, not features: name, scope, delegation of authority, a named human supervisor from the
// §7.17 pool for that entity, and a status every card states.
export interface Agent {
  id: string; // 'follow-up'
  number: number; // roster position 1–18 (§15.2) — shown on cards and in the coverage strip
  name: string; // 'Follow-up & escalation'
  process: AgentProcess;
  type: AgentType;
  scope: string; // "Acts on" / "What it does" from §15.2's tables, verbatim
  boundedBy: string; // the "Bounded by" column, verbatim
  delegation: Delegation;
  supervisor: string; // a named human from the §7.17 pool for that entity
  status: AgentStatus;
  advisoryOnly?: boolean; // agents 4, 5, 13, 14 — flag and nudge but change nothing (§15.2)
  proposesOnly?: boolean; // agent 12 — assembles the run; a human releases it (§15.2)
  metrics?: AgentMetrics; // live agents only
}

// §15.1.2 — one check in a decision record: the test, its threshold, the actual value, pass or fail. Each opens.
export interface AgentCheck {
  test: string; // 'Value inside the auto-approve cap'
  threshold: string; // '≤ ₹4.2 cr (agent cap)'
  actual: string; // '₹1.42 cr'
  pass: boolean;
}

// §15.5 — one entry in an agent's action log, verbatim from the spec's shape. The decision-record fields (§15.1.2)
// are populated for exception-targeted actions so the detail page can carry trigger / checks / precedents /
// delegation / action / declined / reversibility.
export interface AgentAction {
  id: string;
  agentId: string;
  targetType: 'exception' | 'request' | 'creditBlock' | 'po'; // §15.2.1 — the commitments agent acts on POs, not exceptions
  targetId: string;
  entityCode: string;
  takenAt: string; // relative per §7.21
  action: string; // 'Chased plant stores, 2nd nudge'
  outcome: 'resolved' | 'escalated' | 'awaiting' | 'reversed' | 'overridden';
  rationale: string;
  precedents: string[]; // ids a human can open
  evidence: string[];
  reversible: boolean;
  withinDelegation: true;
  reviewedBy?: string;
  trigger?: string; // §15.1.2 — what set the agent on this item
  checks?: AgentCheck[]; // each test with threshold and actual value, openable
  declined?: string; // what it deliberately did NOT do, and why — matters more than the action line
  reversibility?: string; // how the action is undone if wrong
}

// §15.7 — one row of the worklist's agent lane: what the agents have done with this item, derived at read time
// from the action log (never stored per row). Four states per §15.1.1.
export interface AgentLane {
  state: 'working' | 'escalated' | 'resolved' | 'never-automated';
  agentId?: string; // which agent is on it — absent for never-automated rows
  detail: string; // working → next escalation timer · escalated → the reason · resolved → what the agent did · never-automated → why it stays human
}

// Step 22 — one step of the exception-detail walkthrough: a flat, factual caption or a small set of dated events.
// Stepped, not animated (§15.1.2's 'resist animating the agent reasoning').
export interface WalkthroughEvent {
  dateLabel?: string; // absent where no pinned date exists in the dataset
  actor: 'agent' | 'system'; // §15.7 — agent rows are visually distinct from human/system ones
  text: string;
}

export interface WalkthroughStep {
  title: string;
  caption?: string; // a flat line under the title (the five test names, the audit flag)
  events?: WalkthroughEvent[];
  supervision?: boolean; // the final step — links to the supervision record, no event of its own
}

// §15.1.1 — the worklist header's agent output line, computed at read time from the pool and the lane store.
export interface WorklistAgentCounts {
  pool: number; // '327 blocked'
  cleared: number; // '241 resolved by agents' — a disposition, not a release (no write-back)
  needYou: number; // '86 need you'
}

// §15.4 — one row of the per-entity touch funnel. agentResolvedPct + humanPct = manualPct exactly;
// touches per 1,000 are manual × 10 today and human × 10 after.
export interface TouchFunnelRow {
  code: string; // entity code
  touchlessPct: number;
  manualPct: number;
  agentResolvedPct: number;
  humanPct: number;
  touchesTodayPer1000: number;
  touchesAfterPer1000: number;
}

// §15.3 — one stage of JGL's illustrative glide path; the two levers compound across stages and cost differently.
export interface TouchLeverStage {
  label: string; // 'Today' | 'After cause elimination' | 'Effective — agents on the residue'
  touchlessPct: number;
  touchesPer1000: number;
}

// §15.5.1 — workforce summary line, computed at read time (never stored).
export interface AgentWorkforceSummary {
  liveRoles: number;
  totalRoles: number;
  preventive: number;
  actionsThisPeriod: number;
  resolvedWithoutHuman: number;
  escalated: number;
  overriddenByHuman: number;
  reversed: number;
}

// §15.6 — the governance slice on Risk & control: exceptions and exposure only, computed at read time over live
// agents (never stored). The last three fields are denominators for the sub-lines under the four headline figures,
// not headline figures themselves.
export interface AgentGovernanceSummary {
  delegationBreaches: number; // zero in this dataset — every logged action is withinDelegation
  reversed: number;
  overriddenByHuman: number;
  valueActedOnWithoutReviewCr: number; // the figure an auditor asks for first
  actionsThisPeriod: number; // denominator context only
  resolvedWithoutHuman: number; // denominator context only
  valueActedOnCr: number; // denominator context only
}

// §15.2.0 — lifecycle coverage strip: seven P2P + seven O2C stages with agents positioned where they act.
export interface CoverageStage {
  code: string; // 'PR' | 'PO' | ...
  agents: string[]; // agent ids acting at this stage, in roster order
  preClose?: string[]; // agents acting before close (provisioning under INV)
}

export interface CoverageStrip {
  p2p: CoverageStage[];
  o2c: CoverageStage[];
}
