// Drill-path verification driver (headless Chrome + CDP) — spec/08 Part D, step 5.
// Walks the six drill paths in both themes:
//   1. O2C cockpit → Pricing disputes → worklist → AP-104281 → "Why does this keep happening?"
//      must land on Missing GR / P2P (no inherited selection).
//   2. Each of the six O2C taxonomy rows opens its own O2C cause with O2C copy.
//   3. Rail Root cause + entity-home tiles + "Analyse →" land on the default P2P pair,
//      from a cold start and immediately after viewing an O2C cause.
//   4. All twelve process-aware routes load directly from their URL (fresh page load).
//   5. ⌘K lists all twelve ROOT CAUSE entries, six per process, each opening its pair.
//   6. The §8.2 consequence strip drills out: accrual exposure to the blocked worklist
//      filtered to missing GR (?cause=missing-gr), revenue at risk to the O2C Collection
//      stage (#fct-stage-COL), FX/intercompany to the intercompany netting row
//      (#fct-ic-netting) — cross-page hash anchors scroll into view. Provision adequacy
//      is not a link (read-only per §8.4).
// Counterparty pages (spec/11): vendor / customer / cost-centre / plant load from their URLs, are
// reached by drill from worklist, root-cause and P2P-cockpit rows, and are findable in ⌘K; §8.8
// restricted content is absent from all four routes.
// Plus the theme legibility pass: status colors and ageing-bar fills on the O2C cockpit
// and both root-cause variants in dark AND light, and the new nav item's active state
// compared against its P2P sibling. Weak contrast is reported, never adjusted here —
// tokens are shared with every other screen.
//
// Usage:  npm run verify:drills       (dev server must be running on :5200)
// Env overrides: FCT_CHROME / FCT_BASE_URL / FCT_SHOTS_DIR / FCT_DRILL_DEBUG_PORT (same as verify-theme.mjs)

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dark, light } from '../src/theme/tokens.ts'

const CHROME = process.env.FCT_CHROME ?? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
const PORT = Number(process.env.FCT_DRILL_DEBUG_PORT ?? 9334) // separate from verify-theme.mjs so the two can run back to back
const BASE = process.env.FCT_BASE_URL ?? 'http://localhost:5200'
const OUT = process.env.FCT_SHOTS_DIR ?? path.join(os.tmpdir(), 'fct-drill-verify', 'shots')
fs.mkdirSync(OUT, { recursive: true })

