import { Navigate, Route, Routes } from 'react-router-dom'
import { defaultRootCauseTo } from './paths'
import { getAgent, getCounterparty, getEntity, listAgents, listCostCentres, listEntities, listExceptions, listPlants } from '../api'
import { AgentDetail } from '../pages/AgentDetail'
import { Agents } from '../pages/Agents'
import { CashAttribution } from '../pages/CashAttribution'
import { CauseBacklog } from '../pages/CauseBacklog'
import { CommitmentsWatch } from '../pages/CommitmentsWatch'
import { CompliancePage } from '../pages/CompliancePage'
import { CostCentrePage } from '../pages/CostCentrePage'
import { CustomerPage } from '../pages/CustomerPage'
import { DataQualityPage } from '../pages/DataQualityPage'
import { EntityHome } from '../pages/EntityHome'
import { ExceptionDetail } from '../pages/ExceptionDetail'
import { GroupView } from '../pages/GroupView'
import { O2CCockpit } from '../pages/O2CCockpit'
import { P2PCockpit } from '../pages/P2PCockpit'
import { PlantPage } from '../pages/PlantPage'
import { PoDetail } from '../pages/PoDetail'
import { Predictive } from '../pages/Predictive'
import { RiskControl } from '../pages/RiskControl'
import { RootCause } from '../pages/RootCause'
import { ServiceAttribution } from '../pages/ServiceAttribution'
import { ServiceDesk } from '../pages/ServiceDesk'
import { TouchEconomics } from '../pages/TouchEconomics'
import { VendorPage } from '../pages/VendorPage'
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
  if (parts.length === 1 && parts[0] === 'risk-control') return [{ label: 'Group', to: '/' }, { label: 'Risk & control' }]
  if (parts.length === 1 && parts[0] === 'compliance') return [{ label: 'Group', to: '/' }, { label: 'Compliance' }]
  if (parts.length === 1 && parts[0] === 'data-quality') return [{ label: 'Group', to: '/' }, { label: 'Data quality' }]
  if (parts.length === 1 && parts[0] === 'service-desk') return [{ label: 'Group', to: '/' }, { label: 'Finance Service Desk' }]
  if (parts.length === 1 && parts[0] === 'cause-backlog') return [{ label: 'Group', to: '/' }, { label: 'Cause elimination' }]
  if (parts.length === 1 && parts[0] === 'cash-attribution') return [{ label: 'Group', to: '/' }, { label: 'Cash attribution' }]
  if (parts.length === 1 && parts[0] === 'agents') return [{ label: 'Group', to: '/' }, { label: 'Agents' }]
  if (parts.length === 1 && parts[0] === 'touch-economics') return [{ label: 'Group', to: '/' }, { label: 'Touch economics' }]
  // §9.1 — the agent record is reached by drill only; the breadcrumb carries it back to the roster.
  if (parts.length === 2 && parts[0] === 'agents') return [{ label: 'Group', to: '/' }, { label: 'Agents', to: '/agents' }, { label: getAgent(parts[1])?.name ?? parts[1] }]
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
  // §15.7 — the commitments watch and PO detail are drill-only under P2P (no rail entry), like the counterparty pages.
  if (parts[2] === 'p2p' && parts[3] === 'commitments' && parts.length === 4) {
    return [group, entityLink, p2pLink, { label: 'Commitments watch' }]
  }
  if (parts[2] === 'p2p' && parts[3] === 'commitments' && parts.length >= 5) {
    return [group, entityLink, p2pLink, { label: 'Commitments watch', to: `/entity/${code}/p2p/commitments` }, { label: parts[4] }]
  }
  if (parts[2] === 'root-cause') {
    // The process segment picks the middle crumb: Group › JGL › P2P|O2C › Root cause
    const processCrumb: Crumb = parts[3] === 'o2c' ? { label: 'O2C', to: `/entity/${code}/o2c` } : p2pLink
    return [group, entityLink, processCrumb, { label: 'Root cause' }]
  }
  if (parts[2] === 'working-capital') return [group, entityLink, { label: 'Working capital' }]
  if (parts[2] === 'service') return [group, entityLink, { label: 'Service & attribution' }]
  if (parts[2] === 'predictive') return [group, entityLink, { label: 'Predictive' }]

  // §9.1 — counterparty pages are reached by drill only; the breadcrumb carries them back to their process screen.
  if (parts[2] === 'vendor' && parts.length === 4) {
    const name = getCounterparty(parts[3])?.name ?? parts[3]
    return [group, entityLink, p2pLink, { label: name }]
  }
  if (parts[2] === 'customer' && parts.length === 4) {
    const name = getCounterparty(parts[3])?.name ?? parts[3]
    return [group, entityLink, { label: 'O2C', to: `/entity/${code}/o2c` }, { label: name }]
  }
  if (parts[2] === 'cost-centre' && parts.length === 4) {
    const name = listCostCentres(code).find((c) => c.id === parts[3])?.name ?? parts[3]
    return [group, entityLink, p2pLink, { label: name }]
  }
  if (parts[2] === 'plant' && parts.length === 4) {
    const name = listPlants(code).find((p) => p.id === parts[3])?.name ?? parts[3]
    return [group, entityLink, p2pLink, { label: name }]
  }

  return [{ label: 'Group' }]
}

