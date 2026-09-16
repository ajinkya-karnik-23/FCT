// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { cutoffRiskThresholdDays, getCashOpportunities, getEntity, listCauses, listRootCauses } from '../src/api'
import type { RootCauseEntry } from '../src/api'
import { formatCr } from '../src/lib/format'

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

const ALL = [...listCauses('p2p'), ...listCauses('o2c')]
const sumV = (cs: typeof ALL) => cs.reduce((t, c) => t + c.valueAtRisk, 0)
// The register's largest JGL row per cause drives the inspector — mirror the screen's selection, never a literal.
const JGL_REG = new Map(
  listRootCauses()
    .filter((e) => e.entityCodes.includes('JGL'))
    .reduce((m, e) => { const cur = m.get(e.parentCause); if (!cur || e.valueCr > cur.valueCr) m.set(e.parentCause, e); return m }, new Map<string, RootCauseEntry>()),
)

describe('Cash attribution dataset (§8.4)', () => {
  it('the P2P pool ties to the entity AP-blocked metric shown on every other screen', () => {
    expect(Math.abs(sumV(listCauses('p2p')) - getEntity('JGL').metrics.apBlocked.current)).toBeLessThan(0.05)
  })

  it('twelve causes split six per pool, each carrying a stuck value', () => {
    expect(listCauses('p2p')).toHaveLength(6)
    expect(listCauses('o2c')).toHaveLength(6)
    for (const c of ALL) expect(c.valueAtRisk).toBeGreaterThan(0)
  })

  it('every cause carries at least one JGL register row — the no-fix lens set is empty', () => {
    for (const c of ALL) expect(JGL_REG.has(c.key), `register row for ${c.key}`).toBe(true)
    // The screen's no-fix figure derives from this coverage; pin that it is zero, not a stored constant.
    expect(ALL.filter((c) => !JGL_REG.has(c.key))).toHaveLength(0)
  })

  it('missing GR carries the pinned cash opportunity', () => {
    const opp = getCashOpportunities().find((o) => o.causeKey === 'missing-gr')!
    expect(opp).toBeTruthy()
    expect([opp.value, opp.items]).toEqual([4.2, 38])
    expect(opp.name).toBe('Release invoices where GR posted this week')
  })

  it('the close lens cut-off risk threshold is a dataset figure', () => {
    // A business rule a controller could argue with — pinned here so the screen can never drift from it.
    expect(cutoffRiskThresholdDays()).toBe(6)
  })
})

