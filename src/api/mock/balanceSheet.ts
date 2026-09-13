import type { AccrualReversal, AgeingBucket, IntegrityComponents, IntercompanyCounterparty, JournalRiskFlag, JournalRiskPopulation, ReconSummary } from '../types';

// §16.4 — balance sheet integrity: the weighted composite of six components (weights sum to 1). The index is
// computed at read time, never stored; it feeds the risk dimension but does not become a seventh one.
export const INTEGRITY_WEIGHTS = { reconciliation: 0.25, intercompany: 0.2, grIrExposure: 0.2, unappliedCash: 0.15, provisionAdequacy: 0.1, cutOffIntegrity: 0.1 } as const;

// §16.4 — the five components not already in EntityMetrics (provision adequacy is provisionAdequacyPct there).
export const integrityComponentsByEntity: Record<string, IntegrityComponents> = {
  JGL: { reconciliation: 68, intercompany: 70, grIrExposure: 62, unappliedCash: 74, cutOffIntegrity: 78 },
  JBL: { reconciliation: 60, intercompany: 64, grIrExposure: 58, unappliedCash: 70, cutOffIntegrity: 72 },
  JPS: { reconciliation: 80, intercompany: 74, grIrExposure: 82, unappliedCash: 86, cutOffIntegrity: 88 },
  JCP: { reconciliation: 94, intercompany: 92, grIrExposure: 94, unappliedCash: 96, cutOffIntegrity: 92 },
  JHS: { reconciliation: 90, intercompany: 88, grIrExposure: 92, unappliedCash: 94, cutOffIntegrity: 90 },
  JRP: { reconciliation: 51, intercompany: 56, grIrExposure: 50, unappliedCash: 62, cutOffIntegrity: 66 },
};

// §16.4 — the weighted composite, rounded to an integer at read time (never stored).
export function integrityIndex(c: IntegrityComponents, provisionAdequacy: number): number {
  return Math.round(
    c.reconciliation * INTEGRITY_WEIGHTS.reconciliation +
      c.intercompany * INTEGRITY_WEIGHTS.intercompany +
      c.grIrExposure * INTEGRITY_WEIGHTS.grIrExposure +
      c.unappliedCash * INTEGRITY_WEIGHTS.unappliedCash +
      provisionAdequacy * INTEGRITY_WEIGHTS.provisionAdequacy +
      c.cutOffIntegrity * INTEGRITY_WEIGHTS.cutOffIntegrity
  );
}

// §16.5/§16.8 — a flag that needs SAP change documents (CDHDR/CDPOS) degrades to 'not scored' when the extract is
// absent; it is never silently omitted from the panel.
export function flagAvailable(flag: JournalRiskFlag, changeDocsAvailable: boolean): boolean {
  return !flag.requiresChangeDocs || changeDocsAvailable;
}

// §16.5 — the seven flags scored over the whole journal population (not the exceptions).
export const JOURNAL_RISK_FLAGS: JournalRiskFlag[] = [
  { key: 'top-side', name: 'Top-side entry' },
  { key: 'round-number', name: 'Round number' },
  { key: 'backdated', name: 'Backdated' },
  { key: 'above-materiality', name: 'Above materiality' },
  { key: 'preparer-approver', name: 'Preparer equals approver', requiresChangeDocs: true },
  { key: 'outside-hours', name: 'Outside business hours', requiresChangeDocs: true },
  { key: 'sensitive-account', name: 'Sensitive account' },
];

