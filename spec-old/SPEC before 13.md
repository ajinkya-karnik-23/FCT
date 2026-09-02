# Finance Control Tower — Prototype Specification

Version 2.0 · Target state for the Jubilant Pharmova demo prototype

---

## §0. How to use this file

This is the single source of truth for the prototype. **Do not read it end to end.**
Each prompt in `PROMPTS.md` tells you which sections to read. Read only those.

**This file is maintained outside the build. Do not edit it.** If a task claims
something is already in the spec and it is not, or you find a contradiction, say so
in your report and proceed — an edit here silently diverges your copy from the
maintained one, and every later task reads the wrong source of truth.

**§13 (codebase conventions) applies to every task. Read it once at the start of
a session and treat it as always in force.**

Rules that apply to every task in this project:

- **Never invent numbers.** All figures come from the canonical dataset (§7). If a
  number you need is not there, add it to the dataset module first, then use it.
- **Never invent colours, fonts or spacing.** Use the existing design tokens (§10).
- **Never add a runtime dependency** without being told to.
- **Never refactor files outside the task's stated scope.**
- **Never delete an existing screen** unless the task says to.
- Keep the existing dark theme, layout grammar and component style.
- Every figure displayed anywhere must be clickable and drill somewhere (§8.4).
- A step is not done until `npm test`, `npm run verify:theme` and
  `npm run verify:drills` all pass. Update affected tests in the same step.

---

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

## §7. Canonical dataset

All figures below are illustrative and must be used verbatim so screens stay
internally consistent. A CA will add these up in the demo.

### 7.1 Entity dimension scores

| Entity | operational | service | risk | workingCapital | dataQuality | compliance |
|---|---|---|---|---|---|---|
| JGL | 74 | 78 | 62 | 58 | 90 | 96 |
| JBL | 66 | 72 | 54 | 54 | 82 | 88 |
| JPS | 82 | 84 | 75 | 73 | 88 | 90 |
| JCP | 92 | 94 | 88 | 86 | 94 | 96 |
| JHS | 88 | 88 | 86 | 84 | 92 | 94 |
| JRP | 64 | 66 | 46 | 48 | 74 | 60 |

Computed scores (use as acceptance tests — the code must produce these):

```
JGL 74   JBL 67   JPS 81   JCP 91   JHS 88   JRP 55 (capped from 58)
groupScore = round((74+67+81+91+88+55)/6) = 76
```

JRP carries **two** active vetoes:

| Veto | Cap |
|---|---|
| Statutory return filed late — GST/HST return overdue (§7.26) | 60 |
| Unauthorised vendor bank change, unresolved (§7.8) | 55 |

Effective cap is the minimum, 55, so the displayed score is unchanged. Both must be
present because clearing them one at a time is a demo path: resolve the bank change
and the score rises to 58; file the return and it rises to its raw 57.9 → 58 with
no cap. All other entities have no active veto.

### 7.2 Entity metrics (current period)

| Entity | AP blocked ₹cr | invoices | AR>90 ₹cr | customers | Unapplied ₹cr | receipts | Close % | blockers | Recon ₹cr | breaks | Breaches | High-risk JEs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| JGL | 18.6 | 327 | 12.4 | 41 | 3.1 | 19 | 78 | 7 | 14.3 | 18 | 4 | 12 |
| JBL | 11.3 | 214 | 8.9 | 28 | 2.4 | 14 | 61 | 9 | 9.8 | 21 | 6 | 15 |
| JPS | 6.8 | 96 | 5.1 | 12 | 1.2 | 6 | 88 | 3 | 4.1 | 7 | 2 | 5 |
| JCP | 2.1 | 41 | 1.9 | 7 | 0.3 | 2 | 96 | 1 | 1.4 | 2 | 0 | 2 |
| JHS | 4.2 | 68 | 3.8 | 11 | 0.6 | 4 | 94 | 2 | 2.7 | 4 | 0 | 3 |
| JRP | 14.7 | 268 | 10.6 | 34 | 4.0 | 23 | 52 | 11 | 12.6 | 26 | 7 | 19 |

Derived group figures — **compute, never hardcode**:

```
Value at risk   = Σ (apBlocked + arOver90)                          = ₹100.4 cr
Open exceptions = Σ (apBlockedCount + o2cExceptionCount + reconAgedBreaks)

o2cExceptionCount by entity: JGL 284 · JBL 196 · JPS 84 · JCP 31 · JHS 52 · JRP 241
```

Previous-period values for trends: apply these deltas to derive `previous`
(so every headline number can show direction of travel):

```
JGL  apBlocked 22.1 → 18.6 (improving)   arOver90 11.2 → 12.4 (worsening)
JBL  apBlocked 10.4 → 11.3 (worsening)   arOver90  9.6 →  8.9 (improving)
JPS  apBlocked  7.9 →  6.8 (improving)   arOver90  4.8 →  5.1 (worsening)
JCP  apBlocked  2.4 →  2.1 (improving)   arOver90  2.1 →  1.9 (improving)
JHS  apBlocked  4.0 →  4.2 (worsening)   arOver90  4.1 →  3.8 (improving)
JRP  apBlocked 13.2 → 14.7 (worsening)   arOver90  9.8 → 10.6 (worsening)
```

For all other Trend fields, generate a 6-point series that ends on `current` and
moves plausibly. Keep it deterministic — no `Math.random()` anywhere in this
project.

### 7.3 JGL working capital and forecast anchors

```
DSO   62 days today, 72 projected at month-end
DPO   48 days (flag: inflated by blocked invoices — see §8.6)
Releasable cash                     ₹4.2 cr, 38 items, low effort
Accrual exposure at close           ₹6.4 cr
```

DSO forecast drivers (JGL):

| Driver | Value ₹cr | Impact days |
|---|---|---|
| Customer A — pricing dispute | 9.4 | +4.1 |
| Customer B — deduction unresolved | 6.2 | +2.7 |
| Customer C — credit block | 4.8 | +2.1 |
| Cash awaiting application | 3.1 | +1.1 |

Ranked actions:

| # | Action | Owner | Effort | Improvement |
|---|---|---|---|---|
| 1 | Settle two disputes under ₹10 lakh | Collections | Low | 6.0 days |
| 2 | Apply matched receipts to open AR | Cash application | Low | 1.1 days |
| 3 | Release credit block on Customer C | Entity controller | Medium | 2.1 days |
| 4 | Escalate Customer A to commercial | Business partner | High | 4.1 days |

### 7.4 Process stage counts — JGL

**These are items IN FLIGHT at each stage, not period volumes.** See §8.1.

Each stage carries four figures, not two. Exception % is **derived**
(`inException / inFlight`), never stored — otherwise the numbers stop tying.

P2P — JGL:

| Stage | In flight | In-flight ₹cr | In exception | Exception ₹cr | Exception % |
|---|---|---|---|---|---|
| Requisition | 412 | 62.1 | 16 | 2.4 | 4 |
| Purchase order | 386 | 58.4 | 23 | 3.5 | 6 |
| Goods receipt | 349 | 51.2 | 66 | 9.7 | 19 |
| Invoice | 1,258 | 71.5 | 327 | 18.6 | 26 |
| Three-way match | 241 | 14.2 | 53 | 3.1 | 22 |
| Approval | 178 | 8.9 | 21 | 1.1 | 12 |
| Payment | 96 | 6.1 | 3 | 0.2 | 3 |

The invoice stage is deliberately the largest pool: blocked invoices accumulate
there. That is the story the screen should tell, not an error. Invoice exception
value (₹18.6 cr) equals JGL's AP blocked figure — these must always match.

O2C — JGL:

| Stage | In flight | In-flight ₹cr | In exception | Exception ₹cr | Exception % |
|---|---|---|---|---|---|
| Order | 508 | 71.4 | 15 | 2.1 | 3 |
| Credit check | 486 | 68.9 | 39 | 5.5 | 8 |
| Delivery | 461 | 64.2 | 28 | 3.9 | 6 |
| Billing | 437 | 61.8 | 61 | 8.7 | 14 |
| Invoice dispatch | 421 | 59.6 | 38 | 5.4 | 9 |
| Collection | 1,183 | 56.3 | 284 | 28.4 | 24 |
| Cash application | 196 | 19.7 | 41 | 3.1 | 21 |

Collection in-flight value (₹56.3 cr) equals total open AR and must equal the sum
of the receivables ageing buckets. Cash application exception value (₹3.1 cr)
equals unapplied cash — these must always match.

JGL receivables ageing, which must sum to ₹56.3 cr:

```
0–30 d    ₹24.1 cr
31–60 d   ₹11.6 cr
61–90 d   ₹ 8.2 cr
91–180 d  ₹ 7.4 cr
> 180 d   ₹ 5.0 cr
```

