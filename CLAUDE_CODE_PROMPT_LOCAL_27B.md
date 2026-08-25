# Prompt for Claude Code — local mid-size model (27B, 196k context)

Use this file instead of `CLAUDE_CODE_PROMPT.md` when driving a 27B local model. A 27B model can hold
the spec and read the prototype HTML as source text, so it does not need the nine-step hand-holding a
smaller model would. What it still needs: bounded reading per step, named file paths, and a human
gate on each diff.

## What changes from the large-model prompt

| Change | Reason |
|---|---|
| It **may** read `design-reference/Controller Cockpit App.dc.html` as reference text | Confirmed capable. The file carries every inline style and every mock value verbatim — it is the most precise source available. It still cannot *render* it, so the `spec/` files remain the authority on intent and layout description. |
| Reads one `spec/` file per step, not the README | The README is written for humans; the spec slices are self-contained and cheaper. |
| Never opens the PNGs in `screenshots/` | The model cannot read images. Every view spec now carries an ASCII layout map instead, and the prototype HTML carries the exact values. The PNGs are for your review only. |
| Six build steps instead of nine | A 27B model handles a whole view family per step. |
| File paths still named explicitly | Prevents layout drift across a long session. |
| Constraint list restated in the setup step | Local models still regress to rounded corners, shadows and framework defaults. |
| Fresh session recommended past ~70% context | Quality drops before the window fills, even at 196k. |

Turn off auto-accept and review each step's diff.

### About the prototype file

`design-reference/Controller Cockpit App.dc.html` is a design prototype in a component format that
does not exist in your codebase (`support.js` is its runtime). Read it for exact values — hex codes,
px sizes, grid column widths, copy strings, mock data. Never copy its template syntax
(`sc-for`, `sc-if`, `{{ … }}`, `x-dc`), never import `support.js`, and never keep its
`renderVals()` pattern of building style strings in logic. Recreate the UI in this repo's own
framework and idioms.

Do not attempt to open any `.png` in `screenshots/` — you cannot read images. Each view spec contains
an ASCII layout map for structure; the prototype HTML has the exact numbers.

---

## Step 1 — setup, tokens, primitives

I'm building the **Controller Cockpit**, a finance controllership web app. The written spec is in
`design_handoff_controller_cockpit/spec/`. The design prototype is
`design_handoff_controller_cockpit/design-reference/Controller Cockpit App.dc.html` — read it as
reference text for exact values, but never copy its template syntax or its runtime (`support.js`),
and ignore `README.md` and everything in `screenshots/`.

Read `spec/01-tokens.md`. Then, without writing any UI:

1. Confirm the stack. If this repo already has a framework, use it and say what it is. If the repo is
   empty, scaffold React 18 + TypeScript + Vite, with Vitest for tests.
2. `src/theme/tokens.ts` — every color, font, type-scale and spacing value as typed constants.
3. `src/theme/derive.ts` — `scoreColor`, `statusWord`, `ageColor`, `controlColor`, `breachColor`.
4. `src/lib/format.ts` — `formatCr(value, decimals?)` producing `₹18.6 cr`.
5. Small shared primitives, since every view uses them: `<Bar>` (track + fill, configurable height
   and color), `<Eyebrow>` (mono uppercase label), `<StatusDot>`, `<Card>` (bordered panel with
   optional eyebrow header), `<DataTable>` (CSS-grid table taking column widths and alignment).
6. Tests for `derive.ts` and `format.ts`.

Rules for the whole project, in force from here on:

- Border radius 0 everywhere; the only circles are status dots.
- No box shadows except the command palette. No gradients. No icon library. No emoji.
- If Tailwind is present, extend the theme with these exact tokens and use no default palette color.
- Mono font for every number, ID, percentage and uppercase label; sans for every sentence.
- No hard-coded hex in a component — import from `tokens.ts`.
- Never store a derived color or status in data; compute it in `derive.ts`.
- Every clickable row, tile or card is a real `<button>` or `<a>` with a visible focus ring.

