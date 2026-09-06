# Product model — entities, scoring, attribution, data types

## §1. Product framing

The Finance Control Tower is a controllership platform for a finance managed
services engagement. It reports the health of the client's finance operation
across P2P, O2C and R2R; explains what is driving it down to the transaction;
attributes every delay to its true owner; predicts where the position is heading;
and tracks the actions that improve it.

**What it is NOT** — do not build any of this:

- Management reporting, P&L, or variance commentary generation
- Close task orchestration or sign-off workflow (close *status* is read-only)
- Any control that a source system already enforces (e.g. duplicate invoice
  blocking). The platform monitors control **effectiveness and bypass**, never
  re-runs the control.

### 1.1 Naming

One product name only: **Finance Control Tower**. Remove "Controller Cockpit"
everywhere it appears as a competing brand. The sidebar wordmark becomes:

```
Finance Control Tower
JUBILANT PHARMOVA
```

Individual screens may be called cockpits ("P2P cockpit"), but the product is the
Control Tower.

---

## §2. Legal entities

The current prototype lists entities that do not belong to this group. **Jubilant
Ingrevia is a separately listed company and must be removed. "Jubilant Life
Sciences NV" is a legacy name and must be removed.**

Replace the entity list with exactly these six:

| Code | Legal entity | Segment | Geography | Currency |
|---|---|---|---|---|
| JGL | Jubilant Generics Ltd | Generics | India | INR |
| JBL | Jubilant Biosys Ltd | CRDMO | India | INR |
| JPS | Jubilant Pharma Ltd | Holding | Singapore | SGD |
| JCP | Jubilant Cadista Pharmaceuticals Inc | Generics | United States | USD |
| JHS | Jubilant HollisterStier LLC | CDMO Sterile Injectables | US / Canada | USD |
| JRP | Jubilant Radiopharma | Radiopharma | US / Canada | USD |

