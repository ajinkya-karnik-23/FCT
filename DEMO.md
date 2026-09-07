# DEMO.md — the fourteen-beat walk

Run `npm run dev` and open http://localhost:5200. The app opens on the Group view in
pre-close mode (the default), so beat 1 needs no toggle. Every figure below was verified
on screen in a live walk of the running app; figures that differ from the original script
are reported at the end, not silently corrected here.

Note on dates: per §7.21 the demo clock is relative — seeded timestamps derive from today,
so ageing figures and the service-desk window line are deterministic within a single day.
The values recorded here were verified on 01 Sep 2026.

---

## Beat 1 — Group view, pre-close mode

**Click path:** open http://localhost:5200/ — no clicks; pre-close is the default mode.

**Figures (verified):** h1 "Finance health across six legal entities". Header KPIs:
GROUP SCORE **76** (−1) · VALUE AT RISK **₹100.4 cr** (−1.2%) · OPEN EXCEPTIONS **1,980** (−32).
Six entity rows, each with the six named dimensions (Operational · Service & attribution ·
Risk & control · Working capital · Data & MDM quality · Compliance):

| Entity | Score | Band |
|---|---|---|
| Jubilant Generics Ltd | 74 | AMBER |
| Jubilant Biosys Ltd | 67 | AMBER |
| Jubilant Pharma Ltd | 81 | AMBER |
| Jubilant Cadista Pharmaceuticals Inc | 91 | GREEN |
| Jubilant HollisterStier LLC | 88 | GREEN |
| Jubilant Radiopharma | **55** | RED — badge "CAPPED — unauthorised vendor bank change, unresolved" + "Ask why it is capped" button |

Pre-close card: PRE-CLOSE READINESS — 3 DAYS TO CLOSE · 71% of 214 tasks complete ·
19 overdue · 6 blockers · 3 entities at risk.

**The line:** the group is healthy on average (76), but one entity is red and capped — a
control event, not performance.

## Beat 2 — Click the CAPPED badge

**Click path:** click "CAPPED — unauthorised vendor bank change, unresolved" in the
Jubilant Radiopharma row. The reveal renders inside the row.

