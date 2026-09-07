// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { getTouchLeverStages, listCauses, listEntities, listTouchFunnel } from '../src/api'

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

describe('Touch economics dataset (§15.3/§15.4)', () => {
  it('the funnel covers all six entities, one row each', () => {
    const rows = listTouchFunnel()
    expect(rows).toHaveLength(6)
    expect([...rows.map((r) => r.code)].sort()).toEqual(listEntities().map((e) => e.code).sort())
  })

  it('agent-resolved + human = manual for every entity', () => {
    for (const r of listTouchFunnel()) {
      expect(r.agentResolvedPct + r.humanPct).toBeCloseTo(r.manualPct, 2)
    }
  })

  it('touches per thousand are the manual share × 10 today and the human share × 10 after', () => {
    for (const r of listTouchFunnel()) {
      expect(r.touchesTodayPer1000).toBe(Math.round(r.manualPct * 10))
      expect(r.touchesAfterPer1000).toBe(Math.round(r.humanPct * 10))
    }
  })

  it('touchless + manual = 100 for every entity', () => {
    for (const r of listTouchFunnel()) {
      expect(r.touchlessPct + r.manualPct).toBeCloseTo(100, 2)
    }
  })

  it('JGL reads 54 / 46 / 32.2 / 13.8 and 460 touches per thousand falling to 138', () => {
    const jgl = listTouchFunnel().find((r) => r.code === 'JGL')!
    expect([jgl.touchlessPct, jgl.manualPct, jgl.agentResolvedPct, jgl.humanPct]).toEqual([54, 46, 32.2, 13.8])
    expect(jgl.touchesTodayPer1000).toBe(460)
    expect(jgl.touchesAfterPer1000).toBe(138)
  })

  it('the two levers are JGL’s three pinned stages; no other entity carries lever-stage figures', () => {
    const stages = getTouchLeverStages('JGL')!
    expect(stages.map((s) => [s.touchlessPct, s.touchesPer1000])).toEqual([
      [54, 460],
      [62, 380],
      [89, 114],
    ])
    for (const code of ['JCP', 'JHS', 'JPS', 'JBL', 'JRP']) {
      expect(getTouchLeverStages(code)).toBeUndefined()
    }
  })

  it('the per-cause resolvable shares reconcile to JGL’s agent-resolved total', () => {
    const causes = listCauses('p2p')
    for (const c of causes) expect(c.agentResolvablePct).toBeDefined()
    const jgl = listTouchFunnel().find((r) => r.code === 'JGL')!
    const weighted = causes.reduce((s, c) => s + (c.sharePct / 100) * ((c.agentResolvablePct ?? 0) / 100), 0)
    expect(weighted * jgl.manualPct).toBeCloseTo(jgl.agentResolvedPct, 1)
  })
})