**Jubilant Ingrevia is a related party, not a group entity.** It was demerged into
a separately listed company. It must not appear as a legal entity, an entity row,
or an assistant answer — but references to it as an *intercompany counterparty*
are correct and must be preserved (e.g. the cash opportunity "Clear intercompany
netting with Ingrevia"). Removing those would be an error.

> **Note for the human, not for the model:** confirm this list against the FY26
> annual report before any client-facing use. Segment names are correct; exact
> legal entity names may differ.

Grouping values for the Group view toggle — these must produce real aggregation,
not six groups of one:

| Grouping | Values |
|---|---|
| Entity | the six above |
| Segment | Generics (JGL, JCP) · CRDMO (JBL) · Holding (JPS) · CDMO Sterile Injectables (JHS) · Radiopharma (JRP) |
| Geography | India (JGL, JBL) · Singapore (JPS) · North America (JCP, JHS, JRP) |

**Plant is not a grouping at entity level.** Plant data does not exist yet and JPS
has no manufacturing site. Plant views arrive in Step 11, built from exception-level
`plant` fields. Do not add a Plant option to this toggle.

All amounts display in INR crore (`₹NN.N cr`) regardless of entity functional
currency. Assume conversion has already happened in the data layer.

---

## §3. The scoring model

### 3.1 Six scored dimensions

Every entity and every process is scored on the same six dimensions. These
replace the five unlabelled colour bars in the current Group view.

| # | Dimension | Key | What it covers |
|---|---|---|---|
| 1 | Operational | `operational` | Volume, throughput, exception rate, ageing, touchless / straight-through rate, first-time-right, rework, backlog |
| 2 | Service & attribution | `service` | SLA and TAT performance, breaches, escalations, query resolution — split by originating cause |
| 3 | Risk & control | `risk` | Control effectiveness and bypass, authority breaches, sensitive master data changes, SoD, cut-off integrity, undisclosed exposure |
| 4 | Working capital | `workingCapital` | Value locked in exceptions, ageing profiles, DSO/DPO components under service control, releasable cash |
| 5 | Data & MDM quality | `dataQuality` | Vendor and customer master completeness, duplicates, dormancy, tax registration validity, payment term integrity, interface health |
| 6 | Compliance | `compliance` | Statutory obligations with deadlines and penalties — GST and ITC at risk, TDS, MSMED ageing, e-invoicing failures, certifications |

**Cost-to-serve is deliberately excluded.** It is a provider margin metric, not a
client-facing dimension. Do not add it. Touchless rate and first-time-right belong
inside Operational.

### 3.2 Weights

Fixed and displayed to the user (they are contractual):

```
operational      0.20
service          0.15
risk             0.20
workingCapital   0.20
dataQuality      0.10
compliance       0.15
```

### 3.3 Bands

```
score >= 85            green
score >= 65 and < 85   amber
score < 65             red
```

Banding already exists in `src/theme/derive.ts` as `scoreColor()` and
`statusWord()`. **Reconcile with those functions — do not re-implement banding in
a component or in the data layer.** If the existing thresholds differ from the
table above, change them in `derive.ts` and fix any test that asserts the old
values. There must be exactly one place in the codebase that decides a band.

### 3.4 Score computation

```
raw = Σ (dimensionScore × weight)
final = min(raw, ...all active veto caps)
displayed = Math.round(final)
```

### 3.5 Veto rules

A veto **caps** the score regardless of the weighted arithmetic. An additive score
hides exactly the single failures a controller most needs to see.

| Veto condition | Cap |
|---|---|
| Any statutory return filed late or overdue | 60 |
| Unauthorised or unverified vendor bank detail change, unresolved | 55 |
| Segregation-of-duties conflict open beyond 30 days | 65 |

When a veto is active the UI must show a badge next to the score reading
`CAPPED — <reason>` and, on hover or click, the raw uncapped score.

### 3.6 Sensitivity

Every score display must be able to answer "what moves it". Each entity carries a
list of `sensitivity` items:

```
{ action: string, deltaScore: number, dimension: DimensionKey, effort: 'Low'|'Medium'|'High' }
```

Rendered as: *"Clearing GR compliance on 11 vendors: 74 → 81"*.

### 3.7 Group score

`groupScore = round(mean(entity.displayedScore))` — a simple mean across the six
entities. Compute it; never hardcode it.

The same rule applies to any aggregated row in the Group view (Segment, Geography):
**scores and percentages aggregate as the mean of members' displayed integers;
money and counts sum.** Meaning the mean is taken over what is on screen, so a user
can verify an aggregate by averaging the rows above it.

Note the deliberate choice: a simple mean means a small entity counts as much as a
large one. That is correct for a *health* score, because assurance obligations
attach to each legal entity regardless of its size — a controller cannot ignore a
statutory breach in a small entity because it is small. Value-weighting (§3.8)
applies to comparing exposure, not to weighting assurance.

### 3.8 Normalisation rule

Dimension scores are already normalised 0–100 in the dataset. Where the UI derives
any comparison across entities, it must use **value-weighted, size-normalised**
measures — e.g. blocked AP as a percentage of total AP, never absolute crore — so
a small entity is not flattered by scale. Absolute crore is used only for
displaying exposure, never for ranking entities against each other.

---

## §4. Health score vs Service scorecard

These are **two separate objects** and must never be merged into one number.

| Object | What it measures | Credits |
|---|---|---|
| **Health score** | The state of the client's finance operation, including problems the client's own organisation causes. Diagnostic. | None |
| **Service scorecard** | Contractual SLA/TAT performance, net of client-caused and third-party delay. | Service credits attach here, and only here |

They are joined by **attribution** (§5). Both are displayed side by side on the
Service & attribution screen.

---

## §5. Attribution

Every delay, SLA breach and ageing item carries an `attribution` field:

```
'provider' | 'client' | 'system' | 'thirdParty'
```

Group-level illustrative split of SLA breaches:

```
client      0.71
provider    0.18
system      0.07
thirdParty  0.04
```

The UI shows this as a horizontal stacked bar. Every attributed item must expose
an evidence trail (`evidence: string[]` — timestamps and events, e.g.
`"Invoice received 04-Aug 09:12"`, `"GR posted 18-Aug 14:40"`).

Purpose, in the demo narrative: it protects the provider's commercial position,
gives the client a lever over its own organisation, and makes the platform
credible because it publishes the provider's own failures.

---

## §6. Data model

Put all of this in one module (see PROMPTS step 1). TypeScript interfaces below;
if the project is plain JS, use JSDoc typedefs with the same shape.

```ts
type DimensionKey = 'operational' | 'service' | 'risk'
                  | 'workingCapital' | 'dataQuality' | 'compliance';

type Band = 'green' | 'amber' | 'red';
type Attribution = 'provider' | 'client' | 'system' | 'thirdParty';
type Mode = 'close' | 'bau' | 'preclose';
type Trend = { current: number; previous: number; series: number[] }; // series = last 6 periods

interface Entity {
  code: string;                 // 'JGL'
  name: string;                 // 'Jubilant Generics Ltd'
  segment: string;
  geography: string;
  dimensions: Record<DimensionKey, number>;   // 0-100
  vetoes: Veto[];
  metrics: EntityMetrics;
  sensitivity: SensitivityItem[];
}

interface Veto { rule: string; reason: string; cap: number; active: boolean; }

interface EntityMetrics {
  apBlocked: Trend;             // ₹ cr
  apBlockedCount: number;
  o2cExceptionCount: number;
  arOver90: Trend;              // ₹ cr
  arOver90Customers: number;
  cashUnapplied: Trend;         // ₹ cr
  cashUnappliedReceipts: number;
  closePercent: Trend;
  closeBlockers: number;
  reconValue: Trend;            // ₹ cr
  reconAgedBreaks: number;
  controlBreaches: number;
  highRiskJEs: number;
  dso: Trend;
  dpo: Trend;
  releasableCash: number;       // ₹ cr
  accrualExposure: number;      // ₹ cr — see §8.2
}

interface SensitivityItem {
  action: string; deltaScore: number; dimension: DimensionKey;
  effort: 'Low' | 'Medium' | 'High';
}

interface Exception {
  id: string;                   // 'AP-104281'
  entityCode: string;
  process: 'P2P' | 'O2C' | 'R2R';
  counterpartyId: string;       // vendor or customer id
  counterpartyName: string;
  amountCr: number;
  ageDays: number;
  cause: string;                // must exist in the taxonomy, §6.1
  plant: string;
  owner: string;
  attribution: Attribution;
  controlSignificance: 'High' | 'Medium' | 'Low';
  evidence: string[];
  status: 'open' | 'assigned' | 'chased' | 'released';
}

interface RootCause {
  cause: string;
  process: 'P2P' | 'O2C' | 'R2R';
  sharePercent: number;
  valueAtRiskCr: number;
  avgDelayDays: number;
  recurrenceMonths: number;
  concentration: string;        // '11 vendors'
  byPlant: { name: string; percent: number }[];
  byGroup: { name: string; percent: number }[];
  interventions: string[];
  eliminationStatus: 'identified' | 'in-progress' | 'eliminated';
  eliminationOwner?: string;
  eliminationTargetDate?: string;
}

interface Counterparty {
  id: string; name: string; type: 'vendor' | 'customer';
  entityCode: string;
  openCommitmentsCr: number;
  blockedCr: number;
  disputesCr: number;
  ageingBuckets: { bucket: string; amountCr: number }[];
  lastPaymentDate?: string;
  ytdSpendCr?: number;          // vendors
  exposureCr?: number;          // customers
  creditBlocked?: boolean;      // customers
  paymentBehaviour?: string;    // customers
  openItems: string[];          // Exception ids
}

interface ControlSignal {
  id: string;
  category: 'payment' | 'authority' | 'system' | 'cutoff' | 'exposure';
  title: string;
  detail: string;
  severity: 'High' | 'Medium' | 'Low';
  valueCr?: number;
  entityCode: string;
  detectedOn: string;
  status: 'open' | 'investigating' | 'cleared';
  restricted: true;             // all control signals are restricted-access
}

interface ComplianceItem {
  obligation: string;           // 'GSTR-3B — August'
  entityCode: string;
  dueDate: string;
  status: 'filed' | 'due' | 'overdue';
  valueAtRiskCr?: number;       // e.g. ITC at risk
  evidenceRef?: string;
}

interface DataQualityItem {
  check: string;                // 'Vendor master — missing PAN'
  domain: 'vendor' | 'customer' | 'gl' | 'interface';
  entityCode: string;
  failCount: number;
  totalCount: number;
  impact: string;               // 'Blocks e-invoice validation'
}

interface Forecast {
  metric: 'dso' | 'dpo' | 'closeDate' | 'accrualExposure';
  entityCode: string;
  current: number;
  projected: number;
  unit: string;
  drivers: ForecastDriver[];
  actions: RankedAction[];
}

interface ForecastDriver {
  label: string; valueCr: number; impact: number;
  assumptionEditable: true; assumptionNote?: string;
}

interface RankedAction {
  rank: number; action: string; owner: string;
  effort: 'Low' | 'Medium' | 'High'; improvement: number; unit: string;
}

interface ServiceMetric {
  sla: string;                  // 'Invoice processing TAT'
  process: 'P2P' | 'O2C' | 'R2R';
  target: string;
  achieved: number;             // percent
  breaches: number;
  attributionSplit: Record<Attribution, number>;
  measurability: 'day-one' | 'needs-service-desk' | 'needs-register';
}

interface Request {                 // Finance Service Desk intake
  id: string;
  type: 'query' | 'dispute' | 'masterData' | 'fixedAsset'
      | 'priceChange' | 'urgentPayment';
  entityCode: string;
  raisedBy: string;
  raisedOn: string;               // ISO datetime — this is the SLA clock start
  category: string;
  owner: string;
  status: 'open' | 'in-progress' | 'awaiting-client' | 'closed';
  clockStoppedHours: number;      // stop-clock while awaiting client
  resolvedOn?: string;
}
```

### 6.1 Cause taxonomy — fixed, do not extend

```
P2P: PO · goods receipt · pricing · approval · vendor master · tax
     · duplicate · invoice quality · interface
O2C: billing · pricing · deduction · dispute · collection
     · cash application · customer master
R2R: source data · journal · reconciliation · intercompany
     · master data · interface · close dependency · judgement
```

Causes are captured at the point of exception, never reconstructed later. The UI
must never display a cause outside this list.

---

## §12. Explicitly out of scope

Do not build, and reject any instruction to build:

- P&L, MIS, or variance commentary generation
- Close task orchestration, sequencing or sign-off workflow
- Duplicate payment checking, three-way match enforcement, or any other control
  the source system already runs
- Cost-to-serve or provider margin metrics on client-facing screens
- Any authentication, backend, or database. This is a front-end prototype with a
  static dataset module.

---
