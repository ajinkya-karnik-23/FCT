# Spec 03 — Types and mock data

All data below is fabricated for a bid demo. Keep it in a mock API layer
(`src/api/mock/*`), never inside components. Components call the API layer only.

## Types

```ts
type Status = 'GREEN' | 'AMBER' | 'RED';

interface Entity {
  code: string;            // 'JGL'
  name: string;
  score: number;           // 0-100
  status: Status;          // derived from score, stored here only for convenience
  dims: [number, number, number, number, number]; // Close, Control, WorkingCapital, Process, Service
  apBlocked: number;       // ₹ cr
  arOver90: number;
  cashUnapplied: number;
  closePct: number;
  controlBreaches: number;
}

interface ProcessStage {
  processKey: 'p2p' | 'o2c' | 'r2r';
  step: string;            // 'INV'
  name: string;            // 'Invoice'
  volume: number;
  value: number;           // ₹ cr
  exceptionPct: number;
  status: Status;
}

interface Exception {
  id: string;              // 'AP-104281'
  entityCode: string;
  processKey: 'p2p';
  vendor: string;
  amount: number;          // ₹ cr
  ageDays: number;
  reasonKey: string;       // taxonomy key
  plant: string;
  owner: string;
  controlImpact: 'High' | 'Medium' | 'Low';
  po: string;
  bookedOn: string;        // '14 Jul 2026'
}

interface CauseNode {
  processKey: 'p2p' | 'o2c' | 'r2r';
  key: string;             // 'missing-gr'
  name: string;            // 'Missing GR'
  sharePct: number;
  valueAtRisk: number;     // ₹ cr
  avgDelayDays: number;
  recurrence: string;      // '5th month'
  concentration: string;   // '11 vendors'
  narrative: string;
  plants: { name: string; pct: number }[];
  vendors: { name: string; pct: number }[];
  actions: string[];
}

interface CashOpportunity { name: string; value: number; items: number; effort: 'Low'|'Medium'|'High'; owner: string; }
```

Health score weights (not shown in the UI): Close 25%, Control 25%, Working capital 20%,
Process 15%, Service 15%.

## Entities (6)

| code | name | score | dims (Close, Control, WC, Process, Service) | apBlocked | arOver90 | cashUnapplied | closePct | breaches |
|---|---|---|---|---|---|---|---|---|
| JGL | Jubilant Generics Ltd | 74 | 78, 46, 58, 82, 70 | 18.6 | 12.4 | 3.1 | 78 | 4 |
| JIL | Jubilant Ingrevia Ltd | 88 | 92, 84, 81, 90, 88 | 4.2 | 3.8 | 0.6 | 94 | 0 |
| JBS | Jubilant Biosys Ltd | 67 | 58, 52, 61, 74, 66 | 11.3 | 8.9 | 2.4 | 61 | 6 |
| JPS | Jubilant Pharma Pte (SG) | 81 | 86, 72, 74, 84, 80 | 6.8 | 5.1 | 1.2 | 88 | 2 |
| JCL | Jubilant Cadista LLC | 91 | 95, 90, 86, 92, 90 | 2.1 | 1.9 | 0.3 | 96 | 0 |
| JLS | Jubilant Life Sciences NV | 58 | 48, 44, 55, 68, 62 | 14.7 | 10.6 | 4.0 | 52 | 7 |

Group aggregates shown on the group view: score 76.5, value at risk ₹92.4 cr,
open exceptions 1,486.

## P2P stages (7)

| step | name | volume | value | exception % | status |
|---|---|---|---|---|---|
| PR | Requisition | 4182 | 62.1 | 4 | GREEN |
| PO | Purchase order | 3914 | 58.4 | 6 | GREEN |
| GR | Goods receipt | 3502 | 51.2 | 19 | RED |
| INV | Invoice | 1243 | 18.6 | 26 | RED |
| MTC | Three-way match | 916 | 14.2 | 22 | AMBER |
| APR | Approval | 589 | 8.9 | 12 | AMBER |
| PAY | Payment | 412 | 6.1 | 3 | GREEN |

