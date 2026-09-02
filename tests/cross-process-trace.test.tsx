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
  it('marks the goods-receipt point current on its root cause screen and links out to the other three', () => {
    window.history.pushState(null, '', '/entity/JGL/root-cause/p2p/missing-gr')
    render(<App />)
    const strip = traceStrip(main())
    expect(strip.getByText('Missing goods receipt · P2P').className).toContain('fct-trace-current')
    expect(strip.queryByRole('link', { name: 'Missing goods receipt · P2P' })).toBeNull()
    expect(strip.getByRole('link', { name: 'Blocked invoice' }).getAttribute('href')).toBe('/entity/JGL/p2p/invoices?cause=missing-gr')
    expect(strip.getByRole('link', { name: 'Understated accrual · R2R' }).getAttribute('href')).toBe('/entity/JGL#fct-consequence')
    expect(strip.getByRole('link', { name: 'Close exposure' }).getAttribute('href')).toBe('/#fct-close-card')
  })

  it('follows the chain from missing GR to the blocked invoice worklist', () => {
    window.history.pushState(null, '', '/entity/JGL/root-cause/p2p/missing-gr')
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

  it('follows the chain from the entity page to the close exposure card on the group view', () => {
    window.history.pushState(null, '', '/entity/JGL')
    render(<App />)
    fireEvent.click(traceStrip(main()).getByRole('link', { name: 'Close exposure' }))
    expect(window.location.pathname).toBe('/')
    expect(window.location.hash).toBe('#fct-close-card')
    expect(document.getElementById('fct-close-card')).not.toBeNull()
    expect(traceStrip(main()).getByText('Close exposure').className).toContain('fct-trace-current')
  })

  it('does not render the trace on a worklist that is not filtered to the goods-receipt cause', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/invoices')
    render(<App />)
    expect(main().queryByText('CROSS-PROCESS TRACE')).toBeNull()
  })

  it('does not render the trace on a root cause screen for any other cause', () => {
    window.history.pushState(null, '', '/entity/JGL/root-cause/p2p/approval-pending')
    render(<App />)
    expect(main().queryByText('CROSS-PROCESS TRACE')).toBeNull()
  })
})
