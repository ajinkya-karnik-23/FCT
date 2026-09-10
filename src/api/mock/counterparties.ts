import type { AgeingBucket, CostCentre, Counterparty, PlantCounterparty } from '../types';
import { entities, fnv1a, mulberry32 } from './entities';
import { ANCHOR, addDays, exceptions, fmtDate } from './exceptions';
import { forecasts } from './misc';
import { stagesFor } from './stages';

// §7.24 — counterparty pages as first-class objects. Vendors derive from the §7.17 exception rows (no new vendor
// dataset) and tie to the sampled worklist; customers are the ones already named in the §7.23 forecast drivers; plants
// are a fixed complete set that ties to the entity's blocked-AP POOL via the §7.24 overall plant shares — every one of
// the entity's blocked invoices sits at a plant, so a plant page shows what its manager is accountable for, not just
// the sampled rows; and cost centres are the only genuinely new dataset — their committed spend ties to the PO stage
// in-flight value (§7.4). All sums use integer-paise math so every reconciliation tie holds exactly.

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const paise = (cr: number) => Math.round(cr * 100);

// Largest-remainder allocation of an integer total across weights — the result sums exactly to the total.
// Mirrors allocateBreaches in misc.ts; deterministic tie-break by index order.
function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum || !total) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let remainder = total - out.reduce((a, b) => a + b, 0);
  for (const { i } of raw.map((v, i) => ({ frac: v - Math.floor(v), i })).sort((a, b) => b.frac - a.frac || a.i - b.i)) {
    if (!remainder) break;
    out[i] += 1;
    remainder -= 1;
  }
  return out;
}

// Labels reuse the two existing ageing vocabularies (getBlockedInvoiceAgeing / getReceivablesAgeing in misc.ts).
const BLOCKED_BUCKETS = ['0-15 d', '16-30 d', '31-60 d', '61-90 d', '> 90 d'];
const RECEIVABLES_BUCKETS = ['0-30 d', '31-60 d', '61-90 d', '91-180 d', '> 180 d'];

function blockedBucketIndex(ageDays: number): number {
  if (ageDays <= 15) return 0;
  if (ageDays <= 30) return 1;
  if (ageDays <= 60) return 2;
  if (ageDays <= 90) return 3;
  return 4;
}

function bucketsFromPaise(labels: string[], paiseByBucket: number[]): AgeingBucket[] {
  // Each paisa value divides to at most 2dp, so the rounded values sum exactly to the total.
  return labels.map((label, i) => ({ label, value: Math.round(paiseByBucket[i] / 100) })).filter((b) => b.value > 0);
}

export const counterparties: Counterparty[] = [];

