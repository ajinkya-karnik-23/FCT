import { describe, expect, it } from 'vitest'
import { activeNavKey, buildBreadcrumb, type Crumb, type NavKey } from '../src/app/routes'

// spec/02 — the breadcrumb derives from the route; every level is linkable except the last.
const crumbCases: [string, Crumb[]][] = [
  ['/', [{ label: 'Group' }]],
  ['/entity/JGL', [{ label: 'Group', to: '/' }, { label: 'JGL' }]],
  ['/entity/JGL/p2p', [{ label: 'Group', to: '/' }, { label: 'JGL', to: '/entity/JGL' }, { label: 'P2P' }]],
  ['/entity/JGL/o2c', [{ label: 'Group', to: '/' }, { label: 'JGL', to: '/entity/JGL' }, { label: 'O2C' }]],
  ['/entity/JGL/r2r', [{ label: 'Group', to: '/' }, { label: 'JGL', to: '/entity/JGL' }, { label: 'R2R' }]],
  // §18/§9.1 — the requisition pipeline drills out of the P2P cockpit's PR stage; drill-only, no rail entry (like commitments watch).
  ['/entity/JGL/requisitions', [{ label: 'Group', to: '/' }, { label: 'JGL', to: '/entity/JGL' }, { label: 'Requisitions' }]],
  [
    '/entity/JGL/p2p/invoices',
    [
      { label: 'Group', to: '/' },
      { label: 'JGL', to: '/entity/JGL' },
      { label: 'P2P', to: '/entity/JGL/p2p' },
      { label: 'Invoices' },
    ],
  ],
  [
    '/entity/JGL/p2p/invoices/AP-104281',
    [
      { label: 'Group', to: '/' },
      { label: 'JGL', to: '/entity/JGL' },
      { label: 'P2P', to: '/entity/JGL/p2p' },
      { label: 'Invoices', to: '/entity/JGL/p2p/invoices' },
      { label: 'AP-104281' },
    ],
  ],
  // §18.3 — the O2C worklist and its item detail; same crumb shape as the P2P invoices pair.
  [
    '/entity/JGL/o2c/invoices',
    [
      { label: 'Group', to: '/' },
      { label: 'JGL', to: '/entity/JGL' },
      { label: 'O2C', to: '/entity/JGL/o2c' },
      { label: 'Invoices' },
    ],
  ],
  [
    '/entity/JGL/o2c/invoices/AR-704001',
    [
      { label: 'Group', to: '/' },
      { label: 'JGL', to: '/entity/JGL' },
      { label: 'O2C', to: '/entity/JGL/o2c' },
      { label: 'Invoices', to: '/entity/JGL/o2c/invoices' },
      { label: 'AR-704001' },
    ],
  ],
  [
    '/entity/JIL/working-capital',
    [{ label: 'Group', to: '/' }, { label: 'JIL', to: '/entity/JIL' }, { label: 'Working capital' }],
  ],
  // §17 — the group-level register; ?cause= drills land here with their section pre-filtered.
  ['/root-causes', [{ label: 'Group', to: '/' }, { label: 'Root causes' }]],
  // The reference prototype beside its rebuild — routes and rail only, like its successor.
  ['/cash-attribution-original', [{ label: 'Group', to: '/' }, { label: 'Cash attribution (original)' }]],
  ['/agents', [{ label: 'Group', to: '/' }, { label: 'Agents' }]],
  // §15.7 — the per-agent record drills in under Agents; the last crumb is the agent's display name.
  [
    '/agents/follow-up',
    [{ label: 'Group', to: '/' }, { label: 'Agents', to: '/agents' }, { label: 'Follow-up & escalation' }],
  ],
]

describe('buildBreadcrumb (spec/02)', () => {
  it.each(crumbCases)('%s', (pathname, expected) => {
    expect(buildBreadcrumb(pathname)).toEqual(expected)
  })

  it('only the last crumb is unlinked on every shape', () => {
    for (const [pathname] of crumbCases) {
      const crumbs = buildBreadcrumb(pathname)
      crumbs.slice(0, -1).forEach((c) => expect(c.to).toBeTruthy())
      expect(crumbs[crumbs.length - 1].to).toBeUndefined()
    }
  })

  it('unknown paths fall back to the group crumb', () => {
    expect(buildBreadcrumb('/entity/JGL/nope')).toEqual([{ label: 'Group' }])
  })
})

const navCases: [string, NavKey][] = [
  ['/', 'group'],
  ['/entity/JGL', 'entityHealth'],
  ['/entity/JBS', 'entityHealth'],
  ['/entity/JGL/p2p', 'p2pCockpit'],
  ['/entity/JGL/o2c', 'o2cCockpit'],
  ['/entity/JGL/r2r', 'r2rCockpit'],
  // §18/§9.1 — the requisition pipeline drills out of the P2P cockpit's PR stage; it keeps that active, like commitments watch.
  ['/entity/JGL/requisitions', 'p2pCockpit'],
  ['/entity/JGL/p2p/invoices', 'worklist'],
  // Worklist stays active while an exception detail page is open (spec/02).
  ['/entity/JGL/p2p/invoices/AP-104281', 'worklist'],
  // §18.3 — the O2C worklist and its item detail keep the same rail entry, like their P2P pair.
  ['/entity/JGL/o2c/invoices', 'worklist'],
  ['/entity/JGL/o2c/invoices/AR-704001', 'worklist'],
  // §17 — the register replaced both the per-entity taxonomy screen and Cause elimination.
  ['/root-causes', 'rootCauses'],
  ['/cash-attribution-original', 'cashAttributionOriginal'],
  ['/entity/JGL/working-capital', 'workingCapital'],
  ['/agents', 'agents'],
  // §15.7 — the record page keeps the Agents rail item active.
  ['/agents/follow-up', 'agents'],
]

describe('activeNavKey (spec/02)', () => {
  it.each(navCases)('%s → %s', (pathname, key) => {
    expect(activeNavKey(pathname)).toBe(key)
  })
})
