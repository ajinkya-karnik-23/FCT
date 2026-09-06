# Canonical dataset §7.17–§7.31 — exceptions, counterparties, compliance, ageing

# §7 continued — canonical dataset (detail)

### 7.17 Exceptions for the other five entities

All twelve seeded exceptions are JGL's, so every non-JGL drill lands on an empty
worklist. An empty list reads as a broken product, not as an honest absence — and
Steps 7, 9 and 11 all need exceptions across entities.

Seed **12 rows per entity**, matching the existing JGL pattern of showing a sample
of a larger pool. Generate deterministically against these constraints rather than
listing 60 rows here:

| Entity | Rows shown | Of pool | Shown value ₹cr | Max age (days) |
|---|---|---|---|---|
| JGL | 12 | 327 | 12.77 | 52 |
| JBL | 12 | 214 | 7.8 | 61 |
| JPS | 12 | 96 | 4.7 | 34 |
| JCP | 12 | 41 | 1.4 | 18 |
| JHS | 12 | 68 | 2.9 | 27 |
| JRP | 12 | 268 | 10.1 | 74 |

Constraints, all assertable:

- Row values sum to the entity's shown value and are ordered descending.
- No row's age exceeds the entity's `apBlockedOldestDays` (§7.13). The oldest sample
  row need **not** equal it — that figure is the pool's oldest and the twelve rows are
  a sample. JGL's oldest sample row stays 52 days against a pool oldest of 118.
- Causes are drawn from the P2P taxonomy (§6.1) in roughly the §7.5 proportions.
  **At least three rows per entity carry the goods-receipt cause**, so the accrual
  exposure drill lands on a populated list.
- Attribution follows the §7.6 mapping — goods receipt, pricing and approval are
  `client`; vendor master and tax are `provider`; duplicate is `system`.
- Plants come from that entity's list below. Owners are pinned so they stay stable
  across regenerations:

```
JGL  P. Nair · A. Sethi · R. Iyer          JBL  M. Kulkarni · S. Rao
JPS  W. Tan · L. Cheong                    JCP  D. Whitfield · K. Moreau
JHS  J. Halloran · T. Bergstrom            JRP  C. Tremblay · N. Okafor
```
- Deterministic — seeded from entity code, no `Math.random()`.

**Sites by entity.** Needed here and again for the plant pages in Step 11:

| Entity | Sites |
|---|---|
| JGL | Nanjangud · Roorkee · Ambernath · Noida |
| JBL | Bengaluru · Noida |
| JPS | Singapore (no manufacturing site — office location) |
| JCP | Salisbury, MD |
| JHS | Spokane, WA · Montreal, QC |
| JRP | Kirkland, QC · US radiopharmacy network |

> **For the human, not the model:** these sites are a reasonable reconstruction and
> should be confirmed against the annual report before client use, as with the entity
> names in §2.

**Vendor name pools.** Invented names, not real counterparties. Reuse the existing
twelve for JGL.

```
India (JBL)         Sahyadri Biosciences · Konark Glassware · Prabhat Cold Chain
                    Indus Analytical · Varsha Packaging · Aravalli Reagents
Singapore (JPS)     Straits Facilities · Raffles Professional Services
                    Kallang Freight · Tanjong Technology Services
US (JCP, JHS)       Cascade Packaging · Alcott Laboratories · Northgate Logistics
                    Sentinel Instruments · Harbor Chemical · Fairmont Sterile Supply
Canada / US (JRP)   Laurentian Isotopes · Beaufort Medical Gases · Cartier Packaging
                    Ridgeway Cold Chain · Saint-Lambert Shielding
```

### 7.18 Per-entity figures for the mode panels

Three figures in the mode-aware panel are group-level and therefore identical on all
six entity homes, which is wrong on the screen whose whole purpose is to be about one
entity. Per-entity values:

**Unposted goods receipts** — this is the same quantity as accrual exposure (§8.2),
so use that field rather than storing it twice:

| Entity | Value ₹cr | Vendors | Recurrence |
|---|---|---|---|
| JGL | 6.4 | 11 | 5th month |
| JBL | 4.1 | 8 | 4th month |
| JPS | 2.1 | 5 | 2nd month |
| JCP | 0.6 | 2 | 1st month |
| JHS | 1.3 | 3 | 2nd month |
| JRP | 5.7 | 14 | 6th month |

