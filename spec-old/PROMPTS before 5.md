# Finance Control Tower — Build prompts

Sequential prompts for Claude Code. Each step is self-contained and small enough
for a local model. Work through them in order.

---

## Before you start

1. Copy `SPEC.md` and `PROMPTS.md` into the **root of the prototype repo**.
2. Open a fresh Claude Code window in that repo.
3. Paste the **Session primer** below. Re-paste it any time you open a new window
   or the model starts losing the thread.
4. Then paste steps one at a time. After each step: run the app, look at the
   screen, confirm the acceptance criteria, then move on.

**Do not paste more than one step at a time.** The model will try to do all of
them at once and do all of them badly.

If a step produces a mess, `git checkout .` and re-run it with the extra line:
*"Make the smallest possible change. Do not restructure existing components."*

---

## Session primer

> Paste this first, in every new window.

```
You are working on a front-end demo prototype called the Finance Control Tower.
It is a controllership dashboard for a finance managed services pitch.

Rules for this entire project:

1. SPEC.md in the repo root is the single source of truth. Read only the sections
   a task tells you to read. Do not read it end to end.
2. PROGRESS.md tracks what is done. Read it before starting. Update it when you
   finish a step.
3. Never invent numbers. All figures come from the dataset module. If you need a
   figure that is not there, add it to the dataset first.
4. Never invent colours, fonts, spacing or radii. Reuse the existing design tokens.
5. Never add a runtime dependency unless the task explicitly authorises one.
6. Never use Math.random(). All data is deterministic.
7. Never refactor files outside the scope the task names.
8. Make the smallest change that satisfies the task.
9. If something in the task is ambiguous, ask me before writing code. Do not guess.

Codebase conventions — SPEC.md §13 has the detail, but these bind every task:

10. All data lives in src/api/. Extend src/api/types.ts and src/api/mock/*.ts and
    expose it through src/api/index.ts. Components import from ../api only, never
    from src/api/mock/* directly. Do NOT create a parallel data module.
11. Extend existing type names, do not introduce parallel ones. Root causes are
    CauseNode. Stages are ProcessStage.
12. No literal hex values in components. All colour comes from src/theme/tokens.ts
    via colors.*. A new colour must be added to BOTH the dark and light palettes.
13. Radii are zero everywhere. StatusDot is the only round shape. No rounded chips,
    pills or buttons. Exactly one shadow exists; do not add another.
14. Banding, status words and colour derivations live in src/theme/derive.ts.
    Never re-implement them in a component.
15. Money is formatted with formatCr() from src/lib/format.ts.
16. Adding a screen means updating four things in src/app/routes.tsx — route table,
    nav list, breadcrumb builder, active-nav resolver — plus CommandPalette and
    scripts/verify-drills.mjs.
17. The assistant already exists in src/features/assistant/. Extend
    MockAssistantProvider behind the existing AssistantProvider interface. Do not
    rebuild the drawer.

Definition of done for every step: npm test, npm run verify:theme and
npm run verify:drills all pass, with affected tests updated in the same step.
Report the test result at the end of each step.

Acknowledge these rules in one line, then wait for the first task.
```

---

## Step 0 — Inventory the repo

```
Task: map the existing codebase. Write files, change nothing else.

1. List every source file with a one-line description of what it renders.
2. Identify: the framework and version, the styling approach, the router (if any),
   where mock data currently lives, and the design tokens in use (exact colour hex
   values, font families, spacing scale, border radii).
3. Write PROJECT-MAP.md in the repo root containing all of the above.
4. Write PROGRESS.md in the repo root with this content:

   # Progress
   - [x] Step 0 — repo inventory
   - [ ] Step 1 — dataset module
   - [ ] Step 1b — data gaps (sensitivity, attribution, narratives)
   - [ ] Step 2 — entities and naming
   - [ ] Step 2b — narrative backing data
   - [ ] Step 3 — six dimensions and scoring
   - [ ] Step 3b — status surface tokens and CSS fix
   - [ ] Step 4 — trends
   - [ ] Step 4b — trend corrections
   - [ ] Step 4c — dimension and count trends
   - [ ] Step 5 — in-flight funnels and financial consequence
   - [ ] Step 6 — mode-aware header
   - [ ] Step 7 — worklist actions and attribution
   - [ ] Step 8 — service and attribution screen
   - [ ] Step 9 — risk and control screen
   - [ ] Step 10 — predictive screen
   - [ ] Step 11 — counterparty pages
   - [ ] Step 12 — compliance and data quality screens
   - [ ] Step 13 — front door
   - [ ] Step 14 — cause elimination backlog
   - [ ] Step 15 — Ask the Control Tower
   - [ ] Step 16 — navigation, freshness, final QA

Do not modify any existing source file in this step.
```

**Check:** PROJECT-MAP.md lists real files and real hex values. If the token list
is vague, ask the model to re-read the stylesheet and be exact — every later step
depends on it.

---

## Step 1 — Extend the data layer

