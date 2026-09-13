# §16 — Record to report

The third process cockpit, and the one that moves the product's scope boundary.

---

## §16.0 Why this is different from the other two

P2P and O2C show where work is stuck. **R2R shows what that does to the balance sheet.**
It is the consequence layer, and it is where the cross-process trace in §8.10 already
ends: goods receipt not posted → invoice blocked → accrual understated → exposure at
close.

It also gives a home to the R2R cause taxonomy in §6.1, unused since Step 1, and to the
agents §15 named as the next process to cover.

## §16.1 The scope boundary moves

§1 excluded close orchestration on the assumption a close tool existed to read from.
**Jubilant has neither Trintech nor BlackLine.** "We consume close status from your close
tool" therefore reads from a spreadsheet, and §6 says nothing contractually committed
should be measured from one. In a managed service where the provider runs the close,
owning the calendar *is* the job.

So the boundary moves, in a staged way. Three capabilities with very different costs:

| | Capability | Position |
|---|---|---|
| **A** | Close calendar, tasks, dependencies, critical path, escalation, predicted close date | **In scope. Build it.** No ERP write-back, light NFRs |
| **B** | Journal preparation, approval routing, posting to SAP | **Staged and priced separately.** Year one |
| **C** | Certification and evidence | **Surface, do not rebuild.** Smart Recon already does this |

§1's exclusion list becomes two items, not three: management reporting and variance
commentary stay out; controls enforced upstream stay out. The story tightens rather than
loosens — the tower covers **operate**, **close** and **assure**, with only reporting
outside.

### Why B is staged, and it is not scope discipline for its own sake

If the platform holds the journal approval and then triggers the SAP posting, **the
platform becomes the system of record for the approval evidence** even though SAP holds
the entry. That is normal and an auditor will accept it — but it puts the platform in
scope for ICFR. Access control, segregation of duties, change management, retention, and
evidence that the control operated.

In a group with US listed exposure and USFDA oversight that is a real obligation with a
real cost. It is the difference between a surveillance tool and a financial system, and
it should be priced as such rather than absorbed.

Start narrow when it lands: recurring journals, standard templates, value-capped, dual
control. The same staging logic as agent write-back in §15.

## §16.2 Stage flow

Eight stages, same grammar as §7.4 — in-flight and in-exception at each, percentages
derived:

```
SUB → ACC → REC → ICO → JRN → TB → PCK → SGN
```

| Stage | In flight | In exception |
|---|---|---|
| Sub-ledger close | Ledgers to close | Not closed on schedule |
| Accruals & provisions | Accruals to raise | Unsupported or unreversed |
| Reconciliations | Accounts to reconcile | Open breaks |
| Intercompany | Balances to match | Mismatched |
| Adjusting journals | Journals posted | High-risk |
| Trial balance | Accounts in scope | Unexplained movement |
| Reporting pack | Pack sections | Not prepared or reviewed |
| Sign-off | Certifications due | Outstanding |

**The Reporting pack stage reports whether a pack is prepared, reviewed and issued. It
does not produce one.** §1's management reporting exclusion is untouched by any of this.

## §16.3 The close calendar

A full capability, not a status read. This is what a provider running the close actually
operates from.

**Tasks.** Per entity, each with owner, due day of close, dependencies, status, and
whether it sits on the critical path.

| Entity | Tasks | Complete | Open | Close % |
|---|---|---|---|---|
| JGL | 214 | 167 | 47 | 78 |
| JBL | 186 | 113 | 73 | 61 |
| JPS | 124 | 109 | 15 | 88 |
| JCP | 96 | 92 | 4 | 96 |
| JHS | 142 | 133 | 9 | 94 |
| JRP | 231 | 120 | 111 | 52 |

Task counts reconcile to the pinned close percentages in §7.2. Assert it.

**Dependency-aware, not a checklist.** A blocked task shows what is blocking it and who
owns that. This is the difference between a close calendar and a to-do list, and it is
what makes the next item possible.

**Predicted close date against committed.** The critical path through open tasks, with
the predicted landing day:

| Entity | Committed | Predicted | Blockers |
|---|---|---|---|
| JGL | Day 6 | Day 6 | 7 |
| JBL | Day 6 | Day 8 | 9 |
| JPS | Day 6 | Day 6 | 3 |
| JCP | Day 6 | Day 5 | 1 |
| JHS | Day 6 | Day 6 | 2 |
| JRP | Day 6 | **Day 9** | 11 |

Predicted slippage must order with the close percentage — JRP worst, JCP best.

**This delivers something promised and never built.** Slide 2 of the deck claims the
platform *anticipates* rather than reports, and nothing on the close side did. A critical
path with a predicted landing date is the clearest expression of it.

**Escalation.** Overdue tasks escalate on a timer to the owner's escalation contact,
logged. Same mechanism as the exception worklist — one escalation model, not two.

**Sign-off is status only in phase A.** Certification state is read from the
reconciliation platform and displayed. Preparer and reviewer workflow with evidence
attachment belongs to B.

## §16.4 Balance sheet integrity

The headline figure, and the one nobody else publishes. A composite of six components:

```
reconciliation   0.25      intercompany       0.20      GR/IR exposure    0.20
unapplied cash   0.15      provision adequacy 0.10      cut-off integrity 0.10
```