**Cause elimination** — must sum to the group figures in §7.5 (34 identified, 11
eliminated, 6 in progress, 17 not started):

| Entity | Eliminated | In progress | Not started | Identified |
|---|---|---|---|---|
| JGL | 3 | 2 | 3 | 8 |
| JBL | 2 | 1 | 4 | 7 |
| JPS | 2 | 1 | 2 | 5 |
| JCP | 2 | 0 | 1 | 3 |
| JHS | 1 | 1 | 2 | 4 |
| JRP | 1 | 1 | 5 | 7 |
| **Group** | **11** | **6** | **17** | **34** |

**Cash opportunity** — JGL's ₹11.3 cr is the sum of its working-capital rows; the
others scale with value at risk at a consistent 36–38%:

| Entity | Value ₹cr | Items |
|---|---|---|
| JGL | 11.3 | 88 |
| JBL | 7.4 | 61 |
| JPS | 4.3 | 34 |
| JCP | 1.5 | 12 |
| JHS | 2.9 | 24 |
| JRP | 9.2 | 79 |

### 7.19 Effort is a property of the item, not the cause

The Step 7 mapping made effort a function of cause and put missing-GR at High. But
§7.3's cash opportunity has that same cause at Low. Both cannot be right, and the
consequence was that the "38 resolvable today" chip filtered to a set that could
never contain them.

**The flag is `resolvableToday`, not `blockerCleared`.** The original wording is
prospective — *"₹4.2 cr working-capital release available **by clearing** GR
compliance on 11 vendors"*. The clearing action is available and quick; the receipt
is not yet posted. That distinction carries real weight:

- `blockerCleared` would mean the receipt exists, so accrual exposure should net
  those items off — ₹6.4 cr becomes ₹2.2 cr, and the tie to the missing-GR cause
  value established in Step 6b breaks.
- `resolvableToday` means nothing has posted yet. Accrual exposure stays ₹6.4 cr,
  the accrual drill correctly lists every missing-GR row, and the 38 are quick wins
  **within** missing-GR rather than outside it.

The second is both correct and the one that keeps every established number intact.

Effort derives from cause plus that flag:

| Situation | Effort | Why |
|---|---|---|
| Missing GR, receipt not yet available | High | Chase the plant, wait on someone else |
| Missing GR, receipt available and awaiting match or posting | Low | One action, no chasing |
| Price mismatch outside tolerance | High | Renegotiate or raise a debit note |
| Price mismatch inside tolerance | Low | Approve the variance |
| Approval pending, approver absent | Medium | Reroute the delegation |
| Approval pending, approver active | Low | One nudge |
| Vendor master, tax, duplicate — not resolvable today | Medium | Correction plus re-validation |
| Vendor master, tax, duplicate — resolvable today | Low | Correction already prepared |

Per-entity resolvable sets, so the chip carries a count everywhere:

| Entity | Resolvable today | Value ₹cr |
|---|---|---|
| JGL | 38 | 4.2 |
| JBL | 25 | 2.6 |
| JPS | 11 | 1.5 |
| JCP | 5 | 0.5 |
| JHS | 8 | 0.9 |
| JRP | 31 | 3.3 |

### 7.20 Sample and pool must both be visible

The worklist shows 12 rows of a 327 pool, and the entity view says "38 resolvable
today" while the sample holds four. Neither figure is wrong; shown alone they look
contradictory, and a client will notice within seconds.

**Wherever a sample is displayed against a pool figure, state both.** The worklist
header reads:

```
12 of 327 shown  ·  ₹12.77 cr of ₹18.6 cr  ·  >30 days ₹8.99 cr  ·  4 of 38 resolvable in this view
```

The ageing segment was in the original prototype header and is worth keeping:
value alone does not tell a controller whether the pool is stale.

**Denominators follow the filter.** Unfiltered, the pool is the entity's blocked AP —
327 invoices, ₹18.6 cr. Filtered to a cause, the pool is *that cause's* pool, not the
whole one. "4 of 327 · ₹5.47 cr of ₹18.6 cr" on a goods-receipt filter implies four of
327 goods-receipt items, which is wrong by a factor of three.

Cause pools derive from the §7.5 shares and tie back to the cause table exactly:

