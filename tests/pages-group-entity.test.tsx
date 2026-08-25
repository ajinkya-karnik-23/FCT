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
  ['Jubilant Ingrevia Ltd', 'JIL'],
  ['Jubilant Biosys Ltd', 'JBS'],
  ['Jubilant Pharma Pte (SG)', 'JPS'],
  ['Jubilant Cadista LLC', 'JCL'],
  ['Jubilant Life Sciences NV', 'JLS'],
]

describe('Group view (spec/04)', () => {
  it('shows the group KPIs and one row per legal entity, each linking to its health home', () => {
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'Finance health across six legal entities' })).toBeTruthy()

    // Header KPIs from the group summary.
    expect(m.getByText('76.5')).toBeTruthy()
    expect(m.getByText('₹92.4 cr')).toBeTruthy()
    expect(m.getByText('1,486')).toBeTruthy()

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

    const jbs = m.getByRole('link', { name: /Jubilant Biosys Ltd/ })
    expect(jbs.textContent).toContain('67')
    expect(jbs.textContent).toContain('RED')
  })

  it('renders the three group cards with their data', () => {
    render(<App />)
    const m = main()

    // Group-wide recurring causes — label (process), bar, share.
    expect(m.getByText(/group-wide recurring causes/i)).toBeTruthy()
    expect(m.getByText('Missing GR (P2P)')).toBeTruthy()
    expect(m.getByText('Pricing disputes (O2C)')).toBeTruthy()
    expect(m.getByText('Interface breaks (R2R)')).toBeTruthy()
    expect(m.getByText('Approval delays (P2P)')).toBeTruthy()
    expect(m.getByText('26%')).toBeTruthy()

    // Close progress — day 4.
    expect(m.getByText(/close progress/i)).toBeTruthy()
    expect(m.getByText('71%')).toBeTruthy()
    expect(m.getByText('of 214 tasks complete')).toBeTruthy()
    expect(m.getByText('19 overdue')).toBeTruthy()
    expect(m.getByText('6 blockers')).toBeTruthy()
    expect(m.getByText('3 entities at risk')).toBeTruthy()

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
})

describe('Entity health home (spec/04)', () => {
  it('renders JGL with score chip, dimension meters and the six tiles', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Jubilant Generics Ltd' })).toBeTruthy()
    expect(m.getByText('/100')).toBeTruthy()
    expect(m.getByText('AMBER')).toBeTruthy()

    // Dimension meter labels ('Close' also names a tile, so it appears twice).
    for (const label of ['Control', 'Wk capital', 'Process', 'Service']) {
      expect(m.getByText(label)).toBeTruthy()
    }
    expect(m.getAllByText('Close')).toHaveLength(2)

    // Tile values — money figures repeat in the top-issues card, so expect two.
    expect(m.getAllByText('₹3.1 cr')).toHaveLength(2)
    expect(m.getAllByText('₹18.6 cr')).toHaveLength(2)
    expect(m.getAllByText('₹12.4 cr')).toHaveLength(2)
    expect(m.getByText('78%')).toBeTruthy()
    expect(m.getByText('₹14.3 cr')).toBeTruthy()
    expect(m.getByText('4 breaches')).toBeTruthy()

    // Every tile is a link to its spec/04 target.
    expect(m.getByRole('link', { name: /Cash unapplied/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(m.getByRole('link', { name: /327 invoices/ }).getAttribute('href')).toBe('/entity/JGL/p2p')
    expect(m.getByRole('link', { name: /41 customers/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(m.getByRole('link', { name: /7 blockers/ }).getAttribute('href')).toBe('/entity/JGL')
    expect(m.getByRole('link', { name: /18 aged breaks/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/missing-gr')
    expect(m.getByRole('link', { name: /12 high-risk JEs/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/missing-gr')
  })

  it('lists the six top issues and three root-cause insights with their drill targets', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    const m = main()

    expect(m.getByText(/top issues requiring attention/i)).toBeTruthy()
    expect(m.getByRole('link', { name: 'Open worklist →' }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices')

    for (const label of [
      'AP blocked > 30 days',
      'Overdue AR > 90 days',
      'Unapplied cash',
      'Reconciliation breaks',
      'High-risk manual journals',
      'Overdue queries',
    ]) {
      expect(m.getByText(label)).toBeTruthy()
    }
    expect(m.getByRole('link', { name: /AP blocked > 30 days/ }).getAttribute('href')).toBe('/entity/JGL/p2p')
    expect(m.getByRole('link', { name: /Overdue AR > 90 days/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(m.getByRole('link', { name: /Unapplied cash/ }).getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(m.getByRole('link', { name: /Reconciliation breaks/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/missing-gr')
    expect(m.getByRole('link', { name: /High-risk manual journals/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/missing-gr')
    expect(m.getByRole('link', { name: /Overdue queries/ }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices')

    // Root cause insights — first three of the fixed P2P taxonomy.
    expect(m.getByText(/root cause insights/i)).toBeTruthy()
    expect(m.getByRole('link', { name: 'Analyse →' }).getAttribute('href')).toBe('/entity/JGL/root-cause/missing-gr')
    expect(m.getByRole('link', { name: /Missing GR/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/missing-gr')
    expect(m.getByRole('link', { name: /PO price mismatch/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/po-price-mismatch')
    expect(m.getByRole('link', { name: /Approval pending/ }).getAttribute('href')).toBe('/entity/JGL/root-cause/approval-pending')
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

  it('drills from the AP blocked tile to the P2P cockpit', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    const m = main()
    fireEvent.click(m.getByRole('link', { name: /327 invoices/ }))
    expect(m.getByRole('heading', { level: 1, name: 'End-to-end flow, not seven separate reports' })).toBeTruthy()
  })

  it('renders JBS with its own score, status and money values', () => {
    window.history.pushState(null, '', '/entity/JBS')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Jubilant Biosys Ltd' })).toBeTruthy()
    expect(m.getByText('67')).toBeTruthy()
    expect(m.getByText('RED')).toBeTruthy()
    expect(m.getAllByText('₹11.3 cr')).toHaveLength(2)
    expect(m.getByText('61%')).toBeTruthy()
    expect(m.getByText('6 breaches')).toBeTruthy()
  })

  it('falls back for an unknown entity code', () => {
    window.history.pushState(null, '', '/entity/ZZZ')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Unknown entity ZZZ' })).toBeTruthy()
    fireEvent.click(m.getByRole('link', { name: 'Back to group view' }))
    expect(m.getByRole('heading', { level: 1, name: 'Finance health across six legal entities' })).toBeTruthy()
  })
})
