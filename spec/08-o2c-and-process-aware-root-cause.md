# Spec 08 — O2C cockpit and process-aware root cause

Addendum to the Controller Cockpit specs. Read `01-tokens.md` first for colors, fonts and the derived
color rules; `03-data.md` for the existing type definitions. Do not open the PNGs in `screenshots/` —
they are for human reviewers. The layout maps below are the visual source.

**Theming.** `01-tokens.md` describes the original dark theme, and every color in this addendum is
named as a token (`accent`, `bg-panel`, `status-amber`, …), never as a literal. If the implementation
has since gained a light theme, those names are the contract: resolve each one through the existing
theme layer so the new view works in every mode, and introduce no new literal color values. Where
this spec needs a colour that has no token — a dimmed variant of the accent, for instance — derive it
from an existing token rather than picking a hex.

This addendum does two things:

1. Adds a second process cockpit — **Order to Cash (O2C)** — alongside the existing P2P cockpit.
2. Makes the **root cause view process-aware**, so it can show either the P2P or the O2C taxonomy.
   Today it is hard-wired to P2P.

---

## Part A — Nav, route and breadcrumb

Add one nav item to the left rail, positioned **directly after "P2P cockpit"**:

```
O2C cockpit      284
```

Same styling rules as every other nav item (see `02-shell-and-routes.md`).

New route: `/entity/:code/o2c`. Breadcrumb for it: `Group › JGL › O2C`.

Add one command-palette entry, of kind `SCREEN`: label "O2C cockpit", meta "process", action = go to
the O2C route.

---

## Part B — O2C cockpit view

Route `/entity/:code/o2c`. Content padding `30px 26px 40px`, sections `22px` apart.

```
O2C COCKPIT  /entity/:code/o2c
+------------------------------------------------------------------------------+
| LEVEL 2 - PROCESS . ORDER TO CASH        DSO   OVERDUE AR   UNAPPLIED        |
| Revenue to cash, as one flow            62 d   Rs20.6 cr    Rs3.1 cr         |
+------+------+------+------+------+------+------+                             |
| ORD  | CRD  | DLV  | BIL  | DSP  | COL  | CSH  |  <- 7 equal stage cards      |
| name | name | name | name | name | name | name |     step + dot, name,        |
| vol  | vol  | vol  | vol  | vol  | vol  | vol  |     volume, value, 4px bar,  |
| val  | val  | val  | val  | val  | val  | val  |     exception %              |
+------+------+------+------+------+------+------+-----------------------------+
| RECEIVABLES BY AGEING | TOP CAUSES - O2C TAX.  | SERVICE & CONTROL           |
| 5 vertical bars       | 6 clickable rows       | 4 rows + bottom button      |
+-----------------------+------------------------+-----------------------------+
```

### Header

Left: eyebrow `LEVEL 2 — PROCESS · ORDER TO CASH`, title "Revenue to cash, as one flow" (26px/600).

Right: three KPI blocks `34px` apart, each a 10-11px mono `text-faint` label above a 26px mono value:
- `DSO` — `62 d`, in `status-amber`
- `OVERDUE AR` — `₹20.6 cr`, in `text-primary`
- `UNAPPLIED` — `₹3.1 cr`, in `status-red`

### Stage flow

`grid-template-columns: repeat(7, 1fr); gap: 10px`. Card anatomy is **identical to the P2P stage
cards** in `05-views-p2p-worklist-exception.md`: mono step code + status dot on one row, stage name
(14px/600), volume (19px mono), value (12px mono `text-secondary`), a 4px exception-rate bar with
fill width `exceptionPct * 3.4%`, and "N% exception" (11px mono) in the status color. Whole card is
clickable → the working capital view. Hover: border `accent`.

| step | name | volume | value | exception % | status |
|---|---|---|---|---|---|
| ORD | Order | 5,140 | ₹71.4 cr | 3 | GREEN |
| CRD | Credit check | 4,980 | ₹68.9 cr | 8 | AMBER |
| DLV | Delivery | 4,712 | ₹64.2 cr | 6 | GREEN |
| BIL | Billing | 4,455 | ₹61.8 cr | 14 | AMBER |
| DSP | Invoice dispatch | 4,301 | ₹59.6 cr | 9 | AMBER |
| COL | Collection | 1,876 | ₹28.4 cr | 24 | RED |
| CSH | Cash application | 1,204 | ₹19.7 cr | 21 | RED |