| Cause | Share | Pool count | Pool value ₹cr |
|---|---|---|---|
| goods receipt | 34% | 111 | 6.4 |
| pricing | 22% | 72 | 4.1 |
| approval | 18% | 59 | 3.3 |
| vendor master | 11% | 36 | 2.0 |
| duplicate | 8% | 26 | 1.5 |
| tax | 7% | 23 | 1.3 |
| **Total** | **100%** | **327** | **18.6** |

So the goods-receipt filter reads **"4 of 111 shown · ₹5.47 cr of ₹6.4 cr"**. Assert
two properties: cause pool counts sum to `apBlockedCount`, and for every cause the
sampled rows sum to no more than that cause's value at risk.

That second one matters — the sample is value-ranked, so it over-represents value. Four
sampled goods-receipt rows carrying ₹5.47 cr of a ₹6.4 cr pool is correct and worth
being able to explain: the biggest items are shown first, and the remaining 107 are
small.

The bulk action button follows the visible set — "Release all 4" — because that is
what it will actually do. The header explains why 4 and not 38.

This is the same discipline as §8.6.1: a figure that cannot explain itself gets
discounted, and so does everything beside it.

### 7.21 The demo clock is relative, not absolute

**This applies to every seeded date in the product**, not only exception evidence:
control signal detection dates, compliance due dates, request timestamps, close
calendar dates, last payment dates. Any date literal will read as stale the moment
the prototype is shown outside the month it was written in.

Seeded evidence is stamped against a fixed anchor date. Ages are stored as day
counts. Those two drift apart: shown three months from now, an item stating "oldest
52 days" will carry evidence dated last August.

Derive the anchor from the current date — every seeded timestamp is
`today − ageDays`, so evidence and ageing always agree whenever the prototype is
opened. Action stamps continue to use the real wall clock, which is then consistent
with the seeded lines rather than months ahead of them.

Keep the derivation deterministic within a single day so tests do not flake.

### 7.22 Per-entity SLA performance

The Service & attribution screen sits at entity level but renders identical figures
on all six entity pages — the same defect corrected three times already (mode panels,
releasable cash, systemic count). The bar is group-level while the screen is
entity-level, and the SLA table is JGL's data everywhere.

Per-entity attribution counts already exist (§7.11). What is missing is per-SLA
performance. Generate against these constraints rather than pinning 30 values:

**Gross achievement mean by entity** — must track the service dimension:

| Entity | Service dimension | Gross mean % |
|---|---|---|
| JCP | 94 | 98.8 |
| JHS | 88 | 97.6 |
| JPS | 84 | 96.8 |
| JGL | 78 | 95.2 |
| JBL | 72 | 94.0 |
| JRP | 66 | 92.4 |

Constraints, all assertable:

- JGL's five day-one rows are the pinned §7.7 values and must not move.
- Per-SLA breach counts sum to the entity's breach total (§7.11): 32 · 41 · 12 · 3 ·
  6 · 48.
- Per-SLA attribution counts sum to the entity's attribution counts (§7.11) —
  JGL {23,6,2,1}, JBL {29,7,3,2}, JPS {9,2,0,1}, JCP {2,1,0,0}, JHS {5,1,0,0},
  JRP {33,8,5,2}.
- The mean of the five gross achievements equals the entity's gross mean above.
- The five `needs-service-desk` and `needs-register` rows stay unmeasurable for every
  entity — they have no clock start anywhere, not just at JGL.

**Scoping.** The attribution bar shows the **entity's own** split, with the group
split beneath it as comparison — *"JGL 72 / 19 / 6 / 3 · group 71 / 18 / 7 / 4"*.
Which entities are worse than the group is a question a controller asks immediately,
and a group-only bar on an entity page cannot answer it.

### 7.23 Forecasts for the other five entities

The Predictive screen is JGL-only because §7.3 pins only JGL's forecast. That is
honest but thin — and JRP is the entity a controller would most want a forecast for:
worst working capital, worst DSO, capped score. "Predict, then rank the action" is
one of the product's central claims and it should work wherever it is clicked.

| Entity | DSO today | Projected | Deterioration | Driver values ≈ ₹cr |
|---|---|---|---|---|
| JRP | 74 | 86 | +12 | 22.2 |
| JBL | 68 | 79 | +11 | 17.2 |
| JGL | 62 | 72 | +10 | 23.5 |
| JPS | 54 | 59 | +5 | 9.6 |
| JHS | 51 | 55 | +4 | 6.7 |
| JCP | 47 | 50 | +3 | 3.3 |