```
Read SPEC.md sections §6, §7 and §13.1.

Task: extend the existing API layer with the new types and the canonical dataset.

Do NOT create a new data module. The project already has src/api/types.ts,
src/api/mock/*.ts and the accessor surface in src/api/index.ts. Work inside it.

1. Extend src/api/types.ts:
   - Add the Trend, Veto and SensitivityItem types from SPEC.md §6.
   - Extend Entity: replace the five dimension scores with the six in §3.1, and add
     vetoes and sensitivity. Add o2cExceptionCount to the metrics.
   - Extend Exception: add attribution, evidence[], controlSignificance, status.
   - Extend CauseNode (keep this name, it is the existing root-cause type) with
     eliminationStatus, eliminationOwner, eliminationTargetDate.
   - Extend ProcessStage: split volume into inFlight / inFlightValue /
     inException / exceptionValue. Exception % is derived, never stored.

2. Update the mock datasets with the canonical figures in SPEC.md §7:
   - src/api/mock/entities.ts  — six entities, §7.1 dimension scores, §7.2 metrics,
     prior-period values for trends, JRP's active veto
   - src/api/mock/stages.ts    — §7.4 P2P and O2C stage figures
   - src/api/mock/causes.ts    — §7.5 root causes, values tying to ₹18.6 cr
   - src/api/mock/misc.ts      — §7.3 forecast anchors, §7.7 service metrics,
     and the ageing buckets in §7.4

3. Add pure helpers. Put score logic in src/api/ and colour/word derivation in
   src/theme/derive.ts — do not mix the two:
   - computeScore(entity)       → { raw, displayed, band, cappedBy }
   - groupScore(entities)       → rounded mean of displayed scores
   - valueAtRisk(entities)      → Σ (apBlocked + arOver90)
   - openExceptions(entities)   → Σ (apBlockedCount + o2cExceptionCount +
                                     reconAgedBreaks)
   - trendDelta(trend, inverse) → { direction, percent }
   Reconcile band thresholds with the existing scoreColor() and statusWord() in
   src/theme/derive.ts. There must be exactly one place that decides a band.

4. Expose everything through new accessors in src/api/index.ts. Do not let any
   component import from src/api/mock/* directly.

5. Update existing components only where a renamed or reshaped field forces it. No
   layout or styling changes in this step.

Acceptance criteria — add these as assertions in tests/api.test.ts:
   computeScore(JGL).displayed === 74
   computeScore(JBL).displayed === 67
   computeScore(JPS).displayed === 81
   computeScore(JCP).displayed === 91
   computeScore(JHS).displayed === 88
   computeScore(JRP).displayed === 55, cappedBy = the bank-change veto
   groupScore()    === 76
   valueAtRisk()   === 100.4

Changing the Entity shape will break existing tests. Fix them in this step. Report
the full test result and the computed scores back to me before finishing.
```

**Check:** the assertions pass and the whole suite is green. If a score is off, the
dimension scores were mistyped — fix the data, not the formula.

---

## Step 1b — Fill the data gaps

Run this before Step 2. Step 1 correctly declined to invent three datasets the spec
had not defined; they are now in SPEC.md.

```
Read SPEC.md sections §7.1, §7.10, §7.11 and §7.12.

Task: fill the gaps Step 1 flagged. Data layer only — no UI changes.

1. Sensitivity (§7.10). Populate the sensitivity array on all six entities. Note
   the checkable relationship: deltaScore = implied dimension movement × that
   dimension's weight. Add a test asserting that no entity's sensitivity items
   imply a dimension moving beyond its headroom to 100, individually or
   cumulatively.

2. JRP's second veto (§7.1). JRP now carries two active vetoes: the overdue
   statutory filing (cap 60) and the unauthorised bank change (cap 55). The
   effective cap is the minimum, so the displayed score stays 55 and no existing
   assertion changes. Add a test for the demo path: with the bank-change veto
   cleared, JRP displays 58.

3. The two JRP veto-clearing sensitivity items are not ordinary weighted movements
   — they lift a cap. Mark them so the UI can label them "removes cap" in Step 3.
   Add a discriminator to SensitivityItem rather than special-casing in a component.

4. Attribution (§7.11). Add breach counts by attribution — store counts, derive
   percentages, never store the percentage. Populate JGL's per-SLA table and the
   entity breach totals. Add an accessor that computes the group-level split from
   the entity data. Assert it produces 71/18/7/4 and that JGL's own split is
   72/19/6/3 — an entity is not the group, and these are meant to differ.

5. Narrative cleanup (§7.12). Reconcile the prose in causes.ts with the §7.5
   figures. The po-price-mismatch narrative claiming "four contracts account for
   71%" is stale — pricing is 22% of ₹18.6 cr across 4 vendors. Store recurrence as
   an integer number of months and add a display helper that renders the ordinal
   form ("5th consecutive month"); do not store the ordinal string.

6. Move the EntityHome tile sub-labels ("19 receipts", "327 invoices") out of the
   component and into the data layer.

Run all three gates and report.
```

**Check:** the group split computes to 71/18/7/4 and JGL's to 72/19/6/3. If they
come out identical, the group figure is being computed from JGL alone.

