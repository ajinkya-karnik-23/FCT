# Project Map — Finance Control Tower

Inventory of the existing codebase (written at Step 0, refreshed at Step 16, re-verified against source at Phase 2 Step 0 on 2026-09-05). No source files were modified by this document.

## Stack

- **Framework:** React 18 (`react` ^18.3.1, `react-dom` ^18.3.1), TypeScript ~5.6.2
- **Build / dev server:** Vite 5 (`@vitejs/plugin-react` ^4.3.4). Dev port 5200 (strict).
- **Router:** react-router-dom ^6.30.6 — `BrowserRouter` wrapping `<AppShell>`; routes declared in `src/app/routes.tsx`.
- **Styling approach:** No CSS framework and no Tailwind. Two layers:
  - Inline React style objects built from the design-token module (`src/theme/tokens.ts`).
  - A single global stylesheet, `src/index.css`, holding only hover/active/focus states that inline styles can't express (nav items, chips, stage cards, palette rows, drawer buttons) plus keyframes. All values reference CSS variables set by `applyTheme()`.
- **Testing:** Vitest ^2.1.9 + @testing-library/react ^16.3.2 + jsdom. Tests live in `tests/` and co-located `*.test.ts(x)` under `src/lib`, `src/theme`.
- **Verification scripts (node, not tests):** `scripts/verify-theme.mjs` (`npm run verify:theme`), `scripts/verify-drills.mjs` (`npm run verify:drills`).

## Where mock data lives

All fabricated reference data is under `src/api/mock/*.ts` (11 modules), exposed only through the synchronous accessors in `src/api/index.ts`. Components import from `../api` (or `../../api`) and never from `./mock/*` directly. Domain types are declared in `src/api/types.ts`. There is no network layer — every accessor returns a static array/object.

Two layers sit above the mock data:
- `src/api/score.ts` — derived figures only (entity scores with veto caps, group KPIs, trend deltas). Computed on call, never stored; carries the §8.6.1 definition strings for each derived KPI.
- `src/api/actions.ts` — session-local worklist actions (§8.9): mutates shared exception objects in place (assign/chase/release append an evidence line), snapshots originals at import so `resetWorklistActionStore()` restores seeded state. Never persists.

## Source files

### Entry / app shell
- `index.html` — Vite entry; loads IBM Plex Mono from Google Fonts, mounts `#root`, script `/src/main.tsx`.
- `src/main.tsx` — React root; applies the persisted theme before first paint (`applyTheme(storedTheme())`) to avoid a flash.
- `src/App.tsx` — wraps `<AppShell>` in `BrowserRouter`.
- `src/app/AppShell.tsx` — top-level layout: Rail + (TopBar over main routes) + AssistantDrawer + CommandPalette; owns palette/drawer open state, the assistant "ask" API via context, and cockpit-mode state (`useState<CockpitMode>` provided through `AppModeContext`).
- `src/app/Rail.tsx` — left navigation rail (236px): brand block, nav items grouped under the six §9.1 labels (OVERVIEW · PROCESS · EXPLAIN · ASSURE · FORWARD · SERVICE) with counts, search trigger (⌘K). Counterparty pages are drill-only and never appear here.
- `src/app/TopBar.tsx` — top bar (60px): breadcrumb, current entity chip (StatusDot paired with the score number in matching colour), cockpit-mode toggle (CLOSE / BAU / PRE-CLOSE), period label derived from the active mode (`MODE_PERIOD`), dark/light theme toggle, "Ask the cockpit" drawer button.
- `src/app/routes.tsx` — route table (`AppRoutes`), breadcrumb builder, active-nav resolver, and `RAIL_GROUPS` + `NAV_ITEMS` (14 items; counts derive from API accessors, no literals).
- `src/app/paths.ts` — `defaultRootCauseTo()`: resolves a root-cause link to p2p + that taxonomy's first cause.
- `src/app/mode.ts` — cockpit mode: `CockpitMode = 'close' | 'bau' | 'preclose'`, `COCKPIT_MODES` labels, `DEFAULT_COCKPIT_MODE = 'preclose'`, `MODE_PERIOD` strings (`DAY 4 OF CLOSE` / `BUSINESS AS USUAL · DAY 12` / `PRE-CLOSE READINESS · 3 DAYS TO CLOSE`), `AppModeContext` + `useAppMode()`. Mode is not persisted.

