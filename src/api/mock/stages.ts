import type { ProcessStage } from '../types';

// spec/03 — P2P stages (7); spec/08 — O2C stages (7).
export const stages: ProcessStage[] = [
  { processKey: 'p2p', step: 'PR', name: 'Requisition', volume: 4182, value: 62.1, exceptionPct: 4, status: 'GREEN' },
  { processKey: 'p2p', step: 'PO', name: 'Purchase order', volume: 3914, value: 58.4, exceptionPct: 6, status: 'GREEN' },
  { processKey: 'p2p', step: 'GR', name: 'Goods receipt', volume: 3502, value: 51.2, exceptionPct: 19, status: 'RED' },
  { processKey: 'p2p', step: 'INV', name: 'Invoice', volume: 1243, value: 18.6, exceptionPct: 26, status: 'RED' },
  { processKey: 'p2p', step: 'MTC', name: 'Three-way match', volume: 916, value: 14.2, exceptionPct: 22, status: 'AMBER' },
  { processKey: 'p2p', step: 'APR', name: 'Approval', volume: 589, value: 8.9, exceptionPct: 12, status: 'AMBER' },
  { processKey: 'p2p', step: 'PAY', name: 'Payment', volume: 412, value: 6.1, exceptionPct: 3, status: 'GREEN' },
  // spec/08 Part B — O2C stage flow.
  { processKey: 'o2c', step: 'ORD', name: 'Order', volume: 5140, value: 71.4, exceptionPct: 3, status: 'GREEN' },
  { processKey: 'o2c', step: 'CRD', name: 'Credit check', volume: 4980, value: 68.9, exceptionPct: 8, status: 'AMBER' },
  { processKey: 'o2c', step: 'DLV', name: 'Delivery', volume: 4712, value: 64.2, exceptionPct: 6, status: 'GREEN' },
  { processKey: 'o2c', step: 'BIL', name: 'Billing', volume: 4455, value: 61.8, exceptionPct: 14, status: 'AMBER' },
  { processKey: 'o2c', step: 'DSP', name: 'Invoice dispatch', volume: 4301, value: 59.6, exceptionPct: 9, status: 'AMBER' },
  { processKey: 'o2c', step: 'COL', name: 'Collection', volume: 1876, value: 28.4, exceptionPct: 24, status: 'RED' },
  { processKey: 'o2c', step: 'CSH', name: 'Cash application', volume: 1204, value: 19.7, exceptionPct: 21, status: 'RED' },
];