## Exceptions (12, all entity JGL, process p2p)

| id | vendor | amount | age | reason | plant | owner | control | po | booked |
|---|---|---|---|---|---|---|---|---|---|
| AP-104281 | Suraksha Chemicals Pvt Ltd | 2.84 | 41 | Missing GR | Nanjangud | P. Nair | High | PO-4471902 | 14 Jul 2026 |
| AP-104306 | Zenith Packaging Industries | 1.96 | 37 | PO price mismatch | Roorkee | A. Sethi | Medium | PO-4472118 | 18 Jul 2026 |
| AP-104355 | Meridian Logistics Services | 1.42 | 34 | Approval pending | Ambernath | R. Iyer | Low | PO-4472884 | 21 Jul 2026 |
| AP-104402 | Kaveri Solvents Ltd | 1.28 | 52 | Missing GR | Nanjangud | P. Nair | High | PO-4470553 | 03 Jul 2026 |
| AP-104417 | Orion Instruments Pvt Ltd | 0.96 | 29 | Vendor master | Noida | S. Rao | Medium | PO-4473201 | 26 Jul 2026 |
| AP-104458 | Balaji Engineering Works | 0.88 | 46 | Missing GR | Roorkee | A. Sethi | High | PO-4471044 | 09 Jul 2026 |
| AP-104473 | Deccan Speciality Gases | 0.74 | 21 | Duplicate suspicion | Nanjangud | P. Nair | High | PO-4473688 | 02 Aug 2026 |
| AP-104501 | Trident Maintenance Co | 0.68 | 18 | Approval pending | Ambernath | R. Iyer | Low | PO-4473912 | 05 Aug 2026 |
| AP-104522 | Nova Analytical Labs | 0.61 | 33 | PO price mismatch | Noida | S. Rao | Medium | PO-4472470 | 20 Jul 2026 |
| AP-104570 | Shakti Power Systems | 0.54 | 12 | Tax mismatch | Roorkee | A. Sethi | Low | PO-4474355 | 11 Aug 2026 |
| AP-104588 | Ganga Freight Movers | 0.47 | 27 | Missing GR | Ambernath | R. Iyer | Medium | PO-4472996 | 24 Jul 2026 |
| AP-104611 | Vertex Lab Consumables | 0.39 | 9 | Vendor master | Noida | S. Rao | Low | PO-4474612 | 14 Aug 2026 |

SLA breach days = `max(1, ageDays - 15)`.

## P2P root-cause taxonomy (6, fixed)

The taxonomy is deterministic reference data. AI classifies and explains **within** it and must never
invent a cause.

**Missing GR** — 34%, ₹6.3 cr, avg delay 8.4 days, 5th month, 11 vendors.
Narrative: "Invoices for Nanjangud and Roorkee remain blocked because goods receipts are posted after
invoice receipt. 62% of affected invoices relate to 11 vendors on consignment terms; average GR lag is
8.4 days and the pattern has repeated for five consecutive months."
Plants: Nanjangud 43, Roorkee 29, Ambernath 18, Noida 10.
Vendors: Consignment chemicals 38, Packaging 27, Logistics 21, Other 14.
Actions: GR compliance alert for the top 11 vendor/plant pairs · Auto-escalate to plant controller
after 48 hours · Move consignment vendors to GR-based invoicing.

**PO price mismatch** — 22%, ₹4.1 cr, 6.1 days, 3rd month, 4 contracts.
Narrative: "Price differences arise where contract escalations were signed but not loaded into the
purchasing info record. Four contracts account for 71% of the variance value; buyers resolve them
manually each cycle."
Plants: Roorkee 41, Noida 27, Nanjangud 20, Ambernath 12.
Vendors: Solvents 34, Instruments 28, Packaging 22, Other 16.
Actions: Sync contract escalations to info records monthly · Tolerance review with category managers ·
Block PO release when the price source is stale.

