// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'

function main() {
  return within(screen.getByRole('main'))
}

// The trace strip is the flex div that owns the CROSS-PROCESS TRACE label; querying inside it keeps node
// text from colliding with page copy (e.g. "Blocked invoices worklist").
function traceStrip(m: ReturnType<typeof main>) {
  return within(m.getByText('CROSS-PROCESS TRACE').parentElement as HTMLElement)
}

beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

describe('cross-process trace (§8.10)', () => {
  it('links the goods-receipt point into its register section from a chain screen', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices?cause=missing-gr')
    render(<App />)
    const strip = traceStrip(main())
    expect(strip.getByText('Blocked invoice').className).toContain('fct-trace-current')
    // §17 — the chain's first point now lands on its section of the root-cause register.
    expect(strip.getByRole('link', { name: 'Missing goods receipt · P2P' }).getAttribute('href')).toBe('/root-causes?cause=missing-gr')
  })

  it('follows the chain from the entity page to the blocked invoice worklist', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    fireEvent.click(traceStrip(main()).getByRole('link', { name: 'Blocked invoice' }))
    expect(window.location.pathname).toBe('/entity/JGL/p2p/invoices')
    expect(window.location.search).toBe('?cause=missing-gr')
    const m = main()
    expect(m.getByText('Blocked invoices worklist')).toBeTruthy()
    expect(traceStrip(m).getByText('Blocked invoice').className).toContain('fct-trace-current')
  })

  it('follows the chain from the worklist to the understated accrual on the entity page', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices?cause=missing-gr')
    render(<App />)
    fireEvent.click(traceStrip(main()).getByRole('link', { name: 'Understated accrual · R2R' }))
    expect(window.location.pathname).toBe('/entity/JGL')
    expect(window.location.hash).toBe('#fct-consequence')
    const m = main()
    expect(m.getByText('Financial consequence')).toBeTruthy()
    expect(traceStrip(m).getByText('Understated accrual · R2R').className).toContain('fct-trace-current')
  })

  it('follows the chain from the entity page to the close exposure on the R2R cockpit (§16.7)', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    fireEvent.click(traceStrip(main()).getByRole('link', { name: 'Close exposure' }))
    expect(window.location.pathname).toBe('/entity/JGL/r2r')
    const m = main()
    // The chain resolves on a real screen, not an anchor on the overview.
    expect(m.getByText('Record to report, as one flow')).toBeTruthy()
    expect(traceStrip(m).getByText('Close exposure').className).toContain('fct-trace-current')
  })

  it('keeps the group close card as a fourth point — current there, links out to the other three', () => {
    render(<App />)
    const strip = traceStrip(main())
    expect(strip.getByText('Close exposure').className).toContain('fct-trace-current')
    expect(strip.queryByRole('link', { name: 'Close exposure' })).toBeNull()
    expect(strip.getByRole('link', { name: 'Missing goods receipt · P2P' }).getAttribute('href')).toBe('/root-causes?cause=missing-gr')
  })

  it('does not render the trace on a worklist that is not filtered to the goods-receipt cause', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    expect(main().queryByText('CROSS-PROCESS TRACE')).toBeNull()
  })

  it('does not render the trace on the root cause register', () => {
    window.history.pushState(null, '', '/root-causes')
    render(<App />)
    expect(main().queryByText('CROSS-PROCESS TRACE')).toBeNull()
  })
})
