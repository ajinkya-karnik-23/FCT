# Handoff: Finance Control Tower

## Overview

Finance Control Tower is a finance controllership application for a multi-entity pharma group
(Jubilant Pharmova, six legal entities). It gives a legal-entity controller one view of financial
health, operational exceptions, controllership risk and root causes across P2P, O2C and R2R.

The product answers three questions in sequence, and the navigation model exists to serve that
sequence:

1. **Where do I have a problem?** — group and entity health
2. **Why do I have the problem?** — exception lists and a fixed root-cause taxonomy
3. **What should happen next?** — named owner, prioritised action, quantified cash benefit

It is deliberately *not* an operations dashboard. It reports **risk, value and action** (₹ impact,
control impact, owner, next step), not throughput and productivity. A separate Operations persona
view is planned but is **not** part of this handoff.

## About the design files

The files in `design-reference/` are **design references created in HTML** — prototypes showing
intended look and behaviour. They are **not production code to copy**. They are authored in a
streaming component format (`.dc.html`, backed by `support.js`) that only exists in the design tool.

Your task is to **recreate these designs in the target codebase's existing environment** (React,
Vue, Angular, SwiftUI, whatever is established) using its established patterns, component library,
routing and data layer. If no codebase exists yet, choose an appropriate stack — the recommendation
for this product is React + TypeScript + Vite, TanStack Table for the dense grids, TanStack Router
or React Router for the drill hierarchy, and a server-driven API per the data model below.

All data in the prototype is **realistic mock data, hard-coded in the component**. It must be
replaced by real API calls. Values, vendor names, plant names and root-cause narratives are
plausible fabrications for a bid demo — treat none of them as real.

## Fidelity

**High-fidelity** for the application (`Controller Cockpit App.dc.html`). Colors, typography,
spacing, density, hover states and interaction behaviour are final and should be recreated
faithfully at a 1920-wide desktop target.

**High-fidelity** for the slide deck (`Controller Cockpit Slides.dc.html`) — this is a 5-slide bid
presentation, not part of the application. It is included for context on the positioning and the
hero-screen concept. Do not implement it.

---

## Design tokens

### Color

| Token | Hex | Use |
|---|---|---|
| `bg/root` | `#080B10` | App canvas |
| `bg/panel` | `#0B1017` | Rail, top bar, cards, table surfaces |
| `bg/panel-alt` | `#0A0F16` | AI drawer |
| `bg/raised` | `#101822` | Row hover, AI assistant bubble |
| `bg/selected` | `#121C27` | Selected nav item, palette row hover |
| `bg/accent-soft` | `#12233C` | Accent buttons, user chat bubble |
| `bg/accent-panel` | `#0D1522` | "Recommended actions" / insight panels |
| `border/default` | `#182231` | Card and section borders |
| `border/subtle` | `#131C27` | Table row dividers, empty bar track |
| `border/strong` | `#22303F` | Inputs, chips, buttons |
| `border/accent` | `#2A3A52` | Accent panel borders |
| `text/primary` | `#E6ECF4` | Primary text |
| `text/secondary` | `#B9C6D6` | Secondary values |
| `text/muted` | `#8798AC` | Labels, meta |
| `text/faint` | `#5C7290` | Mono eyebrow labels, keyboard hints |
| `text/faintest` | `#4A5F7A` | Footer wordmark |
| `accent` | `#2E7DF0` | Primary accent, bars, active states |
| `accent/text` | `#56A0FF` | Links, IDs, "Analyse →" affordances |
| `status/green` | `#35C48A` | Healthy, ≥85 score, improvement |
| `status/amber` | `#F2B23E` | Attention, 65–84 score |
| `status/red` | `#FF6B6B` | Breach, <65 score, >30-day ageing |
| `chart/ar-old` | `#B4551E` | Older AR ageing buckets |