**Approval pending** — 18%, ₹3.2 cr, 5.3 days, 2nd month, 7 approvers.
Narrative: "Approvals stall with seven approvers who hold 64% of pending items, concentrated in
indirect spend above ₹10 lakh. Delegation is not maintained during travel."
Plants: Ambernath 36, Noida 31, Roorkee 19, Nanjangud 14.
Vendors: Services 44, Maintenance 26, Logistics 18, Other 12.
Actions: Enforce the delegation-of-authority calendar · Reminder at 24h, escalation at 72h ·
Reduce approval tiers below ₹10 lakh.

**Vendor master** — 11%, ₹1.8 cr, 4.2 days, 4th month, 23 records.
Narrative: "Bank and GST details fail validation on 23 vendor records created in the last quarter,
mostly for one-time service vendors onboarded outside the standard workflow."
Plants: Noida 39, Ambernath 28, Roorkee 21, Nanjangud 12.
Vendors: Services 51, Consumables 24, Logistics 15, Other 10.
Actions: Close the manual onboarding route · Validate bank details at creation, not at payment ·
Quarterly dormant-vendor purge.

**Duplicate suspicion** — 8%, ₹0.9 cr, 3.6 days, 1st month, 9 pairs.
Narrative: "Nine invoice pairs are flagged where the same document is submitted through both the
vendor portal and email intake. All are held pending manual confirmation."
Plants: Nanjangud 34, Roorkee 30, Noida 22, Ambernath 14.
Vendors: Chemicals 40, Packaging 25, Services 20, Other 15.
Actions: Single intake channel per vendor · Fuzzy duplicate check at capture · Auto-clear matched
pairs after 5 days.

**Tax mismatch** — 7%, ₹0.7 cr, 4.9 days, 2nd month, 2 states.
Narrative: "GST place-of-supply is misapplied on interstate service invoices in two states, requiring
credit notes before booking."
Plants: Roorkee 46, Noida 24, Ambernath 18, Nanjangud 12.
Vendors: Services 55, Logistics 23, Other 22.
Actions: Place-of-supply rule in the capture template · Vendor education pack for two states ·
Pre-booking tax validation.

O2C and R2R taxonomies exist in the product design but are out of scope for this build. Model them
the same way when they are needed: O2C — billing, pricing, deduction, dispute, collection, cash
application, customer master. R2R — source data, journal, reconciliation, intercompany, master data,
interface, close dependency, accounting judgment.

## Other datasets

Blocked-invoice ageing (P2P view): 0-15 d ₹5.9 cr · 16-30 d ₹4.2 cr · 31-60 d ₹4.1 cr ·
61-90 d ₹2.6 cr · > 90 d ₹1.8 cr.

Receivables ageing (working capital): 0-30 d ₹24.1 cr · 31-60 d ₹11.6 cr · 61-90 d ₹8.2 cr ·
91-180 d ₹7.4 cr · > 180 d ₹5.0 cr.

Payables blocked by reason (working capital): Missing GR ₹6.3 cr · PO price mismatch ₹4.1 cr ·
Approval pending ₹3.2 cr · Vendor master ₹1.8 cr · Duplicate / tax ₹1.6 cr.

Cash opportunities: Release invoices where GR posted this week — ₹4.2 cr, 38 items, Low, P2P tower ·
Apply matched receipts to open AR — ₹2.1 cr, 19, Low, Cash application · Settle pricing disputes
under ₹10 lakh — ₹1.4 cr, 27, Medium, Collections · Clear intercompany netting with Ingrevia —
₹3.6 cr, 4, Medium, R2R tower.

Group-wide recurring causes: Missing GR (P2P) 26% · Pricing disputes (O2C) 21% ·
Interface breaks (R2R) 18% · Approval delays (P2P) 14%.

Close progress (group view): 71% of 214 tasks, 19 overdue, 6 blockers, 3 entities at risk.

Transformation health (group view): automation rate 68% ↑ · repeat exceptions −14% QoQ ·
causes eliminated 11 of 34 · touchless invoices 54%.

Service & control (P2P view): SLA on invoice booking 93.1% · queries overdue 27 ·
duplicate payment risk ₹0.9 cr · manual payment runs 4.
