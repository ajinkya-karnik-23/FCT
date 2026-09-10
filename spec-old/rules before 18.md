# Rules, design constraints and codebase conventions

## §0. How to use this file

This is the single source of truth for the prototype. **Do not read it end to end.**
Each prompt in `PROMPTS.md` tells you which sections to read. Read only those.

**This file is maintained outside the build. Do not edit it.** If a task claims
something is already in the spec and it is not, or you find a contradiction, say so
in your report and proceed — an edit here silently diverges your copy from the
maintained one, and every later task reads the wrong source of truth.

**§13 (codebase conventions) applies to every task. Read it once at the start of
a session and treat it as always in force.**

Rules that apply to every task in this project:

- **Never invent numbers.** All figures come from the canonical dataset (§7). If a
  number you need is not there, add it to the dataset module first, then use it.
- **Never invent colours, fonts or spacing.** Use the existing design tokens (§10).
- **Never add a runtime dependency** without being told to.
- **Never refactor files outside the task's stated scope.**
- **Never delete an existing screen** unless the task says to.
- Keep the existing dark theme, layout grammar and component style.
- Every figure displayed anywhere must be clickable and drill somewhere (§8.4).
- A step is not done until `npm test`, `npm run verify:theme` and
  `npm run verify:drills` all pass. Update affected tests in the same step.

---

## §10. Design constraints

- **All tokens live in `src/theme/tokens.ts`.** Components consume them as
  `colors.*` CSS variables. **Never write a literal hex value in a component.**
- If a new colour is genuinely unavoidable, add it to **both** the dark and light
  palettes in `tokens.ts` in the same edit. `npm run verify:theme` enforces this.
- The palette has `bgAccentSoft` and `bgAccentPanel` for blue but **no status-tinted
  surface**, which forces amber and red messaging onto transparent backgrounds. Add
  `bgWarnSoft` and `bgRiskSoft` to both palettes, standing in the same relationship
  to `statusAmber` and `statusRed` as `bgAccentSoft` does to `accent`. These are
  needed by the veto banner (§7.10.1), risk and control (§7.8) and overdue
  compliance (§7.9) — add them once, deliberately, rather than improvising per step.
- **Light-theme `statusRed` is under-darkened and must be corrected to `#C22E2E`.**
  The light palette darkens green to `#14764F` (5.62:1 on white) and amber to
  `#A16207` (4.92:1), but leaves red at `#D33C3C` (4.69:1) — the outlier. On
  `bgRiskSoft` it drops to 4.30 and fails AA for small text, which would force every
  red-on-tint element in risk, control and compliance to carry a size or weight
  exemption. `#C22E2E` gives 5.64 on white and 5.17 on `bgRiskSoft`, clears AA
  everywhere, and brings red into family with the other two. Change the token, not
  the tint. Dark-theme `statusRed` is unaffected.
- **Never append an alpha suffix to a CSS variable** — `${colors.x}55` is invalid
  CSS and silently renders nothing. Use `color-mix(in srgb, var(--x) 33%,
  transparent)` or an existing border token.
- Prefer existing tokens. For the attribution stacked bar (§5) use, in order:
  `accent` → `ageingBarAlt` → `borderAccent` → `textFaintest`. No new tokens needed.
- **Radii are zero everywhere.** `radii.dot: 50%` on `StatusDot` is the only round
  shape in the product. No rounded cards, chips, pills or buttons.
- **One shadow exists** (`paletteShadow`, on the command palette). Do not add another.
- Money is formatted with `formatCr()` from `src/lib/format.ts`. Do not write a
  second money formatter.
- **Where this spec's formatting hints conflict with established codebase
  precedent, precedent wins.** This spec describes behaviour and content; the
  codebase owns visual grammar. If the spec shows italic and nothing in `src/` is
  italic, do not introduce italic — match the codebase and note it.
- Global CSS is only for hover/active/focus states and keyframes, in
  `src/index.css`, referencing CSS variables. Everything else is an inline style
  object built from tokens.
- Dark theme stays. The existing type pairing (sans for prose, mono for numbers
  and small-caps labels) stays.
- Colour must never be the only carrier of meaning — always pair a RAG colour with
  a text label (`74 AMBER`).
- Label every colour bar. The five unlabelled bars in the current Group view are a
  defect: after §3.1 they become six named dimensions with visible names.
