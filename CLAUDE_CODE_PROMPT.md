# Prompt for Claude Code

Paste everything below the line into Claude Code, from the root of the target repository, with this
handoff folder available (e.g. copied into the repo as `design_handoff_controller_cockpit/`).

---

I'm building the **Controller Cockpit** — a finance controllership app for a multi-entity pharma
group. A complete design handoff is in `design_handoff_controller_cockpit/`.

**Read these first, in order:**

1. `design_handoff_controller_cockpit/README.md` — the full spec: design tokens, all eight views,
   interactions, state, and the API data model. This is the source of truth.
2. `design_handoff_controller_cockpit/design-reference/Controller Cockpit App.dc.html` — the
   working prototype. Open it in a browser and click through it: group table → entity home → P2P →
   worklist → exception → root cause → working capital, plus ⌘K and the AI drawer.

**Important:** the `.dc.html` files are design references authored in a streaming format that only
exists in the design tool (`support.js` is its runtime). Do not copy that code or that runtime.
Recreate the designs in this repository's own environment, using its existing framework, component
library, routing, state management and data-fetching patterns. If this repo is empty, use React +
TypeScript + Vite, TanStack Table for the dense grids, and a typed API client layer.

**Build it in this order, and stop after each step so I can review:**

1. **Foundation** — design tokens from the README's token tables (colors, the two type families,
   spacing, zero border radius), the app shell (236px left rail, 60px top bar with route-derived
   breadcrumb, content area), and routing for the drill hierarchy. Routes must encode the drill path
   so it is linkable, e.g. `/`, `/entity/:code`, `/entity/:code/p2p`,
   `/entity/:code/p2p/invoices?cause=missing-gr&sort=value`,
   `/entity/:code/p2p/invoices/:exceptionId`, `/entity/:code/root-cause/:causeKey`,
   `/entity/:code/working-capital`.
2. **Data layer** — types and a mock API implementing the data model in the README
   (`Entity`, `ProcessStage`, `Exception`, `CauseNode`, `CashOpportunity`). Seed it from the mock
   data in the prototype so the UI is populated, but keep the boundary clean: components read from
   the API layer only, never from hard-coded arrays. Health status and ageing colors are **derived**
   from thresholds documented in the README, never stored.
3. **Group view and entity home** — including the five-dimension micro bar chart in the group table
   and the six-tile strip. Every tile and row navigates as documented.
4. **P2P cockpit, worklist, exception detail** — the worklist needs cause filtering, three sorts,
   and header aggregates that recompute over the filtered set.
5. **Root cause view** — driven by the fixed taxonomy; the taxonomy is deterministic data, not
   AI-generated.
6. **Command palette** — ⌘K/Ctrl+K global, searching entities, exceptions, causes and screens;
   Enter opens the first result; Escape closes.
7. **AI drawer** — token-streaming assistant with the typing cursor, canned answers behind a
   provider interface so a real LLM endpoint can replace them without touching the UI. Follow-up
   chips navigate into the relevant view.

**Constraints:**

- Desktop-first at 1920 wide; the layout should hold down to 1440 without redesign.
- Dark control-tower aesthetic exactly as specified: near-black canvas, **zero border radius**,
  hairline borders, mono for every number and label, sans for every sentence. No card shadows, no
  gradients, no icon library, no emoji. The only animation is the 2.4s pulse on the two status dots.
- Density matters — these are controllers scanning hundreds of rows. Do not loosen the padding.
- Accessibility: every clickable row and tile must be a real button or link with a visible focus
  ring, and status must never be conveyed by color alone (keep the accompanying label or value).
- Numbers are Indian-crore formatted (`₹18.6 cr`). Put that in one formatting utility.
- All prototype data is fabricated for a bid demo. Never present it as real, and keep it isolated in
  the mock layer.

Write tests for the derived logic (status banding, ageing thresholds, worklist filter/sort,
aggregate recomputation, palette matching). Tell me what you'd change about the spec before you
build if something conflicts with this repo's conventions — follow the repo's conventions and flag
the deviation rather than fighting them.

Out of scope for now: O2C and R2R cockpits, close tracker, operations-persona view, mobile, auth,
real ERP integrations.
