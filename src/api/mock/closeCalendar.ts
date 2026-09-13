import type { CloseCalendarSummary, CloseTask } from '../types';

// §16.3 — the close calendar: per-entity task pool with owners, due days of close, dependencies and a critical path.
// The aggregates are pinned by the spec's table; they reconcile to §7.2's close % (round(complete / total × 100)) and
// open = total − complete — both asserted in tests/api.test.ts. The named rows are each entity's blocked +
// critical-path slice of its pool: every blocked row carries what blocks it and who owns that, the critical path's max
// due day (blocked tasks included — they still gate close) is the predicted close day (asserted), and predicted slippage
// orders with the close % — JRP worst, JCP best. Escalation reuses the exception worklist's two-state model: a pending
// timer, or sent and logged (§16.3).

export const CLOSE_CALENDAR_SUMMARIES: CloseCalendarSummary[] = [
  { entityCode: 'JGL', totalTasks: 214, completeCount: 167, openCount: 47, committedDay: 6, predictedDay: 6, blockerCount: 7 },
  { entityCode: 'JBL', totalTasks: 186, completeCount: 113, openCount: 73, committedDay: 6, predictedDay: 8, blockerCount: 9 },
  { entityCode: 'JPS', totalTasks: 124, completeCount: 109, openCount: 15, committedDay: 6, predictedDay: 6, blockerCount: 3 },
  { entityCode: 'JCP', totalTasks: 96, completeCount: 92, openCount: 4, committedDay: 6, predictedDay: 5, blockerCount: 1 },
  { entityCode: 'JHS', totalTasks: 142, completeCount: 133, openCount: 9, committedDay: 6, predictedDay: 6, blockerCount: 2 },
  { entityCode: 'JRP', totalTasks: 231, completeCount: 120, openCount: 111, committedDay: 6, predictedDay: 9, blockerCount: 11 },
];

