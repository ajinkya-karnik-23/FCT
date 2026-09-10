// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

function main() {
  return within(screen.getByRole('main'))
}

const entityRows: Array<[string, string]> = [
  ['Jubilant Generics Ltd', 'JGL'],
  ['Jubilant Biosys Ltd', 'JBL'],
  ['Jubilant Pharma Ltd', 'JPS'],
  ['Jubilant Cadista Pharmaceuticals Inc', 'JCP'],
  ['Jubilant HollisterStier LLC', 'JHS'],
  ['Jubilant Radiopharma', 'JRP'],
]

describe('Group view (spec/04)', () => {
  it('shows the group KPIs and one row per legal entity, each linking to its health home', () => {
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'Finance health across six legal entities' })).toBeTruthy()

    // Header KPIs from the group summary.
    expect(m.getByText('76')).toBeTruthy()
    expect(m.getByText('₹100.4 cr')).toBeTruthy()
    expect(m.getByText('1,980')).toBeTruthy()

    // §7.15/§7.16 — score and open exceptions now carry a two-point delta (scoped to each KPI).
    expect(within(m.getByText('GROUP SCORE').parentElement!).getByText('-1')).toBeTruthy()
    expect(within(m.getByText('OPEN EXCEPTIONS').parentElement!).getByText('-32')).toBeTruthy()

    // §8.6.1 — every derived header KPI states what it counts on hover; the text lives with the accessor.
    expect(m.getByTitle(/mean of the six entities/i)).toBeTruthy()
    expect(m.getByTitle(/blocked AP invoices plus receivables over 90 days/i)).toBeTruthy()
    expect(m.getByTitle(/O2C exceptions \+ aged R2R reconciliation breaks/i)).toBeTruthy()

    for (const [name, code] of entityRows) {
      const row = m.getByRole('link', { name: new RegExp(name.replace(/[()]/g, '\\$&')) })
      expect(row.getAttribute('href')).toBe(`/entity/${code}`)
    }

    // Spot-check the derived health cells on two rows.
    const jgl = m.getByRole('link', { name: /Jubilant Generics Ltd/ })
    expect(jgl.textContent).toContain('74')
    expect(jgl.textContent).toContain('AMBER')
    expect(jgl.textContent).toContain('₹18.6 cr')
    expect(jgl.textContent).toContain('78%')

    const jbl = m.getByRole('link', { name: /Jubilant Biosys Ltd/ })
    expect(jbl.textContent).toContain('67')
    expect(jbl.textContent).toContain('AMBER')

    // §7.15 — each dimension bar trails a two-point delta; spot-check JGL operational +3 and JRP risk −6.
    expect(within(jgl).getByText('+3')).toBeTruthy()
    const jrp = m.getByRole('link', { name: /Jubilant Radiopharma/ })
    expect(within(jrp).getByText('-6')).toBeTruthy()

    // §8.6.1 — every dimension score states what it counts on hover (same definition wherever the bar renders).
    expect(within(jgl).getByTitle(/first-time-right/i)).toBeTruthy()
    expect(within(jrp).getByTitle(/SoD, cut-off integrity/i)).toBeTruthy()
  })

  it('switches the table between Entity, Segment and Geography groupings (§2)', () => {
    render(<App />)
    const m = main()

    // Default is Entity — one drill link per legal entity. Row links are scoped to the table so the
    // cross-process trace links in the close card do not count toward the row total.
    const rowLinks = () => m.queryAllByRole('link').filter((l) => l.className.includes('fct-table-row'))
    expect(m.getByRole('heading', { level: 1, name: 'Finance health across six legal entities' })).toBeTruthy()
    expect(rowLinks()).toHaveLength(6)

    fireEvent.click(m.getByRole('button', { name: 'Segment' }))
    expect(m.getByRole('heading', { level: 1, name: 'Finance health across five segments' })).toBeTruthy()
    const generics = m.getByText('Generics').closest('.fct-table-row')!
    expect(generics.textContent).toContain('83')
    expect(generics.textContent).toContain('₹20.7 cr')
    // Aggregated rows are not drill targets — only entity rows link out.
    expect(rowLinks()).toHaveLength(0)
    // §8.6.1 — an aggregated row states how it is built on hover (means for scores, sums for money).
    expect(generics.getAttribute('title')).toContain('mean of member entities')

    fireEvent.click(m.getByRole('button', { name: 'Geography' }))
    expect(m.getByRole('heading', { level: 1, name: 'Finance health across three geographies' })).toBeTruthy()
    const na = m.getByText('North America').closest('.fct-table-row')!
    expect(na.textContent).toContain('78')

    fireEvent.click(m.getByRole('button', { name: 'Entity' }))
    expect(m.getByRole('heading', { level: 1, name: 'Finance health across six legal entities' })).toBeTruthy()
    expect(rowLinks()).toHaveLength(6)
  })

  it('renders the three group cards with their data', () => {
    render(<App />)
    const m = main()

    // Group-wide recurring causes — label (process), bar, share.
    expect(m.getByText(/group-wide recurring causes/i)).toBeTruthy()
    expect(m.getByText('Missing GR (P2P)')).toBeTruthy()
    expect(m.getByText('Pricing disputes (O2C)')).toBeTruthy()
    expect(m.getByText('Interface breaks (R2R)')).toBeTruthy()
    expect(m.getByText('Approval pending (P2P)')).toBeTruthy() // §6.1 — one cause, one name
    expect(m.getByText('26%')).toBeTruthy()

    // §8.2 — outside the close window the card reads as pre-close readiness (default mode).
    expect(m.getByText('Pre-close readiness — 3 days to close')).toBeTruthy()
    expect(m.getByText('71%')).toBeTruthy()
    expect(m.getByText('of 214 tasks complete')).toBeTruthy()
    expect(m.getByText('19 overdue')).toBeTruthy()
    expect(m.getByText('6 blockers')).toBeTruthy()
    expect(m.getByText('3 entities at risk')).toBeTruthy()
    // §8.4 — the close-tracker figures cannot drill; they are tagged read-only rather than silently unclickable.
    expect(m.getByText('read-only · source: close tracker')).toBeTruthy()

    // Transformation health.
    expect(m.getByText(/transformation health/i)).toBeTruthy()
    expect(m.getByText('Automation rate')).toBeTruthy()
    expect(m.getByText('68% ↑')).toBeTruthy()
    expect(m.getByText('-14% QoQ')).toBeTruthy()
    expect(m.getByText('Causes eliminated')).toBeTruthy()
    expect(m.getByText('11 of 34')).toBeTruthy()
    expect(m.getByText('Touchless invoices')).toBeTruthy()
    expect(m.getByText('54%')).toBeTruthy()
  })

  it('labels the close-progress card per mode — the countdown belongs only where it is true (§8.2)', () => {
    render(<App />)
    const m = main()
    const banner = screen.getByRole('banner')

    // Default pre-close carries the countdown.
    expect(m.getByText('Pre-close readiness — 3 days to close')).toBeTruthy()

    // §8.5 — in BAU the close cycle has not started, so the whole card (a close-window figure) is absent.
    fireEvent.click(within(banner).getByRole('button', { name: 'BAU' }))
    expect(m.queryByText(/tasks complete/)).toBeNull()
    expect(m.queryByText('Pre-close readiness — 3 days to close')).toBeNull()

    fireEvent.click(within(banner).getByRole('button', { name: 'CLOSE' }))
    expect(m.getByText('Close progress — day 4')).toBeTruthy()
  })

  it('names the binding veto on JRP and reveals raw score plus every active cap (§3.5)', () => {
    render(<App />)
    const m = main()

    // Only JRP is capped; the badge names the binding veto (bank change, cap 55).
    expect(m.queryAllByText(/CAPPED —/)).toHaveLength(1)
    const badge = m.getByRole('button', { name: 'CAPPED — unauthorised vendor bank change, unresolved' })

    // Hidden until clicked.
    expect(m.queryByText('raw 57.9')).toBeNull()
    fireEvent.click(badge)
    expect(m.getByText('raw 57.9')).toBeTruthy()
    expect(m.getByText('GST/HST return overdue — cap 60')).toBeTruthy()
    expect(m.getByText('unauthorised vendor bank change, unresolved — cap 55 · binding')).toBeTruthy()

    // Clicking again hides the reveal.
    fireEvent.click(badge)
    expect(m.queryByText('raw 57.9')).toBeNull()
  })
})

