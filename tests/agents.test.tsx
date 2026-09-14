// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { agentActions, agentRates, agentReversibility, agentWorkforceSummary, creditBlockDecisionFor, coverageStrip, exceptionWalkthrough, getAgent, getCounterparty, getException, getPurchaseOrder, listAgents, listExceptions, listRequests, listTouchFunnel, poActionLog, requestOwnerPool } from '../src/api'

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

// §15.2 — the Built column pins which ten roles are live in this prototype (Step 27 adds cut-off surveillance).
const LIVE_IDS = ['follow-up', 'master-data', 'commitments', 'approval-routing', 'match-resolution', 'duplicate-adjudication', 'provisioning', 'credit-release', 'cash-application', 'cut-off-surveillance']

// §15.2.1 / §16.6 — eight of twenty-two are preventive; the table (not the prose) is authoritative where they disagree.
const PREVENTIVE_IDS = ['commitments', 'buying-compliance', 'receipt-discipline', 'contract-price-sync', 'credit-watch', 'billing-readiness', 'collections-outreach', 'cut-off-surveillance']

// §15.2 — advisory only: flag and nudge, change nothing.
const ADVISORY_IDS = ['buying-compliance', 'receipt-discipline', 'credit-watch', 'billing-readiness', 'cut-off-surveillance']

