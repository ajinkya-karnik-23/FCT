import type { Request } from '../types';
import { ANCHOR, addDays, isoDate } from './exceptions';
import { fnv1a, mulberry32 } from './entities';

// §7.29 — one structured intake for every request into the service: six types, four statuses, 8-12 rows per
// entity, volume tracking each entity's exception load (JRP and JBL busiest, JCP lightest). Every timestamp is
// derived from today (§7.21) on a seeded stream — no Math.random, no literal dates. clockStoppedHours accrues
// only while awaiting-client: §5's attribution logic applied to requests, which is what makes the stop-clock
// defensible rather than contested (a request stopped for 40 h of client silence does not breach its TAT).

const REQUEST_TYPES = ['query', 'dispute', 'masterData', 'fixedAsset', 'priceChange', 'urgentPayment'] as const;
const STATUSES: Request['status'][] = ['open', 'in-progress', 'awaiting-client', 'closed'];

// 8-12 per entity, ordered by exception load (JRP 48 > JBL 41 > JGL 32 > JPS 12 > JHS 6 > JCP 3 SLA breaches).
const VOLUME: Record<string, number> = { JRP: 12, JBL: 11, JGL: 10, JPS: 9, JHS: 8, JCP: 8 };

// Dataset order follows the entity order everywhere else — JGL's rows first.
const ENTITY_ORDER = ['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP'];

// §7.30 / Step 14 carry-over — owners are named people from the owning entity's §7.17 pool, not departments.
// An anonymous queue is the accountability gap the platform exists to close; we cannot ask the client to name
// who holds a goods receipt while our own queue is owned by a team. Drawn on a separate seeded stream so the
// request-row stream (and its pinned stats) stays untouched.
const OWNER_POOL: Record<string, string[]> = {
  JGL: ['P. Nair', 'A. Sethi', 'R. Iyer'],
  JBL: ['M. Kulkarni', 'S. Rao'],
  JPS: ['W. Tan', 'L. Cheong'],
  JCP: ['D. Whitfield', 'K. Moreau'],
  JHS: ['J. Halloran', 'T. Bergstrom'],
  JRP: ['C. Tremblay', 'N. Okafor'],
};

export function requestOwnerPool(entityCode: string): string[] {
  return OWNER_POOL[entityCode] ?? [];
}

// Client-side roles that raise requests — reference strings, seeded per row.
const RAISED_BY = ['Plant stores', 'Procurement', 'Sales lead', 'Plant manager', 'Business partner'];

const CATEGORIES: Record<Request['type'], string[]> = {
  query: ['Invoice status', 'Payment status', 'Balance enquiry', 'Report request'],
  dispute: ['Price variance', 'Quantity mismatch', 'Duplicate invoice', 'Service credit'],
  masterData: ['New vendor', 'Vendor bank change', 'Customer master update', 'Chart of accounts'],
  fixedAsset: ['Asset addition', 'Asset disposal', 'Depreciation query', 'Capitalisation review'],
  priceChange: ['Rate revision', 'Contract renewal pricing', 'Freight surcharge', 'Escalation clause'],
  urgentPayment: ['Payroll urgency', 'Regulatory payment', 'Vendor escalation', 'Court order'],
};

function p2(n: number): string {
  return String(n).padStart(2, '0');
}

// Seeded Fisher-Yates — the first six rows of an entity cover all six types and the first four a permutation of
// all four statuses, so coverage holds by construction for any volume in [8, 12].
function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRequests(): Request[] {
  const rows: Request[] = [];
  for (const code of ENTITY_ORDER) {
    const n = VOLUME[code];
    const rand = mulberry32(fnv1a(`requests:${code}`));
    const ownerRand = mulberry32(fnv1a(`requests-owner:${code}`)); // separate stream — see OWNER_POOL note
    const types = shuffle(REQUEST_TYPES, rand);
    const statuses = shuffle(STATUSES, rand);

    for (let i = 0; i < n; i++) {
      const type = i < REQUEST_TYPES.length ? types[i] : REQUEST_TYPES[Math.floor(rand() * REQUEST_TYPES.length)];
      const status = i < STATUSES.length ? statuses[i] : STATUSES[Math.floor(rand() * STATUSES.length)];
      const hh = 8 + Math.floor(rand() * 9); // working hours, like the §7.6 beat times
      const mm = Math.floor(rand() * 60);

      let raisedDaysAgo: number;
      if (status === 'closed') {
        raisedDaysAgo = 8 + Math.floor(rand() * 30); // [8, 37] — old enough to have resolved
      } else {
        raisedDaysAgo = 1 + Math.floor(rand() * 25); // [1, 25] — live queue ageing
      }
      const raisedDate = addDays(ANCHOR, -raisedDaysAgo);

      let resolvedOn: string | undefined;
      if (status === 'closed') {
        const resolveDays = Math.min(1 + Math.floor(rand() * 12), raisedDaysAgo); // [1, 12] days to resolution
        resolvedOn = `${isoDate(addDays(raisedDate, resolveDays))}T${p2(hh)}:${p2(mm)}:00`;
      }

      rows.push({
        id: `REQ-${code}-${String(i + 1).padStart(3, '0')}`,
        type,
        entityCode: code,
        raisedBy: RAISED_BY[Math.floor(rand() * RAISED_BY.length)],
        raisedOn: `${isoDate(raisedDate)}T${p2(hh)}:${p2(mm)}:00`,
        category: CATEGORIES[type][Math.floor(rand() * CATEGORIES[type].length)],
        owner: OWNER_POOL[code][Math.floor(ownerRand() * OWNER_POOL[code].length)],
        status,
        clockStoppedHours: status === 'awaiting-client' ? 4 + Math.floor(rand() * 60) : 0, // [4, 63] h — only while awaiting client
        resolvedOn,
      });
    }
  }
  return rows;
}

export const requests: Request[] = buildRequests();

// §7.29 deflection counter — requests answered by self-service versus routed to the service team. Pinned per
// Step 14 carry-over: 34 self-served of 92 contacts (34 + 58 routed), 37%. It carries into the Step 16
// operating-model argument alongside the ₹23.4 cr prevented, and a quotable number must not move between
// regenerations — so it is a literal, not a seeded draw. The rate stays derived in index.ts (never stored).
export const deflectedSelfServed: Record<string, number> = { JGL: 7, JBL: 4, JPS: 7, JCP: 5, JHS: 4, JRP: 7 };
