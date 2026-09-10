import { describe, expect, it } from 'vitest'
import { activeNavKey, buildBreadcrumb, type Crumb, type NavKey } from '../src/app/routes'

// spec/02 — the breadcrumb derives from the route; every level is linkable except the last.
const crumbCases: [string, Crumb[]][] = [
  ['/', [{ label: 'Group' }]],
  ['/entity/JGL', [{ label: 'Group', to: '/' }, { label: 'JGL' }]],
  ['/entity/JGL/p2p', [{ label: 'Group', to: '/' }, { label: 'JGL', to: '/entity/JGL' }, { label: 'P2P' }]],
  ['/entity/JGL/o2c', [{ label: 'Group', to: '/' }, { label: 'JGL', to: '/entity/JGL' }, { label: 'O2C' }]],
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
  [
    // Root cause drills in under its process even though the URL skips /p2p.
    '/entity/JBS/root-cause/p2p/missing-gr',
    [
      { label: 'Group', to: '/' },
      { label: 'JBS', to: '/entity/JBS' },
      { label: 'P2P', to: '/entity/JBS/p2p' },
      { label: 'Root cause' },
    ],
  ],
  [
    // spec/08 Part D — the process segment picks the middle crumb.
    '/entity/JGL/root-cause/o2c/pricing-disputes',
    [
      { label: 'Group', to: '/' },
      { label: 'JGL', to: '/entity/JGL' },
      { label: 'O2C', to: '/entity/JGL/o2c' },
      { label: 'Root cause' },
    ],
  ],
  [
    '/entity/JIL/working-capital',
    [{ label: 'Group', to: '/' }, { label: 'JIL', to: '/entity/JIL' }, { label: 'Working capital' }],
  ],
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
  ['/entity/JGL/p2p/invoices', 'worklist'],
  // Worklist stays active while an exception detail page is open (spec/02).
  ['/entity/JGL/p2p/invoices/AP-104281', 'worklist'],
  ['/entity/JGL/root-cause/p2p/missing-gr', 'rootCause'],
  ['/entity/JGL/root-cause/o2c/pricing-disputes', 'rootCause'],
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
