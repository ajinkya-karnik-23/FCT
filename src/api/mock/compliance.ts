import type { ComplianceItem } from '../types';

// §7.26 — statutory obligations per entity, jurisdiction-matched in the dataset (India: GST/TDS/MSMED/e-invoice;
// Singapore: GST F5 / withholding tax / transfer pricing; US & Canada: sales & use tax / GST-HST / 1099). Only JRP
// carries an overdue item (§7.26); every other entity's compliance dimension is ≥88, and an overdue filing would cap
// those at 60 under §3.5. valueAtRiskCr follows the §7.26 exposure table (ITC / input tax at risk, MSMED ageing).
// failCount carries count-based operational failures where the spec states a number rather than a rupee figure:
// e-invoice IRN failures are India-only (JGL 14 · JBL 8); the US/Canada equivalent is Form 1099 TIN mismatches
// (JCP 9 · JHS 6 · JRP 21). failureLabel names each kind so the screen renders "IRN failures" vs "TIN mismatches".
export const complianceItems: ComplianceItem[] = [
  // JGL — India
  { obligation: 'GSTR-1', entityCode: 'JGL', dueDate: '2026-08-11', status: 'filed' },
  { obligation: 'GSTR-3B', entityCode: 'JGL', dueDate: '2026-08-20', status: 'filed' },
  { obligation: 'GSTR-2B reconciliation', entityCode: 'JGL', dueDate: '2026-08-25', status: 'filed', valueAtRiskCr: 1.8 },
  { obligation: 'TDS deposit', entityCode: 'JGL', dueDate: '2026-08-07', status: 'filed' },
  { obligation: 'TDS return', entityCode: 'JGL', dueDate: '2026-07-31', status: 'filed' }, // Q1 FY27
  { obligation: 'MSMED 45-day ageing', entityCode: 'JGL', dueDate: '2026-09-30', status: 'due', valueAtRiskCr: 2.4 },
  { obligation: 'e-invoice IRN failures', entityCode: 'JGL', dueDate: '2026-08-31', status: 'due', failCount: 14, failureLabel: 'IRN failures' },
  // JBL — India (the same obligation set as JGL)
  { obligation: 'GSTR-1', entityCode: 'JBL', dueDate: '2026-08-11', status: 'filed' },
  { obligation: 'GSTR-3B', entityCode: 'JBL', dueDate: '2026-08-20', status: 'filed' },
  { obligation: 'GSTR-2B reconciliation', entityCode: 'JBL', dueDate: '2026-08-25', status: 'filed', valueAtRiskCr: 0.9 },
  { obligation: 'TDS deposit', entityCode: 'JBL', dueDate: '2026-08-07', status: 'filed' },
  { obligation: 'TDS return', entityCode: 'JBL', dueDate: '2026-07-31', status: 'filed' }, // Q1 FY27
  { obligation: 'MSMED 45-day ageing', entityCode: 'JBL', dueDate: '2026-09-30', status: 'due', valueAtRiskCr: 1.1 },
  { obligation: 'e-invoice IRN failures', entityCode: 'JBL', dueDate: '2026-08-31', status: 'due', failCount: 8, failureLabel: 'IRN failures' },
  // JPS — Singapore
  { obligation: 'GST F5 return', entityCode: 'JPS', dueDate: '2026-07-31', status: 'filed', valueAtRiskCr: 0.4 },
  { obligation: 'Withholding tax', entityCode: 'JPS', dueDate: '2026-08-10', status: 'filed' },
  { obligation: 'Transfer pricing documentation', entityCode: 'JPS', dueDate: '2026-11-30', status: 'due' },
  // JCP — United States
  { obligation: 'Sales & use tax', entityCode: 'JCP', dueDate: '2026-08-20', status: 'filed', valueAtRiskCr: 0.2 },
  { obligation: 'Form 1099 filings', entityCode: 'JCP', dueDate: '2026-02-02', status: 'filed', failCount: 9, failureLabel: 'TIN mismatches' },
  { obligation: 'State registrations', entityCode: 'JCP', dueDate: '2026-10-15', status: 'due' },
  // JHS — US / Canada (Spokane and Montreal sites; the §7.26 list carries its GST/HST return)
  { obligation: 'Sales & use tax', entityCode: 'JHS', dueDate: '2026-08-20', status: 'filed' },
  { obligation: 'GST/HST return', entityCode: 'JHS', dueDate: '2026-07-31', status: 'filed', valueAtRiskCr: 0.3 },
  { obligation: 'Form 1099 filings', entityCode: 'JHS', dueDate: '2026-02-02', status: 'filed', failCount: 6, failureLabel: 'TIN mismatches' },
  // JRP — US / Canada; the ONLY overdue item in the group (§7.26)
  { obligation: 'GST/HST return', entityCode: 'JRP', dueDate: '2026-07-31', status: 'overdue', valueAtRiskCr: 1.2 },
  { obligation: 'Québec QST', entityCode: 'JRP', dueDate: '2026-08-31', status: 'due' },
  { obligation: 'Sales & use tax', entityCode: 'JRP', dueDate: '2026-08-20', status: 'filed' },
  // JRP's 21 TIN mismatches ride on its Form 1099 row — e-invoice IRN failures are India-only (§7.26).
  { obligation: 'Form 1099 filings', entityCode: 'JRP', dueDate: '2026-02-02', status: 'filed', failCount: 21, failureLabel: 'TIN mismatches' },
];
