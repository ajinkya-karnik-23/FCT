// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { commitmentsWatch, getAgent, getPurchaseOrder, listCostCentres, listEntities, poActionLog, poDecisionFor, purchaseOrders } from '../src/api'

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

const THRESHOLD = getAgent('commitments')!.delegation.confidenceThreshold!

// The demo clock is relative to today (§7.21), so "due in nine days" is checked against the test's own day.
function daysFromToday(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((date.getTime() - today.getTime()) / 86400000)
}

describe('Commitments dataset (§15.2.1/§15.7)', () => {
  it('every cost-centre open PO has exactly one watch row — same id, same value', () => {
    const entries = listCostCentres().flatMap((cc) => cc.openPos.map((p) => ({ ...p, entityCode: cc.entityCode })))
    expect(purchaseOrders).toHaveLength(entries.length)
    for (const e of entries) {
      const po = purchaseOrders.find((x) => x.id === e.po && x.entityCode === e.entityCode)!
      expect(po).toBeTruthy()
      expect(po.valueCr).toBe(e.valueCr)
    }
  })

  it('per entity the named rows sum to the PO stage in-flight value — the same pool the cost-centre pages reconcile to', () => {
    for (const e of listEntities()) {
      const watch = commitmentsWatch(e.code)
      const sum = Math.round(watch.pos.reduce((s, po) => s + po.valueCr, 0) * 10) / 10
      expect(sum).toBe(watch.committedCr)
    }
  })

  it('JGL pins the §7.4 pool — 386 open POs worth ₹58.4 cr, twelve named rows', () => {
    const watch = commitmentsWatch('JGL')
    expect(watch.openPosCount).toBe(386)
    expect(watch.committedCr).toBe(58.4)
    expect(watch.pos).toHaveLength(12)
  })

  it('JGL’s at-risk value is the chased plus proposed rows — ₹18.4 cr, date not yet confirmed', () => {
    const watch = commitmentsWatch('JGL')
    expect([watch.chasedCount, watch.proposedCount, watch.amendedCount]).toEqual([2, 1, 2])
    expect(watch.valueAtRiskCr).toBe(18.4)
    const atRisk = watch.pos.filter((po) => po.chaseState === 'chased' || po.chaseState === 'proposed')
    expect(Math.round(atRisk.reduce((s, po) => s + po.valueCr, 0) * 10) / 10).toBe(watch.valueAtRiskCr)
  })

  it('exchange shape follows the chase state — no reply while chased; posted amendment and notification only when amended', () => {
    for (const po of purchaseOrders) {
      if (po.chaseState === 'on-track') {
        expect(po.exchange).toBeUndefined()
        continue
      }
      const ex = po.exchange!
      expect(ex.askedAt).toBeTruthy()
      expect(ex.askText).toContain(`PO ${po.id}`)
      if (po.chaseState === 'chased') {
        expect(ex.reply).toBeUndefined()
      } else {
        expect(ex.reply).toBeTruthy()
        expect(ex.extractedDate).toBeTruthy()
        expect(ex.confidence!).toBeGreaterThan(0)
        expect(ex.confidence!).toBeLessThanOrEqual(1)
        expect(ex.amendment!.from).not.toBe(ex.amendment!.to)
      }
      if (po.chaseState === 'amended') {
        expect(po.originalDeliveryDate).toBe(ex.amendment!.from)
        expect(po.deliveryDate).toBe(ex.amendment!.to)
        expect(ex.amendment!.postedAt).toBeTruthy()
        expect(ex.notificationText).toContain('No other field was changed')
        expect(ex.notifiedAt).toBeTruthy()
      } else if (po.chaseState === 'proposed') {
        // A proposal changes nothing in SAP — no posted stamp, and the delivery date stands.
        expect(ex.amendment!.postedAt).toBeUndefined()
        expect(ex.proposedAt).toBeTruthy()
        expect(po.originalDeliveryDate).toBeUndefined()
      }
    }
  })

  it('confidence sits on the right side of the delegation threshold — above when amended, below when proposed', () => {
    for (const po of purchaseOrders) {
      const conf = po.exchange?.confidence
      if (conf == null) continue
      if (po.chaseState === 'amended') expect(conf).toBeGreaterThanOrEqual(THRESHOLD)
      if (po.chaseState === 'proposed') expect(conf).toBeLessThan(THRESHOLD)
    }
  })

  it('the nine-day beat: PO-48115 was due in nine days and is amended; PO-48307’s ambiguous reply is proposed', () => {
    const a = getPurchaseOrder('PO-48115')!
    expect(a.chaseState).toBe('amended')
    expect(daysFromToday(a.originalDeliveryDate!)).toBe(9)
    expect(a.exchange!.reply!.text).toContain('Vendor confirmed the batch is pushed into')

    const p = getPurchaseOrder('PO-48307')!
    expect(p.chaseState).toBe('proposed')
    expect(p.exchange!.reply!.text).toContain('Might slip, checking with vendor')
  })

  it('the action log holds one record per engaged PO — date-only scope, outcome by state', () => {
    const engaged = purchaseOrders.filter((po) => po.chaseState !== 'on-track')
    expect(poActionLog).toHaveLength(engaged.length)
    for (const act of poActionLog) {
      expect(act.agentId).toBe('commitments')
      expect(act.targetType).toBe('po')
      const po = getPurchaseOrder(act.targetId)!
      expect(po).toBeTruthy()
      if (po.chaseState === 'amended') expect(act.outcome).toBe('resolved')
      if (po.chaseState === 'proposed') expect(act.outcome).toBe('escalated')
      if (po.chaseState === 'chased') expect(act.outcome).toBe('awaiting')
    }
  })

  it('precedents are earlier engagements of the same outcome — chronology holds group-wide', () => {
    const byId = new Map(poActionLog.map((a) => [a.targetId, a]))
    for (const act of poActionLog) {
      if (!act.precedents?.length) continue
      for (const pid of act.precedents) {
        const prior = byId.get(pid)!
        expect(prior).toBeTruthy()
        expect(prior.takenAt < act.takenAt).toBe(true)
      }
    }
  })

  it('poDecisionFor returns a record for every engaged PO and nothing for an untouched one', () => {
    const engaged = purchaseOrders.filter((po) => po.chaseState !== 'on-track')
    for (const po of engaged) expect(poDecisionFor(po.id)).toBeTruthy()
    const untouched = purchaseOrders.find((po) => po.chaseState === 'on-track')!
    expect(poDecisionFor(untouched.id)).toBeUndefined()
  })
})

