// Drill-path verification driver (headless Chrome + CDP) — spec/08 Part D, step 5.
// Walks the drill paths in both themes:
//   1. O2C cockpit → Pricing disputes → register section (?cause=pricing-disputes), then worklist →
//      AP-104281 → "Why does this keep happening?" must land on the missing-GR section (no inherited selection).
//   2. Each of the six O2C taxonomy rows opens its own section of the root cause register (§17).
//   3. Rail Root causes + entity-home tiles + "Analyse →" land on the full register,
//      from a cold start and immediately after viewing a cause section.
//   4. All twelve ?cause= deep links load directly from their URL (fresh page load); R2R keys fall back to the full register (§17.6).
//   5. ⌘K lists all twenty ROOT CAUSE entries, each opening its register section (or the full register for R2R).
//   6. The §8.2 consequence strip drills out: accrual exposure to the blocked worklist
//      filtered to missing GR (?cause=missing-gr), revenue at risk to the O2C worklist
//      filtered to disputes and credit blocks (§18.3), provision adequacy to the R2R accruals panel
//      (#fct-panel-accruals), FX/intercompany to the intercompany netting row
//      (#fct-ic-netting) — cross-page hash anchors scroll into view. All four figures are links,
//      and the entity-home Close tile reaches the same close calendar as a second entry point.
// Counterparty pages (spec/11): vendor / customer / cost-centre / plant load from their URLs, are
// reached by drill from worklist and P2P-cockpit rows, and are findable in ⌘K; §8.8
// restricted content is absent from all four routes.
// Plus the theme legibility pass: status colors and ageing-bar fills on the O2C and R2R cockpits
// (the register carries no fill-coloured elements — it is contrast-audited only) in dark AND light,
// and the new nav item's active state compared against its P2P sibling. Weak contrast is reported, never adjusted here —
// tokens are shared with every other screen.
//
// Usage:  npm run verify:drills       (dev server must be running on :5200)
// Env overrides: FCT_CHROME / FCT_BASE_URL / FCT_SHOTS_DIR / FCT_DRILL_DEBUG_PORT (same as verify-theme.mjs)

// Two escaping traps, both of which have cost a session:
// - `\d` inside a direct regex literal matches a literal backslash-d. Use `\d` only in strings passed to `new RegExp()`.
// - Never nest template literals inside `evaluate()`. Build the string node-side and inject it with `JSON.stringify`.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dark, light } from '../src/theme/tokens.ts'
// The api barrel uses Vite-style extensionless imports that raw Node cannot resolve, so item 19 reads the cause
// taxonomy straight from its mock module (type-only imports — runtime-clean) and pins register facts as literals.
import { causes } from '../src/api/mock/causes.ts'
import { entities } from '../src/api/mock/entities.ts'
import { formatCr } from '../src/lib/format.ts'

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

// The app is ready when its shell has rendered AND no boot overlay sits over it. A painted background
// (or readyState) only proves the document loaded: the splash (first load of a session, up to ~900ms)
// intercepts every pointer event while it is up — auditing through it produces blank captures and dead clicks.
async function waitForApp(timeoutMs = 20000) {
  const t0 = Date.now()
  let shellUp = false
  while (Date.now() - t0 < timeoutMs) {
    if ((shellUp = await evaluate(`!!document.querySelector('nav[aria-label="Primary"], nav[aria-label="Breadcrumb"]')`))) break
    await sleep(250)
  }
  if (!shellUp) throw new Error('app shell never appeared — no rail or breadcrumb in the DOM')
  const s0 = Date.now()
  while (await evaluate(`!!document.querySelector('.splash-title')`)) {
    if (Date.now() - s0 > 5000) throw new Error('splash never dismissed — .splash-title still in the DOM after the shell rendered')
    await sleep(100)
  }
}

// Navigate to a full URL and wait for the app to have committed the target route: document loaded,
// shell up (and splash gone), URL matches pathname AND search, <main> rendered with content, DOM settled.
// A URL change is not a render — React commits after it (~130ms measured) — so "the URL flipped" is never enough.
async function goTo(url) {
  const loaded = waitForEvent('Page.loadEventFired', 20000)
  await send('Page.navigate', { url })
  await loaded
  await waitForApp()
  const u = new URL(url)
  await waitForUrl(u.pathname + u.search, `goTo ${url}`)
  await installSettle()
  const m0 = Date.now()
  while (true) {
    if (Date.now() - m0 > 10000) throw new Error(`goTo ${url}: <main> never rendered with content`)
    if (await evaluate(`!!(document.querySelector('main') && document.querySelector('main').textContent.trim())`)) break
    await sleep(60)
  }
  await waitForCommit(`goTo ${url}`)
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

// ---------- in-page probes ----------
// One resolver for every click target — no per-probe coordinate math. A string is a CSS selector; an
// object may carry css (a plain selector) and/or find the first element in scope whose text matches
// (match: includes | exact | prefix). With rowText, the search runs inside the first row (q.rows ||
// '.fct-table-row') whose own text contains it — for targets that are only addressable through their
// ancestor. xf places the click at a fraction of the element's width (default 0.5) — needed where an
// element is dual-purpose and its centre sits on a nested anchor: the cash-attribution bands select in
// place anywhere but their name, which drills to the register (§8.4). <main> scrolls internally
// (AppShell), so a target below the initial fold is only reachable after scrolling it into view;
// 'nearest' leaves already-visible targets exactly where they were. The element must be visible with a
// non-zero box AND topmost at its own centre — something parked over it (a fading overlay, layout that
// has grown) reads as "not actionable yet" and the caller keeps waiting.
const RESOLVE_TARGET_JS = `(q) => {
  const norm = (t) => t.trim().replace(/\\s+/g, ' ')
  let el
  if (typeof q === 'string') el = document.querySelector(q)
  else if (q.css) el = document.querySelector(q.css)
  else {
    let root = document
    if (q.scope) { const s = document.querySelector(q.scope); if (!s) return null; root = s }
    if (q.rowText) {
      const rows = Array.from(root.querySelectorAll(q.rows || '.fct-table-row'))
      const row = rows.find((e) => norm(e.textContent).includes(q.rowText))
      if (!row) return null
      root = row
    }
    const els = Array.from(root.querySelectorAll(q.tags || 'button, a'))
    if (!q.text) el = els[0]
    else if (q.match === 'exact') el = els.find((e) => norm(e.textContent) === q.text)
    else if (q.match === 'prefix') el = els.find((e) => norm(e.textContent).startsWith(q.text))
    else el = els.find((e) => norm(e.textContent).includes(q.text))
  }
  if (!el) return null
  el.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return null
  let x, y
  // SVG is hit-tested per painted region — a text element's box centre can fall in an inter-glyph gap and
  // the point falls through to whatever is behind. For SVG text, aim at the first character's own box.
  if (typeof el.getExtentOfChar === 'function' && (el.textContent || '').trim()) {
    const ext = el.getExtentOfChar(0)
    const m = el.getScreenCTM()
    if (m) { const p = new DOMPoint(ext.x + ext.width / 2, ext.y + ext.height / 2).matrixTransform(m); x = p.x; y = p.y }
  }
  if (x == null) {
    const xf = (q && typeof q === 'object' && q.xf != null) ? q.xf : 0.5
    x = r.x + r.width * xf; y = r.y + r.height / 2
  }
  const at = document.elementFromPoint(x, y)
  if (!at || !(el === at || el.contains(at))) return null
  return { x, y }
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

// Page state for the register assertions (§17): title, breadcrumb, filter selects, row count, mechanism grid.
const REGISTER_STATE_JS = `(() => {
  const h1 = document.querySelector('main h1')
  const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
  const leaves = Array.from(document.querySelectorAll('main *')).filter((e) => e.children.length === 0)
  const countLabel = (leaves.find((e) => /root causes$/.test(e.textContent.trim())) || {}).textContent || null
  const selects = Array.from(document.querySelectorAll('main select.fct-input'))
  return {
    path: location.pathname + location.search,
    h1: h1 ? h1.textContent : null,
    breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    countLabel,
    process: selects[0] ? selects[0].value : null,
    cause: selects[1] ? selects[1].value : null,
    entity: selects[2] ? selects[2].value : null,
    rowCount: document.querySelectorAll('main .fct-table-row').length,
    mechRows: document.querySelectorAll('main .fct-mech-row').length,
  }
})()`

const NAV_ACTIVE_JS = `(() => {
  const el = document.querySelector('.fct-nav-item--active')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { label: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40), borderLeftW: cs.borderLeftWidth, bg: cs.backgroundColor, color: cs.color }
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
// §6.1 — the R2R taxonomy (8); names and keys must match causes.ts exactly, or item4's selected-row check fails.
const R2R_CAUSES = [
  ['Reconciliation breaks', 'reconciliation'],
  ['Interface breaks', 'interface'],
  ['Journal risk', 'journal'],
  ['Close dependencies', 'close-dependency'],
  ['Source data', 'source-data'],
  ['Intercompany', 'intercompany'],
  ['Judgement', 'judgement'],
  ['Master data', 'master-data'],
]
// §17 — every palette cause row opens the register: a ?cause= section for P2P/O2C, the full register for R2R (§17.6).
const PALETTE_CASES = [
  ['missing gr', 'Missing GR · P2P', '/root-causes?cause=missing-gr'],
  ['po price mismatch', 'PO price mismatch · P2P', '/root-causes?cause=po-price-mismatch'],
  ['approval pending', 'Approval pending · P2P', '/root-causes?cause=approval-pending'],
  ['vendor master', 'Vendor master · P2P', '/root-causes?cause=vendor-master'],
  ['duplicate suspicion', 'Duplicate suspicion · P2P', '/root-causes?cause=duplicate-suspicion'],
  ['tax mismatch', 'Tax mismatch · P2P', '/root-causes?cause=tax-mismatch'],
  ['pricing disputes', 'Pricing disputes · O2C', '/root-causes?cause=pricing-disputes'],
  ['short-pay', 'Deductions & short-pay · O2C', '/root-causes?cause=deductions'],
  ['billing errors', 'Billing errors · O2C', '/root-causes?cause=billing-errors'],
  ['credit block delays', 'Credit block delays · O2C', '/root-causes?cause=credit-block'],
  ['cash application mismatch', 'Cash application mismatch · O2C', '/root-causes?cause=cash-application'],
  ['customer master', 'Customer master · O2C', '/root-causes?cause=customer-master'],
  // §6.1 — the R2R taxonomy; each query is unique across all twenty causes plus the screen rows, except
  // 'master data' (agent #2) and 'intercompany' (agent #20), which also match an agent's record (§15/§16.6) —
  // root causes sort before agents, so they stay first. R2R keys carry no register section yet, so the row lands on the full register.
  ['reconciliation breaks', 'Reconciliation breaks · R2R', '/root-causes?cause=reconciliation'],
  ['interface breaks', 'Interface breaks · R2R', '/root-causes?cause=interface'],
  ['journal risk', 'Journal risk · R2R', '/root-causes?cause=journal'],
  ['close dependencies', 'Close dependencies · R2R', '/root-causes?cause=close-dependency'],
  ['source data', 'Source data · R2R', '/root-causes?cause=source-data'],
  ['intercompany', 'Intercompany · R2R', '/root-causes?cause=intercompany'],
  ['judgement', 'Judgement · R2R', '/root-causes?cause=judgement'],
  ['master data', 'Master data · R2R', '/root-causes?cause=master-data'],
]

const DEFAULT_PATH = '/root-causes'

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The commit detector — installed once per document (reinstall after every full load). A URL flip is
// not a render: React commits ~130ms after it, and a commit that is scheduled but not yet run must not
// read as "settled". The app has committed when the DOM has been mutation-quiet for QUIET_MS and at
// least MIN_SETTLE_MS have elapsed. Every navigation (goTo) and click (clickOn) ends in this wait —
// nothing acts on a page that has not committed.
const SETTLE_INSTALL_JS = `(() => {
  if (window.__fctSettle) return true
  window.__fctLastMut = Date.now()
  const obs = new MutationObserver(() => { window.__fctLastMut = Date.now() })
  obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
  window.__fctSettle = true
  return true
})()`

const QUIET_MS = 200
const MIN_SETTLE_MS = 300

async function installSettle() { await evaluate(SETTLE_INSTALL_JS) }

// Wait until the page has committed. Tolerates a mid-navigation document swap (a probe that fails is
// "not settled yet", not an error). Times out and fails with what it was waiting for — a silent hang
// is worse than a failure.
async function waitForCommit(what, timeoutMs = 8000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    let quietFor = null
    try { quietFor = await evaluate(`Date.now() - (window.__fctLastMut || 0)`) } catch { /* document mid-swap */ }
    if (quietFor !== null && quietFor >= QUIET_MS && Date.now() - t0 >= MIN_SETTLE_MS) return
    await sleep(60)
  }
  throw new Error(`waitForCommit: app never settled — ${what}`)
}

async function waitForPath(pred, what, timeoutMs = 6000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const p = await evaluate('location.pathname')
    if (pred(p)) return p
    await sleep(120)
  }
  throw new Error(`navigation did not reach ${what} (still at ${await evaluate('location.pathname')})`)
}

// The register's deep links live in the query string — pathname alone cannot tell a section from the full register.
async function waitForUrl(url, what, timeoutMs = 6000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const u = await evaluate('location.pathname + location.search')
    if (u === url) return u
    await sleep(120)
  }
  throw new Error(`navigation did not reach ${what} (still at ${await evaluate('location.pathname + location.search')})`)
}

// Scroll the target into view, wait until it is actionable (visible, non-zero box, topmost at its
// centre), dispatch a real mouse press+release there, then wait for the resulting commit. If the click
// took us to a fresh document — a native anchor; script .click() does not navigate SVG <a> either —
// wait for that document's app to commit too. Times out and fails with the target it was waiting for.
async function clickOn(target, what = 'the click') {
  const desc = typeof target === 'string' ? `css "${target}"` : JSON.stringify({ ...target, scope: target.scope || '(document)' })
  let hit = null
  const t0 = Date.now()
  while (!hit && Date.now() - t0 < 6000) {
    hit = await evaluate(`(${RESOLVE_TARGET_JS})(${JSON.stringify(target)})`)
    if (!hit) await sleep(80)
  }
  if (!hit) throw new Error(`clickOn: target never became actionable — ${desc} (${what})`)
  await evaluate(`window.__fctDocSeq = (window.__fctDocSeq || 0) + 1`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount: 1 })
  await waitForCommit(`after ${what}`)
  let sameDoc = true
  try { sameDoc = await evaluate('!!window.__fctDocSeq') } catch { /* mid-swap — assume a reload */ }
  if (!sameDoc) {
    await waitForApp()
    await installSettle()
    await waitForCommit(`after ${what} (reloaded document)`)
  }
}

// clickOn throws when its target never becomes actionable. The interaction checks that recorded the old
// synthetic-click probes' success boolean keep that shape: a failed click is a failed check, and the next
// assertion fails loudly on top of it — exactly as before.
async function clicked(target, what) {
  try { await clickOn(target, what); return true } catch (e) { console.log(`  (clickOn gave up: ${e.message})`); return false }
}

// Poll within a scope until its text contains s; hard timeout that fails loudly with the scope and the
// string it was waiting for. Scope every query — the rail carries every screen label, so an unscoped
// match can satisfy itself against navigation rather than content.
async function waitForText(scope, s, what = 'text', timeoutMs = 6000) {
  const scopeSel = scope || 'body'
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(scopeSel)}); return !!r && r.textContent.includes(${JSON.stringify(s)}) })()`)) return true
    await sleep(80)
  }
  throw new Error(`waitForText: ${what} — "${s}" never appeared in scope ${scopeSel}`)
}

// Attribute values, not getBoundingClientRect — rects on elements inside <defs> always return zero.
async function readAttr(sel, attr) {
  return evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? el.getAttribute(${JSON.stringify(attr)}) : null })()`)
}

// The AppShell hash-scroll effect runs post-commit; poll until the anchor is in view.
async function waitForInView(id, what, timeoutMs = 4000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const inView = await evaluate(`(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight })()`)
    if (inView) return true
    await sleep(120)
  }
  throw new Error(`${what} never scrolled into view`)
}