describe('Agent workforce dataset (§15.2)', () => {
  it('pins twenty-two roles — ten live, twelve designed — with unique roster numbers 1–22', () => {
    const agents = listAgents()
    expect(agents).toHaveLength(22)
    expect(agents.map((a) => a.number).sort((x, y) => x - y)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1))
    expect(agents.filter((a) => a.status === 'live').map((a) => a.id).sort()).toEqual([...LIVE_IDS].sort())
    expect(agents.filter((a) => a.status === 'designed')).toHaveLength(12)
  })

  it('exactly eight of twenty-two are preventive, per the §15.2 and §16.6 tables', () => {
    const agents = listAgents()
    expect(agents.filter((a) => a.type === 'preventive').map((a) => a.id).sort()).toEqual([...PREVENTIVE_IDS].sort())
  })

  it('the five advisory-only agents change nothing; payment proposal proposes but never releases', () => {
    for (const id of ADVISORY_IDS) {
      const a = getAgent(id)!
      expect(a.advisoryOnly).toBe(true)
      expect(agentReversibility(a)).toBe('changes nothing')
    }
    const pp = getAgent('payment-proposal')!
    expect(pp.proposesOnly).toBe(true)
    expect(pp.delegation.neverActsOn).toContain('releasing a payment run')
    expect(pp.delegation.requiresDualControl).toBe(true)
    expect(agentReversibility(pp)).toBe('proposes only — a human releases the run')
  })

  it('every supervisor is a named person from the §7.17 pools', () => {
    const pool = ['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP'].flatMap((c) => requestOwnerPool(c))
    for (const a of listAgents()) {
      expect(a.supervisor.length).toBeGreaterThan(0)
      expect(pool).toContain(a.supervisor)
    }
  })

  it('live agents carry metrics, designed ones do not — the honest absence', () => {
    for (const a of listAgents()) {
      if (a.status === 'live') expect(a.metrics).toBeDefined()
      else expect(a.metrics).toBeUndefined()
    }
  })

  it('every live metric set respects its invariants and carries a six-point resolved-share trend', () => {
    for (const a of listAgents().filter((x) => x.status === 'live')) {
      const m = a.metrics!
      expect(m.resolvedWithoutHuman + m.escalated).toBeLessThanOrEqual(m.actionsThisPeriod)
      expect(m.overriddenByHuman).toBeLessThanOrEqual(m.resolvedWithoutHuman)
      expect(m.reversed).toBeLessThanOrEqual(m.resolvedWithoutHuman)
      expect(m.valueActedOnWithoutReviewCr).toBeLessThanOrEqual(m.valueActedOnCr)
      // Every logged action carries withinDelegation: true, so a nonzero breach count would contradict the log itself.
      expect(m.delegationBreaches).toBe(0)
      const s = m.resolvedShareTrend!
      expect(s).toHaveLength(6)
      for (let i = 0; i < 5; i++) expect(s[i] <= s[i + 1]).toBe(true)
      expect(s[5]).toBe(Math.round((m.resolvedWithoutHuman / m.actionsThisPeriod) * 100))
      // §15.6 — the three rate trends feed the governance slice: each is six points, non-decreasing, and ends at its
      // current rate computed from the raw counts (override and reversal both rate against resolvedWithoutHuman).
      for (const [trend, current] of [
        [m.escalationRateTrend!, Math.round((m.escalated / m.actionsThisPeriod) * 100)],
        [m.overrideRateTrend!, Math.round((m.overriddenByHuman / m.resolvedWithoutHuman) * 100)],
        [m.reversalRateTrend!, Math.round((m.reversed / m.resolvedWithoutHuman) * 100)],
      ] as Array<[number[], number]>) {
        expect(trend).toHaveLength(6)
        for (let i = 0; i < 5; i++) expect(trend[i] <= trend[i + 1]).toBe(true)
        expect(trend[5]).toBe(current)
      }
    }
  })

  it('agents with no financial effect act on zero value', () => {
    for (const id of ['follow-up', 'master-data', 'cut-off-surveillance']) {
      expect(getAgent(id)!.metrics!.valueActedOnCr).toBe(0)
    }
  })

  it('action logs exist for every live agent and only for live agents', () => {
    for (const a of listAgents()) {
      const log = agentActions(a.id)
      if (a.status === 'designed') expect(log).toHaveLength(0)
      else expect(log.length).toBeGreaterThan(0)
    }
  })

  it('every action-log target and precedent resolves to a real, openable record (§15.2.1 — precedent must be readable)', () => {
    const requests = listRequests()
    for (const act of listAgents()
      .filter((a) => a.status === 'live')
      .flatMap((a) => agentActions(a.id))) {
      if (act.targetType === 'exception') {
        const ex = getException(act.targetId)
        expect(ex).toBeDefined()
        expect(ex!.entityCode).toBe(act.entityCode)
      } else if (act.targetType === 'request') {
        expect(requests.some((r) => r.id === act.targetId)).toBe(true)
      } else if (act.targetType === 'creditBlock') {
        const c = getCounterparty(act.targetId)
        expect(c).toBeDefined()
        expect(c!.type).toBe('customer')
        expect(c!.creditBlocked).toBe(true)
      } else if (act.targetType === 'po') {
        // §15.7 — a PO-stage engagement targets an open purchase order on the commitments watch
        const po = getPurchaseOrder(act.targetId)
        expect(po).toBeDefined()
        expect(po!.entityCode).toBe(act.entityCode)
      } else if (act.targetType === 'r2r') {
        // §16.6 — a cut-off flag targets the R2R cockpit for that entity; the route exists for every legal entity.
        expect(['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP']).toContain(act.entityCode)
      }
      // §15.2.1/§15.7 — a precedent may cite an exception, a prior intake, a counterparty or an earlier PO engagement; each must resolve to something openable
      for (const pid of act.precedents) {
        expect(getException(pid) !== undefined || requests.some((r) => r.id === pid) || getCounterparty(pid) !== undefined || getPurchaseOrder(pid) !== undefined).toBe(true)
      }
      expect(act.withinDelegation).toBe(true)
    }
  })

  it('agentActions returns each log most-recent-first', () => {
    const log = agentActions('follow-up')
    for (let i = 0; i < log.length - 1; i++) expect(log[i].takenAt >= log[i + 1].takenAt).toBe(true)
  })

  it('the coverage strip is seven P2P, seven O2C and eight R2R stages, with the gaps left visible', () => {
    const strip = coverageStrip()
    expect(strip.p2p.map((s) => s.code)).toEqual(['PR', 'PO', 'GR', 'INV', 'MTC', 'APR', 'PAY'])
    expect(strip.o2c.map((s) => s.code)).toEqual(['ORD', 'CRD', 'DLV', 'BIL', 'DSP', 'COL', 'CSH'])
    // §16.2 — the eight R2R stages in spec order; Step 27 positions the four agents where they act.
    expect(strip.r2r.map((s) => s.code)).toEqual(['SUB', 'ACC', 'REC', 'ICO', 'JRN', 'TB', 'PCK', 'SGN'])
    const byCode = new Map([...strip.p2p, ...strip.o2c, ...strip.r2r].map((s) => [s.code, s]))
    expect(byCode.get('DLV')!.agents).toEqual([])
    expect(byCode.get('DSP')!.agents).toEqual([])
    // R2R gaps — sub-ledger close, trial balance, reporting pack and sign-off carry no agent yet.
    for (const code of ['SUB', 'TB', 'PCK', 'SGN']) expect(byCode.get(code)!.agents).toEqual([])
    // the four R2R agents sit on their stages (§16.6)
    expect(byCode.get('ACC')!.agents).toEqual(['accrual-reversal'])
    expect(byCode.get('REC')!.agents).toEqual(['reconciliation-clearing'])
    expect(byCode.get('ICO')!.agents).toEqual(['intercompany-matching'])
    expect(byCode.get('JRN')!.agents).toEqual(['cut-off-surveillance'])
    expect(byCode.get('INV')!.preClose).toEqual(['provisioning'])
    // billing-readiness acts at both ORD and BIL (§15.2 stage column)
    expect(byCode.get('ORD')!.agents).toContain('billing-readiness')
    expect(byCode.get('BIL')!.agents).toContain('billing-readiness')
    const ids = new Set(listAgents().map((a) => a.id))
    for (const s of [...strip.p2p, ...strip.o2c, ...strip.r2r]) {
      for (const id of s.agents) expect(ids.has(id)).toBe(true)
      for (const id of s.preClose ?? []) expect(ids.has(id)).toBe(true)
    }
  })

  it('the workforce summary is computed from live metrics, never stored', () => {
    const s = agentWorkforceSummary()
    const live = listAgents().filter((a) => a.status === 'live')
    expect(s.liveRoles).toBe(10)
    expect(s.totalRoles).toBe(22)
    expect(s.preventive).toBe(8)
    expect(s.actionsThisPeriod).toBe(live.reduce((t, a) => t + a.metrics!.actionsThisPeriod, 0))
    expect(s.resolvedWithoutHuman).toBe(live.reduce((t, a) => t + a.metrics!.resolvedWithoutHuman, 0))
    expect(s.escalated).toBe(live.reduce((t, a) => t + a.metrics!.escalated, 0))
    expect(s.overriddenByHuman).toBe(live.reduce((t, a) => t + a.metrics!.overriddenByHuman, 0))
    expect(s.reversed).toBe(live.reduce((t, a) => t + a.metrics!.reversed, 0))
    // designed agents have no rates — nulls, not invented figures
    for (const a of listAgents().filter((x) => x.status === 'designed')) {
      expect(agentRates(a)).toEqual({ escalationPct: null, overridePct: null, resolvedSharePct: null })
    }
  })
})

