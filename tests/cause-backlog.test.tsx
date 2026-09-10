// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { causeBacklogCounts, causeEliminationTrend, currentPeriodEliminations, listCauseBacklog, openExceptions, openExceptionsPrevious, requestOwnerPool } from '../src/api'

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

describe('Cause elimination register (spec §7.30, §7.18)', () => {
  it('pins the per-entity tallies: 34 identified / 11 eliminated / 6 in progress / 17 not started', () => {
    const rows = listCauseBacklog()
    expect(rows).toHaveLength(34)
    const byEntity: Record<string, { total: number; eliminated: number; inProgress: number }> = {}
    for (const r of rows) {
      if (!byEntity[r.entityCode]) byEntity[r.entityCode] = { total: 0, eliminated: 0, inProgress: 0 }
      const t = byEntity[r.entityCode]
      t.total += 1
      if (r.status === 'eliminated') t.eliminated += 1
      if (r.status === 'in-progress') t.inProgress += 1
    }
    expect(byEntity).toEqual({
      JGL: { total: 8, eliminated: 3, inProgress: 2 },
      JBL: { total: 7, eliminated: 2, inProgress: 1 },
      JPS: { total: 5, eliminated: 2, inProgress: 1 },
      JCP: { total: 3, eliminated: 2, inProgress: 0 },
      JHS: { total: 4, eliminated: 1, inProgress: 1 },
      JRP: { total: 7, eliminated: 1, inProgress: 1 },
    })
    expect(causeBacklogCounts()).toEqual({ identified: 34, eliminated: 11, inProgress: 6, notStarted: 17 })
  })

  it('every owner is a named person from the owning entity’s §7.17 pool', () => {
    for (const r of listCauseBacklog()) {
      expect(requestOwnerPool(r.entityCode)).toContain(r.owner)
    }
  })

  it('target dates exist only on in-progress rows, inside the next two quarters (§7.21)', () => {
    const now = new Date()
    const p2 = (n: number) => String(n).padStart(2, '0')
    const todayIso = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`
    const max = new Date(now)
    max.setDate(max.getDate() + 182)
    const maxIso = `${max.getFullYear()}-${p2(max.getMonth() + 1)}-${p2(max.getDate())}`
    for (const r of listCauseBacklog()) {
      if (r.status === 'in-progress') {
        expect(r.targetDate).toBeDefined()
        const t = r.targetDate!.slice(0, 10)
        expect(t >= todayIso && t <= maxIso).toBe(true) // ISO dates compare lexicographically
      } else {
        expect(r.targetDate).toBeUndefined()
      }
    }
  })

  it('cumulative eliminations over the six periods are pinned at 3 · 5 · 6 · 8 · 9 · 11', () => {
    expect(causeEliminationTrend().eliminatedSeries).toEqual([3, 5, 6, 8, 9, 11])
  })

  it('the two causes eliminated this period generated 47 exceptions last period and none in this one', () => {
    const p6 = currentPeriodEliminations()
    expect(p6).toEqual({ count: 2, generatedLastPeriod: 47 })
    const rows = listCauseBacklog().filter((r) => r.status === 'eliminated' && r.eliminatedInPeriod === 6)
    expect(rows.map((r) => r.id).sort()).toEqual(['CB-JCP-03', 'CB-JRP-07'])
  })

  it('as eliminations rise, group open exceptions fall across the same six points', () => {
    const trend = causeEliminationTrend()
    expect(trend.openExceptionsSeries).toHaveLength(6)
    for (let i = 0; i < 5; i++) {
      expect(trend.eliminatedSeries[i] < trend.eliminatedSeries[i + 1]).toBe(true)
      expect(trend.openExceptionsSeries[i] > trend.openExceptionsSeries[i + 1]).toBe(true)
    }
    // The last two points are the live group values, not a second stored series.
    expect(trend.openExceptionsSeries[4]).toBe(openExceptionsPrevious())
    expect(trend.openExceptionsSeries[5]).toBe(openExceptions())
  })

  it('the taxonomy join resolves for every row: name and value at risk come from the group nodes', () => {
    for (const r of listCauseBacklog()) {
      expect(r.name.length).toBeGreaterThan(0)
      expect(r.valueAtRisk).toBeGreaterThan(0)
    }
  })
})

describe('Cause elimination screen (spec §7.30)', () => {
  it('route renders with breadcrumb, active nav and the headline counts', () => {
    window.history.pushState(null, '', '/cause-backlog')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'Cause elimination' })).toBeTruthy()
    // Status words repeat in the register below, so resolve each stat label to its numeric sibling.
    const stat = (label: string) => m.getAllByText(label).map((el) => el.nextElementSibling?.textContent ?? null).find((v) => v !== null && /^\d+$/.test(v))
    expect(stat('IDENTIFIED')).toBe('34')
    expect(stat('ELIMINATED')).toBe('11')
    expect(stat('IN PROGRESS')).toBe('6')
    expect(stat('NOT STARTED')).toBe('17')
    expect(breadcrumbText()).toContain('Cause elimination')
    expect(activeNavLabel()).toContain('Cause elimination')
  })

  it('the register lists all thirty-four causes with status, owners and honest target dates', () => {
    window.history.pushState(null, '', '/cause-backlog')
    render(<App />)
    const m = main()
    const section = m.getByText('Register').closest('section') as HTMLElement
    expect(section.querySelectorAll('.fct-table-row')).toHaveLength(34)
    const s = within(section)
    for (const st of ['ELIMINATED', 'IN-PROGRESS', 'IDENTIFIED']) {
      expect(s.getAllByText(st).length).toBeGreaterThan(0)
    }
    const tableRows = Array.from(section.querySelectorAll('.fct-table-row'))
    let inProgress = 0
    for (const r of tableRows) {
      const text = r.textContent ?? ''
      if (text.includes('IN-PROGRESS')) {
        inProgress += 1
        expect(text).toMatch(/\d{1,2} [A-Z][a-z]{2} \d{4}/) // a formatted target date
      } else {
        // Not started or eliminated — no open commitment to show; a blank is more honest than an invented one.
        expect(text).toContain('—')
      }
    }
    expect(inProgress).toBe(6)
  })

  it('links each cause back to its root-cause screen and forward to the exceptions it generates', () => {
    window.history.pushState(null, '', '/cause-backlog')
    render(<App />)
    const m = main()
    const section = m.getByText('Register').closest('section') as HTMLElement
    const backLinks = Array.from(section.querySelectorAll<HTMLAnchorElement>('a[href*="/root-cause/"]'))
    expect(backLinks).toHaveLength(34)
    for (const a of backLinks) {
      expect(a.getAttribute('href')).toMatch(/^\/entity\/(JGL|JBL|JPS|JCP|JHS|JRP)\/root-cause\/(p2p|o2c|r2r)\/[a-z0-9-]+$/)
    }
    const fwdLinks = Array.from(section.querySelectorAll<HTMLAnchorElement>('a[href*="?cause="]'))
    expect(fwdLinks).toHaveLength(20) // P2P rows only — the dataset carries no O2C exception list
    for (const a of fwdLinks) {
      expect(a.getAttribute('href')).toMatch(/^\/entity\/(JGL|JBL|JPS|JCP|JHS|JRP)\/p2p\/invoices\?cause=[a-z0-9-]+$/)
    }
  })

  it('shows the mechanism: six points where eliminations rise as open exceptions fall, with the overclaim guard', () => {
    window.history.pushState(null, '', '/cause-backlog')
    render(<App />)
    const m = main()
    const section = m.getByText('The mechanism').closest('section') as HTMLElement
    const elim = Array.from(section.querySelectorAll('[data-series="eliminated"]')).map((el) => el.textContent ?? '')
    expect(elim).toEqual(['3', '5', '6', '8', '9', '11'])
    const open = Array.from(section.querySelectorAll('[data-series="open-exceptions"]')).map((el) => el.textContent ?? '')
    expect(open).toEqual(['2,158', '2,117', '2,069', '2,034', '2,012', '1,980'])
    // The guard says which of the two claims the screen is making.
    const s = within(section)
    expect(s.getByText(/it does not clear the existing pool/)).toBeTruthy()
    expect(s.getByText(/generated 47 exceptions last period and none in this one/)).toBeTruthy()
  })

  it('is registered in the command palette and navigates on Enter', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "cause elimination" matches only the screen item — no entity, vendor or cause carries that phrase.
    fireEvent.change(input, { target: { value: 'cause elimination' } })
    const rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Cause elimination')
    expect(rows[0].textContent).toMatch(/\d+ of \d+ causes eliminated/)

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/cause-backlog')
  })
})