### Theme / design tokens
- `src/theme/tokens.ts` — the single source of all colours, fonts, type scale, spacing, layout metrics, radii, bar heights, animation and shadow. Defines dark + light palettes (including the soft warning/risk surfaces `bgWarnSoft`/`bgRiskSoft`), the CSS-variable bridge (`colors.*`), and theme apply/persist helpers.
- `src/theme/derive.ts` — pure colour/status derivations from numbers; no hex values, reads `colors.*`. Exports: `scoreBand`, `scoreColor`, `statusWord`, `statusColor`, `ageColor`, `controlColor` (+ `ControlSignificance`), `breachColor`, `trendColor`, `complianceColor`, `interfaceColor`, `requestSlaStatusWord` + `requestSlaColor` (`RequestSlaWord`), `causeEliminationColor` (`CauseEliminationWord`). Exactly one place decides a band.

### Data layer (API + mock)
- `src/api/types.ts` — domain interfaces: `Entity` (six dimension scores, working-capital figures, veto caps), `ProcessStage`, `Exception`, `CauseNode`, `CashOpportunity`, ageing/reason buckets, group summary, O2C KPIs/service-control, control signals/categories, compliance obligations, data-quality interfaces, service requests, counterparties, cause-backlog entries. Reference data only; colours/status words derived at render.
- `src/api/index.ts` — public accessor surface (entities, stages, exceptions, causes, cash opportunities, group summary, per-entity blocked/receivables ageing via getBlockedInvoiceAgeing/getReceivablesAgeing, payables-by-reason, service control, recurring causes, O2C KPIs/service-control, cause backlog + elimination trend, compliance, controls + AP-tool effectiveness, data quality, requests, counterparties) + per-cause pool denominators (causePool — filtered worklist headers tie to the taxonomy node's value at risk) + type re-exports.
- `src/api/score.ts` — §3.1/§3.2 score engine: `DIMENSION_KEYS/LABELS/DEFINITIONS/WEIGHTS` (contractual weights .2/.15/.2/.2/.1/.15), `computeScore` (weighted sum, min active veto cap → displayed + `cappedBy`), `priorScore`, `applySensitivity` (§7.10 deltas computed never stored); group-level derived KPIs each with its §8.6.1 definition string: `GROUP_SCORE_DEFINITION`/`groupScore(+Previous)`, `VALUE_AT_RISK_DEFINITION`/`valueAtRisk`, `OPEN_EXCEPTIONS_DEFINITION`/`openExceptions(+Previous)`; plus `trendDelta`, `pointDirection`, `stageExceptionPct`.
- `src/api/actions.ts` — §8.9 worklist row actions (see "Where mock data lives").
- `src/api/mock/entities.ts` — 6 legal entities: six dimension scores, working-capital figures (incl. queriesOverdue), oldest-item ageing, SLA breach counts, veto caps.
- `src/api/mock/stages.ts` — P2P stages (7) and O2C stages (7): step code, name, volume, value, exception %, status.
- `src/api/mock/exceptions.ts` — blocked-invoice exceptions per entity (process p2p).
- `src/api/mock/causes.ts` — root-cause taxonomies in the fixed §6.1 vocabulary: share, value at risk, delay, recurrence, concentration, narrative, plant/segment + vendor/driver splits, actions.
- `src/api/mock/misc.ts` — supporting datasets: per-entity blocked-invoice and receivables ageing (share tables allocated to each entity's pool by largest-remainder), payables-by-reason, cash opportunities, recurring causes, P2P service & control, O2C KPIs + service/control, group summary (close progress + transformation health).
- `src/api/mock/causeBacklog.ts` — §7.30 cause-elimination register (entity-level rows with owner/target/status) plus the six-period elimination trend and current-period eliminations.
- `src/api/mock/compliance.ts` — compliance obligations with filed/due/overdue status, per-section scores, value at risk.
- `src/api/mock/controls.ts` — §7.8 control signals across five categories (payment/authority/system/cutoff/exposure) + AP automation tool effectiveness (override rates, value prevented).
- `src/api/mock/counterparties.ts` — vendor / customer / cost-centre / plant drill pages: metrics and line-item tables for the L5 counterparty screens.
- `src/api/mock/dataQuality.ts` — interface status (on schedule/delayed/stale) and MDM quality figures.
- `src/api/mock/requests.ts` — service-desk request queue with SLA targets, effective age and closed state.

### Shared components (`src/components/`)
- `index.ts` — barrel export of the shared component set.
- `Card.tsx` — bordered panel with optional eyebrow header and inner gap.
- `Eyebrow.tsx` — small uppercase mono label (uses `typeScale.eyebrow`).
- `StatusDot.tsx` — the only round shape; coloured dot, optional pulse animation.
- `Bar.tsx` — horizontal meter: value/max ratio over a track, configurable height and colour.
- `AgeingChart.tsx` — vertical bucket bar chart (ageing); two largest buckets take accent, rest the secondary blue.
- `StageFlow.tsx` — row of process-stage cards (step code, name, volume, value, exception meter + %), each a link into the worklist.
- `DataTable.tsx` — generic grid table with column config and optional clickable rows.
- `CommandPalette.tsx` — ⌘K/Ctrl+K global search overlay; result set of entities, exceptions, root causes and screens; navigates on pick.
- `Metric.tsx` — labelled KPI: value (pre-formatted at call site), signed trend delta via `trendDelta`, optional sparkline.
- `DimensionBar.tsx` — single dimension meter with its §8.6.1 definition exposed as the hover title.
- `FreshnessStamp.tsx` — §8.7 header stamp: source list + "as of 06:00 IST" in mono textFaintest; mixed-source screens pass every source.
- `CrossProcessTrace.tsx` — §8.10 four-node chain (missing goods receipt → blocked invoice → understated accrual → close exposure); the current node renders as a bordered span, the other three as links.

### Assistant feature (`src/features/assistant/`)
- `AssistantDrawer.tsx` — right-hand "Cockpit intelligence" drawer (470px): message list with streaming bubble, follow-up chips, preset questions, free-text input; exposes `AssistantContext`/`ask()` so any screen can open it and pose a question.
- `provider.ts` — `AssistantProvider` interface + `MockAssistantProvider`: canned answers streamed in ~4-char chunks every 18ms; UI depends only on the interface.

### Pages (`src/pages/`)
- `GroupView.tsx` — Level 0 group view: header KPIs (group score, value at risk, open exceptions) with §8.6.1 hover definitions, entity table with per-dimension bars and CAPPED badges wired to `ask()`, recurring causes, close-progress card (`id="fct-close-card"`, hidden in BAU mode), transformation health, cross-process trace from the close node.
- `EntityHome.tsx` — Level 1 legal-entity home: big score + six dimension meters, metric tiles, top issues list, root-cause insights, recommended-actions panel with "Ask why this entity is amber".
- `P2PCockpit.tsx` — Level 2 P2P process view: stage flow, blocked-invoice ageing chart, top-causes drill list, service & control card.
- `O2CCockpit.tsx` — Level 2 O2C process view: DSO/overdue/unapplied KPIs, O2C stage flow, receivables ageing, O2C causes, O2C service & control.
- `Worklist.tsx` — Level 4 blocked-invoices worklist: cause filter + sort chips in the URL query string, recomputed header aggregates, invoice table with §8.9 row actions (assign/chase/release) and empty state.
- `ExceptionDetail.tsx` — Level 4 transaction detail (terminal): field list, lifecycle timeline, next-action panel; "Why does this keep happening?" links to root cause.
- `RootCause.tsx` — Level 5 process-aware root cause: taxonomy selector driven by route params (`p2p`/`o2c`), primary-cause narrative + metrics, plant/segment and vendor/driver splits (plant rows drill sideways to counterparty pages), recommended interventions; cross-process trace from the goods-receipt node when `missing-gr` is selected.
- `WorkingCapital.tsx` — working-capital view: DSO/DPO/releasable KPIs, receivables ageing bars, payables-by-reason bars, cash-opportunity table with effort and owner columns.
- `CauseBacklog.tsx` — §7.30 cause elimination: headline counts (identified/eliminated/in-progress/not started), register table linking to root cause + exceptions, "the mechanism" grid pairing cumulative eliminations against group open exceptions over six periods.
- `RiskControl.tsx` — §7.8 risk & control: control signals in five categories with severity tags and value at risk, AP-tool effectiveness section; RESTRICTED strip with a demo-only access toggle (§8.8).
- `CompliancePage.tsx` — compliance obligations by status (filed/due/overdue), per-section scores, value at risk.
- `DataQualityPage.tsx` — data & MDM quality: interface statuses and master-data figures.
- `Predictive.tsx` — forward view: DSO/DPO drivers and projected movement.
- `ServiceAttribution.tsx` — service & attribution: SLA breaches attributed to client/provider/system/third party.
- `ServiceDesk.tsx` — finance service desk: request queue with per-request SLA status (on track/breached/met).
- `VendorPage.tsx`, `CustomerPage.tsx`, `PlantPage.tsx`, `CostCentrePage.tsx` — Level 5 counterparty drill pages (terminal): metrics and line-item tables. Drill-only — never in the rail.

### Utilities / types
- `src/lib/format.ts` — `formatCr()` (Indian-crore money, 1 decimal default) and `formatRecurrence(months)` (§7.12 ordinal recurrence). The only formatters.
- `src/vite-env.d.ts` — Vite client type reference.

### Tests and verification (do not render)
- `tests/` — 17 Vitest suites: `api.test.ts`, `app-shell.test.tsx`, `drill-paths.test.tsx`, `o2c-cockpit.test.tsx`, `p2p-worklist-exception.test.tsx`, `pages-group-entity.test.tsx`, `palette-assistant.test.tsx`, `rootcause-workingcapital.test.tsx`, `routes.test.ts`, `risk-control.test.tsx`, `predictive.test.tsx`, `counterparty.test.tsx`, `assure-compliance-dq.test.tsx`, `service-attribution.test.tsx`, `service-desk.test.tsx`, `cause-backlog.test.tsx`, `cross-process-trace.test.tsx`.
- Co-located unit tests: `src/lib/format.test.ts`, `src/theme/derive.test.ts`, `src/theme/tokens.test.ts` (the latter holds the by-design sub-AA contrast exemptions that verify-theme mirrors).
- `scripts/verify-theme.mjs` — headless Chrome + CDP. Per theme: CSS-variable dump check, hover probe, focus ring, command-palette scrim+shadow, AI-drawer bubbles, then a full route walk (in-situ text-pair census via injected audit JS, expected-token presence per route, screenshots); persistence/toggle checks; an **enforcing** contrast gate (`reportContrast` returns violations and is gated by `check()` — exemptions mirror the tokens.test.ts table, unresolved colours are violations); `paletteMatrix` prints worst pairs informationally.
- `scripts/verify-drills.mjs` — drill-down path verification against a running dev server on :5200.

## Design tokens in use

All values below are the exact token definitions from `src/theme/tokens.ts`. Components consume them via `colors.*` (CSS variables), so a theme switch needs no re-render.

### Colours — dark palette
| Token | Value |
| --- | --- |
| bgRoot | #080B10 |
| bgPanel | #0B1017 |
| bgPanelAlt | #0A0F16 |
| bgRaised | #101822 |
| bgSelected | #121C27 |
| bgAccentSoft | #12233C |
| bgAccentPanel | #0D1522 |
| borderDefault | #182231 |
| borderSubtle | #131C27 |
| borderStrong | #22303F |
| borderAccent | #2A3A52 |
| textPrimary | #E6ECF4 |
| textSecondary | #B9C6D6 |
| textMuted | #8798AC |
| textFaint | #5C7290 |
| textFaintest | #4A5F7A |
| accent | #2E7DF0 |
| accentText | #56A0FF |
| statusGreen | #35C48A |
| statusAmber | #F2B23E |
| statusRed | #FF6B6B |
| chartArOld | #B4551E |
| ageingBarAlt | #1F5FB5 |
| bgAccentHover | #17304F |
| bgWarnSoft | #352D1E |
| bgRiskSoft | #372026 |
| assistantBorder | #1B2634 |
| paletteScrim | rgba(4, 7, 11, 0.72) |

### Colours — light palette
| Token | Value |
| --- | --- |
| bgRoot | #F2F5F9 |
| bgPanel | #FFFFFF |
| bgPanelAlt | #F7F9FC |
| bgRaised | #EAEFF5 |
| bgSelected | #E3EAF3 |
| bgAccentSoft | #DFEAFB |
| bgAccentPanel | #EEF4FC |
| borderDefault | #D6DEE9 |
| borderSubtle | #E4EAF2 |
| borderStrong | #B7C4D4 |
| borderAccent | #9FBCE8 |
| textPrimary | #16222F |
| textSecondary | #3E5169 |
| textMuted | #5A6E86 |
| textFaint | #64788F |
| textFaintest | #93A3B5 |
| accent | #2E7DF0 |
| accentText | #1D5ED8 |
| statusGreen | #14764F |
| statusAmber | #A16207 |
| statusRed | #C22E2E |
| chartArOld | #B4551E |
| ageingBarAlt | #1F5FB5 |
| bgAccentHover | #CFE0F8 |
| bgWarnSoft | #F9F6F0 |
| bgRiskSoft | #FCF3F3 |
| assistantBorder | #D9E2EE |
| paletteScrim | rgba(23, 32, 45, 0.55) |

### Fonts
- sans: `'Helvetica Neue', Helvetica, Arial, sans-serif`
- mono: `'IBM Plex Mono', monospace` (loaded via Google Fonts in `index.html`)
- Weights: regular 400, medium 500, semibold 600

### Type scale
| Token | Size / weight / family | Notes |
| --- | --- | --- |
| viewTitle | 26px / semibold / sans | letter-spacing -0.02em |
| bigScore | 44px / semibold / mono | line-height 1 |
| kpiValue | 30px / semibold / mono | |
| tileValue | 22px / semibold / mono | |
| stageVolume | 19px / regular / mono | |
| body | 13px / regular / sans | |
| uiBase | 14px / regular / sans | base body size |
| eyebrow | 11px / regular / mono | uppercase, letter-spacing 0.18em, textFaint |
| tableHeader | 10px / regular / mono | uppercase, letter-spacing 0.14em, textFaint |

### Spacing scale
- contentPadding: `30px 26px 40px`
- cardPadding: `22px`
- tableCellPadding: `14px 20px`
- gapCards: `16px`
- gapStages: `10px`
- gapCardInner: `12px`

### Layout metrics
- railWidth: `236px`
- topBarHeight: `60px`
- aiDrawerWidth: `470px`
- paletteWidth: `720px`
- paletteTopOffset: `12vh`

### Border radii
- none: `0` — everything except status dots
- dot: `50%` — the only round shape in the product

### Bar heights (px)
- stageRate: 4, inlineMeter: 6, ageing: 18, dimensionColumn: 22

### Animation & shadow
- pulse: `pulse 2.4s ease-in-out infinite`; fade-in: `fade-in 140ms ease-out`
- paletteShadow (the only shadow): `0 40px 100px -30px rgba(0, 0, 0, 0.9)`
