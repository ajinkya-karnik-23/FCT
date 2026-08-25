# Spec 05 — P2P cockpit, worklist, exception detail

Read `01-tokens.md` and `03-data.md` first. The PNGs in `screenshots/` are for human reviewers — do
not try to read them. The layout maps below plus the prototype HTML are the visual source.

```
P2P COCKPIT  /entity/:code/p2p
+------------------------------------------------------------------------------+
| LEVEL 2 - PROCESS . PROCURE TO PAY                                           |
| End-to-end flow, not seven separate reports                                  |
+------+------+------+------+------+------+------+                             |
| PR   | PO   | GR   | INV  | MTC  | APR  | PAY  |  <- 7 equal stage cards      |
| name | name | name | name | name | name | name |     step + dot, name,        |
| vol  | vol  | vol  | vol  | vol  | vol  | vol  |     volume, value, 4px bar,  |
| val  | val  | val  | val  | val  | val  | val  |     exception %              |
+------+------+------+------+------+------+------+-----------------------------+
| BLOCKED BY AGEING     | TOP CAUSES (click)     | SERVICE & CONTROL           |
| 5 vertical bars       | 6 rows with bars       | 4 rows + bottom button      |
+-----------------------+------------------------+-----------------------------+
```

```
WORKLIST  /entity/:code/p2p/invoices
+------------------------------------------------------------------------------+
| LEVEL 4 - EXCEPTIONS               12 SHOWN   VALUE Rs..   >30 DAYS Rs..      |
| Blocked invoices worklist                                                    |
| CAUSE [All][Missing GR][...]                  SORT [Value][Age][Vendor]      |
+------------------------------------------------------------------------------+
| INVOICE | VENDOR | AMOUNT | AGE | BLOCKING REASON | PLANT | OWNER | CONTROL   |
| 12 rows, whole row links to the exception detail route                        |
+------------------------------------------------------------------------------+
```

```
EXCEPTION DETAIL  /entity/:code/p2p/invoices/:id
+------------------------------------------------------------------------------+
| LEVEL 4 - TRANSACTION                 [Why does this keep happening?]         |
| Suraksha Chemicals Pvt Ltd            [Escalate to plant controller]          |
| AP-104281 . PO-4471902 . booked 14 Jul 2026                                   |
+---------------------------------------+--------------------------------------+
| TRANSACTION                           | LIFECYCLE                            |
| 10 label/value rows                   | 6 dated rows with dots               |
|                                       +--------------------------------------+
|                                       | NEXT ACTION (accent panel)           |
|                                       | sentence + 3 chips                   |
+---------------------------------------+--------------------------------------+
```

---

## P2P cockpit — route `/entity/:code/p2p`

Header: eyebrow "LEVEL 2 — PROCESS · PROCURE TO PAY", title
"End-to-end flow, not seven separate reports" (26px/600).

### Stage flow

`grid-template-columns: repeat(7, 1fr); gap: 10px`. One card per stage (data in spec 03), each
`1px solid border-default`, `bg-panel`, `padding: 16px`, flex column `gap: 8px`, clickable to the
worklist, hover border `accent`:

1. Row: step code (10px mono, letter-spacing 0.12em, `text-faint`) and a 7px status dot on the right
2. Stage name (14px/600)
3. Volume (19px mono) — thousands-separated
4. Value (12px mono, `text-secondary`)
5. A 4px track (`border-subtle`) with a fill of width `exceptionPct * 3.4%` in the status color
6. "26% exception" (11px mono) in the status color, or `text-muted` when green

### Three cards below (`1fr 1fr 1fr`, `gap: 16px`)

**BLOCKED INVOICES BY AGEING** — a 130px-tall row of five bottom-aligned columns, `10px` gaps. Each
column: value label above (11px mono, `text-secondary`, centered), then the bar (width 100% of the
column; height proportional to value, tallest ≈ 100px; `accent` for the two largest buckets,
`#1F5FB5` for the rest), then the bucket label below (10px mono, `text-faint`, centered).

**TOP CAUSES — CLICK TO DRILL** — six rows: label (13px) · 90px × 6px track with `accent` fill ·
percentage (12px mono, `text-muted`, 38px right-aligned). Each row navigates to
`/entity/:code/root-cause/:causeKey`; hover turns the label `accent-text`.

**SERVICE & CONTROL** — four 13px label/value rows with mono values: SLA on invoice booking 93.1%
(amber) · Queries overdue 27 (red) · Duplicate payment risk ₹0.9 cr · Manual payment runs 4.
Pinned to the bottom of the card (`margin-top: auto`): a full-width button,
`1px solid border-strong`, `padding: 9px 12px`, 13px, centered — "Open 327 blocked invoices →".

---

## Worklist — route `/entity/:code/p2p/invoices`

