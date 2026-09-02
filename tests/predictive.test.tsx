// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'
import { getForecast, monthEndIso } from '../src/api'

// jsdom shares one window across tests in a file; BrowserRouter reads the live
// pathname on mount, so reset before each render.
beforeEach(() => {
  window.history.pushState(null, '', '/entity/JGL/predictive')
})

afterEach(cleanup)

const PALETTE_INPUT = 'Jump to an entity, process, exception or vendor'

describe('Predictive screen (§7.3)', () => {
  it('renders at /entity/:code/predictive with breadcrumb and active rail item', () => {
    render(<App />)
    const h1 = screen.getByRole('main').querySelector('h1')!.textContent
    expect(h1).toBe('DSO 62 today → 72 projected at month-end')

    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent ?? ''
    expect(crumb).toContain('Group')
    expect(crumb).toContain('JGL')
    expect(crumb).toContain('Predictive')
    expect(document.querySelector('.fct-nav-item--active')?.textContent).toContain('Predictive')
  })

  it('shows each entity its own forecast — JRP renders JRP drivers, not JGL (§7.23)', () => {
    window.history.pushState(null, '', '/entity/JRP/predictive')
    render(<App />)
    const main = screen.getByRole('main')
    expect(main.querySelector('h1')!.textContent).toBe('DSO 74 today → 86 projected at month-end')

    const text = main.textContent ?? ''
    for (const d of getForecast('JRP')!.drivers) expect(text).toContain(d.label)
    expect(text).not.toContain('Amrit Distributors')

    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent ?? ''
    expect(crumb).toContain('JRP')
    // The rail follows the entity in context, so its Predictive link targets JRP's scope.
    const railLink = within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: /Predictive/ })
    expect(railLink.getAttribute('href')).toBe('/entity/JRP/predictive')
  })

  it('shows the DPO honesty flag with the blocked-invoice footnote (§8.6)', () => {
    render(<App />)
    const main = screen.getByRole('main')
    const dpoSection = Array.from(main.querySelectorAll('section')).find((s) => s.textContent?.includes('DPO today'))!
    expect(dpoSection.textContent).toContain('48 days')
    expect(dpoSection.textContent).toContain('Includes ₹18.6 cr of blocked invoices; adjusted DPO 41 days.')
  })

  it('lists the four §7.3 drivers with values, day impacts and base settlement dates', () => {
    render(<App />)
    const main = screen.getByRole('main')
    const text = main.textContent ?? ''

    for (const d of getForecast('JGL')!.drivers) expect(text).toContain(d.label)
    for (const v of ['₹9.4 cr', '₹6.2 cr', '₹4.8 cr', '₹3.1 cr']) expect(text).toContain(v)
    for (const impact of ['+4.1', '+2.7', '+2.1', '+1.1']) expect(text).toContain(impact)

    const inputs = main.querySelectorAll<HTMLInputElement>('input[type="date"]')
    expect(inputs).toHaveLength(4)
    getForecast('JGL')!.drivers.forEach((d, i) => {
      expect(inputs[i].value).toBe(d.baseSettleIso!)
    })

    // Base case: every driver is still open at month-end.
    expect(text.split('OPEN AT MONTH-END').length - 1).toBe(4)
  })

  it('shows the ranked actions in spec order with owner, effort and days recovered', () => {
    render(<App />)
    const text = screen.getByRole('main').textContent ?? ''

    // Spec order is by movement per unit of effort — not by size of improvement.
    const names = [
      'Settle two disputes under ₹10 lakh',
      'Apply matched receipts to open AR',
      'Release credit block on Deccan Pharma Retail',
      'Escalate Amrit Distributors to commercial',
    ]
    let last = -1
    for (const n of names) {
      const idx = text.indexOf(n)
      expect(idx).toBeGreaterThan(last)
      last = idx
    }
    expect(text).toMatch(/per unit of effort/)
    for (const owner of ['Collections', 'Cash application', 'Entity controller', 'Business partner']) expect(text).toContain(owner)
  })

  it('recalculates the projection live when a driver is marked resolved or its settlement date moves', () => {
    render(<App />)
    const main = screen.getByRole('main')
    const h1 = () => main.querySelector('h1')!.textContent

    // The control is selected by its stable driver id — row order must not be load-bearing (§7.23).
    const amrit = main.querySelector<HTMLButtonElement>('[data-driver-id="jgl-amrit"]')!
    fireEvent.click(amrit)
    expect(h1()).toBe('DSO 62 today → 67.9 projected at month-end')

    // Undo restores the base case.
    fireEvent.click(screen.getByRole('button', { name: 'UNDO' }))
    expect(h1()).toBe('DSO 62 today → 72 projected at month-end')

    // Resolve Amrit again, then pull Deccan's settlement (the date input in its own row) to the first of the month.
    fireEvent.click(amrit)
    const deccanInput = main.querySelector('[data-driver-id="jgl-deccan"]')!.closest('.fct-table-row')!.querySelector<HTMLInputElement>('input[type="date"]')!
    fireEvent.change(deccanInput, { target: { value: monthEndIso().slice(0, 7) + '-01' } })
    expect(h1()).toBe('DSO 62 today → 65.8 projected at month-end')
  })

  it('RESET TO BASE CASE returns the headline and every settlement date to the base case', () => {
    render(<App />)
    const main = screen.getByRole('main')

    fireEvent.click(main.querySelector<HTMLButtonElement>('[data-driver-id="jgl-amrit"]')!)
    const sanjeevaniInput = main.querySelector('[data-driver-id="jgl-sanjeevani"]')!.closest('.fct-table-row')!.querySelector<HTMLInputElement>('input[type="date"]')!
    fireEvent.change(sanjeevaniInput, { target: { value: monthEndIso().slice(0, 7) + '-01' } })

    fireEvent.click(screen.getByRole('button', { name: 'RESET TO BASE CASE' }))

    expect(main.querySelector('h1')!.textContent).toBe('DSO 62 today → 72 projected at month-end')
    const after = main.querySelectorAll<HTMLInputElement>('input[type="date"]')
    getForecast('JGL')!.drivers.forEach((d, i) => {
      expect(after[i].value).toBe(d.baseSettleIso!)
    })
    expect((main.textContent ?? '').split('OPEN AT MONTH-END').length - 1).toBe(4)
  })

  it('is reachable from the command palette and navigates on Enter', () => {
    window.history.pushState(null, '', '/')
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText(PALETTE_INPUT)
    fireEvent.change(input, { target: { value: 'predictive' } })

    const rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Predictive')
    expect(rows[0].textContent).toContain('DSO 62 → 72 at month-end')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/entity/JGL/predictive')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
