// Public API surface for the Finance Control Tower (spec/03).
// Components import ONLY from this module — never from ./mock/*.
// These are synchronous mock accessors over the fabricated reference data.

import { entities } from './mock/entities';
import { stages } from './mock/stages';
import { exceptions } from './mock/exceptions';
import { causes } from './mock/causes';
import {
  blockedInvoiceAgeing,
  cashOpportunities,
  groupSummary,
  payablesByReason,
  receivablesAgeing,
  recurringCauses,
  serviceControl,
} from './mock/misc';

import type {
  AgeingBucket,
  CashOpportunity,
  CauseNode,
  Entity,
  Exception,
  GroupSummary,
  PayableReason,
  ProcessKey,
  ProcessStage,
  RecurringCause,
  ServiceControl,
} from './types';

export type {
  AgeingBucket,
  CashOpportunity,
  CloseProgress,
  ControlImpact,
  CauseNode,
  Effort,
  Entity,
  Exception,
  GroupSummary,
  PayableReason,
  ProcessKey,
  ProcessStage,
  RecurringCause,
  ServiceControl,
  Status,
  TransformationHealth,
} from './types';

export function listEntities(): Entity[] {
  return entities;
}

export function getEntity(code: string): Entity | undefined {
  return entities.find((e) => e.code === code);
}

export function listStages(processKey: ProcessKey = 'p2p'): ProcessStage[] {
  return stages.filter((s) => s.processKey === processKey);
}

export function listExceptions(entityCode?: string, processKey?: Exception['processKey']): Exception[] {
  return exceptions.filter(
    (x) => (!entityCode || x.entityCode === entityCode) && (!processKey || x.processKey === processKey),
  );
}

export function getException(id: string): Exception | undefined {
  return exceptions.find((x) => x.id === id);
}

export function listCauses(processKey: ProcessKey = 'p2p'): CauseNode[] {
  return causes.filter((c) => c.processKey === processKey);
}

export function getCause(key: string): CauseNode | undefined {
  return causes.find((c) => c.key === key);
}

export function getCashOpportunities(): CashOpportunity[] {
  return cashOpportunities;
}

export function getGroupSummary(): GroupSummary {
  return groupSummary;
}

// Supporting datasets (spec/03 "Other datasets").
export function getBlockedInvoiceAgeing(): AgeingBucket[] {
  return blockedInvoiceAgeing;
}

export function getReceivablesAgeing(): AgeingBucket[] {
  return receivablesAgeing;
}

export function getPayablesByReason(): PayableReason[] {
  return payablesByReason;
}

export function getServiceControl(): ServiceControl {
  return serviceControl;
}

export function getRecurringCauses(): RecurringCause[] {
  return recurringCauses;
}