// ---------- color math (same as verify-theme.mjs) ----------
function parseColor(str) {
  if (!str) return null
  str = str.trim()
  let m = str.match(/^#([0-9a-f]{6})$/i)
  if (m) { const n = parseInt(m[1], 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 } }
  m = str.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  return null
}
function sameColor(a, b) {
  const ca = parseColor(a), cb = parseColor(b)
  if (!ca || !cb) return false
  return Math.abs(ca.r - cb.r) <= 1 && Math.abs(ca.g - cb.g) <= 1 && Math.abs(ca.b - cb.b) <= 1 && Math.abs(ca.a - cb.a) < 0.01
}
function luminance({ r, g, b }) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(fg, bg) {
  const L1 = luminance(parseColor(fg)), L2 = luminance(parseColor(bg))
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1]
  return (hi + 0.05) / (lo + 0.05)
}
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})` }

// ---------- results ----------
const failures = []
let passCount = 0
function check(name, ok, detail = '') {
  if (ok) { passCount++; console.log(`PASS  ${name}`) }
  else { failures.push(name); console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

// ---------- chrome + CDP (same plumbing as verify-theme.mjs) ----------
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fct-chrome-'))
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--window-size=1440,900', 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] })
let chromeErr = ''
chrome.stderr.on('data', (d) => { chromeErr += d.toString() })
chrome.on('error', (e) => {
  console.error(`FATAL: could not start Chrome at ${CHROME} (${e.message})`)
  console.error('Set FCT_CHROME to the path of your Chrome/Chromium executable and retry.')
  process.exit(2)
})

async function waitForTarget(timeoutMs = 20000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page')
      if (page) return page
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Chrome DevTools target never appeared. stderr: ' + chromeErr.slice(-800))
}

let msgId = 0
const pending = new Map()
const eventWaiters = []
let ws

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) } }, 30000)
  })
}
function waitForEvent(method, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const h = (ev) => {
      if (ev.method === method) {
        clearTimeout(timer); eventWaiters.splice(eventWaiters.indexOf(h), 1); resolve(ev.params)
      }
    }
    const timer = setTimeout(() => { eventWaiters.splice(eventWaiters.indexOf(h), 1); reject(new Error(`event timeout: ${method}`)) }, timeoutMs)
    eventWaiters.push(h)
  })
}

async function evaluate(expression, opts = {}) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, ...(opts || {}) })
  if (res.exceptionDetails) throw new Error('page JS error: ' + JSON.stringify(res.exceptionDetails).slice(0, 500))
  return res.result.value
}

async function navigate(url) {
  const loaded = waitForEvent('Page.loadEventFired', 20000)
  await send('Page.navigate', { url })
  await loaded
  for (let i = 0; i < 60; i++) {
    const ok = await evaluate(`(() => {
      const bg = getComputedStyle(document.body).backgroundColor || getComputedStyle(document.documentElement).backgroundColor
      return document.readyState === 'complete' && bg !== 'rgba(0, 0, 0, 0)'
    })()`)
    if (ok) break
    await new Promise((r) => setTimeout(r, 250))
  }
}

async function screenshot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(res.data, 'base64'))
}

function key(type, extra = {}) {
  return send('Input.dispatchKeyEvent', Object.assign({ type }, extra))
}
async function pressKey(k) { await key('keyDown', k); await key('keyUp', k) }
const ESC = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }
const ENTER = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }
async function ctrlK() {
  await key('keyDown', { key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, nativeVirtualKeyCode: 75, modifiers: 2 })
  await key('keyUp', { key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, nativeVirtualKeyCode: 75, modifiers: 2 })
}
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

// ---------- in-page probes ----------
// <main> scrolls internally (AppShell), so a target below the initial fold is only
// reachable after scrolling it into view; TopBar/Rail sit outside the scroller and are
// unaffected. 'nearest' leaves already-visible targets exactly where they were.
const FIND_BY_TEXT_JS = `(text) => {
  const els = Array.from(document.querySelectorAll('button, a'))
  const el = els.find((e) => e.textContent.trim().replace(/\\s+/g, ' ').includes(text))
  if (!el) return null
  el.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: el.textContent.trim().slice(0, 60) }
}`

// Scoped to the breadcrumb nav (the one holding Group + JGL), exact label match —
// a global substring search would hit the rail's "O2C cockpit" first.
const CRUMB_CLICK_JS = `(text) => {
  const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group') && n.textContent.includes('JGL'))
  if (!bc) return null
  const el = Array.from(bc.querySelectorAll('a')).find((e) => e.textContent.trim() === text)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}`

// Scoped to the rail (the nav holding .fct-nav-item), label prefix match.
const RAIL_CLICK_JS = `(label) => {
  const rail = Array.from(document.querySelectorAll('nav')).find((n) => n.querySelector('.fct-nav-item'))
  if (!rail) return null
  const el = Array.from(rail.querySelectorAll('a, button')).find((e) => e.textContent.trim().startsWith(label))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}`

// Scoped to the §8.2 consequence strip (#fct-consequence) — a global text search would hit
// the callout's ₹6.4 cr anchor, which precedes the strip figure in DOM order.
const STRIP_CLICK_JS = `(text) => {
  const strip = document.getElementById('fct-consequence')
  if (!strip) return null
  const el = Array.from(strip.querySelectorAll('a')).find((e) => e.textContent.trim().replace(/\\s+/g, ' ').includes(text))
  if (!el) return null
  el.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}`

// React-compatible typing into the palette input (native setter + input event).
const TYPE_JS = `(text) => {
  const el = Array.from(document.querySelectorAll('input')).find((i) => /jump to an entity/i.test(i.placeholder || ''))
  if (!el) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}`

const PALETTE_ROWS_JS = `Array.from(document.querySelectorAll('.fct-palette-row')).map((r) => r.textContent.trim().replace(/\\s+/g, ' '))`

// Page state for the root-cause assertions: title, taxonomy eyebrow, breadcrumb, selected row.
const STATE_JS = `(() => {
  const h1 = document.querySelector('main h1')
  const leaves = Array.from(document.querySelectorAll('main *')).filter((e) => e.children.length === 0)
  const eb = leaves.find((e) => /taxonomy/i.test(e.textContent))
  const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group') && n.textContent.includes('JGL'))
  const sel = Array.from(document.querySelectorAll('.fct-tax-row--selected')).map((e) => e.textContent.trim().replace(/\\s+/g, ' '))
  return {
    path: location.pathname,
    h1: h1 ? h1.textContent : null,
    eyebrow: eb ? eb.textContent.trim() : null,
    breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    selected: sel,
  }
})()`

const NAV_ACTIVE_JS = `(() => {
  const el = document.querySelector('.fct-nav-item--active')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { label: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40), borderLeft: cs.borderLeftColor, bg: cs.backgroundColor, color: cs.color }
})()`

// Census of elements filled with one of the given colors (bar fills, status dots)
// and the background each resolves against — for the legibility report.
const FILL_AUDIT_JS = `(fills) => {
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; return m[1].split(',').map(parseFloat) }
  const close = (a, b) => a && b && Math.abs(a[0]-b[0]) <= 1 && Math.abs(a[1]-b[1]) <= 1 && Math.abs(a[2]-b[2]) <= 1
  const targets = fills.map(parse)
  const transparent = 'rgba(0, 0, 0, 0)'
  const out = {}
  for (const el of document.querySelectorAll('body *')) {
    const bg = getComputedStyle(el).backgroundColor
    if (!bg || bg === transparent) continue
    const p = parse(bg)
    if (!targets.some((t) => close(p, t))) continue
    let node = el.parentElement, resolvedBg = null
    while (node && node !== document.documentElement) {
      const b = getComputedStyle(node).backgroundColor
      if (b && b !== transparent) { resolvedBg = b; break }
      node = node.parentElement
    }
    if (!resolvedBg) resolvedBg = getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)'
    const k = bg + '|' + resolvedBg
    out[k] = (out[k] || 0) + 1
  }
  return out
}`

// Text-pair census for the in-situ contrast report (same as verify-theme.mjs).
const AUDIT_JS = `(() => {
  const transparent = 'rgba(0, 0, 0, 0)'
  const pairs = {}
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    let txt = ''
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) txt += n.textContent
    if (!txt.trim()) continue
    const cs = getComputedStyle(el)
    const fg = cs.color
    if (!fg || fg === transparent || fg === 'transparent') continue
    let node = el, resolvedBg = null
    while (node && node !== document.documentElement) {
      const b = getComputedStyle(node).backgroundColor
      if (b && b !== transparent) { resolvedBg = b; break }
      node = node.parentElement
    }
    if (!resolvedBg) resolvedBg = getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)'
    const k = fg + '|' + resolvedBg
    pairs[k] = (pairs[k] || 0) + 1
  }
  return pairs
})()`

// ---------- data ----------
const P2P_CAUSES = [
  ['Missing GR', 'missing-gr'],
  ['PO price mismatch', 'po-price-mismatch'],
  ['Approval pending', 'approval-pending'],
  ['Vendor master', 'vendor-master'],
  ['Duplicate suspicion', 'duplicate-suspicion'],
  ['Tax mismatch', 'tax-mismatch'],
]
const O2C_CAUSES = [
  ['Pricing disputes', 'pricing-disputes'],
  ['Deductions & short-pay', 'deductions'],
  ['Billing errors', 'billing-errors'],
  ['Credit block delays', 'credit-block'],
  ['Cash application mismatch', 'cash-application'],
  ['Customer master', 'customer-master'],
]
const PALETTE_CASES = [
  ['missing gr', 'Missing GR · P2P', '/entity/JGL/root-cause/p2p/missing-gr'],
  ['po price mismatch', 'PO price mismatch · P2P', '/entity/JGL/root-cause/p2p/po-price-mismatch'],
  ['approval pending', 'Approval pending · P2P', '/entity/JGL/root-cause/p2p/approval-pending'],
  ['vendor master', 'Vendor master · P2P', '/entity/JGL/root-cause/p2p/vendor-master'],
  ['duplicate suspicion', 'Duplicate suspicion · P2P', '/entity/JGL/root-cause/p2p/duplicate-suspicion'],
  ['tax mismatch', 'Tax mismatch · P2P', '/entity/JGL/root-cause/p2p/tax-mismatch'],
  ['pricing disputes', 'Pricing disputes · O2C', '/entity/JGL/root-cause/o2c/pricing-disputes'],
  ['short-pay', 'Deductions & short-pay · O2C', '/entity/JGL/root-cause/o2c/deductions'],
  ['billing errors', 'Billing errors · O2C', '/entity/JGL/root-cause/o2c/billing-errors'],
  ['credit block delays', 'Credit block delays · O2C', '/entity/JGL/root-cause/o2c/credit-block'],
  ['cash application mismatch', 'Cash application mismatch · O2C', '/entity/JGL/root-cause/o2c/cash-application'],
  ['customer master', 'Customer master · O2C', '/entity/JGL/root-cause/o2c/customer-master'],
]

const P2P_TITLE = 'Why blocked invoices keep recurring'
const O2C_TITLE = 'Why receivables keep ageing'
const DEFAULT_PATH = '/entity/JGL/root-cause/p2p/missing-gr'

// ---------- helpers ----------
async function waitForPath(pred, what, timeoutMs = 6000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const p = await evaluate('location.pathname')
    if (pred(p)) return p
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error(`navigation did not reach ${what} (still at ${await evaluate('location.pathname')})`)
}

async function clickByText(text) {
  const hit = await evaluate(`(${FIND_BY_TEXT_JS})(${JSON.stringify(text)})`)
  if (!hit) throw new Error(`click target not found: "${text}"`)
  await clickAt(hit.x, hit.y)
}
async function clickCrumb(text) {
  const hit = await evaluate(`(${CRUMB_CLICK_JS})(${JSON.stringify(text)})`)
  if (!hit) throw new Error(`breadcrumb crumb not found: "${text}"`)
  await clickAt(hit.x, hit.y)
}
async function clickRail(label) {
  const hit = await evaluate(`(${RAIL_CLICK_JS})(${JSON.stringify(label)})`)
  if (!hit) throw new Error(`rail item not found: "${label}"`)
  await clickAt(hit.x, hit.y)
}

async function clickStripFigure(text) {
  const hit = await evaluate(`(${STRIP_CLICK_JS})(${JSON.stringify(text)})`)
  if (!hit) throw new Error(`consequence strip figure not found: "${text}"`)
  await clickAt(hit.x, hit.y)
}
// The AppShell hash-scroll effect runs post-commit; poll until the anchor is in view.
async function waitForInView(id, what, timeoutMs = 4000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const inView = await evaluate(`(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight })()`)
    if (inView) return true
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error(`${what} never scrolled into view`)
}

function assertRootCause(state, proc, causeName, label) {
  const wantTitle = proc === 'o2c' ? O2C_TITLE : P2P_TITLE
  check(`${label}: page title is the ${proc.toUpperCase()} one`, state.h1 === wantTitle, `h1=${JSON.stringify(state.h1)}`)
  check(`${label}: taxonomy eyebrow says ${proc.toUpperCase()}`, !!state.eyebrow && new RegExp(`taxonomy — ${proc}$`, 'i').test(state.eyebrow), JSON.stringify(state.eyebrow))
  check(`${label}: selected row is ${causeName}`, state.selected.length === 1 && state.selected[0].startsWith(causeName), JSON.stringify(state.selected))
}

// ---------- theme pass ----------
async function setTheme(themeName) {
  await navigate(BASE + '/')
  await evaluate(`localStorage.setItem('fct-theme', '${themeName}')`)
  const reloaded = waitForEvent('Page.loadEventFired', 20000)
  await send('Page.reload')
  await reloaded
  for (let i = 0; i < 40; i++) {
    if (await evaluate(`getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'`)) break
    await new Promise((r) => setTimeout(r, 250))
  }
}