describe('Agents screen (§15.5)', () => {
  it('route renders with breadcrumb, active nav and the workforce headline', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'The agent workforce' })).toBeTruthy()
    // The eyebrow sits above the h1; read it via DOM order.
    expect(m.getByRole('heading', { level: 1 }).previousElementSibling?.textContent).toBe('Agents')
    // §15.1 — every agent surface carries the honesty label.
    expect(m.getByText('Simulated data')).toBeTruthy()
    expect(m.getByText('22 roles · 10 active')).toBeTruthy()
    // §15.1.1 — spec-pinned cycle times.
    expect(m.getByText('agents last ran 06:42 · next cycle 07:00')).toBeTruthy()
    const summary = m.getByText('Workforce').closest('section') as HTMLElement
    const statValue = (label: string) => within(summary).getAllByText(label).map((el) => el.nextElementSibling?.textContent ?? null).find((v) => v !== null)
    expect(statValue('ACTIVE ROLES')).toBe('10 of 22')
    expect(statValue('PREVENTIVE')).toBe('8 of 22')
    for (const label of ['ACTIONS THIS PERIOD', 'RESOLVED WITHOUT HUMAN', 'ESCALATED', 'OVERRIDDEN', 'REVERSED']) {
      expect(/^\d+$/.test(statValue(label) ?? '')).toBe(true)
    }
    // §15.4 — the commercial consequence links out from the summary; its figure is JGL's touch rate, as on the palette row.
    const te = listTouchFunnel().find((r) => r.code === 'JGL')!
    const touchLink = within(summary).getByRole('link', { name: /touch economics/i })
    expect(touchLink.getAttribute('href')).toBe('/touch-economics')
    expect(touchLink.textContent).toContain(`JGL ${te.touchesTodayPer1000} → ${te.touchesAfterPer1000}`)
    expect(breadcrumbText()).toContain('Agents')
    expect(activeNavLabel()).toContain('Agents')
  })

  it('the roster lists all twenty-two agents, each card stating live or designed', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    expect(section.querySelectorAll('[data-fct-agent]')).toHaveLength(22)
    for (const a of listAgents()) {
      expect(within(section).getByText(a.name)).toBeTruthy()
    }
    let live = 0
    let designed = 0
    for (const card of Array.from(section.querySelectorAll('[data-fct-agent]'))) {
      const badges = Array.from(card.querySelectorAll('span')).map((s) => s.textContent)
      if (badges.includes('Active')) live += 1
      else if (badges.includes('Not active')) designed += 1
    }
    expect(live).toBe(10)
    expect(designed).toBe(12)
  })

  it("every card carries a drill into that agent's own record (§15.7)", () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    for (const a of listAgents()) {
      const link = section.querySelector(`[data-fct-agent-link="${a.id}"]`)
      expect(link).toBeTruthy()
      expect(link!.getAttribute('href')).toBe(`/agents/${a.id}`)
    }
  })

  it('groups Shared / P2P / O2C / R2R with preventive before reactive, in roster order by default', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    const sections: Array<{ group: string; type: string; ids: string[] }> = []
    for (const g of Array.from(section.children)) {
      const first = g.firstElementChild?.textContent ?? ''
      if (!/^(SHARED|P2P|O2C|R2R)$/.test(first)) continue
      for (const sub of Array.from(g.children).slice(1)) {
        sections.push({ group: first, type: sub.firstElementChild?.textContent ?? '', ids: Array.from(sub.querySelectorAll('[data-fct-agent]')).map((el) => el.getAttribute('data-fct-agent')!) })
      }
    }
    expect(sections).toEqual([
      { group: 'SHARED', type: 'REACTIVE', ids: ['follow-up', 'master-data'] },
      { group: 'P2P', type: 'PREVENTIVE', ids: ['commitments', 'buying-compliance', 'receipt-discipline', 'contract-price-sync'] },
      { group: 'P2P', type: 'REACTIVE', ids: ['approval-routing', 'match-resolution', 'duplicate-adjudication', 'tax-determination', 'provisioning', 'payment-proposal'] },
      { group: 'O2C', type: 'PREVENTIVE', ids: ['credit-watch', 'billing-readiness', 'collections-outreach'] },
      { group: 'O2C', type: 'REACTIVE', ids: ['credit-release', 'cash-application', 'deduction-triage'] },
      // §16.6 — the four R2R agents; cut-off surveillance is preventive, the other three reactive (roster order).
      { group: 'R2R', type: 'PREVENTIVE', ids: ['cut-off-surveillance'] },
      { group: 'R2R', type: 'REACTIVE', ids: ['reconciliation-clearing', 'intercompany-matching', 'accrual-reversal'] },
    ])
  })

  it('sorting by escalation rate ranks live agents first within every section — how a mis-set delegation gets found', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    // "ESCALATION RATE" is also a metric label on every live card; the sort control is the button carrying data-fct-sort.
    fireEvent.click(section.querySelector('[data-fct-sort="escalation"]')!)
    const liveIds = new Set(listAgents().filter((a) => a.status === 'live').map((a) => a.id))
    for (const g of Array.from(section.children)) {
      const first = g.firstElementChild?.textContent ?? ''
      if (!/^(SHARED|P2P|O2C|R2R)$/.test(first)) continue
      for (const sub of Array.from(g.children).slice(1)) {
        const ids = Array.from(sub.querySelectorAll('[data-fct-agent]')).map((el) => el.getAttribute('data-fct-agent')!)
        let seenDesigned = false
        for (const id of ids) {
          if (!liveIds.has(id)) seenDesigned = true
          else expect(seenDesigned).toBe(false) // a live agent never follows a designed one
        }
      }
    }
  })

  it('the coverage strip positions agents where they act, with the gaps and the pre-close note', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('Lifecycle coverage').closest('section') as HTMLElement
    // seven P2P + seven O2C + eight R2R stages (§16.7 — the strip's biggest gap is now closed).
    expect(section.querySelectorAll('[data-fct-stage]')).toHaveLength(22)
    // PO carries three agents (commitments, buying compliance, contract price sync); DLV and DSP are the visible gaps.
    const chips = (code: string) => section.querySelector(`[data-fct-stage="${code}"]`)!.querySelectorAll('span[title]').length
    expect(chips('PO')).toBe(3)
    expect(chips('DLV')).toBe(0)
    expect(chips('DSP')).toBe(0)
    // §16.6 — the four R2R agents sit on their stages; SUB, TB, PCK and SGN are visible gaps.
    expect(chips('ACC')).toBe(1)
    expect(chips('REC')).toBe(1)
    expect(chips('ICO')).toBe(1)
    expect(chips('JRN')).toBe(1)
    for (const code of ['SUB', 'TB', 'PCK', 'SGN']) expect(chips(code)).toBe(0)
    expect(section.textContent).toContain('(pre-close)')
    expect(section.textContent).toContain('+ 1, 2 across all stages')
  })

  it('restricted authority sits on each agent’s own record — proposes-only and advisory', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    fireEvent.click(section.querySelector('[data-fct-agent-toggle="payment-proposal"]')!)
    const pp = section.querySelector('[data-fct-record="payment-proposal"]') as HTMLElement
    expect(pp.textContent).toContain('AUTHORITY')
    expect(pp.textContent).toContain('proposes only')
    for (const id of ADVISORY_IDS) {
      fireEvent.click(section.querySelector(`[data-fct-agent-toggle="${id}"]`)!)
      const rec = section.querySelector(`[data-fct-record="${id}"]`) as HTMLElement
      expect(rec.textContent).toContain('AUTHORITY')
      expect(rec.textContent).toContain('advisory')
    }
  })

  it('payment proposal shows the delegation it would hold, greyed; advisory agents state they change nothing', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    const pp = section.querySelector('[data-fct-agent="payment-proposal"]')!
    expect(pp.textContent).toContain('WOULD HOLD')
    expect(pp.textContent).toContain('never acts on releasing a payment run')
    for (const id of ADVISORY_IDS) {
      expect(section.querySelector(`[data-fct-agent="${id}"]`)!.textContent).toContain('changes nothing')
    }
  })

  it('Step 27 — the four R2R agents: cut-off surveillance is live and advisory; the other three are designed (§16.6)', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    // cut-off surveillance is live — it carries metrics and an action log whose flags open the R2R cockpit.
    fireEvent.click(section.querySelector('[data-fct-agent-toggle="cut-off-surveillance"]')!)
    const rec = section.querySelector('[data-fct-record="cut-off-surveillance"]') as HTMLElement
    expect(rec.textContent).toContain('AUTHORITY')
    expect(rec.textContent).toContain('advisory')
    expect(rec.querySelectorAll('[data-fct-action]')).toHaveLength(3)
    expect(rec.querySelector('a[href*="/r2r"]')).toBeTruthy()
    // each flag's rationale is on screen (§10.1) — why it flagged, described not persuaded.
    expect(rec.textContent).toContain('The posting spans the period boundary')
    // §15.1.2 — the declined line is part of every decision record and now renders on the action log too:
    // what cut-off deliberately did not do, where a controller reviews it across items.
    expect(rec.textContent).toContain('I did not re-date or reverse the posting')
    // the other three are designed — the delegation they would hold, greyed, with dashes where metrics would be.
    for (const id of ['reconciliation-clearing', 'intercompany-matching', 'accrual-reversal']) {
      const card = section.querySelector(`[data-fct-agent="${id}"]`)!
      expect(card.textContent).toContain('WOULD HOLD')
      expect(card.textContent).toContain('Not active')
    }
  })

  it('§15.8 — what must never be automated — is rendered prominently, all eight items', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('What must never be automated').closest('section') as HTMLElement
    expect(section.querySelectorAll('[data-fct-never-item]')).toHaveLength(8)
    for (const item of [
      'Vendor bank detail changes',
      'Provisions requiring judgment',
      'Anything outside a stated tolerance',
      'Cut-off decisions at period end',
      'Novel cases with no precedent',
      'Statutory sign-off',
      'Credit release against exposure',
      'Anything an agent has already escalated twice',
    ]) {
      expect(section.textContent).toContain(item)
    }
  })

  it('clicking a live agent opens its record: delegation, supervisor, action log with openable targets', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    fireEvent.click(m.getByText('The roster').closest('section')!.querySelector('[data-fct-agent-toggle="follow-up"]')!)
    const record = m.getByText('The roster').closest('section')!.querySelector('[data-fct-record="follow-up"]') as HTMLElement
    expect(record.textContent).toContain('Delegation of authority')
    expect(record.textContent).toContain(getAgent('follow-up')!.supervisor)
    // 4 base entries + one per entity for the two seeded missing-GR lanes (5 entities × 2)
    expect(record.querySelectorAll('[data-fct-action]')).toHaveLength(14)
    expect(record.querySelector('a[href*="/p2p/invoices/"]')).toBeTruthy()
    // §15.1 — the record is an agent surface too; the honesty label repeats here.
    expect(record.textContent).toContain('Simulated data')
  })

  it('designed agents show dashes where metrics would be and an empty action log', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    fireEvent.click(section.querySelector('[data-fct-agent-toggle="payment-proposal"]')!)
    const pp = section.querySelector('[data-fct-record="payment-proposal"]') as HTMLElement
    expect(pp.textContent).toContain('not built; no performance record')
    expect(pp.textContent).toContain('No action log yet.')

    // §15.7 — commitments is live and preventive; its log now carries exception follow-ups plus one PO-stage engagement per open PO it chased, amended or proposed on
    fireEvent.click(section.querySelector('[data-fct-agent-toggle="commitments"]')!)
    const commitments = section.querySelector('[data-fct-record="commitments"]') as HTMLElement
    expect(commitments.querySelectorAll('[data-fct-action]')).toHaveLength(6 + poActionLog.length)
    expect(commitments.querySelector('a[href*="/p2p/invoices/"]')).toBeTruthy()
    // PO-stage engagements open the PO detail page, where the agent–owner exchange lives.
    expect(commitments.querySelector('a[href*="/p2p/commitments/"]')).toBeTruthy()
  })

  it('precedents resolve to openable routes — exceptions, requests and counterparties (§15.2.1)', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    const m = main()
    const section = m.getByText('The roster').closest('section') as HTMLElement
    // master-data's bank-detail escalation cites a prior intake — the request id opens the desk
    fireEvent.click(section.querySelector('[data-fct-agent-toggle="master-data"]')!)
    expect((section.querySelector('[data-fct-record="master-data"]') as HTMLElement).querySelector('a[href="/service-desk"]')).toBeTruthy()
    // credit-release cites a blocked customer — the counterparty id opens that customer's page
    fireEvent.click(section.querySelector('[data-fct-agent-toggle="credit-release"]')!)
    expect((section.querySelector('[data-fct-record="credit-release"]') as HTMLElement).querySelector('a[href*="/customer/"]')).toBeTruthy()
  })

  it('is registered in the command palette and navigates when picked', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "agents" also matches the vendor "Aravalli Reagents"; pick the screen row by its meta, not by position.
    fireEvent.change(input, { target: { value: 'agents' } })
    const rows = within(p).getAllByRole('button')
    const agentRows = rows.filter((r) => /\d+ of \d+ roles active/.test(r.textContent ?? ''))
    expect(agentRows).toHaveLength(1)
    expect(agentRows[0].textContent).toContain('Agents')

    fireEvent.click(agentRows[0])
    expect(window.location.pathname).toBe('/agents')
  })

  it("an agent's record is reachable from the command palette (§15.7)", () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "credit release" matches only the agent row — no vendor, cause or screen carries that phrase.
    fireEvent.change(input, { target: { value: 'credit release' } })
    const rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Credit release')

    fireEvent.click(rows[0])
    expect(window.location.pathname).toBe('/agents/credit-release')
  })
})