**Figures (verified):** raw score **57.9**; active vetoes:
"unauthorised vendor bank change, unresolved — cap 55 · binding" and
"GST/HST return overdue — cap 60". Displayed score fell **60 → 55** while the raw score
moved only **60.5 → 57.9**; the unauthorised bank change was detected this period (the
binding cap is new; last period's binding cap was the GST/HST return).

**The line:** the fall is a control event, not a performance slide — and clicking the badge
says so instead of making you find it.

## Beat 3 — Ask the Control Tower: "why is this entity capped?"

**Click path:** still on the Group view, click "Ask why it is capped" in the JRP row. The
drawer opens pinned to Jubilant Radiopharma and streams the answer.

**Figures (verified):** user bubble "Why is this entity capped?"; streamed answer:
"Jubilant Radiopharma fell from 60 to 55. The cap 'unauthorised vendor bank change,
unresolved' (55) now binds the score — it was detected this period, and the raw score moved
only 60.5 → 57.9, so the fall is a control event, not a performance slide." + "Until that
cap is lifted, no other action moves the number: 'Resolve the unauthorised vendor bank
change' alone takes it to 58." + "A second active cap — GST/HST return overdue (60) — is
not binding while this one holds."

Drillable citations under Sources: the control signal → Risk & control · "Score history ·
60 → 55" → entity page · "What moves this score" → entity page. Follow-ups: 'What lifts it
fastest?' / 'Show the control signal' / 'Open the worklist'.

**The line:** the assistant explains with drillable citations, not a canned paragraph —
every sentence resolves to a screen.

## Beat 4 — JGL entity health

**Click path:** click the Jubilant Generics Ltd row (or open /entity/JGL).

**Figures (verified):** header "74 /100 · +2 vs last period · AMBER". Top issue:
AP blocked > 30 days — **₹18.6 cr**, oldest **118 d**, owner Entity controller. AP BLOCKED
stat: ₹18.6 cr (−15.8%), "327 invoices · oldest 118 d". Consequence callout:
"₹18.6 cr blocked → **₹6.4 cr will not accrue in 3 days unless goods receipts are posted**
→ COGS understated". Financial consequence strip: Accrual exposure at close **₹6.4 cr**
("34% of blocked AP — no goods receipt means no accrual") · Revenue at risk ₹8.7 cr ·
Provision adequacy 92% · FX / intercompany exposure ₹3.6 cr. Pre-close readiness: Unposted
goods receipts ₹6.4 cr, "11 vendors · 5th consecutive month".

**The line:** the top issue is a number with a financial consequence attached — blocked AP
becomes an accrual miss at close.

## Beat 5 — Drill the accrual figure

**Click path:** click **₹6.4 cr** in the Financial consequence strip → lands on
/entity/JGL/p2p/invoices?cause=missing-gr (the blocked worklist filtered to goods receipt).

**Figures (verified):** filtered header "4 of 111 shown · ₹5.47 cr of ₹6.4 cr · >30 days
₹5.00 cr · 1 of 38 resolvable in this view" — the denominators follow the filter (§7.20):
the pool is the cause's own 111 invoices / ₹6.4 cr, not the entity-wide 327 / ₹18.6 cr.
Four rows carrying most of the cause value is correct because the sample is value-ranked —
largest items show first; the remaining 107 are small. Rows include AP-104402 Kaveri
Solvents Ltd, ₹1.28 cr, **52 d** — the oldest row in the sample (the pool's oldest is
118 d on the entity page). The unfiltered JGL worklist header reads "12 of 327 shown ·
₹12.77 cr of ₹18.6 cr · >30 days ₹8.99 cr · 4 of 38 resolvable in this view".

**The line:** every headline figure drills into a worklist of real rows, and the header
states both sample and pool so nothing looks contradictory.

## Beat 6 — Root cause

**Click path:** /entity/JGL/root-cause/p2p/missing-gr (from the root-cause link on the
worklist or an exception detail).

**Figures (verified):** Missing GR = **34%** of JGL's blocked AP. Stat strip: VALUE AT RISK
₹6.4 cr · AVG DELAY **8.4 days** · RECURRENCE **5th consecutive month** · CONCENTRATION
**11 vendors**. By plant: Nanjangud 43% + Roorkee 29% — the two plants at **72%** of
affected value. By vendor group: Consignment chemicals 38%. Narrative: "Invoices at
Nanjangud and Roorkee remain blocked because goods receipts are posted after invoice receipt;
the two plants account for 72% of affected value. Eleven vendors drive the pattern, led by
consignment chemicals at 38%; average GR lag is 8.4 days and it has repeated for five
consecutive months."

**The line:** the cause is concentrated — a handful of vendor/plant pairs, not diffuse noise.

## Beat 7 — Cause elimination

**Click path:** /cause-backlog (rail → EXPLAIN → Cause elimination).

**Figures (verified):** stat strip IDENTIFIED **34** · ELIMINATED **11** · IN PROGRESS 6 ·
NOT STARTED 17. Mechanism chart: causes eliminated cumulative over six periods [3, 5, 6, 8,
9, 11] against group open exceptions falling 2,158 → 1,980 across the same six points;
caveat "Eliminating a cause reduces the rate at which new exceptions arrive; it does not
clear the existing pool."

**The line:** causes are being eliminated month over month — the rate is improving even
though the pool remains.

## Beat 8 — Service & attribution

**Click path:** /entity/JGL/service (rail → PROCESS, or from the entity navigation).

**Figures (verified):** SLA BREACHES BY ORIGIN — JGL · 32 breaches; the bar renders JGL's
own split merged to three categories — client **23 · 72%** / provider **6 · 19%** / system
& third party **3 · 9%** — with the group beneath as comparison in the unmerged four-number
form, footnote "JGL 72 / 19 / 6 / 3 · group 71 / 18 / 7 / 4" (§7.22: an entity page shows
the entity's split; the group is the comparison). SERVICE SCORECARD: Gross achievement
**95.2%** · Net of client, system and third-party delay **98.6%**. SLA table: five measurable SLAs with achieved % and attribution split (e.g.
Invoice processing TAT, 3 business days, 93.1%, 22 breaches — client 18 · provider 3 ·
system 1); three desk SLAs "measuring since 27 Aug 2026 · first full-period report from
OCT-2026" with live to-date lines; two greyed (Invoice processing accuracy, target 99.5% ·
Audit findings, Zero high severity) — achieved / breaches / split all "—".

**The line:** most of the delay is client-caused, and both readings are shown because
service credits attach to one of them only. (The script's "71 / 18 / 11" was the group's
merged form; the screen shows JGL's own split — see the discrepancy report.)

## Beat 9 — Predictive

**Click path:** /entity/JGL/predictive (rail → FORWARD). Base h1: "DSO 62 today → 72
projected at month-end". Click **MARK RESOLVED** on the largest driver row (Amrit
Distributors — pricing dispute, ₹9.4 cr, +4.1 days) and watch the headline move live; the
row flips to RESOLVED with an UNDO control.

**Figures (verified):** h1 becomes "DSO 62 today → **67.9** projected at month-end".
Remaining drivers open at month-end: Sanjeevani Healthcare ₹6.2 cr +2.7 · Deccan Pharma
Retail ₹4.8 cr +2.1 · Cash awaiting application ₹3.1 cr +1.1. DPO TODAY (no colour): 48
days, +6.7% — "Includes ₹18.6 cr of blocked invoices; adjusted DPO 41 days."

**The line:** the projection is live — resolving a driver moves the number in front of you.

## Beat 10 — Risk & control

**Click path:** /risk-control (rail → ASSURE).

**Figures (verified):** h1 "Risk & control". Banner
RESTRICTED — Financial Controller and above (DEMO ACCESS toggle: FC AND ABOVE / PLANT
MANAGER). Five integrity categories with findings: PAYMENT INTEGRITY · AUTHORITY
INTEGRITY · SYSTEM INTEGRITY · CUT-OFF INTEGRITY · UNDISCLOSED EXPOSURE. CONTROL
EFFECTIVENESS — AP AUTOMATION: duplicate check override 4.9% YTD (2 of 41 flagged
overridden) · three-way match 7.5% (5 of 67 failed overridden) · value prevented ₹23.4 cr.

**The line:** the platform monitors controls and their bypasses — control of the control,
not a second control; everything the auditor will find, ninety days earlier.

## Beat 11 — Finance Service Desk

**Click path:** /service-desk (rail → SERVICE).

**Figures (verified):** h1 "Finance Service Desk"; honesty line "measuring since 27 Aug
2026 · first full-period report from OCT-2026" (date-relative per §7.21 — the values for
this run). Stat strip: OPEN REQUESTS **45** · OLDEST EFFECTIVE AGE 25 d · STOP-CLOCK HOURS
416 · SELF-SERVE SHARE **37%**. Queue "58 requests · 45 open" with RAISED ON → AGE D /
STOPPED H columns — the raised-on date is the SLA clock start. Deflection table: six entity
rows + GROUP **34** self-served / **58** routed / **37%**.

