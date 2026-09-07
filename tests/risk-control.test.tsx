// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../src/App'

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

// §7.21 mirror of the dataset's date derivation — detection dates are today − N days.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function daysAgo(n: number): string {
  const t = new Date()
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - n)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// The path a user takes: group view → rail item (top-level, no entity in context).
function openRiskControl() {
  render(<App />)
  const rail = screen.getByRole('navigation', { name: 'Primary' })
  fireEvent.click(within(rail).getByRole('link', { name: /Risk & control/ }))
}

describe('Risk & control (spec §7.8, §8.8)', () => {
  it('route renders with its breadcrumb and active nav state', () => {
    openRiskControl()
    expect(main().getByRole('heading', { level: 1, name: 'Risk & control' })).toBeTruthy()
    const bc = breadcrumbText()
    expect(bc).toContain('Group')
    expect(bc).toContain('Risk & control')
    expect(activeNavLabel()).toContain('Risk & control')
  })

  it('shows the RESTRICTED banner with a demo-only access toggle, defaulting to visible (§8.8)', () => {
    openRiskControl()
    const m = main()
    expect(m.getByText('RESTRICTED — Financial Controller and above')).toBeTruthy()
    expect(m.getByRole('button', { name: 'FC AND ABOVE' })).toBeTruthy()
    expect(m.getByRole('button', { name: 'PLANT MANAGER' })).toBeTruthy()

    // All five categories in spec order, then the agent governance slice, then the effectiveness metrics section.
    const sections = Array.from(screen.getByRole('main').querySelectorAll('section'))
    expect(sections).toHaveLength(7)
    for (const [i, label] of ['Payment integrity', 'Authority integrity', 'System integrity', 'Cut-off integrity', 'Undisclosed exposure', 'Agent governance', 'Control effectiveness — AP automation'].entries()) {
      expect(sections[i].textContent?.startsWith(label)).toBe(true)
    }
  })

  it('populates all eight §7.8 signals with severity, value at risk, entity and detection date', () => {
    openRiskControl()
    const m = main()

    for (const title of [
      'Vendor bank detail changed 3 days before payment run',
      'First-time payee above ₹50 lakh threshold',
      'PO split into 3 below approval threshold',
      'Retrospective PO — dated after invoice',
      'SoD conflict: same user creates vendor and releases payment',
      'Payment terms changed on 7 vendors without approval',
      '14 goods receipts posted across period end',
      'Goods received not invoiced, ageing beyond 90 days',
    ]) {
      expect(m.getByText(title)).toBeTruthy()
    }

    // Severities: five High, three Medium — rendered as mono tags.
    expect(m.getAllByText('HIGH')).toHaveLength(5)
    expect(m.getAllByText('MEDIUM')).toHaveLength(3)

    // Quantified values render via formatCr; the two system rows carry none and show a dash.
    for (const v of ['₹2.4 cr', '₹0.8 cr', '₹1.9 cr', '₹0.6 cr', '₹3.1 cr', '₹5.2 cr']) {
      expect(m.getByText(`value at risk ${v}`)).toBeTruthy()
    }
    expect(m.getAllByText('value at risk —')).toHaveLength(2)

    // Entity and detection date per row; dates derive as today − N days (§7.21).
    expect(m.getAllByText('JRP')).toHaveLength(3)
    expect(m.getAllByText('JGL')).toHaveLength(3)
    expect(m.getAllByText('JBL')).toHaveLength(2)
    for (const n of [12, 21, 34, 46, 28, 40, 30, 25]) {
      expect(m.getByText(`detected ${daysAgo(n)}`)).toBeTruthy()
    }
  })

  it('shows AP automation effectiveness metrics: override rates and value prevented YTD (§7.8.1)', () => {
    openRiskControl()
    const m = main()
    expect(m.getByText('Duplicate check — override rate, YTD')).toBeTruthy()
    expect(m.getByText('4.9%')).toBeTruthy()
    expect(m.getByText('2 of 41 flagged overridden')).toBeTruthy()
    expect(m.getByText('Three-way match — override rate, YTD')).toBeTruthy()
    expect(m.getByText('7.5%')).toBeTruthy()
    expect(m.getByText('5 of 67 failed overridden')).toBeTruthy()
    expect(m.getByText('Value prevented, YTD')).toBeTruthy()
    expect(m.getByText('₹23.4 cr')).toBeTruthy()
  })

  it('carries the agent governance slice — only what needs attention, each row drilling into the record (§15.6)', () => {
    openRiskControl()
    const govEl = screen.getByRole('main').querySelector('[data-fct-agent-governance]') as HTMLElement
    const gov = within(govEl)

    // The slice states its scope and carries the §15.1 honesty label; volume and resolution rates stay on the Agents screen.
    expect(gov.getByText('exceptions and exposure only · source: agent action logs')).toBeTruthy()
    expect(gov.getByText('Simulated data')).toBeTruthy()

    // The four figures with their denominators; value without review is the one an auditor asks for first.
    expect(gov.getByText('Delegation breaches')).toBeTruthy()
    expect(gov.getByText('0')).toBeTruthy()
    expect(gov.getByText('every logged action stayed inside its delegation')).toBeTruthy()
    expect(gov.getByText('Reversals')).toBeTruthy()
    expect(gov.getByText('17')).toBeTruthy()
    expect(gov.getByText('17 of 1427 actions this period')).toBeTruthy()
    expect(gov.getByText('Overrides by human')).toBeTruthy()
    expect(gov.getByText('30')).toBeTruthy()
    expect(gov.getByText('30 of 1081 resolved without human')).toBeTruthy()
    expect(gov.getByText('Value acted on without human review')).toBeTruthy()
    expect(gov.getByText('₹252.8 cr')).toBeTruthy()
    expect(gov.getByText('of ₹316.6 cr acted on this period')).toBeTruthy()

    // Every live agent appears — a register evidences absence as well as presence; ordered by value without review,
    // so the first row is match-resolution and it drills into that agent's own record.
    const rows = Array.from(govEl.querySelectorAll('[data-fct-gov-row]'))
    expect(rows).toHaveLength(9)
    expect(rows[0].getAttribute('data-fct-gov-row')).toBe('match-resolution')
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/agents/match-resolution')

    // Agents with no value acted on without review show the honest-absence dash, not a zero figure.
    expect(gov.getAllByText('without review —')).toHaveLength(4)

    // The rates are interpreted rather than just displayed: rising override/reversal → delegation set wrong;
    // rising escalation → the policy needs updating, not the agent failing.
    expect(gov.getByText('override rate has risen from 0% to 3% — the delegation may be set wrong')).toBeTruthy()
    expect(gov.getByText('reversal rate has risen from 0% to 3% — the delegation may be set wrong')).toBeTruthy()
    expect(gov.getByText('escalation rate has risen from 10% to 15% — the policy needs updating, not the agent')).toBeTruthy()
  })

  it('PLANT MANAGER hides the signal sections behind the RESTRICTED notice; FC AND ABOVE restores them (§8.8)', () => {
    openRiskControl()
    const m = main()

    fireEvent.click(m.getByRole('button', { name: 'PLANT MANAGER' }))
    expect(screen.getByRole('main').querySelectorAll('section')).toHaveLength(0)
    // The marker now appears twice — banner plus the notice that replaced the content.
    expect(m.getAllByText('RESTRICTED — Financial Controller and above')).toHaveLength(2)
    expect(m.getByText(/restricted to the Financial Controller and above/)).toBeTruthy()

    fireEvent.click(m.getByRole('button', { name: 'FC AND ABOVE' }))
    expect(screen.getByRole('main').querySelectorAll('section')).toHaveLength(7)
    expect(m.getByText('Vendor bank detail changed 3 days before payment run')).toBeTruthy()
  })

  it('restricted content does not leak onto the process cockpit screens (§8.8)', () => {
    window.history.pushState(null, '', '/entity/JGL/p2p')
    render(<App />)
    const t = screen.getByRole('main').textContent ?? ''
    expect(t.includes('SoD conflict')).toBe(false)
    expect(t.includes('bank detail changed')).toBe(false)

    cleanup()
    window.history.pushState(null, '', '/entity/JGL/o2c')
    render(<App />)
    const t2 = screen.getByRole('main').textContent ?? ''
    expect(t2.includes('SoD conflict')).toBe(false)
    expect(t2.includes('bank detail changed')).toBe(false)
  })

  it('is registered in the command palette and navigates on Enter', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const p = screen.getByRole('dialog', { name: 'Command palette' })
    const input = within(p).getByPlaceholderText('Jump to an entity, process, exception or vendor')

    // "risk" matches only the screen item.
    fireEvent.change(input, { target: { value: 'risk' } })
    const rows = within(p).getAllByRole('button')
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Risk & control')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(window.location.pathname).toBe('/risk-control')
  })
})