AR > 90 days = 7.4 + 5.0 = ₹12.4 cr, which must equal the entity metric in §7.2.

JGL blocked invoice ageing, which must sum to ₹18.6 cr:

```
0–15 d    ₹5.9 cr
16–30 d   ₹4.2 cr
31–60 d   ₹4.1 cr
61–90 d   ₹2.6 cr
> 90 d    ₹1.8 cr
```

### 7.5 Root causes — JGL P2P

| Cause | Share | Value ₹cr | Avg delay | Recurrence | Concentration |
|---|---|---|---|---|---|
| goods receipt | 34% | 6.4 | 8.4 d | 5 months | 11 vendors |
| pricing | 22% | 4.1 | 6.1 d | 3 months | 4 vendors |
| approval | 18% | 3.3 | 5.2 d | 2 months | 2 plants |
| vendor master | 11% | 2.0 | 9.7 d | 4 months | 7 vendors |
| duplicate | 8% | 1.5 | 3.1 d | 1 month | — |
| tax | 7% | 1.3 | 4.4 d | 2 months | 3 vendors |

Shares and values must tie: they sum to 100% and to ₹18.6 cr, which is JGL's
blocked AP. Every value equals its share of that total.

By plant (goods receipt cause): Nanjangud 43%, Roorkee 29%, Ambernath 18%, Noida 10%.
By vendor group: consignment chemicals 38%, packaging 27%, logistics 21%, other 14%.

Cause elimination backlog, group-wide: **34 causes identified, 11 eliminated,
6 in progress, 17 identified but not started.**

### 7.6 Blocked invoice worklist — JGL (extend the existing 12 rows)

Keep the existing rows. Every row must additionally carry: `attribution`,
`evidence[]`, `controlSignificance`, `status`. Suggested attribution for the
existing rows: Missing GR → `client`; PO price mismatch → `client`;
Approval pending → `client`; Vendor master → `provider`;
Duplicate suspicion → `system`; Tax mismatch → `provider`.

### 7.7 Service metrics — JGL

| SLA | Target | Achieved | Breaches | Measurability |
|---|---|---|---|---|
| Invoice processing TAT | 3 business days | 93.1% | 22 | day-one |
| Urgent invoice TAT | 1 business day | 96.4% | 4 | day-one |
| Payment processing | 2 business days | 98.2% | 3 | day-one |
| Sub-ledger close TAT | Day 2 | 91.0% | 2 | day-one |
| Bank reconciliation TAT | Day 3 | 97.5% | 1 | day-one |
| Vendor master creation | 2 business days | — | — | needs-service-desk |
| Query resolution | 5 business days | — | — | needs-service-desk |
| Dispute resolution | 10 business days | — | — | needs-service-desk |
| Invoice processing accuracy | 99.5% | — | — | needs-register |
| Audit findings | Zero high severity | — | — | needs-register |

SLAs marked `needs-service-desk` or `needs-register` must render greyed with a
tooltip explaining why they are not yet measurable. **This honesty is a feature —
do not fabricate values for them.**

### 7.8 Control signals — sample set

At least eight, spread across the five categories, with JRP carrying the
unauthorised bank change that triggers its veto. Examples:

```
payment    Vendor bank detail changed 3 days before payment run   High   JRP  ₹2.4 cr
payment    First-time payee above ₹50 lakh threshold              Medium JGL  ₹0.8 cr
authority  PO split into 3 below approval threshold               High   JBL  ₹1.9 cr
authority  Retrospective PO — dated after invoice                 Medium JGL  ₹0.6 cr
system     SoD conflict: same user creates vendor and releases payment  High JBL
system     Payment terms changed on 7 vendors without approval     Medium JRP
cutoff     14 goods receipts posted across period end             High   JGL  ₹3.1 cr
exposure   Goods received not invoiced, ageing beyond 90 days     High   JRP  ₹5.2 cr
```

### 7.8.1 Control effectiveness — pinned

The §7.8 signals are detections. This section is the other half: how well the
controls the client already owns are actually working. Group-level, monitoring only —
per §1, the platform never re-runs these checks.

| Measure | Value |
|---|---|
| Duplicate-invoice control: triggers / overridden | 41 / 2 (4.9%) |
| Three-way match tolerance: triggers / overridden | 67 / 5 (7.5%) |
| Value prevented, year to date | ₹23.4 cr |

Rates are computed from the counts, never stored. The prevented figure carries into
the benefits case, so it must stay stable across regenerations — pin it rather than
choosing it.

### 7.9 Compliance — sample set

Superseded by **§7.26**, which sets obligations by jurisdiction. JRP's overdue item
is a GST/HST return, not an Indian one — see §7.26 before building anything that
touches compliance.

### 7.10 Sensitivity — what moves each score

**Deltas are computed, never stored.** Store what the action does — a movement on a
dimension, or the veto it clears — and recompute the score with it applied. A stored
delta goes stale the moment a veto changes, and produces figures that are simply
wrong (see the JRP case below).

Each item stores: `action`, `dimension`, `dimensionMovement` (points), `clearsVeto`
(veto id, optional), `effort`. `deltaScore` is derived at render.

| Entity | Action | Dimension | Movement | Clears veto | Effort |
|---|---|---|---|---|---|
| JGL | Clear GR compliance on 11 consignment vendors | workingCapital | +35 | — | Low |
| JGL | Close 18 aged reconciliation breaks | risk | +15 | — | Medium |
| JGL | Apply matched receipts to open AR | workingCapital | +5 | — | Low |
| JGL | Resolve 12 high-risk manual journals | risk | +10 | — | Low |
| JBL | Clear SoD conflict on vendor creation and payment release | risk | +25 | — | Medium |
| JBL | Reduce approval cycle at Ambernath | operational | +15 | — | Medium |
| JBL | Settle 9 open close blockers | operational | +10 | — | High |
| JPS | Complete intercompany matching with JGL | workingCapital | +20 | — | Medium |
| JPS | Clear 7 aged reconciliation breaks | risk | +10 | — | Low |
| JCP | Close 2 open reconciliation breaks | risk | +5 | — | Low |
| JCP | Apply 2 unapplied receipts | workingCapital | +5 | — | Low |
| JHS | Clear 4 aged reconciliation breaks | risk | +10 | — | Low |
| JHS | Resolve GR timing on the sterile line | operational | +10 | — | Medium |
| JRP | Resolve the unauthorised vendor bank change | — | 0 | bankChange | High |
| JRP | File the overdue GST/HST return | compliance | +40 | taxReturnOverdue | Low |
| JRP | Clear 26 aged reconciliation breaks | risk | +20 | — | Medium |

Constraint, testable: `currentDimensionScore + movement <= 100`, per item and
cumulatively per dimension. The table above satisfies both.

JGL's headline case still computes as promised: working capital +35 × weight 0.20
= +7, so 74 → 81.

#### 7.10.1 A capped entity is the point, not a bug

JRP's raw score is 57.9 with two caps active, 60 and 55, so it displays 55. Work
through what each action actually delivers:

| Action | New raw | Binding cap | Displayed | Gain |
|---|---|---|---|---|
| File the overdue GST/HST return | 63.9 | 55 (bank change) | 55 | **0** |
| Clear 26 reconciliation breaks | 61.9 | 55 (bank change) | 55 | **0** |
| Resolve the bank change | 57.9 | none binding | 58 | +3 |

**While the bank-change cap binds, nothing else moves the score.** That is the veto
rule working exactly as intended, and it is the most persuasive thing on the screen:
it says an unresolved control failure cannot be offset by good performance
elsewhere. A weighted average would have quietly absorbed it.

The UI must say this plainly on a capped entity — a banner reading *"While the
bank-change cap binds, no other action moves this score"* — rather than listing
actions with a zero next to them.

The cascade, which is the scripted demo path:

```
55  →  resolve the bank change        →  58   (cap lifted to 60, raw 57.9 now binds)
58  →  file the overdue GST/HST return →  64   (last cap gone, compliance +40)
64  →  clear 26 reconciliation breaks →  68   (ordinary movement, now visible)
```

Order matters and must be honoured: filing the return *first* delivers nothing,
because the bank-change cap still binds. That ordering effect is worth demonstrating
live.

### 7.11 SLA breaches and attribution

Breach totals by entity:

```
JGL 32 · JBL 41 · JPS 12 · JCP 3 · JHS 6 · JRP 48    total 142
```

Group attribution counts — the stacked bar in §5 is **group-level, across all six
entities**, and must be computed from these, not hardcoded:

```
client      101   (71%)
provider     25   (18%)
system       10   ( 7%)
thirdParty    6   ( 4%)
              142
```

JGL's own per-SLA breach attribution — store as counts, derive percentages:

