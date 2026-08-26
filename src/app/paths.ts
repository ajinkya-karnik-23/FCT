import { listCauses } from '../api'

// spec/08 Part D — an entry point that lands on root cause without naming a cause resolves to the
// default pair: p2p plus that taxonomy's first cause. Never a stale selection.
export function defaultRootCauseTo(entityCode: string): string {
  const first = listCauses('p2p')[0].key
  return `/entity/${entityCode}/root-cause/p2p/${first}`
}