---

## Step 2 — Entities and product naming

```
Read SPEC.md sections §2 and §1.1.

Task: correct the legal entities and the product name.

1. Remove Jubilant Ingrevia and Jubilant Life Sciences NV as legal entities. They
   are not part of this group — Ingrevia was demerged into a separately listed
   company. Step 1 left three stale references: provider.ts line 28 (an assistant
   answer naming Ingrevia as an entity), README.md, and any entity row.

   IMPORTANT EXCEPTION: Ingrevia is a genuine related party. The cash opportunity
   "Clear intercompany netting with Ingrevia" in cashOpportunities is CORRECT and
   must be preserved. Removing it would be an error. Remove Ingrevia as a group
   entity; keep it as an intercompany counterparty.
2. Use exactly the six entities in SPEC.md §2, with their codes, segments and
   geographies.
3. Rename the product to "Finance Control Tower" everywhere. Remove "Controller
   Cockpit" as a competing brand name. The sidebar wordmark becomes:
       Finance Control Tower
       JUBILANT PHARMOVA
   Individual screens may still be called cockpits (e.g. "P2P cockpit").
4. Add a toggle above the Group view table switching the grouping between
   Entity | Segment | Geography, using the values in SPEC.md §2. Aggregated rows
   use the same columns; scores aggregate as the mean of member entities, money
   columns as the sum.

   Do NOT offer a Plant grouping. Plant data does not exist yet and JPS has no
   manufacturing site; plant views arrive in Step 11 from exception-level data.

5. Reconcile the narratives Step 1b flagged: store the approval-pending
   concentration (7 approvers, 64% of that cause's ₹3.3 cr) as a byGroup split so
   the sentence derives from data rather than being deleted. Per SPEC.md §7.12, no
   narrative may carry a number that is not derivable from stored data — audit the
   remaining narratives for any others and report what you find.

Do not change any other layout or styling.
```

**Check:** grep the repo for `Ingrevia`, `Life Sciences NV`, `Controller Cockpit` —
all should return nothing.

---

## Step 2b — Back the remaining narratives

Run before Step 3. The Step 2 audit found six narrative claims with no stored
backing; one of them, pricing-disputes, is a contradiction visible on screen today.

```
Read SPEC.md sections §7.12 and §7.13.

Task: give every narrative number a stored field. Data layer only.

1. pricing-disputes is the priority — it is a live defect, not just an unbacked
   number. "Nine distribution customers account for 64% of disputed value" conflates
   two different cuts: nine customers holding 64% of value, and the Distribution
   segment holding 41%. Store both and rewrite the sentence so it reads as two
   cuts, per §7.13.

2. Back the other five claims with the fields in §7.13: vendor-master record count,
   duplicate-suspicion pair count, deductions acceptance rate, tax-mismatch state
   split, cash-application oldest age.

3. Add the four oldest-item ageing fields to EntityMetrics for all six entities,
   using the §7.13 table. Add a test asserting they order consistently with entity
   health — JCP lowest and JRP highest on every one of the four. An ageing figure
   that contradicts the score is a defect.

4. Re-run the narrative audit across all twelve causes and confirm zero unbacked
   quantitative claims remain. Report the result.

Do not change any component layout. The ageing fields will be surfaced in Step 4
alongside the trend work.
```

**Check:** the audit returns zero unbacked claims, and the pricing-disputes sentence
no longer implies 64% and 41% describe the same set.

---

## Step 3 — Six named dimensions and the scoring model

```
Read SPEC.md section §3 and §10.

Task: replace the five unlabelled colour bars with six named, scored dimensions.

1. In the Group view, replace the anonymous colour-bar cluster with six labelled
   dimension indicators: Operational, Service, Risk & control, Working capital,
   Data & MDM, Compliance. Each shows its name, a bar, and its numeric score.
   Colour must never be the only carrier of meaning — pair every RAG colour with a
   text label.
2. In the Entity health view, do the same, using the same component.
3. Next to every entity score, show the band as text (e.g. "74 AMBER").
4. Where a veto is active, show a badge reading "CAPPED — <reason>" next to the
   score. On click, reveal the raw uncapped score and the veto rule.
5. First, a data-layer correction. Sensitivity currently stores a fixed
   deltaScore, which is wrong: a stored delta cannot survive a veto. Change
   SensitivityItem to store dimensionMovement (points on that dimension) and an
   optional clearsVeto id, and COMPUTE the resulting score by recomputing with the
   movement applied and that veto deactivated. Use the movements in SPEC.md §7.10.
   Update the headroom test to assert currentDimensionScore + movement <= 100, per
   item and cumulatively per dimension.

6. Add a "What moves this score" panel on the Entity health view. Each row reads:
       "Clear GR compliance on 11 vendors    74 → 81    Low effort"

7. Handle the capped case properly — read SPEC.md §7.10.1 before building this.
   On JRP, every ordinary action delivers a gain of zero while the bank-change cap
   binds. Do not render a list of actions with zeros next to them. Show a banner:
   "While the bank-change cap binds, no other action moves this score", with the
   cap-clearing action promoted above it. This is the veto rule working as
   intended and it is the most persuasive thing on the screen.

8. Make the cascade in §7.10.1 work as a live sequence: 55 → 58 → 64 → 68. Order
   matters — filing the overdue return first must deliver nothing, because the
   bank-change cap still binds. Add a test for both orderings.
9. Add a "How this score is built" disclosure showing the six weights from §3.2 and
   the formula. Weights are contractual and must be visible to the user.

10. Where more than one veto is active, the badge names the BINDING one; the
    disclosure lists all active vetoes with their caps and the raw score. JRP has
    two.

Files: src/pages/GroupView.tsx, src/pages/EntityHome.tsx, and one new shared
DimensionBar component added to the src/components/ barrel. Nothing else.

Note: the codebase currently renders five dimensions, using the dimensionColumn
bar height token. Moving to six will change the column layout on GroupView and the
meter row on EntityHome, and will break tests/pages-group-entity.test.tsx. Fix the
tests in this step.
```