| Entity | Recon | ICO | GR/IR | Unapp | Prov | Cut-off | **Index** |
|---|---|---|---|---|---|---|---|
| JCP | 94 | 92 | 94 | 96 | 98 | 92 | **94** |
| JHS | 90 | 88 | 92 | 94 | 97 | 90 | **91** |
| JPS | 80 | 74 | 82 | 86 | 94 | 88 | **82** |
| JGL | 68 | 70 | 62 | 74 | 92 | 78 | **72** |
| JBL | 60 | 64 | 58 | 70 | 88 | 72 | **66** |
| JRP | 51 | 56 | 50 | 62 | 84 | 66 | **58** |

Compute from components; never store the index. It must order with the risk dimension —
JCP 88 best, JRP 46 worst — and it does.

**It feeds the risk dimension; it does not become a seventh.** §3.2's weights are
contractually fixed and rendered on three screens. Opening them to add a dimension is a
change to a published contract term, for a figure that belongs at cockpit level.

## §16.5 The four panels

**Reconciliations.** Accounts reconciled, certified, overdue. Breaks by age band — JGL 18
breaks, oldest 61 days, ₹14.3 cr (§7.2, §7.13). Evidence attached or not. Sourced from
the reconciliation platform; tag it.

**Journal risk.** The *population*, scored — not the exceptions. Risk & control shows what
breached; this shows what the whole population looks like, which is a different question.

| Flag | What it catches |
|---|---|
| Top-side entry | Posted above the sub-ledger |
| Round number | Estimate rather than calculation |
| Backdated | Posted after the date it carries |
| Above materiality | Size alone warrants review |
| Preparer equals approver | Segregation failure |
| Outside business hours | Unusual timing |
| Sensitive account | Provisions, intercompany, suspense |

| Entity | Journals | High-risk |
|---|---|---|
| JGL | 847 | 12 |
| JBL | 692 | 15 |
| JPS | 418 | 5 |
| JCP | 264 | 2 |
| JHS | 391 | 3 |
| JRP | 913 | 19 |

High-risk counts must match `highRiskJEs` in §7.2. Assert it.

**This panel requires SAP change documents.** `CDHDR` and `CDPOS` plus posting-user and
timestamp data are what make preparer-equals-approver and outside-hours detection
possible. Without that extract the panel degrades to what the trial balance alone can
tell you, which is materially less.

**Intercompany.** Matched against unmatched by counterparty, with ageing and netting
opportunity. JPS carries the highest exposure at ₹5.8 cr (§8.2) because it is the holding
entity. The Ingrevia netting row (§2) lives here naturally — a related party, not a group
entity.

**Accruals and provisions.** Accrual exposure ₹6.4 cr for JGL (§8.2), provision adequacy
against actual utilisation, and prior-period accruals reversed or not. **Auto-reversal
failures are a real and rarely monitored source of misstatement** and belong here.

## §16.6 Four more agents

The roster goes from eighteen to twenty-two. §15.2's tables extend; nothing in §15's
rules changes.

| # | Agent | Type | Acts on | Bounded by |
|---|---|---|---|---|
| 19 | Reconciliation clearing | Reactive | Clears matched breaks, proposes journals for the rest | **Proposes only** above a value cap |
| 20 | Intercompany matching | Reactive | Matches balances, proposes netting | **Never posts** the netting entry |
| 21 | Accrual reversal | Reactive | Ensures prior accruals reverse; flags those that did not | Reversal only, never new accruals |
| 22 | Cut-off surveillance | **Preventive** | Flags postings spanning period end, before close | **Advisory** — flags, changes nothing |

Note what none of them do: post a journal. That is deliberate, and it is the same
management-versus-execution line as §15. A journal workflow would make all four posting
agents, and "reversibility over autonomy" would stop being defensible.

**Cut-off surveillance is the one to prioritise.** Cut-off is where most audit adjustments
originate, it is almost never monitored during the month, and it is preventive — which
keeps the preventive ratio moving the right way as the roster grows. Eight of twenty-two.

**The provisioning agent's reversing accrual stays as it is.** It is the one journal that
is self-unwinding, value-capped, precedent-tested, and carries no vendor, tax or payment
consequence. An agent inside a narrow delegation, not a journal workflow.

## §16.7 What this changes elsewhere

**The agent coverage strip closes its biggest gap.** R2R currently renders as "not yet
covered" — honest, and the most visible hole on that screen. Four agents and a cockpit
turn it into the completion of the picture.

**The cross-process trace gets a destination.** §8.10's chain ends at a close-card anchor
today. With an R2R cockpit it lands on a real screen, which makes the trace demonstrate
something rather than merely resolve.

**Mode-awareness finally pays off.** Pre-close readiness, close cockpit and BAU become
three views of a screen that *owns* the calendar rather than reading someone else's.

## §16.8 Data sources

Additions to §6's source table:

| Source | Provides |
|---|---|
| SAP `BKPF`/`BSEG`, `FAGLFLEXA` | Journal population, trial balance movement |
| SAP `CDHDR`/`CDPOS` | Change documents — required for journal risk flags |
| SAP user master + posting timestamps | Preparer, approver, posting hour |
| Reconciliation platform | Break status, certification, evidence |
| Close calendar (new, in-platform) | Tasks, dependencies, owners, escalation |

The close calendar is the only genuinely new dataset. Everything else already has a
source in §6 or comes from an extract already scoped.