**The line:** a single structured intake gives every request a clock start — and deflection
is measured, not asserted. The pitch phrase "eight SLAs given a clock start" is spoken, not
rendered: on screen the mechanism appears as this queue's RAISED ON column (the SLA clock
start) plus the three desk SLAs measuring to date on /entity/JGL/service — eight = five
already-measurable + three newly so.

## Beat 12 — One exception, end to end (missing GR, pre-close)

**Click path:** from beat 5's filtered worklist (/entity/JGL/p2p/invoices?cause=missing-gr),
click the AP-104402 Kaveri Solvents Ltd row → /entity/JGL/p2p/invoices/AP-104402. The
exception detail page carries a **Walkthrough** section between the lifecycle cards and the
agent decision record — stepped, not animated: one step at a time, advanced by hand with
"Next step" (and "Start over"). Only this row has the walkthrough; it is the one that
carries the full arc.

**Figures (verified):** eight steps, agent rows tagged AGENT with an accent dot, system
rows neutral (date-relative per §7.21 — the values for this run):

1. **Exception raised** — 16 Jul "Invoice received via vendor portal"; 17 Jul "Three-way
   match failed — no goods receipt".
2. **Follow-up chases plant stores** — AGENT 31 Aug 2026 "Chased plant stores, 1st nudge".
3. **No response at 48 hours** — AGENT 02 Sep 2026 "Escalated to the plant controller
   after the chase timer expired".