for (const e of entities) {
  const rows = exceptions.filter((x) => x.entityCode === e.code);

  // --- Vendors — grouped from the entity's exception rows, first-appearance order (the worklist's own ordering).
  const vendorNames: string[] = [];
  for (const x of rows) if (!vendorNames.includes(x.vendor)) vendorNames.push(x.vendor);
  const groups = vendorNames.map((name) => ({ name, items: rows.filter((x) => x.vendor === name) }));

  // §7.24 tie — open commitments across the entity's vendors sum to its PO stage in-flight value (§7.25 per-entity table).
  const poInFlightPaise = paise(stagesFor(e.code).find((s) => s.processKey === 'p2p' && s.step === 'PO')!.inFlightValue);
  const commitmentPaise = allocate(
    poInFlightPaise,
    groups.map((g) => g.items.reduce((sum, x) => sum + paise(x.amount), 0) + 100) // weight: blocked value plus a base so small vendors still carry open POs
  );

  groups.forEach(({ name, items }, i) => {
    const blockedPaise = items.reduce((sum, x) => sum + paise(x.amount), 0);
    const disputesPaise = items.filter((x) => x.reasonKey === 'po-price-mismatch').reduce((sum, x) => sum + paise(x.amount), 0);
    const bucketPaise = BLOCKED_BUCKETS.map(() => 0);
    for (const x of items) bucketPaise[blockedBucketIndex(x.ageDays)] += paise(x.amount);

    // YTD spend and last payment are generated against the stated constraints — a multiple of blocked value in
    // [8, 18), and a payment inside the last month. Seeded per vendor (no Math.random).
    const rng = mulberry32(fnv1a(`${e.code}:vendor:${name}`));
    const ytdSpendCr = Math.round((blockedPaise / 100) * (8 + rng() * 10) * 10) / 10;
    const lastPaymentDate = fmtDate(addDays(ANCHOR, -(5 + Math.floor(rng() * 40))));

    counterparties.push({
      id: slug(name),
      name,
      type: 'vendor',
      entityCode: e.code,
      openCommitmentsCr: commitmentPaise[i] / 100,
      blockedCr: blockedPaise / 100,
      disputesCr: disputesPaise / 100,
      ageingBuckets: bucketsFromPaise(BLOCKED_BUCKETS, bucketPaise),
      lastPaymentDate,
      ytdSpendCr,
      openItems: items.map((x) => x.id),
    });
  });

  // --- Customers — the ones already named in this entity's §7.23 forecast drivers ('Cash awaiting application' has none).
  const fc = forecasts.find((f) => f.entityCode === e.code)!;
  for (const d of fc.drivers) {
    const sep = d.label.indexOf(' — ');
    if (sep < 0) continue;
    const name = d.label.slice(0, sep);
    const issue = d.label.slice(sep + ' — '.length); // 'pricing dispute' | 'deduction unresolved' | 'credit block'
    const creditBlocked = issue === 'credit block';

    // Payment behaviour reuses the O2C cause narrative vocabulary (causes.ts) — not invented here.
    const paymentBehaviour =
      issue === 'pricing dispute'
        ? 'Short-pays against contracted rates revised mid-quarter but not reflected on the invoice'
        : issue === 'deduction unresolved'
          ? 'Deducts scheme, damage and freight claims at payment without reference to an approved credit note'
          : 'Clean payment record; orders held on a stale credit limit awaiting manual review';

    // Release path — the forecast action that releases this block, with its owner.
    const release = fc.actions.find((a) => a.action.includes(name));
    const releasePath = creditBlocked && release ? `${release.action} — ${release.owner}` : undefined;

    // Ageing over the receivables labels, seeded per customer and allocated so it sums exactly to exposure.
    const rng = mulberry32(fnv1a(`${e.code}:customer-ageing:${d.id}`));
    const bucketPaise = allocate(paise(d.valueCr), RECEIVABLES_BUCKETS.map(() => 0.5 + rng()));

    counterparties.push({
      id: d.id, // stable identity — the Predictive driver row drills here by this id (§7.23)
      name,
      type: 'customer',
      entityCode: e.code,
      openCommitmentsCr: 0,
      blockedCr: 0,
      disputesCr: creditBlocked ? 0 : d.valueCr,
      ageingBuckets: bucketsFromPaise(RECEIVABLES_BUCKETS, bucketPaise),
      exposureCr: d.valueCr,
      creditBlocked,
      paymentBehaviour,
      releasePath,
      openItems: [],
    });
  }
}

export const plants: PlantCounterparty[] = [];

// §7.24 — overall plant shares per entity (the split of ALL blocked value, not the within-cause split in §7.5). Names
// reuse the exceptions.ts site vocabulary so openItems matching stays exact.
const PLANT_SHARES: Record<string, [string, number][]> = {
  JGL: [['Nanjangud', 43], ['Roorkee', 29], ['Ambernath', 18], ['Noida', 10]],
  JBL: [['Bengaluru', 62], ['Noida', 38]],
  JPS: [['Singapore', 100]],
  JCP: [['Salisbury, MD', 100]],
  JHS: [['Spokane, WA', 58], ['Montreal, QC', 42]],
  JRP: [['Kirkland, QC', 55], ['US radiopharmacy network', 45]],
};