Status is derived, not authored: `score ≥ 85 → green`, `≥ 65 → amber`, else `red`. Ageing:
`> 30 d → red`, `> 15 d → amber`, else secondary text. Control impact: `High → red`,
`Medium → amber`, `Low → muted`.

### Typography

- **UI sans:** `'Helvetica Neue', Helvetica, Arial, sans-serif`
- **Numeric / label mono:** `'IBM Plex Mono', monospace` (weights 400/500/600, Google Fonts)

Every figure, ID, percentage, breadcrumb and eyebrow label is mono. Every sentence is sans.

| Role | Size / weight / tracking |
|---|---|
| View title | 26px / 600 / -0.02em |
| Big score | 44px mono / 600 / line-height 1 |
| KPI value | 30px mono / 600 |
| Tile value | 22px mono / 600 |
| Stage volume | 19px mono / 400 |
| Body, table cell | 13px / 400 |
| Base UI | 14px / 400 |
| Eyebrow label | 10–11px mono / 0.14–0.22em, uppercase, `text/faint` |
| Table header | 10px mono / 0.14em, uppercase |

### Spacing, geometry, motion

- Content padding: `30px 26px 40px`. Card padding: `20–22px`. Table cell padding: `12–16px 20px`.
- Grid gaps: `16px` between cards, `10px` between process stages, `8–14px` inside cards.
- **Border radius: 0 everywhere.** The only round shapes are 6–8px status dots and 7px pulse dots
  (`border-radius: 50%`). No rounded cards, no pill buttons.
- Left rail `236px`, top bar `60px`, AI drawer `470px`, command palette `720px` wide, opened at
  `12vh` from top over `rgba(4,7,11,0.72)`.
- Bars: 4–6px tall for inline meters, 18px for ageing bars, 22px for the sparkline-style dimension
  columns in the group table. Track color `#131C27`.
- Only animation: `ccpulse`, opacity 1 → 0.35 → 1 over 2.4s ease-in-out infinite, on the logo dot
  and the AI panel status dot. Palette and drawer appear without transition in the prototype; a
  120–160ms ease-out fade/slide is acceptable in implementation.
- Shadows: only the palette (`0 40px 100px -30px rgba(0,0,0,0.9)`). No card shadows.

---

## Screens / views

Global chrome is present on every view.

### Left rail (236px, `bg/panel`, right border `border/default`)

Header: pulsing 8px accent dot + "Finance Control Tower" (15px/600) + "JUBILANT PHARMOVA" mono
eyebrow. Nav items, 13px, `10px 12px` padding, 2px left border — active item gets
`border-left: 2px solid accent`, `bg/selected`, primary text; inactive is `text/muted` on
transparent, hover `#131C27`. A right-aligned mono badge shows a count.

Nav, grouped under six mono labels (§9.1): **OVERVIEW** — Group view `6`, Entity health;
**PROCESS** — P2P cockpit `327`, O2C cockpit `284`; **EXPLAIN** — Worklist `12`, Root cause,
Cause elimination; **ASSURE** — Risk & control, Compliance, Data quality; **FORWARD** — Working
capital, Predictive; **SERVICE** — Service & attribution, Service desk. Counts are the default
entity's (JGL) figures from the data layer; items without a count show `—`. The Worklist item stays
active while an exception detail is open; counterparty pages (vendor / customer / plant / cost
centre) are drill-only and never appear in the rail.

Footer, pinned bottom: a "Search everything ⌘K" button (1px `border/strong`, hover border accent).

### Top bar (60px)

Breadcrumb (12px mono, `text/muted`) reflecting the drill path —
`Group › JGL › P2P › Invoices › AP-104281`; 1px×22px divider; entity status dot + entity name (600)
+ code chip in a 1px box; right side: a `DEMO MODE` label with a three-way cockpit-mode toggle
(CLOSE / BAU / PRE-CLOSE, default PRE-CLOSE) whose active mode sets the period label —
`PERIOD AUG-2026 · DAY 4 OF CLOSE`, `BUSINESS AS USUAL · DAY 12` or
`PRE-CLOSE READINESS · 3 DAYS TO CLOSE`; then the dark/light theme button and the **Ask the cockpit**
button (accent dot + label; border becomes accent while the drawer is open).

