# §18 — Requisitions and the O2C worklist

The two ends of the product that have no screen: the top of the P2P funnel, and every
O2C stage except collection.

---

## §18.0 Why requisitions is not a worklist

The blocked-invoice worklist exists because invoices get stuck and someone has to clear
them. Requisitions are different: a PR is not an exception, it is **work in flight that
is taking too long to convert**. The question is not "what is broken" but "what is not
moving, and why".

So the screen is closer to Commitments watch than to the worklist — a pipeline with
ageing and chase state, not an exception queue.

**The focus is accelerating closure.** Every day a PR sits unconverted is a day of demand
not committed, and — because PR-stage defects surface three stages later as price
mismatches and approval blocks — it is where the cheapest prevention sits.

## §18.1 Requisition pipeline

| Entity | PRs in flight | Converted | Unconverted |
|---|---|---|---|
| JGL | 412 | 386 | 26 |
| JBL | 358 | 335 | 23 |
| JPS | 196 | 184 | 12 |
| JCP | 142 | 133 | 9 |
| JHS | 224 | 210 | 14 |
| JRP | 441 | 413 | 28 |

PRs in flight are the §7.4 PR stage counts; converted equals the PO stage count. The
difference is the unconverted pool, which is the screen's subject. Assert both ties.

**Why a PR is not converting** — this is the PR-stage cause set, distinct from §6.1
which describes exceptions downstream:

```
budget          no budget availability at the cost centre
approval        sitting with a requisition approver
completeness    missing cost centre, GL account or delivery date
sourcing        no vendor determined, or no contract reference
catalogue       free-text for something under contract
duplicate       another PR covers the same need
```

Each unconverted PR carries one, with an age and an owner.

## §18.2 Five requisition agents

The roster goes from twenty-two to twenty-seven. **Four of the five are preventive** —
they act before a PR becomes a downstream exception — which is the second lever operating
at the top of the funnel rather than after it.

| # | Agent | Type | Acts on | Bounded by |
|---|---|---|---|---|
| 23 | Budget exposure | **Preventive** | Reads the Spend Control Tower's availability verdict; flags PRs that will fail conversion and chases the cost centre owner | Advisory — never performs the check itself, never blocks a requisition |
| 24 | Contract and catalogue routing | **Preventive** | Routes free-text to an existing contract or catalogue item | Proposes the contract; the requisitioner accepts |
| 25 | PR completeness | **Preventive** | Fills cost centre, GL and delivery date from the requisitioner's history | Never the vendor, never the value |
| 26 | Duplicate PR | **Preventive** | Flags another PR covering the same need | Flags only — two similar PRs are often both valid |
| 27 | PR ageing and chase | Reactive | Chases the approver, escalates on timer | Nothing — no financial effect |

**Agent 23 consumes the Spend Control Tower; it does not replace it.** SCT intercepts PRs
and POs and performs the budget availability check — that is its control and it stays
there. FCT reads the verdict and owns the finance consequence: which PRs will not convert,
what that does to committed spend, and who needs to reallocate.

Same stance as §1 takes on reconciliation and §16.1 on close tooling. The platform never
re-runs a control another system enforces — it monitors the outcome and acts on it
(§7.8.1, control of the control).

**Note what agents 24 and 26 prevent.** Contract routing prevents the price mismatch that
would otherwise surface at three-way match — 22% of blocked AP. Duplicate PR prevents the
duplicate invoice at INV. That is the compounding argument made concrete: a preventive
agent at PR removes a reactive agent's workload three stages later.

**None of them creates a commitment.** A PR converts to a PO when a human decides it
should. Every one of the five flags, proposes or chases.

## §18.2.1 The ecosystem — what FCT owns and what it consumes

Three products, each owning its own control, with FCT as the layer that reads across
them. Stating the split is what makes the boundary credible; a platform claiming to own
everything is one nobody believes.

| Control | Owned by | FCT's role |
|---|---|---|
| Budget availability at PR and PO | **Spend Control Tower** | Reads the verdict, owns the finance consequence — unconverted PRs, committed spend, who reallocates |
| Reconciliation matching and certification | **Recon AI** | Surfaces break status, ageing and evidence; scores balance sheet integrity from it (§16.5) |
| Invoice capture, OCR, three-way match | **AP automation** | Monitors control effectiveness and bypass, never re-runs the match (§7.8.1) |
| Close orchestration | **FCT** | Owns it — no incumbent tool exists (§16.1) |
| Exception management, root cause, agents | **FCT** | Owns it |

The pattern is consistent: **where a control exists, FCT reads it; where none exists, FCT
owns it.** That is why close orchestration came in scope at §16.1 and why budget
availability does not.

It is also a commercial point. Three products that interlock rather than overlap is an
easier sell than one platform claiming all of it — and each is a separate conversation.

## §18.3 The O2C worklist

Every O2C stage except collection currently drills to Working capital, and cause
elimination has had no forward link for O2C since Step 14 — both for the same reason:
there is no O2C worklist.

The pool is `o2cExceptionCount` from §7.2 — the collection-stage pool, 888 across the
group:

```
JGL 284 · JBL 196 · JPS 84 · JCP 31 · JHS 52 · JRP 241
```

Same grammar as the blocked-invoice worklist: value-ranked, cause-filterable,
multi-select, agent lane, evidence trail, actions. Same §7.20 header — sample against
pool, with denominators following the filter.

Causes are the §6.1 O2C taxonomy, unchanged: billing · pricing · deduction · dispute ·
collection · cash application · customer master.

**What it closes:**

| Was | Becomes |
|---|---|
| O2C stage drills → Working capital | → O2C worklist, filtered to that stage's causes |
| Cause elimination O2C rows → cockpit anchor | → the items |
| Root cause O2C Items → plain number | → the traced items |
| §17.10 drill incomplete for O2C | complete |

## §18.4 O2C stage drills

Same rule as §16 and Step 34 — the screen holding that stage's work, pre-filtered to that
stage's causes, unfiltered by "needs you":

| Stage | Target | Causes |
|---|---|---|
| Order | O2C worklist | customer master |
| Credit check | O2C worklist | collection |
| Delivery | O2C worklist | — full list |
| Billing | O2C worklist | billing · pricing |
| Invoice dispatch | O2C worklist | billing |
| Collection | O2C worklist | collection · dispute |
| Cash application | O2C worklist | cash application · deduction |

## §18.5 What this leaves

After this, every stage in all three cockpits drills to a screen holding that stage's
work, and every root cause register entry can reach its items.

**Working capital is then thin.** Cash attribution answers where cash is stuck and whose
fault; the two worklists answer which items; working capital is left with ageing buckets
and DSO/DPO. Worth revisiting once this lands and you can see what remains on it — but
not before, because the answer depends on what the O2C worklist absorbs.