Deterioration must order inversely with the working capital dimension — JRP worst at
48, JCP best at 86. A forecast that says the healthiest entity is deteriorating
fastest contradicts the score beside it.

Generation constraints:

- JGL's four drivers and four ranked actions are the pinned §7.3 values, unchanged.
- Three or four drivers per entity; day impacts sum exactly to the deterioration.
- Driver values sum to roughly 1.5× (AR over 90 + cash unapplied), matching JGL's
  23.5 against 15.5. Not all disputed value is yet 90 days overdue.
- Three or four ranked actions per entity, ordered by days recovered per unit of
  effort — not by size of recovery. **Effort weights are Low = 1, Medium = 2,
  High = 4**, which reproduces JGL's pinned order exactly (6.00 · 1.10 · 1.05 ·
  1.02). Pin them: the ranking is a product claim, and a weighting that drifts
  reorders the actions.
- Every base settlement date falls after month-end, so the pinned headline holds
  whenever the prototype is opened.

**Name real customers, not "Customer A".** Step 11 builds customer pages, and a
driver that says "Customer A" cannot drill to one. Use these pools, and let each
driver reference a customer that will exist:

```
India (JGL, JBL)     Amrit Distributors · Sanjeevani Healthcare · Deccan Pharma Retail
                     Nirmal Wholesale · Vindhya Medical Supplies
Singapore (JPS)      Straits Healthcare Group · Pasir Distribution
US (JCP, JHS)        Ridgeline Health Partners · Cornerstone Wholesale
                     Beacon Pharmacy Services · Lakeshore Distributors
US / Canada (JRP)    Mont-Royal Imaging · Great Lakes Nuclear Medicine
                     Saint-Denis Health Network
```

### 7.24 Counterparty data must reconcile

Counterparty pages are the first place a controller can add things up and check them
against a total. If a vendor page says one thing and the entity view says another,
every number in the product becomes suspect.

**Reconciliation ties, all assertable:**

```
Σ vendor blocked   across the page's SAMPLED vendors  =  worklist shown value
Σ plant blocked    across an entity's plants          =  entity blocked AP  (POOL)
Σ cost centre committed spend                         =  PO stage in-flight value
Σ vendor open commitments                             =  PO stage in-flight value
Σ customer exposure                                   ≥  AR over 90 days
```

For JGL: ₹12.77 cr, **₹18.6 cr**, ₹58.4 cr, ₹58.4 cr, ≥ ₹12.4 cr.

**Vendors tie to the sample; plants tie to the pool.** Vendors are derived from the
twelve sampled exception rows, so they can only account for the sampled value. Plants
are a fixed, small, complete set — every one of the 327 blocked invoices sits at a
plant — so a plant page showing only its share of a twelve-row sample would understate
what a plant manager is accountable for.

**Plant shares are of blocked AP overall, not of the missing-GR cause.** §7.5's
43/29/18/10 is the plant split *within* missing-GR. Applying it to the whole blocked
pool conflates two different cuts. Use these overall shares instead:

| Entity | Plant shares of blocked AP |
|---|---|
| JGL | Nanjangud 43% · Roorkee 29% · Ambernath 18% · Noida 10% |
| JBL | Bengaluru 62% · Noida 38% |
| JPS | Singapore 100% |
| JCP | Salisbury 100% |
| JHS | Spokane 58% · Montreal 42% |
| JRP | Kirkland 55% · Radiopharmacy network 45% |

JGL's overall split happens to match its missing-GR split, which is why that cause
dominates its blocked pool. The other five are their own.

**Vendors** are already named by the exception rows (§7.17). A vendor page derives
from them — no new vendor dataset. Blocked value, open items, causes and plants all
come from that vendor's exceptions.

**Customers** are the ones already named in the forecast drivers (§7.23), so a driver
drills to a page that exists. Each carries exposure (the driver value), dispute and
deduction detail, payment behaviour, credit block status and the release path, plus
ageing buckets summing to its exposure.

**Plants** come from the §7.17 site list. A plant page derives from the exceptions at
that plant. For JGL, the distribution must match §7.5's missing-GR plant split —
Nanjangud 43%, Roorkee 29%, Ambernath 18%, Noida 10%.