export type NavKey = 'group' | 'entityHealth' | 'p2pCockpit' | 'o2cCockpit' | 'worklist' | 'rootCause' | 'cashAttribution' | 'causeBacklog' | 'riskControl' | 'compliance' | 'dataQuality' | 'workingCapital' | 'predictive' | 'serviceAttribution' | 'serviceDesk' | 'agents' | 'touchEconomics'

// Worklist stays active while an exception detail page is open (spec/02).
export function activeNavKey(pathname: string): NavKey {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 1 && parts[0] === 'risk-control') return 'riskControl'
  if (parts.length === 1 && parts[0] === 'compliance') return 'compliance'
  if (parts.length === 1 && parts[0] === 'data-quality') return 'dataQuality'
  if (parts.length === 1 && parts[0] === 'service-desk') return 'serviceDesk'
  if (parts.length === 1 && parts[0] === 'cause-backlog') return 'causeBacklog'
  if (parts.length === 1 && parts[0] === 'cash-attribution') return 'cashAttribution'
  if (parts.length === 1 && parts[0] === 'agents') return 'agents'
  // §9.1 — the agent record keeps the Agents rail entry active, like exception detail keeps Worklist.
  if (parts.length === 2 && parts[0] === 'agents') return 'agents'
  if (parts.length === 1 && parts[0] === 'touch-economics') return 'touchEconomics'
  if (parts.length === 0 || parts[0] !== 'entity') return 'group'
  if (parts.length === 2) return 'entityHealth'
  switch (parts[2]) {
    case 'p2p': {
      // §15.7 — the commitments watch and PO detail drill out of the cockpit's PO stage, so they keep it active.
      if (parts.length > 3 && parts[3] !== 'commitments') return 'worklist'
      return 'p2pCockpit'
    }
    case 'o2c':
      return 'o2cCockpit'
    case 'root-cause':
      return 'rootCause'
    case 'working-capital':
      return 'workingCapital'
    case 'predictive':
      return 'predictive'
    case 'service':
      return 'serviceAttribution'
    // §9.1 — counterparty pages keep their process screen active (vendor/plant/cost centre sit under P2P, customer under O2C).
    case 'vendor':
    case 'plant':
    case 'cost-centre':
      return 'worklist'
    case 'customer':
      return 'o2cCockpit'
    default:
      return 'group'
  }
}

export interface NavItem {
  key: NavKey
  label: string
  group: RailGroup // §9.1 — the rail renders one labelled block per group, in first-appearance order
  count?: number // undefined renders as "—" (spec/02)
  to: (entityCode?: string) => string
}

export type RailGroup = 'OVERVIEW' | 'PROCESS' | 'EXPLAIN' | 'ASSURE' | 'FORWARD' | 'SERVICE' | 'AGENTS'

// §9.1 — the rail groups, in render order; AGENTS is its own block at the foot of the rail (§15).
export const RAIL_GROUPS: RailGroup[] = ['OVERVIEW', 'PROCESS', 'EXPLAIN', 'ASSURE', 'FORWARD', 'SERVICE', 'AGENTS']

// §0/§9.1 — counts derive from the API accessors (no literals); the rail shows the default entity's figures.
const DEFAULT_ENTITY_METRICS = getEntity(DEFAULT_ENTITY)!.metrics