### 1. Group view (Level 0) — default landing

Header row: eyebrow `LEVEL 0 — GROUP`, title "Finance health across six legal entities", and three
right-aligned KPIs (Group score 76 amber, Value at risk ₹100.4 cr, Open exceptions 1,980), each with
its definition on hover.

Entity table, columns `300px 120px 1fr 130px 130px 130px 110px 90px`:
`LEGAL ENTITY | HEALTH | DIMENSIONS | AP BLOCKED | AR >90D | UNAPPLIED | CLOSE | BREACHES`.
Each row: status dot + name; mono score colored by band + status word (capped entities carry a
CAPPED badge); a six-column micro bar chart (Operational, Service & attribution, Risk & control,
Working capital, Data & MDM quality, Compliance — each 22px track, filled bottom-up to the dimension
score, colored by band, `title` attribute carries the dimension name and its definition); mono money
cells; breach count colored by count (`>3` red, `>0` amber, else green). Row hover `bg/raised`, whole
row navigates to that entity.

Below, three cards: **Group-wide recurring causes** (4 labelled bars), the close card — eyebrow
"Close progress — day 4" in close mode or "Pre-close readiness — 3 days to close" in pre-close; hidden
in BAU (71% of 214 tasks, 8px progress bar, "19 overdue / 6 blockers / 3 entities at risk") — and
**Transformation health** (automation rate 68% ↑, repeat exceptions −14% QoQ, causes eliminated
11 of 34, touchless invoices 54%). The close card also carries the §8.10 cross-process trace strip:
missing goods receipt → blocked invoice → understated accrual → close exposure, this screen's node
current and the other three linked out.

### 2. Entity health home (Level 1) — the hero screen

Header: eyebrow `LEVEL 1 — LEGAL ENTITY`, entity name, and on the right the 44px mono score, `/100`
plus a two-period delta, a status chip (colored text, 1px border at 33% alpha of the status color),
then six dimension meters (124px columns, 6px bars) — Operational, Service & attribution, Risk &
control, Working capital, Data & MDM quality, Compliance. Capped entities show a `CAPPED` badge under
the score; clicking it reveals the raw score and every active cap, and an adjacent button asks the
drawer why.

Six-tile strip in one bordered row, 1px dividers between tiles: Cash unapplied · AP blocked ·
AR > 90 days · Close · Reconciliations · Controls. Each tile is label (12px muted) / value (22px
mono) / sub-line colored red or amber, and each navigates: cash and AR → working capital, AP → P2P,
reconciliations and controls → root cause.

Two-column body (`1.4fr 1fr`):
- **Top issues requiring attention** — card with a header row and "Open worklist →" link; six rows
  in grid `16px 1fr 110px 100px 150px`: status dot, label, mono value, mono age, owner. Rows
  navigate to the relevant view.
- **Root cause insights** — three labelled bars, click drills into that cause; "Analyse →" link.
- **Recommended actions** — accent panel: "₹4.2 cr working-capital release available by clearing GR
  compliance on 11 vendors" (each entity renders its own §7.19 figures), mono meta ("38 resolvable
  today / 3 systemic"), and an **Ask why this entity is amber** button that opens the AI drawer and
  streams the answer.

### 3. P2P cockpit (Level 2)

Eyebrow `LEVEL 2 — PROCESS · PROCURE TO PAY`, title "End-to-end flow, not seven separate reports".

Seven equal stage cards (PR, PO, GR, INV, MTC, APR, PAY), each: mono step code + status dot, stage
name (14px/600), volume (19px mono), value (12px mono secondary), a 4px exception-rate bar, and the
exception percentage in the status color. Cards are clickable → worklist. Stage data:

