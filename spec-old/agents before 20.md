# §15 — agentic exception handling

## §15. Agentic exception handling

### 15.1 What the prototype can and cannot show

There is no backend, no LLM and no write-back. The prototype **cannot run agents**, and
must not imply it does. What it can demonstrate is the thing a controller actually
needs to evaluate before agreeing to any of this: the operating model. Who the agents
are, what authority each holds, what bounds them, what they did and why, who supervises
them, and what it does to manual effort.

Label it honestly — but as a product would, not as a pitch would. Agent surfaces carry
`Simulated data` and nothing more. Everything else in this section is reasoning for the
builder and must not appear on screen; see §10.1.

### 15.1.1 Agents have already run — there is no run button

**A button per row means a human triggers each agent. That is a touch added, not
removed**, and it frames this as an assistant the controller drives rather than a
workforce that works. The economics depend on the second.

- Agents run on a cycle. When a controller opens any screen, their work is **already
  done**. The header states it: `agents last ran 06:42 · next cycle 07:00`.
- The worklist header leads with the agents' output, before any row:
  `327 in pool · agents cleared 241 · 86 need you`.
- The **default filter is "needs you"**. A human worklist shows what agents could not
  close. Agent-handled items are one click away, not the default view.
- The row-level interaction is **inspection** — "show me why" — never invocation.
- The only permitted trigger is a **screen-level demo control**, `run the next cycle`,
  explicitly labelled as a demo control. Press it, watch 86 fall to 79. That is honest
  about agents running in cycles and it is the moment people remember.

### 15.1.2 The decision record is a record, not a traversal

Resist animating the agent reasoning its way to an answer. An animated reasoning path
says *look how clever*; a list of tests with values and openable sources says *here is
why, verify it yourself*. For a controller the second wins, and it is what survives an
audit sample.

Structure every agent decision as:

```
trigger        what brought it to the agent
checks         each test, its threshold, the actual value, pass or fail — each openable
precedents     prior cases relied on, each openable
delegation     which authority it acted under, and that it stayed inside it
action         what it did
declined       what it deliberately did NOT do, and why
reversibility  whether this can be unwound, and how
```

**The `declined` line matters more than the action line.** An agent that says "I posted
an accrual rather than a Service Entry Sheet because an SES would assert the service was
delivered" is the single most reassuring thing on the screen for a finance audience.

Two controls sit on the record: `step through this decision`, which reveals one check
at a time for demo purposes, and `override`, which is the human's exit and feeds the
override rate in §15.6.

### 15.2 Agents are staff, not features

This is the design principle everything else follows from. Each agent gets a name, a
scope, a **delegation of authority**, a named human supervisor and a performance record
— exactly as a person would. That is what makes them governable, and governability is
what a controller is buying.

**Eighteen roles, nine built.** Rationale for the builder: eighteen reads as a designed
workforce, twenty-five reads as a list. **None of that goes on screen.** Each card
carries a status of `Active` or `Not active`, and the summary reads `18 roles · 9
active`. Nothing more.

**Shared**

| # | Agent | Type | Acts on | Bounded by | Built |
|---|---|---|---|---|---|
| 1 | Follow-up & escalation | Reactive | Chases owners, escalates on timer | Nothing — no financial effect | ✓ |
| 2 | Master data | Reactive | Completes vendor and customer records | **Never bank details.** Dual control | ✓ |

**Procure to pay — preventive**

| # | Agent | Stage | What it does | Bounded by | Built |
|---|---|---|---|---|---|
| 3 | Commitments | PO | Watches delivery dates, chases owners, amends confirmed slippage | Date only. Requires the owner's reply as evidence | ✓ |
| 4 | Buying compliance | PR → PO | Retrospective-PO risk, PO splitting, off-contract spend, terms deviation | Flags only — never blocks a requisition | |
| 5 | Receipt discipline | GR | GR posting lag by plant and vendor; nudges before the invoice arrives | Advisory. Cannot post a receipt | |
| 6 | Contract price sync | PO | Checks PO price against contract at release | Tolerance band; escalates outside it | |

**Procure to pay — reactive**

