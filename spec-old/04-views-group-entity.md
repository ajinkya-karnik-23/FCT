# Spec 04 — Group view and entity health home

Read `01-tokens.md` and `03-data.md` first. The PNGs in `screenshots/` are for human reviewers — do
not try to read them. The layout maps below plus the prototype HTML are the visual source.

```
GROUP VIEW  /
+------------------------------------------------------------------------------+
| LEVEL 0 - GROUP                        GROUP SCORE  VALUE AT RISK  OPEN EXC. |
| Finance health across six legal entities      76.5      Rs92.4 cr      1,486 |
+------------------------------------------------------------------------------+
| LEGAL ENTITY | HEALTH | DIMENSIONS | AP BLK | AR>90 | UNAPP | CLOSE | BREACH |
| o Entity 1   | 74 AMB | ||||| bars |  18.6  | 12.4  |  3.1  |  78%  |    4   |
| ... 6 rows, whole row links to /entity/:code                                 |
+------------------------------------------------------------------------------+
| RECURRING CAUSES     | CLOSE PROGRESS - DAY 4  | TRANSFORMATION HEALTH       |
| 4 labelled bars      | 71% + progress bar      | 4 label/value rows          |
+----------------------+-------------------------+-----------------------------+
```

```
ENTITY HEALTH HOME  /entity/:code
+------------------------------------------------------------------------------+
| LEVEL 1 - LEGAL ENTITY                74 /100 [AMBER]  5 dimension meters    |
| Jubilant Generics Ltd                                                        |
+------------------------------------------------------------------------------+
| Cash unapp | AP blocked | AR >90d | Close | Reconciliations | Controls        |  <- 6 tiles, one row
+------------------------------------------------------------------------------+
| TOP ISSUES REQUIRING ATTENTION   | ROOT CAUSE INSIGHTS                       |
| 6 rows: dot label value age owner| 3 labelled bars                           |
|                                  +-------------------------------------------+
|                                  | RECOMMENDED ACTIONS (accent panel)        |
|                                  | sentence + meta + button                  |
+----------------------------------+-------------------------------------------+
```

---

## Group view — route `/`

Content padding `30px 26px 40px`, sections stacked with `24px` gaps.

### Header row (space-between, baseline-aligned)

Left: eyebrow "LEVEL 0 — GROUP", then title "Finance health across six legal entities" (26px/600).
Right: three KPI blocks, `34px` apart, each a mono eyebrow label above a 30px mono value:
- GROUP SCORE — `76.5` in `status-amber`
- VALUE AT RISK — `₹92.4 cr`
- OPEN EXCEPTIONS — `1,486`

### Entity table

`1px solid border-default`, background `bg-panel`. Grid columns:
`300px 120px 1fr 130px 130px 130px 110px 90px`.

Header row (`padding: 12px 20px`, bottom border `border-default`, table-header type):
`LEGAL ENTITY | HEALTH | DIMENSIONS | AP BLOCKED | AR >90D | UNAPPLIED | CLOSE | BREACHES`
(the four money/percent columns are right-aligned).

Each row: `padding: 16px 20px`, bottom border `border-subtle`, hover background `bg-raised`,
whole row is a link to `/entity/:code`.
1. 8px status dot (`statusColor(score)`) + entity name (14px/500)
2. Score (17px mono/600, `scoreColor`) + status word (10px mono, letter-spacing 0.1em, `text-faint`)
3. Dimensions: five equal-width columns, `6px` gaps, `padding-right: 24px`. Each is a 22px-tall
   track in `border-subtle` with a bottom-anchored fill whose height is `22 * dim / 100`, colored
   `scoreColor(dim)`. Each carries a `title` of the dimension name
   (Close, Control, Wk capital, Process, Service).
4-6. AP blocked, AR >90D, Unapplied — 13px mono, right-aligned (Unapplied in `text-secondary`)
7. Close % — 13px mono, right-aligned, `text-secondary`
8. Breaches — 13px mono, right-aligned, `breachColor(n)`

### Three cards below (`grid-template-columns: 1fr 1fr 1fr; gap: 16px`)

All three: `1px solid border-default`, `bg-panel`, `padding: 20px`, mono eyebrow heading.

**GROUP-WIDE RECURRING CAUSES** — four rows: label (13px) · 110px × 6px bar track with an `accent`
fill scaled to the percentage · percentage (12px mono, `text-muted`, 42px wide, right-aligned).