**Check:** all six bars are labelled and numbered; JRP shows the CAPPED badge.

---

## Step 3b — Two small fixes

Both came out of Step 3. Small, but the first one will otherwise recur in every
later step that needs to say something is wrong.

```
Read SPEC.md §10.

Task: two fixes, no feature work.

1. The palette has bgAccentSoft and bgAccentPanel for blue but no status-tinted
   surface, which forces amber and red messaging onto transparent backgrounds — as
   the veto banner currently is. Add bgWarnSoft and bgRiskSoft to BOTH the dark and
   light palettes, standing in the same relationship to statusAmber and statusRed as
   bgAccentSoft does to accent. Check contrast in both themes.

   Then apply bgWarnSoft to the veto banner. Risk and control (Step 9) and overdue
   compliance (Step 12) will use these too — this is why they are worth adding
   deliberately now rather than improvising later.

2. Fix the invalid-CSS bug you flagged: `1px solid ${statusColor}55` appends an
   alpha suffix to a CSS variable, which is invalid and silently renders no border.
   Use color-mix(in srgb, var(--x) 33%, transparent) or an existing border token —
   do not introduce a hex. Grep the codebase for other instances of the same
   pattern and report what you find.

Run all three gates.
```

**Check:** the veto banner now reads as a warning rather than as body text. If the
grep finds more `${var}NN` instances, fix them all in this step.

---

## Step 4 — Trends on every headline number

```
Read SPEC.md section §8.3 and §7.2.

Task: every headline metric shows direction of travel, not just a snapshot.

1. Create a shared Metric component in src/components/, exported from the barrel.
   It renders: label, value, delta vs prior period, and a small inline sparkline of
   the last 6 periods. Use formatCr() for money and the existing Bar component
   where a meter is needed.
2. The delta takes an `inverse` flag. For metrics where down is good (AP blocked,
   AR > 90 days, unapplied cash, DSO), a decrease renders as an improvement. For
   metrics where up is good (close %, touchless rate), an increase renders as an
   improvement. Direction colour follows improvement, not arithmetic sign.
3. Apply this component to every headline figure on the Group view, Entity health
   view, P2P cockpit, O2C cockpit and Working capital view.
   Where an oldest-item ageing figure exists (§7.13), show it as the tile's
   sub-label — "₹18.6 cr · 327 invoices · oldest 52 d". Ageing is what turns an
   amount into a controllership problem, so it belongs next to the amount.
4. Draw the sparkline as an inline SVG using colors.* variables. Do not add a
   charting library. Put the direction-to-colour derivation in
   src/theme/derive.ts, not in the component.

Prior-period values for AP blocked and AR over 90 days are already in the dataset;
the rest — cash unapplied, close %, reconciliation value, DSO and DPO — are in
SPEC.md §7.14, along with DSO and DPO for the five entities that did not have them.
Add the adjusted-DPO figures at the same time.

Generate the six-point series per §7.14: seeded and deterministic, series[5] =
current, series[4] = previous, every point within ±25% of current, and the series
must not contradict a stated recurrence. Assert all four.
```

**Check:** JGL AP blocked shows an improvement (22.1 → 18.6) while JGL AR > 90 days
shows a worsening (11.2 → 12.4). If both render the same colour, the `inverse`
flag is not wired.

---

## Step 4b — Trend corrections

Three corrections from the Step 4 flags, two of which are spec errors rather than
implementation ones.

