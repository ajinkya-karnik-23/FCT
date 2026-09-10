# Addendum prompt — add the O2C cockpit (fresh Claude Code window, local 27B model)

This is a **follow-on change** to an existing Controller Cockpit implementation, written for a new
Claude Code session that has no memory of the original build. Feed the steps below **one at a time**,
review the diff after each, and only paste the next one when you are happy.

The change has two halves: a new O2C process cockpit, and making the existing root cause view
process-aware so it can serve both P2P and O2C. The full written spec is
`design_handoff_controller_cockpit/spec/08-o2c-and-process-aware-root-cause.md`.

Notes before you start:

- **Step 1 is an orientation step that writes no code.** Do not skip it — a fresh session needs to
  discover the existing file names before it can extend them, and its answer tells you whether it has
  actually understood the codebase.
- **If your implementation has a light theme**, the specs still apply as written: they name colors as
  tokens rather than hex values, and step 1 asks the session to find your theme layer so the new view
  inherits both modes. Step 5 checks it in each mode.
- Turn off auto-accept. Review each diff.
- Step 4 is the risky one (it changes existing behaviour). Step 5 is its test.
- If a session starts contradicting itself, start a fresh window and re-paste from the step you are
  on — every step is written to survive a cold start.

---

## Step 1 — orientation (no code)

I'm extending an existing app called the **Controller Cockpit** — a finance controllership web app
for a multi-entity pharma group. I need to add a second process cockpit and make one existing view
work for both processes. You have no context on this codebase, so start by reading it.

Read, in this order:

1. `design_handoff_controller_cockpit/spec/01-tokens.md` — the design tokens. All colors, fonts and
   sizes come from here; never invent a value.
2. `design_handoff_controller_cockpit/spec/02-shell-and-routes.md` — the app shell and routing model.
3. `design_handoff_controller_cockpit/spec/05-views-p2p-worklist-exception.md` — the **P2P cockpit**
   section only. The new O2C cockpit is a sibling of it and must match it structurally.
4. `design_handoff_controller_cockpit/spec/06-views-rootcause-workingcapital.md` — the **root cause
   view** section. This is the view I need to make process-aware.
5. `design_handoff_controller_cockpit/spec/08-o2c-and-process-aware-root-cause.md` — the change
   itself, end to end.

Then explore the actual source and report back, without writing any code:

- Which file renders the P2P cockpit, and which renders the root cause view?
- Where do the nav items live, where are routes declared, and how is the breadcrumb derived?
- Where does the mock data live, and how does a view get it?
- How does theming work — where do color tokens live, is there more than one theme, and how does a
  component read a token so it renders correctly in every mode?
- How does the root cause view currently choose which cause to display, and how does the command
  palette build its `ROOT CAUSE` results?
- Which shared components exist that I should reuse (bars, cards, eyebrow labels, tables)?

Tell me the exact file paths for each, and flag anything in the spec that conflicts with how this
codebase actually works. Write no code in this step.

Do not open the PNGs in `screenshots/` — you cannot read images. Every view spec contains an ASCII
layout map instead.

---

## Step 2 — O2C data

Read `design_handoff_controller_cockpit/spec/08-o2c-and-process-aware-root-cause.md`, Parts B and C.

Add the O2C data to the existing mock data layer, following whatever pattern the P2P data already
uses — same types, same file conventions, exposed through the same API module. Do not create a
parallel data-access path, and do not let any view import a mock file directly.

Add:
- the seven O2C process stages (Part B table),
- the five receivables ageing buckets (Part B table),
- the six O2C root-cause nodes (Part C) — full narratives, segment lists, driver lists and actions,
  transcribed exactly, nothing summarised or invented,
- the O2C header KPI values and the four service & control values.

The O2C causes use the same `CauseNode` type as the P2P ones with `processKey: 'o2c'`. If the existing
cause type names its driver lists `plants` and `vendors`, reuse those fields rather than adding new
ones — Part C explains what they carry for O2C.

Add a test asserting 7 O2C stages, 5 ageing buckets and 6 O2C causes, and that every O2C cause has a
non-empty narrative and exactly three actions.

Stop here. Do not build the view yet.

---

## Step 3 — O2C cockpit view

Read Part A and Part B of `spec/08-o2c-and-process-aware-root-cause.md` again.