**CLOSE PROGRESS — DAY 4** — "71%" (30px mono/600) beside "of 214 tasks complete" (13px,
`text-muted`); an 8px full-width progress bar filled 71% in `accent`; a row of three 13px facts:
"19 overdue", "6 blockers" (`status-red`), "3 entities at risk".

**TRANSFORMATION HEALTH** — four label/value rows (13px), values in mono:
"Automation rate 68% ↑" (green), "Repeat exceptions −14% QoQ" (green), "Causes eliminated 11 of 34",
"Touchless invoices 54%".

---

## Entity health home — route `/entity/:code` (the hero screen)

Content padding `30px 26px 40px`, sections `22px` apart.

### Header row (space-between, top-aligned)

Left: eyebrow "LEVEL 1 — LEGAL ENTITY" + entity name (26px/600).
Right, in one row `34px` apart:
- Score: 44px mono/600 in `scoreColor`, then "/100" (14px mono, `text-faint`), then a status chip —
  12px mono, letter-spacing 0.12em, `padding: 4px 9px`, text in the status color, border
  `1px solid <statusColor>55` (33% alpha).
- Five dimension meters: `repeat(5, 96px)` grid, `14px` gaps. Each is an 11px label
  (`text-muted`) above a 6px track (`border-subtle`) filled to `dim%` in `scoreColor(dim)`.
  Labels: Close, Control, Wk capital, Process, Service.

### Six-tile strip

One bordered row (`1px solid border-default`, `bg-panel`), `grid-template-columns: repeat(6, 1fr)`,
each tile `padding: 18px 20px`, `1px solid border-default` right divider except the last.
Each tile: label (12px, `text-muted`), value (22px mono/600), sub-line (12px, red or amber).
Whole tile is clickable.

| label | value | sub-line | tone | navigates to |
|---|---|---|---|---|
| Cash unapplied | ₹3.1 cr | 19 receipts | amber | `/entity/:code/working-capital` |
| AP blocked | ₹18.6 cr | 327 invoices | red | `/entity/:code/p2p` |
| AR > 90 days | ₹12.4 cr | 41 customers | red | `/entity/:code/working-capital` |
| Close | 78% | 7 blockers | amber | stays on this page |
| Reconciliations | ₹14.3 cr | 18 aged breaks | red | `/entity/:code/root-cause/missing-gr` |
| Controls | 4 breaches | 12 high-risk JEs | amber | `/entity/:code/root-cause/missing-gr` |

Values come from the entity record; only the sub-lines are static copy.

### Body — `grid-template-columns: 1.4fr 1fr; gap: 16px`

**Left: TOP ISSUES REQUIRING ATTENTION** card. Header row with the mono eyebrow and an
"Open worklist →" link (12px, `accent-text`) to the worklist. Then six rows, grid
`16px 1fr 110px 100px 150px`, `padding: 14px 20px`, bottom border `border-subtle`, hover
`bg-raised`, each clickable:

| dot | label | value | age | owner | navigates to |
|---|---|---|---|---|---|
| red | AP blocked > 30 days | ₹18.6 cr | oldest 52 d | Entity controller | p2p |
| red | Overdue AR > 90 days | ₹12.4 cr | oldest 148 d | Collections lead | working-capital |
| amber | Unapplied cash | ₹3.1 cr | oldest 22 d | Cash application | working-capital |
| amber | Reconciliation breaks | 18 items | oldest 61 d | R2R tower | root-cause |
| amber | High-risk manual journals | 12 JEs | this period | Financial controller | root-cause |
| amber | Overdue queries | 27 tickets | SLA breached | Service delivery | worklist |

Value column is 13px mono right-aligned; age is 12px mono `text-muted` right-aligned; owner is 12px
`text-muted` right-aligned.

**Right column, two stacked cards (`gap: 16px`):**

*ROOT CAUSE INSIGHTS* — mono eyebrow with an "Analyse →" link (12px, `accent-text`). Three rows,
each clickable to `/entity/:code/root-cause/:causeKey`: label + percentage (13px, percentage in
mono `text-muted`) above a 6px track with an `accent` fill. Use the first three taxonomy causes.

*RECOMMENDED ACTIONS* — `1px solid border-accent`, background `bg-accent-panel`, `padding: 20px`.
Mono eyebrow in `accent-text`. Then a 13px sentence in `text-secondary`:
"₹4.2 cr working-capital release available by clearing GR compliance on 11 vendors."
Then a 12px mono meta row: "38 resolvable today" · "3 systemic".
Then a full-width button, `1px solid accent`, `padding: 9px 12px`, 13px, centered:
"Ask why this entity is amber" — opens the AI drawer and asks that question (see spec 07).
Hover background `#12233C`.