```
Read SPEC.md §7.14 and §8.5.1.

Task: correct the trend rules and fill the remaining gaps.

1. The ±25% series bound is wrong on small denominators — JCP's cash unapplied
   moving ₹0.3 cr to ₹0.4 cr is trivial in rupees and 33% in percent, which is why
   the spec's own pinned value violated it. Change the bound to
   max(25% of current, absolute floor), with floors of ₹0.5 cr for money, 5 points
   for percentages, 5 days for day counts. Apply it to pinned points as well as
   generated ones and remove the documenting comment — the exception is gone.

2. Replace the JGL-only recurrence assertion with the generic form in §7.14: for a
   down-is-good metric, the last N points must not be monotonically decreasing,
   where N is the recurrence of the mapped cause. Use the cause → metric mapping in
   §7.14. "Elevated" was too vague to test; monotonicity is testable across all
   twelve causes.

3. DPO becomes direction-neutral. Metric's inverse prop takes true | false | null;
   DPO is null and renders in textMuted whichever way it moves. Rising DPO is good
   from negotiated terms and bad from unprocessable invoices, and the data cannot
   tell them apart — colouring it asserts something we cannot defend. Keep the
   adjusted-DPO figure beside it.

4. Fill the remaining scalars using §7.14: touchless rate and SLA breach priors for
   all six entities, and trends on the three Group header KPIs — group score, value
   at risk and open exceptions — derived by aggregating entity trends with the
   sumTrends/meanTrend helpers you already built. Assert touchless rate orders with
   the operational dimension.

   Overdue AR, releasable cash and the Controls tile stay scalar — no priors exist
   and none should be invented.

Run all three gates.
```

**Check:** DPO renders grey in both directions. The Group header no longer shows
bare numbers.

---

## Step 4c — Dimension and count trends

You were right to refuse item 4 of Step 4b: neither figure was derivable, and
inventing priors would have broken rule 3. The priors now exist in the spec, and
supplying them turns out to be worth more than closing the gap in the header.

```
Read SPEC.md §7.15 and §7.16.

Task: add prior-period dimension scores and exception counts.

1. Add the §7.15 prior dimension scores for all six entities. Note JRP's prior
   period had only ONE veto active — the overdue GSTR-3B, cap 60. The unauthorised
   bank change was detected this period. So JRP's prior displayed score is 60 and
   its current is 55, while its raw score barely moved: 60.5 → 57.9.

2. Show a trend on each of the six DimensionBars, not just on the composite. Which
   dimension is deteriorating is a controllership question that a composite score
   hides.

3. The group score KPI now carries a trend: 77 → 76.

4. On JRP, make the cause of the drop explicit. A five-point fall that a weighted
   average would have shown as one point, because one control failure appeared —
   that is the veto rule visible as a trend rather than as a badge. The entity view
   should say so where the drop is shown.

5. Add the §7.16 prior counts, giving the open-exceptions KPI a trend: 2,012 → 1,980.

6. Assert two consistency properties: each dimension trend is directionally
   consistent with the metrics beneath it (JGL operational rising with touchless
   49 → 54 and close 74 → 78; JBL working capital falling with AP blocked
   10.4 → 11.3), and each count's direction matches its value counterpart.

Run all three gates.
```

**Check:** JRP shows −5 with the new veto named as the cause, and its raw score
moving only 60.5 → 57.9. That contrast is the demo beat.

---

## Step 5 — In-flight funnels and financial consequence

```
Read SPEC.md sections §8.1 and §8.2, and §7.4.

Task: two changes, both on the process and entity views.

A. Fix the funnel framing.
   The P2P and O2C stage cards currently read as a period funnel, which makes it
   look as though thousands of invoices vanished between stages. They are open
   work in progress, not period volumes.
   1. Change the section heading to "In flight at each stage".
   2. Add the caption "Open work in progress, not period volumes".
   3. Use the counts in SPEC.md §7.4.

B. Add a Financial consequence strip to the Entity health view, placed directly
   below the metric tiles. Four figures from SPEC.md §8.2: accrual exposure at
   close, revenue at risk, provision adequacy, FX and intercompany exposure. Each
   carries a one-line explanation of the consequence.

   Add the connecting statement as a callout above the strip:
       "₹18.6 cr blocked → ₹6.3 cr not accrued at Day 4 → COGS understated"
   Make each figure in that sentence a link: the first drills to the blocked
   invoice worklist, the second to the financial consequence strip.

Tag the strip "source: trial balance extract" per SPEC.md §8.7.
```

---

## Step 6 — Mode-aware header

```
Read SPEC.md section §8.5.

Task: the header always says "DAY 4 OF CLOSE", which is only true for six days a
month. Make the cockpit mode-aware.

1. Add a `mode` value to app state: 'close' | 'bau' | 'preclose'.
2. Add a small toggle in the header to switch mode. This is a demo control — label
   it as such.
3. The header text changes per mode, per the table in §8.5.
4. The top panel of the Entity health view foregrounds different content per mode:
   - close:    close status, blockers, exposure at close
   - bau:      exception clearance, cash opportunity, cause elimination progress
   - preclose: readiness — unposted goods receipts, unapplied cash, aged
               reconciliation breaks, open disputes
5. Default the app to `preclose`. It is the most valuable mode because it is
   preventive, and it is the one worth demonstrating.

All three modes use data already in the dataset. Do not add new figures.
```

**Check:** switching mode changes both the header and the entity top panel.

---

## Step 7 — Worklist actions, attribution and evidence