describe('Agent record page (§15.7)', () => {
  it("renders the agent's own record — delegation, supervisor, action log filtered to that agent", () => {
    window.history.pushState(null, '', '/agents/follow-up')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'Follow-up & escalation' })).toBeTruthy()
    // The eyebrow sits above the h1; read it via DOM order.
    expect(m.getByRole('heading', { level: 1 }).previousElementSibling?.textContent).toBe('Agents')
    // §15.1 — every agent surface carries the honesty label; header and record each carry their own.
    expect(m.getAllByText('Simulated data')).toHaveLength(2)
    const a = getAgent('follow-up')!
    expect(m.getByText(`#${a.number} · ${a.type} · ${a.scope}`)).toBeTruthy()
    const record = screen.getByRole('main').querySelector('[data-fct-agent-detail="follow-up"]') as HTMLElement
    expect(record.textContent).toContain('Delegation of authority')
    expect(record.textContent).toContain(a.supervisor)
    // The action log is filtered to this agent — the same 14 entries the roster's inline record shows.
    expect(record.querySelectorAll('[data-fct-action]')).toHaveLength(14)
    const bc = breadcrumbText()
    expect(bc).toContain('Agents')
    expect(bc).toContain('Follow-up & escalation')
    expect(activeNavLabel()).toContain('Agents')
  })

  it('the roster drill opens the record page', () => {
    window.history.pushState(null, '', '/agents')
    render(<App />)
    fireEvent.click(screen.getByRole('main').querySelector('[data-fct-agent-link="follow-up"]')!)
    expect(window.location.pathname).toBe('/agents/follow-up')
  })

  it('an unknown agent id redirects to the roster', () => {
    window.history.pushState(null, '', '/agents/no-such-agent')
    render(<App />)
    expect(window.location.pathname).toBe('/agents')
    expect(screen.getByRole('heading', { level: 1, name: 'The agent workforce' })).toBeTruthy()
  })
})