| Step | Stage | Volume | Value | Exception | Tone |
|---|---|---|---|---|---|
| PR | Requisition | 4,182 | ₹62.1 cr | 4% | green |
| PO | Purchase order | 3,914 | ₹58.4 cr | 6% | green |
| GR | Goods receipt | 3,502 | ₹51.2 cr | 19% | red |
| INV | Invoice | 1,243 | ₹18.6 cr | 26% | red |
| MTC | Three-way match | 916 | ₹14.2 cr | 22% | amber |
| APR | Approval | 589 | ₹8.9 cr | 12% | amber |
| PAY | Payment | 412 | ₹6.1 cr | 3% | green |

Three cards below: **Blocked invoices by ageing** (5 vertical bars, 0-15 / 16-30 / 31-60 / 61-90 /
>90 days with ₹ labels above), **Top causes — click to drill** (6 taxonomy rows, click → root
cause view for that cause), **Service & control** (SLA 93.1%, 27 overdue queries, ₹0.9 cr duplicate
risk, 4 manual payment runs) plus an "Open 327 blocked invoices →" button.

### 4. Blocked invoices worklist (Level 4)

Header shows the sample against its pool, recomputed over the current filter (§7.20):
`12 of 327 shown · ₹12.77 cr of ₹18.6 cr · >30 days ₹8.99 cr · 4 of 38 resolvable in this view` —
the >30-day segment is the stale share of what is shown, and every entity carries its §7.19
resolvable count.

Filter chips: `CAUSE` label then All + the six taxonomy causes. Sort chips (right-aligned):
Value, Age, Vendor. Active chip = accent border, `bg/accent-soft`, primary text; inactive =
`border/strong`, muted text.

Table columns `130px 1fr 130px 90px 170px 130px 130px 110px`:
`INVOICE | VENDOR | AMOUNT | AGE | BLOCKING REASON | PLANT | OWNER | CONTROL`. Invoice ID in
`accent/text` mono; amount mono right-aligned; age colored by threshold; control colored by
severity. Row click → exception detail.

### 5. Exception detail (Level 4, single transaction)

Header: eyebrow `LEVEL 4 — TRANSACTION`, vendor name as title, mono sub-line
`invoice · PO · booked date`. Two buttons: "Why does this keep happening?" (→ root cause) and
"Escalate to plant controller" (accent).

Left card **TRANSACTION**: label/value rows — Entity, Invoice value, Ageing, Blocking reason, Plant,
Purchase order, Responsible function, Owner, SLA (`Breached by N days`, red), Control impact
(`High — payables completeness`).

