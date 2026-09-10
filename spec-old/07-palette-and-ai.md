# Spec 07 — Command palette and AI drawer

Read `01-tokens.md` first. The PNGs in `screenshots/` are for human reviewers — do not try to read
them. The layout maps below plus the prototype HTML are the visual source.

```
COMMAND PALETTE (overlay, 720px, 12vh from top)
+--------------------------------------------------+
| > Jump to an entity, process, exception...   ESC |
+--------------------------------------------------+
| ENTITY      Jubilant Generics Ltd      health 74 |
| ENTITY      ...                                  |
| EXCEPTION   AP-104281 . Suraksha    Rs2.84 . 41d |
| ROOT CAUSE  Missing GR                 Rs6.3 cr  |
| SCREEN      Group view                6 entities |
+--------------------------------------------------+   max 9 rows, scrolls
```

```
AI DRAWER (470px, right of the content area, not an overlay)
+----------------------------------+
| o COCKPIT INTELLIGENCE         x |
+----------------------------------+
| caption (muted)                  |
|            [user bubble, right]  |
| [assistant bubble, left]         |
|  [chip] [chip]   <- last answer  |
| [streaming bubble + cursor]      |
+----------------------------------+
| SUGGESTED                        |
| [preset question]                |
| [preset question]                |
| [preset question]                |
| [input .................. SEND]  |
+----------------------------------+
```

---

## Command palette

Opens on `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) from anywhere, and from the rail's
"Search everything" button. Closes on `Escape`, on scrim click, or after picking a result.
Bind the key listener at window level and remove it on unmount. `preventDefault` on the shortcut.

Scrim: `position: fixed; inset: 0; background: rgba(4,7,11,0.72); z-index: 50;` content aligned to
the top, `padding-top: 12vh`, horizontally centered. Clicking the scrim closes; clicks inside the
panel must not bubble to it.

Panel: `width: 720px; background: bg-panel; border: 1px solid border-strong;`
`box-shadow: 0 40px 100px -30px rgba(0,0,0,0.9)`.

Header row (`padding: 16px 18px`, bottom border `border-default`, `gap: 12px`):
a `>` prompt (11px mono, `text-faint`), an autofocused text input (transparent background, no
border, 15px, `text-primary`, placeholder "Jump to an entity, process, exception or vendor"), and an
"ESC" hint (11px mono, `text-faint`).

Results list: `max-height: 380px`, scrolls. Each row `padding: 13px 18px`, bottom border
`border-subtle`, `gap: 14px`, hover `bg-selected`, cursor pointer:
- kind (10px mono, letter-spacing 0.12em, `text-faint`, fixed 84px width)
- label (14px, flexible)
- meta (12px mono, `text-muted`)

Result set, in this order, capped at 9 rows:

| kind | label | meta | action |
|---|---|---|---|
| ENTITY | entity name | `health 74` | go to that entity home |
| EXCEPTION | `AP-104281 · Suraksha Chemicals Pvt Ltd` | `₹2.84 cr · 41 d` | go to that exception |
| ROOT CAUSE | cause name | `₹6.3 cr` | go to that cause |
| SCREEN | Group view | `6 entities` | go to `/` |
| SCREEN | P2P cockpit | `process` | go to the P2P view |
| SCREEN | Blocked invoices worklist | `327 items` | go to the worklist |
| SCREEN | Working capital | `₹4.2 cr releasable` | go to working capital |

Matching: case-insensitive substring match against `label + ' ' + kind`. Empty query shows the
unfiltered list. `Enter` activates the first result. No fuzzy scoring, no ranking beyond this order.

---

## AI drawer — "Cockpit intelligence"

`width: 470px`, `border-left: 1px solid border-default`, background `bg-panel-alt`, full height,
flex column. It sits beside the content area — the content area shrinks, it does not overlay.
Toggled by the top bar button and by "Ask why this entity is amber" on the entity home.

**Header** (`padding: 16px 20px`, bottom border): a 7px pulsing `accent` dot, mono eyebrow
"COCKPIT INTELLIGENCE" in `accent-text`, and a `×` close on the right (16px, `text-faint`, hover
`text-primary`).

**Body** (`flex: 1`, scrolls, `padding: 20px`, `gap: 16px`):
- A standing caption (13px, line-height 1.55, `text-muted`): "Grounded on the finance semantic model
  — every answer resolves to transactions, owners and SLA records."
- Messages. User: `align-self: flex-end`, `max-width: 88%`, background `bg-accent-soft`,
  `1px solid border-accent`, `padding: 12px 15px`, 13px, line-height 1.5. Assistant:
  `max-width: 92%`, background `bg-raised`, `1px solid #1B2634`, `padding: 14px 16px`, 13px,
  line-height 1.6.