// §16.5 — per-entity journal population; the high-risk count joins from EntityMetrics.highRiskJEs (§7.2). Flag hits
// are scored over the whole population, so each single flag stays within the high-risk set while their sum exceeds it.
export const journalRiskByEntity: Record<string, JournalRiskPopulation> = {
  JGL: { journals: 847, changeDocsAvailable: true, flagCounts: { 'top-side': 5, 'round-number': 6, backdated: 3, 'above-materiality': 4, 'preparer-approver': 2, 'outside-hours': 3, 'sensitive-account': 7 } },
  JBL: { journals: 692, changeDocsAvailable: true, flagCounts: { 'top-side': 6, 'round-number': 7, backdated: 4, 'above-materiality': 5, 'preparer-approver': 3, 'outside-hours': 4, 'sensitive-account': 8 } },
  JPS: { journals: 418, changeDocsAvailable: true, flagCounts: { 'top-side': 2, 'round-number': 3, backdated: 1, 'above-materiality': 2, 'preparer-approver': 1, 'outside-hours': 2, 'sensitive-account': 3 } },
  JCP: { journals: 264, changeDocsAvailable: true, flagCounts: { 'top-side': 1, 'round-number': 1, backdated: 0, 'above-materiality': 1, 'preparer-approver': 0, 'outside-hours': 1, 'sensitive-account': 2 } },
  JHS: { journals: 391, changeDocsAvailable: true, flagCounts: { 'top-side': 1, 'round-number': 2, backdated: 1, 'above-materiality': 1, 'preparer-approver': 1, 'outside-hours': 1, 'sensitive-account': 2 } },
  JRP: { journals: 913, changeDocsAvailable: true, flagCounts: { 'top-side': 8, 'round-number': 9, backdated: 6, 'above-materiality': 7, 'preparer-approver': 4, 'outside-hours': 5, 'sensitive-account': 10 } },
};

// §16.5 — intercompany balances by counterparty; each entity's unmatched sum ties to EntityMetrics.fxIntercompanyExposure (§8.2).
export const intercompanyByEntity: Record<string, IntercompanyCounterparty[]> = {
  JGL: [
    { name: 'Ingrevia', relatedParty: true, matchedCr: 12.4, unmatchedCr: 2.4, oldestDays: 38, nettingCr: 2.4 },
    { name: 'Jubilant Pharma Ltd', matchedCr: 9.6, unmatchedCr: 0.8, oldestDays: 21, nettingCr: 0.5 },
    { name: 'Jubilant Biosys Ltd', matchedCr: 4.2, unmatchedCr: 0.4, oldestDays: 12, nettingCr: 0.2 },
  ],
  JPS: [
    { name: 'Jubilant Generics Ltd', matchedCr: 14.8, unmatchedCr: 2.9, oldestDays: 47, nettingCr: 1.8 },
    { name: 'Jubilant Biosys Ltd', matchedCr: 6.3, unmatchedCr: 1.4, oldestDays: 33, nettingCr: 0.9 },
    { name: 'Jubilant HollisterStier LLC', matchedCr: 5.1, unmatchedCr: 0.9, oldestDays: 26, nettingCr: 0.6 },
    { name: 'Jubilant Cadista Pharmaceuticals Inc', matchedCr: 3.8, unmatchedCr: 0.6, oldestDays: 18, nettingCr: 0.4 },
  ],
  JRP: [
    { name: 'Jubilant Generics Ltd', matchedCr: 8.9, unmatchedCr: 2.2, oldestDays: 52, nettingCr: 1.1 },
    { name: 'Jubilant Pharma Ltd', matchedCr: 4.4, unmatchedCr: 1.3, oldestDays: 36, nettingCr: 0.8 },
    { name: 'Jubilant HollisterStier LLC', matchedCr: 3.2, unmatchedCr: 1.2, oldestDays: 29, nettingCr: 0.7 },
  ],
  JBL: [
    { name: 'Jubilant Generics Ltd', matchedCr: 5.6, unmatchedCr: 1.2, oldestDays: 24, nettingCr: 0.7 },
    { name: 'Jubilant Pharma Ltd', matchedCr: 3.1, unmatchedCr: 0.8, oldestDays: 19, nettingCr: 0.5 },
    { name: 'Jubilant Radiopharma', matchedCr: 2.2, unmatchedCr: 0.4, oldestDays: 15, nettingCr: 0.2 },
  ],
  JHS: [
    { name: 'Jubilant Pharma Ltd', matchedCr: 4.7, unmatchedCr: 1.1, oldestDays: 28, nettingCr: 0.6 },
    { name: 'Jubilant Generics Ltd', matchedCr: 3.9, unmatchedCr: 0.7, oldestDays: 22, nettingCr: 0.4 },
    { name: 'Jubilant Radiopharma', matchedCr: 2.6, unmatchedCr: 0.4, oldestDays: 17, nettingCr: 0.2 },
  ],
  JCP: [
    { name: 'Jubilant Pharma Ltd', matchedCr: 5.2, unmatchedCr: 1.0, oldestDays: 23, nettingCr: 0.6 },
    { name: 'Jubilant Generics Ltd', matchedCr: 3.4, unmatchedCr: 0.6, oldestDays: 16, nettingCr: 0.3 },
    { name: 'Jubilant HollisterStier LLC', matchedCr: 2.1, unmatchedCr: 0.3, oldestDays: 11, nettingCr: 0.2 },
  ],
};