describe('Entity health home (spec/04)', () => {
  it('renders JGL with score chip, dimension meters and the six tiles', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Jubilant Generics Ltd' })).toBeTruthy()
    expect(m.getByText('/100')).toBeTruthy()
    expect(m.getByText('AMBER')).toBeTruthy()

    // §7.15 — two-point delta vs the prior period; no veto on JGL, so no drop explanation.
    expect(m.getByText('+2 vs last period')).toBeTruthy()
    expect(m.queryByText(/Raw score moved only/)).toBeNull()

    // Dimension meter labels — the six §3.1 dimensions, each unique on this page.
    for (const label of ['Operational', 'Service & attribution', 'Risk & control', 'Working capital', 'Data & MDM quality', 'Compliance']) {
      expect(m.getByText(label)).toBeTruthy()
    }

    // Tile values — money figures repeat in the top-issues card, so expect two; ₹18.6 cr gains a third occurrence as the §8.2 callout link.
    // §8.5 — the default pre-close panel adds a third '₹3.1 cr' (its unapplied-cash cell).
    expect(m.getAllByText('₹3.1 cr')).toHaveLength(3)
    expect(m.getAllByText('₹18.6 cr')).toHaveLength(3)
    expect(m.getAllByText('₹12.4 cr')).toHaveLength(2)
    expect(m.getByText('78%')).toBeTruthy()
    expect(m.getByText('₹14.3 cr')).toBeTruthy()
    expect(m.getByText('4 breaches')).toBeTruthy()

    // Every tile is a link to its spec/04 target.
    expect(m.getByRole('link', { name: /Cash unapplied/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(m.getByRole('link', { name: /327 invoices/ }).getAttribute('href')).toBe('/entity/JGL/p2p')
    expect(m.getByRole('link', { name: /41 customers/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(m.getByRole('link', { name: /7 blockers/ }).getAttribute('href')).toBe('/entity/JGL')
    // No-cause entry points resolve to the default pair — p2p plus its first cause (spec/08 Part D).
    expect(m.getByRole('link', { name: /18 aged breaks/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(m.getByRole('link', { name: /12 high-risk JEs/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')

    // §8.2 — financial consequence strip directly below the tiles; all six entities carry the four pinned figures.
    const strip = m.getByText('Financial consequence').closest('section')!
    expect(within(strip).getByText('source: trial balance extract')).toBeTruthy()
    for (const [label, value] of [
      ['Accrual exposure at close', '₹6.4 cr'],
      ['Revenue at risk', '₹8.7 cr'],
      ['Provision adequacy', '92%'],
      ['FX / intercompany exposure', '₹3.6 cr'],
    ] as Array<[string, string]>) {
      const cell = within(strip).getByText(label).parentElement!
      expect(within(cell).getByText(value)).toBeTruthy()
    }
    // JGL's accrual explanation is the §7.5 tie: no goods receipt means no accrual.
    for (const explanation of ['34% of blocked AP — no goods receipt means no accrual', 'open disputes and credit blocks', 'provision vs actual utilisation', 'unmatched intercompany with related parties']) {
      expect(within(strip).getByText(explanation)).toBeTruthy()
    }

    // §8.2 — three figures drill to their targets; provision adequacy is tagged read-only (§8.4).
    expect(within(strip).getByRole('link', { name: /Accrual exposure/ }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices?cause=missing-gr')
    expect(within(strip).getByRole('link', { name: /Revenue at risk/ }).getAttribute('href')).toBe('/entity/JGL/o2c#fct-stage-COL')
    expect(within(strip).getByRole('link', { name: /FX \/ intercompany/ }).getAttribute('href')).toBe('/entity/JGL/working-capital#fct-ic-netting')
    expect(within(strip).getByText('read-only · source: trial balance extract')).toBeTruthy()

    // §8.2 — connecting callout above the strip: mode-aware sentence (default pre-close), first figure drills to the blocked invoice worklist, second anchors the strip.
    expect(m.getByText((_content, el) => el.textContent === '₹18.6 cr blocked → ₹6.4 cr will not accrue in 3 days unless goods receipts are posted → COGS understated')).toBeTruthy()
    expect(m.getByRole('link', { name: '₹18.6 cr' }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices')
    expect(m.getByRole('link', { name: '₹6.4 cr' }).getAttribute('href')).toBe('#fct-consequence')

    // §8.5 — default mode is pre-close: the top panel foregrounds readiness figures with their drills.
    const panel = m.getByText('Pre-close readiness').closest('section')!
    for (const [label, value] of [
      ['Unposted goods receipts', '₹6.4 cr'],
      ['Unapplied cash', '₹3.1 cr'],
      ['Aged reconciliation breaks', '18'],
      ['Open disputes', '₹8.7 cr'],
    ] as Array<[string, string]>) {
      const cell = within(panel).getByText(label).parentElement!
      expect(within(cell).getByText(value)).toBeTruthy()
    }
    expect(within(panel).getByText('11 vendors · 5th consecutive month')).toBeTruthy()
    expect(within(panel).getByRole('link', { name: /Unposted goods receipts/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(within(panel).getByRole('link', { name: /Unapplied cash/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(within(panel).getByRole('link', { name: /Aged reconciliation breaks/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(within(panel).getByRole('link', { name: /Open disputes/ }).getAttribute('href')).toBe('/entity/JGL/o2c#fct-stage-COL')
  })

  it('lists the six top issues and three root-cause insights with their drill targets', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    const m = main()

    expect(m.getByText(/top issues requiring attention/i)).toBeTruthy()
    expect(m.getByRole('link', { name: 'Open worklist →' }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices')

    // §8.5 — 'Unapplied cash' also labels a preclose-panel cell, so scope the six rows to their card.
    const issues = m.getByText(/top issues requiring attention/i).closest('section')!
    for (const label of [
      'AP blocked > 30 days',
      'Overdue AR > 90 days',
      'Unapplied cash',
      'Reconciliation breaks',
      'High-risk manual journals',
      'Overdue queries',
    ]) {
      expect(within(issues).getByText(label)).toBeTruthy()
    }
    expect(m.getByRole('link', { name: /AP blocked > 30 days/ }).getAttribute('href')).toBe('/entity/JGL/p2p')
    expect(m.getByRole('link', { name: /Overdue AR > 90 days/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    // §8.5 — the preclose panel adds a second 'Unapplied cash' link; both drill to working capital.
    for (const l of m.getAllByRole('link', { name: /Unapplied cash/ })) expect(l.getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(m.getByRole('link', { name: /Reconciliation breaks/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(m.getByRole('link', { name: /High-risk manual journals/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(m.getByRole('link', { name: /Overdue queries/ }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices')

    // Root cause insights — first three of the fixed P2P taxonomy.
    expect(m.getByText(/root cause insights/i)).toBeTruthy()
    expect(m.getByRole('link', { name: 'Analyse →' }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(m.getByRole('link', { name: /Missing GR/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/missing-gr')
    expect(m.getByRole('link', { name: /PO price mismatch/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/po-price-mismatch')
    expect(m.getByRole('link', { name: /Approval pending/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/p2p/approval-pending')
    expect(m.getByText('34%')).toBeTruthy()
    expect(m.getByText('22%')).toBeTruthy()
    expect(m.getByText('18%')).toBeTruthy()

    // Recommended actions card.
    expect(m.getByText(/recommended actions/i)).toBeTruthy()
    expect(m.getByText('₹4.2 cr working-capital release available by clearing GR compliance on 11 vendors.')).toBeTruthy()
    expect(m.getByText('38 resolvable today')).toBeTruthy()
    expect(m.getByText('3 systemic')).toBeTruthy()

    // The ask button opens the AI drawer and asks the entity's amber question (spec/07).
    fireEvent.click(m.getByRole('button', { name: 'Ask why this entity is amber' }))
    expect(screen.getByText(/cockpit intelligence/i)).toBeTruthy()
    expect(screen.getByText('Why is this entity showing amber?')).toBeTruthy()
  })

  it('switches cockpit modes from the header demo control and re-foregrounds the top panel (§8.5)', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    const m = main()
    const banner = screen.getByRole('banner')

    // Default is pre-close — the preventive mode worth demonstrating.
    expect(m.getByText('Pre-close readiness')).toBeTruthy()

    fireEvent.click(within(banner).getByRole('button', { name: 'CLOSE' }))
    const closePanel = m.getByText('At close').closest('section')!
    // Close status and blockers cannot drill — tagged read-only per §8.4; exposure drills to the missing-GR worklist filter.
    expect(within(closePanel).getByText('78%')).toBeTruthy()
    expect(within(closePanel).getByText('+4 vs last period')).toBeTruthy()
    const blockers = within(closePanel).getByText('Blockers').parentElement!
    expect(within(blockers).getByText('7')).toBeTruthy()
    expect(m.getAllByText('read-only · source: close tracker')).toHaveLength(2)
    expect(within(closePanel).getByRole('link', { name: /Exposure at close/ }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices?cause=missing-gr')

    fireEvent.click(within(banner).getByRole('button', { name: 'BAU' }))
    const bauPanel = m.getByText('Business as usual').closest('section')!
    for (const [label, value] of [
      ['AP blocked invoices', '327'],
      ['O2C exceptions', '284'],
      ['Cash opportunity', '₹11.3 cr'],
      ['Cause elimination', '3 of 8'], // §7.18 — per-entity backlog, not the group figure
    ] as Array<[string, string]>) {
      const cell = within(bauPanel).getByText(label).parentElement!
      expect(within(cell).getByText(value)).toBeTruthy()
    }
    expect(within(bauPanel).getByText('-62 vs last period')).toBeTruthy()
    expect(within(bauPanel).getByText('-17 vs last period')).toBeTruthy()
    expect(within(bauPanel).getByText('88 items')).toBeTruthy()
    expect(within(bauPanel).getByText('2 in progress · 3 not started')).toBeTruthy() // §7.18 — JGL backlog split; notStarted derived
    expect(within(bauPanel).getByRole('link', { name: /AP blocked invoices/ }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices')
    expect(within(bauPanel).getByRole('link', { name: /O2C exceptions/ }).getAttribute('href')).toBe('/entity/JGL/o2c')
    expect(within(bauPanel).getByRole('link', { name: /Cash opportunity/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(within(bauPanel).getByRole('link', { name: /Cause elimination/ }).getAttribute('href')).toBe('/')

    fireEvent.click(within(banner).getByRole('button', { name: 'PRE-CLOSE' }))
    expect(m.getByText('Pre-close readiness')).toBeTruthy()
  })

  it('drills from the AP blocked tile to the P2P cockpit', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    const m = main()
    fireEvent.click(m.getByRole('link', { name: /327 invoices/ }))
    expect(m.getByRole('heading', { level: 1, name: 'Procure to pay' })).toBeTruthy()
  })

  it('renders JBL with its own score, status and money values', () => {
    window.history.pushState(null, '', '/entity/JBL')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Jubilant Biosys Ltd' })).toBeTruthy()
    expect(m.getByText('67')).toBeTruthy()
    expect(m.getByText('AMBER')).toBeTruthy()

    // §7.15 — JBL fell two points (69 → 67).
    expect(m.getByText('-2 vs last period')).toBeTruthy()
    // ₹11.3 cr appears three times: the tile, the top-issues card and the §8.2 callout link (the strip now renders for all six entities).
    expect(m.getAllByText('₹11.3 cr')).toHaveLength(3)
    expect(m.getByText('61%')).toBeTruthy()
    expect(m.getByText('6 breaches')).toBeTruthy()

    // §8.2 — the consequence strip renders for all six entities with their pinned figures.
    const strip = m.getByText('Financial consequence').closest('section')!
    expect(within(strip).getByText('source: trial balance extract')).toBeTruthy()
    for (const [label, value] of [
      ['Accrual exposure at close', '₹4.1 cr'],
      ['Revenue at risk', '₹6.4 cr'],
      ['Provision adequacy', '88%'],
      ['FX / intercompany exposure', '₹2.4 cr'],
    ] as Array<[string, string]>) {
      const cell = within(strip).getByText(label).parentElement!
      expect(within(cell).getByText(value)).toBeTruthy()
    }
    for (const explanation of ['blocked payables not yet accrued', 'open disputes and credit blocks', 'provision vs actual utilisation', 'unmatched intercompany with related parties']) {
      expect(within(strip).getByText(explanation)).toBeTruthy()
    }
    expect(within(strip).getByText('read-only · source: trial balance extract')).toBeTruthy()
    // Drill targets follow the entity code.
    expect(within(strip).getByRole('link', { name: /Accrual exposure/ }).getAttribute('href')).toBe('/entity/JBL/p2p/invoices?cause=missing-gr')
    expect(within(strip).getByRole('link', { name: /Revenue at risk/ }).getAttribute('href')).toBe('/entity/JBL/o2c#fct-stage-COL')
    expect(within(strip).getByRole('link', { name: /FX \/ intercompany/ }).getAttribute('href')).toBe('/entity/JBL/working-capital#fct-ic-netting')

    // §8.5 — preclose panel (default mode) foregrounds readiness figures with entity data; values repeat, so scope per cell.
    const panel = m.getByText('Pre-close readiness').closest('section')!
    // §7.18 — JBL's unposted GR is its own accrual exposure (₹4.1 cr), not the group figure.
    expect(within(within(panel).getByText('Unposted goods receipts').parentElement!).getByText('₹4.1 cr')).toBeTruthy()
    expect(within(within(panel).getByText('Unposted goods receipts').parentElement!).getByText('8 vendors · 4th consecutive month')).toBeTruthy()
    expect(within(within(panel).getByText('Unapplied cash').parentElement!).getByText('₹2.4 cr')).toBeTruthy()

    // §7.19 — the resolvable-today figures are JBL's own, not JGL's anchored values.
    expect(m.getByText('₹2.6 cr working-capital release available by clearing GR compliance on 8 vendors.')).toBeTruthy()
    expect(m.getByText('25 resolvable today')).toBeTruthy()
  })

  it('falls back for an unknown entity code', () => {
    window.history.pushState(null, '', '/entity/ZZZ')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Unknown entity ZZZ' })).toBeTruthy()
    fireEvent.click(m.getByRole('link', { name: 'Back to group view' }))
    expect(m.getByRole('heading', { level: 1, name: 'Finance health across six legal entities' })).toBeTruthy()
  })

  it('shows "What moves this score" with computed from/to per action and the contractual weights (§3.2, §3.6)', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    const m = main()

    expect(m.getByText(/what moves this score/i)).toBeTruthy()
    // The spec/§3.6 example row: clearing GR compliance lifts JGL from 74 to 81 — computed, not stored.
    expect(m.getByText('Clear GR compliance on 11 consignment vendors')).toBeTruthy()
    expect(m.getByText('74 → 81')).toBeTruthy()
    // Every other row is recomputed independently from the base score.
    expect(m.getByText('Close 18 aged reconciliation breaks')).toBeTruthy()
    expect(m.getByText('74 → 77')).toBeTruthy()
    // No cap binds on JGL, so no banner.
    expect(m.queryByText(/no other action moves this score/)).toBeNull()

    // Weights are contractual and disclosed on demand (§3.2).
    fireEvent.click(m.getByRole('button', { name: 'How this score is built' }))
    expect(m.getAllByText('20%')).toHaveLength(3)
    expect(m.getAllByText('15%')).toHaveLength(2)
    expect(m.getByText('10%')).toBeTruthy()
    expect(m.getByText('raw = Σ(dimension score × weight) · final = min(raw, active veto caps) · displayed = round(final)')).toBeTruthy()
  })

  it('on JRP promotes the cap-clearing action above the banner and threads the cascade in order (§7.10.1)', () => {
    window.history.pushState(null, '', '/entity/JRP')
    render(<App />)
    const m = main()

    // The binding veto badge sits next to the score; JRP carries two active vetoes.
    const badge = m.getByRole('button', { name: 'CAPPED — unauthorised vendor bank change, unresolved' })

    // §7.15 — the five-point fall is shown where the drop appears and explained in place (no click needed).
    expect(m.getByText('-5 vs last period')).toBeTruthy()
    expect(m.getByText('Raw score moved only 60.5 → 57.9: last period\'s binding cap was "GST/HST return overdue" (60); this period a new control failure — "unauthorised vendor bank change, unresolved" (cap 55) — was detected and now binds.')).toBeTruthy()

    // Promoted cap-clearing row precedes the exact banner string in document order.
    const promoted = m.getByText('Resolve the unauthorised vendor bank change')
    expect(m.getByText('55 → 58')).toBeTruthy()
    const banner = m.getByText('While the bank-change cap binds, no other action moves this score')
    expect(banner.compareDocumentPosition(promoted) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()

    // Cascade after the cap lifts: 58 → 64, then 64 → 68 — no zero-gain rows rendered.
    expect(m.getByText('File the overdue GST/HST return')).toBeTruthy()
    expect(m.getByText('58 → 64')).toBeTruthy()
    expect(m.getByText('Clear 26 aged reconciliation breaks')).toBeTruthy()
    expect(m.getByText('64 → 68')).toBeTruthy()
    expect(m.queryByText('55 → 55')).toBeNull()

    // The reveal lists both active vetoes with caps, naming the binding one.
    fireEvent.click(badge)
    expect(m.getByText('raw 57.9')).toBeTruthy()
    expect(m.getByText('GST/HST return overdue — cap 60')).toBeTruthy()
    expect(m.getByText('unauthorised vendor bank change, unresolved — cap 55 · binding')).toBeTruthy()
  })
})