- The **most recent completed** assistant message shows two follow-up chips below it
  (`1px solid border-strong`, `padding: 7px 11px`, 12px, `text-secondary`, hover border `accent`):
  "Open the worklist" → worklist, "Show root cause" → root cause view.
- While streaming, render a partial assistant bubble ending in a `▋` cursor in `accent`. When the
  answer completes, commit it to the message list and drop the cursor.

**Footer** (`padding: 16px 20px`, top border, `gap: 12px`):
- Mono eyebrow "SUGGESTED", then three full-width preset buttons (`1px solid #1B2634`,
  `padding: 10px 13px`, 13px, `text-secondary`, hover border `accent` and `text-primary`):
  "Why is AP exposure building?", "Which plants and vendors drive it?", "What should I do first?"
- An input row: `1px solid border-strong`, `padding: 10px 13px`, containing a transparent 13px input
  (placeholder "Ask about any entity, process or exception") and a "SEND" affordance (11px mono,
  `accent-text`). `Enter` submits.

### Streaming behaviour

Put the answer source behind an interface so a real endpoint can replace it without touching the UI:

```ts
interface AssistantProvider { ask(question: string, context: {entityCode: string}): AsyncIterable<string>; }
```

The mock provider yields the canned answer in chunks of ~4 characters every 18ms. Cancel any
in-flight stream when a new question is asked. Answers (verbatim):

**"Why is this entity showing amber?"**
"Jubilant Generics is amber on two of five dimensions. Control health is 46 — four control breaches
and 12 high-risk manual journals sit open. Working capital health is 58, driven by ₹18.6 cr of
blocked payables and ₹3.1 cr of unapplied cash. Close and process health are both green, so this is a
controllership issue rather than a throughput issue."

**"Why is AP exposure building?"**
"₹18.6 cr is blocked across 327 invoices. 68% of the exposure sits in items older than 30 days, and
54% of those trace to missing goods receipts — concentrated in Nanjangud (43%) and Roorkee (29%). The
same 11 vendors have appeared in this pattern for five consecutive months."

**"Which plants and vendors drive it?"**
"Nanjangud accounts for 43% of the missing-GR value, Roorkee 29%. Within that, consignment chemical
vendors are 38% and packaging 27%. Suraksha Chemicals alone holds ₹2.84 cr across four invoices with
an average age of 41 days."

**"What should I do first?"**
"Three actions, in order. One: release the 38 invoices where GR was posted this week — ₹4.2 cr of
payment capacity, no approvals needed. Two: set a 48-hour GR escalation for the top 11 vendor/plant
pairs, which removes roughly 60% of recurrence. Three: take the two intercompany reconciliation
breaks with Entity B to the close call today; they are blocking close sign-off."

**"Why did close health drop this week?"**
"Close health fell 6 points. Three balance-sheet reconciliations remain unresolved, two of them
intercompany mismatches with Jubilant Ingrevia, and one late manual journal of ₹7.2 cr is awaiting
controller approval. Nothing else in the close plan slipped."

**Fallback for anything else**
"Across the six entities, ₹92.4 cr is currently at risk with 1,486 open exceptions. The largest
single driver is missing goods receipts in P2P at ₹6.3 cr, followed by pricing disputes in O2C at
₹5.4 cr. Both are concentrated in Jubilant Generics and Jubilant Life Sciences."
