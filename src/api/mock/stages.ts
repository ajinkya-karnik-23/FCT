import type { ProcessStage } from '../types';

// spec/03 — P2P stages (7). All processKey 'p2p'.
export const stages: ProcessStage[] = [
  { processKey: 'p2p', step: 'PR', name: 'Requisition', volume: 4182, value: 62.1, exceptionPct: 4, status: 'GREEN' },
  { processKey: 'p2p', step: 'PO', name: 'Purchase order', volume: 3914, value: 58.4, exceptionPct: 6, status: 'GREEN' },
  { processKey: 'p2p', step: 'GR', name: 'Goods receipt', volume: 3502, value: 51.2, exceptionPct: 19, status: 'RED' },
  { processKey: 'p2p', step: 'INV', name: 'Invoice', volume: 1243, value: 18.6, exceptionPct: 26, status: 'RED' },
  { processKey: 'p2p', step: 'MTC', name: 'Three-way match', volume: 916, value: 14.2, exceptionPct: 22, status: 'AMBER' },
  { processKey: 'p2p', step: 'APR', name: 'Approval', volume: 589, value: 8.9, exceptionPct: 12, status: 'AMBER' },
  { processKey: 'p2p', step: 'PAY', name: 'Payment', volume: 412, value: 6.1, exceptionPct: 3, status: 'GREEN' },
];