export const CLOSE_TASKS: CloseTask[] = [
  // JGL — on schedule (predicted Day 6); seven blockers, none past the critical path's end.
  { id: 'JGL-C03', entityCode: 'JGL', name: 'Intercompany matching — JBL pair', owner: 'A. Sethi', dueDay: 5, status: 'blocked', blocker: { name: 'JBL sub-ledger close', owner: 'K. Menon · JBL controller' }, onCriticalPath: true },
  { id: 'JGL-C04', entityCode: 'JGL', name: 'Bank reconciliations — current accounts', owner: 'P. Nair', dueDay: 4, status: 'blocked', blocker: { name: 'Statement batch from bank portal', owner: 'Group treasury desk' }, escalation: { state: 'sent', to: 'Entity controller', when: '09:40' }, onCriticalPath: false },
  { id: 'JGL-C05', entityCode: 'JGL', name: 'Accrual schedule — review & sign-off', owner: 'R. Iyer', dueDay: 5, status: 'blocked', blocker: { name: 'Plant consumption data', owner: 'S. Rao · plant accounting' }, onCriticalPath: true },
  { id: 'JGL-C06', entityCode: 'JGL', name: 'Intercompany matching — JHS pair', owner: 'A. Sethi', dueDay: 5, status: 'blocked', blocker: { name: 'JHS open items list', owner: 'D. Kulkarni · JHS controller' }, escalation: { state: 'timer', to: 'Entity controller', when: 'in 3 h' }, onCriticalPath: false },
  { id: 'JGL-C07', entityCode: 'JGL', name: 'Trial balance review — GL accounts', owner: 'S. Rao', dueDay: 6, status: 'blocked', dependsOn: ['JGL-C05'], blocker: { name: 'Adjusting entries from accrual review', owner: 'R. Iyer' }, onCriticalPath: true },
  { id: 'JGL-C08', entityCode: 'JGL', name: 'Reporting pack — consolidation inputs', owner: 'R. Iyer', dueDay: 6, status: 'blocked', dependsOn: ['JGL-C07'], blocker: { name: 'Trial balance sign-off', owner: 'S. Rao' }, onCriticalPath: true },
  { id: 'JGL-C09', entityCode: 'JGL', name: 'Fixed asset register reconciliation', owner: 'P. Nair', dueDay: 4, status: 'blocked', blocker: { name: 'Depreciation run output', owner: 'Group finance systems' }, escalation: { state: 'sent', to: 'Entity controller', when: '10:15' }, onCriticalPath: false },
  { id: 'JGL-C10', entityCode: 'JGL', name: 'Sub-ledger reconciliation — AP', owner: 'P. Nair', dueDay: 6, status: 'open', onCriticalPath: true },
  { id: 'JGL-C11', entityCode: 'JGL', name: 'Bank reconciliations — fixed deposits', owner: 'S. Rao', dueDay: 5, status: 'open', onCriticalPath: false },
  { id: 'JGL-C12', entityCode: 'JGL', name: 'Revenue cut-off review', owner: 'A. Sethi', dueDay: 6, status: 'open', onCriticalPath: true },

  // JBL — slips two days (predicted Day 8); the slip sits in the accrual → trial balance → reporting pack chain.
  { id: 'JBL-C02', entityCode: 'JBL', name: 'Sub-ledger reconciliation — AP', owner: 'P. Nair', dueDay: 5, status: 'blocked', blocker: { name: 'GR postings from plant', owner: 'Plant stores' }, escalation: { state: 'sent', to: 'Entity controller', when: '08:50' }, onCriticalPath: true },
  { id: 'JBL-C03', entityCode: 'JBL', name: 'Intercompany matching — JGL pair', owner: 'A. Sethi', dueDay: 5, status: 'blocked', blocker: { name: 'JGL sub-ledger close', owner: 'R. Iyer · JGL close team' }, onCriticalPath: true },
  { id: 'JBL-C04', entityCode: 'JBL', name: 'Accrual schedule — review & sign-off', owner: 'V. Desai', dueDay: 6, status: 'blocked', blocker: { name: 'Plant consumption data', owner: 'S. Rao · plant accounting' }, escalation: { state: 'timer', to: 'Entity controller', when: 'in 2 h' }, onCriticalPath: true },
  { id: 'JBL-C05', entityCode: 'JBL', name: 'Bank reconciliations — current accounts', owner: 'P. Nair', dueDay: 4, status: 'blocked', blocker: { name: 'Statement batch from bank portal', owner: 'Group treasury desk' }, escalation: { state: 'sent', to: 'Entity controller', when: '09:10' }, onCriticalPath: false },
  { id: 'JBL-C06', entityCode: 'JBL', name: 'Trial balance review — GL accounts', owner: 'S. Rao', dueDay: 7, status: 'blocked', dependsOn: ['JBL-C04'], blocker: { name: 'Adjusting entries from accrual review', owner: 'V. Desai' }, onCriticalPath: true },
  { id: 'JBL-C07', entityCode: 'JBL', name: 'Reporting pack — consolidation inputs', owner: 'R. Iyer', dueDay: 8, status: 'blocked', dependsOn: ['JBL-C06'], blocker: { name: 'Trial balance sign-off', owner: 'S. Rao' }, onCriticalPath: true },
  { id: 'JBL-C08', entityCode: 'JBL', name: 'Fixed asset register reconciliation', owner: 'V. Desai', dueDay: 5, status: 'blocked', blocker: { name: 'Depreciation run output', owner: 'Group finance systems' }, escalation: { state: 'timer', to: 'Entity controller', when: 'in 4 h' }, onCriticalPath: false },
  { id: 'JBL-C09', entityCode: 'JBL', name: 'Revenue cut-off review', owner: 'A. Sethi', dueDay: 6, status: 'blocked', blocker: { name: 'Dispatch notes from plant', owner: 'Plant stores' }, escalation: { state: 'sent', to: 'Plant controller', when: '11:05' }, onCriticalPath: false },
  { id: 'JBL-C10', entityCode: 'JBL', name: 'Intercompany matching — JRP pair', owner: 'S. Rao', dueDay: 6, status: 'blocked', blocker: { name: 'JRP open items list', owner: 'T. Bhatia · JRP controller' }, escalation: { state: 'timer', to: 'Entity controller', when: 'in 6 h' }, onCriticalPath: false },
  { id: 'JBL-C11', entityCode: 'JBL', name: 'Sub-ledger reconciliation — AR', owner: 'P. Nair', dueDay: 7, status: 'open', onCriticalPath: true },
  { id: 'JBL-C12', entityCode: 'JBL', name: 'Bank reconciliations — fixed deposits', owner: 'V. Desai', dueDay: 5, status: 'open', onCriticalPath: false },

  // JPS — on schedule; three blockers, all inside the committed window.
  { id: 'JPS-C02', entityCode: 'JPS', name: 'Intercompany matching — JGL pair', owner: 'V. Desai', dueDay: 5, status: 'blocked', blocker: { name: 'JGL open items list', owner: 'R. Iyer · JGL close team' }, onCriticalPath: true },
  { id: 'JPS-C03', entityCode: 'JPS', name: 'Accrual schedule — review & sign-off', owner: 'R. Iyer', dueDay: 5, status: 'blocked', blocker: { name: 'Plant consumption data', owner: 'S. Rao · plant accounting' }, escalation: { state: 'sent', to: 'Entity controller', when: '10:30' }, onCriticalPath: true },
  { id: 'JPS-C04', entityCode: 'JPS', name: 'Trial balance review — GL accounts', owner: 'S. Rao', dueDay: 6, status: 'blocked', dependsOn: ['JPS-C03'], blocker: { name: 'Adjusting entries from accrual review', owner: 'R. Iyer' }, onCriticalPath: true },
  { id: 'JPS-C05', entityCode: 'JPS', name: 'Sub-ledger reconciliation — AP', owner: 'P. Nair', dueDay: 6, status: 'open', onCriticalPath: true },
  { id: 'JPS-C06', entityCode: 'JPS', name: 'Bank reconciliations — current accounts', owner: 'R. Iyer', dueDay: 5, status: 'open', onCriticalPath: false },

  // JCP — one day ahead (predicted Day 5); its four open tasks are the whole named pool.
  { id: 'JCP-C02', entityCode: 'JCP', name: 'Intercompany matching — JHS pair', owner: 'A. Sethi', dueDay: 5, status: 'blocked', blocker: { name: 'JHS open items list', owner: 'D. Kulkarni · JHS controller' }, escalation: { state: 'timer', to: 'Entity controller', when: 'in 3 h' }, onCriticalPath: true },
  { id: 'JCP-C03', entityCode: 'JCP', name: 'Sub-ledger reconciliation — AP', owner: 'P. Nair', dueDay: 4, status: 'open', onCriticalPath: false },
  { id: 'JCP-C04', entityCode: 'JCP', name: 'Bank reconciliations — current accounts', owner: 'S. Rao', dueDay: 5, status: 'open', onCriticalPath: true },
  { id: 'JCP-C05', entityCode: 'JCP', name: 'Trial balance review — GL accounts', owner: 'R. Iyer', dueDay: 5, status: 'open', onCriticalPath: true },

  // JHS — on schedule; two blockers.
  { id: 'JHS-C03', entityCode: 'JHS', name: 'Intercompany matching — JCP pair', owner: 'V. Desai', dueDay: 5, status: 'blocked', blocker: { name: 'JCP open items list', owner: 'A. Sethi · JCP close team' }, onCriticalPath: true },
  { id: 'JHS-C04', entityCode: 'JHS', name: 'Accrual schedule — review & sign-off', owner: 'R. Iyer', dueDay: 6, status: 'blocked', blocker: { name: 'Plant consumption data', owner: 'S. Rao · plant accounting' }, escalation: { state: 'sent', to: 'Entity controller', when: '09:55' }, onCriticalPath: true },
  { id: 'JHS-C05', entityCode: 'JHS', name: 'Sub-ledger reconciliation — AP', owner: 'P. Nair', dueDay: 6, status: 'open', onCriticalPath: true },
  { id: 'JHS-C06', entityCode: 'JHS', name: 'Bank reconciliations — current accounts', owner: 'S. Rao', dueDay: 5, status: 'open', onCriticalPath: false },

  // JRP — slips three days (predicted Day 9), the worst in the group; eleven blockers and the longest chain.
  { id: 'JRP-C02', entityCode: 'JRP', name: 'Sub-ledger reconciliation — AP', owner: 'P. Nair', dueDay: 5, status: 'blocked', blocker: { name: 'GR postings from plant', owner: 'Plant stores' }, escalation: { state: 'sent', to: 'Entity controller', when: '08:35' }, onCriticalPath: true },
  { id: 'JRP-C03', entityCode: 'JRP', name: 'Intercompany matching — JBL pair', owner: 'S. Rao', dueDay: 6, status: 'blocked', blocker: { name: 'JBL sub-ledger close', owner: 'K. Menon · JBL controller' }, escalation: { state: 'timer', to: 'Entity controller', when: 'in 5 h' }, onCriticalPath: true },
  { id: 'JRP-C04', entityCode: 'JRP', name: 'Intercompany matching — JGL pair', owner: 'A. Sethi', dueDay: 6, status: 'blocked', blocker: { name: 'JGL open items list', owner: 'R. Iyer · JGL close team' }, onCriticalPath: true },
  { id: 'JRP-C05', entityCode: 'JRP', name: 'Accrual schedule — review & sign-off', owner: 'V. Desai', dueDay: 7, status: 'blocked', blocker: { name: 'Plant consumption data', owner: 'S. Rao · plant accounting' }, escalation: { state: 'sent', to: 'Entity controller', when: '11:20' }, onCriticalPath: true },
  { id: 'JRP-C06', entityCode: 'JRP', name: 'Bank reconciliations — current accounts', owner: 'P. Nair', dueDay: 4, status: 'blocked', blocker: { name: 'Statement batch from bank portal', owner: 'Group treasury desk' }, escalation: { state: 'sent', to: 'Entity controller', when: '08:15' }, onCriticalPath: false },
  { id: 'JRP-C07', entityCode: 'JRP', name: 'Trial balance review — GL accounts', owner: 'S. Rao', dueDay: 8, status: 'blocked', dependsOn: ['JRP-C05'], blocker: { name: 'Adjusting entries from accrual review', owner: 'V. Desai' }, escalation: { state: 'timer', to: 'Entity controller', when: 'in 2 h' }, onCriticalPath: true },
  { id: 'JRP-C08', entityCode: 'JRP', name: 'Reporting pack — consolidation inputs', owner: 'R. Iyer', dueDay: 9, status: 'blocked', dependsOn: ['JRP-C07'], blocker: { name: 'Trial balance sign-off', owner: 'S. Rao' }, onCriticalPath: true },
  { id: 'JRP-C09', entityCode: 'JRP', name: 'Fixed asset register reconciliation', owner: 'V. Desai', dueDay: 5, status: 'blocked', blocker: { name: 'Depreciation run output', owner: 'Group finance systems' }, escalation: { state: 'sent', to: 'Entity controller', when: '10:45' }, onCriticalPath: false },
  { id: 'JRP-C10', entityCode: 'JRP', name: 'Revenue cut-off review', owner: 'A. Sethi', dueDay: 6, status: 'blocked', blocker: { name: 'Dispatch notes from plant', owner: 'Plant stores' }, escalation: { state: 'timer', to: 'Plant controller', when: 'in 7 h' }, onCriticalPath: false },
  { id: 'JRP-C11', entityCode: 'JRP', name: 'Intercompany matching — JHS pair', owner: 'S. Rao', dueDay: 7, status: 'blocked', blocker: { name: 'JHS open items list', owner: 'D. Kulkarni · JHS controller' }, escalation: { state: 'sent', to: 'Entity controller', when: '09:30' }, onCriticalPath: false },
  { id: 'JRP-C12', entityCode: 'JRP', name: 'Sub-ledger reconciliation — AR', owner: 'P. Nair', dueDay: 6, status: 'blocked', blocker: { name: 'Customer statement run', owner: 'Group finance systems' }, escalation: { state: 'timer', to: 'Entity controller', when: 'in 4 h' }, onCriticalPath: false },
  { id: 'JRP-C13', entityCode: 'JRP', name: 'Bank reconciliations — fixed deposits', owner: 'V. Desai', dueDay: 8, status: 'open', onCriticalPath: true },
  { id: 'JRP-C14', entityCode: 'JRP', name: 'Tax provision review', owner: 'R. Iyer', dueDay: 9, status: 'open', onCriticalPath: true },
];
