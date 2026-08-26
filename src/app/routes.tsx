import { Navigate, Route, Routes } from 'react-router-dom'
import { defaultRootCauseTo } from './paths'
import { EntityHome } from '../pages/EntityHome'
import { ExceptionDetail } from '../pages/ExceptionDetail'
import { GroupView } from '../pages/GroupView'
import { O2CCockpit } from '../pages/O2CCockpit'
import { P2PCockpit } from '../pages/P2PCockpit'
import { RootCause } from '../pages/RootCause'
import { Worklist } from '../pages/Worklist'
import { WorkingCapital } from '../pages/WorkingCapital'

// --- Route model (spec/02) -------------------------------------------------

export const DEFAULT_ENTITY = 'JGL'

export interface Crumb {
  label: string
  to?: string // absent on the current page's crumb
}

// Breadcrumb derives from the route; every level is linkable except the last.
export function buildBreadcrumb(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0 || parts[0] !== 'entity' || !parts[1]) return [{ label: 'Group' }]

  const code = parts[1]
  const group: Crumb = { label: 'Group', to: '/' }
  const entityLink: Crumb = { label: code, to: `/entity/${code}` }
  const p2pLink: Crumb = { label: 'P2P', to: `/entity/${code}/p2p` }

  if (parts.length === 2) return [group, { label: code }]
  if (parts[2] === 'p2p' && parts.length === 3) return [group, entityLink, { label: 'P2P' }]
  if (parts[2] === 'o2c' && parts.length === 3) return [group, entityLink, { label: 'O2C' }]
  if (parts[2] === 'p2p' && parts[3] === 'invoices' && parts.length === 4) {
    return [group, entityLink, p2pLink, { label: 'Invoices' }]
  }
  if (parts[2] === 'p2p' && parts[3] === 'invoices' && parts.length >= 5) {
    return [group, entityLink, p2pLink, { label: 'Invoices', to: `/entity/${code}/p2p/invoices` }, { label: parts[4] }]
  }
  if (parts[2] === 'root-cause') {
    // The process segment picks the middle crumb: Group › JGL › P2P|O2C › Root cause
    const processCrumb: Crumb = parts[3] === 'o2c' ? { label: 'O2C', to: `/entity/${code}/o2c` } : p2pLink
    return [group, entityLink, processCrumb, { label: 'Root cause' }]
  }
  if (parts[2] === 'working-capital') return [group, entityLink, { label: 'Working capital' }]

  return [{ label: 'Group' }]
}

export type NavKey = 'group' | 'entityHealth' | 'p2pCockpit' | 'o2cCockpit' | 'worklist' | 'rootCause' | 'workingCapital'

// Worklist stays active while an exception detail page is open (spec/02).
export function activeNavKey(pathname: string): NavKey {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0 || parts[0] !== 'entity') return 'group'
  if (parts.length === 2) return 'entityHealth'
  switch (parts[2]) {
    case 'p2p':
      return parts.length > 3 ? 'worklist' : 'p2pCockpit'
    case 'o2c':
      return 'o2cCockpit'
    case 'root-cause':
      return 'rootCause'
    case 'working-capital':
      return 'workingCapital'
    default:
      return 'group'
  }
}

export interface NavItem {
  key: NavKey
  label: string
  count?: number // undefined renders as "—" (spec/02)
  to: (entityCode?: string) => string
}

// Counts are the literal spec values; `to` keeps the current entity when one is in context.
export const NAV_ITEMS: NavItem[] = [
  { key: 'group', label: 'Group view', count: 6, to: () => '/' },
  { key: 'entityHealth', label: 'Entity health', to: (c) => `/entity/${c ?? DEFAULT_ENTITY}` },
  { key: 'p2pCockpit', label: 'P2P cockpit', count: 327, to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/p2p` },
  { key: 'o2cCockpit', label: 'O2C cockpit', count: 284, to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/o2c` },
  { key: 'worklist', label: 'Worklist', count: 12, to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/p2p/invoices` },
  { key: 'rootCause', label: 'Root cause', to: (c) => defaultRootCauseTo(c ?? DEFAULT_ENTITY) },
  { key: 'workingCapital', label: 'Working capital', to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/working-capital` },
]

export function entityCodeFromPath(pathname: string): string | undefined {
  const parts = pathname.split('/').filter(Boolean)
  return parts[0] === 'entity' ? parts[1] : undefined
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<GroupView />} />
      <Route path="/entity/:code" element={<EntityHome />} />
      <Route path="/entity/:code/p2p" element={<P2PCockpit />} />
      <Route path="/entity/:code/p2p/invoices" element={<Worklist />} />
      <Route path="/entity/:code/p2p/invoices/:exceptionId" element={<ExceptionDetail />} />
      <Route path="/entity/:code/o2c" element={<O2CCockpit />} />
      <Route path="/entity/:code/root-cause/:process/:causeKey" element={<RootCause />} />
      <Route path="/entity/:code/working-capital" element={<WorkingCapital />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