Build the O2C cockpit as a sibling of the existing P2P cockpit:

- New route `/entity/:code/o2c`, with the breadcrumb `Group › JGL › O2C` derived from it the same way
  every other breadcrumb is.
- A new rail nav item "O2C cockpit" with the badge `284`, positioned **directly after** "P2P
  cockpit", using the existing nav item component and its active/hover rules.
- One command-palette entry of kind `SCREEN` — label "O2C cockpit", meta "process".
- The view itself: header with three KPIs, the seven stage cards, and the three cards below
  (receivables ageing, O2C taxonomy, service & control).

Reuse the P2P cockpit's stage-card component rather than writing a second one — if it is currently
hard-coded to P2P data, lift it into a shared component that takes stages as a prop, and have both
cockpits render it. Same for the vertical-bar ageing chart if the P2P view already has one.

The six taxonomy rows must be clickable, but leave their click handler as a no-op for now — the
process-aware root cause route arrives in the next step. Everything else should work.

Stop when I can reach the O2C cockpit from the rail and from ⌘K, and the breadcrumb is right.

---

## Step 4 — make the root cause view process-aware

Read Part D of `spec/08-o2c-and-process-aware-root-cause.md`. This step changes existing behaviour,
so work carefully and keep the diff tight.

The root cause view currently reads one hard-coded P2P taxonomy. Change it to select a taxonomy by
process. **The layout does not change at all** — only the data source and five pieces of copy (the
table in Part D lists them).

Requirements:

1. The selection is a **pair** — process plus cause key — modelled as a single value, so that a
   process paired with a cause from a different taxonomy is unrepresentable. Route becomes
   `/entity/:code/root-cause/:process/:causeKey`.
2. Any entry point that lands on the view **without naming a cause** must resolve to a valid default
   pair (`p2p` plus that taxonomy's first cause) and must never carry over a stale selection. Find
   every such entry point — the rail nav item, the entity home's "Reconciliations" and "Controls"
   tiles, its "Analyse →" link, and any assistant follow-up chip — and fix them all.
3. The exception-detail button "Why does this keep happening?" must navigate to `p2p` plus **that
   exception's own blocking reason**, never an inherited cause.
4. Wire up the O2C cockpit's six taxonomy rows from step 3 to navigate to their O2C cause.
5. The command palette's `ROOT CAUSE` results now cover both taxonomies — twelve entries, each
   labelled with its process (`Missing GR · P2P`, `Pricing disputes · O2C`).

Before you change anything, list every call site that navigates to the root cause view and tell me
what each one will pass after the change. Then make the change.

---

## Step 5 — verify the drill paths

Write tests, then walk the app and confirm each of these by hand:

1. **The regression that matters.** Open the O2C cockpit → click "Pricing disputes" → navigate to the
   worklist → open invoice `AP-104281` (blocking reason "Missing GR") → click "Why does this keep
   happening?". It must land on **Missing GR / P2P** — P2P taxonomy header, the P2P page title, a P2P
   breadcrumb. If it shows the O2C cause, the selection is leaking; fix it at the state model, not by
   patching that one button.
2. Each of the six O2C taxonomy rows opens its own O2C cause, with the O2C header, title, breadcrumb
   and the renamed driver-card headers.
3. The rail's "Root cause" item, the entity home's "Reconciliations" and "Controls" tiles, and its
   "Analyse →" link all land on a valid P2P cause from a cold start **and** immediately after viewing
   an O2C cause.
4. Every route in the new set is directly linkable — paste the URL into a fresh tab and the right
   cause loads.
5. ⌘K lists twelve `ROOT CAUSE` entries, six per process, each opening the correct pair.

Then confirm the standing project rules still hold on everything you touched: border radius 0 except
status dots, no shadows except the command palette, no hard-coded hex outside the token file, no
derived colors stored in data, every clickable row is a real button or link with a focus ring.

Finally, if the app has more than one theme, view the O2C cockpit and both root cause variants in
**each** theme and confirm: no color is hard-coded to one mode, the status colors and the ageing-bar
fills stay legible against their backgrounds in all of them, and the new nav item's active state
matches its siblings. Report any contrast that looks weak rather than adjusting a token — tokens are
shared, and changing one to suit this view would affect every other screen.

Report anything you could not make pass rather than working around it.
