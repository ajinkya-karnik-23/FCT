// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { closeCalendar, getEntity, listStages } from '../src/api'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

function main() {
  return within(screen.getByRole('main'))
}

describe('Close calendar (§16.3)', () => {
  it('renders the pinned KPIs, the blocked-first attention slice and sign-off status for JGL', () => {
    window.history.pushState(null, '', '/entity/JGL/close-calendar')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Close calendar' })).toBeTruthy()
    expect(m.getByText(/level 2 — process · record to report/i)).toBeTruthy()
    // §16.8 — the calendar is in-platform: it cites itself as its own source, like the group view's card.
    // The full stamp string keeps this off the h1, which also reads "Close calendar".
    expect(m.getByText('Close calendar · as of 06:00 IST')).toBeTruthy()

    const cal = closeCalendar('JGL')!
    const entity = getEntity('JGL')!
    // KPI figures are scoped to the KPI row — the table's Due column also renders 'Day 6' leaves.
    const kpis = within(document.querySelector('[data-fct-close-kpis]') as HTMLElement)
    expect(kpis.getByText(`${entity.metrics.closePercent.current}%`)).toBeTruthy() // ties to the R2R cockpit figure
    // JGL is on schedule: COMMITTED and PREDICTED both read Day 6 — exactly two KPI leaves.
    expect(kpis.getAllByText(`Day ${cal.committedDay}`)).toHaveLength(2)
    expect(kpis.getByText(String(cal.openCount))).toBeTruthy()
    expect(kpis.getByText(String(cal.blockerCount))).toBeTruthy()

    // The attention slice: ten named rows, blocked first with the earliest due day leading (JGL-C04, Day 4).
    const rows = document.querySelectorAll('[data-fct-close-calendar] .fct-table-row')
    expect(rows).toHaveLength(10)
    expect((rows[0] as HTMLElement).textContent).toContain('Bank reconciliations — current accounts')
    expect((rows[0] as HTMLElement).textContent).toContain('BLOCKED')
    // Open rows sort after every blocked row; the last is JGL-C12 (Day 6, critical path).
    expect((rows[9] as HTMLElement).textContent).toContain('Revenue cut-off review')
    expect((rows[9] as HTMLElement).textContent).toContain('OPEN')

    // §16.3 — sign-off is status only, read from the reconciliation platform; no dates are invented.
    const sgn = listStages('r2r', 'JGL').find((s) => s.step === 'SGN')!
    expect(m.getByText(`SGN sign-off · ${sgn.inFlight} in flight · ${sgn.inException} outstanding`)).toBeTruthy()
    expect(document.querySelector('[data-fct-close-signoff]')?.textContent).toContain('read from the reconciliation platform')

    // Footer: blocked count and critical-path count derive from the named slice.
    const footer = document.querySelector('[data-fct-close-calendar]')!.textContent ?? ''
    expect(footer).toContain(`${cal.blockerCount} blocked · 6 on the critical path`)
  })

  it('shows the slip in red terms when the prediction outruns the commitment (JBL)', () => {
    window.history.pushState(null, '', '/entity/JBL/close-calendar')
    render(<App />)
    const m = main()
    const cal = closeCalendar('JBL')!

    expect(m.getByRole('heading', { level: 1, name: 'Close calendar' })).toBeTruthy()
    // The slip sits in a blocked critical-path chain — the prediction (Day 8) outruns the commitment (Day 6).
    const kpis = within(document.querySelector('[data-fct-close-kpis]') as HTMLElement)
    expect(kpis.getByText(`Day ${cal.predictedDay}`)).toBeTruthy()
    expect(m.getByText(/slips 2 days past committed/i)).toBeTruthy()
  })

  it('shows the worst slip in red terms against the committed day (JRP)', () => {
    window.history.pushState(null, '', '/entity/JRP/close-calendar')
    render(<App />)
    const m = main()
    const cal = closeCalendar('JRP')!

    expect(m.getByRole('heading', { level: 1, name: 'Close calendar' })).toBeTruthy()
    // JRP is the worst in the group (§16.3): predicted Day 9 against committed Day 6.
    const kpis = within(document.querySelector('[data-fct-close-kpis]') as HTMLElement)
    expect(kpis.getByText(`Day ${cal.committedDay}`)).toBeTruthy()
    expect(kpis.getByText(`Day ${cal.predictedDay}`)).toBeTruthy()
    expect(m.getByText(/slips 3 days past committed/i)).toBeTruthy()

    // The slip sits in the blocked accrual → trial balance → reporting pack chain; the footer derives from the named slice.
    const rows = document.querySelectorAll('[data-fct-close-calendar] .fct-table-row')
    expect(rows).toHaveLength(13)
    const footer = document.querySelector('[data-fct-close-calendar]')!.textContent ?? ''
    expect(footer).toContain(`${cal.blockerCount} blocked · 8 on the critical path`)
    expect(footer).toContain('5 escalations sent · 4 timers running')
  })

  it('sits in the rail directly after R2R cockpit, with its badge and active state', () => {
    render(<App />) // starts at '/' (group view)

    const rail = screen.getByRole('navigation', { name: 'Primary' })
    const items = within(rail).getAllByRole('link')
    const r2rIndex = items.findIndex((l) => (l.textContent ?? '').includes('R2R cockpit'))
    expect(r2rIndex).toBeGreaterThan(-1)
    const cc = items[r2rIndex + 1]
    expect(cc.textContent).toContain('Close calendar')
    // The rail badge is the blocked count, like its siblings' exception counts.
    expect(cc.textContent).toContain(String(closeCalendar('JGL')!.blockerCount))

    fireEvent.click(cc)
    expect(window.location.pathname).toBe('/entity/JGL/close-calendar')
    expect(main().getByRole('heading', { level: 1, name: 'Close calendar' })).toBeTruthy()

    const bc = screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent ?? ''
    for (const crumb of ['Group', 'JGL', 'Close calendar']) {
      expect(bc).toContain(crumb)
    }
    expect(document.querySelector('.fct-nav-item--active')?.textContent).toContain('Close calendar')
  })

  it('is reachable from the command palette', () => {
    render(<App />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByPlaceholderText(/jump to an entity/i)
    fireEvent.change(input, { target: { value: 'close calendar' } })

    const cal = closeCalendar('JGL')!
    const rows = within(dialog).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Close calendar')
    expect(rows[0].textContent).toContain(`${cal.openCount} open · ${cal.blockerCount} blocked`)

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/entity/JGL/close-calendar')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('wires the task table drills and agent lane (B.a–B.d)', () => {
    window.history.pushState(null, '', '/entity/JGL/close-calendar')
    render(<App />)
    const rowByName = (name: string) =>
      Array.from(document.querySelectorAll('[data-fct-close-calendar] .fct-table-row')).find((r) => r.textContent?.includes(name)) as HTMLElement | undefined
    const linksIn = (row: HTMLElement, text: string) => Array.from(row.querySelectorAll('a')).find((a) => a.textContent === text)

    // B.b — the task name drills to the R2R panel holding the exceptions behind it; cut-off has no such panel.
    const icRow = rowByName('Intercompany matching — JBL pair')!
    expect(linksIn(icRow, 'Intercompany matching — JBL pair')?.getAttribute('href')).toBe('/entity/JGL/r2r#fct-panel-intercompany')
    // B.a — a blocker owned by another entity's close team drills to that entity's calendar.
    expect(linksIn(icRow, 'JBL sub-ledger close')?.getAttribute('href')).toBe('/entity/JBL/close-calendar')

    // B.a — an intra-entity dependency anchors to the blocking row in this table (the dependency graph made navigable).
    const tbRow = rowByName('Trial balance review — GL accounts')!
    expect(linksIn(tbRow, 'Adjusting entries from accrual review')?.getAttribute('href')).toBe('/entity/JGL/close-calendar#fct-row-JGL-C05')
    expect(document.getElementById('fct-row-JGL-C05')?.textContent).toContain('Accrual schedule — review & sign-off')

    // A.c + B.b/B.a — the external blocker is plain text (no page), and a no-panel task name is not a link either.
    const bankRow = rowByName('Bank reconciliations — current accounts')!
    expect(linksIn(bankRow, 'Statement batch from bank portal')).toBeUndefined() // external dependency — honest dash
    const cutOffRow = rowByName('Revenue cut-off review')!
    expect(linksIn(cutOffRow, 'Revenue cut-off review')).toBeUndefined() // no §16.5 panel for cut-off

    // B.d — the agent lane renders per state; trial balance and reporting pack carry none (no R2R agent covers them).
    const resolvedRow = rowByName('Bank reconciliations — fixed deposits')!
    expect(resolvedRow.textContent).toContain('agent resolved · cleared 2 breaks in the last cycle')
    for (const noAgent of ['Trial balance review — GL accounts', 'Reporting pack — consolidation inputs']) {
      const r = rowByName(noAgent)!
      // The Agent cell is the only column that reads a bare "—" here; assert the lane text is absent.
      expect(r.textContent).not.toContain('working ·')
      expect(r.textContent).not.toContain('escalated —')
    }

    // B.c — expanding a sent-escalation row reveals its record: what was sent, to whom, answered or not.
    const expander = bankRow.querySelector('.fct-expand') as HTMLElement
    fireEvent.click(expander)
    expect(bankRow.textContent).toContain('Chased the statement batch with group treasury')
    expect(bankRow.textContent).toContain('to Entity controller, awaiting reply')
  })
})