Header row (space-between, baseline): left, eyebrow "LEVEL 4 — EXCEPTIONS" + title
"Blocked invoices worklist". Right, three mono 12px `text-muted` aggregates computed over the
**currently filtered** rows, `28px` apart:
`{n} SHOWN` · `VALUE ₹{sum} cr` · `>30 DAYS ₹{sum of rows with age > 30} cr`.

### Filter and sort bar

One flex row, `10px` gaps, wrapping.
Left: a "CAUSE" mono label, then chips: `All` plus the six taxonomy cause names.
Right (`margin-left: auto`): a "SORT" mono label, then chips: `Value`, `Age`, `Vendor`.

Chip style — `padding: 7px 12px`, 13px:
- inactive: `1px solid border-strong`, `text-muted`, transparent
- active: `1px solid accent`, background `bg-accent-soft`, `text-primary`
- hover: border `accent`

Filter writes `?cause=`, sort writes `?sort=`. Sorting: Value = amount descending,
Age = ageDays descending, Vendor = vendor name A→Z.

### Table

Grid columns `130px 1fr 130px 90px 170px 130px 130px 110px`. Header (table-header type,
`padding: 12px 20px`, bottom border `border-default`):
`INVOICE | VENDOR | AMOUNT | AGE | BLOCKING REASON | PLANT | OWNER | CONTROL`
(AMOUNT, AGE and CONTROL right-aligned).

Rows: `padding: 13px 20px`, bottom border `border-subtle`, 13px, hover `bg-raised`, whole row links
to `/entity/:code/p2p/invoices/:id`.
- Invoice id — mono, `accent-text`
- Vendor — sans, `text-primary`
- Amount — mono, right-aligned, two decimals
- Age — mono, right-aligned, `ageColor(days)`, rendered "41 d"
- Reason, Plant, Owner — sans, `text-secondary`
- Control — 12px mono, right-aligned, `controlColor()`

Empty state: if a filter matches nothing, show a single row with
"No exceptions match this cause" in `text-muted` — do not collapse the table.

---

## Exception detail — route `/entity/:code/p2p/invoices/:exceptionId`

Header row (space-between, top-aligned). Left: eyebrow "LEVEL 4 — TRANSACTION", vendor name as the
title (26px/600), then a 13px mono `text-muted` line: `{id} · {po} · booked {bookedOn}`.
Right: two buttons (`padding: 10px 16px`, 13px):
- "Why does this keep happening?" — `1px solid border-strong`, hover border `accent`; navigates to
  `/entity/:code/root-cause/{reasonKey of this exception}`
- "Escalate to plant controller" — `1px solid accent`, background `bg-accent-soft`, hover `#17304F`
  (no behaviour required beyond a toast or no-op)

### Body — `grid-template-columns: 1.1fr 1fr; gap: 16px`

**Left card: TRANSACTION.** Mono eyebrow header row with a bottom border, then label/value rows
(`padding: 12px 20px`, bottom border `border-subtle`, 13px, label in `text-muted` left, value right):

```
Entity                 {entity name}
Invoice value          {₹2.84 cr}                        mono
Ageing                 {41 days}                         mono, ageColor
Blocking reason        {reason}
Plant                  {plant}
Purchase order         {po}                              mono
Responsible function   P2P tower — invoice processing
Owner                  {owner}
SLA                    Breached by {max(1, age-15)} days  status-red
Control impact         {control} — payables completeness  controlColor
```

**Right column, two stacked cards (`gap: 16px`):**

*LIFECYCLE* — mono eyebrow, then six rows in a `90px 14px 1fr` grid, `12px` gaps: date (12px mono,
`text-muted`), an 8px dot, and the label (13px). Dot colors: green = done, red = failure,
`accent` = still open (the last row). Rows:

```
02 Jul    green   PO released to vendor
14 Jul    green   Invoice received via vendor portal        (use the exception's booked date)
15 Jul    red     Three-way match failed — no goods receipt
16 Jul    green   Query raised with Nanjangud stores
28 Jul    red     Vendor follow-up, no GR posted
Today     accent  Awaiting GR — escalation due in 6 hours
```
Open rows are `text-primary`; completed rows `text-secondary`.

*NEXT ACTION* — `1px solid border-accent`, background `bg-accent-panel`, `padding: 20px`. Mono
eyebrow in `accent-text`, then a 14px sentence (line-height 1.5, `text-secondary`):
"Goods receipt is pending at Nanjangud stores. Auto-escalation to the plant controller fires in
6 hours; releasing this invoice clears ₹2.84 cr of payment block."
Then three chips (`1px solid border-strong`, `padding: 8px 12px`, 12px, hover border `accent`):
"Chase GR", "Assign owner", "Log control exception".