### Three cards below (`1fr 1fr 1fr`, `gap: 16px`)

**RECEIVABLES BY AGEING** — a 130px-tall row of five bottom-aligned columns, `10px` gaps. Each
column: value label above (11px mono, `text-secondary`, centered), the bar, then the bucket label
below (10px mono, `text-faint`, centered). The two tallest bars use `accent`; the three shorter ones
use a dimmed variant of it — reuse whatever token or derivation the P2P cockpit's ageing chart
already uses for its shorter bars rather than defining a second one.

| bucket | value | bar height |
|---|---|---|
| 0-30 d | ₹24.1 cr | 100px |
| 31-60 d | ₹11.6 cr | 48px |
| 61-90 d | ₹8.2 cr | 34px |
| 91-180 d | ₹7.4 cr | 31px |
| > 180 d | ₹5.0 cr | 21px |

**TOP CAUSES — O2C TAXONOMY** — six rows: label (13px) · 90px × 6px track with `accent` fill scaled
to the share · share (12px mono, `text-muted`, 38px right-aligned). Each row is **clickable** and
navigates to the O2C root cause view for that cause; hover turns the label `accent-text`. Shares are
the `sharePct` values in Part C.

**SERVICE & CONTROL** — four 13px label/value rows with mono values:

```
Billing accuracy          96.4%   status-amber
Open disputes             34      status-red
Orders on credit block    18      status-amber
Unapplied receipts        19      text-primary
```

Pinned to the bottom of the card (`margin-top: auto`): a full-width button, `1px solid
border-strong`, `padding: 9px 12px`, 13px, centered — "Open 41 overdue customers →" → working capital
view.

---

## Part C — O2C root-cause taxonomy data

Six causes, same `CauseNode` shape as the P2P taxonomy in `03-data.md`. `processKey: 'o2c'`. The
`plants` field carries **customer segments** for O2C (the field is a generic driver list); the
`vendors` field carries **cause drivers**. Transcribe narratives and actions verbatim.

**Pricing disputes** — key `pricing-disputes`, 31%, ₹5.4 cr, avg delay 11.2 days, 6th month,
9 customers.
Narrative: "Customers short-pay against contracted rates that were revised mid-quarter but not
reflected on the invoice. Nine distribution customers account for 64% of disputed value; each dispute
takes an average of 11.2 days to resolve because pricing evidence sits outside the billing system."
Segments: Distribution 41, Institutional 28, Export 19, Retail 12.
Drivers: Rate revision lag 44, Contract not loaded 26, Scheme mismatch 18, Other 12.
Actions: Load contract revisions to billing before the effective date · Attach pricing evidence to
the invoice at issue · Escalate disputes above ₹10 lakh to the commercial owner in 48 hours.

**Deductions & short-pay** — key `deductions`, 24%, ₹4.1 cr, 9.6 days, 5th month, 14 customers.
Narrative: "Customers deduct scheme, damage and freight claims at payment without reference to an
approved credit note. 71% of deductions are eventually accepted, meaning the dispute cycle adds cost
without changing the outcome."
Segments: Retail 38, Distribution 31, Institutional 20, Export 11.
Drivers: Scheme claims 42, Damage claims 27, Freight 19, Other 12.
Actions: Pre-approve recurring scheme deductions · Auto-clear deductions below the write-off
threshold · Monthly claim reconciliation with the top 14 customers.

**Billing errors** — key `billing-errors`, 17%, ₹2.9 cr, 6.8 days, 3rd month, 4 order types.
Narrative: "Invoices are rejected on receipt for missing purchase order references, incorrect GST
registration or wrong ship-to detail. Four order types created outside the standard flow generate
most of the rework."
Segments: Institutional 44, Export 24, Distribution 20, Retail 12.
Drivers: Missing PO reference 39, Tax detail 28, Ship-to detail 21, Other 12.
Actions: Mandatory PO reference at order entry for institutional customers · Validate customer tax
registration at master creation · Close the manual order-entry route.