describe('Commitments watch screen (§15.7)', () => {
  it('route renders with breadcrumb and the P2P cockpit kept active in the rail', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/commitments')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'Commitments watch' })).toBeTruthy()
    expect(breadcrumbText()).toContain('Commitments watch')
    expect(activeNavLabel()?.startsWith('P2P cockpit')).toBe(true)
  })

  it('states the claim precisely — true commitment data and the accrual estimate, never "prevents blocked invoices"', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/commitments')
    render(<App />)
    const m = main()
    const claim = (m.getByText('What this agent protects').closest('section') as HTMLElement).textContent ?? ''
    expect(claim).toContain('keeps the commitment data true')
    expect(claim).toContain('accrual estimate')
    expect(claim).not.toContain('prevents blocked invoices')
  })

  it('lists JGL’s twelve named POs ordered by delivery date, with the stage pool stated beside them', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/commitments')
    render(<App />)
    const m = main()
    const section = (m.getByText('Open POs by delivery date').closest('section') as HTMLElement)
    const rows = Array.from(section.querySelectorAll('.fct-table-row'))
    expect(rows).toHaveLength(12)
    const dates = rows.map((r) => {
      // Clay's DataTable wraps the cells in an inner grid, so the cells are one level down.
      const cell = r.firstElementChild!.children[4].textContent ?? ''
      const mm = /(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})/.exec(cell)!
      return new Date(+mm[3], ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(mm[2]), +mm[1]).getTime()
    })
    expect(dates.every((d, i) => i === 0 || d >= dates[i - 1])).toBe(true)
    expect(section.textContent).toContain('sample of 386 open')
    const amendedRow = rows.find((r) => r.textContent?.startsWith('PO-48115'))!
    expect(amendedRow.textContent).toContain('AMENDED')
    expect(amendedRow.textContent).toContain('was ')
    const proposedRow = rows.find((r) => r.textContent?.startsWith('PO-48307'))!
    expect(proposedRow.textContent).toContain('PROPOSED · ESCALATED')
  })

  it('the PO stage on the cockpit links to the watch, not the worklist', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p')
    render(<App />)
    const stage = document.getElementById('fct-stage-PO') as HTMLAnchorElement | null
    expect(stage).toBeTruthy()
    expect(stage!.getAttribute('href')).toBe('/entity/JGL/p2p/commitments')
  })

  it('is registered in the command palette and navigates when picked', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "commitments" also matches the agent row; pick the screen row by its dataset-derived meta.
    fireEvent.change(input, { target: { value: 'commitments' } })
    const rows = within(p).getAllByRole('button')
    const watchRows = rows.filter((r) => /open POs · ₹[\d.]+ cr at risk/.test(r.textContent ?? ''))
    expect(watchRows).toHaveLength(1)
    expect(watchRows[0].textContent).toContain('Commitments watch')

    fireEvent.click(watchRows[0])
    expect(window.location.pathname).toBe('/entity/JGL/p2p/commitments')
  })
})

