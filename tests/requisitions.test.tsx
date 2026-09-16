// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { agentPreventsLine, coverageStrip, getAgent, listEntities, listRequisitions, listStages, prCauses, requisitionAgents, requisitionPipeline } from '../src/api'
import { buildItems } from '../src/components/CommandPalette'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/')
})

afterEach(cleanup)

function main() {
  return within(screen.getByRole('main'))
}

describe('requisition pipeline dataset (§18.1)', () => {
  it('the pipeline ties to the §7.4 stage counts and values for every entity', () => {
    for (const e of listEntities()) {
      const stages = listStages('p2p', e.code)
      const pr = stages.find((s) => s.step === 'PR')!
      const po = stages.find((s) => s.step === 'PO')!
      const p = requisitionPipeline(e.code)!
      expect(p.prsInFlight).toBe(pr.inFlight)
      expect(p.converted).toBe(po.inFlight)
      expect(p.unconverted).toBe(pr.inFlight - po.inFlight)
      expect(p.unconvertedValueCr).toBe(Math.round((pr.inFlightValue - po.inFlightValue) * 10) / 10)
    }
  })

  it('JGL pins the §18.1 pipeline: 412 in flight, 386 converted, 26 unconverted', () => {
    expect(requisitionPipeline('JGL')).toEqual({ prsInFlight: 412, converted: 386, unconverted: 26, unconvertedValueCr: 3.7 })
  })

  it('row counts equal the unconverted pool and row values tie to the stage value difference for every entity', () => {
    for (const e of listEntities()) {
      const rows = listRequisitions(e.code)
      const p = requisitionPipeline(e.code)!
      expect(rows).toHaveLength(p.unconverted)
      // Integer hundredths — no float drift.
      const sumHundredths = rows.reduce((s, r) => s + Math.round(r.valueCr * 100), 0)
      expect(sumHundredths).toBe(Math.round(p.unconvertedValueCr * 100))
    }
  })

  it('every row carries a §18.1 cause, an age of at least two days, an owner and a chase state', () => {
    const keys = new Set(prCauses().map((c) => c.key))
    for (const e of listEntities()) {
      for (const r of listRequisitions(e.code)) {
        expect(keys.has(r.causeKey)).toBe(true)
        expect(r.ageDays).toBeGreaterThanOrEqual(2)
        expect(r.owner.length).toBeGreaterThan(0)
        expect(['waiting', 'chased', 'escalated']).toContain(r.chaseState)
      }
    }
  })

  it('JGL shows all six causes — the pool is large enough to cover the set', () => {
    const rows = listRequisitions('JGL')
    expect(new Set(rows.map((r) => r.causeKey)).size).toBe(6)
  })
})

describe('the five requisition agents (§18.2)', () => {
  it('roster order, four preventive and one reactive, all designed', () => {
    const req = requisitionAgents()
    expect(req.map((a) => a.id)).toEqual(['budget-exposure', 'contract-catalogue-routing', 'pr-completeness', 'duplicate-pr', 'pr-ageing-chase'])
    expect(req.filter((a) => a.type === 'preventive')).toHaveLength(4)
    expect(req.find((a) => a.type === 'reactive')?.id).toBe('pr-ageing-chase')
    for (const a of req) {
      expect(a.status).toBe('designed')
      expect(a.process).toBe('p2p')
    }
  })

  it('the preventive agents tag the downstream cause they remove, joined from the taxonomy', () => {
    expect(agentPreventsLine(getAgent('contract-catalogue-routing')!)).toBe('PO price mismatch · 22% of blocked AP')
    expect(agentPreventsLine(getAgent('duplicate-pr')!)).toBe('Duplicate suspicion · 8% of blocked AP')
    for (const id of ['budget-exposure', 'pr-completeness', 'pr-ageing-chase']) {
      expect(agentPreventsLine(getAgent(id)!)).toBeUndefined()
    }
  })

  it('the coverage strip places all five on the PR stage, in roster order after buying compliance', () => {
    const pr = coverageStrip().p2p.find((s) => s.code === 'PR')!
    expect(pr.agents).toEqual(['buying-compliance', 'budget-exposure', 'contract-catalogue-routing', 'pr-completeness', 'duplicate-pr', 'pr-ageing-chase'])
  })

  it('⌘K finds the screen with its unconverted pool, from the entity context', () => {
    const items = buildItems('JGL')
    const reqItem = items.find((i) => i.kind === 'SCREEN' && i.label === 'Requisitions')
    expect(reqItem).toBeTruthy()
    expect(reqItem!.meta).toBe('26 unconverted PRs')
    expect(reqItem!.to).toBe('/entity/JGL/requisitions')
  })
})