**Cost centres** are the only genuinely new dataset — three or four per entity, with
budget, booked spend and **committed spend** against it. Committed is the point: open
purchase orders not yet invoiced are what a controller cannot see in most tools and
what makes the remaining budget real. The commitment figures tie to the PO stage
in-flight value in §7.4.

Suggested cost centres, matching the businesses:

```
JGL   Roorkee Operations · Nanjangud Operations · Quality & Regulatory · Corporate
JBL   Discovery Services · Lab Operations · Corporate
JPS   Group Treasury · Corporate Services
JCP   Salisbury Operations · Commercial · Corporate
JHS   Spokane Sterile Ops · Montreal Ops · Quality
JRP   Radiopharmacy Network · Kirkland Manufacturing · Regulatory
```

### 7.25 Per-entity process stages

`stages.ts` holds one dataset, so the P2P and O2C cockpits render JGL's figures on
every entity — the same defect corrected in Steps 6b, 7c, 8 item 0 and 8b. It also
forces every entity's cost centres to sum to JGL's ₹58.4 cr of commitments.

Scale the §7.4 stage tables per entity, then override the pinned tie points so the
cockpits agree with the entity metrics:

| Entity | PO in-flight ₹cr | Collection in-flight ₹cr |
|---|---|---|
| JGL | 58.4 | 56.3 |
| JBL | 35.5 | 40.4 |
| JPS | 21.4 | 23.2 |
| JCP | 6.6 | 8.6 |
| JHS | 13.2 | 17.3 |
| JRP | 46.2 | 48.1 |

PO in-flight scales with blocked AP; collection in-flight with AR over 90 days.

**Pinned tie points that must survive the scaling:**

```
Invoice stage    inException count  =  apBlockedCount        327 · 214 · 96 · 41 · 68 · 268
Invoice stage    exceptionValue     =  apBlocked             18.6 · 11.3 · 6.8 · 2.1 · 4.2 · 14.7
Collection stage inException count  =  o2cExceptionCount     284 · 196 · 84 · 31 · 52 · 241
Cash app stage   exceptionValue     =  cashUnapplied         3.1 · 2.4 · 1.2 · 0.3 · 0.6 · 4.0
Collection stage inFlightValue      =  total open AR         table above
PO stage         inFlightValue      =  Σ cost centre committed
```

Exception percentages stay derived, never stored (§7.4).

### 7.26 Compliance obligations by jurisdiction

The overdue return driving JRP's compliance score of 60 and its veto cap was
specified as GSTR-3B — an Indian return, on a US/Canada radiopharmacy entity. It is
**GST/HST**, filed with the Canada Revenue Agency. Obligations must match the entity's
jurisdiction; a Jubilant controller will notice immediately if they do not.

| Entity | Jurisdiction | Obligations |
|---|---|---|
| JGL | India | GSTR-1 · GSTR-3B · GSTR-2B reconciliation (ITC at risk) · TDS deposit · TDS return · MSMED 45-day ageing · e-invoice IRN failures |
| JBL | India | same set |
| JPS | Singapore | GST F5 return · withholding tax · transfer pricing documentation |
| JCP | United States | Sales & use tax · Form 1099 filings · state registrations |
| JHS | US / Canada | Sales & use tax · GST/HST return · Form 1099 |
| JRP | US / Canada | **GST/HST return — OVERDUE** · Québec QST · sales & use tax · Form 1099 |

Multi-jurisdiction coverage is a selling point in itself for this group, so make the
jurisdiction visible on each row rather than presenting one undifferentiated list.

Values at risk, for the obligations that carry one:

| Entity | ITC / input tax at risk ₹cr | MSMED ageing ₹cr | e-invoice IRN failures | Form 1099 TIN mismatches |
|---|---|---|---|---|
| JGL | 1.8 | 2.4 | 14 | — |
| JBL | 0.9 | 1.1 | 8 | — |
| JPS | 0.4 | — | — | — |
| JCP | 0.2 | — | — | 9 |
| JHS | 0.3 | — | — | 6 |
| JRP | 1.2 | — | — | 21 |

**E-invoice IRN failures are India-only.** IRN is the Invoice Reference Number issued
under Indian e-invoicing — a US or Canadian entity has no such thing. The equivalent
operational filing failure there is a TIN mismatch on Form 1099. JHS's geography in
§2 is corrected to US / Canada to match its Spokane and Montreal sites (§7.17).

