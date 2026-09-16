import { getRootCause, listExceptions } from '../api'

// §17 — the per-entity taxonomy screen and Cause elimination are consolidated into one group-level register; every root-cause link now lands there, optionally pre-filtered to a cause's section.
export function rootCauseTo(causeKey?: string): string {
  return causeKey ? `/root-causes?cause=${causeKey}` : '/root-causes'
}

// §17.4 — a register row's Items figure drills the worklist to the items traced to that root cause, P2P and O2C alike.
// The entity is the first traced item's, falling back to the entry's own list.
export function rootCauseItemsTo(entryId: string): string | null {
  const entry = getRootCause(entryId)
  if (!entry || (entry.process !== 'P2P' && entry.process !== 'O2C')) return null
  const processKey = entry.process === 'O2C' ? 'o2c' : 'p2p'
  const items = listExceptions().filter((x) => x.rootCauseId === entryId && x.processKey === processKey)
  const code = items[0]?.entityCode ?? entry.entityCodes[0]
  if (!code) return null
  return `/entity/${code}/${processKey}/invoices?rc=${entryId}`
}