describe('Touch economics screen (§15.3/§15.4)', () => {
  it('route renders with breadcrumb, active nav and the §15.1 label', () => {
    window.history.pushState(null, '', '/touch-economics')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'Touch economics' })).toBeTruthy()
    // The eyebrow sits above the h1; read it via DOM order.
    expect(m.getByRole('heading', { level: 1 }).previousElementSibling?.textContent).toBe('Agents')
    // §15.1 — every agent surface carries the honesty label.
    expect(m.getByText('Simulated data')).toBeTruthy()
    expect(breadcrumbText()).toContain('Touch economics')
    expect(activeNavLabel()).toContain('Touch economics')
  })

  it('headlines the touch rate, not an automation percentage', () => {
    window.history.pushState(null, '', '/touch-economics')
    render(<App />)
    const m = main()
    const summary = m.getByText('Touch rate').closest('section') as HTMLElement
    const statValue = (label: string) => within(summary).getAllByText(label).map((el) => el.nextElementSibling?.textContent ?? null).find((v) => v !== null)
    expect(statValue('TOUCHES PER 1,000 INVOICES')).toBe('460 → 138')
    expect(statValue('MANUAL SHARE OF INVOICES')).toBe('46% → 13.8%')
  })

  it('renders the per-entity funnel; every row states its four shares and its touch rate', () => {
    window.history.pushState(null, '', '/touch-economics')
    render(<App />)
    const m = main()
    const section = m.getByText('The funnel — per entity').closest('section') as HTMLElement
    const rows = Array.from(section.querySelectorAll('.fct-table-row'))
    expect(rows).toHaveLength(6)
    for (const r of listTouchFunnel()) {
      const row = rows.find((el) => el.textContent?.includes(`${r.touchesTodayPer1000} → ${r.touchesAfterPer1000}`))!
      expect(row).toBeTruthy()
      // Clay's DataTable wraps the cells in an inner grid, so the cells are one level down.
      expect(Array.from(row.firstElementChild!.children).map((c) => c.textContent?.trim()).slice(1)).toEqual([
        `${r.touchlessPct}%`,
        `${r.manualPct}%`,
        `${r.agentResolvedPct}%`,
        `${r.humanPct}%`,
        `${r.touchesTodayPer1000} → ${r.touchesAfterPer1000}`,
      ])
    }
  })

  it('shows the two levers separately — three stages, each leading with touches per thousand', () => {
    window.history.pushState(null, '', '/touch-economics')
    render(<App />)
    const m = main()
    const section = m.getByText('The two levers — JGL').closest('section') as HTMLElement
    const stage = (slug: string) => (section.querySelector(`[data-fct-lever-stage="${slug}"]`) as HTMLElement).textContent ?? ''
    expect(stage('today')).toContain('460')
    expect(stage('today')).toContain('54% touchless')
    expect(stage('after-cause-elimination')).toContain('380')
    expect(stage('after-cause-elimination')).toContain('62% touchless')
    expect(stage('effective-agents')).toContain('114')
    expect(stage('effective-agents')).toContain('89% touchless')
    const levers = Array.from(section.querySelectorAll('[data-fct-lever]')).map((l) => l.getAttribute('data-fct-lever'))
    expect(levers).toEqual(['fewer exceptions arising', 'agents on the residue'])
  })

  it('labels the two end states apart — agents alone vs causes eliminated first (§15.3)', () => {
    window.history.pushState(null, '', '/touch-economics')
    render(<App />)
    const m = main()
    // The headline and the funnel both show agents on today's volume; only JGL carries that caption on the summary.
    const summary = m.getByText('Touch rate').closest('section') as HTMLElement
    expect(within(summary).getByText('JGL · agents alone, on today’s exception volume')).toBeTruthy()
    const funnel = m.getByText('The funnel — per entity').closest('section') as HTMLElement
    expect(within(funnel).getByText('agents alone, on today’s exception volume')).toBeTruthy()
    // The final lever stage is the other end state: causes eliminated first, then agents on the smaller residue.
    const levers = m.getByText('The two levers — JGL').closest('section') as HTMLElement
    const stage = levers.querySelector('[data-fct-lever-stage="effective-agents"]') as HTMLElement
    expect(stage.textContent).toContain('causes eliminated first, then agents on the residue')
  })

  it('lists JGL’s cause mix — every p2p cause with its share and resolvable share', () => {
    window.history.pushState(null, '', '/touch-economics')
    render(<App />)
    const m = main()
    const section = m.getByText('What agents can resolve — by cause').closest('section') as HTMLElement
    const rows = Array.from(section.querySelectorAll('.fct-table-row'))
    expect(rows).toHaveLength(6)
    for (const c of listCauses('p2p')) {
      const row = rows.find((el) => el.textContent?.includes(c.name))!
      expect(row).toBeTruthy()
      expect(row!.textContent).toContain(`${c.sharePct}%`)
      expect(row!.textContent).toContain(`${c.agentResolvablePct}%`)
    }
  })

  it('is registered in the command palette and navigates when picked', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "touch" may match other rows; pick the screen row by its meta — JGL’s touch rate from the dataset.
    fireEvent.change(input, { target: { value: 'touch' } })
    const rows = within(p).getAllByRole('button')
    const teRows = rows.filter((r) => /JGL \d+ → \d+ \/ 1,000/.test(r.textContent ?? ''))
    expect(teRows).toHaveLength(1)
    expect(teRows[0].textContent).toContain('Touch economics')

    fireEvent.click(teRows[0])
    expect(window.location.pathname).toBe('/touch-economics')
  })
})