4. **The pre-close window opens** — system row (no date) "Pre-close readiness — 3 days to
   close".
5. **Provisioning tests the case** — caption: "Recurring service; Existing purchase order
   on file; Price within tolerance; Prior-period delivery pattern; Value inside the agent
   cap".
6. **A reversing accrual is posted** — AGENT 05 Sep 2026 "Posted a reversing accrual
   rather than a Service Entry Sheet".
7. **Logged for audit** — caption: "Flagged agent-posted for audit sampling. Accrual
   exposure falls ₹1.28 cr."
8. **Supervision** — two links only: "Agent action log →" (/agents/provisioning) and
   "Audit sampling →" (/risk-control). The human sees the case here, not in a workflow.

Below it, the agent decision record (Provisioning · 05 Sep 2026): trigger "Service invoice
blocked with no goods receipt, inside the pre-close window"; five checks, all PASS —
Recurring service ("same vendor and service line posted in prior periods") · Existing
purchase order on file ("PO-4470553 on file, released before booking") · Price within
tolerance ("invoice price measured inside the band") · Prior-period delivery pattern
("prior-period accrual found for the same vendor and service") · Value inside the agent cap
(₹1.28 cr against "≤ ₹6.80 cr (agent cap)"). Precedent AP-104281 opens as a link to that
invoice. Delegation: value cap ₹6.80 cr · dual control not required · never acts on
"Service Entry Sheets outside the narrow band, provisions requiring judgment" · escalates
when "value above the cap; no prior-period precedent". Action: "Posted a reversing accrual
rather than a Service Entry Sheet". Declined (the line that matters more): "I posted an
accrual rather than a Service Entry Sheet because an SES would assert the service was
delivered." Reversibility: "The accrual carries a scheduled reversal for the next period —
if the read is wrong it unwinds itself."

**The line:** one exception, raised to resolved without a human touching it — and every
step of the way is logged, tested against a cap, reversible, and openable. The accounting
outcome at close is identical; nothing irreversible was posted.

## Beat 13 — O2C: what the credit agent releases, and what it does not

**Click path:** /entity/JGL/predictive (beat 9) → click the driver row "Deccan Pharma
Retail — credit block" (₹4.8 cr, +2.1 days) → /entity/JGL/customer/jgl-deccan. For the
case it would NOT release: /entity/JPS/predictive → "Pasir Distribution — credit block"
(₹3.6 cr, +1.9 days) → /entity/JPS/customer/jps-pasir.