describe('Requisitions screen (§18)', () => {
  it('renders the pipeline, the six causes, all rows and the five agents for JGL', () => {
    window.history.pushState(null, '', '/entity/JGL/requisitions')
    render(<App />)
    const m = main()

    expect(m.getByRole('heading', { level: 1, name: 'Requisitions' })).toBeTruthy()
    expect(m.getByText(/level 3 — process · requisitions/i)).toBeTruthy()
    // §2/§9.1 — the breadcrumb carries the screen; the rail keeps P2P cockpit active (drill-only, no rail entry).
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')!
    expect(bc.textContent).toContain('Requisitions')
    expect(document.querySelector('.fct-nav-item--active')?.textContent).toContain('P2P cockpit')

    // §18.1 — the pinned pipeline; unconverted value ties to PR − PO stage values.
    const pipe = document.querySelector('[data-fct-pipeline]') as HTMLElement
    expect(pipe.getAttribute('data-prs')).toBe('412')
    expect(pipe.getAttribute('data-converted')).toBe('386')
    expect(pipe.getAttribute('data-unconverted')).toBe('26')
    expect(m.getByText('₹3.7 cr not yet committed')).toBeTruthy()

    // The budget panel names its source — the Spend Control Tower's verdict, read not performed.
    const budget = document.querySelector('[data-fct-budget-panel]') as HTMLElement
    expect(budget.textContent).toContain('Spend Control Tower')

    // §18.1 — all six causes named with their verbatim details (names render uppercased in the mono label).
    for (const c of prCauses()) {
      const el = document.querySelector(`[data-fct-pr-cause="${c.key}"]`) as HTMLElement
      expect(el.textContent).toContain(c.name.toUpperCase())
      expect(el.textContent).toContain(c.detail)
    }

    // All 26 rows, oldest first.
    const table = document.querySelector('[data-fct-requisitions]') as HTMLElement
    const rowEls = Array.from(table.querySelectorAll('.fct-table-row'))
    expect(rowEls).toHaveLength(26)
    const ages = rowEls.map((el) => Number(/(\d+) d/.exec(el.textContent ?? '')![1]))
    for (let i = 1; i < ages.length; i++) expect(ages[i]).toBeLessThanOrEqual(ages[i - 1])

    // Footer: the pool value and the chase-state split, both from the dataset.
    const rows = listRequisitions('JGL')
    expect(table.textContent).toContain(`${rows.filter((r) => r.chaseState === 'chased').length} chased · ${rows.filter((r) => r.chaseState === 'escalated').length} escalated`)

    // §18.2 — the five agents in roster order, with their prevents lines and record drills.
    const agentEls = Array.from(document.querySelectorAll('[data-fct-req-agent]')) as HTMLElement[]
    expect(agentEls.map((el) => el.getAttribute('data-fct-req-agent'))).toEqual(['budget-exposure', 'contract-catalogue-routing', 'pr-completeness', 'duplicate-pr', 'pr-ageing-chase'])
    const a24 = agentEls[1]
    expect(a24.textContent).toContain('PO price mismatch · 22% of blocked AP')
    expect(a24.querySelector('a[href="/agents/contract-catalogue-routing"]')).toBeTruthy()
    const a26 = agentEls[3]
    expect(a26.textContent).toContain('Duplicate suspicion · 8% of blocked AP')
  })

  it('the P2P cockpit PR stage drills to the pipeline', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p')
    render(<App />)
    const m = main()
    expect(m.getByRole('link', { name: /Requisition/ }).getAttribute('href')).toBe('/entity/JGL/requisitions')
  })
})