| # | Agent | Stage | What it does | Bounded by | Built |
|---|---|---|---|---|---|
| 7 | Approval routing | APR | Reroutes on delegation timeout, auto-approves within DOA | Value threshold, approver-absent test | ✓ |
| 8 | Match resolution | MTC | Accepts price and quantity variance inside tolerance | Tolerance band, contract price precedent | ✓ |
| 9 | Duplicate adjudication | INV | Clears false positives | Must evidence the distinguishing attribute | ✓ |
| 10 | Tax determination | INV | Resolves tax code, HSN and registration mismatches | Codified rules only; jurisdiction-aware (§7.26) | |
| 11 | Provisioning | Pre-close | Posts reversing accruals; SES in a narrow band | Value cap, recurring-service test, prior-period precedent | ✓ |
| 12 | Payment proposal | PAY | Assembles the run — due, discountable, MSMED, critical supply, against balance | Proposes only. **A human releases the run** | |

**Order to cash — preventive**

| # | Agent | Stage | What it does | Bounded by | Built |
|---|---|---|---|---|---|
| 13 | Credit watch | CRD | Flags customers approaching limits before a block occurs | Advisory. Cannot change a limit | |
| 14 | Billing readiness | ORD → BIL | Pre-bill validation: PO reference, ship-to, tax registration, contract price | Flags only; cannot amend an order | |
| 15 | Collections outreach | COL | Pre-due reminders sequenced by payment behaviour, then dunning | Communication only. No settlement authority | |

**Order to cash — reactive**

| # | Agent | Stage | What it does | Bounded by | Built |
|---|---|---|---|---|---|
| 16 | Credit release | CRD | Releases policy-defect blocks | Policy only, **never against exposure** | ✓ |
| 17 | Cash application | CSH | Matches unapplied receipts to open AR | Match confidence threshold, no write-off | ✓ |
| 18 | Deduction triage | COL | Categorises deductions, auto-clears below threshold, routes the rest | Value threshold; disputes always to a human | |

**Seven of eighteen are preventive**, and that ratio is worth defending out loud. A
workforce that is entirely reactive has automated firefighting.

**Four agents are advisory only** — 4, 5, 13 and 14 flag and nudge but change nothing.
That is deliberate. Not every useful agent needs authority, and a catalogue where every
agent acts would be less credible, not more.

**Payment proposal never releases a payment run.** It assembles and proposes; a human
releases. Of everything in this catalogue that is the boundary a controller will look
for first.

### 15.2.0 The lifecycle coverage strip

The roster's most useful element is not the cards — it is a strip showing the seven P2P
and seven O2C stages with agents positioned where they act:

```
PR ──── PO ──── GR ──── INV ──── MTC ──── APR ──── PAY
  │      │       │       │        │        │        │
  4      3,4,6   5       9,10     8        7        12          + 1, 2 across all
                         11 (pre-close)

ORD ─── CRD ─── DLV ─── BIL ──── DSP ──── COL ──── CSH
  │      │               │                 │        │
  14     13,16           14                15,18    17          + 1, 2 across all
```

Preventive agents cluster on the left, reactive ones on the right. A client reads
coverage and gaps in three seconds; eighteen cards read as a list. Colour the two types
differently and let the pattern make the argument.
### 15.2.1 Reactive and preventive agents are different animals

Agents 1 to 6, 8 and 9 are **reactive**: an exception exists and the agent works it.
The commitments agent is **preventive** — it acts before an exception exists, which is
the second lever in §15.3 and the durable one. Group them separately on the roster; a
client who sees only reactive agents concludes you have automated firefighting.

**What the commitments agent actually claims.** Amending a PO date does not stop a
vendor invoicing early, so "it prevents blocks" is overstated and will be tested. What
it does is **keep the commitment data true** — cost centre committed spend, accrual
planning and close exposure all depend on delivery dates being accurate. A PO carrying
a stale delivery date silently corrupts the accrual estimate, which is the ₹6.4 cr
figure in §8.2. The agent protects the accuracy of the pre-close position. That claim
is honest and it lands harder.

**It is also the only agent that acts on a human's reply.** Every other agent reads
system state; this one interprets natural language and then changes a procurement
document. Three consequences:

- The record shows **what the agent understood**, not only what it did — the reply
  quoted, the extracted intent, and the confidence in that reading.
- A misreading must be as visible as a correct reading. Below a confidence threshold
  the agent proposes and escalates rather than amending.
- The amendment notifies the PO owner of exactly what changed, so a wrong reading is
  caught by the person who wrote the reply.

**R2R is deliberately absent.** There is no R2R cockpit in the product yet, so
reconciliation clearing and journal proposal are named as the next process to cover
rather than shown as empty. Say that on the roster: a gap you have named is a gap you
have thought about.

Three rules that hold regardless of pressure on the number:

**Reversibility over autonomy.** An agent prefers the reversible action. A reversing
accrual unwinds itself; a Service Entry Sheet asserts a service was delivered and
creates vendor, tax and payment consequences downstream. In the pre-close window the
provisioning agent posts an accrual, not an SES — the accounting outcome at close is
the same and nothing irreversible happens.

**Release against policy, never against exposure.** The credit agent may clear a block
caused by an uncleared invoice that is not yet due — that is a policy defect, not a
credit judgment. It may not release a customer over its limit. Codify the releasable
set; escalate everything else.

**Precedent must be readable.** An agent cites the prior cases it relied on, and a
human can open them. "The model decided" is the one answer a controller cannot accept.

### 15.3 Two levers, and they compound

Agents resolving exceptions is one lever. **Fewer exceptions arising** is the other,
and it is cheaper and more durable. Model both separately or the productivity glide
path is not defensible over a three-year term.

JGL, illustratively:

```
today                        touchless 54%   460 manual touches per 1,000 invoices
after cause elimination      touchless 62%   380 touches
after agents on the residue  effective 89%   114 touches
```

A 75% reduction, of which roughly a third comes from exceptions never arising. The end
state is an agent working a **shrinking** pool, not a constant one.

### 15.4 Touch economics by entity

Built on the §7.14 touchless rates. Agent-resolvable share derives from each entity's
cause mix — GR and approval together are over half of exceptions and are the most
automatable, which is why the follow-up agent matters more than the clever ones.

| Entity | Touchless | Manual | Agent-resolved | Human | Touches / 1,000 |
|---|---|---|---|---|---|
| JCP | 78% | 22% | 16.5% | 5.5% | 220 → 55 |
| JHS | 71% | 29% | 21.5% | 7.5% | 290 → 75 |
| JPS | 62% | 38% | 27.4% | 10.6% | 380 → 106 |
| JGL | 54% | 46% | 32.2% | 13.8% | 460 → 138 |
| JBL | 46% | 54% | 36.7% | 17.3% | 540 → 173 |
| JRP | 41% | 59% | 39.5% | 19.5% | 590 → 195 |

**Commit to touches per thousand, not to an automation percentage.** "95% touchless" is
a claim the client tests on day one and you defend for three years. A falling
touch-rate measured on the platform is the same economics and it is yours to prove
rather than theirs to disprove.

Agent-resolvable share by cause, for JGL's mix:

| Cause | Share of exceptions | Agent-resolvable |
|---|---|---|
| goods receipt | 34% | 75% |
| pricing | 22% | 60% |
| approval | 18% | 80% |
| vendor master | 11% | 50% |
| duplicate | 8% | 85% |
| tax | 7% | 65% |

### 15.5 Data model

```ts
interface Agent {
  id: string;                    // 'follow-up'
  name: string;                  // 'Follow-up agent'
  scope: string;
  delegation: Delegation;
  supervisor: string;            // a named human from the §7.17 pool
  status: 'active' | 'paused' | 'shadow';
  metrics: AgentMetrics;
}

interface Delegation {
  valueCapCr?: number;
  toleranceBand?: string;
  requiresDualControl: boolean;
  neverActsOn: string[];         // e.g. ['vendor bank details']
  escalatesWhen: string[];
}

interface AgentMetrics {
  actionsThisPeriod: number;
  resolvedWithoutHuman: number;
  escalated: number;
  overriddenByHuman: number;
  reversed: number;
  valueActedOnCr: number;
  valueActedOnWithoutReviewCr: number;
}

interface AgentAction {
  id: string;
  agentId: string;
  targetType: 'exception' | 'request' | 'creditBlock';
  targetId: string;
  entityCode: string;
  takenAt: string;               // relative per §7.21
  action: string;                // 'Chased plant stores, 2nd nudge'
  outcome: 'resolved' | 'escalated' | 'awaiting' | 'reversed' | 'overridden';
  rationale: string;
  precedents: string[];          // ids a human can open
  evidence: string[];
  reversible: boolean;
  withinDelegation: true;
  reviewedBy?: string;
}
```