**Only JRP has an overdue item.** Every other entity's compliance dimension is 88 or
above, and an overdue statutory filing would cap those scores at 60 under §3.5 — so
an overdue row anywhere else would contradict the score beside it.

### 7.27 Data quality checks

No dataset exists for these. Fail rates must order inversely with the data quality
dimension — JCP 94 cleanest, JRP 74 worst:

```
JCP 94  ·  JHS 92  ·  JGL 90  ·  JPS 88  ·  JBL 82  ·  JRP 74
```

Six checks per entity across the four domains, with fails over totals and the
downstream impact stated:

| Domain | Check | Impact to state |
|---|---|---|
| vendor | Missing tax registration | Blocks e-invoice validation |
| vendor | Duplicate vendor records | Duplicate payment risk |
| vendor | Dormant, no activity 24 months | Fraud surface, master data bloat |
| customer | Missing tax registration | Billing rejections |
| gl | Cost centre default missing | Manual coding, misposting risk |
| interface | Failed IDocs, last 7 days | Missing transactions, stale figures |

For JGL, illustrative anchors: missing tax registration 14 of 812 vendors; duplicate
records 9; dormant 48; customer missing registration 6 of 430; GL defaults missing 3
of 210; IDoc failures 12. Scale fail rates for the others by their dimension score.

**Link failures to the exceptions they cause.** The vendor-master cause is 11% of
JGL's blocked AP (§7.5, ₹2.0 cr) — that is master data quality showing up as working
capital, and the link between the two screens is the point of having this one.

### 7.28 Cost centre overruns should track entity health

Only JGL Nanjangud runs over budget, which leaves JRP — the worst entity at 55, with
the worst working capital — showing every cost centre comfortably within budget. Give
JRP and JBL at least one overrun each, driven by committed spend rather than booked,
so the page makes its own argument: the budget looks fine until you count the open
purchase orders.

### 7.29 The Finance Service Desk, and what it does to the SLA table

**Naming.** The screen is the **Finance Service Desk** — plain, and obvious to a plant
manager or sales lead who has never seen the product. In the pitch narrative it is
described as *"a single structured intake for every request into the service"*, which
is what carries the argument. The nav label and the pitch phrase do not have to be
the same words; the label needs to be obvious, the phrase needs to persuade.

Do not call it a helpdesk or a ticketing system. It is not ticket-pushing — it is the
instrument that gives eight committed SLAs a clock start.

Step 13 seeds the request intake and flips the three `needs-service-desk` SLAs to
measurable. That creates a conflict worth handling deliberately rather than
discovering: §7.11 pins each entity's breach total — 32 · 41 · 12 · 3 · 6 · 48 —
and the group attribution split of 71/18/7/4 is computed from them. If three more
SLAs start contributing breaches, those totals move and the split changes.

**Service Desk SLAs report separately until a full period has elapsed.** You cannot
report full-period performance on something you began measuring mid-period, and
claiming otherwise is the kind of thing a controller tests. So:

- They leave the greyed state and show live current-period-to-date figures: open
  requests, ageing, resolution times, stop-clock hours.
- They do **not** yet report an achievement percentage, and they do **not** enter
  the breach totals or the attribution split. §7.11's figures stand unchanged.
- Each carries the line *"measuring since <date> · first full-period report from
  <next period>"*.

That is a stronger demo beat than a fabricated percentage. It shows the Service Desk
delivering measurement immediately and being honest about what measurement it cannot
yet support — which is exactly the argument for building it.

The two `needs-register` SLAs stay greyed. A service desk does not give you audit
findings or a QC sample.

**Seeding.** Eight to twelve requests per entity, deterministic, spanning all six
types and all four statuses:

- `raisedOn` is the SLA clock start and follows §7.21 — derived from today, never a
  literal.
- `clockStoppedHours` accrues only while status is `awaiting-client`. This is the
  same attribution logic as §5, applied to requests, and it is what makes the
  stop-clock defensible rather than contested.
- Request volume per entity should track its exception volume — JRP and JBL busiest,
  JCP lightest.
- **Every request has a named owner**, drawn from the §7.17 owner pool for that
  entity. Not "Service desk". §8.9 and the root-cause model both insist on a named
  owner for every open item, and an anonymous queue is exactly the accountability gap
  the platform exists to close. It matters most here, on the provider's own side of
  the attribution line — we cannot ask the client to name who is holding a goods
  receipt while our own queue is owned by a department.