Stop when this exists and tests pass.

---

## Step 2 — shell, routes, data layer

Read `spec/02-shell-and-routes.md` and `spec/03-data.md`.

Build:
- `src/app/AppShell.tsx`, `Rail.tsx`, `TopBar.tsx`, `routes.tsx` — the 236px rail, 60px top bar,
  scrolling content area, all seven routes with placeholder pages. The breadcrumb derives from the
  route; nav highlighting follows the spec, including "Worklist stays active on exception detail".
- `src/api/types.ts` and `src/api/mock/*` (entities, stages, exceptions, causes, misc), exposed only
  through `src/api/index.ts`: `listEntities`, `getEntity`, `listStages`, `listExceptions`,
  `getException`, `listCauses`, `getCause`, `getCashOpportunities`, `getGroupSummary`.

Transcribe every row of every table in `spec/03-data.md` exactly — 6 entities, 7 stages, 12
exceptions, 6 causes with full narratives, driver lists and actions, plus the ageing and cash
opportunity datasets. Do not sample or invent rows. Cross-check the values against the prototype
file if anything is ambiguous. Components must never import from `src/api/mock/*` directly.

Test: row counts (6, 7, 12, 6) and that the breadcrumb matches each route.

Stop when nav works end to end with placeholder pages.

---

## Step 3 — group view and entity health home

Read `spec/04-views-group-entity.md`. Build `src/pages/GroupView.tsx` and
`src/pages/EntityHome.tsx`.

Both are fully specified: grid column widths, the five-column dimension bar chart, the six-tile
strip, the top-issues card, and the navigation target for every tile and row. The
"Ask why this entity is amber" button calls a no-op handler for now — the drawer arrives in step 6.

Stop when both pages are complete.

---

## Step 4 — P2P cockpit, worklist, exception detail

Read `spec/05-views-p2p-worklist-exception.md`. Build `src/pages/P2PCockpit.tsx`,
`src/pages/Worklist.tsx`, `src/pages/ExceptionDetail.tsx`.

Filter and sort state lives in the URL query string (`?cause=&sort=`), not component state, and the
three header aggregates recompute over the filtered rows. Tests: the cause filter, all three sorts,
and aggregate recomputation.

Stop when all three pages work and tests pass.

---

## Step 5 — root cause and working capital

Read `spec/06-views-rootcause-workingcapital.md`. Build `src/pages/RootCause.tsx` and
`src/pages/WorkingCapital.tsx`.

The selected cause comes from the `:causeKey` route param; clicking a taxonomy row changes the route.
Everything on the right-hand side is read from the `CauseNode` — nothing is generated at runtime.

Stop when both pages are complete.

---

## Step 6 — command palette and AI drawer

Read `spec/07-palette-and-ai.md`. Build `src/components/CommandPalette.tsx`,
`src/features/assistant/AssistantDrawer.tsx`, `src/features/assistant/provider.ts`.

Palette: global ⌘K / Ctrl+K, plain case-insensitive substring matching — no fuzzy search, no ranking
beyond the order in the spec. Assistant: answers come from the `AssistantProvider` interface,
implemented by a mock that streams the canned answers in ~4-character chunks every 18ms, cancelling
any in-flight stream; a real endpoint must be swappable without touching the UI. Wire the entity
home's "Ask why this entity is amber" button to open the drawer and ask that question.

Tests: palette matching, and the stream completing and committing a message.

Stop when both work.

---

## Step 7 — review pass

For each page, compare your implementation against its spec file and against the prototype HTML, and
list every deviation in spacing, font size, color token or copy. Do not open the screenshots. Fix
only what you listed. No refactors, no renames, no new features.

Then confirm explicitly: radius 0 except status dots; no shadows except the palette; no hard-coded
hex outside `tokens.ts`; no derived colors stored in data; every clickable row is a button or link
with a focus ring; filter and sort live in the URL.