| SLA | Breaches | client | provider | system | thirdParty |
|---|---|---|---|---|---|
| Invoice processing TAT | 22 | 18 | 3 | 1 | 0 |
| Urgent invoice TAT | 4 | 3 | 1 | 0 | 0 |
| Payment processing | 3 | 1 | 1 | 0 | 1 |
| Sub-ledger close TAT | 2 | 1 | 1 | 0 | 0 |
| Bank reconciliation TAT | 1 | 0 | 0 | 1 | 0 |
| **Total** | **32** | **23** | **6** | **2** | **1** |

JGL's split (72/19/6/3) deliberately differs from the group's (71/18/7/4). An entity
is not the group — do not force them to match.

### 7.12 Narrative and display conventions

- Recurrence is **stored as an integer** number of months and **displayed as an
  ordinal** — store `5`, display "5th consecutive month".
- Narrative strings in `causes.ts` must be generated from, or manually reconciled
  with, the figures in §7.5. Any prose that contradicts the data is a defect. The
  existing `po-price-mismatch` narrative claiming "four contracts account for 71%"
  is stale — pricing is 22% of ₹18.6 cr across 4 vendors.
- Tile sub-labels ("19 receipts", "327 invoices") come from the data layer, never
  hardcoded in a page component.
- **Policy thresholds live in one config object**, not scattered through prose and
  components — the ₹10 lakh dispute settlement threshold, the ₹50 lakh first-time
  payee threshold (§7.8), delegation limits. They are parameters, not derived
  figures, and they must be consistent wherever they appear.
- **A narrative may not contain a quantitative claim that is not derivable from
  stored data.** A controller will test any number on screen, and a figure with
  nothing behind it is worse than no figure. Where a claim is worth keeping, store
  the data behind it rather than deleting the sentence. Specifically: the
  approval-pending narrative's "seven approvers hold 64%" is worth keeping —
  store it as a `byGroup` split on that cause (7 approvers, 64% of the ₹3.3 cr) so
  the sentence derives from data.

### 7.13 Narrative backing data

Every quantitative claim in a cause narrative must resolve to a stored field
(§7.12). These are the figures behind the claims that currently have none.

| Cause | Claim to keep | Store as |
|---|---|---|
| pricing-disputes | Nine customers hold 64% of disputed value; 41% of it sits in Distribution | `concentrationCount: 9`, `concentrationPctOfValue: 64`, existing segment split unchanged. **These are two different cuts and must read as two different cuts** — the narrative becomes "Nine customers account for 64% of disputed value, 41% of it in Distribution." The current wording conflates them and is a contradiction on screen. |
| vendor-master | 23 vendor records created last quarter, 7 of them behind the ₹2.0 cr blocked | `recordsCreatedQuarter: 23`; concentration already 7 vendors |
| duplicate-suspicion | Nine invoice pairs flagged | `concentrationCount: 9`, and set concentration from `'—'` to "9 invoice pairs" |
| deductions | 71% of deductions are eventually accepted | `acceptanceRatePct: 71` |
| tax-mismatch | Concentrated in two states | `byGroup` split with two states, summing to the cause's value |
| cash-application | Oldest unapplied receipt 22 days | `cashUnappliedOldestDays` on the entity (below) |

**Oldest-item ageing.** The original prototype showed an "oldest N d" figure beside
each headline exposure and it is worth restoring — ageing is what turns an amount
into a controllership problem. Add to `EntityMetrics`:

| Entity | apBlockedOldestDays | arOver90OldestDays | cashUnappliedOldestDays | reconOldestDays |
|---|---|---|---|---|
| JGL | 52 | 148 | 22 | 61 |
| JBL | 61 | 172 | 31 | 79 |
| JPS | 34 | 96 | 14 | 38 |
| JCP | 18 | 61 | 8 | 16 |
| JHS | 27 | 78 | 11 | 22 |
| JRP | 74 | 210 | 44 | 94 |

These must order consistently with entity health: JCP best, JRP worst on every
measure. An ageing figure that contradicts the score is a defect.

### 7.14 Trend series

Sparklines need six points per metric. §7.2 gives prior-period values for AP blocked
and AR over 90 days only; the remaining metrics are below. Nothing about the series
is invented at render time.

Prior-period values, current → previous:

| Entity | cashUnapplied | closePercent | reconValue | DSO | DPO |
|---|---|---|---|---|---|
| JGL | 3.1 ← 2.6 | 78 ← 74 | 14.3 ← 15.8 | 62 ← 59 | 48 ← 45 |
| JBL | 2.4 ← 2.9 | 61 ← 66 | 9.8 ← 8.9 | 68 ← 71 | 52 ← 50 |
| JPS | 1.2 ← 1.5 | 88 ← 85 | 4.1 ← 4.6 | 54 ← 52 | 41 ← 42 |
| JCP | 0.3 ← 0.4 | 96 ← 95 | 1.4 ← 1.6 | 47 ← 49 | 38 ← 39 |
| JHS | 0.6 ← 0.5 | 94 ← 91 | 2.7 ← 2.5 | 51 ← 50 | 40 ← 40 |
| JRP | 4.0 ← 3.4 | 52 ← 58 | 12.6 ← 11.2 | 74 ← 69 | 56 ← 52 |

Two more metrics that were left scalar for want of a prior period:

| Entity | Touchless rate % | SLA breaches |
|---|---|---|
| JGL | 54 ← 49 | 32 ← 38 |
| JBL | 46 ← 44 | 41 ← 39 |
| JPS | 62 ← 58 | 12 ← 14 |
| JCP | 78 ← 74 | 3 ← 4 |
| JHS | 71 ← 68 | 6 ← 5 |
| JRP | 41 ← 39 | 48 ← 48 |

Touchless rate must order consistently with the operational dimension: JCP highest,
JRP lowest. Group breaches move 148 → 142.

**Group header KPIs carry trends too.** Group score, value at risk and open
exceptions are all derived from entity data, so their trends are derived the same
way — aggregating entity trends is not invention. The group header is the first
thing anyone sees and a bare number there is the most visible possible gap.

DSO and DPO were previously defined for JGL only (§7.3). The full set above must
order consistently with the working capital dimension: JCP best, JRP worst.

**Adjusted DPO** (§8.6) — headline DPO is inflated by blocked invoices, and the
platform says so rather than reporting the flattering number:

```
JGL 48 → 41   JBL 52 → 46   JPS 41 → 38
JCP 38 → 37   JHS 40 → 38   JRP 56 → 50
```

#### Series generation

The six-point series is generated deterministically, not stored point by point:

- `series[5] === current` and `series[4] === previous`. Test both.
- Points 0–3 come from a seeded walk — seed from `entityCode + metricKey`, so the
  same series is produced on every run and across machines. No `Math.random()`.
- **Every point stays within `max(25% of current, absolute floor)`.** The plain ±25%
  rule breaks on small denominators — JCP's cash unapplied moving ₹0.3 cr to ₹0.4 cr
  is a trivial movement in rupees and a 33% swing in percent. Floors: **₹0.5 cr** for
  money, **5 points** for percentages, **5 days** for day counts, **5** for raw
  counts. The guard exists to
  stop a metric appearing from nowhere, not to police rounding noise.
- **The series must not contradict a stated recurrence.** The checkable form is: for
  a down-is-good metric, the last N points must not be **monotonically decreasing**,
  where N is the recurrence of the cause mapped to that metric. **Apply only for
  N ≥ 3.** At N = 2 the rule reduces to "the metric must not have improved last
  month", which contradicts the pinned priors in §7.2 and is not what recurrence
  means — a cause recurring two months running says nothing about direction. Compare
  with a 1e-9 tolerance; the value grid is 0.1, so anything smaller is float
  representation noise. A chart showing
  steady resolution while the narrative says the cause has recurred five months is
  telling the opposite story to the words beside it. "Elevated" was too vague to
  test — monotonicity is not.

  Cause → metric mapping for that assertion:

```
P2P  goods receipt · pricing · approval · vendor master · duplicate · tax
                                                       →  apBlocked
O2C  pricing-disputes · deductions · billing-errors · credit-block · customer-master
                                                       →  arOver90
O2C  cash-application                                  →  cashUnapplied
R2R  all causes                                        →  reconValue
```

### 7.15 Prior-period dimension scores

Without these, the group score and the six dimension bars are the only figures on
the product's first two screens with no direction of travel. They also unlock the
most useful single line on the entity view: *"Risk & control 46, down from 52 last
period"* — which dimension is deteriorating is a controllership question, and the
composite score hides it.

