// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset to "/" before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

function main() {
  return within(screen.getByRole('main'))
}

function breadcrumbText(): string {
  return screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent ?? ''
}

function activeNavLabel(): string | null {
  return document.querySelector('.fct-nav-item--active')?.textContent ?? null
}

describe('App shell end to end (spec/02)', () => {
  it('drills group → entity → P2P → worklist → exception; breadcrumb and nav follow', () => {
    render(<App />)

    expect(main().getByRole('heading', { level: 1, name: 'Finance health across six legal entities' })).toBeTruthy()
    expect(activeNavLabel()).toContain('Group view')

    fireEvent.click(main().getByRole('link', { name: /Jubilant Generics Ltd/ }))
    expect(main().getByRole('heading', { level: 1, name: 'Jubilant Generics Ltd' })).toBeTruthy()
    const bc = breadcrumbText()
    expect(bc).toContain('Group')
    expect(bc).toContain('JGL')
    expect(activeNavLabel()).toContain('Entity health')

    fireEvent.click(main().getByRole('link', { name: /327 invoices/ }))
    expect(main().getByRole('heading', { level: 1, name: 'Procure to pay' })).toBeTruthy()
    expect(breadcrumbText()).toContain('P2P')
    expect(activeNavLabel()).toContain('P2P cockpit')

    fireEvent.click(main().getByRole('link', { name: /Open 327 blocked invoices/ }))
    const rows = main().getAllByRole('link').filter((l) => (l.textContent ?? '').startsWith('AP-'))
    // §15.7 — the worklist opens on the needs-you view; the agents have already resolved six of JGL's twelve.
    expect(rows).toHaveLength(6)
    expect(activeNavLabel()).toContain('Worklist')

    fireEvent.click(rows[0])
    expect(main().getByRole('heading', { level: 1, name: 'Suraksha Chemicals Pvt Ltd' })).toBeTruthy()
    const detailBc = breadcrumbText()
    expect(detailBc).toContain('Invoices')
    expect(detailBc).toContain('AP-104281')
    // Worklist stays active while an exception detail page is open (spec/02).
    expect(activeNavLabel()).toContain('Worklist')

    fireEvent.click(main().getByRole('link', { name: /Back to worklist/ }))
    // Back on the needs-you view — still six rows, not the full twelve.
    expect(main().getAllByRole('link').filter((l) => (l.textContent ?? '').startsWith('AP-'))).toHaveLength(6)
  })

  it('rail keeps the current entity in context when drilling to root cause', () => {
    render(<App />)
    fireEvent.click(main().getByRole('link', { name: /Jubilant Biosys Ltd/ }))
    expect(activeNavLabel()).toContain('Entity health')

    const rail = screen.getByRole('navigation', { name: 'Primary' })
    fireEvent.click(within(rail).getByRole('link', { name: /Root cause/ }))
    expect(main().getByRole('heading', { level: 1, name: 'Why blocked invoices keep recurring' })).toBeTruthy()
    const bc = breadcrumbText()
    expect(bc).toContain('JBL')
    expect(bc).toContain('P2P')
    expect(bc).toContain('Root cause')
    expect(activeNavLabel()).toContain('Root cause')
  })

  it('working capital route renders with its breadcrumb and nav state', () => {
    render(<App />)
    fireEvent.click(main().getByRole('link', { name: /Jubilant HollisterStier LLC/ }))

    const rail = screen.getByRole('navigation', { name: 'Primary' })
    fireEvent.click(within(rail).getByRole('link', { name: /Working capital/ }))
    expect(main().getByRole('heading', { level: 1, name: 'Cash locked in exceptions' })).toBeTruthy()
    const bc = breadcrumbText()
    expect(bc).toContain('JHS')
    expect(bc).toContain('Working capital')
    expect(activeNavLabel()).toContain('Working capital')
  })

  it('top bar shows the default entity and the AI drawer toggles', () => {
    render(<App />)
    const header = screen.getByRole('banner')
    expect(header.textContent).toContain('JGL')

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /Ask the cockpit/ }))
    expect(screen.getByText(/cockpit intelligence/i)).toBeTruthy()

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /Ask the cockpit/ }))
    expect(screen.queryByText(/cockpit intelligence/i)).toBeNull()
  })

  it('switches cockpit modes from the header demo control and rewrites the period text (§8.5)', () => {
    render(<App />)
    const banner = screen.getByRole('banner')

    // Default is pre-close — the preventive mode worth demonstrating; labelled as a demo control.
    expect(within(banner).getByText('DEMO MODE')).toBeTruthy()
    expect(within(banner).getByText('PERIOD AUG-2026 · PRE-CLOSE READINESS · 3 DAYS TO CLOSE')).toBeTruthy()

    fireEvent.click(within(banner).getByRole('button', { name: 'CLOSE' }))
    expect(within(banner).getByText('PERIOD AUG-2026 · DAY 4 OF CLOSE')).toBeTruthy()

    fireEvent.click(within(banner).getByRole('button', { name: 'BAU' }))
    expect(within(banner).getByText('PERIOD AUG-2026 · BUSINESS AS USUAL · DAY 12')).toBeTruthy()

    fireEvent.click(within(banner).getByRole('button', { name: 'PRE-CLOSE' }))
    expect(within(banner).getByText('PERIOD AUG-2026 · PRE-CLOSE READINESS · 3 DAYS TO CLOSE')).toBeTruthy()
  })
})
