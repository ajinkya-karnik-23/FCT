# Cross-cutting UI rules, screen inventory, the assistant

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

## §11. Ask the Control Tower

A conversational panel with four modes — **ask, explain, investigate, recommend**.

For the prototype, hardcode a small set of question → answer pairs against the
canonical dataset. Requirements:

- Every answer must cite the transactions, owners or service records behind it,
  rendered as clickable chips that drill to the relevant screen.
- Every answer offers 2–3 follow-up actions (`Show the journal`, `Assign owner`,
  `Notify Entity B`).
- Never assert anything the dataset does not contain. If no answer exists, say so.

Seed questions — these must span the screens built since, not just the original four:

1. "Why is this entity amber?" — and on JRP, "why is this entity capped?"
2. "What lifts it fastest?"
3. "Why do blocked invoices keep recurring?"
4. "What is our exposure at close?"
5. "Whose delay is driving the SLA breach?"
6. "What will DSO be at month-end?"
7. "What compliance is overdue?"
8. "What has master data quality cost us?"
9. "Which causes have we eliminated?"

**Every answer recomputes from the accessors at answer time.** Static strings go
stale the moment a figure moves, and this platform has moved almost every figure at
least once. An answer that disagrees with the screen behind it destroys the one thing
the panel is for.

**The JRP capped answer is the demo highlight.** It should say plainly that the score
fell 60 → 55 because an unauthorised bank change was detected this period, that the
raw score barely moved (60.5 → 57.9), and that until that cap is lifted no other
action moves the number. That is the veto rule, the attribution model and the
controllership argument in one answer — and it cites a control signal, a score
history and a sensitivity list, all of which drill.

---