**Credit block delays** — key `credit-block`, 12%, ₹2.1 cr, 4.4 days, 2nd month, 18 orders.
Narrative: "Orders sit on credit block awaiting manual review because exposure limits were last
reviewed a year ago. Eighteen orders are currently held, most for customers with a clean payment
record."
Segments: Distribution 46, Retail 25, Institutional 18, Export 11.
Drivers: Stale credit limit 51, Awaiting approval 29, Security expired 20.
Actions: Annual credit limit refresh, risk-scored · Auto-release for customers with a 12-month clean
record · Same-day review SLA for held orders.

**Cash application mismatch** — key `cash-application`, 9%, ₹3.1 cr, 5.1 days, 4th month,
19 receipts.
Narrative: "Receipts arrive without remittance advice or covering multiple invoices, leaving ₹3.1 cr
unapplied. Nineteen receipts are currently open, the oldest for 22 days."
Segments: Distribution 37, Retail 29, Institutional 22, Export 12.
Drivers: No remittance advice 48, Part payment 27, Multi-invoice receipt 25.
Actions: Request structured remittance advice from the top 20 payers · Tolerance-based auto-matching
for part payments · Daily unapplied cash review with a named owner.

**Customer master** — key `customer-master`, 7%, ₹1.2 cr, 3.9 days, 3rd month, 16 records.
Narrative: "Sixteen customer records carry incomplete tax registration or credit terms, blocking
clean billing and distorting the ageing view."
Segments: Retail 41, Distribution 27, Institutional 19, Export 13.
Drivers: Tax registration 45, Credit terms 33, Ship-to hierarchy 22.
Actions: Complete-record enforcement at customer creation · Quarterly master data review with
commercial · Block billing on incomplete records.

---

## Part D — Making the root cause view process-aware

The root cause view currently reads one hard-coded P2P taxonomy. It must select a taxonomy by
process. **Nothing about the view's layout changes** — only where its data comes from, and three
pieces of copy.

### Selection model

The selection is a **pair**: `{ process, causeKey }`. Model it as one value, not two independent
fields — a process and a cause key from a different taxonomy is an invalid state that should be
unrepresentable. Route: `/entity/:code/root-cause/:process/:causeKey`.

Any navigation that lands on the root cause view **without naming a cause** (the rail's "Root cause"
nav item, the entity home's "Reconciliations" and "Controls" tiles, its "Analyse →" link, an
assistant follow-up chip) must resolve to a valid pair — default to `p2p` and that taxonomy's first
cause. Never carry over a stale selection.

### Copy that varies by process

| element | P2P | O2C |
|---|---|---|
| Taxonomy panel header | `TAXONOMY — P2P` | `TAXONOMY — O2C` |
| Page title | Why blocked invoices keep recurring | Why receivables keep ageing |
| Breadcrumb | `Group › JGL › P2P › Root cause` | `Group › JGL › O2C › Root cause` |
| "By plant" card header | `BY PLANT` | `BY CUSTOMER SEGMENT` |
| "By vendor group" card header | `BY VENDOR GROUP` | `BY DRIVER` |

Everything else — the accent panel, the four metrics, the three driver cards, the taxonomy list with
its accent left border on the selected row — is unchanged.

### Command palette

`ROOT CAUSE` results now cover both taxonomies, twelve entries in total. Label each with its process
so the two sets are distinguishable: `Missing GR · P2P`, `Pricing disputes · O2C`. Meta stays the
cause's value at risk. Selecting one sets both process and cause.

### The exception-detail defect this fixes

On the exception detail page, "Why does this keep happening?" must navigate to
`{ process: 'p2p', causeKey: <this exception's reasonKey> }` — the cause of the invoice in front of
the user. It must never inherit whatever cause was last viewed. Test this explicitly: open the O2C
cockpit, drill into "Pricing disputes", then go to the worklist, open invoice `AP-104281` (blocking
reason "Missing GR") and click the button. It must land on **Missing GR / P2P**, not on the O2C
cause.