- No `Math.random()`. All data deterministic.
- No new runtime dependencies unless a prompt explicitly authorises one.
- Numbers use `₹NN.N cr` for value, `NN d` for days, `NN%` for rates.
- Fix known layout collisions: age column colliding with blocking reason on the
  worklist; effort and owner columns merged on the working capital view.

---

## §13. Codebase conventions

The prototype is React 18 + TypeScript on Vite 5, with react-router-dom 6. There is
no CSS framework. Read `PROJECT-MAP.md` for the full file inventory.

### 13.1 The data layer — extend it, never bypass it

```
src/api/types.ts      domain interfaces
src/api/mock/*.ts     static datasets
src/api/index.ts      the ONLY public accessor surface
```

- Components import from `../api` (or `../../api`). **They never import from
  `src/api/mock/*` directly.** This is an existing rule of the codebase; preserve it.
- **Do not create a parallel data module** such as `src/data/`. All new datasets go
  into `src/api/mock/` and are exposed through new accessors in `src/api/index.ts`.
- **Extend the existing type names rather than introducing parallel ones.** The
  interfaces in §6 are a description of the data shape, not a mandate to rename:

| §6 name | Existing type to extend |
|---|---|
| `Entity` | `Entity` in `src/api/types.ts` — currently has five dimension scores |
| `Exception` | `Exception` — add attribution, evidence, control significance, status |
| `RootCause` | `CauseNode` — keep this name, add elimination fields |
| stage counts | `ProcessStage` — add in-flight vs exception split |
| `Counterparty`, `ControlSignal`, `ComplianceItem`, `DataQualityItem`, `Forecast`, `ServiceMetric`, `Request`, `Trend`, `Veto`, `SensitivityItem` | new types, add to `src/api/types.ts` |

- Accessors are synchronous and return static arrays. Keep it that way — no
  network layer, no async, no state management library.

### 13.2 Derivations

`src/theme/derive.ts` holds every number-to-colour and number-to-word derivation
(`scoreColor`, `statusWord`, `statusColor`, `ageColor`, `controlColor`,
`breachColor`). It contains no hex values — it reads `colors.*`.

New derivations (attribution colour, veto badge state, trend direction) belong
here, not in a page component.

### 13.3 Shared components

`src/components/` with a barrel export in `index.ts`. Existing set: `Card`,
`Eyebrow`, `StatusDot`, `Bar`, `AgeingChart`, `StageFlow`, `DataTable`,
`CommandPalette`.

Reuse before building. In particular: `DataTable` for any new table, `Bar` for any
meter, `Card` + `Eyebrow` for any panel. New shared components get added to the
barrel.

### 13.4 Routing and navigation

`src/app/routes.tsx` owns four things that must stay in sync: the route table
(`AppRoutes`), the nav item list, the breadcrumb builder, and the active-nav
resolver. `src/app/paths.ts` holds link resolvers such as `defaultRootCauseTo()`.

Every new screen requires all four, plus:
- registration in `CommandPalette`'s result set
- a drill path entry in `scripts/verify-drills.mjs`
- a route entry in `scripts/verify-theme.mjs` — the contrast census cannot cover a
  screen it never visits

Selectors in the verify scripts must be stable — a driver id or test id, never
"first matching row". Row order is a rendering detail and an assertion resting on it
will fail silently the first time a sort changes.

### 13.5 The assistant already exists

`src/features/assistant/` contains `AssistantDrawer.tsx` (the 470px right-hand
drawer, message list, streaming bubble, follow-up chips, preset questions,
free-text input) and `provider.ts` (`AssistantProvider` interface +
`MockAssistantProvider` streaming canned answers in ~4-char chunks every 18ms).

`AssistantContext.ask()` lets any screen open the drawer with a question — this is
how "Ask why this entity is amber" on `EntityHome` works.

**Extend `MockAssistantProvider` behind the existing interface.** Do not rebuild
the drawer, do not change the provider interface, do not integrate a real LLM.

### 13.6 Tests and verification

```
npm test                  Vitest — tests/ plus co-located *.test.ts(x)
npm run verify:theme      token/palette parity check
npm run verify:drills     drill-path check
npm run dev               Vite, port 5200 (strict)
```

Existing suites cover the data layer, shell, routes and every page. **Changing the
Entity shape, the score model or the nav will break tests — fix them in the same
step, do not leave them red.** Report the test result at the end of every step.

---