// §17 — the register: a ?cause= deep link filters to that cause's three rows; anything else shows all thirty-six.
function assertRegister(state, label, cause = null) {
  check(`${label}: page title is the register one`, state.h1 === 'Root causes', `h1=${JSON.stringify(state.h1)}`)
  check(`${label}: breadcrumb shows Root causes under Group`, !!state.breadcrumb && state.breadcrumb.includes('Group') && state.breadcrumb.includes('Root causes'), JSON.stringify(state.breadcrumb))
  if (cause) {
    const proc = P2P_CAUSES.some(([, k]) => k === cause) ? 'P2P' : 'O2C'
    check(`${label}: cause filter is ${cause}`, state.cause === cause, `cause=${JSON.stringify(state.cause)}`)
    check(`${label}: process filter follows the cause`, state.process === proc, `process=${JSON.stringify(state.process)}`)
    check(`${label}: section lists its three rows`, state.rowCount === 3 && state.countLabel === '3 root causes', `rows=${state.rowCount} label=${JSON.stringify(state.countLabel)}`)
  } else {
    check(`${label}: full register with all filters open`, state.cause === 'all' && state.process === 'all' && state.entity === 'all', JSON.stringify({ p: state.process, c: state.cause, e: state.entity }))
    check(`${label}: all thirty-six rows listed`, state.rowCount === 36 && state.countLabel === '36 root causes', `rows=${state.rowCount} label=${JSON.stringify(state.countLabel)}`)
  }
  check(`${label}: mechanism section carries six periods`, state.mechRows === 6, `mech=${state.mechRows}`)
}

// ---------- theme pass ----------
async function setTheme(themeName) {
  await goTo(BASE + '/')
  await evaluate(`localStorage.setItem('fct-theme', ${JSON.stringify(themeName)})`)
  const reloaded = waitForEvent('Page.loadEventFired', 20000)
  await send('Page.reload')
  await reloaded
  await waitForApp()
  await installSettle()
  await waitForCommit(`theme reload (${themeName})`)
}