```
Read SPEC.md sections §8.9, §5 and §7.6.

Task: make the worklist a working tool rather than a report.

1. Add to every exception row: attribution ('provider' | 'client' | 'system' |
   'thirdParty') and control significance. Use the mapping in §7.6.
2. Add row actions: Assign, Chase, Release. Add multi-select with bulk versions of
   the same. Actions mutate local state and append a timestamped line to the item's
   evidence array.
3. Evidence trail: src/pages/ExceptionDetail.tsx already renders a lifecycle
   timeline. Extend that timeline with the evidence array, the attribution and the
   reason for it, rather than building a separate panel.
4. Default the sort to value, descending. Never default to count.
5. Add a "38 resolvable today" action that filters to the low-effort releasable
   set and offers a bulk release.
6. Fix the layout collision where the age column runs into the blocking reason
   column.

Do not change the visual style of the table. Use the existing DataTable component
and keep the filter/sort state in the URL query string as Worklist.tsx already
does. Files: src/pages/Worklist.tsx, src/pages/ExceptionDetail.tsx, and the api
layer only.
```

---

## Step 8 — Service and attribution screen

```
Read SPEC.md sections §4, §5 and §7.7.

Task: build a new screen, "Service & attribution".

1. Top: a horizontal stacked bar showing SLA breaches by origin, using the split
   in §5 (client 71%, provider 18%, system 7%, third party 4%). Label every
   segment. Merge any segment below 5% into the adjacent one rather than rendering
   an unreadable sliver.
2. Below it, the two-object panel required by §4: "Health score" and "Service
   scorecard" side by side, each with its definition. These are separate objects
   and must never be shown as a single merged number.
3. An SLA table from §7.7 using the DataTable component: SLA, target, achieved,
   breaches, attribution split. The mock layer already holds P2P and O2C
   "service & control" datasets in src/api/mock/misc.ts — extend those rather than
   creating a third parallel dataset.
4. Critically: SLAs marked 'needs-front-door' or 'needs-register' render greyed,
   with no fabricated value, and a tooltip explaining why they are not yet
   measurable (no clock start today, or requires manual register input). Do not
   invent achievement percentages for them. This honesty is a deliberate feature.
5. Add the screen: route table, nav item, breadcrumb builder and active-nav
   resolver in src/app/routes.tsx, under a SERVICE group; register it in
   CommandPalette; add its drill path to scripts/verify-drills.mjs.
6. Colours for the stacked bar: accent → ageingBarAlt → borderAccent →
   textFaintest. No new tokens.
```

**Check:** the unmeasurable SLAs are visibly greyed and carry no number.

---

## Step 9 — Risk and control screen

```
Read SPEC.md sections §7.8, §8.8, §10 and §1 ("What it is NOT").

Task: build a new screen, "Risk & control".

0. First, the one-token carry-over flagged in Step 3b. This screen is where
   red-on-tinted-background first appears in volume, so fix it before building on
   it: change light-theme statusRed from #D33C3C to #C22E2E. Light green is
   #14764F (5.62:1 on white) and light amber #A16207 (4.92:1), but red was left at
   4.69:1 — the outlier — and drops to 4.30 on bgRiskSoft, failing AA for small
   text. #C22E2E gives 5.64 on white and 5.17 on bgRiskSoft. Change the token, not
   the tint; dark theme is unaffected. Update the frozen tokens baseline and the
   contrast assertions, and remove the sizing caveat comment that is no longer
   needed.

1. Five categories as sections: Payment integrity, Authority integrity, System
   integrity, Cut-off integrity, Undisclosed exposure.
2. Populate from the control signals in §7.8, each showing title, detail,
   severity, value at risk, entity and detection date.
3. Header banner: "RESTRICTED — Financial Controller and above", with a demo-only
   access toggle. Per §8.8, this content must not appear on the counterparty or
   process cockpit screens.
4. A framing statement at the top of the screen: "Everything the auditor will
   find, ninety days earlier."
5. A "No duplication" note explaining that where a source system enforces a
   control, this platform monitors its effectiveness and bypass rather than
   re-running it — control of the control, not a second control.
6. Show control effectiveness metrics: override rate on duplicate and three-way
   match controls, and value prevented year to date. These monitor the AP
   automation tool's controls. Do NOT implement any duplicate checking here.

Add to the left rail under an ASSURE group.
Register the screen fully: route table, nav item, breadcrumb builder and
active-nav resolver in src/app/routes.tsx; CommandPalette result set; drill path
in scripts/verify-drills.mjs.
```

---

## Step 10 — Predictive screen

```
Read SPEC.md section §7.3 and §8.6.

Task: build a new screen, "Predictive".

1. Headline: DSO 62 today → 72 projected at month-end, for JGL.
2. Drivers table from §7.3, each with value and days impact.
3. Ranked actions table from §7.3, ordered by movement per unit of effort — not by
   size of improvement. Show owner, effort and days recovered.
4. Make the assumptions editable: each driver has a control to mark it resolved or
   to change its assumed settlement date. Changing an assumption recalculates the
   projection live. A forecast the controller can contest is a forecast he will
   use — this interaction is the point of the screen.
5. Add a reset control to return to the base case.
6. Add the DPO honesty flag from §8.6: DPO 48 days with a footnote "Includes
   ₹18.6 cr of blocked invoices; adjusted DPO 41 days."

Add to the left rail under a FORWARD group, next to Working capital.
Register the screen fully: route table, nav item, breadcrumb builder and
active-nav resolver in src/app/routes.tsx; CommandPalette result set; drill path
in scripts/verify-drills.mjs.
```