| Entity | operational | service | risk | workingCapital | dataQuality | compliance | → prior score |
|---|---|---|---|---|---|---|---|
| JGL | 71 | 74 | 58 | 60 | 89 | 96 | 72 |
| JBL | 69 | 74 | 58 | 55 | 82 | 88 | 69 |
| JPS | 80 | 82 | 73 | 74 | 87 | 90 | 80 |
| JCP | 91 | 93 | 87 | 85 | 93 | 96 | 90 |
| JHS | 88 | 90 | 88 | 86 | 92 | 94 | 89 |
| JRP | 66 | 68 | 52 | 51 | 75 | 60 | 60 |

Movement: JGL +2 · JBL −2 · JPS +1 · JCP +1 · JHS −1 · JRP **−5**. Group 77 → 76.

**JRP's prior period had only one veto active — the overdue GST/HST return, cap 60. The
unauthorised bank change was detected this period.** So JRP's prior displayed score
is 60 (capped) and its current is 55 (capped lower by the new veto). Its raw score
barely moved: 60.5 → 57.9.

That is the whole argument for veto rules rendered as a trend. A five-point drop
that a weighted average would have shown as one point, because one control failure
appeared. The demo line: *"nothing much changed in the numbers — a control failure
appeared, and that is the point."*

Assert the two cases named here: JGL's operational rising alongside touchless
49 → 54 and close 74 → 78, and JBL's working capital falling alongside AP blocked
10.4 → 11.3.

**Do not assert this universally.** A dimension is a composite of three to five
measures and an individual metric may legitimately move against it — JBL's
operational falls while its touchless rate rises, because close % and blocked value
both worsened and outweigh it. A universal invariant here would be false, and
encoding a false invariant is worse than encoding none.

### 7.16 Prior-period exception counts

Enables a trend on the group's open-exceptions KPI. Counts move with their value
counterparts in §7.2.

| Entity | apBlockedCount | o2cExceptionCount | reconAgedBreaks |
|---|---|---|---|
| JGL | 327 ← 389 | 284 ← 301 | 18 ← 21 |
| JBL | 214 ← 197 | 196 ← 188 | 21 ← 19 |
| JPS | 96 ← 112 | 84 ← 92 | 7 ← 8 |
| JCP | 41 ← 47 | 31 ← 34 | 2 ← 2 |
| JHS | 68 ← 65 | 52 ← 49 | 4 ← 4 |
| JRP | 268 ← 241 | 241 ← 220 | 26 ← 23 |

Group open exceptions: 2,012 → 1,980.

**What these counts actually are, and what they are not.** `apBlockedCount` is the
invoice-stage pool and `o2cExceptionCount` is the collection-stage pool — not the
sum of exceptions across all seven stages, which for JGL would be 509 and 506
respectively. That is the right definition: a controller means blocked invoices and
overdue collections by "open exceptions", not a requisition sitting in someone's
queue. But it must be stated, not assumed.

Direction assertions therefore apply only where a true counterpart exists:
`apBlockedCount` ↔ `apBlocked` and `reconAgedBreaks` ↔ `reconValue`.
`o2cExceptionCount`'s counterpart is collection-stage exception value (₹28.4 cr for
JGL), for which no prior exists — **do not assert it against `arOver90`**, which is
a different population. Their directions differ for four of six entities, and that
is correct rather than a defect.

### 7.17 Exceptions for the other five entities

All twelve seeded exceptions are JGL's, so every non-JGL drill lands on an empty
worklist. An empty list reads as a broken product, not as an honest absence — and
Steps 7, 9 and 11 all need exceptions across entities.

Seed **12 rows per entity**, matching the existing JGL pattern of showing a sample
of a larger pool. Generate deterministically against these constraints rather than
listing 60 rows here:

| Entity | Rows shown | Of pool | Shown value ₹cr | Max age (days) |
|---|---|---|---|---|
| JGL | 12 | 327 | 12.77 | 52 |
| JBL | 12 | 214 | 7.8 | 61 |
| JPS | 12 | 96 | 4.7 | 34 |
| JCP | 12 | 41 | 1.4 | 18 |
| JHS | 12 | 68 | 2.9 | 27 |
| JRP | 12 | 268 | 10.1 | 74 |

Constraints, all assertable:

- Row values sum to the entity's shown value and are ordered descending.
- No row's age exceeds the entity's `apBlockedOldestDays` (§7.13), and the oldest
  row equals it.
- Causes are drawn from the P2P taxonomy (§6.1) in roughly the §7.5 proportions.
  **At least three rows per entity carry the goods-receipt cause**, so the accrual
  exposure drill lands on a populated list.
- Attribution follows the §7.6 mapping — goods receipt, pricing and approval are
  `client`; vendor master and tax are `provider`; duplicate is `system`.
- Plants come from that entity's list below. Owners are pinned so they stay stable
  across regenerations:

```
JGL  P. Nair · A. Sethi · R. Iyer          JBL  M. Kulkarni · S. Rao
JPS  W. Tan · L. Cheong                    JCP  D. Whitfield · K. Moreau
JHS  J. Halloran · T. Bergstrom            JRP  C. Tremblay · N. Okafor
```
- Deterministic — seeded from entity code, no `Math.random()`.

**Sites by entity.** Needed here and again for the plant pages in Step 11:

| Entity | Sites |
|---|---|
| JGL | Nanjangud · Roorkee · Ambernath · Noida |
| JBL | Bengaluru · Noida |
| JPS | Singapore (no manufacturing site — office location) |
| JCP | Salisbury, MD |
| JHS | Spokane, WA · Montreal, QC |
| JRP | Kirkland, QC · US radiopharmacy network |

> **For the human, not the model:** these sites are a reasonable reconstruction and
> should be confirmed against the annual report before client use, as with the entity
> names in §2.

**Vendor name pools.** Invented names, not real counterparties. Reuse the existing
twelve for JGL.

```
India (JBL)         Sahyadri Biosciences · Konark Glassware · Prabhat Cold Chain
                    Indus Analytical · Varsha Packaging · Aravalli Reagents
Singapore (JPS)     Straits Facilities · Raffles Professional Services
                    Kallang Freight · Tanjong Technology Services
US (JCP, JHS)       Cascade Packaging · Alcott Laboratories · Northgate Logistics
                    Sentinel Instruments · Harbor Chemical · Fairmont Sterile Supply
Canada / US (JRP)   Laurentian Isotopes · Beaufort Medical Gases · Cartier Packaging
                    Ridgeway Cold Chain · Saint-Lambert Shielding
```

### 7.18 Per-entity figures for the mode panels

Three figures in the mode-aware panel are group-level and therefore identical on all
six entity homes, which is wrong on the screen whose whole purpose is to be about one
entity. Per-entity values:

**Unposted goods receipts** — this is the same quantity as accrual exposure (§8.2),
so use that field rather than storing it twice:

| Entity | Value ₹cr | Vendors | Recurrence |
|---|---|---|---|
| JGL | 6.4 | 11 | 5th month |
| JBL | 4.1 | 8 | 4th month |
| JPS | 2.1 | 5 | 2nd month |
| JCP | 0.6 | 2 | 1st month |
| JHS | 1.3 | 3 | 2nd month |
| JRP | 5.7 | 14 | 6th month |

**Cause elimination** — must sum to the group figures in §7.5 (34 identified, 11
eliminated, 6 in progress, 17 not started):

| Entity | Eliminated | In progress | Not started | Identified |
|---|---|---|---|---|
| JGL | 3 | 2 | 3 | 8 |
| JBL | 2 | 1 | 4 | 7 |
| JPS | 2 | 1 | 2 | 5 |
| JCP | 2 | 0 | 1 | 3 |
| JHS | 1 | 1 | 2 | 4 |
| JRP | 1 | 1 | 5 | 7 |
| **Group** | **11** | **6** | **17** | **34** |

**Cash opportunity** — JGL's ₹11.3 cr is the sum of its working-capital rows; the
others scale with value at risk at a consistent 36–38%:

| Entity | Value ₹cr | Items |
|---|---|---|
| JGL | 11.3 | 88 |
| JBL | 7.4 | 61 |
| JPS | 4.3 | 34 |
| JCP | 1.5 | 12 |
| JHS | 2.9 | 24 |
| JRP | 9.2 | 79 |

### 7.19 Effort is a property of the item, not the cause

The Step 7 mapping made effort a function of cause and put missing-GR at High. But
§7.3's cash opportunity has that same cause at Low. Both cannot be right, and the
consequence was that the "38 resolvable today" chip filtered to a set that could
never contain them.

**The flag is `resolvableToday`, not `blockerCleared`.** The original wording is
prospective — *"₹4.2 cr working-capital release available **by clearing** GR
compliance on 11 vendors"*. The clearing action is available and quick; the receipt
is not yet posted. That distinction carries real weight:

- `blockerCleared` would mean the receipt exists, so accrual exposure should net
  those items off — ₹6.4 cr becomes ₹2.2 cr, and the tie to the missing-GR cause
  value established in Step 6b breaks.