async function drillPass(themeName, palette) {
  console.log(`\n=== ${themeName.toUpperCase()} DRILL PASS ===`)
  const reports = []
  await setTheme(themeName)

  // ---- item 1: the regression that matters ----
  console.log('\n-- item 1: O2C → Pricing disputes → register section, then worklist → AP-104281 → "Why does this keep happening?"')
  await goTo(BASE + '/entity/JGL/o2c')
  await clickOn({ text: 'Pricing disputes' }, 'O2C pricing-disputes card')
  await waitForUrl('/root-causes?cause=pricing-disputes', 'the pricing-disputes section from the O2C cockpit')
  let state = await evaluate(REGISTER_STATE_JS)
  assertRegister(state, `${themeName}/item1:cockpit-drill`, 'pricing-disputes')

  await clickOn({ scope: 'nav[aria-label="Primary"]', text: 'Worklist', match: 'prefix' }, 'rail Worklist')
  await waitForPath((p) => p === '/entity/JGL/p2p/invoices', 'the worklist')
  await clickOn({ text: 'AP-104281' }, 'worklist row AP-104281')
  await waitForPath((p) => p.includes('/invoices/AP-104281'), 'the AP-104281 exception')
  await clickOn({ text: 'Why does this keep happening?' }, '"why does this keep happening?" button')
  await waitForUrl('/root-causes?cause=missing-gr', 'the missing-GR section from the exception button')
  state = await evaluate(REGISTER_STATE_JS)
  assertRegister(state, `${themeName}/item1`, 'missing-gr')
  await screenshot(`${themeName}-item1-missing-gr.png`)

  // ---- item 2: each O2C row opens its own section of the register ----
  console.log('\n-- item 2: six O2C taxonomy rows, each opening its own register section')
  await goTo(BASE + '/entity/JGL/o2c')
  for (const [name, key] of O2C_CAUSES) {
    await clickOn({ text: name }, `O2C ${name} card`)
    await waitForUrl(`/root-causes?cause=${key}`, `the ${key} section`)
    state = await evaluate(REGISTER_STATE_JS)
    assertRegister(state, `${themeName}/item2:${name}`, key)
    // The register is group-level — no entity crumb to walk back by; navigate for the next row.
    await goTo(BASE + '/entity/JGL/o2c')
  }

  // ---- item 3: no-cause entry points land on the full register, cold start and post-section ----
  console.log('\n-- item 3a: cold start — rail Root causes, both tiles, Analyse →')
  await goTo(BASE + '/')
  await clickOn({ scope: 'nav[aria-label="Primary"]', text: 'Root causes', match: 'prefix' }, 'rail Root causes (cold start)')
  await waitForPath((p) => p === DEFAULT_PATH, 'the full register from the rail (cold start)')
  state = await evaluate(REGISTER_STATE_JS)
  assertRegister(state, `${themeName}/item3:rail-cold`)

  await goTo(BASE + '/entity/JGL')
  for (const [tile, label] of [['18 aged breaks', 'Reconciliations tile'], ['12 high-risk JEs', 'Controls tile']]) {
    await clickOn({ text: tile }, `${label} drill`)
    await waitForPath((p) => p === DEFAULT_PATH, `the full register from the ${label} (cold start)`)
    state = await evaluate(REGISTER_STATE_JS)
    assertRegister(state, `${themeName}/item3:${label}-cold`)
    // The register is group-level — no entity crumb to walk back by; navigate for the next tile.
    await goTo(BASE + '/entity/JGL')
  }
  await clickOn({ text: 'Analyse' }, 'Analyse button (cold start)')
  await waitForPath((p) => p === DEFAULT_PATH, 'the full register from Analyse → (cold start)')
  state = await evaluate(REGISTER_STATE_JS)
  assertRegister(state, `${themeName}/item3:analyse-cold`)

  console.log('\n-- item 3b: immediately after viewing a cause section — same entry points stay unfiltered')
  await goTo(BASE + '/root-causes?cause=pricing-disputes') // fresh load = just viewed the O2C section
  state = await evaluate(REGISTER_STATE_JS)
  assertRegister(state, `${themeName}/item3:starting-point`, 'pricing-disputes')

  await clickOn({ scope: 'nav[aria-label="Primary"]', text: 'Root causes', match: 'prefix' }, 'rail Root causes (post-section)')
  // Same pathname as the section — only the query drops, so a pathname wait would return before the navigation lands.
  // The URL flips before React commits the filter reset; clickOn does not return until the DOM has settled with it.
  await waitForUrl('/root-causes', 'the full register from the rail (post-section)')
  state = await evaluate(REGISTER_STATE_JS)
  assertRegister(state, `${themeName}/item3:rail-post-o2c`)

  await goTo(BASE + '/entity/JGL')
  for (const [tile, label] of [['18 aged breaks', 'Reconciliations tile'], ['12 high-risk JEs', 'Controls tile']]) {
    await clickOn({ text: tile }, `${label} drill`)
    await waitForPath((p) => p === DEFAULT_PATH, `the full register from the ${label} (post-section)`)
    state = await evaluate(REGISTER_STATE_JS)
    assertRegister(state, `${themeName}/item3:${label}-post-o2c`)
    await goTo(BASE + '/entity/JGL')
  }
  await clickOn({ text: 'Analyse' }, 'Analyse button (post-section)')
  await waitForPath((p) => p === DEFAULT_PATH, 'the full register from Analyse → (post-section)')
  state = await evaluate(REGISTER_STATE_JS)
  assertRegister(state, `${themeName}/item3:analyse-post-o2c`)

  // ---- item 4: every deep link directly loadable (fresh page load per URL) ----
  console.log('\n-- item 4: all twelve ?cause= sections load from their URL; R2R keys fall back to the full register')
  for (const [name, key] of [...P2P_CAUSES, ...O2C_CAUSES]) {
    await goTo(BASE + `/root-causes?cause=${key}`)
    state = await evaluate(REGISTER_STATE_JS)
    assertRegister(state, `${themeName}/item4:${key}`, key)
  }
  // §17.6 — R2R carries no register section yet; its keys must land on the full register, not an error.
  for (const [name, key] of R2R_CAUSES) {
    await goTo(BASE + `/root-causes?cause=${key}`)
    state = await evaluate(REGISTER_STATE_JS)
    assertRegister(state, `${themeName}/item4:r2r-fallback:${key}`)
  }

  // ---- item 5: ⌘K lists all twenty root causes, each opening its register section (or the full register for R2R) ----
  console.log('\n-- item 5: command palette — twenty ROOT CAUSE entries across three processes')
  await goTo(BASE + '/')
  // The page is settled by construction (goTo ends in a commit wait); a dropped ⌘K shows up as the typing check failing loudly.
  await ctrlK()
  await waitForCommit('palette open (item 5)')
  check(`${themeName}/item5: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('ROOT CAUSE')`)) === true)
  await waitForText('[aria-label="Command palette"]', '· P2P', '"ROOT CAUSE" rows rendered')
  let rows = await evaluate(PALETTE_ROWS_JS)
  // The cap shows the first nine — six P2P + three O2C; R2R reachability is proven by the per-query cases below.
  check(`${themeName}/item5: "ROOT CAUSE" matches all twenty (capped at nine rows)`, rows.length === 9, `rows=${rows.length}`)
  check(`${themeName}/item5: both processes appear in the list`, rows.some((r) => r.includes('· P2P')) && rows.some((r) => r.includes('· O2C')), JSON.stringify(rows.slice(0, 3)))
  await pressKey(ESC)
  await waitForCommit('palette esc (item 5)')

  for (const [query, label, target] of PALETTE_CASES) {
    await ctrlK()
    await waitForCommit(`palette open (${query})`)
    const typed = await evaluate(`(${TYPE_JS})(${JSON.stringify(query)})`)
    if (!typed) throw new Error('palette input not found while typing ' + query)
    await waitForText('[aria-label="Command palette"]', label, `palette rows for "${query}"`)
    rows = await evaluate(PALETTE_ROWS_JS)
    // 'master data' also matches agent #2's record and 'intercompany' also matches agent #20 (§15/§16.6);
    // root causes sort before agents, so the cause is first in both cases.
    const expectedRows = query === 'master data' || query === 'intercompany' ? 2 : 1
    check(`${themeName}/item5:"${query}" → ${expectedRows} row(s), cause first`, rows.length === expectedRows && rows[0].includes(label), JSON.stringify(rows))
    await pressKey(ENTER)
    await waitForUrl(target, `the ${label} cause from the palette`)
    await waitForCommit(`after picking ${label}`)
  }

  // ---- item 5b: §16.2 — the third process cockpit: header, eight stage cards, drill to the R2R taxonomy ----
  console.log('\n-- item 5b: R2R cockpit — header + eight stage cards drilling to the R2R taxonomy')
  await goTo(BASE + '/entity/JGL/r2r')
  {
    const r2r = await evaluate(`(() => {
      const h1 = document.querySelector('main h1')
      const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
      const stages = Array.from(document.querySelectorAll('main [id^="fct-stage-"]'))
      const leaves = Array.from(document.querySelectorAll('main *')).filter((e) => e.children.length === 0)
      return {
        h1: h1 ? h1.textContent : null,
        eyebrow: (leaves.find((e) => /level 2 — process/i.test(e.textContent)) || {}).textContent || null,
        breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
        stageCount: stages.length,
        steps: stages.map((s) => s.id.replace('fct-stage-', '')),
        closePct: document.querySelector('main').textContent.includes('78%'),
        // exact leaf match — no R2R stage card renders a bare 18 (counts are 96/48/176/…; percents carry %)
        openBreaks: leaves.some((e) => e.textContent.trim() === '18'),
      }
    })()`)
    check(`${themeName}/item5b: title is the R2R one`, r2r.h1 === 'Record to report, as one flow', `h1=${JSON.stringify(r2r.h1)}`)
    check(`${themeName}/item5b: eyebrow names the process level`, !!r2r.eyebrow && /record to report/i.test(r2r.eyebrow), JSON.stringify(r2r.eyebrow))
    check(`${themeName}/item5b: breadcrumb carries R2R`, !!r2r.breadcrumb && r2r.breadcrumb.includes('R2R'), JSON.stringify(r2r.breadcrumb))
    check(`${themeName}/item5b: eight stage cards in spec order`, r2r.stageCount === 8 && r2r.steps.join(',') === 'SUB,ACC,REC,ICO,JRN,TB,PCK,SGN', `steps=${JSON.stringify(r2r.steps)}`)
    check(`${themeName}/item5b: header shows JGL close % and open breaks`, r2r.closePct && r2r.openBreaks, '')
  }
  {
    const nav = await evaluate(NAV_ACTIVE_JS)
    check(`${themeName}/item5b: rail active item is the R2R cockpit`, !!nav && nav.label.startsWith('R2R cockpit'), JSON.stringify(nav))
  }
  // All R2R stage cards share one drill target — the full register (§17.6: no R2R section yet); one card proves the StageFlow wiring.
  await clickOn({ text: 'Reconciliations' }, 'R2R Reconciliations stage card')
  await waitForPath((p) => p === '/root-causes', 'the register from an R2R stage card')
  {
    const state = await evaluate(REGISTER_STATE_JS)
    assertRegister(state, `${themeName}/item5b:stage-drill`)
  }
  // The register is group-level — no R2R crumb to walk back by; navigate for the next leg.
  await goTo(BASE + '/entity/JGL/r2r')

  // ---- item 5c: §16.3 — the close calendar: KPIs, blocked/critical-path table, sign-off status, palette row ----
  console.log('\n-- item 5c: close calendar — KPIs + task table + sign-off')
  await goTo(BASE + '/entity/JGL/close-calendar')
  {
    const cc = await evaluate(`(() => {
      const h1 = document.querySelector('main h1')
      const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
      // KPI figures are scoped to the KPI row — the table's Due column also renders 'Day 6' leaves.
      const kpiLeaves = Array.from(document.querySelectorAll('[data-fct-close-kpis] *')).filter((e) => e.children.length === 0)
      const table = document.querySelector('[data-fct-close-calendar]')
      const rows = table ? Array.from(table.querySelectorAll('.fct-table-row')) : []
      return {
        h1: h1 ? h1.textContent : null,
        eyebrow: (Array.from(document.querySelectorAll('main *')).filter((e) => e.children.length === 0).find((e) => /level 2 — process/i.test(e.textContent)) || {}).textContent || null,
        breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
        closePct: kpiLeaves.some((e) => e.textContent.trim() === '78%'),
        day6Count: kpiLeaves.filter((e) => e.textContent.trim() === 'Day 6').length,
        openTasks: kpiLeaves.some((e) => e.textContent.trim() === '47'),
        blockers: kpiLeaves.some((e) => e.textContent.trim() === '7'),
        rowCount: rows.length,
        firstRow: rows[0] ? rows[0].textContent.replace(/\\s+/g, ' ') : null,
        signoff: (document.querySelector('[data-fct-close-signoff]') || {}).textContent || '',
      }
    })()`)
    check(`${themeName}/item5c: title is the close calendar one`, cc.h1 === 'Close calendar', `h1=${JSON.stringify(cc.h1)}`)
    check(`${themeName}/item5c: eyebrow names the process level`, !!cc.eyebrow && /record to report/i.test(cc.eyebrow), JSON.stringify(cc.eyebrow))
    check(`${themeName}/item5c: breadcrumb carries Close calendar`, !!cc.breadcrumb && cc.breadcrumb.includes('Close calendar'), JSON.stringify(cc.breadcrumb))
    // 78% is the same figure the R2R cockpit's header shows — one close %, two screens.
    check(`${themeName}/item5c: JGL close % ties to the R2R cockpit figure`, cc.closePct, '')
    // JGL is on schedule: COMMITTED and PREDICTED both read Day 6 — exactly two KPI leaves.
    check(`${themeName}/item5c: committed and predicted both read Day 6`, cc.day6Count === 2, `day6=${cc.day6Count}`)
    check(`${themeName}/item5c: open tasks and blockers are the pinned figures`, cc.openTasks && cc.blockers, '')
    // Blocked rows sort first, earliest due day within the group — JGL-C04 (Day 4) leads.
    check(`${themeName}/item5c: ten named rows, blocked first`, cc.rowCount === 10 && !!cc.firstRow && cc.firstRow.includes('Bank reconciliations — current accounts') && cc.firstRow.includes('BLOCKED'), `rows=${cc.rowCount} first=${JSON.stringify(cc.firstRow)}`)
    check(`${themeName}/item5c: sign-off is status only, read from the reconciliation platform`, cc.signoff.includes('SGN sign-off · 64 in flight · 13 outstanding') && cc.signoff.includes('AMBER'), JSON.stringify(cc.signoff))
  }
  {
    const nav = await evaluate(NAV_ACTIVE_JS)
    check(`${themeName}/item5c: rail active item is the close calendar`, !!nav && nav.label.startsWith('Close calendar'), JSON.stringify(nav))
  }
  await clickOn({ scope: 'nav[aria-label="Breadcrumb"]', tags: 'a', text: 'JGL', match: 'exact' }, 'breadcrumb JGL crumb') // back to the entity page via the middle crumb
  await waitForPath((p) => p === '/entity/JGL', 'the entity home (crumb walk-back)')
  {
    // The palette row reaches the screen end-to-end, like its siblings.
    await ctrlK()
    await waitForCommit('palette open (item 5c)')
    const typed = await evaluate(`(${TYPE_JS})('close calendar')`)
    if (!typed) throw new Error('palette input not found while typing close calendar')
    await waitForText('[aria-label="Command palette"]', 'Close calendar', '"close calendar" rows rendered')
    const rows = await evaluate(PALETTE_ROWS_JS)
    check(`${themeName}/item5c: "close calendar" → one row`, rows.length === 1 && rows[0].includes('Close calendar'), JSON.stringify(rows))
    await pressKey(ENTER)
    await waitForPath((p) => p === '/entity/JGL/close-calendar', 'the close calendar from the palette')
  }

  // ---- item 6: §8.2 consequence strip drills out to its four targets ----
  console.log('\n-- item 6: consequence strip — accrual, revenue at risk, provision adequacy, FX/intercompany')
  await goTo(BASE + '/entity/JGL')
  // a:not(.fct-trace-link) — the §8.10 trace strip inside this section adds three more links; the check is about the four consequence figures only
  check(`${themeName}/item6: all four figures are links`, (await evaluate(`document.getElementById('fct-consequence').querySelectorAll('a:not(.fct-trace-link)').length`)) === 4, `links=${await evaluate(`document.getElementById('fct-consequence').querySelectorAll('a:not(.fct-trace-link)').length`)}`)
  // The Close tile on this same screen drills to the close calendar too — one figure, two entry points.
  const closeTile = await evaluate(`(() => { const a = document.querySelector('main a[href="/entity/JGL/close-calendar"]'); return a && a.textContent.trim().startsWith('Close') ? 'tile' : null })()`)
  check(`${themeName}/item6: the Close tile drills to the close calendar`, closeTile === 'tile', `got=${JSON.stringify(closeTile)}`)

  await clickOn({ scope: '#fct-consequence', tags: 'a', text: '₹6.4 cr' }, 'strip accrual figure') // accrual exposure → blocked worklist filtered to missing GR
  await waitForPath((p) => p === '/entity/JGL/p2p/invoices', 'the blocked invoice worklist from the strip')
  check(`${themeName}/item6: accrual drill lands on the worklist with ?cause=missing-gr`, (await evaluate('location.search')) === '?cause=missing-gr', `search=${await evaluate('location.search')}`)
  // A drill from a financial figure shows everything behind that figure — all four missing-GR rows, the two agents resolved included (the needs-you default applies to navigation, not to figure drills). The 111 denominator still proves the cause filter applied.
  check(`${themeName}/item6: worklist is filtered to missing GR — the full figure, agent-resolved rows included`, await evaluate(`document.querySelector('main').textContent.includes('4 of 111 shown')`), '')
  await screenshot(`${themeName}-item6-missing-gr-worklist.png`)

  await goTo(BASE + '/entity/JGL') // fresh load per drill — the strip lives on the entity home
  await clickOn({ scope: '#fct-consequence', tags: 'a', text: '₹8.7 cr' }, 'strip revenue-at-risk figure') // §18.3 — revenue at risk → O2C worklist, disputes + credit blocks
  await waitForPath((p) => p === '/entity/JGL/o2c/invoices', 'the O2C worklist from the strip')
  check(`${themeName}/item6: revenue drill lands on the worklist filtered to disputes and credit blocks`, (await evaluate('location.search')) === '?cause=credit-block,pricing-disputes', `search=${await evaluate('location.search')}`)
  // A drill from a financial figure shows everything behind that figure — all five sample rows (the needs-you default applies to navigation, not to figure drills). The 122 denominator still proves the cause filter applied.
  check(`${themeName}/item6: worklist is filtered to disputes and credit blocks — the full figure`, await evaluate(`document.querySelector('main').textContent.includes('5 of 122 shown')`), '')

  await goTo(BASE + '/entity/JGL')
  await clickOn({ scope: '#fct-consequence', tags: 'a', text: '₹3.6 cr' }, 'strip FX/intercompany figure') // FX/intercompany → working capital, intercompany netting row anchor
  await waitForPath((p) => p === '/entity/JGL/working-capital', 'the working capital view from the strip')
  check(`${themeName}/item6: FX drill carries #fct-ic-netting`, (await evaluate('location.hash')) === '#fct-ic-netting', `hash=${await evaluate('location.hash')}`)
  await waitForInView('fct-ic-netting', 'the intercompany netting row after the hash scroll')
  await screenshot(`${themeName}-item6-ic-netting.png`)

  await goTo(BASE + '/entity/JGL')
  await clickOn({ scope: '#fct-consequence', tags: 'a', text: 'Provision adequacy' }, 'strip provision-adequacy figure') // → R2R cockpit, accruals panel anchor — the figure's own home
  await waitForPath((p) => p === '/entity/JGL/r2r', 'the R2R cockpit from the strip')
  check(`${themeName}/item6: provision drill carries #fct-panel-accruals`, (await evaluate('location.hash')) === '#fct-panel-accruals', `hash=${await evaluate('location.hash')}`)
  await waitForInView('fct-panel-accruals', 'the accruals panel after the hash scroll')

  // ---- item 7: service & attribution — per-entity bar + group comparison, gross/net scorecard, greyed unmeasurable SLAs, breadcrumb + active nav ----
  console.log('\n-- item 7: service & attribution screen')
  await goTo(BASE + '/entity/JGL/service')
  const svc = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const segs = Array.from(document.querySelectorAll('.fct-sla-seg'))
    const unmeasured = Array.from(document.querySelectorAll('.fct-sla-unmeasured')).map((e) => e.textContent.trim())
    const pending = Array.from(document.querySelectorAll('.fct-sla-pending')).map((e) => ({ t: e.textContent.trim(), title: e.getAttribute('title') || '' }))
    const measuringLines = (document.querySelector('main').textContent.match(/measuring since /g) || []).length
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
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
    }
  })()`)
  check(`${themeName}/item7: page title is the service & attribution one`, svc.h1 === 'Where the delays come from', `h1=${JSON.stringify(svc.h1)}`)
  check(`${themeName}/item7: bar renders three segments (third party merged into system)`, svc.segCount === 3, `segs=${svc.segCount}`)
  check(`${themeName}/item7: entity vs group comparison line is present (§7.22)`, svc.compareLine, '')
  check(`${themeName}/item7: scorecard shows gross and net side by side with unambiguous labels (§4)`, svc.grossLabel && svc.netLabel && svc.grossValue && svc.netValue, JSON.stringify(svc))
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
  await goTo(BASE + '/risk-control')
  const rc = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const sections = Array.from(document.querySelectorAll('main section')).map((s) => s.textContent.trim())
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    return {
      h1: h1 ? h1.textContent : null,
      banner: mainText.includes('RESTRICTED — Financial Controller and above'),
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
  check(`${themeName}/item8: page title is Risk & control`, rc.h1 === 'Risk & control', `h1=${JSON.stringify(rc.h1)}`)
  check(`${themeName}/item8: RESTRICTED banner with demo access toggle is visible (§8.8)`, rc.banner, '')
  check(`${themeName}/item8: all five categories render in spec order`, rc.categories.length === 5, JSON.stringify(rc.categories))
  check(`${themeName}/item8: all eight §7.8 signal titles render`, rc.titles.length === 8, `titles=${rc.titles.length}`)
  check(`${themeName}/item8: quantified values at risk render; the two system rows carry none (dashes)`, rc.values && rc.valuelessDashes === 2, JSON.stringify({ values: rc.values, valuelessDashes: rc.valuelessDashes }))
  check(`${themeName}/item8: effectiveness metrics show override rates and value prevented YTD (§7.8 item 6)`, rc.metrics, '')
  check(`${themeName}/item8: breadcrumb shows Risk & control`, !!rc.breadcrumb && rc.breadcrumb.includes('Risk & control'), JSON.stringify(rc.breadcrumb))
  const rcNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item8: active nav item is Risk & control`, !!rcNav && rcNav.label.startsWith('Risk & control'), JSON.stringify(rcNav))

  // demo-only access toggle: PLANT MANAGER hides the sections, FC AND ABOVE restores them
  await clickOn({ text: 'PLANT MANAGER' }, 'demo toggle PLANT MANAGER')
  const rcRestricted = await evaluate(`(() => {
    const mainText = document.querySelector('main').textContent
    return {
      hidden: !mainText.includes('Vendor bank detail changed 3 days before payment run'),
      notice: mainText.includes('restricted to the Financial Controller and above'),
    }
  })()`)
  check(`${themeName}/item8: PLANT MANAGER hides the signal sections (§8.8)`, rcRestricted.hidden && rcRestricted.notice, JSON.stringify(rcRestricted))
  await clickOn({ text: 'FC AND ABOVE' }, 'demo toggle FC AND ABOVE')
  const rcRestored = await evaluate(`document.querySelector('main').textContent.includes('Vendor bank detail changed 3 days before payment run')`)
  check(`${themeName}/item8: FC AND ABOVE restores the sections`, rcRestored === true, '')
  await screenshot(`${themeName}-risk-control.png`)

  // §15.6 — the agent governance slice carries only what needs attention (breaches, reversals, overrides, value acted on
  // without human review); volume and resolution rates stay on the Agents screen. Each row drills into the agent's record.
  const gov = await evaluate(`(() => {
    const sec = document.querySelector('[data-fct-agent-governance]')
    if (!sec) return null
    const txt = sec.textContent
    const statValue = (label) => {
      const els = Array.from(sec.querySelectorAll('span')).filter((s) => s.textContent === label)
      for (const el of els) if (el.nextElementSibling && el.nextElementSibling.textContent.trim()) return el.nextElementSibling.textContent.trim()
      return null
    }
    const rows = Array.from(sec.querySelectorAll('[data-fct-gov-row]'))
    return {
      caption: txt.includes('exceptions and exposure only · source: agent action logs'),
      simulated: txt.includes('Simulated data'),
      breaches: statValue('Delegation breaches'),
      reversals: statValue('Reversals'),
      overrides: statValue('Overrides by human'),
      noReview: statValue('Value acted on without human review'),
      reversalSub: txt.includes('18 of 1531 actions this period'),
      overrideSub: txt.includes('33 of 1169 resolved without human'),
      noReviewSub: txt.includes('of ₹316.6 cr acted on this period'),
      rows: rows.length,
      firstHref: (() => { const a = rows[0] && rows[0].querySelector('a'); return a ? a.getAttribute('href') : null })(),
      zeroDash: txt.includes('without review —'),
      interpretations: [
        'override rate has risen from 0% to 3% — the delegation may be set wrong',
        'reversal rate has risen from 0% to 3% — the delegation may be set wrong',
        'escalation rate has risen from 10% to 15% — the policy needs updating, not the agent',
      ].filter((s) => txt.includes(s)),
    }
  })()`)
  check(`${themeName}/item8: the governance slice carries only what needs attention — breaches, reversals, overrides, value without review (§15.6)`, !!gov && gov.breaches === '0' && gov.reversals === '18' && gov.overrides === '33' && gov.noReview === '₹252.8 cr', JSON.stringify(gov))
  check(`${themeName}/item8: the slice states its denominators, names its source and carries the §15.1 label`, !!gov && gov.reversalSub && gov.overrideSub && gov.noReviewSub && gov.caption && gov.simulated, '')
  check(`${themeName}/item8: all ten live agents appear in the register, ordered by value without review (match resolution first)`, !!gov && gov.rows === 10 && gov.firstHref === '/agents/match-resolution', JSON.stringify({ rows: gov ? gov.rows : -1, firstHref: gov ? gov.firstHref : null }))
  check(`${themeName}/item8: agents with no unreviewed value render an honest dash, not a fabricated figure`, !!gov && gov.zeroDash, '')
  check(`${themeName}/item8: the three rising rates are interpreted on screen — delegation vs policy (§15.6)`, !!gov && gov.interpretations.length === 3, JSON.stringify(gov ? gov.interpretations : null))

  // Each row drills into that agent's own record.
  const govDrill = await clicked('[data-fct-gov-row="match-resolution"] a', 'governance row drill')
  check(`${themeName}/item8: a governance row drills into the agent's record`, govDrill === true, '')
  await waitForPath((p) => p === '/agents/match-resolution', 'the agent record from the governance slice')
  const govDetail = await evaluate(`(() => { const h1 = document.querySelector('main h1'); return { h1: h1 ? h1.textContent : null, delegation: document.querySelector('main').textContent.includes('Delegation of authority') } })()`)
  check(`${themeName}/item8: the drill lands on Match resolution's record with its delegation`, govDetail.h1 === 'Match resolution' && govDetail.delegation, JSON.stringify(govDetail))

  // §8.8 — SoD conflicts and bank-change alerts must not appear on the counterparty / process cockpit screens
  for (const [route, name] of [
    ['/entity/JGL/p2p', 'p2p-cockpit'],
    ['/entity/JGL/o2c', 'o2c-cockpit'],
    ['/entity/JGL/vendor/suraksha-chemicals-pvt-ltd', 'vendor-page'],
    ['/entity/JGL/customer/jgl-deccan', 'customer-page'],
    ['/entity/JGL/cost-centre/jgl-nanjangud-operations', 'cost-centre-page'],
    ['/entity/JGL/plant/jgl-nanjangud', 'plant-page'],
  ]) {
    await goTo(BASE + route)
    const leaked = await evaluate(`(() => {
      const t = document.querySelector('main').textContent
      return ['SoD conflict', 'bank detail changed'].filter((s) => t.includes(s))
    })()`)
    check(`${themeName}/item8: ${name} shows no restricted risk & control content (§8.8)`, leaked.length === 0, JSON.stringify(leaked))
  }

  // ---- item 9: predictive — live DSO headline, contestable drivers, ranked actions (§7.3), DPO honesty flag (§8.6) ----
  console.log('\n-- item 9: predictive screen')
  await goTo(BASE + '/entity/JGL/predictive')
  const pred = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
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
  const predClickA = await clicked('main [data-driver-id="jgl-amrit"]', 'Amrit driver row')
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
  await waitForCommit('Deccan settlement date set')
  const predContested = await evaluate(`document.querySelector('main h1').textContent`)
  check(`${themeName}/item9: settling Deccan by month-end drops the projection to 65.8`, predContested === 'DSO 62 today → 65.8 projected at month-end', `h1=${JSON.stringify(predContested)}`)

  // Reset returns every assumption to the base case.
  await clickOn({ text: 'RESET TO BASE CASE' }, 'reset to base case button')
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
  await goTo(BASE + '/entity/JRP/predictive')
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
    await goTo(BASE + route)
    const cp = await evaluate(`document.querySelector('main h1') ? document.querySelector('main h1').textContent : null`)
    check(`${themeName}/item10: ${route} loads with its counterparty name`, cp === name, `h1=${JSON.stringify(cp)}`)
  }

  // Worklist rows drill sideways to vendor and plant pages — the plant cell is a detail column inside the row's expansion.
  await goTo(BASE + '/entity/JGL/p2p/invoices')
  const wlExpanded = await clicked({ rows: '.fct-table-row', rowText: 'Suraksha Chemicals Pvt Ltd', tags: '.fct-expand' }, 'worklist Suraksha expander')
  const wlDrill = await evaluate(`Array.from(document.querySelectorAll('main a')).filter((a) => a.textContent === 'Suraksha Chemicals Pvt Ltd' || a.textContent === 'Nanjangud').map((a) => ({ text: a.textContent, href: a.getAttribute('href') }))`)
  check(`${themeName}/item10: worklist vendor and plant cells link to counterparty pages`, wlExpanded && wlDrill.some((l) => l.text === 'Suraksha Chemicals Pvt Ltd' && l.href === '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd') && wlDrill.some((l) => l.text === 'Nanjangud' && l.href === '/entity/JGL/plant/jgl-nanjangud'), JSON.stringify({ expanded: wlExpanded, links: wlDrill }))
  const wlClick = await clicked('main a[href="/entity/JGL/vendor/suraksha-chemicals-pvt-ltd"]', 'worklist vendor cell')
  check(`${themeName}/item10: clicking the worklist vendor cell opens its page`, wlClick === true, '')
  await waitForPath((p) => p === '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd', 'the vendor page from the worklist')

  // P2P-cockpit cost-centre rows drill on too. (The register's rows carry no counterparty links — §17.)
  await goTo(BASE + '/entity/JGL/p2p')
  const ccDrill = await evaluate(`(() => { const a = Array.from(document.querySelectorAll('main a')).find((x) => x.textContent.includes('Nanjangud Operations')); return a ? a.getAttribute('href') : null })()`)
  check(`${themeName}/item10: P2P cockpit cost-centre row links to the cost-centre page`, ccDrill === '/entity/JGL/cost-centre/jgl-nanjangud-operations', `href=${JSON.stringify(ccDrill)}`)

  // ⌘K finds a counterparty by name and opens its page.
  await ctrlK()
  await waitForCommit('palette open (item 10)')
  check(`${themeName}/item10: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('suraksha')`)) === true)
  await waitForText('[aria-label="Command palette"]', 'Suraksha Chemicals Pvt Ltd', '"suraksha" rows rendered')
  const cpRows = await evaluate(PALETTE_ROWS_JS)
  check(`${themeName}/item10: "suraksha" lists the exception and its vendor page`, cpRows.length === 2 && cpRows.some((r) => r.includes('VENDOR') && r.includes('Suraksha Chemicals Pvt Ltd')), JSON.stringify(cpRows))
  const cpClick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'VENDOR' }, 'vendor palette row')
  check(`${themeName}/item10: clicking the vendor row opens its page`, cpClick === true, '')
  await waitForPath((p) => p === '/entity/JGL/vendor/suraksha-chemicals-pvt-ltd', 'the vendor page from the palette')

  // ---- item 11: compliance (§7.26) — jurisdiction-matched obligations, one overdue row, the clickable veto chain ----
  console.log('\n-- item 11: compliance screen')
  await goTo(BASE + '/compliance')
  const comp = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const tags = Array.from(document.querySelectorAll('main .fct-status-tag')).map((el) => el.textContent.trim())
    const links = Array.from(document.querySelectorAll('main a'))
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
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
  await goTo(BASE + '/data-quality')
  const dq = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const links = Array.from(document.querySelectorAll('main a'))
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    return {
      h1: h1 ? h1.textContent : null,
      domains: ['Vendor master', 'Customer master', 'General ledger', 'Interfaces'].filter((d) => mainText.includes(d)),
      jglPanCell: mainText.includes('14 / 812'),
      impacts: ['Blocks e-invoice validation', 'Duplicate payment risk', 'Fraud surface, master data bloat', 'Billing rejections', 'Manual coding, misposting risk', 'Missing transactions, stale figures'].filter((s) => mainText.includes(s)),
      health: ['ON SCHEDULE', 'DELAYED', 'STALE'].every((h) => mainText.includes(h)),
      lastRuns: ['31 Aug 2026, 04:00', '27 Aug 2026, 16:35'].every((r) => mainText.includes(r)),
      causeLink: links.some((a) => a.getAttribute('href') === '/root-causes?cause=vendor-master'),
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
  await goTo(BASE + '/service-desk')
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
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    return {
      h1: h1 ? h1.textContent : null,
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
  check(`${themeName}/item13: h1 is Finance Service Desk`, sd.h1 === 'Finance Service Desk', JSON.stringify(sd.h1))
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
  const sdSubmit = await clicked({ scope: 'main', tags: 'button', text: 'Add to queue', match: 'exact' }, '"Add to queue" button')
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
  await ctrlK()
  await waitForCommit('palette open (item 13)')
  check(`${themeName}/item13: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('service desk')`)) === true)
  await waitForText('[aria-label="Command palette"]', 'Finance Service Desk', '"service desk" rows rendered')
  const sdPalette = await evaluate(PALETTE_ROWS_JS)
  check(`${themeName}/item13: "service desk" lists exactly one screen with a live open-request count`, sdPalette.length === 1 && sdPalette[0].includes('Finance Service Desk') && /\d+ open requests/.test(sdPalette[0]), JSON.stringify(sdPalette))
  const sdPick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'Finance Service Desk' }, 'service-desk palette row')
  check(`${themeName}/item13: picking the row opens the service desk`, sdPick === true, '')
  await waitForPath((p) => p === '/service-desk', 'the service desk from the palette')
  await waitForCommit('palette pick (item 13)')
  check(`${themeName}/item13: the palette closes after picking`, (await evaluate(`!document.querySelector('.fct-palette-scrim')`)) === true, '')
  await screenshot(`${themeName}-service-desk.png`)

  // ---- item 14: root cause register (§17) — group-level register of root causes under each §6.1 cause + mechanism trend ----
  console.log('\n-- item 14: root cause register screen')
  await goTo(BASE + '/root-causes')
  const regState = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    const sections = Array.from(document.querySelectorAll('main section'))
    const regSec = sections.find((s) => s.textContent.includes('Register'))
    // State words repeat in the register, so resolve each stat label to its numeric sibling.
    const statValue = (label) => {
      const els = Array.from(document.querySelectorAll('main span')).filter((s) => s.textContent === label)
      for (const el of els) if (el.nextElementSibling && /^\\d+$/.test(el.nextElementSibling.textContent || '')) return el.nextElementSibling.textContent
      return null
    }
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    return {
      h1: h1 ? h1.textContent : null,
      stats: { identified: statValue('IDENTIFIED'), eliminated: statValue('ELIMINATED'), fixedAtSource: statValue('FIXED AT SOURCE'), inProgress: statValue('IN PROGRESS') },
      regRows: regSec ? regSec.querySelectorAll('.fct-table-row').length : -1,
      states: ['ELIMINATED', 'FIXED-AT-SOURCE', 'IN-PROGRESS', 'IDENTIFIED'].filter((s) => regSec && regSec.textContent.includes(s)),
      closed: Array.from(document.querySelectorAll('[data-series="closed"]')).map((el) => el.textContent),
      open: Array.from(document.querySelectorAll('[data-series="open-exceptions"]')).map((el) => el.textContent),
      guard: mainText.includes('it does not clear the existing pool'),
      claim: mainText.includes('generated 37 exceptions last period and none in this one'),
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item14: h1 is Root causes`, regState.h1 === 'Root causes', JSON.stringify(regState.h1))
  check(`${themeName}/item14: headline counts are 17 / 4 / 7 / 8 of the 36 rows`, regState.stats.identified === '17' && regState.stats.eliminated === '4' && regState.stats.fixedAtSource === '7' && regState.stats.inProgress === '8', JSON.stringify(regState.stats))
  check(`${themeName}/item14: the register lists all 36 root causes`, regState.regRows === 36, `rows=${regState.regRows}`)
  check(`${themeName}/item14: all four states appear in the register`, regState.states.length === 4, JSON.stringify(regState.states))
  const RC_CLOSED = ['1', '2', '4', '6', '9', '11']
  const RC_OPEN = ['2,158', '2,117', '2,069', '2,034', '2,012', '1,980']
  check(`${themeName}/item14: cumulative closures read 1 · 2 · 4 · 6 · 9 · 11`, JSON.stringify(regState.closed) === JSON.stringify(RC_CLOSED), JSON.stringify(regState.closed))
  check(`${themeName}/item14: group open exceptions read the live series joined to the four early points`, JSON.stringify(regState.open) === JSON.stringify(RC_OPEN), JSON.stringify(regState.open))
  const rcNum = (s) => Number(String(s).replace(/,/g, ''))
  let rcMechOk = regState.closed.length === 6 && regState.open.length === 6
  for (let i = 0; i < 5 && rcMechOk; i++) {
    rcMechOk = rcNum(regState.closed[i]) < rcNum(regState.closed[i + 1]) && rcNum(regState.open[i]) > rcNum(regState.open[i + 1])
  }
  check(`${themeName}/item14: as closures rise, group open exceptions fall across the same six points`, rcMechOk, JSON.stringify({ c: regState.closed, o: regState.open }))
  check(`${themeName}/item14: the overclaim guard says which claim the screen is making`, regState.guard, 'guard missing')
  check(`${themeName}/item14: the defensible p6 claim renders (37 last period, none this one)`, regState.claim, 'claim missing')
  check(`${themeName}/item14: breadcrumb shows Root causes`, !!regState.breadcrumb && regState.breadcrumb.includes('Root causes'), JSON.stringify(regState.breadcrumb))
  const regNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item14: active nav item is Root causes`, !!regNav && regNav.label.startsWith('Root causes'), JSON.stringify(regNav))

  // ⌘K finds the screen by name; its count comes from the register, never a literal. The query carries the trailing
  // "s" so it matches only this SCREEN row — the per-entity rows are kind "ROOT CAUSE" (no s) and must not appear.
  await ctrlK()
  await waitForCommit('palette open (item 14)')
  check(`${themeName}/item14: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('root causes')`)) === true)
  await waitForText('[aria-label="Command palette"]', 'Root causes', '"root causes" rows rendered')
  const regPalette = await evaluate(PALETTE_ROWS_JS)
  check(`${themeName}/item14: "root causes" lists exactly one screen with a live closed count`, regPalette.length === 1 && regPalette[0].includes('Root causes') && /\d+ of \d+ closed/.test(regPalette[0]), JSON.stringify(regPalette))
  const regPick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'Root causes' }, 'register palette row')
  check(`${themeName}/item14: picking the row opens the register`, regPick === true, '')
  await waitForPath((p) => p === '/root-causes', 'the root cause register from the palette')
  await waitForCommit('palette pick (item 14)')
  check(`${themeName}/item14: the palette closes after picking`, (await evaluate(`!document.querySelector('.fct-palette-scrim')`)) === true, '')
  await screenshot(`${themeName}-root-causes.png`)

  // ---- item 15: agent workforce (§15) — roster, coverage strip, authority, records, sort ----
  console.log('\n-- item 15: agent workforce screen')
  await goTo(BASE + '/agents')
  const ag = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    // Stat labels repeat in the roster cards, so scope to the summary section and resolve label → value sibling.
    const statValue = (label) => {
      const els = Array.from(document.querySelectorAll('[data-fct-summary] span')).filter((s) => s.textContent === label)
      for (const el of els) if (el.nextElementSibling && el.nextElementSibling.textContent.trim()) return el.nextElementSibling.textContent.trim()
      return null
    }
    const stageChips = (code) => {
      const cell = document.querySelector('[data-fct-stage="' + code + '"]')
      return cell ? cell.querySelectorAll('span[title]').length : -1
    }
    const invCell = document.querySelector('[data-fct-stage="INV"]')
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    return {
      h1: h1 ? h1.textContent : null,
      eyebrow: h1 && h1.previousElementSibling ? h1.previousElementSibling.textContent : null,
      simulated: mainText.includes('Simulated data'),
      cycle: mainText.includes('agents last ran 06:42 · next cycle 07:00'),
      stats: {
        liveRoles: statValue('ACTIVE ROLES'),
        actions: statValue('ACTIONS THIS PERIOD'),
        resolved: statValue('RESOLVED WITHOUT HUMAN'),
        escalated: statValue('ESCALATED'),
        overridden: statValue('OVERRIDDEN'),
        reversed: statValue('REVERSED'),
        preventive: statValue('PREVENTIVE'),
      },
      stages: document.querySelectorAll('[data-fct-stage]').length,
      prChips: stageChips('PR'),
      poChips: stageChips('PO'),
      dlvChips: stageChips('DLV'),
      dspChips: stageChips('DSP'),
      preCloseNote: invCell ? invCell.textContent.includes('(pre-close)') : false,
      legend: mainText.includes('+ 1, 2 across all stages'),
      r2rJrnChips: stageChips('JRN'),
      cards: document.querySelectorAll('[data-fct-agent]').length,
      drillLinks: document.querySelectorAll('[data-fct-agent-link]').length,
      liveBadges: Array.from(document.querySelectorAll('[data-fct-agent]')).filter((c) => Array.from(c.querySelectorAll('span')).some((s) => s.textContent === 'Active')).length,
      designedBadges: Array.from(document.querySelectorAll('[data-fct-agent]')).filter((c) => Array.from(c.querySelectorAll('span')).some((s) => s.textContent === 'Not active')).length,
      ppCard: (() => { const c = document.querySelector('[data-fct-agent="payment-proposal"]'); return c ? (c.textContent.includes('never acts on releasing a payment run') && c.textContent.includes('WOULD HOLD')) : false })(),
      neverItems: document.querySelectorAll('[data-fct-never-item]').length,
      neverTexts: ['Vendor bank detail changes', 'Provisions requiring judgment', 'Anything outside a stated tolerance', 'Cut-off decisions at period end', 'Novel cases with no precedent', 'Statutory sign-off', 'Credit release against exposure', 'Anything an agent has already escalated twice'].every((t) => mainText.includes(t)),
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item15: h1 is "The agent workforce"`, ag.h1 === 'The agent workforce', JSON.stringify(ag.h1))
  check(`${themeName}/item15: eyebrow is Agents`, ag.eyebrow === 'Agents', JSON.stringify(ag.eyebrow))
  check(`${themeName}/item15: the §15.1 simulated label renders`, ag.simulated, 'simulated tag missing')
  check(`${themeName}/item15: spec-pinned cycle line renders (last ran 06:42 · next 07:00)`, ag.cycle, 'cycle line missing')
  check(`${themeName}/item15: active roles read "10 of 27"`, ag.stats.liveRoles === '10 of 27', JSON.stringify(ag.stats.liveRoles))
  check(`${themeName}/item15: preventive reads "12 of 27"`, ag.stats.preventive === '12 of 27', JSON.stringify(ag.stats.preventive))
  const agNum = (s) => Number(String(s).replace(/,/g, ''))
  check(`${themeName}/item15: workforce totals are consistent (resolved + escalated ≤ actions; overridden and reversed ≤ resolved)`,
    !!ag.stats.actions && !!ag.stats.resolved &&
    agNum(ag.stats.resolved) + agNum(ag.stats.escalated) <= agNum(ag.stats.actions) &&
    agNum(ag.stats.overridden) <= agNum(ag.stats.resolved) &&
    agNum(ag.stats.reversed) <= agNum(ag.stats.resolved),
    JSON.stringify(ag.stats))
  check(`${themeName}/item15: the coverage strip has twenty-two stages (seven P2P + seven O2C + eight R2R)`, ag.stages === 22, `stages=${ag.stages}`)
  // §18.2 — PR carries six: buying compliance plus the five requisition agents; the top of the funnel is covered.
  check(`${themeName}/item15: the PR stage positions six agents`, ag.prChips === 6, `chips=${ag.prChips}`)
  check(`${themeName}/item15: the PO stage positions three agents`, ag.poChips === 3, `chips=${ag.poChips}`)
  check(`${themeName}/item15: DLV and DSP are visible gaps — no agent acts there`, ag.dlvChips === 0 && ag.dspChips === 0, JSON.stringify({ dlv: ag.dlvChips, dsp: ag.dspChips }))
  check(`${themeName}/item15: provisioning sits at INV as a pre-close action`, ag.preCloseNote, 'pre-close note missing')
  check(`${themeName}/item15: the legend names agents 1 and 2 across all stages`, ag.legend, 'legend missing')
  check(`${themeName}/item15: the R2R strip row positions cut-off surveillance at JRN (§16.7)`, ag.r2rJrnChips === 1, `chips=${ag.r2rJrnChips}`)
  // Authority fields live inside the expanded record — open each card, let React flush, then read it back.
  // The roster holds one expandedId at a time, so each record must be read before the next card opens.
  let agAuthority = true
  for (const id of ['payment-proposal', 'buying-compliance', 'receipt-discipline', 'credit-watch', 'billing-readiness', 'cut-off-surveillance', 'budget-exposure', 'duplicate-pr']) {
    const opened = await clicked(`[data-fct-agent-toggle="${id}"]`, `agent toggle ${id}`)
    const want = id === 'payment-proposal' ? 'proposes only' : 'advisory'
    const has = await evaluate(`(() => { const r = document.querySelector('[data-fct-record="${id}"]'); return r ? (r.textContent.includes('AUTHORITY') && r.textContent.includes(${JSON.stringify(want)})) : false })()`)
    if (!opened || !has) agAuthority = false
  }
  check(`${themeName}/item15: restricted authority sits on each agent's own record — proposes only / advisory (§10.1)`, agAuthority, 'authority fields missing')
  check(`${themeName}/item15: the roster lists all twenty-seven roles`, ag.cards === 27, `cards=${ag.cards}`)
  check(`${themeName}/item15: every card carries a drill into that agent's own record (§15.7)`, ag.drillLinks === 27, `links=${ag.drillLinks}`)
  check(`${themeName}/item15: ten cards are Active and seventeen Not active (§15.2 / §18.2)`, ag.liveBadges === 10 && ag.designedBadges === 17, JSON.stringify({ live: ag.liveBadges, designed: ag.designedBadges }))
  check(`${themeName}/item15: payment proposal is designed and would never act on releasing a run`, ag.ppCard, 'payment-proposal card wrong')
  check(`${themeName}/item15: §15.8 lists all eight never-automate items prominently`, ag.neverItems === 8 && ag.neverTexts, `items=${ag.neverItems}`)
  check(`${themeName}/item15: breadcrumb shows Agents`, !!ag.breadcrumb && ag.breadcrumb.includes('Agents'), JSON.stringify(ag.breadcrumb))
  const agNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item15: active nav item is Agents`, !!agNav && agNav.label.startsWith('Agents'), JSON.stringify(agNav))

  // Default order: Shared → P2P → O2C, preventive before reactive within each (Shared has none).
  const AG_SECTIONS_JS = `(() => {
    const roster = document.querySelector('[data-fct-roster]')
    if (!roster) return null
    const out = []
    for (const g of Array.from(roster.children)) {
      const labelEl = g.firstElementChild
      if (!labelEl || !/^(SHARED|P2P|O2C|R2R)$/.test(labelEl.textContent.trim())) continue
      out.push({ group: labelEl.textContent.trim(), subs: Array.from(g.children).slice(1).map((sub) => ({ type: sub.firstElementChild ? sub.firstElementChild.textContent.trim() : null, statuses: Array.from(sub.querySelectorAll('[data-fct-agent]')).map((c) => { const b = Array.from(c.querySelectorAll('span')).find((s) => s.textContent === 'Active' || s.textContent === 'Not active'); return b ? b.textContent : '?' }) })) })
    }
    return out
  })()`
  const agOrder = await evaluate(AG_SECTIONS_JS)
  check(`${themeName}/item15: the roster groups Shared → P2P → O2C → R2R with preventive before reactive`, JSON.stringify(agOrder.map((g) => ({ group: g.group, types: g.subs.map((s) => s.type) }))) === JSON.stringify([
    { group: 'SHARED', types: ['REACTIVE'] },
    { group: 'P2P', types: ['PREVENTIVE', 'REACTIVE'] },
    { group: 'O2C', types: ['PREVENTIVE', 'REACTIVE'] },
    { group: 'R2R', types: ['PREVENTIVE', 'REACTIVE'] },
  ]), JSON.stringify(agOrder))

  // Sort by escalation rate: active agents rank first within their section; not-active sink to the bottom.
  const agSortClick = await clicked('[data-fct-sort="escalation"]', 'escalation sort control')
  check(`${themeName}/item15: the escalation-rate sort control responds`, agSortClick === true, '')
  const agSections = await evaluate(AG_SECTIONS_JS)
  let agSortOk = Array.isArray(agSections) && agSections.length === 4
  for (const g of agSections ?? []) {
    for (const s of g.subs) {
      const firstNotActive = s.statuses.indexOf('Not active')
      const lastActive = s.statuses.lastIndexOf('Active')
      if (firstNotActive !== -1 && lastActive !== -1 && lastActive >= firstNotActive) agSortOk = false
    }
  }
  check(`${themeName}/item15: under escalation sort, live agents precede designed ones in every section`, agSortOk, JSON.stringify(agSections))
  const agSortBtnBg = await evaluate(`(() => { const b = document.querySelector('[data-fct-sort="escalation"]'); return b ? getComputedStyle(b).backgroundColor : null })()`)
  check(`${themeName}/item15: the escalation sort control shows its active state`, sameColor(agSortBtnBg, palette.bgSelected), `got=${agSortBtnBg} want=${palette.bgSelected}`)

  // Clicking an agent opens its record inline: full delegation, supervisor, action log.
  const agExpand = await clicked('[data-fct-agent-toggle="follow-up"]', 'follow-up toggle')
  check(`${themeName}/item15: clicking follow-up opens its record`, agExpand === true, '')
  const agRecord = await evaluate(`(() => {
    const rec = document.querySelector('[data-fct-record="follow-up"]')
    if (!rec) return null
    const txt = rec.textContent
    return {
      delegation: txt.includes('Delegation of authority'),
      supervisor: /SUPERVISED BY/.test(txt),
      actions: rec.querySelectorAll('[data-fct-action]').length,
      targetLink: !!rec.querySelector('a[href*="/p2p/invoices/"]'),
      simulated: txt.includes('Simulated data'),
    }
  })()`)
  check(`${themeName}/item15: the record carries full delegation and a named supervisor`, !!agRecord && agRecord.delegation && agRecord.supervisor, JSON.stringify(agRecord))
  check(`${themeName}/item15: follow-up's action log lists its actions with openable targets`, !!agRecord && agRecord.actions >= 3 && agRecord.targetLink, `actions=${agRecord ? agRecord.actions : -1}`)
  check(`${themeName}/item15: the record repeats the §15.1 simulated label`, !!agRecord && agRecord.simulated, 'simulated tag missing in record')

  // Commitments is live and has a performance record now — exception follow-ups plus one PO-stage engagement per open PO it chased, amended or proposed on (§15.7). The honest-absence case sits with payment-proposal below.
  const agCommit = await clicked('[data-fct-agent-toggle="commitments"]', 'commitments toggle')
  check(`${themeName}/item15: clicking commitments opens its record`, agCommit === true, '')
  const agCommitRec = await evaluate(`(() => { const rec = document.querySelector('[data-fct-record="commitments"]'); return rec ? (rec.querySelectorAll('[data-fct-action]').length >= 6 && !!rec.querySelector('a[href*="/p2p/invoices/"]') && !!rec.querySelector('a[href*="/p2p/commitments/"]')) : false })()`)
  check(`${themeName}/item15: commitments is live with a performance record — exception follow-ups plus PO-stage engagements, each opening its target`, agCommitRec === true, '')
  const agPp = await clicked('[data-fct-agent-toggle="payment-proposal"]', 'payment-proposal toggle')
  check(`${themeName}/item15: clicking payment proposal opens its record`, agPp === true, '')
  const agPpRec = await evaluate(`(() => { const rec = document.querySelector('[data-fct-record="payment-proposal"]'); return rec ? (rec.textContent.includes('not built; no performance record') && rec.textContent.includes('No action log yet.')) : false })()`)
  check(`${themeName}/item15: a designed agent's record shows dashes, not invented metrics`, agPpRec === true, '')

  // §15.7 — the per-agent drill from the roster into that agent's own record; breadcrumb and rail carry it back.
  const agDrill = await clicked('[data-fct-agent-link="follow-up"]', 'roster drill link')
  check(`${themeName}/item15: clicking the drill opens follow-up's record page`, agDrill === true, '')
  await waitForPath((p) => p === '/agents/follow-up', 'the agent record from the roster')
  const agDetail = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    // The rail precedes the top bar in DOM order and carries a "Group view" item, so scope to the breadcrumb nav by label.
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    return {
      h1: h1 ? h1.textContent : null,
      simulated: mainText.includes('Simulated data'),
      delegation: mainText.includes('Delegation of authority'),
      supervisor: /SUPERVISED BY/.test(mainText),
      actions: document.querySelectorAll('[data-fct-action]').length,
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item15: the record page shows the agent's name, delegation and supervisor`, !!agDetail && agDetail.h1 === 'Follow-up & escalation' && agDetail.delegation && agDetail.supervisor, JSON.stringify(agDetail))
  check(`${themeName}/item15: the record page carries the action log and the §15.1 label`, !!agDetail && agDetail.actions === 14 && agDetail.simulated, `actions=${agDetail ? agDetail.actions : -1}`)
  check(`${themeName}/item15: the breadcrumb carries the record back to the roster`, !!agDetail && !!agDetail.breadcrumb && agDetail.breadcrumb.includes('Agents') && agDetail.breadcrumb.includes('Follow-up & escalation'), JSON.stringify(agDetail ? agDetail.breadcrumb : null))
  const agDetailNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item15: the Agents rail entry stays active on the record page`, !!agDetailNav && agDetailNav.label.startsWith('Agents'), JSON.stringify(agDetailNav))

  // ⌘K finds the screen by name; its count comes from the dataset, never a literal.
  await ctrlK()
  await waitForCommit('palette open (item 15)')
  check(`${themeName}/item15: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('agents')`)) === true)
  await waitForText('[aria-label="Command palette"]', 'roles active', '"agents" rows rendered')
  const agPalette = await evaluate(PALETTE_ROWS_JS)
  // "agents" also matches the vendor "Aravalli Reagents"; assert on the screen row's meta, not the total row count.
  const agScreenRows = agPalette.filter((t) => /\d+ of \d+ roles active/.test(t))
  check(`${themeName}/item15: "agents" lists exactly one screen with a live role count`, agScreenRows.length === 1 && agScreenRows[0].includes('Agents'), JSON.stringify(agPalette))
  const agPick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'Agents' }, 'agents palette row')
  check(`${themeName}/item15: picking the row opens the agent workforce`, agPick === true, '')
  await waitForPath((p) => p === '/agents', 'the agent workforce from the palette')
  await waitForCommit('palette pick (item 15)')
  check(`${themeName}/item15: the palette closes after picking`, (await evaluate(`!document.querySelector('.fct-palette-scrim')`)) === true, '')
  await screenshot(`${themeName}-agents.png`)

  // ---- item 16: touch economics (§15.3/§15.4) — funnel, the two levers, cause mix, reconciliation ----
  console.log('\n-- item 16: touch economics screen')
  await goTo(BASE + '/touch-economics')
  const te = await evaluate(`(() => {
    const h1 = document.querySelector('main h1')
    const mainText = document.querySelector('main').textContent
    // Stat labels are unique, but scope to the summary section and resolve label → value sibling.
    const statValue = (label) => {
      const els = Array.from(document.querySelectorAll('[data-fct-summary] span')).filter((s) => s.textContent === label)
      for (const el of els) if (el.nextElementSibling && el.nextElementSibling.textContent.trim()) return el.nextElementSibling.textContent.trim()
      return null
    }
    // Each table row renders as a grid: entity, touchless %, manual %, agent-resolved %, human %, touches/1,000.
    // .fct-table-row wraps the grid in one child (the row frame), so cells are read off firstElementChild.
    const funnelRows = Array.from(document.querySelectorAll('[data-fct-funnel] .fct-table-row')).map((r) => Array.from(r.firstElementChild.children).map((c) => c.textContent.trim()))
    const causeRows = Array.from(document.querySelectorAll('[data-fct-causes] .fct-table-row')).map((r) => Array.from(r.firstElementChild.children).map((c) => c.textContent.trim()))
    const stageText = (slug) => { const el = document.querySelector('[data-fct-lever-stage="' + slug + '"]'); return el ? el.textContent : null }
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    return {
      h1: h1 ? h1.textContent : null,
      eyebrow: h1 && h1.previousElementSibling ? h1.previousElementSibling.textContent : null,
      simulated: mainText.includes('Simulated data'),
      headline: statValue('TOUCHES PER 1,000 INVOICES'),
      manualShare: statValue('MANUAL SHARE OF INVOICES'),
      funnelRows,
      causeRows,
      levers: Array.from(document.querySelectorAll('[data-fct-lever]')).map((l) => l.getAttribute('data-fct-lever')),
      today: stageText('today'),
      afterCause: stageText('after-cause-elimination'),
      effective: stageText('effective-agents'),
      funnelLabel: document.querySelector('[data-fct-funnel]').textContent.includes('agents alone, on today’s exception volume'),
      summaryLabel: document.querySelector('[data-fct-summary]').textContent.includes('JGL · agents alone, on today’s exception volume'),
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
    }
  })()`)
  check(`${themeName}/item16: h1 is "Touch economics"`, te.h1 === 'Touch economics', JSON.stringify(te.h1))
  check(`${themeName}/item16: eyebrow is Agents`, te.eyebrow === 'Agents', JSON.stringify(te.eyebrow))
  check(`${themeName}/item16: the §15.1 simulated label renders`, te.simulated, 'simulated tag missing')
  // The commit is to touches per thousand, not an automation percentage — it headlines the screen.
  check(`${themeName}/item16: the headline is the touch rate — JGL reads 460 → 138 per thousand`, te.headline === '460 → 138', JSON.stringify(te.headline))
  check(`${themeName}/item16: the manual share follows it, 46% → 13.8%`, te.manualShare === '46% → 13.8%', JSON.stringify(te.manualShare))

  const pct = (t) => Number(String(t).replace('%', ''))
  const splitArrow = (t) => String(t).split('→').map((s) => Number(s.trim()))
  check(`${themeName}/item16: the funnel lists all six entities`, te.funnelRows.length === 6, `rows=${te.funnelRows.length}`)
  let reconOk = true
  for (const r of te.funnelRows) {
    const [ , touchless, manual, agentResolved, human, touches] = r
    const [tToday, tAfter] = splitArrow(touches)
    if (Math.abs(pct(agentResolved) + pct(human) - pct(manual)) > 0.05) reconOk = false
    if (tToday !== Math.round(pct(manual) * 10) || tAfter !== Math.round(pct(human) * 10)) reconOk = false
    if (Math.abs(pct(touchless) + pct(manual) - 100) > 0.05) reconOk = false
  }
  check(`${themeName}/item16: every row reconciles — agent-resolved + human = manual, touches = share × 10, touchless + manual = 100`, reconOk, JSON.stringify(te.funnelRows))
  const jglRow = te.funnelRows.find((r) => r[5] === '460 → 138')
  check(`${themeName}/item16: JGL reads 54 / 46 / 32.2 / 13.8`, !!jglRow && jglRow[1] === '54%' && jglRow[2] === '46%' && jglRow[3] === '32.2%' && jglRow[4] === '13.8%', JSON.stringify(jglRow))

  // §15.3 — the two levers shown separately: they compound, and they cost differently.
  check(`${themeName}/item16: both levers are named between stages`, JSON.stringify(te.levers) === JSON.stringify(['fewer exceptions arising', 'agents on the residue']), JSON.stringify(te.levers))
  const stageHas = (txt, touches, touchless) => !!txt && txt.includes(String(touches)) && txt.includes(`${touchless}% touchless`)
  check(`${themeName}/item16: today reads 460 per thousand at 54% touchless`, stageHas(te.today, 460, 54), JSON.stringify(te.today))
  check(`${themeName}/item16: after cause elimination reads 380 at 62%`, stageHas(te.afterCause, 380, 62), JSON.stringify(te.afterCause))
  check(`${themeName}/item16: effective — agents on the residue reads 114 at 89%`, stageHas(te.effective, 114, 89), JSON.stringify(te.effective))

  // §15.3 — the two end states are different scenarios; the screen labels them apart so they don't read as one error.
  check(`${themeName}/item16: the funnel and headline are labelled "agents alone, on today's exception volume" (§15.3)`, te.funnelLabel && te.summaryLabel, JSON.stringify({ f: te.funnelLabel, s: te.summaryLabel }))
  check(`${themeName}/item16: the final stage is labelled "causes eliminated first, then agents on the residue" (§15.3)`, !!te.effective && te.effective.includes('causes eliminated first, then agents on the residue'), JSON.stringify(te.effective))

  // §15.4 — JGL's per-cause resolvable shares reconcile to the entity total: Σ(share × resolvable) × manual ≈ agent-resolved.
  let causeMix = null
  if (te.causeRows.length === 6 && jglRow) {
    const weighted = te.causeRows.reduce((s, r) => s + (pct(r[1]) / 100) * (pct(r[2]) / 100), 0)
    causeMix = weighted * pct(jglRow[2])
  }
  check(`${themeName}/item16: the per-cause resolvable shares reconcile to JGL's agent-resolved total (≈32.2)`, te.causeRows.length === 6 && causeMix !== null && Math.abs(causeMix - pct(jglRow[3])) <= 0.1, JSON.stringify({ causeMix, want: jglRow ? jglRow[3] : null }))

  check(`${themeName}/item16: breadcrumb shows Touch economics`, !!te.breadcrumb && te.breadcrumb.includes('Touch economics'), JSON.stringify(te.breadcrumb))
  const teNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item16: active nav item is Touch economics`, !!teNav && teNav.label.startsWith('Touch economics'), JSON.stringify(teNav))

  // ⌘K finds the screen by name; its meta states JGL's touch rate from the dataset, never a literal.
  await ctrlK()
  await waitForCommit('palette open (item 16)')
  check(`${themeName}/item16: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('touch')`)) === true)
  await waitForText('[aria-label="Command palette"]', '/ 1,000', '"touch" rows rendered')
  const tePalette = await evaluate(PALETTE_ROWS_JS)
  // "touch" may match other rows; assert on the screen row's meta.
  const teScreenRows = tePalette.filter((t) => /JGL \d+ → \d+ \/ 1,000/.test(t))
  check(`${themeName}/item16: "touch" lists exactly one screen with JGL's touch rate`, teScreenRows.length === 1 && teScreenRows[0].includes('Touch economics'), JSON.stringify(tePalette))
  const tePick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'Touch economics' }, 'touch-economics palette row')
  check(`${themeName}/item16: picking the row opens touch economics`, tePick === true, '')
  await waitForPath((p) => p === '/touch-economics', 'touch economics from the palette')
  await waitForCommit('palette pick (item 16)')
  check(`${themeName}/item16: the palette closes after picking`, (await evaluate(`!document.querySelector('.fct-palette-scrim')`)) === true, '')
  await screenshot(`${themeName}-touch-economics.png`)

  // ---- item 17: one exception, end to end (§15.2) — the missing-GR walkthrough and both credit-block records ----
  console.log('\n-- item 17: one exception, end to end')
  await goTo(BASE + '/entity/JGL/p2p/invoices/AP-104402')
  const wt0 = await evaluate(`(() => {
    const wt = document.querySelector('[data-fct-walkthrough]')
    if (!wt) return null
    const m = /Step (\\d+) of (\\d+)/.exec(wt.textContent)
    const body = wt.querySelector('[data-fct-step]')
    const dec = document.querySelector('[data-fct-decision]')
    const passSpans = dec ? Array.from(dec.querySelectorAll('span')).filter((s) => s.textContent === 'PASS').length : -1
    const failSpans = dec ? Array.from(dec.querySelectorAll('span')).filter((s) => s.textContent === 'FAIL').length : -1
    return {
      counter: m ? m[0] : null,
      stepAttr: body ? body.getAttribute('data-fct-step') : null,
      decisionId: dec ? dec.getAttribute('data-fct-decision') : null,
      passSpans, failSpans,
      accrualAction: dec ? dec.textContent.includes('Posted a reversing accrual rather than a Service Entry Sheet') : false,
      declined: dec ? dec.textContent.includes('Declined') : false,
    }
  })()`)
  check(`${themeName}/item17: AP-104402 carries the walkthrough at step 1 of 8`, !!wt0 && wt0.counter === 'Step 1 of 8' && wt0.stepAttr === '1', JSON.stringify(wt0))
  check(`${themeName}/item17: its decision record passes all five checks with no FAIL`, !!wt0 && wt0.passSpans === 5 && wt0.failSpans === 0, `pass=${wt0 ? wt0.passSpans : -1} fail=${wt0 ? wt0.failSpans : -1}`)
  check(`${themeName}/item17: the record posts a reversing accrual and states what it declined`, !!wt0 && wt0.accrualAction && wt0.declined, JSON.stringify(wt0))

  // Stepped, not animated — advance by hand; agent rows carry the AGENT tag (§15.7).
  const wtSeen = []
  for (let i = 0; i < 7; i++) {
    const advanced = await clicked('[data-fct-wt-next]', `walkthrough next ${i + 1}`)
    if (!advanced) break
    wtSeen.push(
      await evaluate(`(() => { const wt = document.querySelector('[data-fct-walkthrough]'); if (!wt) return null; const m = /Step (\\d+) of (\\d+)/.exec(wt.textContent); const body = wt.querySelector('[data-fct-step]'); return { n: m ? Number(m[1]) : null, agentTag: body ? body.textContent.includes('AGENT') : false } })()`)
    )
  }
  check(`${themeName}/item17: stepping by hand walks all eight steps and the chase step is tagged AGENT`, wtSeen.length === 7 && wtSeen.every((s, i) => s && s.n === i + 2) && !!wtSeen[0] && wtSeen[0].agentTag === true, JSON.stringify(wtSeen))
  const wtLast = await evaluate(`(() => {
    const wt = document.querySelector('[data-fct-walkthrough]')
    if (!wt) return null
    const next = wt.querySelector('[data-fct-wt-next]')
    return {
      nextDisabled: next ? next.disabled : null,
      logLink: !!wt.querySelector('a[href="/agents/provisioning"]'),
      auditLink: !!wt.querySelector('a[href="/risk-control"]'),
    }
  })()`)
  check(`${themeName}/item17: the final step disables Next and points to supervision — agent log and audit sampling`, !!wtLast && wtLast.nextDisabled === true && wtLast.logLink && wtLast.auditLink, JSON.stringify(wtLast))
  const wtReset = await clicked('[data-fct-wt-reset]', 'walkthrough start-over')
  const wtAfterReset = await evaluate(`(() => { const wt = document.querySelector('[data-fct-walkthrough]'); if (!wt) return null; const m = /Step (\\d+) of (\\d+)/.exec(wt.textContent); return m ? m[0] : null })()`)
  check(`${themeName}/item17: "Start over" returns to step 1`, wtReset === true && wtAfterReset === 'Step 1 of 8', JSON.stringify(wtAfterReset))
  await screenshot(`${themeName}-exception-walkthrough.png`)

  // The walkthrough is earned, not decorative — a sibling missing-GR row without the full arc has none.
  await goTo(BASE + '/entity/JGL/p2p/invoices/AP-104281')
  const wtNeg = await evaluate(`(() => ({ walkthrough: !!document.querySelector('[data-fct-walkthrough]'), decision: !!document.querySelector('[data-fct-decision]') }))()`)
  check(`${themeName}/item17: AP-104281 has a decision record but no walkthrough — only the full arc earns one`, wtNeg.walkthrough === false && wtNeg.decision === true, JSON.stringify(wtNeg))

  // ---- item 17b: O2C beat — release against policy, never against exposure (§15.2.1) ----
  await goTo(BASE + '/entity/JGL/customer/jgl-deccan')
  const decJgl = await evaluate(`(() => {
    const dec = document.querySelector('[data-fct-decision]')
    if (!dec) return null
    const passSpans = Array.from(dec.querySelectorAll('span')).filter((s) => s.textContent === 'PASS').length
    const failSpans = Array.from(dec.querySelectorAll('span')).filter((s) => s.textContent === 'FAIL').length
    return {
      approved: dec.textContent.includes('Release approved · not yet posted'),
      passSpans, failSpans,
      neverActsOn: dec.textContent.includes('credit release against exposure'),
      escalatesWhen: dec.textContent.includes('block caused by exposure over limit'),
    }
  })()`)
  check(`${themeName}/item17: Deccan's release is approved but not yet posted — policy defect, both checks pass`, !!decJgl && decJgl.approved && decJgl.passSpans === 2 && decJgl.failSpans === 0, JSON.stringify(decJgl))
  check(`${themeName}/item17: its delegation names the line it never crosses — release against exposure`, !!decJgl && decJgl.neverActsOn && decJgl.escalatesWhen, JSON.stringify(decJgl))

  await goTo(BASE + '/entity/JPS/customer/jps-pasir')
  const decJps = await evaluate(`(() => {
    const dec = document.querySelector('[data-fct-decision]')
    if (!dec) return null
    const passSpans = Array.from(dec.querySelectorAll('span')).filter((s) => s.textContent === 'PASS').length
    const failSpans = Array.from(dec.querySelectorAll('span')).filter((s) => s.textContent === 'FAIL').length
    return {
      escalated: dec.textContent.includes('Escalated: block caused by exposure over limit'),
      passSpans, failSpans,
    }
  })()`)
  check(`${themeName}/item17: Pasir is NOT released — the record escalates with its cause check failing`, !!decJps && decJps.escalated && decJps.passSpans === 1 && decJps.failSpans === 1, JSON.stringify(decJps))

  // A blocked customer with no logged decision shows the block but no record — nothing invented to fill the space.
  await goTo(BASE + '/entity/JCP/customer/jcp-lakeshore')
  const decNeg = await evaluate(`(() => ({ badge: document.querySelector('main').textContent.includes('CREDIT BLOCKED'), decision: !!document.querySelector('[data-fct-decision]') }))()`)
  check(`${themeName}/item17: a blocked customer with no logged decision shows the block but no record`, decNeg.badge === true && decNeg.decision === false, JSON.stringify(decNeg))
  await screenshot(`${themeName}-credit-block-records.png`)

  // ---- item 18: the preventive agent (§15.2.1) — commitments watch on the PO stage ----
  console.log('\n-- item 18: commitments watch')
  await goTo(BASE + '/entity/JGL/p2p/commitments')
  const cw = await evaluate(`(() => {
    const main = document.querySelector('main')
    if (!main) return null
    const rows = Array.from(document.querySelectorAll('[data-fct-commitments-watch] .fct-table-row'))
    const claim = document.querySelector('[data-fct-commitments-claim]')
    // the delivery-date cell is the 5th grid child (the row frame wraps the grid in one child); parse '16 Sep 2026 · …' for the sort check
    const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
    const dates = rows.map((r) => {
      const grid = r.firstElementChild
      const cell = grid && grid.children[4] ? grid.children[4].textContent : ''
      const m = /(\\d{1,2}) ([A-Z][a-z]{2}) (\\d{4})/.exec(cell || '')
      return m ? new Date(+m[3], MONTHS[m[2]], +m[1]).getTime() : null
    })
    return {
      h1: (main.querySelector('h1') || {}).textContent || null,
      rowCount: rows.length,
      rowTexts: rows.map((r) => r.textContent.trim().replace(/\\s+/g, ' ')),
      sorted: dates.every((d, i) => i === 0 || (d !== null && dates[i - 1] !== null && d >= dates[i - 1])),
      claim: claim ? claim.textContent : '',
      mainText: main.textContent.replace(/\\s+/g, ' '),
      breadcrumb: ((document.querySelector('nav[aria-label="Breadcrumb"]') || {}).textContent || '').trim(),
    }
  })()`)
  check(`${themeName}/item18: the watch loads from its URL with JGL's twelve named POs`, !!cw && cw.h1 === 'Commitments watch' && cw.rowCount === 12, JSON.stringify({ h1: cw ? cw.h1 : null, rowCount: cw ? cw.rowCount : -1 }))
  check(`${themeName}/item18: rows are ordered by delivery date`, !!cw && cw.sorted, '')
  const rowHas = (id, word) => cw ? cw.rowTexts.some((t) => t.startsWith(id) && t.includes(word)) : false
  check(`${themeName}/item18: the nine-day beat and its failure path carry their states — PO-48115 AMENDED, PO-48307 PROPOSED`, rowHas('PO-48115', 'AMENDED') && rowHas('PO-48307', 'PROPOSED'), cw ? cw.rowTexts.filter((t) => t.startsWith('PO-48115') || t.startsWith('PO-48307')).join(' | ') : '')
  check(`${themeName}/item18: the pool reconciles to the PO stage — 386 open, ₹58.4 cr committed`, !!cw && cw.mainText.includes('386') && cw.mainText.includes('₹58.4 cr'), '')
  check(`${themeName}/item18: value at risk of slipping is ₹18.4 cr — 2 chased · 1 proposed, date not yet confirmed`, !!cw && cw.mainText.includes('₹18.4 cr') && cw.mainText.includes('2 chased · 1 proposed'), '')
  check(`${themeName}/item18: the claim is true commitment data — accrual estimate named, no "prevents blocked invoices"`, !!cw && cw.claim.includes('accrual estimate') && !cw.claim.includes('prevents blocked invoices'), JSON.stringify(cw ? cw.claim.slice(0, 140) : null))
  check(`${themeName}/item18: breadcrumb shows Commitments watch under P2P`, !!cw && cw.breadcrumb.includes('Commitments watch'), JSON.stringify(cw ? cw.breadcrumb : null))
  const cwNav = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item18: the PO stage keeps the P2P cockpit active in the rail`, !!cwNav && cwNav.label.startsWith('P2P cockpit'), JSON.stringify(cwNav))

  // The drill is earned from the cockpit itself — the PO stage card links to the watch, not the worklist.
  await goTo(BASE + '/entity/JGL/p2p')
  const poHref = await readAttr('#fct-stage-PO', 'href')
  check(`${themeName}/item18: the PO stage card points at the commitments watch`, poHref === '/entity/JGL/p2p/commitments', JSON.stringify(poHref))
  await clickOn('#fct-stage-PO', 'PO stage card')
  await waitForPath((p) => p === '/entity/JGL/p2p/commitments', 'PO stage card → commitments watch')

  // ⌘K finds the screen by name; its meta states the pool and at-risk value from the dataset, never literals.
  await ctrlK()
  await waitForCommit('palette open (item 18)')
  check(`${themeName}/item18: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('commitments')`)) === true)
  await waitForText('[aria-label="Command palette"]', 'Commitments watch', '"commitments" rows rendered')
  const cwPalette = await evaluate(PALETTE_ROWS_JS)
  const cwScreenRows = cwPalette.filter((t) => /open POs · ₹[\d.]+ cr at risk/.test(t))
  check(`${themeName}/item18: "commitments" lists exactly one screen with the pool and at-risk value`, cwScreenRows.length === 1 && cwScreenRows[0].includes('Commitments watch'), JSON.stringify(cwPalette))
  const cwPick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'Commitments watch' }, 'commitments-watch palette row')
  check(`${themeName}/item18: picking the row opens the commitments watch`, cwPick === true, '')
  await waitForPath((p) => p === '/entity/JGL/p2p/commitments', 'commitments watch from the palette')
  await waitForCommit('palette pick (item 18)')
  await screenshot(`${themeName}-commitments-watch.png`)

  // ---- item 18b: the nine-day exchange and its failure path (§15.2.1) ----
  console.log('\n-- item 18b: PO detail — the agent–owner exchange')
  const poProbe = `(() => {
    const main = document.querySelector('main')
    if (!main) return null
    const ex = document.querySelector('[data-fct-po-exchange]')
    const dec = document.querySelector('[data-fct-decision]')
    const passSpans = dec ? Array.from(dec.querySelectorAll('span')).filter((s) => s.textContent === 'PASS').length : -1
    const failSpans = dec ? Array.from(dec.querySelectorAll('span')).filter((s) => s.textContent === 'FAIL').length : -1
    return {
      h1: (main.querySelector('h1') || {}).textContent || null,
      exchange: ex ? ex.textContent.replace(/\\s+/g, ' ') : '',
      decisionId: dec ? dec.getAttribute('data-fct-decision') : null,
      passSpans, failSpans,
      mainText: main.textContent.replace(/\\s+/g, ' '),
    }
  })()`
  await goTo(BASE + '/entity/JGL/p2p/commitments/PO-48115')
  const poA = await evaluate(poProbe)
  check(`${themeName}/item18b: PO-48115 loads from its URL with the exchange timeline`, !!poA && poA.h1 === 'PO-48115' && poA.exchange.length > 0, JSON.stringify({ h1: poA ? poA.h1 : null }))
  // The beat is a PO whose delivery was due in nine days — computed against today, not hardcoded.
  const MONTHS2 = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
  const wasM = poA ? /was (\d{1,2} [A-Z][a-z]{2} \d{4}) — amended/.exec(poA.mainText) : null
  let nineDays = false
  if (wasM) {
    const dm = /(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})/.exec(wasM[1])
    if (dm) {
      const orig = new Date(+dm[3], MONTHS2[dm[2]], +dm[1])
      const today = new Date(); today.setHours(0, 0, 0, 0)
      nineDays = Math.round((orig.getTime() - today.getTime()) / 86400000) === 9
    }
  }
  check(`${themeName}/item18b: the exchange is on a PO whose delivery was due in nine days`, nineDays, JSON.stringify(wasM))
  // (c) what the agent understood — quoted reply, extracted date, confidence — and (d) date-only amendment + notification.
  check(`${themeName}/item18b: the owner's reply is quoted verbatim in the timeline`, !!poA && poA.exchange.includes('Vendor confirmed the batch is pushed into'), JSON.stringify(poA ? poA.exchange.slice(0, 200) : null))
  check(`${themeName}/item18b: the record shows what it understood — extracted date and confidence level`, !!poA && /Understood: delivery moves to \d{1,2} [A-Z][a-z]{2} \d{4} — confidence 0\.\d{2}/.test(poA.exchange), '')
  check(`${themeName}/item18b: the amendment is date only and the owner was told exactly what changed`, !!poA && poA.exchange.includes('— date only') && poA.exchange.includes('No other field was changed'), '')
  check(`${themeName}/item18b: its decision record passes all three checks with no FAIL`, !!poA && poA.decisionId === 'commitments-po-PO-48115' && poA.passSpans === 3 && poA.failSpans === 0, JSON.stringify({ id: poA ? poA.decisionId : null, pass: poA ? poA.passSpans : -1, fail: poA ? poA.failSpans : -1 }))
  check(`${themeName}/item18b: the delegation names what it never touches — price, quantity, vendor`, !!poA && poA.mainText.includes('price, quantity, vendor'), '')
  await screenshot(`${themeName}-po-exchange-amended.png`)

  // The failure path (item 4): an ambiguous reply below the confidence threshold proposes and escalates instead of acting.
  await goTo(BASE + '/entity/JGL/p2p/commitments/PO-48307')
  const poP = await evaluate(poProbe)
  check(`${themeName}/item18b: PO-48307 loads with the ambiguous reply quoted`, !!poP && poP.h1 === 'PO-48307' && poP.exchange.includes('Might slip, checking with vendor'), JSON.stringify({ h1: poP ? poP.h1 : null }))
  check(`${themeName}/item18b: below threshold the agent proposes and escalates — no change made`, !!poP && /below the threshold/.test(poP.exchange) && poP.exchange.includes('no change made'), JSON.stringify(poP ? poP.exchange.slice(0, 260) : null))
  check(`${themeName}/item18b: its record fails exactly the confidence check — two PASS, one FAIL`, !!poP && poP.decisionId === 'commitments-po-PO-48307' && poP.passSpans === 2 && poP.failSpans === 1, JSON.stringify({ id: poP ? poP.decisionId : null, pass: poP ? poP.passSpans : -1, fail: poP ? poP.failSpans : -1 }))
  check(`${themeName}/item18b: the action line says it proposed and escalated, not amended`, !!poP && poP.mainText.includes('Proposed a new delivery date and escalated'), '')
  await screenshot(`${themeName}-po-exchange-proposed.png`)

  // ---- item 19: cash attribution v2 (§8.4) — spine, lens recomputation, inspector trace, drills out ----
  console.log('\n-- item 19: cash attribution v2')
  const caAll = causes.filter((c) => c.processKey === 'p2p' || c.processKey === 'o2c')
  const sumV = (cs) => cs.reduce((t, c) => t + c.valueAtRisk, 0)
  const caTotal = sumV(caAll)
  const caApSum = sumV(caAll.filter((c) => c.processKey === 'p2p'))
  const caArSum = sumV(caAll.filter((c) => c.processKey === 'o2c'))
  // §17.1 — the elimination register merged into the root cause register, and every JGL cause now carries a row:
  // the no-fix set is empty, so the noowner lens recomputes to zero and dims every band.
  // The P2P pool must tie to the entity's AP-blocked metric — the same figure the rail and entity home show.
  const jglApBlocked = entities.find((e) => e.code === 'JGL').metrics.apBlocked.current
  check(`${themeName}/item19: dataset ties — P2P cause sum equals JGL apBlocked`, Math.abs(caApSum - jglApBlocked) < 0.05, `causes=${caApSum} metric=${jglApBlocked}`)
  await goTo(BASE + '/cash-attribution')
  const caProbe = `(() => {
    const root = document.querySelector('#fct-ca')
    if (!root) return null
    const header = root.querySelector('header')
    const scopeChip = header ? (header.firstElementChild || {}).textContent : null
    const poolAp = document.querySelector('[data-fct-ca-pool="ap"]')
    const poolAr = document.querySelector('[data-fct-ca-pool="ar"]')
    const insp = document.querySelector('#fct-ca-inspector')
    const nameLink = insp ? insp.querySelector('a[href^="/root-causes?cause="]') : null
    const regLink = document.querySelector('[data-fct-ca-register-link]')
    const oppLink = document.querySelector('[data-fct-ca-opp-link]')
    return {
      scope: scopeChip ? scopeChip.trim() : null,
      total: (document.querySelector('#fct-ca-total') || {}).textContent || null,
      recon: ((document.querySelector('#fct-ca-recon') || {}).textContent || '').replace(/\\s+/g, ' '),
      clock: ((document.querySelector('[data-fct-ca-clock] b') || {}).textContent) || null,
      poolApHref: poolAp ? poolAp.getAttribute('href') : null,
      poolApText: poolAp ? poolAp.textContent.replace(/\\s+/g, ' ') : '',
      poolArHref: poolAr ? poolAr.getAttribute('href') : null,
      poolArText: poolAr ? poolAr.textContent.replace(/\\s+/g, ' ') : '',
      bandKeys: Array.from(root.querySelectorAll('[data-fct-ca-band]')).map((b) => b.getAttribute('data-fct-ca-band')).sort(),
      caption: (document.querySelector('#fct-ca-caption') || {}).textContent || null,
      nameLinkHref: nameLink ? nameLink.getAttribute('href') : null,
      nameLinkText: nameLink ? nameLink.textContent.trim() : null,
      regId: regLink ? regLink.textContent.trim() : null,
      regHref: regLink ? regLink.getAttribute('href') : null,
      oppValue: oppLink ? ((oppLink.querySelector('b') || {}).textContent) || null : null,
      oppName: oppLink ? ((oppLink.querySelectorAll('span')[0] || {}).textContent) || null : null,
      oppMeta: oppLink ? ((oppLink.querySelector('em') || {}).textContent) || null : null,
      oppHref: oppLink ? oppLink.getAttribute('href') : null,
      inspText: insp ? insp.textContent.replace(/\\s+/g, ' ') : '',
      crumb: ((document.querySelector('nav[aria-label="Breadcrumb"]') || {}).textContent) || '',
    }
  })()`
  const caA = await evaluate(caProbe)
  check(`${themeName}/item19: screen loads with JGL scope and the reconciled total`, !!caA && caA.scope === 'JGL · ' + entities.find((e) => e.code === 'JGL').name && caA.total === formatCr(caTotal), JSON.stringify({ scope: caA ? caA.scope : null, total: caA ? caA.total : null }))
  check(`${themeName}/item19: header counts every cause and ties the spine to AP blocked`, !!caA && caA.recon.includes(`${caAll.length} causes`) && caA.recon.includes(`ties to AP blocked ${formatCr(jglApBlocked)}`), JSON.stringify(caA ? caA.recon : null))
  check(`${themeName}/item19: mode clock shows the default period`, !!caA && caA.clock === 'PRE-CLOSE READINESS · 3 DAYS TO CLOSE', JSON.stringify(caA ? caA.clock : null))
  check(`${themeName}/item19: AP pool drills to the blocked worklist and carries its total`, !!caA && caA.poolApHref === '/entity/JGL/p2p/invoices' && caA.poolApText.includes(formatCr(caApSum)) && caA.poolApText.includes('Blocked AP'), JSON.stringify({ href: caA ? caA.poolApHref : null, text: caA ? caA.poolApText : '' }))
  check(`${themeName}/item19: AR pool drills to the O2C cockpit and carries its total`, !!caA && caA.poolArHref === '/entity/JGL/o2c' && caA.poolArText.includes(formatCr(caArSum)) && caA.poolArText.includes('Revenue at risk'), JSON.stringify({ href: caA ? caA.poolArHref : null, text: caA ? caA.poolArText : '' }))
  check(`${themeName}/item19: all twelve causes render as bands`, !!caA && caA.bandKeys.length === caAll.length && JSON.stringify(caA.bandKeys) === JSON.stringify(caAll.map((c) => c.key).sort()), JSON.stringify(caA ? caA.bandKeys : null))
  const mg = caAll.find((c) => c.key === 'missing-gr')
  check(`${themeName}/item19: default selection traces missing GR to its pool share`, !!caA && caA.caption === `${formatCr(mg.valueAtRisk)} · ${Math.round((mg.valueAtRisk / caApSum) * 100)}% of Blocked AP`, JSON.stringify(caA ? caA.caption : null))
  check(`${themeName}/item19: inspector names the cause and links its register section`, !!caA && caA.nameLinkHref === '/root-causes?cause=missing-gr' && caA.nameLinkText === mg.name, JSON.stringify({ href: caA ? caA.nameLinkHref : null, text: caA ? caA.nameLinkText : null }))
  // mock/rootCauses.ts — RC-001 is missing GR's largest JGL row (₹2.9 cr): eliminated, owner A. Sethi · Commercial.
  check(`${themeName}/item19: inspector shows the register row — id, owner, state`, !!caA && caA.regId === 'RC-001' && caA.regHref === '/root-causes' && caA.inspText.includes('A. Sethi · Commercial') && caA.inspText.includes('Eliminated'), JSON.stringify({ reg: caA ? caA.regId : null, insp: (caA ? caA.inspText : '').slice(0, 200) }))
  // mock/misc.ts — the one opportunity pinned against missing GR.
  const mgOpp = { name: 'Release invoices where GR posted this week', value: 4.2, items: 38, effort: 'Low', owner: 'P2P tower' }
  check(`${themeName}/item19: inspector shows the cause's cash opportunity and drills to working capital`, !!caA && caA.oppValue === formatCr(mgOpp.value) && caA.oppName === mgOpp.name && caA.oppMeta === `${mgOpp.items} items · ${mgOpp.effort} effort · ${mgOpp.owner}` && caA.oppHref === '/entity/JGL/working-capital', JSON.stringify({ v: caA ? caA.oppValue : null, n: caA ? caA.oppName : null, m: caA ? caA.oppMeta : null }))
  const nav19 = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item19: breadcrumb and rail mark the screen`, !!caA && caA.crumb.includes('Cash attribution') && !!nav19 && nav19.label.startsWith('Cash attribution'), JSON.stringify({ crumb: caA ? caA.crumb : null, nav: nav19 }))
  // Lens recomputation — the readout is derived from the surviving causes, never stored.
  await clickOn('[data-fct-ca-lens="noowner"]', 'noowner lens')
  const roNoOwner = await evaluate(`(() => ({ big: (document.querySelector('#fct-ca-ro-big') || {}).textContent, note: ((document.querySelector('#fct-ca-ro-note') || {}).textContent) || '', dimSel: document.querySelector('[data-fct-ca-band="missing-gr"]').style.opacity, litUnreg: document.querySelector('[data-fct-ca-band="duplicate-suspicion"]').style.opacity }))()`)
  check(`${themeName}/item19: no-fix lens finds nothing — every cause has a register row`, !!roNoOwner && roNoOwner.big === formatCr(0) && (roNoOwner.note || '') === 'No causes in this process match the lens.', JSON.stringify(roNoOwner))
  check(`${themeName}/item19: every band is registered, so the lens dims them all`, !!roNoOwner && roNoOwner.dimSel === '0.13' && roNoOwner.litUnreg === '0.13', JSON.stringify({ dim: roNoOwner ? roNoOwner.dimSel : null, lit: roNoOwner ? roNoOwner.litUnreg : null }))
  await clickOn('[data-fct-ca-proc="ap"]', 'process filter ap')
  const roP2p = await evaluate(`(() => ({ big: (document.querySelector('#fct-ca-ro-big') || {}).textContent, note: ((document.querySelector('#fct-ca-ro-note') || {}).textContent) || '' }))()`)
  check(`${themeName}/item19: process + lens combine — the empty set survives the P2P filter too`, !!roP2p && roP2p.big === formatCr(0) && (roP2p.note || '') === 'No causes in this process match the lens.', JSON.stringify(roP2p))
  await clickOn('[data-fct-ca-proc="all"]', 'process filter all')
  await clickOn('[data-fct-ca-lens="all"]', 'lens all')
  const roReset = await evaluate(`(() => (document.querySelector('#fct-ca-ro-big') || {}).textContent)()`)
  check(`${themeName}/item19: clearing both filters restores the full total`, roReset === formatCr(caTotal), JSON.stringify(roReset))
  // Selection change — a different cause re-traces its own pool share and register row; an in-progress row shows its target date.
  // The band's centre can sit on the name anchor (which drills to the register); xf=0.1 clicks the row's left
  // hit area, where only selectCause lives — "the rest of the row selects in place" (§8.4).
  const caApp = caAll.find((c) => c.key === 'cash-application')
  await clickOn({ css: '[data-fct-ca-band="cash-application"]', xf: 0.1 }, 'band cash-application')
  // The band's reveal is a second commit (+420ms setFxOn timeout in CashAttributionV2) that lands after clickOn's settle
  // window — waitForCommit cannot see scheduled-but-unfired commits, so settle again before probing.
  await waitForCommit('after band selection (delayed reveal commit)')
  const caB = await evaluate(caProbe)
  check(`${themeName}/item19: selecting another cause re-traces its pool share`, !!caB && caB.caption === `${formatCr(caApp.valueAtRisk)} · ${Math.round((caApp.valueAtRisk / caArSum) * 100)}% of Revenue at risk`, JSON.stringify(caB ? caB.caption : null))
  // mock/rootCauses.ts — RC-031 is cash application's largest JGL row: in progress, target +24 d from the start-of-day anchor.
  check(`${themeName}/item19: the in-progress row shows its register id and target date`, !!caB && caB.regId === 'RC-031' && caB.inspText.includes('+24 d') && caB.inspText.includes('J. Halloran · Treasury'), JSON.stringify({ reg: caB ? caB.regId : null, insp: (caB ? caB.inspText : '').slice(0, 200) }))
  // mock/misc.ts — the opportunity pinned against cash application drills to working capital.
  const appOpp = { name: 'Apply matched receipts to open AR', value: 2.1, items: 19, effort: 'Low', owner: 'Cash application' }
  check(`${themeName}/item19: inspector shows the cause's cash opportunity and drills to working capital`, !!caB && caB.oppValue === formatCr(appOpp.value) && caB.oppName === appOpp.name && caB.oppMeta === `${appOpp.items} items · ${appOpp.effort} effort · ${appOpp.owner}` && caB.oppHref === '/entity/JGL/working-capital', JSON.stringify({ v: caB ? caB.oppValue : null, n: caB ? caB.oppName : null, m: caB ? caB.oppMeta : null, h: caB ? caB.oppHref : null }))
  // A cause with no listed opportunity says so rather than inventing one; its identified row carries no target date.
  const tax = caAll.find((c) => c.key === 'tax-mismatch')
  await clickOn({ css: '[data-fct-ca-band="tax-mismatch"]', xf: 0.1 }, 'band tax-mismatch')
  // Second settle — same delayed reveal commit as above, before the caC probes and the pool-anchor navigation.
  await waitForCommit('after band selection (delayed reveal commit)')
  const caC = await evaluate(caProbe)
  check(`${themeName}/item19: the third selection re-traces its own pool share`, !!caC && caC.caption === `${formatCr(tax.valueAtRisk)} · ${Math.round((tax.valueAtRisk / caApSum) * 100)}% of Blocked AP`, JSON.stringify(caC ? caC.caption : null))
  check(`${themeName}/item19: a cause with no listed opportunity says so`, !!caC && caC.inspText.includes('No cash opportunity listed against this cause.'), '')
  // mock/rootCauses.ts — RC-016 is tax mismatch's largest JGL row: identified, so the register carries no target date.
  check(`${themeName}/item19: an identified row shows its state and no invented target`, !!caC && caC.regId === 'RC-016' && caC.inspText.includes('Identified') && caC.inspText.includes('— none set'), JSON.stringify({ reg: caC ? caC.regId : null, insp: (caC ? caC.inspText : '').slice(0, 200) }))
  // Drills out — real clicks on the SVG anchors (script .click() does not navigate SVG <a>).
  const poolRect = await evaluate(`(() => { const el = document.querySelector('[data-fct-ca-pool="ap"] rect'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
  check(`${themeName}/item19: AP pool anchor is on screen`, !!poolRect && poolRect.x > 0 && poolRect.y > 0, JSON.stringify(poolRect))
  // The painted target is the pool's colour block — the <a>'s own box centre falls in unpainted space between its text lines.
  await clickOn('[data-fct-ca-pool="ap"] rect', 'AP pool anchor')
  await waitForPath((p) => p === '/entity/JGL/p2p/invoices', 'AP pool drill')
  await goTo(BASE + '/cash-attribution')
  const caBandHref = await readAttr('[data-fct-ca-band="cash-application"] a', 'href')
  check(`${themeName}/item19: the band name links its register section`, caBandHref === '/root-causes?cause=cash-application', JSON.stringify(caBandHref))
  // The band name is a native anchor — a full reload. clickOn detects the document swap and waits for the reloaded
  // app to commit (shell included, whose window keydown listener the palette needs) before returning.
  // Target the <text>, not the <a>: SVG text is hit-tested per glyph, and the resolver aims at a real character.
  await clickOn('[data-fct-ca-band="cash-application"] a text', 'band-name drill')
  await waitForUrl('/root-causes?cause=cash-application', 'band-name drill')
  // ⌘K — the screen is findable with its cause count and stuck value.
  await ctrlK()
  await waitForCommit('palette open (item 19)')
  check(`${themeName}/item19: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('cash attribution')`)) === true)
  await waitForText('[aria-label="Command palette"]', 'Cash attribution', '"cash attribution" rows rendered')
  const caPalette = await evaluate(PALETTE_ROWS_JS)
  const caRows = caPalette.filter((t) => t.includes('Cash attribution'))
  check(`${themeName}/item19: "cash attribution" lists exactly one screen with the cause count and stuck value`, caRows.length === 1 && caRows[0].includes(`${caAll.length} causes · ${formatCr(caTotal)} stuck`), JSON.stringify(caPalette))
  const caPick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'Cash attribution' }, 'cash-attribution palette row')
  check(`${themeName}/item19: picking the row opens the screen`, caPick === true, '')
  await waitForPath((p) => p === '/cash-attribution', 'cash attribution from the palette')
  await waitForCommit('palette pick (item 19)')
  await screenshot(`${themeName}-cash-attribution.png`)

  // ---- theme legibility: status colors + ageing-bar fills on the cockpits; the register carries no fill-coloured
  // elements (state colours are text), so it is contrast-audited only ----
  console.log(`\n-- legibility (${themeName}): O2C + R2R cockpits, register contrast`)
  const fillTargets = [palette.accent, palette.ageingBarAlt, palette.statusGreen, palette.statusAmber, palette.statusRed].map(hexToRgb)
  for (const [route, name] of [
    ['/entity/JGL/o2c', 'o2c-cockpit'],
    // §16.2 — shares StageFlow with O2C; Step 26's panels add fills of their own, so this route carries fill pairs to audit
    ['/entity/JGL/r2r', 'r2r-cockpit'],
  ]) {
    await goTo(BASE + route)
    reports.push({ theme: themeName, name, pairs: await evaluate(AUDIT_JS) })
    const fills = await evaluate(`(${FILL_AUDIT_JS})(${JSON.stringify(fillTargets)})`)
    // Harness guard: an empty census would let a whole route's fills go unaudited while the run stays green.
    check(`${themeName}/${name}: fill audit found at least one fill pair`, Object.keys(fills).length >= 1, `pairs=${Object.keys(fills).length}`)
    for (const [k, count] of Object.entries(fills)) {
      const [fill, bg] = k.split('|')
      const ratio = contrast(fill, bg)
      check(`${themeName}/${name}: fill ${fill} on ${bg} ≥ 3:1`, ratio >= 3.0, `ratio=${ratio.toFixed(2)} (x${count})`)
    }
    await screenshot(`${themeName}-${name}.png`)
  }
  for (const [route, name] of [
    ['/root-causes', 'root-causes'],
    ['/root-causes?cause=missing-gr', 'root-causes-missing-gr'],
    // §18 — the requisition pipeline: chase-state text in all three colours, no fill-coloured elements (text-only audit)
    ['/entity/JGL/requisitions', 'requisitions'],
  ]) {
    await goTo(BASE + route)
    reports.push({ theme: themeName, name, pairs: await evaluate(AUDIT_JS) })
    await screenshot(`${themeName}-${name}.png`)
  }

  // ---- new nav item's active state vs its P2P sibling ----
  console.log(`\n-- active nav state (${themeName}): O2C cockpit item vs P2P cockpit item`)
  const expectActive = (nav, labelPrefix, tag) => {
    check(`${tag}: active item is ${labelPrefix}`, !!nav && nav.label.startsWith(labelPrefix), JSON.stringify(nav))
    if (!nav) return null
    // Clay design — the active pill is an accent fill with ink text and a raised shadow; no left-border indicator (index.css .fct-nav-item--active).
    check(`${tag}: active background is accent`, sameColor(nav.bg, palette.accent), `got=${nav.bg} want=${palette.accent}`)
    check(`${tag}: active text is accentInk`, sameColor(nav.color, palette.accentInk), `got=${nav.color} want=${palette.accentInk}`)
    check(`${tag}: no left-border indicator on the active pill`, nav.borderLeftW === '0px', `width=${nav.borderLeftW}`)
    return { bg: nav.bg, color: nav.color }
  }
  await goTo(BASE + '/entity/JGL/p2p')
  const p2pActive = expectActive(await evaluate(NAV_ACTIVE_JS), 'P2P cockpit', `${themeName}/nav:p2p`)
  await goTo(BASE + '/entity/JGL/o2c')
  const o2cActive = expectActive(await evaluate(NAV_ACTIVE_JS), 'O2C cockpit', `${themeName}/nav:o2c`)
  check(`${themeName}/nav: O2C active state matches its P2P sibling`,
    !!p2pActive && !!o2cActive && p2pActive.bg === o2cActive.bg && p2pActive.color === o2cActive.color,
    `p2p=${JSON.stringify(p2pActive)} o2c=${JSON.stringify(o2cActive)}`)

  // ---- item 20: requisitions (§18) — the PR stage drills to the pipeline; the unconverted pool ties to §7.4 ----
  console.log('\n-- item 20: requisitions')
  await goTo(BASE + '/entity/JGL/p2p')
  const prHref = await readAttr('#fct-stage-PR', 'href')
  check(`${themeName}/item20: the PR stage card points at the requisition pipeline`, prHref === '/entity/JGL/requisitions', JSON.stringify(prHref))
  await clickOn('#fct-stage-PR', 'PR stage card')
  await waitForPath((p) => p === '/entity/JGL/requisitions', 'PR stage card → requisitions')

  // Deep link — the screen stands on its own: title, breadcrumb, active rail entry and §18.1's pinned pipeline (JGL).
  await goTo(BASE + '/entity/JGL/requisitions')
  const reqState = await evaluate(`(() => {
    const h1 = document.querySelector('h1')
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    const pipe = document.querySelector('[data-fct-pipeline]')
    const table = document.querySelector('[data-fct-requisitions]')
    return {
      title: h1 ? h1.textContent : null,
      breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null,
      prs: pipe ? Number(pipe.getAttribute('data-prs')) : -1,
      converted: pipe ? Number(pipe.getAttribute('data-converted')) : -1,
      unconverted: pipe ? Number(pipe.getAttribute('data-unconverted')) : -1,
      rows: table ? table.querySelectorAll('.fct-table-row').length : -1,
      causes: document.querySelectorAll('[data-fct-pr-cause]').length,
      budgetSrc: (document.querySelector('[data-fct-budget-panel]') || { textContent: '' }).textContent,
      agents: Array.from(document.querySelectorAll('[data-fct-req-agent]')).map((el) => el.getAttribute('data-fct-req-agent')),
    }
  })()`)
  check(`${themeName}/item20: deep link renders the screen with its breadcrumb`, reqState.title === 'Requisitions' && !!reqState.breadcrumb && reqState.breadcrumb.includes('Requisitions'), JSON.stringify({ title: reqState.title, bc: reqState.breadcrumb }))
  // §18.1 — JGL's pinned pipeline; unconverted = PR − PO, the same figures the stage cards above carry.
  check(`${themeName}/item20: JGL's pipeline is 412 in flight · 386 converted · 26 unconverted`, reqState.prs === 412 && reqState.converted === 386 && reqState.unconverted === 26, JSON.stringify({ prs: reqState.prs, converted: reqState.converted, unconverted: reqState.unconverted }))
  check(`${themeName}/item20: the table carries all 26 unconverted PRs`, reqState.rows === 26, `rows=${reqState.rows}`)
  check(`${themeName}/item20: the six §18.1 causes are named on screen`, reqState.causes === 6, `causes=${reqState.causes}`)
  check(`${themeName}/item20: the budget panel states its source is the Spend Control Tower`, !!reqState.budgetSrc && reqState.budgetSrc.includes('Spend Control Tower'), JSON.stringify((reqState.budgetSrc || '').slice(0, 80)))
  // §18.2 — the five agents in roster order; the preventive ones tag what they prevent with the taxonomy's share.
  check(`${themeName}/item20: the five requisition agents are listed in roster order`, JSON.stringify(reqState.agents) === JSON.stringify(['budget-exposure', 'contract-catalogue-routing', 'pr-completeness', 'duplicate-pr', 'pr-ageing-chase']), JSON.stringify(reqState.agents))
  const reqPrevents = await evaluate(`(() => {
    const a24 = document.querySelector('[data-fct-req-agent="contract-catalogue-routing"]')
    const a26 = document.querySelector('[data-fct-req-agent="duplicate-pr"]')
    return { a24: a24 ? a24.textContent : '', a26: a26 ? a26.textContent : '' }
  })()`)
  check(`${themeName}/item20: contract routing tags the cause it prevents with its share of blocked AP`, reqPrevents.a24.includes('PO price mismatch · 22% of blocked AP'), JSON.stringify(reqPrevents.a24.slice(0, 120)))
  check(`${themeName}/item20: duplicate PR tags the cause it prevents with its share of blocked AP`, reqPrevents.a26.includes('Duplicate suspicion · 8% of blocked AP'), JSON.stringify(reqPrevents.a26.slice(0, 120)))

  // ⌘K — the screen is findable with its unconverted pool.
  await ctrlK()
  await waitForCommit('palette open (item 20)')
  check(`${themeName}/item20: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('requisitions')`)) === true)
  await waitForText('[aria-label="Command palette"]', 'Requisitions', '"requisitions" rows rendered')
  const reqPalette = await evaluate(PALETTE_ROWS_JS)
  const reqScreenRows = reqPalette.filter((t) => /unconverted PRs/.test(t))
  check(`${themeName}/item20: "requisitions" lists exactly one screen with the unconverted pool`, reqScreenRows.length === 1 && reqScreenRows[0].includes('Requisitions') && reqScreenRows[0].includes('26 unconverted PRs'), JSON.stringify(reqPalette))
  const reqPick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'Requisitions' }, 'requisitions palette row')
  check(`${themeName}/item20: picking the row opens the screen`, reqPick === true, '')
  await waitForPath((p) => p === '/entity/JGL/requisitions', 'requisitions from the palette')
  await waitForCommit('palette pick (item 20)')
  await screenshot(`${themeName}-requisitions.png`)

  // ---- item 21: O2C worklist (§18.3) — the same shape as the P2P pair with its own data; stage drills per §18.4 ----
  console.log('\n-- item 21: O2C worklist')
  const jgl = entities.find((e) => e.code === 'JGL')
  const o2cCauses = causes.filter((c) => c.processKey === 'o2c')
  // mock/exceptions.ts — JGL's pinned sample: twelve rows summing to ₹9.60 cr; eight of them are >30 days, ₹7.96 cr.
  const O2C_SAMPLE_TOTAL = 9.6
  const O2C_STALE = 7.96

  // §18.4 — the seven stage cards point at the worklist pre-filtered to that stage's causes; Delivery keeps the full list.
  await goTo(BASE + '/entity/JGL/o2c')
  for (const [step, want] of [
    ['ORD', '/entity/JGL/o2c/invoices?cause=customer-master'],
    ['CRD', '/entity/JGL/o2c/invoices?cause=credit-block'],
    ['DLV', '/entity/JGL/o2c/invoices'],
    ['BIL', '/entity/JGL/o2c/invoices?cause=billing-errors,pricing-disputes'],
    ['DSP', '/entity/JGL/o2c/invoices?cause=billing-errors'],
    ['COL', '/entity/JGL/o2c/invoices?cause=credit-block,pricing-disputes'],
    ['CSH', '/entity/JGL/o2c/invoices?cause=cash-application,deductions'],
  ]) {
    check(`${themeName}/item21: the ${step} stage card drills the worklist to its causes`, (await readAttr(`#fct-stage-${step}`, 'href')) === want, JSON.stringify(await readAttr(`#fct-stage-${step}`, 'href')))
  }

  // Deep link — the screen stands on its own: title, breadcrumb and the Worklist rail entry.
  await goTo(BASE + '/entity/JGL/o2c/invoices')
  const o2w = await evaluate(`(() => {
    const h1 = document.querySelector('h1')
    const bc = document.querySelector('nav[aria-label="Breadcrumb"]')
    return { title: h1 ? h1.textContent : null, breadcrumb: bc ? bc.textContent.trim().replace(/\\s+/g, ' ') : null }
  })()`)
  check(`${themeName}/item21: deep link renders the screen with its breadcrumb`, o2w.title === 'O2C exceptions worklist' && !!o2w.breadcrumb && o2w.breadcrumb.includes('Invoices'), JSON.stringify(o2w))
  const nav21 = await evaluate(NAV_ACTIVE_JS)
  check(`${themeName}/item21: the Worklist rail entry is active, like its P2P pair`, !!nav21 && nav21.label.startsWith('Worklist'), JSON.stringify(nav21))

  // §7.20 — sample against pool, unfiltered: all six O2C causes pooled (largest-remainder sums exactly to o2cExceptionCount).
  const o2wMain = await evaluate(`(() => { const el = document.querySelector('main'); return el ? el.textContent : '' })()`)
  check(`${themeName}/item21: header states the sample against the entity pool`, !!o2wMain && o2wMain.includes(`12 of ${jgl.metrics.o2cExceptionCount} shown`), (o2wMain || '').slice(0, 200))
  check(`${themeName}/item21: header ties the sample value to the pooled cause values`, !!o2wMain && o2wMain.includes(`${formatCr(O2C_SAMPLE_TOTAL, 2)} of ${formatCr(o2cCauses.reduce((s, c) => s + c.valueAtRisk, 0))}`), '')
  check(`${themeName}/item21: header carries the >30-day share`, !!o2wMain && o2wMain.includes(`>30 days ${formatCr(O2C_STALE, 2)}`), '')

  // §15.7 — every row's agent lane says why it never ran; no cycle button on a process agents do not cover.
  const o2wLanes = await evaluate(`(() => Array.from(document.querySelectorAll('.fct-table-row')).map((r) => r.textContent))()`)
  check(`${themeName}/item21: all twelve rows render`, o2wLanes.length === 12, `rows=${o2wLanes.length}`)
  check(`${themeName}/item21: every lane reads never-automated — no live agent for O2C causes in this build`, o2wLanes.every((t) => t.includes('No live agent for this cause in this build')), JSON.stringify(o2wLanes[0] || ''))
  check(`${themeName}/item21: no cycle button on a process agents do not cover`, (await evaluate(`document.querySelector('main').textContent.includes('Run the next cycle')`)) === false, '')

  // §18.4 — the Collection drill's figure: credit-block + pricing-disputes, five sample rows against their pooled 122.
  await goTo(BASE + '/entity/JGL/o2c/invoices?cause=credit-block,pricing-disputes')
  const o2wCol = await evaluate(`(() => { const el = document.querySelector('main'); return el ? el.textContent : '' })()`)
  check(`${themeName}/item21: the cause filter pools its own causes — 5 of 122 shown`, !!o2wCol && o2wCol.includes('5 of 122 shown'), (o2wCol || '').slice(0, 200))
  check(`${themeName}/item21: the filtered value ties to the two causes' values at risk`, !!o2wCol && o2wCol.includes(`₹4.67 cr of ${formatCr(7.5)}`), '')

  // §17.10 — a register row reaches its traced items: RC-019 (pricing disputes, fixed at source) holds AR-704001 in JGL's sample.
  await goTo(BASE + '/entity/JGL/o2c/invoices?rc=RC-019')
  const o2wRc = await evaluate(`(() => { const el = document.querySelector('main'); return el ? el.textContent : '' })()`)
  check(`${themeName}/item21: the register drill shows its traced items against the entry's pool`, !!o2wRc && o2wRc.includes('1 of 40 shown') && o2wRc.includes('AR-704001'), (o2wRc || '').slice(0, 200))

  // Item detail — the shared transaction screen follows the row's own process.
  await clickOn({ scope: 'main', tags: 'a', text: 'AR-704001' }, 'O2C item link')
  await waitForPath((p) => p === '/entity/JGL/o2c/invoices/AR-704001', 'O2C item detail')
  const o2dMain = await evaluate(`(() => { const el = document.querySelector('main'); return el ? el.textContent : '' })()`)
  check(`${themeName}/item21: the detail back link returns to the O2C worklist`, (await readAttr('a.fct-link', 'href')) === '/entity/JGL/o2c/invoices', JSON.stringify(await readAttr('a.fct-link', 'href')))
  check(`${themeName}/item21: responsible function names the cause's originating function`, !!o2dMain && o2dMain.includes('O2C tower — Commercial'), '')
  check(`${themeName}/item21: next action carries the open line with its escalation timer`, !!o2dMain && o2dMain.includes('Awaiting rate confirmation from commercial') && o2dMain.includes('escalation due in'), '')
  check(`${themeName}/item21: no payables vocabulary on a receivables row`, !!o2dMain && !o2dMain.includes('payables completeness') && !o2dMain.includes('Chase GR'), '')

  // ⌘K — the screen is findable with its pool, like its P2P pair.
  await ctrlK()
  await waitForCommit('palette open (item 21)')
  check(`${themeName}/item21: palette input accepts typing`, (await evaluate(`(${TYPE_JS})('o2c exceptions')`)) === true)
  await waitForText('[aria-label="Command palette"]', 'O2C exceptions worklist', '"o2c exceptions" rows rendered')
  const o2wPalette = await evaluate(PALETTE_ROWS_JS)
  const o2wScreenRows = o2wPalette.filter((t) => t.includes('O2C exceptions worklist'))
  check(`${themeName}/item21: "o2c exceptions" lists exactly one screen with the pool count`, o2wScreenRows.length === 1 && o2wScreenRows[0].includes(`${jgl.metrics.o2cExceptionCount} items`), JSON.stringify(o2wPalette))
  const o2wPick = await clicked({ scope: '[aria-label="Command palette"]', tags: '.fct-palette-row', text: 'O2C exceptions worklist' }, 'o2c worklist palette row')
  check(`${themeName}/item21: picking the row opens the screen`, o2wPick === true, '')
  await waitForPath((p) => p === '/entity/JGL/o2c/invoices', 'o2c worklist from the palette')
  await waitForCommit('palette pick (item 21)')
  await screenshot(`${themeName}-o2c-worklist.png`)

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