**Figures (verified):** both customer pages carry an agent decision record below the
credit-block card (Credit release). The page header keeps its SAP state — Deccan still
reads CREDIT BLOCKED with the human release path ("Release credit block on Deccan Pharma
Retail — Entity controller"); the record beneath is how the credit agent handled that
block, and it is the releasable-set boundary the beat is about. Deccan: trigger "Credit
block on an open customer order"; checks — Cause inside the releasable set PASS ("block
caused by an uncleared invoice that is not yet due") · Policy cited in the record PASS
("policy cited — uncleared invoice, not yet due"). Action: "Release approved · not yet
posted". Precedent jps-pasir opens as a link to Pasir's page.
Declined: "I did not raise the customer's limit or clear any exposure — I authorised only
the release whose cause sits inside the releasable set." Reversibility: "A release lifts the
block; if the read was wrong it can be re-applied and nothing has been paid or written
off."

Pasir, same record shape, different outcome: Cause inside the releasable set **FAIL**
("block caused by exposure over the customer limit") · Policy cited in the record PASS
("policy cited — credit release against exposure is never automated"). Action: "Escalated:
block caused by exposure over limit". Precedent jgl-deccan links back to Deccan's page.
Declined: "I did not release the block against exposure — over-limit is a credit judgment,
never the agent's call." Reversibility: "An escalation posts nothing; it only moves the
item up the human chain."

**The line:** the releasable set is codified, not judged. A policy defect (an uncleared
invoice that is not yet due) releases with the policy cited in the record; a customer over
its limit never does — that one escalates. Same block shape, different cause, different
outcome, and both are readable in the record.

## Beat 14 — The preventive agent: commitments watch on the PO stage

**Click path:** /entity/JGL/p2p (beat 5's cockpit) → click the **PO** stage card ("386 in
flight · ₹58.4 cr") → /entity/JGL/p2p/commitments. Or ⌘K "commitments" and pick the screen
row (its meta reads "386 open POs · ₹18.4 cr at risk").

**Figures (verified):** h1 "Commitments watch". Four headline figures: OPEN POS **386**
(sub "the PO stage pool — 12 named here") · COMMITTED VALUE **₹58.4 cr** ("ties to
cost-centre commitments") · VALUE AT RISK OF SLIPPING **₹18.4 cr**, red ("2 chased · 1
proposed — date not yet confirmed") · AMENDMENTS MADE **2** ("date only, on the owner's
reply"). The claim card states what this agent protects: "This agent keeps the commitment
data true. Committed spend, accrual planning and close exposure all depend on delivery
dates being accurate — a stale date silently corrupts the ₹6.4 cr accrual estimate at
close." Below it, twelve named PO rows ordered by delivery date; the footer reads "Named
rows are the cost-centre pool — same POs, same values" with "₹58.4 cr committed".

The 386 / ₹58.4 cr is the §7.4 PO-stage in-flight figure for JGL, and it reconciles to the
cost-centre page: JGL's four cost centres (Roorkee Operations · Nanjangud Operations ·
Quality & Regulatory · Corporate) carry open POs that sum to exactly ₹58.4 cr — the same
pool, read two ways. The at-risk figure is only the rows whose date is not yet confirmed
(2 chased + 1 proposed = ₹18.4 cr); amended and on-track rows are not at risk because their
date already stands.

**The line:** this agent works upstream of any invoice — there is nothing blocked here, so
the claim is deliberately not "prevents blocked invoices." Amending a PO date does not stop
a vendor invoicing early. What it keeps true is the commitment data: committed spend,
accrual planning and close exposure all ride on delivery dates being accurate, and a stale
date silently corrupts the ₹6.4 cr accrual estimate at close.

## Beat 14b — The nine-day exchange, and its failure path

**Click path:** from the watch (beat 14) → click row **PO-48115** → /entity/JGL/p2p/
commitments/PO-48115 (the confirmed-slip beat). For the failure path: row **PO-48307** →
/entity/JGL/p2p/commitments/PO-48307.

**Figures (verified) — the confirmed slip, PO-48115.** Balaji Engineering Works · Nanjangud
Operations · ₹7.4 cr · owner R. Iyer. Delivery was due **16 Sep 2026 — nine days out** at
the walk. The exchange timeline (all on the demo day) reads:

- 08:19 AGENT asked R. Iyer to flag slippage — "PO PO-48115 delivery is due 16 Sep 2026. If
  it will slip, flag it now so we can amend the date before period-end."
- 09:54 OWNER replied — "Vendor confirmed the batch is pushed into Oct — should land around
  07 Oct 2026."
- 10:04 AGENT understood: delivery moves to **07 Oct 2026** — confidence **0.95**, above the
  0.85 threshold.
- 10:11 AGENT amended the delivery date 16 Sep → 07 Oct — **date only**.
- 10:12 AGENT notified R. Iyer: "Delivery date on PO-48115 amended from 16 Sep 2026 to
  07 Oct 2026. No other field was changed — value, quantity and vendor stand as released."

The decision record beneath: trigger "Delivery on PO-48115 due 16 Sep 2026"; checks all
**PASS** (owner reply confirming slippage · confidence ≥ 0.85 → 0.95 · scope is the delivery
date only); delegation names what it never touches — price, quantity, vendor; action "Amended
the PO delivery date after the owner confirmed slippage."

**Figures (verified) — the ambiguous reply, PO-48307.** Kaveri Solvents Ltd · Roorkee
Operations · ₹5.2 cr · owner S. Rao. Due **13 Sep 2026 — six days out**. The timeline:

- 11:21 AGENT asked S. Rao to flag slippage.
- 12:56 OWNER replied — "Might slip, checking with vendor — will confirm once they respond."
- 13:06 AGENT understood (uncertain): delivery may move to ~23 Sep 2026 — confidence **0.81**,
  below the threshold.
- 13:13 AGENT proposed 23 Sep and escalated to R. Iyer — **no change made**.

The decision record: trigger "Delivery on PO-48307 due 13 Sep 2026; owner reply does not
confirm a date"; checks — owner replied PASS · confidence ≥ 0.85 **FAIL** (0.81) · scope is
the delivery date only PASS → two PASS, one FAIL; action "Proposed a new delivery date and
escalated — reply below confidence threshold."

**The line:** this is the only agent that interprets natural language and then modifies a
procurement document — so a misread must be as visible as a correct read. A confirmed slip
(0.95) amends the date, tells the owner exactly what changed, and touches nothing else; an
ambiguous reply (0.81) fails the confidence check, proposes instead of acting, and escalates
to a human. The amendment is date only — never value, quantity or vendor.

---

## Discrepancy report (screen ≠ script)

The walk found one place where the screen was wrong, and two where the script's shorthand
differs from the screen. The first was a real defect that the script surfaced — fixed in
this step; the other two are characterised here, with the app matching SPEC.md throughout.

**Beat 5 — filtered denominators did not follow the filter (defect, now fixed).** The
filtered worklist header read "4 of 327 shown · ₹5.47 cr of ₹18.6 cr …", implying four of
the entity's 327 blocked invoices were goods-receipt items — wrong by a factor of three.
Per §7.20 the pool follows the filter: filtered to missing GR it is that cause's own pool,
111 invoices / ₹6.4 cr for JGL (the same ₹6.4 cr the root-cause page shows). The header now
reads "4 of 111 shown · ₹5.47 cr of ₹6.4 cr …", which also ties the worklist directly to
the cause table. The script's stated figures — 12 of 327 · ₹12.77 cr of ₹18.6 cr · >30 days
₹8.99 cr · 4 of 38 resolvable — are exactly the **unfiltered** JGL worklist header; the
script quoted that by mistake. The "oldest row in the sample is 52 days" part always held:
AP-104402 Kaveri Solvents Ltd, ₹1.28 cr, 52 d, appears in both views and is the oldest of
the twelve-row sample; 118 d is the pool's oldest (entity page).

**Beat 8 — "71 / 18 / 11" versus what renders.** The bar shows JGL's own split merged to
three categories — client **23 · 72%** / provider **6 · 19%** / system & third party
**3 · 9%** — with the group beneath as comparison in the unmerged four-number form: "JGL
72 / 19 / 6 / 3 · group 71 / 18 / 7 / 4" (the exact string §7.11 pins). The script's
"71 / 18 / 11" is the **group** split with system (7) and third-party (4) merged to 11 —
the numbers are consistent (7 + 4 = 11), but on screen an entity page shows the entity's
split with the group as comparison (§7.22). The app was right; the script quoted the
group's merged form.

**Beat 11 note — "eight SLAs given a clock start" is not a rendered table.** That phrase is
§7.29's pitch line ("the instrument that gives eight committed SLAs a clock start"), not a
section on /service-desk. On screen the clock-start mechanism appears as: h1 "The clock
starts here.", queue rows with RAISED ON → AGE D + STOPPED H (raised-on is the SLA clock
start per §7.21), and the three desk SLAs showing live to-date figures on the service &
attribution page ("measuring since 27 Aug 2026 · first full-period report from OCT-2026").
The eight = five already-measurable + three needs-service-desk. Not a regression — a
clarification for the walk.

---

## If they ask

**1. Why is the group score an unweighted mean?**
§3.7: `groupScore = round(mean of the six entities' displayed scores)` — scores and
percentages aggregate as the mean of members' displayed integers; money and counts sum. It
is a deliberate choice: a small entity counts as much as a large one because assurance
obligations attach to each legal entity regardless of size — a controller cannot ignore a
statutory breach in a small entity because it is small. Value-weighting (§3.8) applies to
comparing exposure, not to weighting assurance. And the mean is taken over what is on
screen, so anyone can verify an aggregate by averaging the six rows above it.

**2. What does "open exceptions" count?**
The sum across all six entities of (blocked AP invoices + O2C exceptions + aged
reconciliation breaks) = 1,014 + 888 + 78 = **1,980**. It counts items that need human
action before close — not a single queue: JGL's 327 blocked invoices are part of it, but so
are O2C exceptions (JGL 284 · JBL 196 · JPS 84 · JCP 31 · JHS 52 · JRP 241) and aged
reconciliation breaks (JGL 18 · JBL 21 · JPS 7 · JCP 2 · JHS 4 · JRP 26).

**3. Why do some SLAs have no percentage?**
Two kinds, both deliberate. (a) The three desk SLAs — vendor master creation, query
resolution, dispute resolution — only got a clock start on 27 Aug 2026; they show live
current-period-to-date figures (open, oldest, average resolution, stop-clock hours) and
deliberately report no achievement % until the first full period (OCT-2026). (b) The two
needs-register SLAs — invoice processing accuracy, audit findings — stay greyed because a
service desk does not give you audit findings or a QC sample; there is no intake or clock
start anywhere for them.

**4. Why does DPO have no colour?**
§8.5.1: it is direction-neutral (`inverse: null`) and renders in muted text whatever way it
moves. Rising DPO is good when it comes from negotiated terms and bad when it comes from
invoices you cannot process; the platform cannot tell those apart from the data, so
colouring the delta green or red asserts something indefensible. The movement is shown with
the adjusted figure beside it (DPO 48 days → adjusted 41 excluding blocked), and the
controller judges. A metric whose direction we cannot defend gets no colour — that restraint
is itself a credibility signal.

**5. Why is accrual exposure ₹6.4 cr rather than ₹18.6 cr?**
Accrual exposure is only the portion of blocked payables with **no goods receipt posted** —
no receipt means no accrual. For JGL it is exactly the missing-GR cause value (§7.5): one
number, one meaning. The rest of the ₹18.6 cr can still be accrued (the receipts exist; the
invoices are blocked for pricing, approval and similar reasons). That is also why drilling
₹6.4 cr lands on the worklist filtered to goods receipt.

**6. Why does the worklist show twelve rows against a pool of 327 — and why is the oldest
sample row 52 days while the entity reads 118?**
The twelve rows are a deterministic sample of the 327-invoice pool (§7.17), and wherever a
sample is displayed against a pool figure, both are stated: the header reads "12 of 327
shown · ₹12.77 cr of ₹18.6 cr …" (§7.20). The oldest sample row need not equal the pool's
oldest — 52 d is the oldest of the twelve sampled rows; 118 d is the pool's oldest (entity
page, §7.13), and the blocked-ageing chart carries a >90-day bucket, which would be
impossible if nothing exceeded 52 days. The same distinction runs through "4 of 38 resolvable
in this view" — the sample holds four; the pool has 38. Sample versus pool is why the header
states both, and it is the answer to anyone who starts adding figures up.