### 15.5.1 One screen, not two

An agent's identity and its performance are the same object — a roster screen and a
monitoring screen would be two views of one thing. Merge them.

Three layers, matching the rest of the product's group → entity → detail grammar:

```
Workforce summary   9 live of 18 roles · actions this period · resolved without
                    human · escalated · overridden · reversed
Coverage strip      §15.2.0 — stages across, agents positioned, preventive and
                    reactive coloured differently
Agent list          grouped Shared / P2P / O2C, preventive before reactive within
                    each, matching the strip. Sortable by escalation and override
                    rate, because that is how you find a mis-set delegation
```

Each live agent shows actions, resolved share, escalation rate, override rate and a
trend. Each `designed` agent shows the delegation it *would* hold, greyed, with dashes
where metrics would be — the same honest-absence pattern as the unmeasurable SLAs in
§7.7, and it makes the live/designed distinction impossible to miss.

Clicking an agent opens its record: full delegation, named supervisor, its own action
log, performance over time.

### 15.6 Agent governance sits on Risk & control

There are two questions about agents, with two audiences, and they need two homes:

| Question | Asked by | Where it belongs |
|---|---|---|
| How is my agent workforce performing? | Service delivery lead | The Agents screen — the full picture |
| Are these agents safely bounded, and can we evidence it? | Financial Controller, audit | Risk & control — exceptions and exposure only |

That is not duplication; it is the same split as health score versus service scorecard
(§4). The rule: **Risk & control shows what needs attention, the Agents screen shows how
the workforce is doing.**

Put the governance slice on Risk & control, not on a separate screen, because that is
where a controller looks for control exceptions. It carries only:
delegation breaches, reversals, overrides, and **value acted on without human review** —
the figure an auditor asks for first. Each drills into the agent's record.

Full metric set, split across the two screens:

```
Agents screen         action volume · resolved without human · escalation rate
                      · override rate · reversal rate · trend
Risk & control        delegation breaches · reversals · overrides
                      · value acted on without human review
```

A Big 4 firm deploying agents into a regulated client's finance function must be able
to evidence how they behaved. Rising override or reversal rates are the signal a
delegation is set wrong; a rising escalation rate is the signal the policy needs
updating, not that the agent is failing.

### 15.7 Screens

| Screen | Purpose |
|---|---|
| **Agents** | One screen: the workforce and how it is performing. Roster and monitoring are the same object |
| Agent detail | Delegation, supervisor, action log filtered to that agent, performance over time |
| Touch economics | The funnel and the two levers, per entity |
| Agent governance | Exceptions and exposure only, sitting inside Risk & control |
| Commitments watch | Open POs by delivery date, chase state, amendments, value at risk of slipping |
| PO detail | Timeline of the agent–owner exchange, reusing the exception-detail grammar |

Plus changes to existing screens:

- **Worklist** gains an agent lane per row: `agent working` / `agent resolved` /
  `escalated to you`. Human worklists should show only what agents could not close.
- **Exception detail** interleaves agent actions into the existing lifecycle timeline,
  visually distinct from human ones.
- **Root cause** shows agent-resolvable share per cause, so it is obvious which causes
  are worth eliminating versus automating.
- **Cause elimination** distinguishes *eliminated* from *automated* — a cause handled
  by an agent forever is a treated symptom, not a solved problem.

### 15.8 What must never be automated

State this on the roster screen, unprompted. It is more persuasive than the
capability list.

```
Vendor bank detail changes           Provisions requiring judgment
Anything outside a stated tolerance  Cut-off decisions at period end
Novel cases with no precedent        Statutory sign-off
Credit release against exposure      Anything an agent has already escalated twice
```
