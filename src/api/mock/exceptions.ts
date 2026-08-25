import type { Exception } from '../types';

// spec/03 — Exceptions (12, all entity JGL, process p2p).
export const exceptions: Exception[] = [
  { id: 'AP-104281', entityCode: 'JGL', processKey: 'p2p', vendor: 'Suraksha Chemicals Pvt Ltd', amount: 2.84, ageDays: 41, reasonKey: 'missing-gr', plant: 'Nanjangud', owner: 'P. Nair', controlImpact: 'High', po: 'PO-4471902', bookedOn: '14 Jul 2026' },
  { id: 'AP-104306', entityCode: 'JGL', processKey: 'p2p', vendor: 'Zenith Packaging Industries', amount: 1.96, ageDays: 37, reasonKey: 'po-price-mismatch', plant: 'Roorkee', owner: 'A. Sethi', controlImpact: 'Medium', po: 'PO-4472118', bookedOn: '18 Jul 2026' },
  { id: 'AP-104355', entityCode: 'JGL', processKey: 'p2p', vendor: 'Meridian Logistics Services', amount: 1.42, ageDays: 34, reasonKey: 'approval-pending', plant: 'Ambernath', owner: 'R. Iyer', controlImpact: 'Low', po: 'PO-4472884', bookedOn: '21 Jul 2026' },
  { id: 'AP-104402', entityCode: 'JGL', processKey: 'p2p', vendor: 'Kaveri Solvents Ltd', amount: 1.28, ageDays: 52, reasonKey: 'missing-gr', plant: 'Nanjangud', owner: 'P. Nair', controlImpact: 'High', po: 'PO-4470553', bookedOn: '03 Jul 2026' },
  { id: 'AP-104417', entityCode: 'JGL', processKey: 'p2p', vendor: 'Orion Instruments Pvt Ltd', amount: 0.96, ageDays: 29, reasonKey: 'vendor-master', plant: 'Noida', owner: 'S. Rao', controlImpact: 'Medium', po: 'PO-4473201', bookedOn: '26 Jul 2026' },
  { id: 'AP-104458', entityCode: 'JGL', processKey: 'p2p', vendor: 'Balaji Engineering Works', amount: 0.88, ageDays: 46, reasonKey: 'missing-gr', plant: 'Roorkee', owner: 'A. Sethi', controlImpact: 'High', po: 'PO-4471044', bookedOn: '09 Jul 2026' },
  { id: 'AP-104473', entityCode: 'JGL', processKey: 'p2p', vendor: 'Deccan Speciality Gases', amount: 0.74, ageDays: 21, reasonKey: 'duplicate-suspicion', plant: 'Nanjangud', owner: 'P. Nair', controlImpact: 'High', po: 'PO-4473688', bookedOn: '02 Aug 2026' },
  { id: 'AP-104501', entityCode: 'JGL', processKey: 'p2p', vendor: 'Trident Maintenance Co', amount: 0.68, ageDays: 18, reasonKey: 'approval-pending', plant: 'Ambernath', owner: 'R. Iyer', controlImpact: 'Low', po: 'PO-4473912', bookedOn: '05 Aug 2026' },
  { id: 'AP-104522', entityCode: 'JGL', processKey: 'p2p', vendor: 'Nova Analytical Labs', amount: 0.61, ageDays: 33, reasonKey: 'po-price-mismatch', plant: 'Noida', owner: 'S. Rao', controlImpact: 'Medium', po: 'PO-4472470', bookedOn: '20 Jul 2026' },
  { id: 'AP-104570', entityCode: 'JGL', processKey: 'p2p', vendor: 'Shakti Power Systems', amount: 0.54, ageDays: 12, reasonKey: 'tax-mismatch', plant: 'Roorkee', owner: 'A. Sethi', controlImpact: 'Low', po: 'PO-4474355', bookedOn: '11 Aug 2026' },
  { id: 'AP-104588', entityCode: 'JGL', processKey: 'p2p', vendor: 'Ganga Freight Movers', amount: 0.47, ageDays: 27, reasonKey: 'missing-gr', plant: 'Ambernath', owner: 'R. Iyer', controlImpact: 'Medium', po: 'PO-4472996', bookedOn: '24 Jul 2026' },
  { id: 'AP-104611', entityCode: 'JGL', processKey: 'p2p', vendor: 'Vertex Lab Consumables', amount: 0.39, ageDays: 9, reasonKey: 'vendor-master', plant: 'Noida', owner: 'S. Rao', controlImpact: 'Low', po: 'PO-4474612', bookedOn: '14 Aug 2026' },
];
