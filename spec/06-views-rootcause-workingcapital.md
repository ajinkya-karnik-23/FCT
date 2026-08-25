# Spec 06 — Root cause view and working capital view

Read `01-tokens.md` and `03-data.md` first. The PNGs in `screenshots/` are for human reviewers — do
not try to read them. The layout maps below plus the prototype HTML are the visual source.

```
ROOT CAUSE  /entity/:code/root-cause/:causeKey
+------------------------------------------------------------------------------+
| LEVEL 5 - ROOT CAUSE                                                         |
| Why blocked invoices keep recurring                                          |
+----------------+-------------------------------------------------------------+
| TAXONOMY - P2P | PRIMARY ROOT CAUSE - Missing GR   (accent panel)            |
| Missing GR  34%| narrative sentence, 17px                                    |
| PO price    22%| VALUE AT RISK | AVG DELAY | RECURRENCE | CONCENTRATION       |
| Approval    18%+-------------------------------------------------------------+
| Vendor mstr 11%| BY PLANT      | BY VENDOR GROUP | RECOMMENDED INTERVENTION   |
| Duplicate    8%| bars          | bars            | 3 em-dash bullets         |
| Tax          7%|               |                 |                           |
+----------------+---------------+-----------------+---------------------------+
```

```
WORKING CAPITAL  /entity/:code/working-capital
+------------------------------------------------------------------------------+
| WORKING CAPITAL                          DSO 62 d   DPO 48 d   REL. Rs4.2 cr  |
| Cash locked in exceptions                                                    |
+-----------------------------------+------------------------------------------+
| RECEIVABLES AGEING                | PAYABLES BLOCKED BY REASON               |
| 5 horizontal 18px bars            | 5 horizontal 18px bars                   |
+-----------------------------------+------------------------------------------+
| CASH OPPORTUNITY | VALUE | ITEMS | EFFORT | OWNER                            |
| 4 rows, not clickable                                                        |
+------------------------------------------------------------------------------+
```

---

## Root cause view — route `/entity/:code/root-cause/:causeKey`

Header: eyebrow "LEVEL 5 — ROOT CAUSE", title "Why blocked invoices keep recurring" (26px/600).

Body: `grid-template-columns: 320px 1fr; gap: 16px; align-items: start`.

### Left: taxonomy list

`1px solid border-default`, `bg-panel`. Header `TAXONOMY — P2P` (mono eyebrow, `padding: 14px 18px`,
bottom border). Then one row per cause: `padding: 13px 18px`, bottom border `border-subtle`,
`border-left: 2px solid transparent`, name (13px) left and share (12px mono, `text-muted`) right.
Selected row: `border-left-color: accent`, background `bg-raised`. Hover: `bg-raised`.
Clicking a row navigates to that cause key (URL changes, right side updates).

### Right column

**Primary root cause panel** — `1px solid border-accent`, background `bg-accent-panel`,
`padding: 22px`, `gap: 14px`:
1. Row: a 6px `accent` dot + mono eyebrow in `accent-text`: `PRIMARY ROOT CAUSE — {cause name}`
2. The narrative, 17px, line-height 1.55, `text-primary`, `max-width: 1100px`, `text-wrap: pretty`
3. Four metric blocks in a row, `34px` apart. Each: mono 10px `text-faint` label
   (letter-spacing 0.1em) above a 22px mono value:
   `VALUE AT RISK` ₹6.3 cr · `AVG DELAY` 8.4 days · `RECURRENCE` 5th month ·
   `CONCENTRATION` 11 vendors

**Three cards below** — `1fr 1fr 1fr`, `gap: 16px`, each `1px solid border-default`, `bg-panel`,
`padding: 20px`, mono eyebrow:
- `BY PLANT` — one row per plant driver: name (13px) · 70px × 6px track with `accent` fill at the
  driver percentage · percentage (12px mono, `text-muted`, 36px right-aligned)
- `BY VENDOR GROUP` — same pattern with the vendor drivers
- `RECOMMENDED INTERVENTION` — the cause's actions, one per row, each prefixed by an em dash in
  `accent`, 13px, line-height 1.45, `text-secondary`

All content on the right comes from the selected `CauseNode`. Nothing here is generated at runtime.

---

## Working capital view — route `/entity/:code/working-capital`

Header row (space-between, baseline). Left: eyebrow "WORKING CAPITAL" + title
"Cash locked in exceptions". Right: three KPI blocks `34px` apart, each a mono 10px `text-faint`
label above a 26px mono value: `DSO` 62 d (amber) · `DPO` 48 d · `RELEASABLE` ₹4.2 cr (green).

### Two cards (`1fr 1fr`, `gap: 16px`)

Both `1px solid border-default`, `bg-panel`, `padding: 22px`, `gap: 18px`, mono eyebrow.

**RECEIVABLES AGEING** — five rows, each: bucket label (12px mono, `text-muted`, 80px wide) ·
a flexible 18px track (`border-subtle`) with a fill scaled to the largest bucket · value
(mono, 90px, right-aligned). Buckets wider than 40% use `accent`; the older, narrower buckets use
`chart-ar-old`.

**PAYABLES BLOCKED BY REASON** — same row pattern with a 150px sans label and all fills in `accent`.

### Cash opportunity table

`1px solid border-default`, `bg-panel`. Grid `1fr 140px 140px 140px 180px`. Header (table-header
type): `CASH OPPORTUNITY | VALUE | ITEMS | EFFORT | OWNER` (the three middle columns right-aligned).
Four rows, `padding: 14px 20px`, bottom border `border-subtle`, 13px: name in `text-primary`, value
in mono `status-green`, items and effort in mono `text-secondary`, owner in `text-secondary`.
Rows are not clickable.