- `resolvableToday` means nothing has posted yet. Accrual exposure stays ₹6.4 cr,
  the accrual drill correctly lists every missing-GR row, and the 38 are quick wins
  **within** missing-GR rather than outside it.

The second is both correct and the one that keeps every established number intact.

Effort derives from cause plus that flag:

| Situation | Effort | Why |
|---|---|---|
| Missing GR, receipt not yet available | High | Chase the plant, wait on someone else |
| Missing GR, receipt available and awaiting match or posting | Low | One action, no chasing |
| Price mismatch outside tolerance | High | Renegotiate or raise a debit note |
| Price mismatch inside tolerance | Low | Approve the variance |
| Approval pending, approver absent | Medium | Reroute the delegation |
| Approval pending, approver active | Low | One nudge |
| Vendor master, tax, duplicate — not resolvable today | Medium | Correction plus re-validation |
| Vendor master, tax, duplicate — resolvable today | Low | Correction already prepared |

Per-entity resolvable sets, so the chip carries a count everywhere:

| Entity | Resolvable today | Value ₹cr |
|---|---|---|
| JGL | 38 | 4.2 |
| JBL | 25 | 2.6 |
| JPS | 11 | 1.5 |
| JCP | 5 | 0.5 |
| JHS | 8 | 0.9 |
| JRP | 31 | 3.3 |

### 7.20 Sample and pool must both be visible

The worklist shows 12 rows of a 327 pool, and the entity view says "38 resolvable
today" while the sample holds four. Neither figure is wrong; shown alone they look
contradictory, and a client will notice within seconds.

**Wherever a sample is displayed against a pool figure, state both.** The worklist
header reads:

```
12 of 327 shown  ·  ₹12.77 cr of ₹18.6 cr  ·  >30 days ₹8.99 cr  ·  4 of 38 resolvable in this view
```

The ageing segment was in the original prototype header and is worth keeping:
value alone does not tell a controller whether the pool is stale.

The bulk action button follows the visible set — "Release all 4" — because that is
what it will actually do. The header explains why 4 and not 38.

This is the same discipline as §8.6.1: a figure that cannot explain itself gets
discounted, and so does everything beside it.

### 7.21 The demo clock is relative, not absolute

**This applies to every seeded date in the product**, not only exception evidence:
control signal detection dates, compliance due dates, request timestamps, close
calendar dates, last payment dates. Any date literal will read as stale the moment
the prototype is shown outside the month it was written in.

Seeded evidence is stamped against a fixed anchor date. Ages are stored as day
counts. Those two drift apart: shown three months from now, an item stating "oldest
52 days" will carry evidence dated last August.

Derive the anchor from the current date — every seeded timestamp is
`today − ageDays`, so evidence and ageing always agree whenever the prototype is
opened. Action stamps continue to use the real wall clock, which is then consistent
with the seeded lines rather than months ahead of them.

Keep the derivation deterministic within a single day so tests do not flake.

### 7.22 Per-entity SLA performance

The Service & attribution screen sits at entity level but renders identical figures
on all six entity pages — the same defect corrected three times already (mode panels,
releasable cash, systemic count). The bar is group-level while the screen is
entity-level, and the SLA table is JGL's data everywhere.

Per-entity attribution counts already exist (§7.11). What is missing is per-SLA
performance. Generate against these constraints rather than pinning 30 values:

**Gross achievement mean by entity** — must track the service dimension:

| Entity | Service dimension | Gross mean % |
|---|---|---|
| JCP | 94 | 98.8 |
| JHS | 88 | 97.6 |
| JPS | 84 | 96.8 |
| JGL | 78 | 95.2 |
| JBL | 72 | 94.0 |
| JRP | 66 | 92.4 |

Constraints, all assertable:

- JGL's five day-one rows are the pinned §7.7 values and must not move.
- Per-SLA breach counts sum to the entity's breach total (§7.11): 32 · 41 · 12 · 3 ·
  6 · 48.
- Per-SLA attribution counts sum to the entity's attribution counts (§7.11) —
  JGL {23,6,2,1}, JBL {29,7,3,2}, JPS {9,2,0,1}, JCP {2,1,0,0}, JHS {5,1,0,0},
  JRP {33,8,5,2}.
- The mean of the five gross achievements equals the entity's gross mean above.
- The five `needs-service-desk` and `needs-register` rows stay unmeasurable for every
  entity — they have no clock start anywhere, not just at JGL.

**Scoping.** The attribution bar shows the **entity's own** split, with the group
split beneath it as comparison — *"JGL 72 / 19 / 6 / 3 · group 71 / 18 / 7 / 4"*.
Which entities are worse than the group is a question a controller asks immediately,
and a group-only bar on an entity page cannot answer it.

### 7.23 Forecasts for the other five entities

The Predictive screen is JGL-only because §7.3 pins only JGL's forecast. That is
honest but thin — and JRP is the entity a controller would most want a forecast for:
worst working capital, worst DSO, capped score. "Predict, then rank the action" is
one of the product's central claims and it should work wherever it is clicked.

| Entity | DSO today | Projected | Deterioration | Driver values ≈ ₹cr |
|---|---|---|---|---|
| JRP | 74 | 86 | +12 | 22.2 |
| JBL | 68 | 79 | +11 | 17.2 |
| JGL | 62 | 72 | +10 | 23.5 |
| JPS | 54 | 59 | +5 | 9.6 |
| JHS | 51 | 55 | +4 | 6.7 |
| JCP | 47 | 50 | +3 | 3.3 |

Deterioration must order inversely with the working capital dimension — JRP worst at
48, JCP best at 86. A forecast that says the healthiest entity is deteriorating
fastest contradicts the score beside it.

Generation constraints:

- JGL's four drivers and four ranked actions are the pinned §7.3 values, unchanged.
- Three or four drivers per entity; day impacts sum exactly to the deterioration.
- Driver values sum to roughly 1.5× (AR over 90 + cash unapplied), matching JGL's
  23.5 against 15.5. Not all disputed value is yet 90 days overdue.
- Three or four ranked actions per entity, ordered by days recovered per unit of
  effort — not by size of recovery. **Effort weights are Low = 1, Medium = 2,
  High = 4**, which reproduces JGL's pinned order exactly (6.00 · 1.10 · 1.05 ·
  1.02). Pin them: the ranking is a product claim, and a weighting that drifts
  reorders the actions.
- Every base settlement date falls after month-end, so the pinned headline holds
  whenever the prototype is opened.

**Name real customers, not "Customer A".** Step 11 builds customer pages, and a
driver that says "Customer A" cannot drill to one. Use these pools, and let each
driver reference a customer that will exist:

```
India (JGL, JBL)     Amrit Distributors · Sanjeevani Healthcare · Deccan Pharma Retail
                     Nirmal Wholesale · Vindhya Medical Supplies
Singapore (JPS)      Straits Healthcare Group · Pasir Distribution
US (JCP, JHS)        Ridgeline Health Partners · Cornerstone Wholesale
                     Beacon Pharmacy Services · Lakeshore Distributors
US / Canada (JRP)    Mont-Royal Imaging · Great Lakes Nuclear Medicine
                     Saint-Denis Health Network
```

### 7.24 Counterparty data must reconcile

Counterparty pages are the first place a controller can add things up and check them
against a total. If a vendor page says one thing and the entity view says another,
every number in the product becomes suspect.

**Reconciliation ties, all assertable:**

```
Σ vendor blocked   across the page's SAMPLED vendors  =  worklist shown value
Σ plant blocked    across an entity's plants          =  entity blocked AP  (POOL)
Σ cost centre committed spend                         =  PO stage in-flight value
Σ vendor open commitments                             =  PO stage in-flight value
Σ customer exposure                                   ≥  AR over 90 days
```

For JGL: ₹12.77 cr, **₹18.6 cr**, ₹58.4 cr, ₹58.4 cr, ≥ ₹12.4 cr.

**Vendors tie to the sample; plants tie to the pool.** Vendors are derived from the
twelve sampled exception rows, so they can only account for the sampled value. Plants
are a fixed, small, complete set — every one of the 327 blocked invoices sits at a
plant — so a plant page showing only its share of a twelve-row sample would understate
what a plant manager is accountable for.

**Plant shares are of blocked AP overall, not of the missing-GR cause.** §7.5's
43/29/18/10 is the plant split *within* missing-GR. Applying it to the whole blocked
pool conflates two different cuts. Use these overall shares instead:

| Entity | Plant shares of blocked AP |
|---|---|
| JGL | Nanjangud 43% · Roorkee 29% · Ambernath 18% · Noida 10% |
| JBL | Bengaluru 62% · Noida 38% |
| JPS | Singapore 100% |
| JCP | Salisbury 100% |
| JHS | Spokane 58% · Montreal 42% |
| JRP | Kirkland 55% · Radiopharmacy network 45% |

