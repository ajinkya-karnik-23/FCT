// Drill-path verification driver (headless Chrome + CDP) — spec/08 Part D, step 5.
// Walks the five drill paths in both themes:
//   1. O2C cockpit → Pricing disputes → worklist → AP-104281 → "Why does this keep happening?"
//      must land on Missing GR / P2P (no inherited selection).
//   2. Each of the six O2C taxonomy rows opens its own O2C cause with O2C copy.
//   3. Rail Root cause + entity-home tiles + "Analyse →" land on the default P2P pair,
//      from a cold start and immediately after viewing an O2C cause.
//   4. All twelve process-aware routes load directly from their URL (fresh page load).
//   5. ⌘K lists all twelve ROOT CAUSE entries, six per process, each opening its pair.
// Plus the theme legibility pass: status colors and ageing-bar fills on the O2C cockpit
// and both root-cause variants in dark AND light, and the new nav item's active state
// compared against its P2P sibling. Weak contrast is reported, never adjusted here —
// tokens are shared with every other screen.
//
// Usage:  npm run verify:drills       (dev server must be running on :5200)
// Env overrides: FCT_CHROME / FCT_BASE_URL / FCT_SHOTS_DIR (same as verify-theme.mjs)

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dark, light } from '../src/theme/tokens.ts'

const CHROME = process.env.FCT_CHROME ?? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9334 // separate from verify-theme.mjs so the two can run back to back
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
const FIND_BY_TEXT_JS = `(text) => {
  const els = Array.from(document.querySelectorAll('button, a'))
  const el = els.find((e) => e.textContent.trim().replace(/\\s+/g, ' ').includes(text))
  if (!el) return null
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
