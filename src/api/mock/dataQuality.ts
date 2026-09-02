import type { DataQualityItem, InterfaceHealth } from '../types';
import { entities } from './entities';

// §7.27 — no dataset exists for these checks; JGL anchors are pinned in the spec and the other entities scale by
// (100 − dataQuality) / 10 so fail rates order strictly inversely with the dimension (JCP 94 cleanest, JRP 74 worst).
const CHECKS: Array<{ check: string; domain: DataQualityItem['domain']; jglFails: number; total: number; impact: string }> = [
  { check: 'Missing tax registration', domain: 'vendor', jglFails: 14, total: 812, impact: 'Blocks e-invoice validation' },
  { check: 'Duplicate vendor records', domain: 'vendor', jglFails: 9, total: 812, impact: 'Duplicate payment risk' },
  { check: 'Dormant, no activity 24 months', domain: 'vendor', jglFails: 48, total: 812, impact: 'Fraud surface, master data bloat' },
  { check: 'Missing tax registration', domain: 'customer', jglFails: 6, total: 430, impact: 'Billing rejections' },
  { check: 'Cost centre default missing', domain: 'gl', jglFails: 3, total: 210, impact: 'Manual coding, misposting risk' },
  { check: 'Failed IDocs, last 7 days', domain: 'interface', jglFails: 12, total: 580, impact: 'Missing transactions, stale figures' },
];

export const dataQualityItems: DataQualityItem[] = entities.flatMap((e) => {
  const factor = (100 - e.dimensions.dataQuality) / 10; // JGL (90) → 1.0, so the pinned anchors hold exactly
  return CHECKS.map((c) => ({ check: c.check, domain: c.domain, entityCode: e.code, failCount: Math.round(c.jglFails * factor), totalCount: c.total, impact: c.impact }));
});

// §7.27 — interface health per entity; failed IDocs come from the interface check above (last 7 days).
export const interfaceHealth: InterfaceHealth[] = [
  { entityCode: 'JCP', status: 'on schedule', lastSuccessfulRun: '31 Aug 2026, 04:00' },
  { entityCode: 'JHS', status: 'on schedule', lastSuccessfulRun: '31 Aug 2026, 04:05' },
  { entityCode: 'JGL', status: 'delayed', lastSuccessfulRun: '31 Aug 2026, 09:20' },
  { entityCode: 'JPS', status: 'delayed', lastSuccessfulRun: '30 Aug 2026, 21:10' },
  { entityCode: 'JBL', status: 'stale', lastSuccessfulRun: '29 Aug 2026, 04:00' },
  { entityCode: 'JRP', status: 'stale', lastSuccessfulRun: '27 Aug 2026, 16:35' },
];
