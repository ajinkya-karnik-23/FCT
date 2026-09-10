// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { deflection, getServiceMetrics, listEntities, listRequests, requestAgeDays, requestSlaStatus, requestTypeForSla, serviceDeskWindow, slaBreachSplit } from '../src/api'

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

const DESK_SLAS = ['Vendor master creation', 'Query resolution', 'Dispute resolution']

describe('Request dataset (spec §6, §7.21, §7.29)', () => {
  it('seeds 8-12 requests per entity; volume tracks exception volume (§7.29)', () => {
    const counts: Record<string, number> = {}
    for (const e of listEntities()) counts[e.code] = listRequests(e.code).length
    expect(counts).toEqual({ JGL: 10, JBL: 11, JPS: 9, JCP: 8, JHS: 8, JRP: 12 })
    for (const n of Object.values(counts)) {
      expect(n).toBeGreaterThanOrEqual(8)
      expect(n).toBeLessThanOrEqual(12)
    }
    expect(listRequests()).toHaveLength(58)
  })

  it('every entity carries all six request types and all four statuses', () => {
    for (const e of listEntities()) {
      const rows = listRequests(e.code)
      expect(new Set(rows.map((r) => r.type)).size).toBe(6)
      expect(new Set(rows.map((r) => r.status)).size).toBe(4)
    }
  })

  it('stop-clock hours accrue only while awaiting the client (§5 attribution applied to requests)', () => {
    for (const r of listRequests()) {
      if (r.status === 'awaiting-client') expect(r.clockStoppedHours).toBeGreaterThan(0)
      else expect(r.clockStoppedHours).toBe(0)
    }
  })

  it('raisedOn derives from today (§7.21): no future dates, ages inside the seeded window', () => {
    const now = new Date()
    const p2 = (n: number) => String(n).padStart(2, '0')
    const todayIso = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`
    for (const r of listRequests()) {
      expect(r.raisedOn.slice(0, 10) <= todayIso).toBe(true) // ISO dates compare lexicographically
      const age = requestAgeDays(r)
      expect(age).toBeGreaterThanOrEqual(1)
      expect(age).toBeLessThanOrEqual(37)
    }
  })

  it('deflection: routed equals the request count and the rate is derived, never stored', () => {
    const expectedSelf = { JGL: 7, JBL: 4, JPS: 7, JCP: 5, JHS: 4, JRP: 7 }
    for (const e of listEntities()) {
      const d = deflection(e.code)
      expect(d.selfServed).toBe(expectedSelf[e.code])
      expect(d.routed).toBe(listRequests(e.code).length)
    }
    expect(deflection()).toEqual({ selfServed: 34, routed: 58, ratePct: 37 })
  })

  it('measuring window: the desk went live five days into the period; first report next month', () => {
    const now = new Date()
    const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5)
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const PERIOD_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const m = now.getMonth() + 1
    expect(serviceDeskWindow()).toEqual({
      measuringSince: `${String(since.getDate()).padStart(2, '0')} ${MONTHS[since.getMonth()]} ${since.getFullYear()}`,
      nextPeriod: `${PERIOD_MONTHS[m % 12]}-${now.getFullYear() + Math.floor(m / 12)}`,
    })
  })

  it('the three desk SLAs map to their request types, and every entity has seeded rows for each', () => {
    expect(requestTypeForSla('Vendor master creation')).toBe('masterData')
    expect(requestTypeForSla('Query resolution')).toBe('query')
    expect(requestTypeForSla('Dispute resolution')).toBe('dispute')
    expect(requestTypeForSla('Audit findings')).toBeUndefined() // a needs-register SLA has no intake behind it
    for (const e of listEntities()) {
      for (const t of ['masterData', 'query', 'dispute'] as const) {
        expect(listRequests(e.code, t).length).toBeGreaterThan(0)
      }
    }
  })

  it('requestSlaStatus follows the closed/open rule; no-TAT types carry undefined', () => {
    for (const r of listRequests()) {
      if (r.type === 'fixedAsset' || r.type === 'priceChange' || r.type === 'urgentPayment') {
        expect(requestSlaStatus(r)).toBeUndefined()
      } else if (r.status === 'closed') {
        expect(['met', 'breached']).toContain(requestSlaStatus(r))
      } else {
        expect(['on track', 'breached']).toContain(requestSlaStatus(r))
      }
    }
  })

  it('the desk SLAs left the greyed state without moving §7.11: no achieved %, no breach counts, totals pinned', () => {
    for (const e of listEntities()) {
      const rows = getServiceMetrics(e.code)
      expect(rows.filter((r) => r.measurability === 'measuring').map((r) => r.sla).sort()).toEqual([...DESK_SLAS].sort())
      for (const r of rows.filter((r) => r.measurability === 'measuring')) {
        expect(r.achieved).toBeUndefined()
        expect(r.breaches).toBeUndefined()
      }
      // The two needs-register SLAs stay greyed — a service desk does not give you audit findings or a QC sample.
      expect(rows.filter((r) => r.measurability === 'needs-register').map((r) => r.sla).sort()).toEqual(['Audit findings', 'Invoice processing accuracy'].sort())
    }
    const totals: Record<string, number> = {}
    for (const e of listEntities()) totals[e.code] = slaBreachSplit(e.code).total
    expect(totals).toEqual({ JGL: 32, JBL: 41, JPS: 12, JCP: 3, JHS: 6, JRP: 48 })
    const group = slaBreachSplit()
    expect(group.total).toBe(142)
    expect(group.pct).toEqual({ client: 71, provider: 18, system: 7, thirdParty: 4 })
  })
})

describe('Finance Service Desk screen (spec §7.29)', () => {
  it('route renders with breadcrumb, active nav and the honesty line', () => {
    window.history.pushState(null, '', '/service-desk')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'Finance Service Desk' })).toBeTruthy() // §9.1 — full name, not the abbreviation
    const w = serviceDeskWindow()
    expect(m.getByText(`measuring since ${w.measuringSince} · first full-period report from ${w.nextPeriod}`)).toBeTruthy()
    expect(breadcrumbText()).toContain('Finance Service Desk') // §9.1 — case-sensitive: the abbreviation is gone
    expect(activeNavLabel()).toContain('Finance Service Desk')
  })

  it('queue lists all seeded requests with live to-date stats', () => {
    window.history.pushState(null, '', '/service-desk')
    render(<App />)
    const m = main()
    const section = m.getByText('Queue').closest('section') as HTMLElement
    expect(section.querySelectorAll('.fct-table-row')).toHaveLength(58)
    const s = within(section)
    expect(s.getByText('58 requests · 45 open')).toBeTruthy()
    for (const t of ['Query', 'Dispute', 'Master data', 'Fixed asset', 'Price change', 'Urgent payment']) {
      expect(s.getAllByText(t).length).toBeGreaterThan(0)
    }
    for (const st of ['OPEN', 'IN-PROGRESS', 'AWAITING-CLIENT', 'CLOSED']) {
      expect(s.getAllByText(st).length).toBeGreaterThan(0)
    }
    const stat = (label: string) => m.getByText(label).nextElementSibling?.textContent ?? null
    expect(stat('OPEN REQUESTS')).toBe('45')
    expect(stat('OLDEST EFFECTIVE AGE')).toBe('25 d')
    expect(stat('STOP-CLOCK HOURS')).toBe('416')
    expect(stat('SELF-SERVE SHARE')).toBe('37%')
  })

  it('new-request form writes to local state only — a submitted row enters the queue as open', () => {
    window.history.pushState(null, '', '/service-desk')
    render(<App />)
    const m = main()
    const form = m.getByRole('button', { name: 'Add to queue' }).closest('form') as HTMLFormElement
    const selects = Array.from(form.querySelectorAll('select'))
    fireEvent.change(selects[0], { target: { value: 'JRP' } })
    fireEvent.change(selects[1], { target: { value: 'dispute' } })
    const raisedBy = Array.from(form.querySelectorAll('input')).find((i) => i.placeholder === 'Client role, e.g. Plant stores') as HTMLInputElement
    fireEvent.change(raisedBy, { target: { value: 'QA probe' } })
    // jsdom does not submit forms on button click — dispatch the submit event directly.
    fireEvent.submit(form)

    const section = m.getByText('Queue').closest('section') as HTMLElement
    expect(section.querySelectorAll('.fct-table-row')).toHaveLength(59)
    expect(within(section).getByText('59 requests · 46 open')).toBeTruthy()
    const newRow = Array.from(section.querySelectorAll('.fct-table-row')).find((r) => (r.textContent ?? '').includes('QA probe'))
    // Step 14 carry-over — a fresh intake gets the entity's first §7.17 pool member, not an anonymous owner.
    for (const t of ['JRP', 'Dispute', 'C. Tremblay', 'OPEN']) {
      expect(newRow?.textContent).toContain(t)
    }
  })

  it('deflection counter renders six entities plus the group total', () => {
    window.history.pushState(null, '', '/service-desk')
    render(<App />)
    const m = main()
    const section = m.getByText('Deflection').closest('section') as HTMLElement
    expect(section.querySelectorAll('.fct-table-row')).toHaveLength(7)
    const groupRow = Array.from(section.querySelectorAll('.fct-table-row')).find((r) => (r.textContent ?? '').startsWith('GROUP'))
    expect(groupRow?.textContent).toContain('37%')
  })

  it('is registered in the command palette and navigates on Enter', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "service desk" matches only the screen item — no entity, vendor or cause carries that phrase.
    fireEvent.change(input, { target: { value: 'service desk' } })
    const rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Finance Service Desk') // §9.1 — the palette carries the full name too
    expect(rows[0].textContent).toMatch(/\d+ open requests/)

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/service-desk')
  })
})