export const NAV_ITEMS: NavItem[] = [
  { key: 'group', label: 'Group view', group: 'OVERVIEW', count: listEntities().length, to: () => '/' },
  { key: 'entityHealth', label: 'Entity health', group: 'OVERVIEW', to: (c) => `/entity/${c ?? DEFAULT_ENTITY}` },
  { key: 'p2pCockpit', label: 'P2P cockpit', group: 'PROCESS', count: DEFAULT_ENTITY_METRICS.apBlockedCount, to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/p2p` },
  { key: 'o2cCockpit', label: 'O2C cockpit', group: 'PROCESS', count: DEFAULT_ENTITY_METRICS.o2cExceptionCount, to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/o2c` },
  { key: 'worklist', label: 'Worklist', group: 'EXPLAIN', count: listExceptions(DEFAULT_ENTITY, 'p2p').length, to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/p2p/invoices` },
  { key: 'rootCause', label: 'Root cause', group: 'EXPLAIN', to: (c) => defaultRootCauseTo(c ?? DEFAULT_ENTITY) },
  // Where cash is stuck across both processes, grouped by the function that causes it rather than the one
  // that holds it. Sits under PROCESS since it spans both P2P and O2C cockpits; group-scoped, no entity in `to`.
  { key: 'cashAttribution', label: 'Cash attribution', group: 'PROCESS', to: () => '/cash-attribution' },
  // §7.30 — the elimination backlog sits next to Root cause under EXPLAIN; group-scoped, so no entity in `to`.
  { key: 'causeBacklog', label: 'Cause elimination', group: 'EXPLAIN', to: () => '/cause-backlog' },
  { key: 'riskControl', label: 'Risk & control', group: 'ASSURE', to: () => '/risk-control' },
  { key: 'compliance', label: 'Compliance', group: 'ASSURE', to: () => '/compliance' },
  { key: 'dataQuality', label: 'Data quality', group: 'ASSURE', to: () => '/data-quality' },
  { key: 'workingCapital', label: 'Working capital', group: 'FORWARD', to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/working-capital` },
  { key: 'predictive', label: 'Predictive', group: 'FORWARD', to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/predictive` },
  { key: 'serviceAttribution', label: 'Service & attribution', group: 'SERVICE', to: (c) => `/entity/${c ?? DEFAULT_ENTITY}/service` },
  { key: 'serviceDesk', label: 'Finance Service Desk', group: 'SERVICE', to: () => '/service-desk' }, // §9.1
  // §15 — the agent workforce; count is the live roles (the rail never claims what isn't built).
  { key: 'agents', label: 'Agents', group: 'AGENTS', count: listAgents().filter((a) => a.status === 'live').length, to: () => '/agents' },
  // §15.3/§15.4 — the commercial conversation; group-scoped, so no entity in `to`.
  { key: 'touchEconomics', label: 'Touch economics', group: 'AGENTS', to: () => '/touch-economics' },
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
      {/* §15.7 — the commitments watch (open POs by delivery date) and its PO detail: drill-only, no rail entries */}
      <Route path="/entity/:code/p2p/commitments" element={<CommitmentsWatch />} />
      <Route path="/entity/:code/p2p/commitments/:poId" element={<PoDetail />} />
      <Route path="/entity/:code/o2c" element={<O2CCockpit />} />
      <Route path="/entity/:code/root-cause/:process/:causeKey" element={<RootCause />} />
      <Route path="/entity/:code/working-capital" element={<WorkingCapital />} />
      <Route path="/entity/:code/service" element={<ServiceAttribution />} />
      <Route path="/entity/:code/predictive" element={<Predictive />} />
      {/* §9.1 — counterparty pages: drill-only, no rail entries */}
      <Route path="/entity/:code/vendor/:id" element={<VendorPage />} />
      <Route path="/entity/:code/customer/:id" element={<CustomerPage />} />
      <Route path="/entity/:code/cost-centre/:id" element={<CostCentrePage />} />
      <Route path="/entity/:code/plant/:id" element={<PlantPage />} />
      <Route path="/risk-control" element={<RiskControl />} />
      <Route path="/compliance" element={<CompliancePage />} />
      <Route path="/data-quality" element={<DataQualityPage />} />
      <Route path="/service-desk" element={<ServiceDesk />} />
      <Route path="/cause-backlog" element={<CauseBacklog />} />
      <Route path="/cash-attribution" element={<CashAttribution />} />
      <Route path="/agents" element={<Agents />} />
      {/* §9.1 — the agent record: drill-only, no rail entry */}
      <Route path="/agents/:agentId" element={<AgentDetail />} />
      <Route path="/touch-economics" element={<TouchEconomics />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
