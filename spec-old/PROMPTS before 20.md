# Finance Control Tower — Build prompts

Sequential prompts for Claude Code. Each step is self-contained and small enough
for a local model. Work through them in order.

---

## Before you start

1. Copy the `spec-v2/` folder into the **root of the prototype repo**. Leave the
   existing `spec/` folder alone — it is the original build spec and the code still
   references it in comments. Keep `PROMPTS.md` outside it — you paste from it, the model never reads it.
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
You are working on a front-end demo prototype: the Finance Control Tower, a
controllership dashboard for a finance managed services pitch. React 18 + TypeScript
on Vite, react-router-dom 6, no CSS framework.

Read spec-v2/README.md and spec-v2/rules.md now. Read no other spec file until a task names
one — never read the whole spec.

Read PROGRESS.md — a bare checklist of what is done. Do NOT read PROGRESS-LOG.md; it
is an append-only archive and nothing needs it.

PROJECT-MAP.md holds the file inventory and design tokens. Read it ONLY if a task does
not name the files you need. Never re-inventory the codebase; the map is current.

Rules for every task:
1. Never invent numbers, colours, fonts, spacing or radii.
2. Never add a runtime dependency, and never use Math.random().
3. Never refactor outside the files a task names. Smallest change that works.
4. All data lives in src/api/ — extend types.ts and mock/*.ts, expose via index.ts.
   Components import from ../api only. No parallel data module.
5. All colour comes from src/theme/tokens.ts via colors.*; derivations live in
   derive.ts. No literal hex in components.
6. Adding a screen = routes.tsx (route, nav, breadcrumb, active-nav) + CommandPalette
   + verify-drills.mjs + verify-theme.mjs.
7. Never edit the spec/ files. If a task claims something is in the spec and it is
   not, say so and proceed.
8. If a task is ambiguous, ask before writing code.

Done means: npm test, npm run verify:theme, npm run verify:drills all pass, affected
tests updated in the same step. Report the result.

Then two file updates, in this order:
  PROGRESS.md      tick the step's box. Nothing else — it stays a bare checklist.
  PROGRESS-LOG.md  APPEND one entry: date, step, what changed in two or three
                   sentences, gate counts. Append without reading the file; nothing
                   above your line matters, and reading it wastes context.
Keep the log entry under 80 words. The full report goes in the chat, not the file.

Flag every judgment call you make. Acknowledge in one line, then wait.
```

---

## Step 0 — Only if starting from scratch

**Skip this if `PROJECT-MAP.md` and `PROGRESS.md` already exist.** They do, from the
original build — re-running the inventory reads every source file and will consume a
large share of your context window before any work begins. The primer already points
the model at both.

Run it only on a fresh repo with no map. It writes `PROJECT-MAP.md` (stack, file
inventory, exact design tokens) and `PROGRESS.md` (the step checklist), and modifies
no source file.

---

## Step 1 — Extend the data layer

```
Read spec-v2/model.md (§6), spec-v2/data-core.md (§7), spec-v2/rules.md (§13.1).

Task: extend the existing API layer with the new types and the canonical dataset.

Do NOT create a new data module. The project already has src/api/types.ts,
src/api/mock/*.ts and the accessor surface in src/api/index.ts. Work inside it.

1. Extend src/api/types.ts:
   - Add the Trend, Veto and SensitivityItem types from spec-v2/model.md §6.
   - Extend Entity: replace the five dimension scores with the six in §3.1, and add
     vetoes and sensitivity. Add o2cExceptionCount to the metrics.
   - Extend Exception: add attribution, evidence[], controlSignificance, status.
   - Extend CauseNode (keep this name, it is the existing root-cause type) with
     eliminationStatus, eliminationOwner, eliminationTargetDate.
   - Extend ProcessStage: split volume into inFlight / inFlightValue /
     inException / exceptionValue. Exception % is derived, never stored.

2. Update the mock datasets with the canonical figures in spec-v2/data-core.md §7:
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
had not defined; they are now in the spec.

```
Read spec-v2/data-core.md (§7.1 §7.10 §7.11 §7.12).

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
Read spec-v2/model.md (§2 §1.1).

Task: correct the legal entities and the product name.

1. Remove Jubilant Ingrevia and Jubilant Life Sciences NV as legal entities. They
   are not part of this group — Ingrevia was demerged into a separately listed
   company. Step 1 left three stale references: provider.ts line 28 (an assistant
   answer naming Ingrevia as an entity), README.md, and any entity row.

   IMPORTANT EXCEPTION: Ingrevia is a genuine related party. The cash opportunity
   "Clear intercompany netting with Ingrevia" in cashOpportunities is CORRECT and
   must be preserved. Removing it would be an error. Remove Ingrevia as a group
   entity; keep it as an intercompany counterparty.
2. Use exactly the six entities in spec-v2/model.md §2, with their codes, segments and
   geographies.
3. Rename the product to "Finance Control Tower" everywhere. Remove "Controller
   Cockpit" as a competing brand name. The sidebar wordmark becomes:
       Finance Control Tower
       JUBILANT PHARMOVA
   Individual screens may still be called cockpits (e.g. "P2P cockpit").
4. Add a toggle above the Group view table switching the grouping between
   Entity | Segment | Geography, using the values in spec-v2/model.md §2. Aggregated rows
   use the same columns; scores aggregate as the mean of member entities, money
   columns as the sum.

   Do NOT offer a Plant grouping. Plant data does not exist yet and JPS has no
   manufacturing site; plant views arrive in Step 11 from exception-level data.

5. Reconcile the narratives Step 1b flagged: store the approval-pending
   concentration (7 approvers, 64% of that cause's ₹3.3 cr) as a byGroup split so
   the sentence derives from data rather than being deleted. Per spec-v2/data-core.md §7.12, no
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
Read spec-v2/data-core.md (§7.12 §7.13).

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
Read spec-v2/model.md (§3), spec-v2/rules.md (§10).

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
   movement applied and that veto deactivated. Use the movements in spec-v2/data-core.md §7.10.
   Update the headroom test to assert currentDimensionScore + movement <= 100, per
   item and cumulatively per dimension.

6. Add a "What moves this score" panel on the Entity health view. Each row reads:
       "Clear GR compliance on 11 vendors    74 → 81    Low effort"

7. Handle the capped case properly — read spec-v2/data-core.md §7.10.1 before building this.
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
Read spec-v2/rules.md (§10).

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
Read spec-v2/ui.md (§8.3), spec-v2/data-core.md (§7.2).

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
spec-v2/data-core.md §7.14, along with DSO and DPO for the five entities that did not have them.
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
Read spec-v2/data-core.md (§7.14), spec-v2/ui.md (§8.5.1).

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
Read spec-v2/data-core.md (§7.15 §7.16).

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
Read spec-v2/ui.md (§8.1 §8.2), spec-v2/data-core.md (§7.4).

Task: two changes, both on the process and entity views.

A. Fix the funnel framing.
   The P2P and O2C stage cards currently read as a period funnel, which makes it
   look as though thousands of invoices vanished between stages. They are open
   work in progress, not period volumes.
   1. Change the section heading to "In flight at each stage".
   2. Add the caption "Open work in progress, not period volumes".
   3. Use the counts in spec-v2/data-core.md §7.4.

B. Add a Financial consequence strip to the Entity health view, placed directly
   below the metric tiles. Four figures from spec-v2/ui.md §8.2: accrual exposure at
   close, revenue at risk, provision adequacy, FX and intercompany exposure. Each
   carries a one-line explanation of the consequence.

   Add the connecting statement as a callout above the strip:
       "₹18.6 cr blocked → ₹6.3 cr not accrued at Day 4 → COGS understated"
   Make each figure in that sentence a link: the first drills to the blocked
   invoice worklist, the second to the financial consequence strip.

Tag the strip "source: trial balance extract" per spec-v2/ui.md §8.7.
```

---

## Step 5b — Complete the consequence strip

```
Read spec-v2/ui.md (§8.2).

Task: extend the financial consequence strip to all six entities and wire its drills.

1. §8.2 now pins all four figures for all six entities. Add them. Assert two
   properties: provision adequacy orders with the risk dimension (JCP highest, JRP
   lowest), and JGL's accrual exposure equals 34% of its blocked AP — the missing-GR
   share from §7.5. That second tie is the strip's logic: no goods receipt means no
   accrual, which is why the exposure is ₹6.3 cr and not the full ₹18.6 cr. Make the
   relationship visible in the figure's explanation line.

2. Wire the drill targets in §8.2. Accrual exposure goes to the blocked invoice
   worklist filtered to the goods-receipt cause; revenue at risk to the O2C cockpit
   collection stage; FX and intercompany to the working capital view's intercompany
   netting row. Provision adequacy has no target — tag it
   "read-only · source: trial balance extract" per §8.4 rather than leaving it
   silently unclickable.

3. Add the new drill paths to scripts/verify-drills.mjs.

Run all three gates.
```

**Check:** every entity shows a populated strip, and three of the four figures drill.

---

## Step 6 — Mode-aware header

```
Read spec-v2/ui.md (§8.5).

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

## Step 6b — Per-entity mode panels

```
Read spec-v2/data-detail.md (§7.18), spec-v2/ui.md (§8.2 §8.5).

Task: four corrections, three of them from your own Step 6 flags.

1. Reconcile a number that does not tie. §8.2 said accrual exposure ₹6.3 cr and
   §7.5 says the missing-GR cause is ₹6.4 cr, and both mean the same thing — the
   missing-GR portion of blocked AP. It is now ₹6.4 cr everywhere: at 6.3 the six
   cause shares round to 101%. Change JGL's accrualExposure to 6.4 and change the
   Step 5b assertion to test equality against the missing-GR cause value directly,
   not against a rounded 34%.

2. Make the connecting sentence mode-aware per §8.2. "Not accrued at Day 4" is wrong
   for three weeks a month, and the app now defaults to preclose. The pre-close
   wording is the strongest of the three because it is preventive and still
   actionable. Do the same for the Group view's "Close progress — day 4" eyebrow.

3. Replace the three group-level figures in the mode panel with the per-entity
   values in §7.18: unposted goods receipts, cause elimination, and cash
   opportunity. An entity screen showing the same number for all six entities
   undercuts the one thing that screen is for. Unposted GR is the same quantity as
   accrual exposure — use that field, do not store it twice.

4. Assert that per-entity cause elimination sums to the group figures: 11
   eliminated, 6 in progress, 17 not started, 34 identified.

Run all three gates.
```

**Check:** navigate JGL → JRP in preclose mode. Every figure in the panel should
change, and JRP's unposted GR should read ₹5.7 cr across 14 vendors, 6th month.

---

## Step 7 — Worklist actions, attribution and evidence

```
Read spec-v2/ui.md (§8.9), spec-v2/model.md (§5), spec-v2/data-core.md (§7.6), spec-v2/data-detail.md (§7.17).

Task: make the worklist a working tool rather than a report.

0a. One-line carry-over from Step 6b: the Group view eyebrow is currently binary, so
   bau shows "Pre-close readiness — 3 days to close" on a screen that is eighteen
   days from close. Give it three labels per spec-v2/ui.md §8.2 — close: "Close progress —
   day 4", bau: "Close readiness", preclose: "Pre-close readiness — 3 days to close".
   The countdown belongs only where it is true.

0b. Seed exceptions for the other five entities per §7.17. All twelve current
   rows are JGL's, so the accrual-exposure drill you wired in Step 5b lands on an
   empty list for five of six entities — which reads as a broken product rather than
   an honest absence. Generate 12 rows per entity deterministically against the
   §7.17 constraints; assert the value sums, the age ceilings, and that every entity
   has at least three goods-receipt rows so the filtered drill is never empty.

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

## Step 7b — Effort, sample framing and the demo clock

Three corrections from the Step 7 flags. The first is a contradiction with §7.3.

```
Read spec-v2/data-detail.md (§7.19 §7.20 §7.21 §7.17).

Task: four fixes on the worklist and its data.

1. Effort is a property of the item, not the cause. The Step 7 mapping put
   missing-gr at High, but §7.3 says "release invoices where GR posted this week —
   38 items — Low effort" for that same cause. The result is that the "38 resolvable
   today" chip filters to a set that can never contain them. Add blockerCleared to
   the exception and derive effort from cause plus that flag, per the §7.19 table.
   The 38 resolvable items are exactly those with blockerCleared true. Seed enough
   cleared rows per entity that the filter lands on a populated list.

2. Show sample against pool, per §7.20. The worklist header reads "12 of 327 shown ·
   ₹12.77 cr of ₹18.6 cr · 4 of 38 resolvable in this view". Keep the bulk button on
   the visible set — "Release all 4" is what it will actually do — and let the header
   explain why 4 and not 38.

3. Make the demo clock relative, per §7.21. Seeded evidence is anchored to a fixed
   date while ages are day counts, so three months from now an item marked "oldest 52
   days" will show evidence dated last August. Derive every seeded timestamp as
   today − ageDays. Keep it deterministic within a day so tests do not flake.

4. Pin the owner names and add the Singapore vendor pool from §7.17, replacing the
   invented owners and JPS's reuse of the India list. A Singapore holding entity
   buying from Indian chemical vendors is the kind of detail a client notices.

Also update §7.17's JGL shown value to 12.77 in your assertions — the spec now says
12.77 rather than 12.8, matching the pinned literals.

Run all three gates.
```

**Check:** clicking "38 resolvable today" lands on a populated list, and the header
explains the difference between 4 and 38.

---

## Step 7c — Rename the flag, and what follows from it

Your Step 7b flag 5 is right, but the fix is not in the drill — it is in what the
flag means.

```
Read spec-v2/data-detail.md (§7.19 §7.20).

Task: three corrections.

1. Rename blockerCleared to resolvableToday and change its meaning: the clearing
   action is available and quick, NOT that the receipt is already posted. The
   original wording is prospective — "₹4.2 cr release available BY CLEARING GR
   compliance on 11 vendors".

   This is what resolves your flag 5. Under blockerCleared, a cleared missing-GR row
   is no longer unposted, so accrual exposure would have to net ₹4.2 cr off ₹6.4 cr
   — breaking the tie to the missing-GR cause value that Step 6b established. Under
   resolvableToday nothing has posted yet: accrual exposure stays ₹6.4 cr, the
   accrual drill correctly lists every missing-GR row, and the 38 are quick wins
   within missing-GR rather than outside it.

   Update the effort table to the eight situations in §7.19, which now covers the
   untabulated causes you had to infer.

2. Add per-entity resolvable counts and values from §7.19, so the chip carries a
   number on all six entities rather than only JGL.

3. Restore the ">30 days ₹8.99 cr" segment to the worklist header — §7.20 now shows
   four segments. It was in the original prototype and it earns its place: value
   alone does not tell a controller whether the pool is stale.

Run all three gates.
```

**Check:** accrual exposure still reads ₹6.4 cr and still equals the missing-GR
cause value. If it moved, the flag is still being read as "already posted".

---

## Step 8 — Service and attribution screen

```
Read spec-v2/model.md (§4 §5), spec-v2/data-core.md (§7.7), spec-v2/data-detail.md (§7.18).

Task: build a new screen, "Service & attribution".

0. One-line carry-over from Step 7c: the "3 systemic" span on EntityHome is the last
   hardcoded JGL figure rendering on all six entity pages. It needs no new data —
   systemic means causes identified with no structural fix underway, which is
   causeBacklog().notStarted from §7.18: JGL 3, JBL 4, JPS 2, JCP 1, JHS 2, JRP 5.
   Wire it to the accessor.

   Worth keeping the pairing intact on screen — "38 resolvable today · 3 systemic"
   is the distinction between clearing exceptions and eliminating causes, which is
   the whole managed-services argument in five words.

1. Top: a horizontal stacked bar showing SLA breaches by origin, using the split
   in §5 (client 71%, provider 18%, system 7%, third party 4%). Label every
   segment. Merge any segment below 5% into the adjacent one rather than rendering
   an unreadable sliver — so third party at 4% renders inside the system segment,
   giving three segments reading 71 / 18 / 11 with the last labelled
   "system & third party".

   The merge is a RENDER decision only. §7.11 stores four attribution counts and
   they stay four — collapsing the stored data would break the tie between the
   group total and the per-entity rows.
2. Below it, the two-object panel required by §4: "Health score" and "Service
   scorecard" side by side, each with its definition. These are separate objects
   and must never be shown as a single merged number.
3. An SLA table from §7.7 using the DataTable component: SLA, target, achieved,
   breaches, attribution split. The mock layer already holds P2P and O2C
   "service & control" datasets in src/api/mock/misc.ts — extend those rather than
   creating a third parallel dataset.
4. Critically: SLAs marked 'needs-service-desk' or 'needs-register' render greyed,
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

## Step 8b — Gross vs net, and per-entity service data

Both from your Step 8 flags. The first changes the most important number on the
screen.

```
Read spec-v2/model.md (§4), spec-v2/data-detail.md (§7.22).

Task: two corrections.

1. serviceScorecard() computes gross achievement, not the scorecard. §4 defines the
   scorecard as performance NET of client-caused and third-party delay — the mean of
   five achievement percentages is the gross figure. For JGL: gross 95.2%, net 98.6%.

   Compute net per SLA, then average:
       net = 100 − (100 − achieved) × (providerBreaches / totalBreaches)

   Show BOTH, side by side. Never net alone — that reads as excuse-making. The
   3.4-point gap is the attribution argument made concrete: "we met 95.2% against
   the contract; 98.6% of what we control", with the evidence trail behind the
   difference. Label them unambiguously.

2. Make the screen genuinely per-entity, per §7.22. Right now the bar is group-level
   while the screen sits at entity level, and the SLA table is JGL's data on all six
   pages — the same defect corrected in Steps 6b, 7c and 8 item 0.

   - The bar shows the entity's own split with the group split beneath it as
     comparison: "JGL 72 / 19 / 6 / 3 · group 71 / 18 / 7 / 4". Which entities are
     worse than the group is the first question a controller asks.
   - Generate per-entity SLA rows against the §7.22 constraints: JGL's pinned rows
     unchanged, per-SLA breaches summing to the entity total, per-SLA attribution
     summing to the entity's attribution counts, and the gross mean matching the
     table. Assert all four.
   - The five unmeasurable SLAs stay unmeasurable on every entity — they have no
     clock start anywhere, not only at JGL.

Run all three gates.
```

**Check:** JGL shows 95.2% gross and 98.6% net. JCP's bar reads 67 / 33 on three
breaches — small numbers, but its own.

---

## Step 9 — Risk and control screen

```
Read spec-v2/data-core.md (§7.8), spec-v2/ui.md (§8.8), spec-v2/rules.md (§10), spec-v2/model.md (§1).

Task: build a new screen, "Risk & control".

0a. One-line carry-over from Step 8b, on the Service screen: your flag 3 was right —
   the formula nets out client, system AND third-party delay, which is broader than
   the prose said. The prose was wrong, not the formula. §4 now reads "net of delay
   the provider does not control", and the on-screen label must name the exclusion
   set exactly: "Net of client, system and third-party delay". A scorecard that
   carries service credits and does not say what it excludes is a dispute waiting to
   happen. Add a short note that the exclusion set is a contract term — whether an
   interface failure stops the clock depends on who operates the interface, and the
   two readings differ by 0.6 points.

0b. Then, the one-token carry-over flagged in Step 3b. This screen is where
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
Read spec-v2/data-core.md (§7.3 §7.8.1), spec-v2/ui.md (§8.6), spec-v2/data-detail.md (§7.21).

Task: build a new screen, "Predictive".

0. Three small carry-overs from Step 9 first:

   a. Control signal detection dates are fixed Jul/Aug 2026 literals. §7.21 now
      covers every seeded date in the product, not just exception evidence — derive
      them as today − N days, same as the worklist. Audit for any other date
      literals while you are there.

   b. Pin the control effectiveness figures from §7.8.1 rather than leaving them as
      deterministic choices: 41/2 and 67/5 triggers-to-overrides, ₹23.4 cr prevented
      year to date. The prevented figure carries into the benefits case, so it must
      not move between regenerations.

   c. Suppress the exclusion-set delta note where it reads "differ by 0 points"
      (JPS, JCP, JHS have no system-attributed delay). A difference of zero is not a
      caveat, and printing it invites a question with nothing behind it.

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

## Step 10b — Forecasts for the other five entities

```
Read spec-v2/data-detail.md (§7.23).

Task: make the Predictive screen work for every entity.

1. Add the §7.23 forecasts for the five entities without one. JRP is the entity a
   controller would most want a forecast for — worst working capital, worst DSO,
   capped score — and "predict, then rank the action" should work wherever it is
   clicked. Generate against the constraints: JGL's pinned drivers and actions
   unchanged, day impacts summing exactly to the deterioration, driver values around
   1.5× (AR over 90 + cash unapplied), base settlements after month-end.

2. Assert that deterioration orders inversely with the working capital dimension —
   JRP +12 at the worst, JCP +3 at the best. A forecast saying the healthiest entity
   is deteriorating fastest would contradict the score beside it.

3. Rename the drivers to real customers from the §7.23 pools, geography-matched.
   Step 11 builds customer pages and a driver reading "Customer A" cannot drill to
   one — pick names now so the two steps agree.

4. Move the route to per-entity scope, or add an entity selector, so navigating to
   JRP shows JRP's forecast rather than JGL's.

5. Replace the verify-drills "first matching row" selector with a stable driver id
   or test id. Row order is a rendering detail; an assertion resting on it will fail
   silently the first time a sort changes.

Run all four gates.
```

**Check:** JRP reads 74 → 86 with its own named customers, and resolving its largest
driver moves the projection live.

---

## Step 11 — Counterparty pages

```
Read spec-v2/model.md (§6), spec-v2/data-detail.md (§7.24), spec-v2/ui.md (§8.8).

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

8. Everything must reconcile, per §7.24. Counterparty pages are the first place a
   controller can add figures up and check them against a total, and a vendor page
   that disagrees with the entity view makes every number in the product suspect.
   Assert all four ties:

       Σ vendor blocked      = worklist shown value      (JGL ₹12.77 cr)
       Σ plant blocked       = worklist shown value      (JGL ₹12.77 cr)
       Σ cost centre committed = PO stage in-flight      (JGL ₹58.4 cr)
       Σ customer exposure   ≥ AR over 90 days           (JGL ≥ ₹12.4 cr)

9. Derive rather than duplicate. Vendors come from the §7.17 exception rows; plants
   from the §7.17 site list, with JGL's distribution matching §7.5's missing-GR plant
   split (Nanjangud 43%, Roorkee 29%, Ambernath 18%, Noida 10%); customers are the
   ones already named in the §7.23 forecast drivers, so a driver drills to a page
   that exists.

   Cost centres are the only genuinely new dataset — use the §7.24 list. Committed
   spend is the point of that page: open purchase orders not yet invoiced are what a
   controller cannot see in most tools, and what makes remaining budget real.
```

---

## Step 11b — Per-entity stages, and the plant tie

Your flag 2 traced a real defect back further than the cost centres.

```
Read spec-v2/data-detail.md (§7.25 §7.24).

Task: two corrections.

1. stages.ts holds one dataset, so the P2P and O2C cockpits have been rendering
   JGL's figures on every entity since Step 5 — and that is why every entity's cost
   centres sum to JGL's ₹58.4 cr. Add per-entity stages per §7.25: scale the §7.4
   tables, then override the pinned tie points so each cockpit agrees with its own
   entity metrics. Assert all six tie points for all six entities. Exception
   percentages stay derived.

2. The plant tie was wrong in the spec, and your flag 1 is the symptom. Two fixes:

   a. Plants tie to the POOL, not the sample: Σ plant blocked = entity blocked AP
      (JGL ₹18.6 cr), not the ₹12.77 cr shown value. Vendors are sample-derived so
      they correctly tie to the sample; plants are a fixed complete set — every one
      of the 327 blocked invoices sits at a plant — so a plant page showing only its
      share of twelve rows understates what a plant manager is accountable for.

   b. §7.5's 43/29/18/10 is the plant split WITHIN the missing-GR cause, not of all
      blocked value. Applying it to the whole pool conflates two cuts. Use the
      per-entity overall plant shares in §7.24, which now cover all six entities.

   The partial-sample footnote you added stays — it is still the right disclosure
   where a page shows pool figures against a sampled worklist.

Run all four gates.
```

**Check:** JBL's P2P cockpit shows its own PO in-flight of ₹35.5 cr, and its cost
centres sum to that rather than to ₹58.4 cr.

---

## Step 12 — Compliance and data quality screens

```
Read spec-v2/data-detail.md (§7.26 §7.27 §7.28), spec-v2/model.md (§6).

Task: build two new screens under an ASSURE group in the left rail.

0. First, a jurisdiction error to correct. JRP's overdue return was specified as
   GSTR-3B — an Indian GST return, on a US/Canada radiopharmacy entity. It is a
   GST/HST return filed with the Canada Revenue Agency. Update the veto reason, the
   sensitivity item, the cascade text and every test that names it. Obligations must
   match the entity's jurisdiction throughout, per §7.26.

0b. Also from Step 11b: give JRP and JBL at least one over-budget cost centre each,
   per §7.28. Only JGL Nanjangud currently overruns, which leaves the worst entity
   in the group showing every cost centre comfortably within budget. Drive the
   overrun with committed spend rather than booked — the budget looks fine until you
   count the open purchase orders, which is the argument that page exists to make.

A. Compliance
   1. A calendar-style list of statutory obligations with due date, status and value
      at risk, drawn from §7.26 — jurisdiction-matched per entity, with the
      jurisdiction visible on each row. Multi-jurisdiction coverage is a selling
      point for this group; one undifferentiated list throws it away.
   2. JRP is the ONLY entity with an overdue item. Every other entity's compliance
      dimension is 88 or above, and an overdue filing would cap those at 60 under
      §3.5 — an overdue row anywhere else contradicts the score beside it.
   3. Show the link explicitly: overdue filing → compliance dimension → veto cap on
      the entity score. Make that chain clickable.

B. Data & MDM quality
   1. Checks grouped by domain: vendor master, customer master, GL, interfaces.
   2. Each check shows fail count over total, and the downstream impact — e.g.
      "Vendor master missing PAN: 14 of 812 — blocks e-invoice validation".
   3. Include interface health: failed IDocs, extract freshness, last successful
      run.
   4. Link data quality failures to the exceptions they cause. The vendor-master
      cause is 11% of JGL's blocked AP (§7.5, ₹2.0 cr) — master data quality showing
      up as working capital. That link is the point of having this screen.
   5. Fail rates must order inversely with the data quality dimension (§7.27): JCP
      cleanest at 94, JRP worst at 74. Assert it.

Register both screens fully: route table, nav item, breadcrumb builder and
active-nav resolver in src/app/routes.tsx; CommandPalette result set; drill paths
in scripts/verify-drills.mjs.
```

---

## Step 13 — The Finance Service Desk

```
Read spec-v2/model.md (§6), spec-v2/data-detail.md (§7.29 §7.26), spec-v2/data-core.md (§7.7).

Task: build the request intake — the Finance Service Desk.

0. Two jurisdiction corrections carried over from Step 12 first:
   a. JHS geography in §2 is now "US / Canada", matching its Spokane and Montreal
      sites. Update entities.ts; your flag 4 was right that the dataset and §7.26
      disagreed — §2 was the wrong one.
   b. E-invoice IRN failures are India-only. IRN is the Invoice Reference Number
      issued under Indian e-invoicing, so JRP cannot have them — same error class as
      GSTR-3B, one table over. §7.26 now assigns JRP 21 Form 1099 TIN mismatches
      instead, with JCP 9 and JHS 6. This is the highest-value
component in the whole prototype: it unlocks roughly eight committed SLAs that have
no reliable clock start today because requests arrive by email.

1. One intake for six request types: query, dispute, master data, fixed asset,
   price change, urgent payment.
2. Each request carries: raised by, raised on (this timestamp is the SLA clock
   start), category, owner, status, and a stop-clock counter for time spent
   awaiting the client.
3. A queue view with ageing, owner and SLA status.
4. A "new request" form — it only needs to write to local state.
5. On the Service & attribution screen, the three 'needs-service-desk' SLAs become
   measurable — but handle the transition per §7.29, which matters more than it
   looks. §7.11 pins each entity's breach total and the group split of 71/18/7/4 is
   computed from them; if three more SLAs start contributing breaches, the split
   moves.

   So they leave the greyed state and show live current-period-to-date figures —
   open requests, ageing, resolution times, stop-clock hours — but they do NOT yet
   report an achievement percentage and do NOT enter the breach totals or the
   attribution split. Each carries "measuring since <date> · first full-period
   report from <next period>".

   You cannot report full-period performance on something you began measuring
   mid-period. Saying so is a stronger demo beat than a fabricated percentage: the
   Finance Service Desk delivers measurement immediately and is honest about what it cannot
   yet support, which is the argument for building it.

   The two 'needs-register' SLAs stay greyed. A service desk does not give you audit
   findings or a QC sample.
6. Show a deflection counter: requests answered by self-service versus routed to
   the service team.

Seed 8-12 requests per entity per §7.29: all six types, all four statuses,
raisedOn derived from today per §7.21, and clockStoppedHours accruing only while
awaiting-client — that is §5's attribution logic applied to requests, and it is what
makes the stop-clock defensible rather than contested. Volume should track each
entity's exception volume.

Register the screen fully: route table, nav item, breadcrumb builder and
active-nav resolver in src/app/routes.tsx; CommandPalette result set; drill path
in scripts/verify-drills.mjs.
```

---

## Step 14 — Cause elimination backlog

```
Read spec-v2/data-core.md (§7.5), spec-v2/data-detail.md (§7.30 §7.29).

Task: build the cause elimination backlog.

0. Two carry-overs from Step 13:
   a. Request owners become named people from the §7.17 pool for that entity, not
      "Service desk". §8.9 and the root-cause model both insist on a named owner for
      every open item, and an anonymous queue is the accountability gap the platform
      exists to close. It matters most on our own side of the attribution line — we
      cannot ask the client to name who is holding a goods receipt while our queue is
      owned by a department.
   b. Pin the deflection figure at 34 self-served of 92 contacts, 37%. It carries
      into the Step 16 operating-model argument alongside the ₹23.4 cr prevented, and
      a quotable number must not move between regenerations. Every managed services provider promises
continuous improvement; almost none evidences it. This screen is the evidence.

1. A register of root causes with: cause, process, entity, value at risk,
   recurrence, owner, target date, and elimination status (identified /
   in-progress / eliminated). Owners are named people per §7.30; target dates are
   relative per §7.21. In-progress causes carry a date, identified-but-not-started
   ones do not — a blank is more honest than an invented commitment.
2. Headline: 34 causes identified, 11 eliminated, 6 in progress, 17 not started.
3. A trend showing exception volume falling as causes are eliminated. Use the
   cumulative elimination series in §7.30 and ASSERT the relationship, not just
   display both lines: as eliminations rise, group open exceptions fall across the
   same six points. This is the one screen whose entire purpose is to evidence that
   mechanism, so an unasserted chart is claiming something the data may not support.

3b. Guard the overclaim, per §7.30. Eliminating a cause reduces the RATE at which new
   exceptions arrive; it does not clear the existing pool. Say which one the screen
   is showing. "Volume fell 32 because we eliminated two causes" is not supportable;
   "the two causes eliminated this period generated 47 exceptions last period and
   none in this one" is.
4. Link each cause back to the root cause screen and forward to the exceptions it
   generates. P2P rows go to the filtered worklist. O2C rows have no item-level
   target — the worklist holds blocked invoices only — so send them to the O2C
   cockpit's collection stage anchor and state the limitation on screen:
   "item-level detail available for P2P; O2C drills to process level". An honest
   boundary beats a link that goes nowhere, and beats a fabricated item list more
   still.
5. Add to the left rail under an EXPLAIN group, next to Root cause.
Register the screen fully: route table, nav item, breadcrumb builder and
active-nav resolver in src/app/routes.tsx; CommandPalette result set; drill path
in scripts/verify-drills.mjs.
```

---

## Step 15 — Ask the Control Tower

```
Read spec-v2/ui.md (§11), spec-v2/rules.md (§13.5).

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
Read spec-v2/ui.md (§9.1 §8.4 §8.7), spec-v2/rules.md (§10).

Task: final pass. Twelve things.

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
6. Wire the GroupView CAPPED badge to ask(), matching EntityHome. The Group view is
   the first screen anyone sees and that badge is the first sight of the veto
   mechanic — it should be able to explain itself where it appears.

7. Mode coverage. Modes arrived in Step 6 and eight screens have been built since.
   Walk all three modes across every screen and report anything that renders a
   close-window figure or a "Day 4" string outside the close window. This is the
   defect the mode work existed to remove, and it reappears with every new screen.

8. Refresh PROJECT-MAP.md. It was written at Step 0 and the codebase has roughly
   doubled — a future session reading it would be working from a stale map. Same for
   README where it describes screens or data shapes.

9. Confirm npm test, npm run verify:theme and npm run verify:drills all pass, and
   that no component contains a literal hex value.

10. Extend the contrast SURFACES matrix in verify:theme to cover every screen built
   since Step 3b — the exemption entries that were speculative then are now real
   screens. Make the contrast report enforcing rather than informational, and make
   sure its walk reaches a capped entity (JRP), which it currently does not. Right
   now a single unit test is the only automated guard on the veto banner pairing.
11. Per spec-v2/ui.md §8.6.1, confirm every derived KPI exposes its definition on hover or
   click — value at risk, open exceptions, group score, each dimension score, and
   aggregated Group view rows. Definition text lives with the accessor, not the
   component. Report any figure that cannot answer "what is counted here".

12. Run a consistency check across every screen and report back:
   - does AP blocked show ₹18.6 cr for JGL everywhere it appears?
   - do the ageing buckets sum to the stated totals?
   - does every RAG colour have an accompanying text label?
   - is any cause displayed that is not in the §6.1 taxonomy?
   - does any screen still show a figure that is not in the dataset module?

Report the results of point 12 as a list. Do not fix anything outside this task's
scope without telling me first.
```

---

## Step 16b — Close out the consistency findings

Your item-12 check found real defects. Fix them before the demo script; a walkthrough
that contradicts itself is worse than one that stops short.

```
Read spec-v2/data-detail.md (§7.31), spec-v2/data-core.md (§7.13).

Task: six fixes.

1. Ageing buckets go per entity, per §7.31. Right now JBL's P2P cockpit shows an
   invoice stage of ₹4.1 cr beside a chart summing ₹18.6 cr. Assert both ties for
   every entity: receivables buckets 4–5 sum to arOver90, and all five sum to total
   open AR from §7.25. That is the arithmetic a chartered accountant does unprompted.

2. Correct the oldest-age figures, per §7.13. Three were impossible and they are mine,
   not yours:
   - apBlockedOldestDays conflated the sample's oldest row with the pool's. JGL's 52
     was the oldest of twelve sampled rows, but the pool of 327 carries a >90 day
     bucket — impossible if nothing exceeds 52. Pool oldest values are now
     118/142/76/34/51/168, and §7.17's constraint is relaxed: no sample row exceeds
     the pool oldest, but the oldest row need not equal it.
   - JCP and JHS held receivables over 90 days with an oldest receivable of 61 and 78
     days. Corrected to 98 and 104; every arOver90OldestDays now exceeds 90.

3. Remove the five hardcoded JGL figures you inventoried:
   - WorkingCapital.tsx:67 and CommandPalette.tsx:45 — releasable ₹4.2 cr, which makes
     JBL's working capital screen contradict its own entity home (₹2.6 cr).
   - CommandPalette.tsx:44 — '327 items' in a per-entity palette entry.
   - EntityHome.tsx:127–132 — oldest days, '18 items', '12 JEs'. The '18 items' one
     contradicts the panel on the same screen, which already reads m.reconAgedBreaks.
   - '27 tickets' — §7.31 now pins queriesOverdue per entity: 27/34/11/4/8/41.

4. Give the TopBar entity StatusDot an adjacent score or status word. §10 says colour
   must never be the only carrier of meaning, and that dot is currently the one place
   it is.

5. Reconcile 'Approval delays' in recurringCauses with 'Approval pending' in causes.ts.
   One cause, one name — §6.1's taxonomy is fixed precisely so the same thing reads the
   same everywhere.

6. Rename the rail label to "Finance Service Desk" per §9.1. The abbreviation saves
   four characters and loses the word that tells a plant manager what it is for.

Leave the "drillable but not linked" items from your inventory as they are — a route
exists for each and the current targets are defensible.

Run all four gates.
```

**Check:** JBL's P2P cockpit chart sums to ₹11.3 cr, and its working capital screen
shows ₹2.6 cr releasable rather than ₹4.2 cr.

---

## Step 17 — The demo script

The build is done. This step produces the thing you actually walk through in orals,
and proves every beat of it still works.

```
Task: verify the demo path end to end and write it down.

Walk these eleven beats in the running app. For each, confirm the screen renders,
the figures are as stated, and the click lands where it should. Then write DEMO.md
in the repo root recording the click path, the exact figures at each beat, and the
one line that beat is making.

  1  Group view, pre-close mode. Six entities, six named dimensions, group score 76.
     JRP red at 55 with a CAPPED badge.
  2  Click the CAPPED badge. Score fell 60 → 55; raw score barely moved, 60.5 → 57.9;
     an unauthorised bank change was detected this period.
  3  Ask the Control Tower: "why is this entity capped?" The highlight answer, with
     drillable citations.
  4  JGL entity health. Top issue reads AP blocked ₹18.6 cr, oldest 118 days.
     Financial consequence strip: ₹18.6 cr blocked → ₹6.4 cr will not accrue in
     3 days unless goods receipts are posted.
  5  Drill the accrual figure. Blocked worklist filtered to goods receipt: 12 of 327
     shown, ₹12.77 cr of ₹18.6 cr, >30 days ₹8.99 cr, 4 of 38 resolvable. The oldest
     row in the sample is 52 days; 118 is the pool's oldest — say which is which if
     asked, because it is the same sample-versus-pool distinction the header makes.
  6  Root cause. Missing GR, 34%, 8.4 day average lag, 5th consecutive month, 11
     vendors, two plants at 72%.
  7  Cause elimination. 34 identified, 11 eliminated; the mechanism chart with the
     rate-not-pool caveat.
  8  Service & attribution. 71 / 18 / 11 stacked bar; gross 95.2% against net 98.6%;
     the greyed SLAs that are not yet measurable.
  9  Predictive. DSO 62 → 72. Resolve the largest driver live; watch it fall to 67.9.
 10  Risk & control. Restricted banner, five integrity categories, "everything the
     auditor will find, ninety days earlier".
 11  Finance Service Desk. Eight SLAs given a clock start; 37% deflection.

Report any beat where the figure on screen differs from the figure above — that is a
regression, not a script error, and I need to know which.

Then add a short "if they ask" section to DEMO.md covering the five questions most
likely to come back: why the group score is an unweighted mean; what "open exceptions"
counts; why some SLAs have no percentage; why DPO has no colour; and why accrual
exposure is ₹6.4 cr rather than ₹18.6 cr.

Add a sixth: why the worklist shows twelve rows against a pool of 327, and why the
oldest sample row is 52 days while the entity reads 118. Sample versus pool runs
through the whole product and it is the most likely question from anyone who starts
adding figures up.
```

**Check:** every figure in DEMO.md matches the screen. If any beat fails, fix the
regression rather than the script.



---

## Step 17b — Filtered denominators, and script corrections

Your three findings were all the script being wrong rather than the app — except one,
which turned out to be a real defect the script surfaced.

```
Read spec-v2/data-detail.md (§7.20).

Task: one code fix, then correct DEMO.md.

1. Filtered worklist denominators must follow the filter. Today the goods-receipt
   filter reads "4 of 327 shown · ₹5.47 cr of ₹18.6 cr", which implies four of 327
   goods-receipt items — wrong by a factor of three. It should read "4 of 111 shown ·
   ₹5.47 cr of ₹6.4 cr", using that cause's own pool from the §7.20 table.

   This also ties the worklist directly to the cause table, which is a reconciliation
   worth having. Assert two properties: cause pool counts sum to apBlockedCount, and
   for every cause the sampled rows sum to no more than that cause's value at risk.

2. Correct DEMO.md beats 5, 8 and 11 — the app is right in all three:

   Beat 5: after fix 1, the filtered view reads "4 of 111 shown · ₹5.47 cr of ₹6.4 cr
   · 1 of 38 resolvable". My script quoted the unfiltered header by mistake. Note in
   the beat that ₹5.47 cr of ₹6.4 cr in four rows is correct because the sample is
   value-ranked — the largest items show first.

   Beat 8: the bar renders JGL's own split merged — 72 / 19 / 9 — with the group
   beneath as "JGL 72 / 19 / 6 / 3 · group 71 / 18 / 7 / 4". My script quoted the
   group's merged form. The screen is right per §7.22: an entity page shows the
   entity's split with the group as comparison.

   Beat 11: "eight SLAs given a clock start" is the pitch phrase, not a rendered
   figure. Record what actually appears — "The clock starts here.", the RAISED ON /
   AGE / STOPPED H columns, and the three desk SLAs measuring to date — and keep the
   eight as the spoken line, noting it is five already-measurable plus three newly so.

Run all four gates.
```

**Check:** the goods-receipt filter reads 4 of 111 against ₹6.4 cr, and DEMO.md
matches every screen.


---

# Phase 2 — Agentic exception handling

Steps 18 to 22. Same rules, same primer, same gates. Read spec-v2/agents.md §15 before Step 18
and keep it in mind throughout — particularly §15.1, which sets the honesty boundary.

---

## Step 18 — The agent workforce

```
Read spec-v2/agents.md (§15.1 §15.2 §15.5).

Task: the agent data model and the roster screen.

1. Add Agent, Delegation, AgentMetrics and AgentAction to src/api/types.ts, and a new
   src/api/mock/agents.ts with all EIGHTEEN roles in §15.2. Agent gains a
   status: 'live' | 'designed' — nine are live in this prototype, nine are specified
   but not built, and every card states which. The honesty is what makes the coverage
   credible; a catalogue claiming eighteen working agents reads as vapour. Each carries a scope, a
   delegation of authority, a named human supervisor from the §7.17 pool for that
   entity, and a status.

2. Build /agents — ONE screen carrying both the workforce and its performance, per
   §15.5.1. An agent's identity and its performance are the same object; a roster
   screen plus a separate monitoring screen would be two views of one thing.

   Three layers, matching the product's existing group → entity → detail grammar:
   workforce summary, the coverage strip, then the agent list grouped Shared / P2P /
   O2C with preventive before reactive. Sortable by escalation and override rate —
   that is how a mis-set delegation gets found.

   Each agent shown as staff, not as a feature: name, scope, what it may do, what
   bounds it, who supervises it, whether its actions are reversible. Live agents also
   show actions, resolved share, escalation rate, override rate and a trend. Designed
   agents show the delegation they WOULD hold, greyed, with dashes where metrics would
   be — the same honest-absence pattern as the unmeasurable SLAs in §7.7.

2a. Clicking an agent opens its record: full delegation, named supervisor, its own
   action log, performance over time.

2b. Group them REACTIVE and PREVENTIVE per §15.2.1, within Shared / P2P / O2C. Seven
   of eighteen are preventive and that ratio is worth showing — a workforce that is
   entirely reactive has automated firefighting.

2c. Build the lifecycle coverage strip from §15.2.0 at the top of the roster: seven P2P
   and seven O2C stages with agents positioned where they act, preventive and reactive
   coloured differently. This is the element that shows the workforce was designed
   rather than assembled — a client reads coverage and gaps in three seconds, where
   eighteen cards read as a list.

2d. Mark the four advisory-only agents (4, 5, 13, 14) as changing nothing, and state
   that payment proposal never releases a run. Of everything in the catalogue that is
   the boundary a controller looks for first. Name R2R as the next process to cover
   rather than showing it empty — a gap you have named is a gap you have thought
   about.

3. Render §15.8 — what must never be automated — prominently on this screen, not in a
   footnote. Stating the boundary unprompted is more persuasive than the capability
   list, and this is a regulated pharma group with US exposure.

4. Every agent surface carries "simulated · demonstrates the operating model, not a
   live agent" per §15.1. The prototype has no backend and no LLM. Overstating
   autonomy loses this client faster than underclaiming.

5. Register it: routes ×4 under a new AGENTS rail group, CommandPalette,
   verify-drills, verify-theme.

Run all four gates.
```

---

## Step 18b — Take the rationale off the screen

The spec argues for its own decisions because it is written for whoever builds it.
None of that argumentation is UI copy, and the spec never said so — my omission, not
yours. It has now been added as §10.1.

```
Read spec-v2/rules.md (§10.1).

Task: remove rationale from every screen. No data or logic changes.

1. Fix the /agents screen using the §10.1 replacement table. In particular:
   - the intro line about honesty and credibility — delete it; the summary reads
     "18 roles · 9 active"
   - "THE BOUNDARY A CONTROLLER LOOKS FOR FIRST" becomes "AUTHORITY LIMITS"
   - "seven P2P and seven O2C stages · agents positioned where they act" — delete; the
     strip already shows it
   - "Next process to cover — R2R … named, not built" becomes "Record to report — not
     yet covered"
   - the simulated tag reads "Simulated data"
   - agent status reads "Active" / "Not active"

2. Then audit every other screen for the same class of leak, because this is not
   confined to /agents. Known cases:
   - Risk & control h1 is "Everything the auditor will find, ninety days earlier" — a
     pitch line, not a screen title. It becomes "Risk & control".
   - The "no duplication" explanation on the same screen explains a design choice.
     Delete it or reduce it to what the product enforces.

   Report every instance you find, with the replacement you used.

3. Apply the second test in §10.1, which cuts further: does the interface already
   demonstrate this? If it does, saying it is redundant, and a caption asserting good
   behaviour is weaker than the behaviour.

   So the whole "authority limits" panel goes. "Payment proposal prepares the run;
   release requires a human" is shown by the worklist routing a payment exception to a
   human — it does not need a sentence. Move the same information onto each agent's
   record as a delegation field: "Authority: proposes only", "Authority: advisory".
   That is reference data a user looks up, not a claim made at them.

   Same for the four advisory agents: delete the sentence, put "Authority: advisory" on
   their four records.

3b. What this does NOT strip: a number cannot describe itself. "Open work in progress",
   "12 of 327 shown", "read-only · source: close tracker" all stay. Disambiguating a
   figure is different from captioning behaviour the interface already performs.

4. Apply the test to anything you write from here: would this label exist in a product
   a company had paid for? Labels are what a finance user would call the thing — short,
   flat, unpersuasive.

Run all four gates. Tests asserting on the old strings will need updating; that is
expected.
```

**Check:** read every screen header and eyebrow aloud. Anything that sounds like it is
explaining the design to a buyer rather than labelling a thing for a user is still a
leak.

---

## Step 18c — Restore the descriptive titles

Step 18b was mostly right, and it went one step too far: it flattened headings that
described their screen rather than argued for it. §10.1 has been refined — the rule
targets rationale and assertion, not description.

```
Read spec-v2/rules.md (§10.1).

Task: restore four headings, keep the rest flat. No other changes.

1. Restore these h1s — each says what the screen shows or answers, which is product
   copy, not a pitch:

     Root cause (P2P)        Why blocked invoices keep recurring
     Root cause (O2C)        Why receivables keep ageing
     Working capital         Cash locked in exceptions
     Service & attribution   Where the delays come from
     O2C cockpit             Revenue to cash, as one flow

2. Leave flat: Risk & control, Finance Service Desk, Cause elimination, Compliance,
   Data quality, Agents, and the P2P cockpit. Those headings argued or sold rather
   than described, and "Procure to pay" is the honest title once "not seven separate
   reports" is gone.

3. The test to apply, and to keep applying: DESCRIBE or PERSUADE. A heading may be
   interesting; it may not be an argument.

     describes  "Cash locked in exceptions" · "Why blocked invoices keep recurring"
     persuades  "not seven separate reports" · "ninety days earlier" · "evidenced"

Update the drill and unit assertions that Step 18b changed. Run all four gates.
```

**Check:** the product should read as though a designer wrote it, not as though the nav
labels were pasted into the headings.

---

## Step 18d — Eyebrows, and a sweep for tests that pass by accident

```
Task: one consistency fix, then a test-quality sweep.

1. Restore the eyebrows Step 18b deleted on Working capital and Service & attribution.
   The pattern across the product is eyebrow = canonical name, h1 = description —
   "WORKING CAPITAL" above "Cash locked in exceptions". Root cause and both cockpits
   kept theirs, so those two screens now orient the user less than every other screen
   with a descriptive title. Screens whose h1 IS the canonical name (Risk & control,
   Compliance, Agents and the rest) correctly have no eyebrow; leave them.

2. Then the sweep, which matters more. Two dead assertions surfaced in the last two
   steps — a sort-order check matching nothing, and getByText(/working capital/i)
   passing by matching the flat h1 instead of the eyebrow it was written for. Both were
   found by accident, when a string changed. A test that passes for the wrong reason is
   worse than no test: it reports coverage that does not exist.

   Go through the suite for the same shape:
   - loose regex or getByText that could match more than one element on the page —
     assert on a scoped container or a test id instead
   - assertions whose target no longer exists, still passing off something else
   - checks that would pass against an empty or default render

   For each, either tighten it so it targets what it claims, or delete it and say so.
   Report every one you find and what you did.

3. Do not add new coverage in this step. The point is to make the existing 359 mean
   what they say.

Run all four gates.
```

**Check:** the report should name specific assertions. "Swept, none found" across 359
tests after two turned up by accident in two steps is a result worth questioning.

---

## Step 19 — The agent lane

```
Read spec-v2/agents.md (§15.5 §15.7).

Task: put agent activity where the work already is, rather than on a separate screen.

0. One-line carry-over from Step 18d: Agents.tsx has the pattern inverted — eyebrow
   "Agent workforce" above h1 "Agents" puts the canonical name in the h1 and the
   description in the eyebrow, backwards from every other screen. Swap them: eyebrow
   "AGENTS", h1 "The agent workforce".

1. Seed AgentActions against the existing exceptions — every entity, spread across the
   seven agents, outcomes weighted to the §15.4 agent-resolvable shares by cause.
   Timestamps relative per §7.21. Every action cites precedents and evidence.

2. Agents have already run when the page opens — read §15.1.1 before building this.
   There is NO run button on a row. A button per row is a touch added, not removed, and
   it frames this as an assistant the controller drives rather than a workforce that
   works.

   - Header leads with the agents' output: "327 in pool · agents cleared 241 · 86 need
     you", plus "agents last ran 06:42 · next cycle 07:00".
   - Agent lane per row with four states: "agent working" with the next escalation
     timer, "escalated to you" with the reason, "agent resolved" with a why link, and
     "never automated" for items inside §15.8 — vendor bank detail changes being the
     one to make sure appears. Showing the boundary in the flow of work is what makes
     the rest credible.
   - DEFAULT FILTER is "needs you". Agent-handled items are one click away, not the
     default view.
   - One screen-level demo control, "run the next cycle", explicitly labelled as such.
     Press it, watch 86 fall to 79 with the lane updating.

3. Exception detail carries the decision record, structured per §15.1.2: trigger,
   checks with threshold and actual value, precedents, delegation, action, DECLINED,
   reversibility. Every check and precedent opens.

   Do not animate the agent reasoning its way to an answer. A reasoning animation says
   "look how clever"; a list of tests with values and openable sources says "here is
   why, verify it yourself" — and that is what survives an audit sample.

   The `declined` line matters more than the action line. "I posted an accrual rather
   than a Service Entry Sheet because an SES would assert the service was delivered" is
   the most reassuring sentence on the screen for a finance audience.

   Two controls: "step through this decision", revealing one check at a time for demo
   purposes, and "override", which is the human's exit and feeds the override rate in
   §15.6.

4. Root cause gains agent-resolvable share per cause (§15.4), so it is visible which
   causes are worth automating versus eliminating.

Run all four gates.
```

---

## Step 20 — Touch economics

```
Read spec-v2/agents.md (§15.3 §15.4).

Task: build /touch-economics — the screen the commercial conversation runs on.

0. Three carry-overs from Step 19 first:

   a. A drill from a financial figure should show what is behind that figure. Entering
      the worklist from the rail correctly defaults to "needs you", but clicking ₹6.4 cr
      of accrual exposure and landing on 2 of 111 shows a fraction of what was clicked.
      Drills that originate from a figure set their own filter to match it; the
      needs-you default applies to navigation, not to figure drills.

   b. The header word "cleared" is wrong. There is no write-back — a disposition is not
      a release, which is why blocked AP stays ₹18.6 cr while agents have worked 241
      items. Use "resolved" or "dispositioned": 327 blocked · 241 resolved by agents ·
      86 need you. A client will ask why the blocked figure did not move, and the answer
      is that the platform records the decision and SAP executes it — the wording should
      not contradict that.

   c. Vary the escalation timers. Every working lane reading "escalates in 6 h" is the
      one detail on that screen that reads as generated. Derive each from the item's own
      age so they differ.

1. The funnel per entity from §15.4: touchless, manual, agent-resolved, human. JGL
   reads 54 / 46 / 32.2 / 13.8 and 460 touches per thousand falling to 138.

2. Show the two levers separately, per §15.3, because they compound and they have
   different costs. JGL: touchless 54% today, 62% after cause elimination, 89%
   effective after agents work the residue. Roughly a third of the reduction comes
   from exceptions never arising — that is the durable part, and the reason the
   productivity glide path holds over three years rather than being a one-off step.

3. Headline the touch rate, not the automation percentage. "95% touchless" is a claim
   the client tests on day one and you defend for three years; a falling touch rate
   measured on the platform is the same economics and it is yours to prove.

4. Assert that agent-resolved plus human equals manual for every entity, and that the
   per-cause resolvable shares reconcile to the entity total.

Run all four gates.
```

---

## Step 21 — Control of the agent

```
Read spec-v2/agents.md (§15.6), spec-v2/data-core.md (§7.8.1).

Task: extend control-of-the-control to your own agents.

1. Add the governance slice to Risk & control — not a separate screen, and NOT a copy
   of the Agents screen. Per §15.6 there are two questions with two audiences: the
   Agents screen answers "how is the workforce performing", this answers "are they
   safely bounded, and can we evidence it".

2. So this carries only what needs attention: delegation breaches, reversals,
   overrides, and value acted on without human review. That last one is the figure an
   auditor asks for first. Volume and resolution rates stay on the Agents screen —
   they are performance, not exposure. Each row drills into the agent's record.

3. Interpret the rates on screen rather than just displaying them. A rising override
   or reversal rate means a delegation is set wrong. A rising escalation rate means
   the policy needs updating, not that the agent is failing.

4. Add a per-agent drill from the roster into that agent's own record.

Run all four gates.
```

---

## Step 22 — One exception, end to end

```
Read spec-v2/agents.md (§15.2).

Task: the demo beat. A single exception resolved without a human, watchable.

Build a walkthrough on the exception detail screen — stepped, not animated — for a
missing-GR exception in the pre-close window:

  1  Exception raised. Goods receipt not posted. Cause captured at source.
  2  Follow-up agent chases plant stores. Nudge 1, logged.
  3  No response at 48 hours. Escalates to the plant controller, logged.
  4  Still open, and the pre-close window opens.
  5  Provisioning agent tests the case: recurring service, existing PO, price within
     tolerance, prior-period delivery pattern, value below cap.
  6  It posts a REVERSING ACCRUAL, not a Service Entry Sheet — the accounting outcome
     at close is the same and nothing irreversible happens (§15.2).
  7  Logged with rationale, precedents and evidence. Flagged agent-posted for audit
     sampling. Accrual exposure falls.
  8  Human sees it only in the supervision record.

Then a second, shorter path for O2C: a credit block caused by an uncleared invoice not
yet due — a policy defect rather than a credit judgment — released by the agent with
the policy cited. Show what it would NOT release: a customer over its limit, escalated
instead.

Add both to DEMO.md as beats 12 and 13. The third scenario is Step 23's.

Run all four gates.
```

---

## Step 23 — The preventive agent

The other eight agents work exceptions that already exist. This one acts so the
exception never arises, which is the durable lever (§15.3) and the harder thing to
demonstrate.

```
Read spec-v2/agents.md (§15.2.1 §15.1.2).

Task: the commitments agent, its watch screen, and the exchange it has with a human.

1. Commitments watch on the P2P cockpit's PO stage: open POs by delivery date, chase
   state, amendments made, and value at risk of slipping the period. JGL has 386 open
   POs worth ₹58.4 cr (§7.4) — the same pool the cost centre pages reconcile to.

2. A PO detail page with a timeline, reusing the exception-detail grammar. This is
   where the exchange renders, and the invoice detail view cannot host it because at
   this point there is no invoice — that is the whole value of the agent.

3. The exchange, on a PO with delivery due in nine days:
     a  Agent notes the approaching date, messages the PO owner, asks them to flag any
        slippage.
     b  Owner replies in plain language: it is being pushed to next month.
     c  Agent shows WHAT IT UNDERSTOOD — the reply quoted, the extracted new date, and
        its confidence in that reading.
     d  Above threshold, it amends the delivery date. Date only — never value, quantity
        or vendor. The owner is notified of exactly what changed, so a wrong reading is
        caught by the person who wrote the reply.
     e  Commitment data, accrual estimate and close exposure update.

4. Then the failure path, which matters as much: an ambiguous reply ("might slip,
   checking with the vendor"). Below the confidence threshold the agent PROPOSES an
   amendment and escalates rather than acting. This is the only agent that interprets
   natural language and then changes a procurement document — a misreading must be as
   visible as a correct reading.

5. State the claim precisely, per §15.2.1. Do not write "prevents blocked invoices" —
   amending a PO date does not stop a vendor invoicing early, and that claim will be
   tested. Write that it keeps commitment data true: committed spend, accrual planning
   and close exposure all depend on delivery dates being accurate, and a stale date
   silently corrupts the ₹6.4 cr accrual estimate.

6. Add to DEMO.md as beat 14, with the failure path as 14b.

Register: routes ×4, CommandPalette, verify-drills, verify-theme.

Run all four gates.
```

**Check:** the PO timeline shows the reply quoted and the extracted date separately. If
it only shows the amendment, the misreading case has nowhere to surface.

---

## Sequencing notes — phase 2


Steps 18 and 19 are the minimum: the roster establishes agents as governable staff, and
the agent lane shows them working where the work already is. Step 20 is what the
commercial conversation needs. Step 22 is what people remember.

Step 23 is the differentiated one. Eight reactive agents demonstrate efficiency; the
preventive agent demonstrates that you understand where exceptions come from. If the
pitch has room for one agent story, it is that one.

Step 21 is the one to resist cutting under time pressure. An agent capability with no
supervision record is exactly what a controller in a USFDA-regulated group will refuse,
and it is cheap to build because the metrics already exist in the action log.

---

## Sequencing notes

**Minimum viable demo** — if time is short, Steps 0–8 plus Step 15 give you the
full narrative: correct entities, six dimensions with a defensible score,
attribution, actionable worklists, and the conversational panel. Everything after
Step 8 deepens it.

**Highest value per hour of build:** Step 3 (six dimensions and the veto rule),
Step 7 (actionable worklist), Step 13 (the Finance Service Desk), Step 15 (Ask the Control
Tower).

**Steps that can be reordered** — 9, 10, 11, 12, 14 are independent of each other.
Steps 1 through 8 must run in sequence. Step 13 must come after Step 8, because it
changes SLAs that Step 8 creates.

**If the model drifts** — symptoms are inventing numbers, adding libraries,
restyling components you did not ask about, or building close orchestration or MIS
features. Stop, `git checkout .`, re-paste the Session primer, and re-run the step.

---

## Appendix — Splitting the progress file

One-time housekeeping. `PROGRESS.md` grew to roughly 26,000 tokens because the detail
was written into the checklist entries themselves — one runs to 1,292 words — and the
primer loads it every session. That is more context than the spec and the primer
combined.

```
Task: split the progress file. No source changes.

1. Rewrite PROGRESS.md as a bare checklist. One line per step: the box, the step
   number, and its short name. Nothing else. It should come to well under 1,000 tokens.

       - [x] Step 12 — compliance and data quality screens
       - [x] Step 13 — Finance Service Desk

2. Move everything you strip into PROGRESS-LOG.md, one entry per step, oldest first.
   Trim each to two or three sentences plus gate counts — the current entries run to
   1,292 words and nothing reads them.

3. From now on: tick the box in PROGRESS.md, and APPEND to PROGRESS-LOG.md without
   reading it. Appending needs no knowledge of what is above.

4. Report the token size of both files afterwards.
```

**Check:** `PROGRESS.md` under 1,000 tokens. If it is still thousands, the detail is
still inside the checklist entries.

---

## Appendix — Visual capture with Playwright

Run this whenever, independently of the numbered steps. It does three things the
existing CDP scripts cannot: produce reviewable screenshots, catch layout damage by
pixel diff, and do both without port management or timing flake.

```
Task: add Playwright capture alongside the existing verify scripts. Do NOT migrate
verify-drills.mjs or verify-theme.mjs — they pass, they encode real knowledge, and
rewriting 500 checks buys no new coverage.

1. Add @playwright/test as a dev dependency. This is the one authorised dependency
   addition.

2. Write scripts/capture.mjs. It starts the dev server, walks every route in both
   themes, and writes full-page PNGs to captures/<theme>/<route>.png. Take the route
   list from verify-theme.mjs so the two stay in step — one list, not two.

3. FREEZE THE CLOCK. §7.21 derives every seeded date from today − ageDays, so
   captures taken on different days differ and every diff becomes noise. Pin the
   date before the app loads:

       await page.addInitScript(() => {
         const FIXED = new Date('2026-09-15T06:00:00+05:30').getTime();
         const RealDate = Date;
         globalThis.Date = class extends RealDate {
           constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(FIXED); }
           static now() { return FIXED; }
         };
       });

   Verify it works: capture twice on different days and confirm the PNGs are identical.
   If they are not, something is still reading the wall clock.

4. Cover the states a single pass misses: all three cockpit modes on the entity view
   (close, bau, preclose — the mode toggle is in the TopBar), the worklist filtered and
   unfiltered, a capped entity (JRP) and a healthy one (JCP), and the assistant drawer
   open. Those are the states most likely to break and least likely to be visited.

5. Add npm run capture. Then add npm run capture:check — a second script that diffs
   against captures/baseline/ and fails on a pixel delta above a small threshold. Commit
   the baseline. Regenerate it deliberately, never automatically.

6. Use real selectors, never coordinates. Playwright auto-waits for actionability,
   which is exactly the class of failure that produced three separate incidents in this
   build: reserved ports, a click landing on stale layout after the page grew, and a
   dropped Ctrl+K.

Run all four gates plus the new capture.
```

**Check:** run `npm run capture` twice on different days. Identical PNGs means the clock
freeze holds; anything else means a component is still reading the wall clock, and the
baseline is worthless until it is fixed.