for (const e of entities) {
  const rows = exceptions.filter((x) => x.entityCode === e.code);
  // §7.24 — plants tie to the POOL: Σ plant blocked = entity blocked AP, allocated by integer paise so the tie is exact.
  const poolPaise = paise(e.metrics.apBlocked.current);
  const shares = PLANT_SHARES[e.code];
  const alloc = allocate(poolPaise, shares.map(([, pct]) => pct));

  shares.forEach(([name], i) => {
    const valuePaise = alloc[i];
    plants.push({
      id: `${e.code.toLowerCase()}-${slug(name)}`,
      name,
      entityCode: e.code,
      blockedCr: valuePaise / 100,
      grCompliancePct: Math.round((98 - 0.12 * ((valuePaise / poolPaise) * 100)) * 10) / 10, // worst at the plant carrying most of the block (§7.5 — Nanjangud is JGL's worst)
      openItems: rows.filter((x) => x.plant === name).map((x) => x.id),
    });
  });
}

// §7.24 — cost centres are the only genuinely new dataset (the spec's list, verbatim names). Committed spend is open
// POs not yet invoiced: per entity it sums to the PO stage in-flight value (§7.4), and each centre's PO list sums to
// its committed figure. JGL Nanjangud Operations, JBL Lab Operations and JRP Regulatory run over budget once
// commitments land (§7.28 — booked + committed > budget while booked alone stays within plan).
export const costCentres: CostCentre[] = [
  { id: 'jgl-roorkee-operations', name: 'Roorkee Operations', entityCode: 'JGL', budgetCr: 62.0, bookedSpendCr: 41.2, committedSpendCr: 19.6, openPos: [{ po: 'PO-48211', valueCr: 6.4 }, { po: 'PO-48307', valueCr: 5.2 }, { po: 'PO-48412', valueCr: 4.1 }, { po: 'PO-48520', valueCr: 3.9 }] },
  { id: 'jgl-nanjangud-operations', name: 'Nanjangud Operations', entityCode: 'JGL', budgetCr: 71.0, bookedSpendCr: 47.5, committedSpendCr: 23.8, openPos: [{ po: 'PO-47902', valueCr: 8.6 }, { po: 'PO-48115', valueCr: 7.4 }, { po: 'PO-48260', valueCr: 4.8 }, { po: 'PO-48391', valueCr: 3.0 }] },
  { id: 'jgl-quality-regulatory', name: 'Quality & Regulatory', entityCode: 'JGL', budgetCr: 24.0, bookedSpendCr: 15.8, committedSpendCr: 7.2, openPos: [{ po: 'PO-48533', valueCr: 4.3 }, { po: 'PO-48610', valueCr: 2.9 }] },
  { id: 'jgl-corporate', name: 'Corporate', entityCode: 'JGL', budgetCr: 26.0, bookedSpendCr: 12.4, committedSpendCr: 7.8, openPos: [{ po: 'PO-48644', valueCr: 4.6 }, { po: 'PO-48701', valueCr: 3.2 }] },
  { id: 'jbl-discovery-services', name: 'Discovery Services', entityCode: 'JBL', budgetCr: 58.0, bookedSpendCr: 33.6, committedSpendCr: 14.2, openPos: [{ po: 'PO-51204', valueCr: 6.8 }, { po: 'PO-51377', valueCr: 5.4 }, { po: 'PO-51482', valueCr: 2.0 }] },
  { id: 'jbl-lab-operations', name: 'Lab Operations', entityCode: 'JBL', budgetCr: 60.0, bookedSpendCr: 44.2, committedSpendCr: 16.8, openPos: [{ po: 'PO-50988', valueCr: 7.6 }, { po: 'PO-51102', valueCr: 6.2 }, { po: 'PO-51266', valueCr: 3.0 }] },
  { id: 'jbl-corporate', name: 'Corporate', entityCode: 'JBL', budgetCr: 30.0, bookedSpendCr: 17.9, committedSpendCr: 4.5, openPos: [{ po: 'PO-51530', valueCr: 2.6 }, { po: 'PO-51618', valueCr: 1.9 }] },
  { id: 'jps-group-treasury', name: 'Group Treasury', entityCode: 'JPS', budgetCr: 96.0, bookedSpendCr: 58.4, committedSpendCr: 12.9, openPos: [{ po: 'PO-73021', valueCr: 6.4 }, { po: 'PO-73155', valueCr: 4.2 }, { po: 'PO-73290', valueCr: 2.3 }] },
  { id: 'jps-corporate-services', name: 'Corporate Services', entityCode: 'JPS', budgetCr: 68.0, bookedSpendCr: 41.7, committedSpendCr: 8.5, openPos: [{ po: 'PO-73344', valueCr: 4.8 }, { po: 'PO-73478', valueCr: 3.7 }] },
  { id: 'jcp-salisbury-operations', name: 'Salisbury Operations', entityCode: 'JCP', budgetCr: 72.0, bookedSpendCr: 44.8, committedSpendCr: 2.8, openPos: [{ po: 'PO-81042', valueCr: 1.6 }, { po: 'PO-81177', valueCr: 1.2 }] },
  { id: 'jcp-commercial', name: 'Commercial', entityCode: 'JCP', budgetCr: 52.0, bookedSpendCr: 30.2, committedSpendCr: 2.2, openPos: [{ po: 'PO-81355', valueCr: 1.3 }, { po: 'PO-81468', valueCr: 0.9 }] },
  { id: 'jcp-corporate', name: 'Corporate', entityCode: 'JCP', budgetCr: 38.0, bookedSpendCr: 22.6, committedSpendCr: 1.6, openPos: [{ po: 'PO-81523', valueCr: 0.9 }, { po: 'PO-81640', valueCr: 0.7 }] },
  { id: 'jhs-spokane-sterile-ops', name: 'Spokane Sterile Ops', entityCode: 'JHS', budgetCr: 66.0, bookedSpendCr: 39.4, committedSpendCr: 5.4, openPos: [{ po: 'PO-90233', valueCr: 2.8 }, { po: 'PO-90358', valueCr: 1.6 }, { po: 'PO-90471', valueCr: 1.0 }] },
  { id: 'jhs-montreal-ops', name: 'Montreal Ops', entityCode: 'JHS', budgetCr: 70.0, bookedSpendCr: 42.8, committedSpendCr: 5.0, openPos: [{ po: 'PO-90102', valueCr: 2.9 }, { po: 'PO-90287', valueCr: 2.1 }] },
  { id: 'jhs-quality', name: 'Quality', entityCode: 'JHS', budgetCr: 26.0, bookedSpendCr: 14.6, committedSpendCr: 2.8, openPos: [{ po: 'PO-90544', valueCr: 1.6 }, { po: 'PO-90619', valueCr: 1.2 }] },
  { id: 'jrp-radiopharmacy-network', name: 'Radiopharmacy Network', entityCode: 'JRP', budgetCr: 78.0, bookedSpendCr: 43.9, committedSpendCr: 20.2, openPos: [{ po: 'PO-60118', valueCr: 9.4 }, { po: 'PO-60245', valueCr: 7.0 }, { po: 'PO-60372', valueCr: 3.8 }] },
  { id: 'jrp-kirkland-manufacturing', name: 'Kirkland Manufacturing', entityCode: 'JRP', budgetCr: 62.0, bookedSpendCr: 38.4, committedSpendCr: 15.4, openPos: [{ po: 'PO-60433', valueCr: 8.6 }, { po: 'PO-60527', valueCr: 6.8 }] },
  { id: 'jrp-regulatory', name: 'Regulatory', entityCode: 'JRP', budgetCr: 23.5, bookedSpendCr: 13.2, committedSpendCr: 10.6, openPos: [{ po: 'PO-60611', valueCr: 6.2 }, { po: 'PO-60749', valueCr: 4.4 }] },
];