JGL's overall split happens to match its missing-GR split, which is why that cause
dominates its blocked pool. The other five are their own.

**Vendors** are already named by the exception rows (§7.17). A vendor page derives
from them — no new vendor dataset. Blocked value, open items, causes and plants all
come from that vendor's exceptions.

**Customers** are the ones already named in the forecast drivers (§7.23), so a driver
drills to a page that exists. Each carries exposure (the driver value), dispute and
deduction detail, payment behaviour, credit block status and the release path, plus
ageing buckets summing to its exposure.

**Plants** come from the §7.17 site list. A plant page derives from the exceptions at
that plant. For JGL, the distribution must match §7.5's missing-GR plant split —
Nanjangud 43%, Roorkee 29%, Ambernath 18%, Noida 10%.

**Cost centres** are the only genuinely new dataset — three or four per entity, with
budget, booked spend and **committed spend** against it. Committed is the point: open
purchase orders not yet invoiced are what a controller cannot see in most tools and
what makes the remaining budget real. The commitment figures tie to the PO stage
in-flight value in §7.4.

Suggested cost centres, matching the businesses:

```
JGL   Roorkee Operations · Nanjangud Operations · Quality & Regulatory · Corporate
JBL   Discovery Services · Lab Operations · Corporate
JPS   Group Treasury · Corporate Services
JCP   Salisbury Operations · Commercial · Corporate
JHS   Spokane Sterile Ops · Montreal Ops · Quality
JRP   Radiopharmacy Network · Kirkland Manufacturing · Regulatory
```

### 7.25 Per-entity process stages

`stages.ts` holds one dataset, so the P2P and O2C cockpits render JGL's figures on
every entity — the same defect corrected in Steps 6b, 7c, 8 item 0 and 8b. It also
forces every entity's cost centres to sum to JGL's ₹58.4 cr of commitments.

Scale the §7.4 stage tables per entity, then override the pinned tie points so the
cockpits agree with the entity metrics:

| Entity | PO in-flight ₹cr | Collection in-flight ₹cr |
|---|---|---|
| JGL | 58.4 | 56.3 |
| JBL | 35.5 | 40.4 |
| JPS | 21.4 | 23.2 |
| JCP | 6.6 | 8.6 |
| JHS | 13.2 | 17.3 |
| JRP | 46.2 | 48.1 |

PO in-flight scales with blocked AP; collection in-flight with AR over 90 days.

**Pinned tie points that must survive the scaling:**

```
Invoice stage    inException count  =  apBlockedCount        327 · 214 · 96 · 41 · 68 · 268
Invoice stage    exceptionValue     =  apBlocked             18.6 · 11.3 · 6.8 · 2.1 · 4.2 · 14.7
Collection stage inException count  =  o2cExceptionCount     284 · 196 · 84 · 31 · 52 · 241
Cash app stage   exceptionValue     =  cashUnapplied         3.1 · 2.4 · 1.2 · 0.3 · 0.6 · 4.0
Collection stage inFlightValue      =  total open AR         table above
PO stage         inFlightValue      =  Σ cost centre committed
```

Exception percentages stay derived, never stored (§7.4).

### 7.26 Compliance obligations by jurisdiction

The overdue return driving JRP's compliance score of 60 and its veto cap was
specified as GSTR-3B — an Indian return, on a US/Canada radiopharmacy entity. It is
**GST/HST**, filed with the Canada Revenue Agency. Obligations must match the entity's
jurisdiction; a Jubilant controller will notice immediately if they do not.

| Entity | Jurisdiction | Obligations |
|---|---|---|
| JGL | India | GSTR-1 · GSTR-3B · GSTR-2B reconciliation (ITC at risk) · TDS deposit · TDS return · MSMED 45-day ageing · e-invoice IRN failures |
| JBL | India | same set |
| JPS | Singapore | GST F5 return · withholding tax · transfer pricing documentation |
| JCP | United States | Sales & use tax · Form 1099 filings · state registrations |
| JHS | US / Canada | Sales & use tax · GST/HST return · Form 1099 |
| JRP | US / Canada | **GST/HST return — OVERDUE** · Québec QST · sales & use tax · Form 1099 |

Multi-jurisdiction coverage is a selling point in itself for this group, so make the
jurisdiction visible on each row rather than presenting one undifferentiated list.

Values at risk, for the obligations that carry one:

| Entity | ITC / input tax at risk ₹cr | MSMED ageing ₹cr | e-invoice IRN failures | Form 1099 TIN mismatches |
|---|---|---|---|---|
| JGL | 1.8 | 2.4 | 14 | — |
| JBL | 0.9 | 1.1 | 8 | — |
| JPS | 0.4 | — | — | — |
| JCP | 0.2 | — | — | 9 |
| JHS | 0.3 | — | — | 6 |
| JRP | 1.2 | — | — | 21 |

**E-invoice IRN failures are India-only.** IRN is the Invoice Reference Number issued
under Indian e-invoicing — a US or Canadian entity has no such thing. The equivalent
operational filing failure there is a TIN mismatch on Form 1099. JHS's geography in
§2 is corrected to US / Canada to match its Spokane and Montreal sites (§7.17).

**Only JRP has an overdue item.** Every other entity's compliance dimension is 88 or
above, and an overdue statutory filing would cap those scores at 60 under §3.5 — so
an overdue row anywhere else would contradict the score beside it.

### 7.27 Data quality checks

No dataset exists for these. Fail rates must order inversely with the data quality
dimension — JCP 94 cleanest, JRP 74 worst:

```
JCP 94  ·  JHS 92  ·  JGL 90  ·  JPS 88  ·  JBL 82  ·  JRP 74
```

Six checks per entity across the four domains, with fails over totals and the
downstream impact stated:

| Domain | Check | Impact to state |
|---|---|---|
| vendor | Missing tax registration | Blocks e-invoice validation |
| vendor | Duplicate vendor records | Duplicate payment risk |
| vendor | Dormant, no activity 24 months | Fraud surface, master data bloat |
| customer | Missing tax registration | Billing rejections |
| gl | Cost centre default missing | Manual coding, misposting risk |
| interface | Failed IDocs, last 7 days | Missing transactions, stale figures |

For JGL, illustrative anchors: missing tax registration 14 of 812 vendors; duplicate
records 9; dormant 48; customer missing registration 6 of 430; GL defaults missing 3
of 210; IDoc failures 12. Scale fail rates for the others by their dimension score.

**Link failures to the exceptions they cause.** The vendor-master cause is 11% of
JGL's blocked AP (§7.5, ₹2.0 cr) — that is master data quality showing up as working
capital, and the link between the two screens is the point of having this one.

### 7.28 Cost centre overruns should track entity health

Only JGL Nanjangud runs over budget, which leaves JRP — the worst entity at 55, with
the worst working capital — showing every cost centre comfortably within budget. Give
JRP and JBL at least one overrun each, driven by committed spend rather than booked,
so the page makes its own argument: the budget looks fine until you count the open
purchase orders.

### 7.29 The Finance Service Desk, and what it does to the SLA table

**Naming.** The screen is the **Finance Service Desk** — plain, and obvious to a plant
manager or sales lead who has never seen the product. In the pitch narrative it is
described as *"a single structured intake for every request into the service"*, which
is what carries the argument. The nav label and the pitch phrase do not have to be
the same words; the label needs to be obvious, the phrase needs to persuade.

Do not call it a helpdesk or a ticketing system. It is not ticket-pushing — it is the
instrument that gives eight committed SLAs a clock start.

Step 13 seeds the request intake and flips the three `needs-service-desk` SLAs to
measurable. That creates a conflict worth handling deliberately rather than
discovering: §7.11 pins each entity's breach total — 32 · 41 · 12 · 3 · 6 · 48 —
and the group attribution split of 71/18/7/4 is computed from them. If three more
SLAs start contributing breaches, those totals move and the split changes.

**Service Desk SLAs report separately until a full period has elapsed.** You cannot
report full-period performance on something you began measuring mid-period, and
claiming otherwise is the kind of thing a controller tests. So:

- They leave the greyed state and show live current-period-to-date figures: open
  requests, ageing, resolution times, stop-clock hours.
- They do **not** yet report an achievement percentage, and they do **not** enter
  the breach totals or the attribution split. §7.11's figures stand unchanged.
- Each carries the line *"measuring since <date> · first full-period report from
  <next period>"*.

That is a stronger demo beat than a fabricated percentage. It shows the Service Desk
delivering measurement immediately and being honest about what measurement it cannot
yet support — which is exactly the argument for building it.

The two `needs-register` SLAs stay greyed. A service desk does not give you audit
findings or a QC sample.

**Seeding.** Eight to twelve requests per entity, deterministic, spanning all six
types and all four statuses:

