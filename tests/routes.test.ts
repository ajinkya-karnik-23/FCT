import { describe, expect, it } from 'vitest'
import { activeNavKey, buildBreadcrumb, type Crumb, type NavKey } from '../src/app/routes'

// spec/02 — the breadcrumb derives from the route; every level is linkable except the last.
const crumbCases: [string, Crumb[]][] = [
  ['/', [{ label: 'Group' }]],
  ['/entity/JGL', [{ label: 'Group', to: '/' }, { label: 'JGL' }]],
  ['/entity/JGL/p2p', [{ label: 'Group', to: '/' }, { label: 'JGL', to: '/entity/JGL' }, { label: 'P2P' }]],
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
    // Root cause drills in under P2P even though the URL skips /p2p.
    '/entity/JBS/root-cause/missing-gr',
    [
      { label: 'Group', to: '/' },
      { label: 'JBS', to: '/entity/JBS' },
      { label: 'P2P', to: '/entity/JBS/p2p' },
      { label: 'Root cause' },
    ],
  ],
  [
    '/entity/JIL/working-capital',
    [{ label: 'Group', to: '/' }, { label: 'JIL', to: '/entity/JIL' }, { label: 'Working capital' }],
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
  ['/entity/JGL/p2p/invoices', 'worklist'],
  // Worklist stays active while an exception detail page is open (spec/02).
  ['/entity/JGL/p2p/invoices/AP-104281', 'worklist'],
  ['/entity/JGL/root-cause/missing-gr', 'rootCause'],
  ['/entity/JGL/working-capital', 'workingCapital'],
]

describe('activeNavKey (spec/02)', () => {
  it.each(navCases)('%s → %s', (pathname, key) => {
    expect(activeNavKey(pathname)).toBe(key)
  })
})