**Check:** marking Customer A's dispute resolved drops the projection by about
4.1 days.

---

## Step 11 — Counterparty pages

```
Read SPEC.md section §6 (Counterparty interface) and §8.8.

Task: build counterparty pages as first-class objects. Process views answer "how
is P2P performing"; the business asks "what is happening with this vendor". Only
the second deflects the phone call to the service desk.

1. Four page types: Vendor, Customer, Cost centre, Plant.
2. Vendor page: open commitments, blocked invoices, disputes, ageing buckets, last
   payment, YTD spend, current owner and reason for every open item.
3. Customer page: exposure, disputes and deductions, payment behaviour, credit
   block status and the release path.
4. Cost centre page: booked spend AND committed spend against budget, with the open
   purchase orders driving the gap. Committed spend is the part most tools miss and
   the part a controller trusts.
5. Plant page: goods receipt compliance, blocked value, exception concentration,
   ageing by cause.
6. These pages are reached by drill only — from the worklist, root cause and
   process screens. Add routes and breadcrumb entries in src/app/routes.tsx, but do
   NOT add nav items. Register counterparties in the CommandPalette result set so
   they are searchable, and add the drill paths to scripts/verify-drills.mjs.
7. Per §8.8, do not show restricted risk and control content on these pages.

Add data for at least 4 vendors, 4 customers, 3 cost centres and the 4 plants named
in §7.5 (Nanjangud, Roorkee, Ambernath, Noida).
```

---

## Step 12 — Compliance and data quality screens

```
Read SPEC.md sections §7.9 and §6 (ComplianceItem, DataQualityItem).

Task: build two new screens under an ASSURE group in the left rail.

A. Compliance
   1. A calendar-style list of statutory obligations with due date, status and
      value at risk: GSTR-1, GSTR-3B, GSTR-2B reconciliation with ITC at risk, TDS
      deposit, TDS return, MSMED 45-day ageing, e-invoice IRN failures.
   2. At least one overdue item on JRP — this is what drives its compliance score
      of 60 and, per §3.5, would trigger a veto cap.
   3. Show the link explicitly: overdue filing → compliance dimension → veto cap on
      the entity score. Make that chain clickable.

B. Data & MDM quality
   1. Checks grouped by domain: vendor master, customer master, GL, interfaces.
   2. Each check shows fail count over total, and the downstream impact — e.g.
      "Vendor master missing PAN: 14 of 812 — blocks e-invoice validation".
   3. Include interface health: failed IDocs, extract freshness, last successful
      run.
   4. Link data quality failures to the exceptions they cause, so a controller can
      see that master data is the root cause of a share of the P2P exception volume.

Register both screens fully: route table, nav item, breadcrumb builder and
active-nav resolver in src/app/routes.tsx; CommandPalette result set; drill paths
in scripts/verify-drills.mjs.
```

---

## Step 13 — The front door

```
Read SPEC.md section §6 (Request interface) and §7.7.

Task: build the request intake — the single front door. This is the highest-value
component in the whole prototype: it unlocks roughly eight committed SLAs that have
no reliable clock start today because requests arrive by email.

1. One intake for six request types: query, dispute, master data, fixed asset,
   price change, urgent payment.
2. Each request carries: raised by, raised on (this timestamp is the SLA clock
   start), category, owner, status, and a stop-clock counter for time spent
   awaiting the client.
3. A queue view with ageing, owner and SLA status.
4. A "new request" form — it only needs to write to local state.
5. On the Service & attribution screen (Step 8), the SLAs marked
   'needs-front-door' now become measurable. Change their state from greyed to
   live, computed from the request data. Add a note on the screen explaining that
   these became measurable because the front door provides a clock start.
6. Show a deflection counter: requests answered by self-service versus routed to
   the service team.

Seed with about 20 requests across the six types and four statuses.

Register the screen fully: route table, nav item, breadcrumb builder and
active-nav resolver in src/app/routes.tsx; CommandPalette result set; drill path
in scripts/verify-drills.mjs.
```

---

## Step 14 — Cause elimination backlog

```
Read SPEC.md section §7.5.

Task: build the cause elimination backlog. Every managed services provider promises
continuous improvement; almost none evidences it. This screen is the evidence.

1. A register of root causes with: cause, process, entity, value at risk,
   recurrence, owner, target date, and elimination status (identified /
   in-progress / eliminated).
2. Headline: 34 causes identified, 11 eliminated, 6 in progress, 17 not started.
3. A trend showing exception volume falling as causes are eliminated — this is the
   mechanism by which effort decouples from volume.
4. Link each cause back to the root cause screen and forward to the exceptions it
   generates.
5. Add to the left rail under an EXPLAIN group, next to Root cause.
Register the screen fully: route table, nav item, breadcrumb builder and
active-nav resolver in src/app/routes.tsx; CommandPalette result set; drill path
in scripts/verify-drills.mjs.
```