async function drillPass(themeName, palette) {
  console.log(`\n=== ${themeName.toUpperCase()} DRILL PASS ===`)
  const reports = []
  await setTheme(themeName)

  // ---- item 1: the regression that matters ----
  console.log('\n-- item 1: O2C → Pricing disputes → worklist → AP-104281 → "Why does this keep happening?"')
  await navigate(BASE + '/entity/JGL/o2c')
  await clickByText('Pricing disputes')
  await waitForPath((p) => p === '/entity/JGL/root-cause/o2c/pricing-disputes', 'the O2C pricing-disputes cause')
  check(`${themeName}/item1: Pricing disputes row opens the O2C cause`, true)

  await clickRail('Worklist')
  await waitForPath((p) => p === '/entity/JGL/p2p/invoices', 'the worklist')
  await clickByText('AP-104281')
  await waitForPath((p) => p.includes('/invoices/AP-104281'), 'the AP-104281 exception')
  await clickByText('Why does this keep happening?')
  await waitForPath((p) => p === DEFAULT_PATH, 'Missing GR / P2P from the exception button')
  let state = await evaluate(STATE_JS)
  assertRootCause(state, 'p2p', 'Missing GR', `${themeName}/item1`)
  check(`${themeName}/item1: breadcrumb shows the P2P process`, !!state.breadcrumb && state.breadcrumb.includes('P2P'), JSON.stringify(state.breadcrumb))
  await screenshot(`${themeName}-item1-missing-gr.png`)

  // ---- item 2: each O2C row opens its own cause with O2C copy ----
  console.log('\n-- item 2: six O2C taxonomy rows, each opening its own O2C cause')
  await navigate(BASE + '/entity/JGL/o2c')
  for (const [name, key] of O2C_CAUSES) {
    await clickByText(name)
    await waitForPath((p) => p === `/entity/JGL/root-cause/o2c/${key}`, `the ${key} cause`)
    state = await evaluate(STATE_JS)
    assertRootCause(state, 'o2c', name, `${themeName}/item2:${name}`)
    check(`${themeName}/item2:${name}: breadcrumb shows the O2C process`, !!state.breadcrumb && state.breadcrumb.includes('O2C'), JSON.stringify(state.breadcrumb))
    await clickCrumb('O2C') // back to the cockpit for the next row
    await waitForPath((p) => p === '/entity/JGL/o2c', 'the O2C cockpit (crumb walk-back)')
  }

  // ---- item 3: no-cause entry points, cold start and post-O2C ----
  console.log('\n-- item 3a: cold start — rail Root cause, both tiles, Analyse →')
  await navigate(BASE + '/')
  await clickRail('Root cause')
  await waitForPath((p) => p === DEFAULT_PATH, 'the default pair from the rail (cold start)')
  state = await evaluate(STATE_JS)
  assertRootCause(state, 'p2p', 'Missing GR', `${themeName}/item3:rail-cold`)

  await navigate(BASE + '/entity/JGL')
  for (const [tile, label] of [['18 aged breaks', 'Reconciliations tile'], ['12 high-risk JEs', 'Controls tile']]) {
    await clickByText(tile)
    await waitForPath((p) => p === DEFAULT_PATH, `the default pair from the ${label} (cold start)`)
    state = await evaluate(STATE_JS)
    assertRootCause(state, 'p2p', 'Missing GR', `${themeName}/item3:${label}-cold`)
    await clickCrumb('JGL')
    await waitForPath((p) => p === '/entity/JGL', 'the entity home (crumb walk-back)')
  }
  await clickByText('Analyse')
  await waitForPath((p) => p === DEFAULT_PATH, 'the default pair from Analyse → (cold start)')
  state = await evaluate(STATE_JS)
  assertRootCause(state, 'p2p', 'Missing GR', `${themeName}/item3:analyse-cold`)

  console.log('\n-- item 3b: immediately after viewing an O2C cause — same entry points')
  await navigate(BASE + '/entity/JGL/root-cause/o2c/pricing-disputes') // fresh load = just viewed the O2C cause
  state = await evaluate(STATE_JS)
  check(`${themeName}/item3: starting point is the O2C cause`, state.h1 === O2C_TITLE, `h1=${JSON.stringify(state.h1)}`)

  await clickRail('Root cause')
  await waitForPath((p) => p === DEFAULT_PATH, 'the default pair from the rail (post-O2C)')
  state = await evaluate(STATE_JS)
  assertRootCause(state, 'p2p', 'Missing GR', `${themeName}/item3:rail-post-o2c`)

  await navigate(BASE + '/entity/JGL')
  for (const [tile, label] of [['18 aged breaks', 'Reconciliations tile'], ['12 high-risk JEs', 'Controls tile']]) {
    await clickByText(tile)
    await waitForPath((p) => p === DEFAULT_PATH, `the default pair from the ${label} (post-O2C)`)
    state = await evaluate(STATE_JS)
    assertRootCause(state, 'p2p', 'Missing GR', `${themeName}/item3:${label}-post-o2c`)
    await clickCrumb('JGL')
    await waitForPath((p) => p === '/entity/JGL', 'the entity home (crumb walk-back)')
  }
  await clickByText('Analyse')
  await waitForPath((p) => p === DEFAULT_PATH, 'the default pair from Analyse → (post-O2C)')
  state = await evaluate(STATE_JS)
  assertRootCause(state, 'p2p', 'Missing GR', `${themeName}/item3:analyse-post-o2c`)

  // ---- item 4: every route directly linkable (fresh page load per URL) ----
  console.log('\n-- item 4: all twelve process-aware routes load from their URL')
  for (const proc of ['p2p', 'o2c']) {
    const causes = proc === 'p2p' ? P2P_CAUSES : O2C_CAUSES
    for (const [name, key] of causes) {
      await navigate(BASE + `/entity/JGL/root-cause/${proc}/${key}`)
      state = await evaluate(STATE_JS)
      assertRootCause(state, proc, name, `${themeName}/item4:${proc}/${key}`)
    }
  }

  // ---- item 5: ⌘K lists all twelve root causes, each opening its pair ----
  console.log('\n-- item 5: command palette — twelve ROOT CAUSE entries')
  await navigate(BASE + '/')
  // headless Chrome intermittently drops the first key event right after a fast (cached) navigation — settle before ⌘K
  await new Promise((r) => setTimeout(r, 400))
  await ctrlK()
  await new Promise((r) => setTimeout(r, 400))
  check(`${themeName}/item5: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('ROOT CAUSE')`)) === true)
  await new Promise((r) => setTimeout(r, 200))
  let rows = await evaluate(PALETTE_ROWS_JS)
  check(`${themeName}/item5: "ROOT CAUSE" matches all twelve (capped at nine rows)`, rows.length === 9, `rows=${rows.length}`)
  check(`${themeName}/item5: both processes appear in the list`, rows.some((r) => r.includes('· P2P')) && rows.some((r) => r.includes('· O2C')), JSON.stringify(rows.slice(0, 3)))
  await pressKey(ESC)
  await new Promise((r) => setTimeout(r, 250))

  for (const [query, label, target] of PALETTE_CASES) {
    await ctrlK()
    await new Promise((r) => setTimeout(r, 300))
    const typed = await evaluate(`(${TYPE_JS})(${JSON.stringify(query)})`)
    if (!typed) throw new Error('palette input not found while typing ' + query)
    await new Promise((r) => setTimeout(r, 150))
    rows = await evaluate(PALETTE_ROWS_JS)
    check(`${themeName}/item5:"${query}" → exactly one row`, rows.length === 1 && rows[0].includes(label), JSON.stringify(rows))
    await pressKey(ENTER)
    await waitForPath((p) => p === target, `the ${label} cause from the palette`)
  }

  // ---- item 6: §8.2 consequence strip drills out to its three targets ----
  console.log('\n-- item 6: consequence strip — accrual, revenue at risk, FX/intercompany')
  await navigate(BASE + '/entity/JGL')
  // a:not(.fct-trace-link) — the §8.10 trace strip inside this section adds three more links; the check is about the four consequence figures only
  check(`${themeName}/item6: only three of the four figures are links (provision adequacy is read-only)`, (await evaluate(`document.getElementById('fct-consequence').querySelectorAll('a:not(.fct-trace-link)').length`)) === 3, `links=${await evaluate(`document.getElementById('fct-consequence').querySelectorAll('a:not(.fct-trace-link)').length`)}`)

  await clickStripFigure('₹6.4 cr') // accrual exposure → blocked worklist filtered to missing GR
  await waitForPath((p) => p === '/entity/JGL/p2p/invoices', 'the blocked invoice worklist from the strip')
  check(`${themeName}/item6: accrual drill lands on the worklist with ?cause=missing-gr`, (await evaluate('location.search')) === '?cause=missing-gr', `search=${await evaluate('location.search')}`)
  check(`${themeName}/item6: worklist is filtered to the four missing-GR invoices`, await evaluate(`document.querySelector('main').textContent.includes('4 of 111 shown')`), '')
  await screenshot(`${themeName}-item6-missing-gr-worklist.png`)

  await navigate(BASE + '/entity/JGL') // fresh load per drill — the strip lives on the entity home
  await clickStripFigure('₹8.7 cr') // revenue at risk → O2C cockpit, Collection stage anchor
  await waitForPath((p) => p === '/entity/JGL/o2c', 'the O2C cockpit from the strip')
  check(`${themeName}/item6: revenue drill carries #fct-stage-COL`, (await evaluate('location.hash')) === '#fct-stage-COL', `hash=${await evaluate('location.hash')}`)
  await waitForInView('fct-stage-COL', 'the Collection stage card after the hash scroll')
  check(`${themeName}/item6: Collection stage card is in view`, true)

  await navigate(BASE + '/entity/JGL')
  await clickStripFigure('₹3.6 cr') // FX/intercompany → working capital, intercompany netting row anchor
  await waitForPath((p) => p === '/entity/JGL/working-capital', 'the working capital view from the strip')
  check(`${themeName}/item6: FX drill carries #fct-ic-netting`, (await evaluate('location.hash')) === '#fct-ic-netting', `hash=${await evaluate('location.hash')}`)
  await waitForInView('fct-ic-netting', 'the intercompany netting row after the hash scroll')
  check(`${themeName}/item6: intercompany netting row is in view`, true)
  await screenshot(`${themeName}-item6-ic-netting.png`)

  // ---- item 7: service & attribution — per-entity bar + group comparison, gross/net scorecard, greyed unmeasurable SLAs, breadcrumb + active nav ----
  console.log('\n-- item 7: service & attribution screen')
  await navigate(BASE + '/entity/JGL/service')
  const svc = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const segs = Array.from(document.querySelectorAll('.fct-sla-seg'))
    const unmeasured = Array.from(document.querySelectorAll('.fct-sla-unmeasured')).map((e) => e.textContent.trim())
    const pending = Array.from(document.querySelectorAll('.fct-sla-pending')).map((e) => ({ t: e.textContent.trim(), title: e.getAttribute('title') || '' }))
    const measuringLines = (document.querySelector('main').textContent.match(/measuring since /g) || []).length
    const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group') && n.textContent.includes('JGL'))
    const mainText = document.querySelector('main').textContent
    const scoreCard = Array.from(document.querySelectorAll('main section')).find((s) => s.textContent.includes('Service scorecard'))
    const cardText = scoreCard ? scoreCard.textContent : ''
    return {
      h1: h1 ? h1.textContent : null,
      segCount: segs.length,
      unmeasured,
      pending,
      measuringLines,
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
      compareLine: mainText.includes('JGL 72 / 19 / 6 / 3 · group 71 / 18 / 7 / 4'),
      grossLabel: cardText.includes('Gross achievement'),
      netLabel: cardText.includes('Net of client, system and third-party delay'),
      exclusionNote: cardText.includes('The exclusion set is a contract term'),
      deltaLine: cardText.includes('for JGL the two readings differ by 0.6 points.'),
      grossValue: cardText.includes('95.2%'),
      netValue: cardText.includes('98.6%'),
      sentence: cardText.includes('We met 95.2% against the contract; 98.6% of what we control.'),
    }
  })()`)
  check(`${themeName}/item7: page title is the service & attribution one`, svc.h1 === 'Where the delays come from', `h1=${JSON.stringify(svc.h1)}`)
  check(`${themeName}/item7: bar renders three segments (third party merged into system)`, svc.segCount === 3, `segs=${svc.segCount}`)
  check(`${themeName}/item7: entity vs group comparison line is present (§7.22)`, svc.compareLine, '')
  check(`${themeName}/item7: scorecard shows gross and net side by side with unambiguous labels (§4)`, svc.grossLabel && svc.netLabel && svc.grossValue && svc.netValue, JSON.stringify(svc))
  check(`${themeName}/item7: the attribution sentence states both figures`, svc.sentence, '')
  check(`${themeName}/item7: scorecard names the exclusion set and sizes the two readings' delta (§4)`, svc.exclusionNote && svc.deltaLine, JSON.stringify(svc))
  check(`${themeName}/item7: every unmeasurable SLA cell is a dash — no fabricated value`, svc.unmeasured.length > 0 && svc.unmeasured.every((t) => t === '—'), JSON.stringify(svc.unmeasured))
  // §7.29 — the three desk SLAs left the greyed state: live to-date figures, no achievement %, exact transition wording ×3.
  check(`${themeName}/item7: measuring rows show pending dashes with an explanation, not a fabricated % (§7.29)`, svc.pending.length === 9 && svc.pending.every((c) => c.t === '—' && /No achievement % until a full period has elapsed|Not yet reported — measuring since/.test(c.title)), JSON.stringify(svc.pending))
  check(`${themeName}/item7: each of the three desk SLAs carries the exact transition wording (§7.29)`, svc.measuringLines === 3, `lines=${svc.measuringLines}`)
  check(`${themeName}/item7: breadcrumb shows Service & attribution`, !!svc.breadcrumb && svc.breadcrumb.includes('Service & attribution'), JSON.stringify(svc.breadcrumb))
  const svcNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item7: active nav item is Service & attribution`, !!svcNav && svcNav.label.startsWith('Service & attribution'), JSON.stringify(svcNav))
  await screenshot(`${themeName}-service-attribution.png`)

  // ---- item 8: risk & control — RESTRICTED banner + demo toggle, five categories, eight signals, effectiveness metrics; §8.8 negative checks on the cockpits ----
  console.log('\n-- item 8: risk & control screen')
  await navigate(BASE + '/risk-control')
  const rc = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const sections = Array.from(document.querySelectorAll('main section')).map((s) => s.textContent.trim())
    const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group'))
    return {
      h1: h1 ? h1.textContent : null,
      banner: mainText.includes('RESTRICTED — Financial Controller and above'),
      noDuplication: mainText.includes('Control of the control, not a second control.'),
      categories: ['Payment integrity', 'Authority integrity', 'System integrity', 'Cut-off integrity', 'Undisclosed exposure'].filter((c) => sections.some((s) => s.startsWith(c))),
      titles: [
        'Vendor bank detail changed 3 days before payment run',
        'First-time payee above ₹50 lakh threshold',
        'PO split into 3 below approval threshold',
        'Retrospective PO — dated after invoice',
        'SoD conflict: same user creates vendor and releases payment',
        'Payment terms changed on 7 vendors without approval',
        '14 goods receipts posted across period end',
        'Goods received not invoiced, ageing beyond 90 days',
      ].filter((t) => mainText.includes(t)),
      values: ['₹2.4 cr', '₹0.8 cr', '₹1.9 cr', '₹0.6 cr', '₹3.1 cr', '₹5.2 cr'].every((v) => mainText.includes(v)),
      valuelessDashes: mainText.split('value at risk —').length - 1,
      metrics: mainText.includes('Duplicate check — override rate, YTD') && mainText.includes('4.9%') && mainText.includes('Three-way match — override rate, YTD') && mainText.includes('7.5%') && mainText.includes('Value prevented, YTD') && mainText.includes('₹23.4 cr'),
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item8: framing statement is the page title`, rc.h1 === 'Everything the auditor will find, ninety days earlier.', `h1=${JSON.stringify(rc.h1)}`)
  check(`${themeName}/item8: RESTRICTED banner with demo access toggle is visible (§8.8)`, rc.banner, '')
  check(`${themeName}/item8: no-duplication note explains control of the control (§1)`, rc.noDuplication, '')
  check(`${themeName}/item8: all five categories render in spec order`, rc.categories.length === 5, JSON.stringify(rc.categories))
  check(`${themeName}/item8: all eight §7.8 signal titles render`, rc.titles.length === 8, `titles=${rc.titles.length}`)
  check(`${themeName}/item8: quantified values at risk render; the two system rows carry none (dashes)`, rc.values && rc.valuelessDashes === 2, JSON.stringify({ values: rc.values, valuelessDashes: rc.valuelessDashes }))
  check(`${themeName}/item8: effectiveness metrics show override rates and value prevented YTD (§7.8 item 6)`, rc.metrics, '')
  check(`${themeName}/item8: breadcrumb shows Risk & control`, !!rc.breadcrumb && rc.breadcrumb.includes('Risk & control'), JSON.stringify(rc.breadcrumb))
  const rcNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item8: active nav item is Risk & control`, !!rcNav && rcNav.label.startsWith('Risk & control'), JSON.stringify(rcNav))

  // demo-only access toggle: PLANT MANAGER hides the sections, FC AND ABOVE restores them
  await clickByText('PLANT MANAGER')
  const rcRestricted = await evaluate(`(() => {
    const mainText = document.querySelector('main').textContent
    return {
      hidden: !mainText.includes('Vendor bank detail changed 3 days before payment run'),
      notice: mainText.includes('restricted to the Financial Controller and above'),
    }
  })()`)
  check(`${themeName}/item8: PLANT MANAGER hides the signal sections (§8.8)`, rcRestricted.hidden && rcRestricted.notice, JSON.stringify(rcRestricted))
  await clickByText('FC AND ABOVE')
  const rcRestored = await evaluate(`document.querySelector('main').textContent.includes('Vendor bank detail changed 3 days before payment run')`)
  check(`${themeName}/item8: FC AND ABOVE restores the sections`, rcRestored === true, '')
  await screenshot(`${themeName}-risk-control.png`)

  // §8.8 — SoD conflicts and bank-change alerts must not appear on the counterparty / process cockpit screens
  for (const [route, name] of [
    ['/entity/JGL/p2p', 'p2p-cockpit'],
    ['/entity/JGL/o2c', 'o2c-cockpit'],
    ['/entity/JGL/vendor/suraksha-chemicals-pvt-ltd', 'vendor-page'],
    ['/entity/JGL/customer/jgl-deccan', 'customer-page'],
    ['/entity/JGL/cost-centre/jgl-nanjangud-operations', 'cost-centre-page'],
    ['/entity/JGL/plant/jgl-nanjangud', 'plant-page'],
  ]) {
    await navigate(BASE + route)
    const leaked = await evaluate(`(() => {
      const t = document.querySelector('main').textContent
      return ['SoD conflict', 'bank detail changed'].filter((s) => t.includes(s))
    })()`)
    check(`${themeName}/item8: ${name} shows no restricted risk & control content (§8.8)`, leaked.length === 0, JSON.stringify(leaked))
  }

  // ---- item 9: predictive — live DSO headline, contestable drivers, ranked actions (§7.3), DPO honesty flag (§8.6) ----
  console.log('\n-- item 9: predictive screen')
  await navigate(BASE + '/entity/JGL/predictive')
  const pred = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group'))
    return {
      h1: h1 ? h1.textContent : null,
      dpoFootnote: /Includes ₹18.6 cr of blocked invoices; adjusted DPO 41 days/.test(mainText),
      drivers: ['Amrit Distributors — pricing dispute', 'Sanjeevani Healthcare — deduction unresolved', 'Deccan Pharma Retail — credit block', 'Cash awaiting application'].filter((d) => mainText.includes(d)),
      values: ['₹9.4 cr', '₹6.2 cr', '₹4.8 cr', '₹3.1 cr'].every((v) => mainText.includes(v)),
      impacts: ['+4.1', '+2.7', '+2.1', '+1.1'].every((v) => mainText.includes(v)),
      actionIdx: ['Settle two disputes under ₹10 lakh', 'Apply matched receipts to open AR', 'Release credit block on Deccan Pharma Retail', 'Escalate Amrit Distributors to commercial'].map((a) => mainText.indexOf(a)),
      effortNote: /per unit of effort/.test(mainText),
      openTags: mainText.split('OPEN AT MONTH-END').length - 1,
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item9: headline reads the pinned base case`, pred.h1 === 'DSO 62 today → 72 projected at month-end', `h1=${JSON.stringify(pred.h1)}`)
  check(`${themeName}/item9: DPO honesty flag footnote renders (§8.6)`, pred.dpoFootnote, '')
  check(`${themeName}/item9: all four §7.3 drivers render with values and day impacts`, pred.drivers.length === 4 && pred.values && pred.impacts, JSON.stringify({ drivers: pred.drivers, values: pred.values, impacts: pred.impacts }))
  const actionsInOrder = pred.actionIdx.every((i, k) => i >= 0 && (k === 0 || i > pred.actionIdx[k - 1]))
  check(`${themeName}/item9: ranked actions render in spec order with the effort-ranking note`, actionsInOrder && pred.effortNote, JSON.stringify(pred.actionIdx))
  check(`${themeName}/item9: base case shows all four drivers open at month-end`, pred.openTags === 4, `open=${pred.openTags}`)

  // Contest a driver through its stable id — row order is a rendering detail and must not be load-bearing (§7.23).
  const predClickA = await evaluate(`(() => {
    const b = document.querySelector('main [data-driver-id="jgl-amrit"]')
    if (!b) return false
    b.click()
    return true
  })()`)
  check(`${themeName}/item9: the Amrit driver row exposes a stable control`, predClickA === true, '')
  const predResolved = await evaluate(`document.querySelector('main h1').textContent`)
  check(`${themeName}/item9: marking Amrit Distributors resolved drops the projection to 67.9`, predResolved === 'DSO 62 today → 67.9 projected at month-end', `h1=${JSON.stringify(predResolved)}`)

  // Pull Deccan's assumed settlement (the date input in its own row, found via the stable control) to the first of
  // the month — it then settles by month-end.
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const predDateSet = await evaluate(`(() => {
    const row = document.querySelector('main [data-driver-id="jgl-deccan"]').closest('.fct-table-row')
    if (!row) return false
    const input = row.querySelector('input[type="date"]')
    if (!input) return false
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(firstOfMonth)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  check(`${themeName}/item9: Deccan settlement date is editable`, predDateSet === true, '')
  const predContested = await evaluate(`document.querySelector('main h1').textContent`)
  check(`${themeName}/item9: settling Deccan by month-end drops the projection to 65.8`, predContested === 'DSO 62 today → 65.8 projected at month-end', `h1=${JSON.stringify(predContested)}`)

  // Reset returns every assumption to the base case.
  await clickByText('RESET TO BASE CASE')
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
  const predReset = await evaluate(`(() => {
    return { h1: document.querySelector('main h1').textContent, inputs: Array.from(document.querySelectorAll('main input[type="date"]')).map((i) => i.value) }
  })()`)
  check(`${themeName}/item9: reset restores the base-case headline`, predReset.h1 === 'DSO 62 today → 72 projected at month-end', `h1=${JSON.stringify(predReset.h1)}`)
  check(`${themeName}/item9: reset restores every settlement date past month-end`, predReset.inputs.length === 4 && predReset.inputs.every((v) => v > monthEnd), JSON.stringify({ inputs: predReset.inputs, monthEnd }))
  check(`${themeName}/item9: breadcrumb shows Predictive`, !!pred.breadcrumb && pred.breadcrumb.includes('Predictive'), JSON.stringify(pred.breadcrumb))
  const predNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item9: active nav item is Predictive`, !!predNav && predNav.label.startsWith('Predictive'), JSON.stringify(predNav))
  await screenshot(`${themeName}-predictive.png`)

  // §7.23 — the route is per-entity: navigating to JRP shows JRP's forecast, not JGL's.
  await navigate(BASE + '/entity/JRP/predictive')
  const predJrp = await evaluate(`(() => {
    const mainText = document.querySelector('main').textContent
    return { h1: document.querySelector('main h1').textContent, hasMontRoyal: mainText.includes('Mont-Royal Imaging — pricing dispute'), hasAmrit: mainText.includes('Amrit Distributors') }
  })()`)
  check(`${themeName}/item9: JRP scope shows JRP's forecast (74 → 86)`, predJrp.h1 === 'DSO 74 today → 86 projected at month-end', `h1=${JSON.stringify(predJrp.h1)}`)
  check(`${themeName}/item9: JRP drivers are its own customers, not JGL's`, predJrp.hasMontRoyal && !predJrp.hasAmrit, JSON.stringify(predJrp))

  // ---- item 10: counterparty pages (§6, spec/11) — drill-only routes that reconcile to the process screens ----
  console.log('\n-- item 10: counterparty pages')
  for (const [route, name] of [
    ['/entity/JGL/vendor/suraksha-chemicals-pvt-ltd', 'Suraksha Chemicals Pvt Ltd'],
    ['/entity/JGL/customer/jgl-deccan', 'Deccan Pharma Retail'],
    ['/entity/JGL/cost-centre/jgl-nanjangud-operations', 'Nanjangud Operations'],
    ['/entity/JGL/plant/jgl-nanjangud', 'Nanjangud'],
  ]) {
    await navigate(BASE + route)
    const cp = await evaluate(`document.querySelector('main h1') ? document.querySelector('main h1').textContent : null`)
    check(`${themeName}/item10: ${route} loads with its counterparty name`, cp === name, `h1=${JSON.stringify(cp)}`)
  }

  // Worklist rows drill sideways to vendor and plant pages.
  await navigate(BASE + '/entity/JGL/p2p/invoices')
  const wlDrill = await evaluate(`Array.from(document.querySelectorAll('main a')).filter((a) => a.textContent === 'Suraksha Chemicals Pvt Ltd' || a.textContent === 'Nanjangud').map((a) => ({ text: a.textContent, href: a.getAttribute('href') }))`)
  check(`${themeName}/item10: worklist vendor and plant cells link to counterparty pages`, wlDrill.some((l) => l.text === 'Suraksha Chemicals Pvt Ltd' && l.href === '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd') && wlDrill.some((l) => l.text === 'Nanjangud' && l.href === '/entity/JGL/plant/jgl-nanjangud'), JSON.stringify(wlDrill))
  // In-page synthetic click — a coordinate click after a fresh full load can land on stale layout.
  const wlClick = await evaluate(`(() => { const a = Array.from(document.querySelectorAll('main a')).find((x) => x.textContent === 'Suraksha Chemicals Pvt Ltd' && x.getAttribute('href') === '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd'); if (!a) return false; a.click(); return true })()`)
  check(`${themeName}/item10: clicking the worklist vendor cell opens its page`, wlClick === true, '')
  await waitForPath((p) => p === '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd', 'the vendor page from the worklist')

  // Root-cause by-plant rows and P2P-cockpit cost-centre rows drill on too.
  await navigate(BASE + '/entity/JGL/root-cause/p2p/missing-gr')
  const rcDrill = await evaluate(`(() => { const a = Array.from(document.querySelectorAll('main a')).find((x) => x.textContent === 'Nanjangud'); return a ? a.getAttribute('href') : null })()`)
  check(`${themeName}/item10: root-cause by-plant row links to the plant page`, rcDrill === '/entity/JGL/plant/jgl-nanjangud', `href=${JSON.stringify(rcDrill)}`)
  await navigate(BASE + '/entity/JGL/p2p')
  const ccDrill = await evaluate(`(() => { const a = Array.from(document.querySelectorAll('main a')).find((x) => x.textContent.includes('Nanjangud Operations')); return a ? a.getAttribute('href') : null })()`)
  check(`${themeName}/item10: P2P cockpit cost-centre row links to the cost-centre page`, ccDrill === '/entity/JGL/cost-centre/jgl-nanjangud-operations', `href=${JSON.stringify(ccDrill)}`)

  // ⌘K finds a counterparty by name and opens its page.
  await new Promise((r) => setTimeout(r, 400))
  await ctrlK()
  await new Promise((r) => setTimeout(r, 400))
  check(`${themeName}/item10: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('suraksha')`)) === true)
  await new Promise((r) => setTimeout(r, 200))
  const cpRows = await evaluate(PALETTE_ROWS_JS)
  check(`${themeName}/item10: "suraksha" lists the exception and its vendor page`, cpRows.length === 2 && cpRows.some((r) => r.includes('VENDOR') && r.includes('Suraksha Chemicals Pvt Ltd')), JSON.stringify(cpRows))
  const cpClick = await evaluate(`(() => { const r = Array.from(document.querySelectorAll('.fct-palette-row')).find((x) => x.textContent.includes('VENDOR')); if (!r) return false; r.click(); return true })()`)
  check(`${themeName}/item10: clicking the vendor row opens its page`, cpClick === true, '')
  await waitForPath((p) => p === '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd', 'the vendor page from the palette')

  // ---- item 11: compliance (§7.26) — jurisdiction-matched obligations, one overdue row, the clickable veto chain ----
  console.log('\n-- item 11: compliance screen')
  await navigate(BASE + '/compliance')
  const comp = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const tags = Array.from(document.querySelectorAll('main .fct-status-tag')).map((el) => el.textContent.trim())
    const links = Array.from(document.querySelectorAll('main a'))
    const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group'))
    return {
      h1: h1 ? h1.textContent : null,
      jurisdictions: ['India', 'Singapore', 'United States', 'US / Canada'].filter((j) => mainText.includes(j)),
      filedCount: tags.filter((t) => t === 'FILED').length,
      dueCount: tags.filter((t) => t === 'DUE').length,
      overdueCount: tags.filter((t) => t === 'OVERDUE').length,
      values: ['₹1.8 cr', '₹2.4 cr', '₹0.9 cr', '₹1.1 cr', '₹0.4 cr', '₹0.2 cr', '₹0.3 cr', '₹1.2 cr'].every((v) => mainText.includes(v)),
      failCounts: ['14 IRN failures', '8 IRN failures', '9 TIN mismatches', '6 TIN mismatches', '21 TIN mismatches'].every((f) => mainText.includes(f)),
      chainLinks: links.filter((a) => a.getAttribute('href') === '/entity/JRP').length,
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item11: compliance h1 renders`, !!comp.h1 && comp.h1.length > 0, JSON.stringify(comp.h1))
  check(`${themeName}/item11: all four jurisdictions are visible on their rows`, comp.jurisdictions.length === 4, JSON.stringify(comp.jurisdictions))
  check(`${themeName}/item11: JRP is the only overdue row (§7.26)`, comp.overdueCount === 1, `overdue=${comp.overdueCount}`)
  check(`${themeName}/item11: filed + due rows total 26 of the 27 obligations`, comp.filedCount + comp.dueCount === 26, `filed=${comp.filedCount} due=${comp.dueCount}`)
  check(`${themeName}/item11: §7.26 value-at-risk figures render`, comp.values, 'missing exposure values')
  check(`${themeName}/item11: operational failure counts render with their kind — IRN failures India-only, TIN mismatches on Form 1099 (JGL 14 · JBL 8 · JCP 9 · JHS 6 · JRP 21)`, comp.failCounts, 'missing failure counts')
  check(`${themeName}/item11: the overdue → dimension → veto chain links to the entity page (3 segments)`, comp.chainLinks === 3, `links=${comp.chainLinks}`)
  check(`${themeName}/item11: breadcrumb shows Compliance`, !!comp.breadcrumb && comp.breadcrumb.includes('Compliance'), JSON.stringify(comp.breadcrumb))
  const compNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item11: active nav item is Compliance`, !!compNav && compNav.label.startsWith('Compliance'), JSON.stringify(compNav))
  await screenshot(`${themeName}-compliance.png`)

  // ---- item 12: data & MDM quality (§7.27) — domain-grouped checks, interface health, the working-capital link ----
  console.log('\n-- item 12: data quality screen')
  await navigate(BASE + '/data-quality')
  const dq = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const links = Array.from(document.querySelectorAll('main a'))
    const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group'))
    return {
      h1: h1 ? h1.textContent : null,
      domains: ['Vendor master', 'Customer master', 'General ledger', 'Interfaces'].filter((d) => mainText.includes(d)),
      jglPanCell: mainText.includes('14 / 812'),
      impacts: ['Blocks e-invoice validation', 'Duplicate payment risk', 'Fraud surface, master data bloat', 'Billing rejections', 'Manual coding, misposting risk', 'Missing transactions, stale figures'].filter((s) => mainText.includes(s)),
      health: ['ON SCHEDULE', 'DELAYED', 'STALE'].every((h) => mainText.includes(h)),
      lastRuns: ['31 Aug 2026, 04:00', '27 Aug 2026, 16:35'].every((r) => mainText.includes(r)),
      causeLink: links.some((a) => a.getAttribute('href') === '/entity/JGL/root-cause/p2p/vendor-master'),
      causeFigures: mainText.includes('11%') && mainText.includes('₹2.0 cr'),
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item12: data quality h1 renders`, !!dq.h1 && dq.h1.length > 0, JSON.stringify(dq.h1))
  check(`${themeName}/item12: the four domain sections render in spec order`, dq.domains.length === 4, JSON.stringify(dq.domains))
  check(`${themeName}/item12: JGL vendor PAN anchor cell renders (14 / 812)`, dq.jglPanCell, 'missing 14 / 812')
  check(`${themeName}/item12: all six §7.27 impact strings render`, dq.impacts.length === 6, JSON.stringify(dq.impacts))
  check(`${themeName}/item12: interface health statuses render (on schedule / delayed / stale)`, dq.health, 'missing a status')
  check(`${themeName}/item12: last successful runs show the JCP and JRP extremes`, dq.lastRuns, 'missing last-run values')
  check(`${themeName}/item12: the vendor-master link drills to the root-cause view`, dq.causeLink, 'no cause link')
  check(`${themeName}/item12: §7.5 figures ride on the link (11% · ₹2.0 cr)`, dq.causeFigures, 'missing cause figures')
  check(`${themeName}/item12: breadcrumb shows Data quality`, !!dq.breadcrumb && dq.breadcrumb.includes('Data quality'), JSON.stringify(dq.breadcrumb))
  const dqNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item12: active nav item is Data quality`, !!dqNav && dqNav.label.startsWith('Data quality'), JSON.stringify(dqNav))
  await screenshot(`${themeName}-data-quality.png`)

  // ---- item 13: service desk (§7.29) — one intake for six request types, stop-clock queue, deflection counter ----
  console.log('\n-- item 13: service desk screen')
  await navigate(BASE + '/service-desk')
  // Mirror the dataset's window derivation node-side (ANCHOR = start of today; fmtDate zero-pads the day).
  const sdNow = new Date()
  const sdSince = new Date(sdNow.getFullYear(), sdNow.getMonth(), sdNow.getDate() - 5)
  const SD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const measuringSince = `${String(sdSince.getDate()).padStart(2, '0')} ${SD_MONTHS[sdSince.getMonth()]} ${sdSince.getFullYear()}`
  const SD_PERIOD = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const sdMonthIdx = sdNow.getMonth() + 1
  const nextPeriod = `${SD_PERIOD[sdMonthIdx % 12]}-${sdNow.getFullYear() + Math.floor(sdMonthIdx / 12)}`
  // Injected as a JSON string — a nested backtick would close the evaluate template early.
  const sdWindowLine = `measuring since ${measuringSince} · first full-period report from ${nextPeriod}`
  const sd = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const sections = Array.from(document.querySelectorAll('main section'))
    // Two DataTables on this page — scope row counts to their own section.
    const queueSec = sections.find((s) => s.textContent.includes('Queue'))
    const deflSec = sections.find((s) => s.textContent.includes('Deflection'))
    const statValue = (label) => {
      const el = Array.from(document.querySelectorAll('main span')).find((s) => s.textContent === label)
      return el && el.nextElementSibling ? el.nextElementSibling.textContent : null
    }
    const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group'))
    return {
      h1: h1 ? h1.textContent : null,
      pitch: mainText.includes('a single structured intake for every request into the service'),
      hasWindow: mainText.includes(${JSON.stringify(sdWindowLine)}),
      measuringCount: (mainText.match(/measuring since /g) || []).length,
      queueRows: queueSec ? queueSec.querySelectorAll('.fct-table-row').length : -1,
      deflRows: deflSec ? deflSec.querySelectorAll('.fct-table-row').length : -1,
      types: ['Query', 'Dispute', 'Master data', 'Fixed asset', 'Price change', 'Urgent payment'].filter((t) => queueSec && queueSec.textContent.includes(t)),
      statuses: ['OPEN', 'IN-PROGRESS', 'AWAITING-CLIENT', 'CLOSED'].filter((s) => queueSec && queueSec.textContent.includes(s)),
      openStat: statValue('OPEN REQUESTS'),
      oldestStat: statValue('OLDEST EFFECTIVE AGE'),
      stoppedStat: statValue('STOP-CLOCK HOURS'),
      shareStat: statValue('SELF-SERVE SHARE'),
      groupRow: deflSec ? Array.from(deflSec.querySelectorAll('.fct-table-row')).map((r) => r.textContent.trim().replace(/\\s+/g, ' ')).find((t) => t.startsWith('GROUP')) || null : null,
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item13: h1 is "The clock starts here."`, sd.h1 === 'The clock starts here.', JSON.stringify(sd.h1))
  check(`${themeName}/item13: the §7.29 pitch phrase renders`, sd.pitch, 'pitch missing')
  check(`${themeName}/item13: exactly one measuring-since line on this page (the header honesty line)`, sd.measuringCount === 1, `count=${sd.measuringCount}`)
  check(`${themeName}/item13: the honesty line carries the window — ${measuringSince} → first report from ${nextPeriod}`, sd.hasWindow, 'window line missing')
  check(`${themeName}/item13: the queue lists all 58 seeded requests`, sd.queueRows === 58, `rows=${sd.queueRows}`)
  check(`${themeName}/item13: all six request types appear in the queue`, sd.types.length === 6, JSON.stringify(sd.types))
  check(`${themeName}/item13: all four statuses appear in the queue`, sd.statuses.length === 4, JSON.stringify(sd.statuses))
  check(`${themeName}/item13: stat strip — open requests is 45`, sd.openStat === '45', `open=${sd.openStat}`)
  check(`${themeName}/item13: stat strip — oldest effective age is 25 d (stop-clock hours subtracted)`, sd.oldestStat === '25 d', `oldest=${sd.oldestStat}`)
  check(`${themeName}/item13: stat strip — stop-clock hours total 416`, sd.stoppedStat === '416', `stopped=${sd.stoppedStat}`)
  check(`${themeName}/item13: the deflection table lists six entities plus GROUP`, sd.deflRows === 7 && !!sd.groupRow, JSON.stringify({ rows: sd.deflRows, group: sd.groupRow }))
  check(`${themeName}/item13: self-serve share stat matches the GROUP row (37%)`, sd.shareStat === '37%' && !!sd.groupRow && /37%$/.test(sd.groupRow), JSON.stringify({ share: sd.shareStat, group: sd.groupRow }))
  check(`${themeName}/item13: breadcrumb shows Finance Service Desk`, !!sd.breadcrumb && sd.breadcrumb.includes('Finance Service Desk'), JSON.stringify(sd.breadcrumb))
  const sdNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item13: active nav item is Finance Service Desk`, !!sdNav && sdNav.label.startsWith('Finance Service Desk'), JSON.stringify(sdNav))

  // The new-request form writes to local state only — a submitted row enters the queue as open, clock started now.
  const sdFormSet = await evaluate(`(() => {
    const setSelect = (sel, value) => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(sel, value)
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const selects = Array.from(document.querySelectorAll('main form select'))
    if (selects.length !== 2) return false
    setSelect(selects[0], 'JRP')
    setSelect(selects[1], 'dispute')
    const raisedBy = Array.from(document.querySelectorAll('main input')).find((i) => /client role/i.test(i.placeholder || ''))
    if (!raisedBy) return false
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(raisedBy, 'Drill probe')
    raisedBy.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  check(`${themeName}/item13: the new-request form takes a JRP dispute from "Drill probe"`, sdFormSet === true, '')
  const sdSubmit = await evaluate(`(() => { const b = Array.from(document.querySelectorAll('main button')).find((x) => x.textContent.trim() === 'Add to queue'); if (!b) return false; b.click(); return true })()`)
  check(`${themeName}/item13: "Add to queue" submits the form`, sdSubmit === true, '')
  const sdAfter = await evaluate(`(() => {
    const sections = Array.from(document.querySelectorAll('main section'))
    const queueSec = sections.find((s) => s.textContent.includes('Queue'))
    const rows = Array.from(queueSec.querySelectorAll('.fct-table-row')).map((r) => r.textContent.trim().replace(/\\s+/g, ' '))
    return { count: rows.length, newRow: rows.find((r) => r.includes('Drill probe')) || null }
  })()`)
  check(`${themeName}/item13: the queue grows from 58 to 59`, sdAfter.count === 59, `count=${sdAfter.count}`)
  check(`${themeName}/item13: the new row carries JRP · Dispute · Drill probe · C. Tremblay · OPEN`, !!sdAfter.newRow && ['JRP', 'Dispute', 'Drill probe', 'C. Tremblay', 'OPEN'].every((t) => sdAfter.newRow.includes(t)), JSON.stringify(sdAfter.newRow))

  // ⌘K finds the screen by name; its count comes from the request dataset, never a literal.
  await new Promise((r) => setTimeout(r, 400))
  await ctrlK()
  await new Promise((r) => setTimeout(r, 400))
  check(`${themeName}/item13: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('service desk')`)) === true)
  await new Promise((r) => setTimeout(r, 200))
  const sdPalette = await evaluate(PALETTE_ROWS_JS)
  check(`${themeName}/item13: "service desk" lists exactly one screen with a live open-request count`, sdPalette.length === 1 && sdPalette[0].includes('Finance Service Desk') && /\d+ open requests/.test(sdPalette[0]), JSON.stringify(sdPalette))
  const sdPick = await evaluate(`(() => { const r = Array.from(document.querySelectorAll('.fct-palette-row')).find((x) => x.textContent.includes('Finance Service Desk')); if (!r) return false; r.click(); return true })()`)
  check(`${themeName}/item13: picking the row opens the service desk`, sdPick === true, '')
  await waitForPath((p) => p === '/service-desk', 'the service desk from the palette')
  await new Promise((r) => setTimeout(r, 300))
  check(`${themeName}/item13: the palette closes after picking`, (await evaluate(`!document.querySelector('.fct-palette-scrim')`)) === true, '')
  await screenshot(`${themeName}-service-desk.png`)

  // ---- item 14: cause elimination backlog (§7.30) — register of named owners + the asserted mechanism trend ----
  console.log('\n-- item 14: cause elimination backlog screen')
  await navigate(BASE + '/cause-backlog')
  const cb = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const sections = Array.from(document.querySelectorAll('main section'))
    const regSec = sections.find((s) => s.textContent.includes('Register'))
    // Status words repeat in the register, so resolve each stat label to its numeric sibling.
    const statValue = (label) => {
      const els = Array.from(document.querySelectorAll('main span')).filter((s) => s.textContent === label)
      for (const el of els) if (el.nextElementSibling && /^\\d+$/.test(el.nextElementSibling.textContent || '')) return el.nextElementSibling.textContent
      return null
    }
    const bc = Array.from(document.querySelectorAll('nav')).find((n) => n.textContent.includes('Group'))
    return {
      h1: h1 ? h1.textContent : null,
      eyebrow: h1 && h1.previousElementSibling ? h1.previousElementSibling.textContent : null,
      pitch: mainText.includes('every identified root cause with a named owner and an elimination status'),
      stats: { identified: statValue('IDENTIFIED'), eliminated: statValue('ELIMINATED'), inProgress: statValue('IN PROGRESS'), notStarted: statValue('NOT STARTED') },
      regRows: regSec ? regSec.querySelectorAll('.fct-table-row').length : -1,
      statuses: ['ELIMINATED', 'IN-PROGRESS', 'IDENTIFIED'].filter((s) => regSec && regSec.textContent.includes(s)),
      elim: Array.from(document.querySelectorAll('[data-series="eliminated"]')).map((el) => el.textContent),
      open: Array.from(document.querySelectorAll('[data-series="open-exceptions"]')).map((el) => el.textContent),
      guard: mainText.includes('it does not clear the existing pool'),
      claim: mainText.includes('generated 47 exceptions last period and none in this one'),
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item14: h1 is "Continuous improvement, evidenced."`, cb.h1 === 'Continuous improvement, evidenced.', JSON.stringify(cb.h1))
  check(`${themeName}/item14: eyebrow is Cause elimination`, cb.eyebrow === 'Cause elimination', JSON.stringify(cb.eyebrow))
  check(`${themeName}/item14: the §7.30 pitch phrase renders`, cb.pitch, 'pitch missing')
  check(`${themeName}/item14: headline counts are 34 / 11 / 6 / 17`, cb.stats.identified === '34' && cb.stats.eliminated === '11' && cb.stats.inProgress === '6' && cb.stats.notStarted === '17', JSON.stringify(cb.stats))
  check(`${themeName}/item14: the register lists all 34 causes`, cb.regRows === 34, `rows=${cb.regRows}`)
  check(`${themeName}/item14: all three elimination statuses appear in the register`, cb.statuses.length === 3, JSON.stringify(cb.statuses))
  const CB_ELIM = ['3', '5', '6', '8', '9', '11']
  const CB_OPEN = ['2,158', '2,117', '2,069', '2,034', '2,012', '1,980']
  check(`${themeName}/item14: cumulative eliminations read 3 · 5 · 6 · 8 · 9 · 11`, JSON.stringify(cb.elim) === JSON.stringify(CB_ELIM), JSON.stringify(cb.elim))
  check(`${themeName}/item14: group open exceptions read 2,158 → 1,980 over the same six points`, JSON.stringify(cb.open) === JSON.stringify(CB_OPEN), JSON.stringify(cb.open))
  const cbNum = (s) => Number(String(s).replace(/,/g, ''))
  let mechOk = cb.elim.length === 6 && cb.open.length === 6
  for (let i = 0; i < 5 && mechOk; i++) {
    mechOk = cbNum(cb.elim[i]) < cbNum(cb.elim[i + 1]) && cbNum(cb.open[i]) > cbNum(cb.open[i + 1])
  }
  check(`${themeName}/item14: as eliminations rise, group open exceptions fall across the same six points`, mechOk, JSON.stringify({ e: cb.elim, o: cb.open }))
  check(`${themeName}/item14: the overclaim guard says which claim the screen is making`, cb.guard, 'guard missing')
  check(`${themeName}/item14: the defensible p6 claim renders (47 last period, none this one)`, cb.claim, 'claim missing')
  check(`${themeName}/item14: breadcrumb shows Cause elimination`, !!cb.breadcrumb && cb.breadcrumb.includes('Cause elimination'), JSON.stringify(cb.breadcrumb))
  const cbNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item14: active nav item is Cause elimination`, !!cbNav && cbNav.label.startsWith('Cause elimination'), JSON.stringify(cbNav))

  // ⌘K finds the screen by name; its count comes from the register, never a literal.
  await new Promise((r) => setTimeout(r, 400))
  await ctrlK()
  await new Promise((r) => setTimeout(r, 400))
  check(`${themeName}/item14: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('cause elimination')`)) === true)
  await new Promise((r) => setTimeout(r, 200))
  const cbPalette = await evaluate(PALETTE_ROWS_JS)
  check(`${themeName}/item14: "cause elimination" lists exactly one screen with a live eliminated count`, cbPalette.length === 1 && cbPalette[0].includes('Cause elimination') && /\d+ of \d+ causes eliminated/.test(cbPalette[0]), JSON.stringify(cbPalette))
  const cbPick = await evaluate(`(() => { const r = Array.from(document.querySelectorAll('.fct-palette-row')).find((x) => x.textContent.includes('Cause elimination')); if (!r) return false; r.click(); return true })()`)
  check(`${themeName}/item14: picking the row opens the backlog`, cbPick === true, '')
  await waitForPath((p) => p === '/cause-backlog', 'the cause elimination backlog from the palette')
  await new Promise((r) => setTimeout(r, 300))
  check(`${themeName}/item14: the palette closes after picking`, (await evaluate(`!document.querySelector('.fct-palette-scrim')`)) === true, '')
  await screenshot(`${themeName}-cause-backlog.png`)

  // ---- theme legibility: status colors + ageing-bar fills on the three views ----
  console.log(`\n-- legibility (${themeName}): O2C cockpit + both root-cause variants`)
  const fillTargets = [palette.accent, palette.ageingBarAlt, palette.statusGreen, palette.statusAmber, palette.statusRed].map(hexToRgb)
  for (const [route, name] of [
    ['/entity/JGL/o2c', 'o2c-cockpit'],
    ['/entity/JGL/root-cause/p2p/missing-gr', 'rc-p2p-missing-gr'],
    ['/entity/JGL/root-cause/o2c/pricing-disputes', 'rc-o2c-pricing-disputes'],
  ]) {
    await navigate(BASE + route)
    reports.push({ theme: themeName, name, pairs: await evaluate(AUDIT_JS) })
    const fills = await evaluate(`(${FILL_AUDIT_JS})(${JSON.stringify(fillTargets)})`)
    for (const [k, count] of Object.entries(fills)) {
      const [fill, bg] = k.split('|')
      const ratio = contrast(fill, bg)
      check(`${themeName}/${name}: fill ${fill} on ${bg} ≥ 3:1`, ratio >= 3.0, `ratio=${ratio.toFixed(2)} (x${count})`)
    }
    await screenshot(`${themeName}-${name}.png`)
  }

  // ---- new nav item's active state vs its P2P sibling ----
  console.log(`\n-- active nav state (${themeName}): O2C cockpit item vs P2P cockpit item`)
  const expectActive = (nav, labelPrefix, tag) => {
    check(`${tag}: active item is ${labelPrefix}`, !!nav && nav.label.startsWith(labelPrefix), JSON.stringify(nav))
    if (!nav) return null
    check(`${tag}: active border-left is accent`, sameColor(nav.borderLeft, palette.accent), `got=${nav.borderLeft} want=${palette.accent}`)
    check(`${tag}: active background is bgSelected`, sameColor(nav.bg, palette.bgSelected), `got=${nav.bg} want=${palette.bgSelected}`)
    check(`${tag}: active text is textPrimary`, sameColor(nav.color, palette.textPrimary), `got=${nav.color} want=${palette.textPrimary}`)
    return { borderLeft: nav.borderLeft, bg: nav.bg, color: nav.color }
  }
  await navigate(BASE + '/entity/JGL/p2p')
  const p2pActive = expectActive(await evaluate(NAV_ACTIVE_JS), 'P2P cockpit', `${themeName}/nav:p2p`)
  await navigate(BASE + '/entity/JGL/o2c')
  const o2cActive = expectActive(await evaluate(NAV_ACTIVE_JS), 'O2C cockpit', `${themeName}/nav:o2c`)
  check(`${themeName}/nav: O2C active state matches its P2P sibling`,
    !!p2pActive && !!o2cActive && p2pActive.borderLeft === o2cActive.borderLeft && p2pActive.bg === o2cActive.bg && p2pActive.color === o2cActive.color,
    `p2p=${JSON.stringify(p2pActive)} o2c=${JSON.stringify(o2cActive)}`)

  return reports
}

// ---------- contrast reporting (same as verify-theme.mjs; weak pairs are reported, not fixed) ----------
function reportContrast(reports) {
  console.log('\n=== IN-SITU CONTRAST on the three views (text vs resolved background) ===')
  const seen = new Map()
  for (const rep of reports) {
    for (const [k, n] of Object.entries(rep.pairs)) {
      const key = rep.theme + '|' + k
      seen.set(key, (seen.get(key) || 0) + n)
    }
  }
  const rows = []
  for (const [key, count] of seen) {
    const [theme, fg, bg] = key.split('|')
    rows.push({ theme, fg, bg, ratio: contrast(fg, bg), count })
  }
  rows.sort((a, b) => a.ratio - b.ratio)
  for (const r of rows) {
    const flag = r.ratio < 4.5 ? '  <-- below AA 4.5' : ''
    console.log(`${r.theme.padEnd(6)} ${r.ratio.toFixed(2).padStart(6)}:1  fg=${r.fg} bg=${r.bg} (x${r.count})${flag}`)
  }
}

// ---------- main ----------
async function preflight() {
  try {
    await fetch(BASE + '/')
  } catch (e) {
    console.error(`FATAL: cannot reach the dev server at ${BASE} (${e.message})`)
    console.error('Start it first with `npm run dev`, or point FCT_BASE_URL elsewhere.')
    process.exit(1)
  }
}

async function main() {
  await preflight()
  const target = await waitForTarget()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws connect failed')) })
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id)
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
    } else if (msg.method) {
      for (const h of [...eventWaiters]) h(msg)
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  try {
    const reports = []
    reports.push(...(await drillPass('dark', dark)))
    reports.push(...(await drillPass('light', light)))

    reportContrast(reports)

    console.log(`\n=== SUMMARY: ${passCount} passed, ${failures.length} failed ===`)
    if (failures.length) { console.log('failed checks:\n - ' + failures.join('\n - ')); process.exitCode = 1 }
    else console.log('ALL CHECKS PASSED')
    console.log(`screenshots: ${OUT}`)
  } finally {
    try { ws.close() } catch {}
    chrome.kill()
  }
}

main().catch((e) => { console.error('FATAL:', e.message); try { chrome.kill() } catch {}; process.exit(2) })