- `raisedOn` is the SLA clock start and follows §7.21 — derived from today, never a
  literal.
- `clockStoppedHours` accrues only while status is `awaiting-client`. This is the
  same attribution logic as §5, applied to requests, and it is what makes the
  stop-clock defensible rather than contested.
- Request volume per entity should track its exception volume — JRP and JBL busiest,
  JCP lightest.
- The deflection counter (self-served versus routed to the service team) is the
  measure that carries into the operating-model argument in Step 16.

---

## §8. Cross-cutting UI rules

### 8.1 Funnels show in-flight work

The P2P and O2C stage cards currently read as a period funnel, which makes it look
as though 2,000 invoices went missing between stages. Relabel the section header to
**"In flight at each stage"** and add the caption *"Open work in progress, not
period volumes"*. Use the counts in §7.4.

### 8.2 Every operational metric carries a financial consequence

No indicator without a rupee value and a stated consequence. On the entity view add
a **Financial consequence** strip, derived from the trial balance extract:

```
Accrual exposure at close    ₹6.4 cr    blocked payables not yet accrued
Revenue at risk              ₹8.7 cr    open disputes and credit blocks
Provision adequacy           92%        provision vs actual utilisation
FX / intercompany exposure   ₹3.6 cr    unmatched intercompany with related parties
```

The headline connection to make visible, **worded by mode** (§8.5) — a sentence
hardcoded to "Day 4" is wrong for three weeks a month:

```
close     ₹18.6 cr blocked → ₹6.4 cr not accrued at Day 4 → COGS understated
bau       ₹18.6 cr blocked → ₹6.4 cr will not accrue at close → COGS understated
preclose  ₹18.6 cr blocked → ₹6.4 cr will not accrue in 3 days unless goods
          receipts are posted → COGS understated
```

The pre-close wording is the strongest of the three because it is preventive and
still actionable. The same applies to the Group view's "Close progress — day 4"
eyebrow, which becomes "Pre-close readiness — 3 days to close" outside the close
window.

**Why ₹6.4 cr and not ₹18.6 cr:** accrual exposure is the portion of blocked payables
with no goods receipt posted, because no receipt means no accrual. For JGL it is
**exactly the missing-GR cause value in §7.5** — one number, one meaning. Assert
equality against the cause table rather than against a rounded percentage. The relationship is the
strip's logic, not a coincidence, and it should be assertable for JGL.

All six entities, not JGL alone. Navigating between entities is the natural demo
motion and an empty strip on five of six reads as unfinished:

| Entity | Accrual exposure ₹cr | Revenue at risk ₹cr | Provision adequacy % | FX / intercompany ₹cr |
|---|---|---|---|---|
| JGL | 6.4 | 8.7 | 92 | 3.6 |
| JBL | 4.1 | 6.4 | 88 | 2.4 |
| JPS | 2.1 | 3.3 | 94 | 5.8 |
| JCP | 0.6 | 1.1 | 98 | 1.9 |
| JHS | 1.3 | 2.3 | 97 | 2.2 |
| JRP | 5.7 | 8.3 | 84 | 4.7 |

Provision adequacy must order with the risk dimension — JCP highest, JRP lowest.
JPS carries the highest intercompany exposure: it is the Singapore holding entity,
and that is where intercompany sits. JGL's ₹3.6 cr ties to the Ingrevia netting
opportunity in the cash-opportunity table.

**Drill targets** (§8.4 — no dead-end numbers):

| Figure | Drills to |
|---|---|
| Accrual exposure | Blocked invoice worklist, filtered to the goods-receipt cause |
| Revenue at risk | O2C cockpit collection stage; from Step 11, the customer pages behind it |
| FX / intercompany | Working capital view, intercompany netting row |
| Provision adequacy | No target — tag `read-only · source: trial balance extract` per §8.4 |

### 8.3 Trends everywhere

Every headline number shows a delta versus prior period and a small sparkline.
A snapshot is a dashboard; a trend is a control tower. Direction colour: improving
= positive colour, worsening = negative colour, regardless of whether the metric
is "up is good" — the Trend helper must take an `inverse` flag.

### 8.4 Everything drills

Every displayed figure is a link. The drill hierarchy:

```
L0 Group → L1 Entity → L2 Process → L3 Sub-process → L4 Transaction → L5 Root cause
```

No dead-end numbers. If a number cannot drill (e.g. Close %, which is read-only
from an external tracker), it must show a `read-only · source: close tracker` tag
rather than be silently unclickable.

### 8.5 Mode-aware header

The header currently always says "DAY 4 OF CLOSE", which is only true for six days
a month. Introduce three modes with a toggle (demo control):

| Mode | Period | Header shows | Top panel foregrounds |
|---|---|---|---|
| `close` | Day 1–6 | `DAY N OF CLOSE` | Close status, blockers, exposure at close |
| `bau` | Day 7–20 | `BUSINESS AS USUAL · DAY N` | Exception clearance, cash opportunity, cause elimination |
| `preclose` | Day 21–month end | `PRE-CLOSE READINESS · N DAYS TO CLOSE` | Unposted GRs, unapplied cash, aged breaks, open disputes |

Pre-close readiness is the most valuable mode because it is preventive.

### 8.5.1 Direction is not always defined

`Metric` takes `inverse: true | false | null`. **DPO is `null` — direction-neutral,
rendered in `textMuted` whatever way it moves.**

Rising DPO is good when it comes from negotiated terms and bad when it comes from
invoices you cannot process. This platform cannot tell those apart from the data, so
colouring the delta green or red asserts something indefensible. Show the movement,
show the adjusted figure beside it (§8.6), and let the controller judge. A metric
whose direction we cannot defend gets no colour — that restraint is itself a
credibility signal.

Reconciliation value, AP blocked, AR over 90 days, cash unapplied and DSO are all
down-is-good (`inverse: true`). Close % and touchless rate are up-is-good
(`inverse: false`).

### 8.6 Honest metrics

Where a favourable-looking metric is distorted, say so inline. Specifically: DPO of
48 days is partly inflated by blocked invoices. Show a footnote flag on DPO:
*"Includes ₹18.6 cr of blocked invoices; adjusted DPO 41 days."*

### 8.6.1 Every derived KPI states what it counts

A composite or derived figure must expose its definition on hover or click — what is
counted, what is excluded, over what period. "Open exceptions 1,980" invites the
question "which exceptions?", and a controller who cannot get an answer discounts the
number. This applies to value at risk, open exceptions, group score, every dimension
score, and any aggregated row in the Group view.

The definition text lives with the accessor that computes the figure, not in the
component, so one number has one definition wherever it appears.

### 8.7 Data freshness

Every screen header carries: `SAP ECC · as of 06:00 IST` (source + timestamp).
Where a screen mixes sources, list them.

### 8.8 Restricted access

Risk & control content (§7.8) is restricted. Render behind a visible
`RESTRICTED — Financial Controller and above` marker and a demo-only toggle. SoD
conflicts and bank change alerts must not appear on any screen a plant manager
would open (i.e. not on counterparty or process cockpits).

### 8.9 Worklists are actionable

A worklist without a closed loop is a report. Every exception row supports:
`Assign`, `Chase`, `Release`, and multi-select for bulk actions. Actions mutate
local state and append to the item's `evidence[]`. Sort by **value** by default,
never by count.

### 8.10 Cross-process traceability

At least one demo path must cross towers, to prove the platform is not three silos:
a missing goods receipt in P2P → blocks an invoice → understates the accrual in
R2R → appears in the close exposure figure. Wire this as a clickable chain.

---

## §9. Screen inventory

Existing screens to keep and modify:

| Screen | Change |
|---|---|
| Group view | Six named dimensions, computed scores, veto badges, trends, correct entities, segment toggle |
| Entity health | Six dimensions, sensitivity, financial consequence strip, mode-aware panel |
| P2P cockpit | In-flight relabel, trends, attribution column |
| O2C cockpit | In-flight relabel, trends, attribution column |
| Worklist | Actions, attribution, evidence trail, control significance |
| Root cause | Add elimination status, owner, target date |
| Working capital | Trends, DPO honesty flag, link to forecast |

New screens to build:

| Screen | Section |
|---|---|
| Service & attribution | §4, §5, §7.7 |
| Risk & control | §7.8, §8.8 |
| Predictive | §7.3 |
| Counterparty (vendor / customer / cost centre / plant) | §6 `Counterparty` |
| Finance Service Desk (request intake) | §6 `Request` |
| Compliance | §7.9 |
| Data & MDM quality | §6 `DataQualityItem` |
| Cause elimination backlog | §7.5 |
| Ask the Control Tower (answer panel) | §11 |

### 9.1 Navigation grouping

Reorganise the left rail into labelled groups rather than a flat list:

