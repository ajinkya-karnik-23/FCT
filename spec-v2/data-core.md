# Canonical dataset §7.1–§7.16 — scores, metrics, trends

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

**These are POOL figures, not sample figures.** The earlier values conflated the two:
52 was the oldest row in JGL's twelve-row sample, but the pool of 327 runs older — and
the blocked ageing chart carries a >90 day bucket, which is impossible if nothing
exceeds 52 days. Two receivables values were also impossible: JCP and JHS held AR over
90 days with an oldest receivable under 90.

| Entity | apBlockedOldestDays | arOver90OldestDays | cashUnappliedOldestDays | reconOldestDays |
|---|---|---|---|---|
| JGL | 118 | 148 | 22 | 61 |
| JBL | 142 | 172 | 31 | 79 |
| JPS | 76 | 112 | 14 | 38 |
| JCP | 34 | 98 | 8 | 16 |
| JHS | 51 | 104 | 11 | 22 |
| JRP | 168 | 210 | 44 | 94 |

Every `arOver90OldestDays` must exceed 90 — an entity cannot hold receivables over 90
days whose oldest receivable is younger than that.

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
