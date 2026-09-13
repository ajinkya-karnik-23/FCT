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

describe('R2R cockpit (§16.2)', () => {
  it('renders the header KPIs and eight stage cards drilling to the R2R taxonomy', () => {
    window.history.pushState(null, '', '/entity/JGL/r2r')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Record to report, as one flow' })).toBeTruthy()
    expect(m.getByText(/level 2 — process · record to report/i)).toBeTruthy()
    // §16.8 — the breaks come from the reconciliation platform, not SAP alone; the recon panel tags its source too.
    expect(m.getAllByText(/reconciliation platform/i)).toHaveLength(2)

    // Header KPIs: JGL close % and open breaks (the latter ties to the rail count). Scoped to the header —
    // the recon panel's overdue-breaks stat carries the same figure below it.
    const kpis = within(document.getElementById('fct-r2r-header-kpis'))
    expect(kpis.getByText('78%')).toBeTruthy()
    expect(kpis.getByText('18')).toBeTruthy()

    // §8.1 — the stage cards are open work in progress, not period volumes.
    expect(m.getByText('In flight at each stage')).toBeTruthy()
    expect(m.getByText('Open work in progress, not period volumes')).toBeTruthy()

    // The eight stage cards drill to the taxonomy's largest node (the recon panel adds its own overdue-breaks link below).
    const toReconciliation = m.getAllByRole('link').filter((l) => l.classList.contains('fct-stage-card') && l.getAttribute('href') === '/entity/JGL/root-cause/r2r/reconciliation')
    expect(toReconciliation).toHaveLength(8)
    for (const name of ['Sub-ledger close', 'Accruals & provisions', 'Reconciliations', 'Intercompany', 'Adjusting journals', 'Trial balance', 'Reporting pack', 'Sign-off']) {
      expect(toReconciliation.some((l) => (l.textContent ?? '').includes(name))).toBe(true)
    }

    // Stage card contents, read from the Sub-ledger close card — Reporting pack rounds to the same 15%,
    // so a page-wide match would find two cards.
    const subCard = m.getByRole('link', { name: /Sub-ledger close/ })
    expect(within(subCard).getByText('96')).toBeTruthy()
    expect(within(subCard).getByText('15% exception')).toBeTruthy()

    // §8.2 — the drill anchor id follows the step code.
    expect(m.getByRole('link', { name: /Sub-ledger close/ }).id).toBe('fct-stage-SUB')
  })

  it('renders in all three cockpit modes — pre-close readiness, close and BAU are views of one screen (§16.7)', () => {
    window.history.pushState(null, '', '/entity/JGL/r2r')
    render(<App />)
    const m = main()
    const banner = screen.getByRole('banner')

    // The full cockpit: header KPIs, the integrity index and all four panels.
    const assertCockpit = () => {
      expect(m.getByRole('heading', { level: 1, name: 'Record to report, as one flow' })).toBeTruthy()
      expect(within(document.getElementById('fct-r2r-header-kpis')).getByText('78%')).toBeTruthy()
      for (const id of ['fct-integrity', 'fct-panel-recon', 'fct-panel-journal-risk', 'fct-panel-intercompany', 'fct-panel-accruals']) {
        expect(document.getElementById(id)).not.toBeNull()
      }
    }

    // Default is pre-close; the other two modes drop nothing — the screen owns the calendar, it does not read one.
    assertCockpit()
    fireEvent.click(within(banner).getByRole('button', { name: 'CLOSE' }))
    assertCockpit()
    fireEvent.click(within(banner).getByRole('button', { name: 'BAU' }))
    assertCockpit()
  })

  it('renders the balance sheet integrity index with its six weighted components (§16.4)', () => {
    window.history.pushState(null, '', '/entity/JGL/r2r')
    render(<App />)
    const card = within(document.getElementById('fct-integrity'))

    // JGL's pinned index 72 sits in the AMBER band; the tag carries the band word.
    expect(card.getByText('72')).toBeTruthy()
    expect(card.getByText('/100')).toBeTruthy()
    expect(card.getByText('AMBER')).toBeTruthy()

    for (const [label, value] of [
      ['Reconciliation', '68'],
      ['Intercompany', '70'],
      ['GR/IR exposure', '62'],
      ['Unapplied cash', '74'],
      ['Provision adequacy', '92'],
      ['Cut-off integrity', '78'],
    ] as const) {
      expect(card.getByText(label)).toBeTruthy()
      expect(card.getByText(value)).toBeTruthy()
    }
    // Weights 25/20/20/15/10/10 — the repeated values must each appear exactly twice.
    expect(card.getAllByText('25%')).toHaveLength(1)
    expect(card.getAllByText('20%')).toHaveLength(2)
    expect(card.getAllByText('15%')).toHaveLength(1)
    expect(card.getAllByText('10%')).toHaveLength(2)
  })

  it('renders the reconciliation panel from its platform source (§16.5)', () => {
    window.history.pushState(null, '', '/entity/JGL/r2r')
    render(<App />)
    const p = within(document.getElementById('fct-panel-recon'))

    expect(p.getByText('source: reconciliation platform')).toBeTruthy()
    expect(p.getByText('Accounts reconciled')).toBeTruthy()
    expect(p.getByText('214')).toBeTruthy()
    expect(p.getByText('Certified')).toBeTruthy()
    expect(p.getByText('186')).toBeTruthy()
    const overdue = p.getByRole('link', { name: '18' })
    expect(overdue.getAttribute('href')).toBe('/entity/JGL/root-cause/r2r/reconciliation')
    expect(p.getByText('oldest 61 d · ₹14.3 cr')).toBeTruthy()
    expect(p.getByText('11 of 18 with evidence attached')).toBeTruthy()
  })

  it('renders the journal risk panel: population, high-risk count and all seven flags (§16.5)', () => {
    window.history.pushState(null, '', '/entity/JGL/r2r')
    render(<App />)
    const j = within(document.getElementById('fct-panel-journal-risk'))

    expect(j.getByText('source: SAP journal extract')).toBeTruthy()
    expect(j.getByText('Journals')).toBeTruthy()
    expect(j.getByText('847')).toBeTruthy()
    const highRisk = j.getByRole('link', { name: '12' })
    expect(highRisk.getAttribute('href')).toBe('/entity/JGL/root-cause/r2r/journal')
    for (const flag of ['Top-side entry', 'Round number', 'Backdated', 'Above materiality', 'Preparer equals approver', 'Outside business hours', 'Sensitive account']) {
      expect(j.getByText(flag)).toBeTruthy()
    }
    // JGL carries the change-doc extract, so no flag degrades — but the dependency is still stated.
    expect(j.queryByText('not scored')).toBeNull()
    expect(j.getByText(/CDHDR\/CDPOS/)).toBeTruthy()
  })

  it('renders the intercompany panel: netting total, counterparty rows and the related-party tag (§16.5)', () => {
    window.history.pushState(null, '', '/entity/JGL/r2r')
    render(<App />)
    const ic = within(document.getElementById('fct-panel-intercompany'))

    expect(ic.getByText('read-only · source: trial balance extract')).toBeTruthy()
    const total = ic.getByRole('link', { name: '₹3.6 cr' })
    expect(total.getAttribute('href')).toBe('/entity/JGL/working-capital#fct-ic-netting')
    // Ingrevia is a related party, not a group entity — tagged as such on its row.
    expect(ic.getByText('Ingrevia')).toBeTruthy()
    expect(ic.getByText('related party')).toBeTruthy()
    expect(ic.getAllByText('₹2.4 cr')).toHaveLength(2) // unmatched and netting coincide for Ingrevia
    expect(ic.getByText('38 d')).toBeTruthy()
    expect(ic.getByText('Jubilant Pharma Ltd')).toBeTruthy()
    expect(ic.getByText('Jubilant Biosys Ltd')).toBeTruthy()
  })

  it('renders the accruals & provisions panel: exposure, adequacy and the auto-reversal gap (§16.5)', () => {
    window.history.pushState(null, '', '/entity/JGL/r2r')
    render(<App />)
    const a = within(document.getElementById('fct-panel-accruals'))

    expect(a.getByText('read-only · source: trial balance extract')).toBeTruthy()
    const exposure = a.getByRole('link', { name: '₹6.4 cr' })
    expect(exposure.getAttribute('href')).toBe('/entity/JGL/p2p/invoices?cause=missing-gr')
    expect(a.getByText('34% of blocked AP — no goods receipt means no accrual')).toBeTruthy()
    expect(a.getByText('92%')).toBeTruthy()
    expect(a.getByText('Prior-period accruals reversed')).toBeTruthy()
    expect(a.getByText('₹6.1 cr of ₹8.9 cr')).toBeTruthy()
    expect(a.getByText('Not auto-reversed')).toBeTruthy()
    expect(a.getByText('₹2.8 cr')).toBeTruthy()
  })

  it('is reachable from the rail, directly after O2C cockpit, with its badge and active state', () => {
    render(<App />) // starts at '/' (group view)

    const rail = screen.getByRole('navigation', { name: 'Primary' })
    const items = within(rail).getAllByRole('link')
    const o2cIndex = items.findIndex((l) => (l.textContent ?? '').includes('O2C cockpit'))
    expect(o2cIndex).toBeGreaterThan(-1)
    const r2r = items[o2cIndex + 1]
    expect(r2r.textContent).toContain('R2R cockpit')
    expect(r2r.textContent).toContain('18')

    fireEvent.click(r2r)
    expect(window.location.pathname).toBe('/entity/JGL/r2r')
    expect(main().getByRole('heading', { level: 1, name: 'Record to report, as one flow' })).toBeTruthy()

    const bc = screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent ?? ''
    for (const crumb of ['Group', 'JGL', 'R2R']) {
      expect(bc).toContain(crumb)
    }
    expect(document.querySelector('.fct-nav-item--active')?.textContent).toContain('R2R cockpit')
  })

  it('is reachable from the command palette', () => {
    render(<App />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByPlaceholderText(/jump to an entity/i)
    fireEvent.change(input, { target: { value: 'r2r cockpit' } })

    const rows = within(dialog).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('R2R cockpit')
    expect(rows[0].textContent).toContain('18 open breaks')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/entity/JGL/r2r')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