```
OVERVIEW      Group view · Entity health
PROCESS       P2P cockpit · O2C cockpit · R2R cockpit
EXPLAIN       Worklist · Root cause · Cause elimination
ASSURE        Risk & control · Compliance · Data quality
FORWARD       Working capital · Predictive
SERVICE       Service & attribution · Finance Service Desk
```

Counterparty pages are reached by drill, not from the rail.

The rail is `src/app/Rail.tsx`, driven by the nav item list in
`src/app/routes.tsx`. That list currently carries **literal counts**; per §0 those
must be derived from the API accessors instead. Adding a screen means touching
four things in `routes.tsx`: the route table, the nav item list, the breadcrumb
builder, and the active-nav resolver.

---

## §10. Design constraints

- **All tokens live in `src/theme/tokens.ts`.** Components consume them as
  `colors.*` CSS variables. **Never write a literal hex value in a component.**
- If a new colour is genuinely unavoidable, add it to **both** the dark and light
  palettes in `tokens.ts` in the same edit. `npm run verify:theme` enforces this.
- The palette has `bgAccentSoft` and `bgAccentPanel` for blue but **no status-tinted
  surface**, which forces amber and red messaging onto transparent backgrounds. Add
  `bgWarnSoft` and `bgRiskSoft` to both palettes, standing in the same relationship
  to `statusAmber` and `statusRed` as `bgAccentSoft` does to `accent`. These are
  needed by the veto banner (§7.10.1), risk and control (§7.8) and overdue
  compliance (§7.9) — add them once, deliberately, rather than improvising per step.
- **Light-theme `statusRed` is under-darkened and must be corrected to `#C22E2E`.**
  The light palette darkens green to `#14764F` (5.62:1 on white) and amber to
  `#A16207` (4.92:1), but leaves red at `#D33C3C` (4.69:1) — the outlier. On
  `bgRiskSoft` it drops to 4.30 and fails AA for small text, which would force every
  red-on-tint element in risk, control and compliance to carry a size or weight
  exemption. `#C22E2E` gives 5.64 on white and 5.17 on `bgRiskSoft`, clears AA
  everywhere, and brings red into family with the other two. Change the token, not
  the tint. Dark-theme `statusRed` is unaffected.
- **Never append an alpha suffix to a CSS variable** — `${colors.x}55` is invalid
  CSS and silently renders nothing. Use `color-mix(in srgb, var(--x) 33%,
  transparent)` or an existing border token.
- Prefer existing tokens. For the attribution stacked bar (§5) use, in order:
  `accent` → `ageingBarAlt` → `borderAccent` → `textFaintest`. No new tokens needed.
- **Radii are zero everywhere.** `radii.dot: 50%` on `StatusDot` is the only round
  shape in the product. No rounded cards, chips, pills or buttons.
- **One shadow exists** (`paletteShadow`, on the command palette). Do not add another.
- Money is formatted with `formatCr()` from `src/lib/format.ts`. Do not write a
  second money formatter.
- **Where this spec's formatting hints conflict with established codebase
  precedent, precedent wins.** This spec describes behaviour and content; the
  codebase owns visual grammar. If the spec shows italic and nothing in `src/` is
  italic, do not introduce italic — match the codebase and note it.
- Global CSS is only for hover/active/focus states and keyframes, in
  `src/index.css`, referencing CSS variables. Everything else is an inline style
  object built from tokens.
- Dark theme stays. The existing type pairing (sans for prose, mono for numbers
  and small-caps labels) stays.
- Colour must never be the only carrier of meaning — always pair a RAG colour with
  a text label (`74 AMBER`).
- Label every colour bar. The five unlabelled bars in the current Group view are a
  defect: after §3.1 they become six named dimensions with visible names.
- No `Math.random()`. All data deterministic.
- No new runtime dependencies unless a prompt explicitly authorises one.
- Numbers use `₹NN.N cr` for value, `NN d` for days, `NN%` for rates.
- Fix known layout collisions: age column colliding with blocking reason on the
  worklist; effort and owner columns merged on the working capital view.

---

## §11. Ask the Control Tower

A conversational panel with four modes — **ask, explain, investigate, recommend**.

For the prototype, hardcode a small set of question → answer pairs against the
canonical dataset. Requirements:

- Every answer must cite the transactions, owners or service records behind it,
  rendered as clickable chips that drill to the relevant screen.
- Every answer offers 2–3 follow-up actions (`Show the journal`, `Assign owner`,
  `Notify Entity B`).
- Never assert anything the dataset does not contain. If no answer exists, say so.

Seed questions:

1. "Why is this entity amber?"
2. "What lifts it fastest?"
3. "Why do blocked invoices keep recurring?"
4. "What is our exposure at close?"
5. "Whose delay is driving the SLA breach?"
6. "What will DSO be at month-end?"

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

## §13. Codebase conventions

The prototype is React 18 + TypeScript on Vite 5, with react-router-dom 6. There is
no CSS framework. Read `PROJECT-MAP.md` for the full file inventory.

### 13.1 The data layer — extend it, never bypass it

```
src/api/types.ts      domain interfaces
src/api/mock/*.ts     static datasets
src/api/index.ts      the ONLY public accessor surface
```

- Components import from `../api` (or `../../api`). **They never import from
  `src/api/mock/*` directly.** This is an existing rule of the codebase; preserve it.
- **Do not create a parallel data module** such as `src/data/`. All new datasets go
  into `src/api/mock/` and are exposed through new accessors in `src/api/index.ts`.
- **Extend the existing type names rather than introducing parallel ones.** The
  interfaces in §6 are a description of the data shape, not a mandate to rename:

| §6 name | Existing type to extend |
|---|---|
| `Entity` | `Entity` in `src/api/types.ts` — currently has five dimension scores |
| `Exception` | `Exception` — add attribution, evidence, control significance, status |
| `RootCause` | `CauseNode` — keep this name, add elimination fields |
| stage counts | `ProcessStage` — add in-flight vs exception split |
| `Counterparty`, `ControlSignal`, `ComplianceItem`, `DataQualityItem`, `Forecast`, `ServiceMetric`, `Request`, `Trend`, `Veto`, `SensitivityItem` | new types, add to `src/api/types.ts` |

- Accessors are synchronous and return static arrays. Keep it that way — no
  network layer, no async, no state management library.

### 13.2 Derivations

`src/theme/derive.ts` holds every number-to-colour and number-to-word derivation
(`scoreColor`, `statusWord`, `statusColor`, `ageColor`, `controlColor`,
`breachColor`). It contains no hex values — it reads `colors.*`.

New derivations (attribution colour, veto badge state, trend direction) belong
here, not in a page component.

### 13.3 Shared components

`src/components/` with a barrel export in `index.ts`. Existing set: `Card`,
`Eyebrow`, `StatusDot`, `Bar`, `AgeingChart`, `StageFlow`, `DataTable`,
`CommandPalette`.

Reuse before building. In particular: `DataTable` for any new table, `Bar` for any
meter, `Card` + `Eyebrow` for any panel. New shared components get added to the
barrel.

### 13.4 Routing and navigation

`src/app/routes.tsx` owns four things that must stay in sync: the route table
(`AppRoutes`), the nav item list, the breadcrumb builder, and the active-nav
resolver. `src/app/paths.ts` holds link resolvers such as `defaultRootCauseTo()`.

Every new screen requires all four, plus:
- registration in `CommandPalette`'s result set
- a drill path entry in `scripts/verify-drills.mjs`
- a route entry in `scripts/verify-theme.mjs` — the contrast census cannot cover a
  screen it never visits

Selectors in the verify scripts must be stable — a driver id or test id, never
"first matching row". Row order is a rendering detail and an assertion resting on it
will fail silently the first time a sort changes.

### 13.5 The assistant already exists

`src/features/assistant/` contains `AssistantDrawer.tsx` (the 470px right-hand
drawer, message list, streaming bubble, follow-up chips, preset questions,
free-text input) and `provider.ts` (`AssistantProvider` interface +
`MockAssistantProvider` streaming canned answers in ~4-char chunks every 18ms).

`AssistantContext.ask()` lets any screen open the drawer with a question — this is
how "Ask why this entity is amber" on `EntityHome` works.

**Extend `MockAssistantProvider` behind the existing interface.** Do not rebuild
the drawer, do not change the provider interface, do not integrate a real LLM.

### 13.6 Tests and verification

```
npm test                  Vitest — tests/ plus co-located *.test.ts(x)
npm run verify:theme      token/palette parity check
npm run verify:drills     drill-path check
npm run dev               Vite, port 5200 (strict)
```

Existing suites cover the data layer, shell, routes and every page. **Changing the
Entity shape, the score model or the nav will break tests — fix them in the same
step, do not leave them red.** Report the test result at the end of every step.
