// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { computeScore, getEntity, getServiceMetrics, HEALTH_SCORE_DEFINITION, serviceDeskWindow, serviceScorecard, SERVICE_SCORECARD_DEFINITION, slaBreachSplit } from '../src/api'

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

// The path a user takes: group view → JGL → rail item.
function openServicePage() {
  render(<App />)
  fireEvent.click(main().getByRole('link', { name: /Jubilant Generics Ltd/ }))
  const rail = screen.getByRole('navigation', { name: 'Primary' })
  fireEvent.click(within(rail).getByRole('link', { name: /Service & attribution/ }))
}

describe('Service & attribution (spec §4, §5, §7.7, §7.22)', () => {
  it('route renders with its breadcrumb and active nav state', () => {
    openServicePage()
    expect(main().getByRole('heading', { level: 1, name: 'Where the delays come from' })).toBeTruthy()
    const bc = breadcrumbText()
    expect(bc).toContain('JGL')
    expect(bc).toContain('Service & attribution')
    expect(activeNavLabel()).toContain('Service & attribution')
  })

  it("stacked bar renders this entity's split with the group beneath as comparison (§5, §7.22)", () => {
    openServicePage()
    const split = slaBreachSplit('JGL')
    const group = slaBreachSplit()
    const m = main()

    // Render-only merge: four stored counts collapse to three visible segments.
    expect(screen.getByRole('main').querySelectorAll('.fct-sla-seg')).toHaveLength(3)

    const mergedCount = split.counts.system + split.counts.thirdParty
    expect(m.getByTitle(`client: ${split.counts.client} of ${split.total}`)).toBeTruthy()
    expect(m.getByTitle(`provider: ${split.counts.provider} of ${split.total}`)).toBeTruthy()
    expect(m.getByTitle(`system & third party: ${mergedCount} of ${split.total}`)).toBeTruthy()

    // The legend labels every segment with its count and rounded share.
    const pct = (n: number) => Math.round((n / split.total) * 100)
    expect(m.getByText(`${split.counts.client} · ${pct(split.counts.client)}%`)).toBeTruthy()
    expect(m.getByText(`${split.counts.provider} · ${pct(split.counts.provider)}%`)).toBeTruthy()
    expect(m.getByText(`${mergedCount} · ${pct(mergedCount)}%`)).toBeTruthy()
    expect(m.getByText('system & third party')).toBeTruthy()

    // Entity scope, tagged read-only (§8.4).
    expect(m.getByText(`JGL · ${split.total} breaches`)).toBeTruthy()
    expect(m.getByText('read-only · source: SLA breach log')).toBeTruthy()

    // The group split sits beneath as comparison — "which entities are worse than the group".
    const expected = `JGL ${split.pct.client} / ${split.pct.provider} / ${split.pct.system} / ${split.pct.thirdParty} · group ${group.pct.client} / ${group.pct.provider} / ${group.pct.system} / ${group.pct.thirdParty}`
    expect(expected).toBe('JGL 72 / 19 / 6 / 3 · group 71 / 18 / 7 / 4')
    expect(m.getByText(expected)).toBeTruthy()
  })

  it('shows health score and service scorecard as two separate objects, never merged (§4)', () => {
    openServicePage()
    const m = main()
    const score = computeScore(getEntity('JGL')!)

    // Health score drills to the entity home where the full panel lives.
    const health = m.getByRole('link', { name: /Health score/i })
    expect(health.getAttribute('href')).toBe('/entity/JGL')
    expect(within(health).getByText(String(score.displayed))).toBeTruthy()
    expect(within(health).getByText('/100')).toBeTruthy()
    expect(within(health).getByText(HEALTH_SCORE_DEFINITION)).toBeTruthy()

    // The scorecard is not a link and carries its own definition.
    expect(m.queryByRole('link', { name: /Service scorecard/i })).toBeNull()
    const sc = serviceScorecard('JGL')
    const card = m.getByText('Service scorecard').closest('section') as HTMLElement
    const c = within(card)

    // Gross and net side by side, unambiguously labelled — never net alone (§4/§7.22).
    expect(c.getByText(`${sc.gross.toFixed(1)}%`)).toBeTruthy()
    expect(c.getByText(`${sc.net.toFixed(1)}%`)).toBeTruthy()
    expect(c.getByText('Gross achievement')).toBeTruthy()
    expect(c.getByText('Net of client, system and third-party delay')).toBeTruthy()

    expect(c.getByText(SERVICE_SCORECARD_DEFINITION)).toBeTruthy()

    // The exclusion set is named exactly and sized: for JGL the two readings differ by 0.6 points.
    expect(sc).toEqual({ gross: 95.2, net: 98.6, altNet: 98 })
    expect(c.getByText('The exclusion set is a contract term — whether an interface failure stops the clock depends on who operates the interface; for JGL the two readings differ by 0.6 points.')).toBeTruthy()

    expect(c.getByText('Service credits attach here')).toBeTruthy()
  })

  it('SLA table renders day-one rows with values, measuring rows live to-date, needs-register greyed (§7.7/§7.29)', () => {
    openServicePage()
    const section = main().getByText('Service level agreements').closest('section') as HTMLElement
    const s = within(section)

    // Ten SLAs: five measurable on day one, three measuring via the desk, two needs-register.
    expect(section.querySelectorAll('.fct-table-row')).toHaveLength(10)

    for (const row of getServiceMetrics('JGL')) {
      if (row.measurability === 'day-one') {
        expect(s.getByText(`${row.achieved!.toFixed(1)}%`)).toBeTruthy()
      } else {
        // The name is still present — only the values are withheld or pending.
        expect(s.getByText(row.sla)).toBeTruthy()
      }
    }

    // Attribution split renders only the non-zero origins.
    expect(s.getByText('client 18 · provider 3 · system 1')).toBeTruthy()
    expect(s.getByText('system 1')).toBeTruthy()

    // §7.29 — each measuring row carries the exact transition wording, derived from today (§7.21).
    const w = serviceDeskWindow()
    const sinceLine = `measuring since ${w.measuringSince} · first full-period report from ${w.nextPeriod}`
    expect(s.getAllByText(sinceLine)).toHaveLength(3)

    // Measuring rows show live to-date figures, not an achievement %: 3 rows × (achieved + breaches + split).
    const pending = Array.from(section.querySelectorAll('.fct-sla-pending'))
    expect(pending).toHaveLength(9)
    for (const cell of pending) {
      expect(cell.textContent?.trim()).toBe('—')
      expect(cell.getAttribute('title') ?? '').toMatch(/No achievement % until a full period has elapsed|Not yet reported — measuring since/)
    }

    // The honesty feature: every needs-register value cell is a dash with an explanation, no number. 2 rows × 3 cells.
    const unmeasured = Array.from(section.querySelectorAll('.fct-sla-unmeasured'))
    expect(unmeasured).toHaveLength(6)
    for (const cell of unmeasured) {
      expect(cell.textContent?.trim()).toBe('—')
      expect(cell.getAttribute('title') ?? '').toMatch(/^Not measurable yet/)
    }

    // Each needs-register row carries the reason on its name too: 2 rows × (name + 3 value cells).
    expect(section.querySelectorAll('[title^="Not measurable yet"]')).toHaveLength(8)
  })

  it('per-entity data: JRP shows its own split, comparison line and scorecard (§7.22)', () => {
    window.history.pushState(null, '', '/entity/JRP/service')
    render(<App />)
    const m = main()
    const split = slaBreachSplit('JRP')

    // JRP's own breach counts — not JGL's and not the group's.
    expect(screen.getByRole('main').querySelectorAll('.fct-sla-seg')).toHaveLength(3)
    const mergedCount = split.counts.system + split.counts.thirdParty
    expect(m.getByTitle(`client: ${split.counts.client} of ${split.total}`)).toBeTruthy()
    expect(m.getByTitle(`provider: ${split.counts.provider} of ${split.total}`)).toBeTruthy()
    expect(m.getByTitle(`system & third party: ${mergedCount} of ${split.total}`)).toBeTruthy()
    expect(m.getByText(`JRP · ${split.total} breaches`)).toBeTruthy()

    // Comparison line names JRP against the group.
    const expected = `JRP ${split.pct.client} / ${split.pct.provider} / ${split.pct.system} / ${split.pct.thirdParty} · group 71 / 18 / 7 / 4`
    expect(expected).toBe('JRP 69 / 17 / 10 / 4 · group 71 / 18 / 7 / 4')
    expect(m.getByText(expected)).toBeTruthy()

    // JRP's own gross/net — the weakest entity in the group.
    const sc = serviceScorecard('JRP')
    const card = m.getByText('Service scorecard').closest('section') as HTMLElement
    const c = within(card)
    expect(c.getByText(`${sc.gross.toFixed(1)}%`)).toBeTruthy()
    expect(c.getByText(`${sc.net.toFixed(1)}%`)).toBeTruthy()
    expect(sc).toEqual({ gross: 92.4, net: 97.9, altNet: 95.8 })
    // JRP's delta is the widest in the group — its interface failures count against it under the narrower reading.
    expect(c.getByText('The exclusion set is a contract term — whether an interface failure stops the clock depends on who operates the interface; for JRP the two readings differ by 2.1 points.')).toBeTruthy()
  })

  it('suppresses the exclusion-set note where the two readings agree — JPS, JCP, JHS have no system-attributed delay (§4)', () => {
    for (const code of ['JPS', 'JCP', 'JHS']) {
      window.history.pushState(null, '', `/entity/${code}/service`)
      render(<App />)
      const m = main()

      // The note is gone — a difference of zero is not a caveat.
      expect(m.queryByText(/The exclusion set is a contract term/)).toBeNull()

      // Gross and net still render side by side; only the delta sentence is withheld.
      expect(m.getByText('Gross achievement')).toBeTruthy()
      expect(m.getByText('Net of client, system and third-party delay')).toBeTruthy()

      cleanup()
    }
  })

  it('unknown entity code falls back to a link back to the group view', () => {
    window.history.pushState(null, '', '/entity/ZZZ/service')
    render(<App />)
    expect(main().getByRole('heading', { level: 1, name: 'Unknown entity ZZZ' })).toBeTruthy()
    expect(main().getByRole('link', { name: /Back to group view/ })).toBeTruthy()
  })

  it('is registered in the command palette and navigates on Enter', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "attribution" matches only the screen item — vendor names contain "services".
    fireEvent.change(input, { target: { value: 'attribution' } })
    const rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Service & attribution')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/entity/JGL/service')
  })
})