Right column: **LIFECYCLE** — six dated rows with a status dot (green done, red failure, accent
open) and label; then **NEXT ACTION** accent panel with the narrative
("Goods receipt is pending at Nanjangud stores. Auto-escalation to the plant controller fires in
6 hours; releasing this invoice clears ₹2.84 cr of payment block.") and three action chips: Chase
GR, Assign owner, Log control exception.

### 6. Root cause view (Level 5)

Left 320px **TAXONOMY — P2P** list: the six fixed causes with their share; selected row has an
accent left border and `bg/raised`.

Right column:
- **Primary root cause** accent panel: cause name in the mono eyebrow, a 17px narrative sentence,
  then four mono metrics — Value at risk, Avg delay, Recurrence, Concentration.
- Three cards: **By plant**, **By vendor group** (labelled bars), **Recommended intervention**
  (three em-dash bullets).

The taxonomy is **fixed and deterministic** — AI classifies and explains within it, it does not
invent causes. P2P taxonomy: Missing GR · PO price mismatch · Approval pending · Vendor master ·
Duplicate suspicion · Tax mismatch. (O2C and R2R taxonomies are specified in the deck and should be
modelled the same way: O2C — billing, pricing, deduction, dispute, collection, cash application,
customer master; R2R — source data, journal, reconciliation, intercompany, master data, interface,
close dependency, accounting judgment.)

### 7. Working capital

Header KPIs: DSO 62 d (amber), DPO 48 d, Releasable ₹4.2 cr (green).
Two cards: **Receivables ageing** (5 horizontal 18px bars; buckets >40% width in accent, older
buckets in `chart/ar-old`) and **Payables blocked by reason** (5 bars in accent).
Bottom table `1fr 140px 140px 140px 180px`:
`CASH OPPORTUNITY | VALUE | ITEMS | EFFORT | OWNER` — four rows, value in green.

### 8. AI drawer — "Cockpit intelligence" (470px, right)

Header: pulsing dot, mono `COCKPIT INTELLIGENCE`, close ×. Standing caption: "Grounded on the
finance semantic model — every answer resolves to transactions, owners and SLA records."

Message list: user bubbles right-aligned (`bg/accent-soft`, `border/accent`, max-width 88%),
assistant bubbles left (`bg/raised`, `#1B2634` border, max-width 92%, line-height 1.6). The most
recent completed assistant message renders two follow-up chips: "Open the worklist", "Show root
cause" — both navigate.

**Streaming:** the answer types in character-by-character (prototype: `+4` chars per 18ms tick,
speed exposed as a tweak) with a `▋` accent cursor, then commits to the message list. In production
this is a token stream from the API — keep the cursor and the commit-on-complete behaviour.

Footer: `SUGGESTED` label + three preset questions (click → ask), and a text input with a mono SEND
affordance; Enter submits.

### 9. Command palette (⌘K / Ctrl+K)

720px panel over a dark scrim, opened from anywhere by ⌘K/Ctrl+K or the rail button; Escape or
scrim click closes. `>` prompt, autofocused input
("Jump to an entity, process, exception or vendor"), `ESC` hint. Results (max 9) are rows of
`KIND | label | meta`, kinds: ENTITY, EXCEPTION, ROOT CAUSE, SCREEN. Filter is a
case-insensitive substring match on label + kind. Enter opens the first result; each result sets the
relevant state and navigates.

---

## Interactions & behaviour

| Trigger | Result |
|---|---|
| Group table row | Set entity, go to entity home |
| Entity tile / issue row | Go to the mapped view (P2P, working capital, root cause, worklist) |
| P2P stage card | Go to worklist |
| P2P / entity cause row | Set selected cause, go to root cause view |
| Worklist row | Set exception, go to exception detail |
| Filter chip | Filter rows by blocking reason; header aggregates recompute |
| Sort chip | Sort by amount desc, age desc, or vendor asc |
| "Ask why this entity is amber" | Open drawer, stream that answer |
| Suggested question / Enter in input | Stream the matching canned answer |
| ⌘K / Ctrl+K | Toggle palette, clear query |
| Escape | Close palette |
| Row / chip / card hover | `bg/raised` or accent border, per component above |

Keyboard listener is bound at window level and removed on unmount. Nothing in the prototype
persists; in production, persist selected entity, filters and sort per user.

## State

```
view          'group' | 'entity' | 'p2p' | 'worklist' | 'exception' | 'rootcause' | 'workingcapital'
entityCode    string   — selected legal entity
cause         string   — selected root-cause taxonomy key
filter        string   — 'All' | blocking reason
sort          'Value' | 'Age' | 'Vendor'
exId          string   — selected exception id
aiOpen        boolean
aiInput       string
messages      { role: 'user' | 'ai', text: string }[]
streaming     string   — partial assistant answer being typed
paletteOpen   boolean
query         string
```

In implementation, `view` + `entityCode` + `exId` + `cause` should be **URL state** (e.g.
`/entity/JGL/p2p/invoices/AP-104281`) so the drill path is linkable and the breadcrumb derives from
the route. `filter`, `sort` become query params. `aiOpen`, `messages`, `streaming`, `paletteOpen`,
`query` stay local.

## Data model (for the API)

```
Entity        { code, name, score, status, dims[6], apBlocked, arOver90, cashUnapplied,
                closePct, controlBreaches, vetoes[] }
Dimension     { key: operational|service|risk|workingCapital|dataQuality|compliance, score, weight }
ProcessStage  { processKey, step, name, volume, value, exceptionPct, status }
Exception     { id, entityCode, processKey, vendor, amount, ageDays, reasonKey, plant,
                owner, controlImpact, po, bookedOn, slaBreachDays }
CauseNode     { processKey, key, name, sharePct, valueAtRisk, avgDelayDays, recurrence,
                concentration, narrative, drivers[{dimension, name, pct}], actions[] }
CashOpportunity { name, value, items, effort, owner }
```

Health score composition (contractual per §3.2; disclosed on the entity home via "How this score is
built"): Operational 20%, Service & attribution 15%, Risk & control 20%, Working capital 20%, Data &
MDM quality 10%, Compliance 15%. The displayed score is the weighted sum capped by the lowest active
veto cap (§3.5).

The cockpit is designed to sit **above** the transactional platforms (SAP ECC/S4, Concur, AP
workflow, banks, collections, reconciliation tooling, master data, ticketing) on a common semantic
layer — entity, process, transaction, account, vendor/customer, exception, control, owner, ageing,
value — so the UI survives an ERP migration. Build the API against that semantic model, not against
ERP tables.

## Assets

None. No image files, no icon set, no logos. Status is conveyed by colored dots and typography;
bars are plain divs. Only external dependency is the IBM Plex Mono webfont from Google Fonts. If the
target codebase has a design system, map the tokens above onto it rather than importing raw hex.

## Files

```
screenshots/01-group-view.png                        group view, top
screenshots/02-group-view-lower.png                  group view, lower cards
screenshots/03-entity-health.png                     entity health home (hero screen)
screenshots/04-p2p-cockpit.png                       P2P process cockpit
screenshots/05-worklist.png                          blocked invoices worklist
screenshots/06-exception-detail.png                  single exception detail
screenshots/07-root-cause.png                        root cause view
screenshots/08-working-capital.png                   working capital view
screenshots/09-ai-drawer.png                         AI drawer with a streamed answer
screenshots/10-command-palette.png                   command palette (⌘K)
design-reference/Controller Cockpit App.dc.html      the application prototype (all 8 views)
design-reference/Controller Cockpit Slides.dc.html   5-slide bid deck (context only)
design-reference/deck-stage.js                       slide shell used by the deck
design-reference/support.js                          design-tool runtime — not for production
CLAUDE_CODE_PROMPT.md                                prompt for a large model (single paste)
CLAUDE_CODE_PROMPT_LOCAL_27B.md                      prompt for a local 27B model (7 steps)
spec/01-tokens.md                                    tokens, derived color rules, formatting
spec/02-shell-and-routes.md                          rail, top bar, routes, a11y
spec/03-data.md                                      types + every mock row
spec/04-views-group-entity.md                        group view, entity health home
spec/05-views-p2p-worklist-exception.md              P2P, worklist, exception detail
spec/06-views-rootcause-workingcapital.md            root cause, working capital
spec/07-palette-and-ai.md                            \u2318K palette, AI drawer, canned answers
```

The `spec/` files are self-contained slices of this README, sized so a small model reads only one per
build step. A large model can work from this README alone.

Open either `.dc.html` file directly in a browser to interact with the design.

Screenshots are captured at the authored 1920px width but only ~590px tall (the capture viewport), so
taller views are cut at the bottom — the prototype is the authority on full-height composition.

## Out of scope in this handoff

The R2R cockpit, close tracker, operations-persona view, mobile alert view, authentication,
real integrations, and the AI retrieval/reasoning backend. The AI answers in the prototype are
canned strings.