describe('Step 22 — one exception, end to end (§15.2)', () => {
  it('every provisioning action on an exception passes all five of its checks', () => {
    const acts = agentActions('provisioning').filter((a) => a.targetType === 'exception')
    expect(acts.length).toBeGreaterThan(0)
    for (const act of acts) {
      expect(act.checks?.length ?? 0).toBe(5)
      for (const c of act.checks!) expect(c.pass).toBe(true)
    }
  })

  it('only the full-arc exception earns a walkthrough — eight steps', () => {
    const withWalkthrough = listExceptions().filter((x) => exceptionWalkthrough(x))
    expect(withWalkthrough.map((x) => x.id)).toEqual(['AP-104402'])
    expect(exceptionWalkthrough(getException('AP-104402')!)!).toHaveLength(8)
  })

  it('credit-block decisions: Deccan released with all checks passing, Pasir escalated with a failing check', () => {
    const deccan = creditBlockDecisionFor('jgl-deccan')!
    expect(deccan.action.outcome).toBe('resolved')
    for (const c of deccan.action.checks!) expect(c.pass).toBe(true)
    const pasir = creditBlockDecisionFor('jps-pasir')!
    expect(pasir.action.outcome).toBe('escalated')
    expect(pasir.action.checks!.some((c) => !c.pass)).toBe(true)
    for (const id of ['jcp-lakeshore', 'jhs-cornerstone', 'jrp-saint-denis']) {
      expect(creditBlockDecisionFor(id)).toBeUndefined()
    }
  })
})