// §16.5 — prior-period accruals and their auto-reversal; unreversed = priorPeriodCr − reversedCr (derived at read time).
export const accrualReversalByEntity: Record<string, AccrualReversal> = {
  JGL: { priorPeriodCr: 8.9, reversedCr: 6.1 },
  JBL: { priorPeriodCr: 5.6, reversedCr: 3.9 },
  JPS: { priorPeriodCr: 3.4, reversedCr: 3.0 },
  JCP: { priorPeriodCr: 2.1, reversedCr: 2.0 },
  JHS: { priorPeriodCr: 2.8, reversedCr: 2.5 },
  JRP: { priorPeriodCr: 7.2, reversedCr: 4.6 },
};

// §16.5 — reconciliation status counts from the reconciliation platform; overdue breaks join from EntityMetrics.reconAgedBreaks (§7.2).
export const reconSummaryByEntity: Record<string, ReconSummary> = {
  JGL: { accountsReconciled: 214, certified: 186, breaksWithEvidence: 11 },
  JBL: { accountsReconciled: 178, certified: 151, breaksWithEvidence: 9 },
  JPS: { accountsReconciled: 132, certified: 121, breaksWithEvidence: 5 },
  JCP: { accountsReconciled: 96, certified: 94, breaksWithEvidence: 2 },
  JHS: { accountsReconciled: 128, certified: 119, breaksWithEvidence: 3 },
  JRP: { accountsReconciled: 203, certified: 158, breaksWithEvidence: 8 },
};

const RECON_BREAKS_BUCKET_LABELS = ['0-15 d', '16-30 d', '31-60 d', '61-90 d', '> 90 d'];

// §16.5 — overdue reconciliation breaks by age band; each entity's bucket sum ties to EntityMetrics.reconValue.current (§7.2),
// and the last band reaches the entity's reconOldestDays.
export const reconBreaksAgeingByEntity: Record<string, AgeingBucket[]> = {
  JGL: [5.6, 4.2, 2.9, 1.6].map((value, i) => ({ label: RECON_BREAKS_BUCKET_LABELS[i], value })),
  JBL: [3.7, 2.8, 1.9, 1.4].map((value, i) => ({ label: RECON_BREAKS_BUCKET_LABELS[i], value })),
  JPS: [1.9, 1.3, 0.9].map((value, i) => ({ label: RECON_BREAKS_BUCKET_LABELS[i], value })),
  JCP: [0.9, 0.5].map((value, i) => ({ label: RECON_BREAKS_BUCKET_LABELS[i], value })),
  JHS: [1.6, 1.1].map((value, i) => ({ label: RECON_BREAKS_BUCKET_LABELS[i], value })),
  JRP: [3.4, 3.0, 2.6, 2.1, 1.5].map((value, i) => ({ label: RECON_BREAKS_BUCKET_LABELS[i], value })),
};