describe('Cash attribution screen (§8.4)', () => {
  it('route renders with breadcrumb, active nav, scope chip and the reconciled total', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    const m = main()
    expect(m.getByText('JGL · Jubilant Generics Ltd')).toBeTruthy()
    expect((document.querySelector('#fct-ca-total') as HTMLElement).textContent).toBe(formatCr(sumV(ALL)))
    // The header states the reconciliation: every cause counted, tied to AP blocked.
    const recon = (document.querySelector('#fct-ca-recon') as HTMLElement).textContent ?? ''
    expect(recon).toContain(`${ALL.length} causes`)
    expect(recon).toContain(`ties to AP blocked ${formatCr(getEntity('JGL').metrics.apBlocked.current)}`)
    expect(breadcrumbText()).toContain('Cash attribution')
    expect(activeNavLabel()).toContain('Cash attribution')
  })

  it('all twelve causes render as bands, each labelled with name, value and fix status', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    const bands = Array.from(document.querySelectorAll('[data-fct-ca-band]'))
    expect(bands).toHaveLength(ALL.length)
    for (const c of ALL) {
      const b = bands.find((el) => el.getAttribute('data-fct-ca-band') === c.key)!
      expect(b, `band for ${c.key}`).toBeTruthy()
      expect(b!.getAttribute('aria-label')).toContain(c.name)
      expect(b!.getAttribute('aria-label')).toContain(formatCr(c.valueAtRisk))
    }
  })

  it('each pool drills to its process screen and carries the no-fix figure', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    const ap = document.querySelector('[data-fct-ca-pool="ap"]')!
    expect(ap.getAttribute('href')).toBe('/entity/JGL/p2p/invoices')
    expect(ap.textContent).toContain(formatCr(sumV(listCauses('p2p'))))
    // Full register coverage — no cause is without a row, so the pool carries no "no fix in flight" line at all.
    expect(ap.textContent).not.toContain('has no fix in flight')
    const ar = document.querySelector('[data-fct-ca-pool="ar"]')!
    expect(ar.getAttribute('href')).toBe('/entity/JGL/o2c')
    expect(ar.textContent).toContain(formatCr(sumV(listCauses('o2c'))))
  })

  it('the default selection traces missing GR — pool share, register row and cash opportunity', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    const mg = ALL.find((c) => c.key === 'missing-gr')!
    expect((document.querySelector('#fct-ca-caption') as SVGTextElement).textContent).toBe(
      `${formatCr(mg.valueAtRisk)} · ${Math.round((mg.valueAtRisk / sumV(listCauses('p2p'))) * 100)}% of Blocked AP`,
    )
    const insp = document.querySelector('#fct-ca-inspector')!
    expect(insp.querySelector('a[href^="/root-causes?cause="]')?.getAttribute('href')).toBe(`/root-causes?cause=${mg.key}`)
    const regLink = document.querySelector('[data-fct-ca-register-link]') as HTMLElement
    expect(regLink.textContent).toBe(JGL_REG.get('missing-gr')!.id)
    expect(regLink.getAttribute('href')).toBe('/root-causes')
    // The eliminated row carries no target date — the register says none rather than inventing one.
    expect(insp.textContent).toContain('Eliminated')
    expect(insp.textContent).toContain('— none set')
    const opp = getCashOpportunities().find((o) => o.causeKey === 'missing-gr')!
    const oppLink = document.querySelector('[data-fct-ca-opp-link]') as HTMLElement
    expect(oppLink.getAttribute('href')).toBe('/entity/JGL/working-capital')
    expect(oppLink.querySelector('b')?.textContent).toBe(formatCr(opp.value))
    expect(oppLink.textContent).toContain(opp.name)
    expect(oppLink.textContent).toContain(`${opp.items} items · ${opp.effort} effort · ${opp.owner}`)
  })

  it('choosing a lens replaces the default selection with its surviving set', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    // On load the design's default selection traces missing GR.
    expect(document.querySelector('#fct-ca-caption')).toBeTruthy()

    fireEvent.click(document.querySelector('[data-fct-ca-lens="outside"]')!)
    const bandOp = (key: string) => (document.querySelector(`[data-fct-ca-band="${key}"]`) as HTMLElement).style.opacity
    // The single-cause trace is cleared — no caption, no register link.
    expect(document.querySelector('#fct-ca-caption')).toBeNull()
    expect(document.querySelector('[data-fct-ca-register-link]')).toBeNull()
    // The set: the owning team's own causes (AP & tax on P2P, Treasury on O2C) are dimmed; everything else is lit.
    const inside = ['duplicate-suspicion', 'tax-mismatch', 'cash-application']
    for (const c of ALL) {
      expect(bandOp(c.key), `band ${c.key}`).toBe(inside.includes(c.key) ? '0.13' : '1')
    }
  })

  it('selecting another lens replaces the first — no fallback to a default', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    const bandOp = (key: string) => (document.querySelector(`[data-fct-ca-band="${key}"]`) as HTMLElement).style.opacity

    fireEvent.click(document.querySelector('[data-fct-ca-lens="outside"]')!)
    expect(bandOp('duplicate-suspicion')).toBe('0.13') // AP & tax — inside the owning team
    expect(bandOp('missing-gr')).toBe('1')

    fireEvent.click(document.querySelector('[data-fct-ca-lens="noowner"]')!)
    // Every cause is on the register now — the no-fix lens dims all twelve bands, none lit.
    expect(bandOp('missing-gr')).toBe('0.13')
    expect(bandOp('duplicate-suspicion')).toBe('0.13')
  })

  it('ribbon geometry derives from cause values — band height is proportional to value at risk', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    const h = (key: string) => parseFloat((document.querySelector(`[data-fct-ca-band="${key}"] .fct-ca-node`) as SVGRectElement).getAttribute('height')!)
    // missing GR (34% of its pool) and pricing disputes (~29%) must be close in size — a fixed layout with real
    // numbers written over it would not hold this ratio.
    const mg = ALL.find((c) => c.key === 'missing-gr')!
    const pd = ALL.find((c) => c.key === 'pricing-disputes')!
    expect(Math.abs(h('missing-gr') / h('pricing-disputes') - mg.valueAtRisk / pd.valueAtRisk)).toBeLessThan(0.01)
    // Equal values get equal heights.
    expect(h('po-price-mismatch')).toBeCloseTo(h('deductions'), 5)
  })

  it('the close lens applies the dataset cut-off risk threshold', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    fireEvent.click(document.querySelector('[data-fct-ca-lens="close"]')!)
    const atRisk = ALL.filter((c) => c.avgDelayDays >= cutoffRiskThresholdDays())
    // Both sides of the split are non-empty — this test cannot pass vacuously.
    expect(atRisk.length).toBeGreaterThan(0)
    expect(atRisk.length).toBeLessThan(ALL.length)
    for (const c of ALL) {
      const op = (document.querySelector(`[data-fct-ca-band="${c.key}"]`) as HTMLElement).style.opacity
      expect(op, `band ${c.key}`).toBe(atRisk.includes(c) ? '1' : '0.13')
    }
    expect((document.querySelector('#fct-ca-ro-big') as HTMLElement).textContent).toBe(formatCr(sumV(atRisk)))
  })

  it('the no-fix lens recomputes over the surviving causes, and combines with the process filter', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    const big = () => (document.querySelector('#fct-ca-ro-big') as HTMLElement).textContent
    const note = () => (document.querySelector('#fct-ca-ro-note') as HTMLElement).textContent ?? ''
    expect(big()).toBe(formatCr(sumV(ALL)))

    fireEvent.click(document.querySelector('[data-fct-ca-lens="noowner"]')!)
    // Full register coverage: the lens's survivor set is empty, so the readout says exactly that.
    const noOwner = ALL.filter((c) => !JGL_REG.has(c.key))
    expect(noOwner).toHaveLength(0)
    expect(big()).toBe(formatCr(sumV(noOwner)))
    expect(note()).toBe('No causes in this process match the lens.')

    // The process filter combines with the empty set — still zero, same message.
    fireEvent.click(document.querySelector('[data-fct-ca-proc="ap"]')!)
    expect(big()).toBe(formatCr(0))
    expect(note()).toBe('No causes in this process match the lens.')

    fireEvent.click(document.querySelector('[data-fct-ca-proc="all"]')!)
    fireEvent.click(document.querySelector('[data-fct-ca-lens="all"]')!)
    expect(big()).toBe(formatCr(sumV(ALL)))
  })

  it('selecting another cause re-traces its pool share and register row', () => {
    window.history.pushState(null, '', '/cash-attribution')
    render(<App />)
    const ppm = ALL.find((c) => c.key === 'po-price-mismatch')!
    fireEvent.click(document.querySelector('[data-fct-ca-band="po-price-mismatch"]')!)
    expect((document.querySelector('#fct-ca-caption') as SVGTextElement).textContent).toBe(
      `${formatCr(ppm.valueAtRisk)} · ${Math.round((ppm.valueAtRisk / sumV(listCauses('p2p'))) * 100)}% of Blocked AP`,
    )
    const insp = document.querySelector('#fct-ca-inspector')!
    const ppmRow = JGL_REG.get('po-price-mismatch')!
    expect(document.querySelector('[data-fct-ca-register-link]')?.textContent).toBe(ppmRow.id)
    // The largest row is eliminated — its owner comes from the register, and no opportunity is listed for this cause.
    expect(insp.textContent).toContain('Eliminated')
    expect(insp.textContent).toContain(ppmRow.owner)
    expect(insp.textContent).toContain('No cash opportunity listed against this cause.')

    // An in-progress row shows its target date — the day count is computed against today, not stored.
    const ca = ALL.find((c) => c.key === 'cash-application')!
    fireEvent.click(document.querySelector('[data-fct-ca-band="cash-application"]')!)
    expect((document.querySelector('#fct-ca-caption') as SVGTextElement).textContent).toBe(
      `${formatCr(ca.valueAtRisk)} · ${Math.round((ca.valueAtRisk / sumV(listCauses('o2c'))) * 100)}% of Revenue at risk`,
    )
    const caRow = JGL_REG.get('cash-application')!
    expect(document.querySelector('[data-fct-ca-register-link]')?.textContent).toBe(caRow.id)
    expect(insp.textContent).toContain('+24 d')
  })

  it('is registered in the command palette and navigates when picked', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    fireEvent.change(input, { target: { value: 'cash attribution' } })
    const rows = within(p).getAllByRole('button').filter((r) => (r.textContent ?? '').includes('Cash attribution'))
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain(`${ALL.length} causes · ${formatCr(sumV(ALL))} stuck`)

    fireEvent.click(rows[0])
    expect(window.location.pathname).toBe('/cash-attribution')
  })

  it('the reference prototype is restored as a second screen — iframe, rail label and breadcrumb', () => {
    window.history.pushState(null, '', '/cash-attribution-original')
    render(<App />)
    const frame = main().getByTitle('Cash attribution') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe('/cash-attribution.html')
    expect(breadcrumbText()).toContain('Cash attribution (original)')
    expect(activeNavLabel()).toContain('Cash attribution (original)')
  })
})