---

## Step 15 — Ask the Control Tower

```
Read SPEC.md sections §11 and §13.5.

Task: extend the existing assistant. Do NOT rebuild it.

src/features/assistant/ already contains AssistantDrawer.tsx (the 470px drawer with
message list, streaming bubble, follow-up chips, preset questions and free-text
input) and provider.ts (the AssistantProvider interface and MockAssistantProvider,
which streams canned answers in ~4-char chunks every 18ms). AssistantContext.ask()
already lets any screen open the drawer with a question.

1. Extend MockAssistantProvider behind the existing AssistantProvider interface.
   Do not change the interface. Do not change the drawer's UI contract. Do not
   integrate a real LLM.
2. Add answers for the six seed questions in §11. Compute them from the api layer
   at answer time rather than writing static strings, so they stay consistent with
   the dataset.
3. Add citations: every answer returns a list of source references — transaction
   ids, owners, service records — that the drawer renders as clickable chips
   drilling to the relevant screen. This will need a small additive extension to
   the message shape; keep it backward compatible with the existing follow-up chips.
4. Each answer offers 2 to 3 follow-up actions, using the existing chip mechanism.
5. If a question has no answer in the dataset, say so plainly. Never fabricate.
6. Add a footer line to the drawer: "Answers resolve to transactions, owners and
   service records. Nothing is asserted without a source."
7. Wire ask() from the new screens: the veto badge, the financial consequence
   strip, and the root cause view should each be able to pose their question to the
   drawer, the way "Ask why this entity is amber" already does on EntityHome.

Update tests/palette-assistant.test.tsx in this step.
```

**Check:** the existing preset questions still work, and citations drill correctly.

---

## Step 16 — Navigation, freshness and final QA

```
Read SPEC.md sections §9.1, §8.4, §8.7 and §10.

Task: final pass. Six things.

1. Reorganise the left rail into the labelled groups in §9.1: OVERVIEW, PROCESS,
   EXPLAIN, ASSURE, FORWARD, SERVICE. Counterparty pages stay drill-only.
2. Add a data freshness stamp to every screen header: source and timestamp, e.g.
   "SAP ECC · as of 06:00 IST". Where a screen mixes sources, list them.
3. Audit every displayed number for drill-through, per §8.4. Any number that
   cannot drill must show a "read-only · source: <system>" tag rather than being
   silently unclickable. Report any dead-end numbers you find.
4. Build the cross-process trace in §8.10: missing goods receipt in P2P → blocked
   invoice → understated accrual in R2R → close exposure. Make it a clickable
   chain from any of the four points.
5. Fix the remaining layout collisions: effort and owner columns merged on the
   working capital view; any column overlap introduced by the new fields.
6. Confirm npm test, npm run verify:theme and npm run verify:drills all pass, and
   that no component contains a literal hex value.

7. Extend the contrast SURFACES matrix in verify:theme to cover every screen built
   since Step 3b — the exemption entries that were speculative then are now real
   screens. Make the contrast report enforcing rather than informational, and make
   sure its walk reaches a capped entity (JRP), which it currently does not. Right
   now a single unit test is the only automated guard on the veto banner pairing.
8. Per SPEC.md §8.6.1, confirm every derived KPI exposes its definition on hover or
   click — value at risk, open exceptions, group score, each dimension score, and
   aggregated Group view rows. Definition text lives with the accessor, not the
   component. Report any figure that cannot answer "what is counted here".

9. Run a consistency check across every screen and report back:
   - does AP blocked show ₹18.6 cr for JGL everywhere it appears?
   - do the ageing buckets sum to the stated totals?
   - does every RAG colour have an accompanying text label?
   - is any cause displayed that is not in the §6.1 taxonomy?
   - does any screen still show a figure that is not in the dataset module?

Report the results of point 6 as a list. Do not fix anything outside this task's
scope without telling me first.
```

---

## Sequencing notes

**Minimum viable demo** — if time is short, Steps 0–8 plus Step 15 give you the
full narrative: correct entities, six dimensions with a defensible score,
attribution, actionable worklists, and the conversational panel. Everything after
Step 8 deepens it.

**Highest value per hour of build:** Step 3 (six dimensions and the veto rule),
Step 7 (actionable worklist), Step 13 (the front door), Step 15 (Ask the Control
Tower).

**Steps that can be reordered** — 9, 10, 11, 12, 14 are independent of each other.
Steps 1 through 8 must run in sequence. Step 13 must come after Step 8, because it
changes SLAs that Step 8 creates.

**If the model drifts** — symptoms are inventing numbers, adding libraries,
restyling components you did not ask about, or building close orchestration or MIS
features. Stop, `git checkout .`, re-paste the Session primer, and re-run the step.
