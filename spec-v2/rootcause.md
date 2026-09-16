# §17 — Root causes

The register the product has been reaching for since Step 1, and the layer that makes
"eliminated" mean something a client can test.

---

## §17.0 Three layers, not two

What the product calls root cause today is a **cause taxonomy** — a symptom
classification. "Missing GR" says what failed, not why.

```
Symptom        blocked invoice · credit block · unreconciled break
Cause          missing GR · price mismatch          §6.1 — the "what"
Root cause     goods in QC hold · consignment terms  the "why"
```

That gap explains why the interventions on the current screen read as generic. "Escalate
to plant controller after 48 hours" does nothing if the goods are sitting in QC.

Illustratively, for missing GR:

| Root cause | Fix | Owner | Agent |
|---|---|---|---|
| Delivery slipped, PO date stale | Amend the PO date | Procurement | Commitments |
| Received, held in QC release | Chase QC, or auto-hold invoicing | Quality | Follow-up |
| Received, storekeeper has not posted | Chase or auto-post | Plant stores | Follow-up |
| Consignment — GR only on consumption | Move to GR-based invoicing | Commercial | **none** |
| Service PO — no SES raised | Raise the SES | Requisitioner | Provisioning |

Five root causes, five fixes, five owners, four agents and one structural change no agent
can make. **That is the screen.**

## §17.1 What this replaces

- The current **Root cause** screen is deleted. The §6.1 taxonomy survives as a filter
  and a grouping — it is still the comparability layer ("missing GR is 34% in every
  entity") — but it is not a screen.
- **Cause elimination** merges into this register. Its entries become register entries,
  its status counts become the register's, and its mechanism chart stays.
- Cockpit stage drills go to the **worklist filtered by cause**, not to a taxonomy page.

Net: two screens become one, and it answers the question both were reaching for.

## §17.2 One register, group level

Filterable by process, entity, status and owner — **not** split per process. A root cause
like "consignment invoicing structure" produces missing GR in P2P and can produce billing
errors in O2C, and that repetition is only visible in one list.

The filter is also the demo mechanic: enter filtered to P2P from a cockpit, clear the
filter to show the whole register, move on.

## §17.3 The four states

This is the line a client will test. They will pick an entry marked eliminated and ask
what stops it coming back.

```
Eliminated       no new arrivals, no open stock       structurally gone
Fixed at source  no new arrivals, stock draining      inflow stopped, residue falling
In progress      arrivals continue, fix underway      owner and target date
Identified       arrivals continue, no fix yet        you are chasing instances
```

**Resolving an instance is not fixing a cause.** Chasing a QC approver clears that item;
the next receipt hits the same wall. That entry is `identified`, or `in progress` if
something structural is underway — never `fixed at source`.

If clearing cases counted as fixing causes, the register would show green while the same
problems recurred monthly — which is exactly the pattern §7.5 records as "fifth
consecutive month", and exactly what the incumbent does.

**The four eliminated entries must be genuinely structural.** A master data correction, a
changed invoicing arrangement, a tolerance reset, a delegation fix. Nothing that reads as
"we dealt with it".

## §17.4 Triangulation

**"Eliminated" must mean eliminated everywhere.** Click an eliminated entry and:

- its affected items are resolved on the worklist — **zero open**
- the agent that fixed it shows those actions closed in its log
- no new instances arrive

Assert all three. This is the rigor the screen exists to demonstrate, and a client
clicking through to find twenty-three open invoices behind an "eliminated" entry will
discount the whole register.

`Fixed at source` shows its residue with a falling trend. That preserves §7.30's honesty —
eliminating a cause reduces the *rate* of arrival, not the existing pool — while giving
`eliminated` a meaning that survives the click.

## §17.5 Register entry

```ts
interface RootCause {
  id: string;
  parentCause: string;        // §6.1 key — grouping and filter
  process: 'P2P' | 'O2C' | 'R2R';
  why: string;                // "goods held in QC release"
  entityCodes: string[];      // may span entities
  valueCr: number;            // ties to the parent cause, §17.6
  affectedItems: number;      // ties to the parent cause pool, §17.6
  fix: string;
  owner: string;              // named person and function
  agentId?: string;           // absent where no agent can act
  state: 'eliminated' | 'fixed-at-source' | 'in-progress' | 'identified';
  targetDate?: string;        // in-progress only, relative per §7.21
  residueTrend?: number[];    // fixed-at-source only — must fall
}
```

## §17.6 The ties

Three per cause to start — twelve causes, thirty-six entries — growing as the register is
worked. Not a fixed number.

**Values sum to the parent cause.** Missing GR is ₹6.4 cr, so its three root causes sum to
₹6.4 cr. **Item counts sum to the parent cause pool** from §7.20 — missing GR is 111
invoices, so its three sum to 111. Assert both, for every cause.

That is the arithmetic a chartered accountant does unprompted, and it is the reason the
register reads as measurement rather than assertion.

## §17.7 Distribution

| State | Count | |
|---|---|---|
| Eliminated | 4 | Nothing open behind them |
| Fixed at source | 7 | Residue draining |
| In progress | 8 | Owner and target |
| Identified | 17 | No fix yet |

The previous 11 eliminated becomes 4 + 7. In progress grows from 6 to 8. Identified stays
17.

**Four eliminated is honest and seventeen identified is the better argument.** A root
cause with genuinely zero open items is rare, because a fix stops new arrivals long
before existing stock clears. And a register that is mostly green invites the question of
what it is not tracking.

It also gives the demo four entries where "eliminated" survives contact with the worklist
— which is what §17.4 needs. Four that hold up beats eleven that do not.

## §17.8 Agents, and their absence

Some root causes have no agent, deliberately. Moving eleven consignment vendors to
GR-based invoicing is a commercial negotiation, not something an agent does.

Showing which root causes **cannot** be automated is the honest counterpart to the touch
rate in §15.4. A register where every entry has an agent would be less credible, not more.

## §17.9 The traversal, and its boundary

Each affected item carries the path the agent walked to reach its root cause — the
evidence it read and the branch it took at each step:

```
no GR document · no goods movement in MSEG · inbound delivery ETA slipped
```

One line on the item row, expandable on **a few examples only** — enough to show the
mechanism without seeding thirty-six full paths.

The traversal is the audit trail. A controller asking why an item says "QC hold" gets the
path, not a confidence score — the same principle as the decision record in §15.1.2.

**Out of scope, and must not be built:** any screen explaining what a knowledge base is,
how traversal works, what the KB contains, or showing a sample KB. That is a separate
page owned elsewhere. Built here: the path on an item, as data. Not built: the capability
explanation.

## §17.10 Drill

```
Root causes            36+, filtered by process · entity · status · owner
  → one root cause     affected items, fix, owner, agent, register status
    → one item         its traversal, expandable on a few
      → the item       worklist row, PO, or reconciliation break
```