describe('PO detail — the agent–owner exchange (§15.2.1)', () => {
  it('the nine-day amendment shows the quoted reply, what was understood and a date-only change', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/commitments/PO-48115')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'PO-48115' })).toBeTruthy()

    const exchange = (m.getByText('Agent–owner exchange').closest('section') as HTMLElement).textContent ?? ''
    expect(exchange).toContain('Vendor confirmed the batch is pushed into') // quoted reply
    expect(/Understood: delivery moves to \d{1,2} [A-Z][a-z]{2} \d{4} — confidence 0\.\d{2}/.test(exchange)).toBe(true)
    expect(exchange).toContain('— date only')
    expect(exchange).toContain('No other field was changed')

    const dec = document.querySelector('[data-fct-decision="commitments-po-PO-48115"]') as HTMLElement | null
    expect(dec).toBeTruthy()
    const spans = Array.from(dec!.querySelectorAll('span'))
    expect(spans.filter((s) => s.textContent === 'PASS')).toHaveLength(3)
    expect(spans.filter((s) => s.textContent === 'FAIL')).toHaveLength(0)
    expect(dec!.textContent).toContain('price, quantity, vendor') // the delegation’s never-acts-on line
  })

  it('the ambiguous reply fails exactly the confidence check — proposed and escalated, nothing amended', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/commitments/PO-48307')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'PO-48307' })).toBeTruthy()

    const exchange = (m.getByText('Agent–owner exchange').closest('section') as HTMLElement).textContent ?? ''
    expect(exchange).toContain('Might slip, checking with vendor') // quoted reply
    expect(exchange).toContain('below the threshold')
    expect(exchange).toContain('no change made')

    const dec = document.querySelector('[data-fct-decision="commitments-po-PO-48307"]') as HTMLElement | null
    expect(dec).toBeTruthy()
    const spans = Array.from(dec!.querySelectorAll('span'))
    expect(spans.filter((s) => s.textContent === 'PASS')).toHaveLength(2)
    expect(spans.filter((s) => s.textContent === 'FAIL')).toHaveLength(1)
    expect(m.getByText(/Proposed a new delivery date and escalated/)).toBeTruthy()
  })

  it('an untouched PO shows the exchange card with no invented activity', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p/commitments/PO-48211')
    render(<App />)
    const m = main()
    expect(m.getByRole('heading', { level: 1, name: 'PO-48211' })).toBeTruthy()
    const exchange = (m.getByText('Agent–owner exchange').closest('section') as HTMLElement).textContent ?? ''
    expect(exchange).toContain('No agent activity — the delivery date stands as released.')
    expect(document.querySelector('[data-fct-decision]')).toBeNull()
  })
})