- **Deflection is pinned: 34 self-served of 92 contacts, 37%.** It carries into the
  operating-model argument in Step 16 alongside the ₹23.4 cr prevented (§7.8.1), and
  a quotable number must not move between regenerations.

### 7.30 Cause elimination — owners, dates and the mechanism

§7.18 pins the counts: 34 identified, 11 eliminated, 6 in progress, 17 not started.
What is missing is who owns them, when they land, and the evidence that eliminating a
cause actually reduces exception volume — which is the mechanism claim the whole
managed-services argument rests on.

**Owners** come from the §7.17 pool for the owning entity, plus process leads for
cross-entity causes. Named people, not departments — same rule as §7.29.

**Target dates** are relative per §7.21, spread across the next two quarters. In-progress
causes carry a date; identified-but-not-started ones do not, and showing a blank is
more honest than inventing a commitment.

**The mechanism.** Cumulative causes eliminated, group-wide, over the six trend
periods:

```
period   1    2    3    4    5    6
elim     3    5    6    8    9   11
```

Assert the relationship rather than just displaying both: **as cumulative eliminations
rise, group open exceptions fall** across the same six points. If they do not, the
chart is claiming a mechanism the data does not support, and this is the one screen
whose entire purpose is to evidence that mechanism.

**O2C causes have no item-level forward link, and should not pretend to.** The
worklist holds blocked invoices only — §7.17 seeds P2P exceptions and there is no O2C
equivalent. Rather than leaving those rows as dead ends (§8.4), forward-link them to
the O2C cockpit's collection stage anchor, the same target the revenue-at-risk figure
uses. State the limitation where it shows: *"item-level detail available for P2P;
O2C drills to process level"*. An honest boundary beats a link that goes nowhere, and
beats a fabricated item list more still.

**Guard against the easy overclaim.** Eliminating a cause reduces the *rate* at which
new exceptions arrive; it does not clear the existing pool. The screen should say
which of the two it is showing. "Exception volume fell 32 because we eliminated two
causes" is not a claim the data supports — "the two causes eliminated this period
generated 47 exceptions in the prior period and none in this one" is.

### 7.31 Per-entity ageing buckets

`blockedInvoiceAgeing` and `receivablesAgeing` are JGL-only datasets rendered on every
entity, so JBL's P2P cockpit shows an invoice stage of ₹4.1 cr beside a chart summing
₹18.6 cr. Buckets must be per entity, and two ties must hold.

**Blocked invoice ageing** — shares of the entity's blocked AP, and the profile must
stop at the bucket its pool oldest reaches:

| Entity | 0–15 | 16–30 | 31–60 | 61–90 | >90 |
|---|---|---|---|---|---|
| JCP | 52% | 33% | 15% | — | — |
| JHS | 44% | 30% | 26% | — | — |
| JPS | 36% | 26% | 24% | 14% | — |
| JGL | 31.7% | 22.6% | 22.0% | 14.0% | 9.7% |
| JBL | 26% | 22% | 23% | 17% | 12% |
| JRP | 20% | 19% | 22% | 20% | 19% |

JGL's shares reproduce its pinned ₹5.9 / 4.2 / 4.1 / 2.6 / 1.8 cr exactly. Healthier
entities are front-loaded; JRP is nearly flat across all five, which is what a
168-day-old pool looks like.

**Receivables ageing** — the hard tie is that the last two buckets sum to
`arOver90`, and all five sum to total open AR (§7.25):

| Entity | Total AR | Buckets 1–3 | Buckets 4–5 = AR>90 |
|---|---|---|---|
| JGL | 56.3 | 43.9 | 12.4 |
| JBL | 40.4 | 31.5 | 8.9 |
| JPS | 23.2 | 18.1 | 5.1 |
| JCP | 8.6 | 6.7 | 1.9 |
| JHS | 17.3 | 13.5 | 3.8 |
| JRP | 48.1 | 37.5 | 10.6 |

Assert both ties for every entity. This is the arithmetic a chartered accountant does
without being asked.

**Also per-entity: overdue queries.** `serviceControl.queriesOverdue` is a group figure
rendered per entity. Values, tracking the service dimension inversely:
JGL 27 · JBL 34 · JPS 11 · JCP 4 · JHS 8 · JRP 41.

---
