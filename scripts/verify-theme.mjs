// Theme verification driver (headless Chrome + CDP).
// Programmatic checks per theme: exact CSS-var values, in-situ WCAG contrast audit,
// hover/focus simulation, command-palette scrim+shadow, AI drawer bubbles, persistence.
//
// Usage:  npm run verify:theme        (dev server must be running on :5200)
// Env overrides:
//   FCT_CHROME     path to a Chrome/Chromium executable (default: Windows x86 install)
//   FCT_BASE_URL   app base URL (default http://localhost:5200)
//   FCT_SHOTS_DIR  where screenshots are written (default <tmp>/fct-theme-verify/shots)
//   FCT_DEBUG_PORT Chrome DevTools port (default 9333; Windows may reserve ranges — pick a free one)
//
// Palettes are imported from src/theme/tokens.ts via Node's type stripping, so this
// script can never drift from the source of truth — a palette edit is verified against itself.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dark, light } from '../src/theme/tokens.ts'

const CHROME = process.env.FCT_CHROME ?? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
const PORT = Number(process.env.FCT_DEBUG_PORT ?? 9333)
const BASE = process.env.FCT_BASE_URL ?? 'http://localhost:5200'
const OUT = process.env.FCT_SHOTS_DIR ?? path.join(os.tmpdir(), 'fct-theme-verify', 'shots')
fs.mkdirSync(OUT, { recursive: true })

const toKebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

// ---------- color math ----------
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

// ---------- results ----------
const failures = []
let passCount = 0
function check(name, ok, detail = '') {
  if (ok) { passCount++; console.log(`PASS  ${name}`) }
  else { failures.push(name); console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

// ---------- chrome + CDP ----------
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
  // settle: readyState complete + theme vars applied to body/html background
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
const TAB = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }
const ESC = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }
async function ctrlK() {
  await key('keyDown', { key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, nativeVirtualKeyCode: 75, modifiers: 2 })
  await key('keyUp', { key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, nativeVirtualKeyCode: 75, modifiers: 2 })
}
async function mouseMove(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }) }
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

// ---------- in-page probes ----------
// Key list is built from the imported palette — a new token is dumped automatically.
const VAR_KEYS = JSON.stringify(Object.keys(dark))
const VAR_DUMP_JS = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  ${VAR_KEYS}.forEach((k) => {
    out[k] = cs.getPropertyValue('--' + k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase())
  })
  out.__bodyBg = getComputedStyle(document.body).backgroundColor
  out.__htmlBg = getComputedStyle(document.documentElement).backgroundColor
  return out
})()`

const AUDIT_JS = `(() => {
  const transparent = 'rgba(0, 0, 0, 0)'
  const pairs = {}   // "fg|bg" -> count (text elements only)
  const fills = {}   // backgroundColor value -> element count (census of surfaces)
  const borders = {} // borderTopColor value -> element count (census of border colors)
  // main-scoped census: page content only. The rail and top bar sit outside <main> and carry
  // their own fills, borders and text on every route, so a document-wide census would let the
  // chrome satisfy per-route presence checks for the wrong reason.
  const mainPairs = {}
  const mainFills = {}
  const mainBorders = {}
  const els = Array.from(document.querySelectorAll('body *'))
  for (const el of els) {
    const inMain = !!el.closest('main')
    let txt = ''
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) txt += n.textContent
    const cs = getComputedStyle(el)
    const bg = cs.backgroundColor
    if (bg && bg !== transparent) {
      fills[bg] = (fills[bg] || 0) + 1
      if (inMain) mainFills[bg] = (mainFills[bg] || 0) + 1
    }
    const bc = cs.borderTopColor
    if (bc && bc !== transparent && cs.borderTopWidth !== '0px') {
      borders[bc] = (borders[bc] || 0) + 1
      if (inMain) mainBorders[bc] = (mainBorders[bc] || 0) + 1
    }
    if (!txt.trim()) continue
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
    if (inMain) mainPairs[k] = (mainPairs[k] || 0) + 1
  }
  return { pairs, fills, borders, mainPairs, mainFills, mainBorders }
})()`

const FIND_BY_TEXT_JS = `(text) => {
  const els = Array.from(document.querySelectorAll('button, a'))
  const el = els.find((e) => e.textContent.trim().replace(/\\s+/g, ' ').includes(text))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: el.textContent.trim().slice(0, 60), cls: el.className }
}`

const RECT_JS = `(sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
}`

// Hover probe: mark a NON-active nav item / chip (active ones pin their own styles),
// then read its computed style before/after the mouse moves over it.
const HOVER_PREP_JS = `(() => {
  const cands = Array.from(document.querySelectorAll('.fct-nav-item:not(.fct-nav-item--active), .fct-chip:not(.fct-chip--active)'))
  const el = cands.find((e) => e.getBoundingClientRect().width > 0)
  if (!el) return null
  document.querySelectorAll('[data-probe]').forEach((n) => n.removeAttribute('data-probe'))
  el.setAttribute('data-probe', '1')
  const r = el.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
})()`

const HOVER_STYLE_JS = `(() => {
  const el = document.querySelector('[data-probe]')
  if (!el) return null
  const cs = getComputedStyle(el)
  return { bg: cs.backgroundColor, border: cs.borderTopColor, color: cs.color }
})()`

// AI drawer census: user bubbles (bgAccentSoft fill), assistant bubble borders, follow-up chips.
const DRAWER_CHECK_JS = `(softHex, borderHex) => {
  const toRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
  const eq = (css, hex) => {
    const m = css.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return false
    const p = m[1].split(',').map(parseFloat)
    const [r, g, b] = toRgb(hex)
    return Math.abs(p[0]-r) <= 1 && Math.abs(p[1]-g) <= 1 && Math.abs(p[2]-b) <= 1
  }
  let softBubbles = 0, assistantBorders = 0, followups = 0
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (eq(cs.backgroundColor, softHex)) softBubbles++
    if (eq(cs.borderTopColor, borderHex)) assistantBorders++
    if (el.classList.contains('fct-followup-chip')) followups++
  }
  return { softBubbles, assistantBorders, followups }
}`

// ---------- theme pass ----------
const ROUTES = [
  ['/', 'group'],
  ['/entity/JGL', 'entity-home'],
  ['/entity/JGL/p2p', 'p2p-cockpit'],
  ['/entity/JGL/o2c', 'o2c-cockpit'],
  ['/entity/JGL/p2p/invoices', 'worklist'],
  ['/entity/JGL/p2p/invoices/AP-104281', 'exception-detail'],
  ['/entity/JGL/root-cause/p2p/missing-gr', 'root-cause-p2p'],
  ['/entity/JGL/root-cause/o2c/pricing-disputes', 'root-cause-o2c'],
  ['/entity/JGL/working-capital', 'working-capital'],
  ['/risk-control', 'risk-control'],
  ['/compliance', 'compliance'],
  ['/data-quality', 'data-quality'],
  ['/service-desk', 'service-desk'],
  ['/cause-backlog', 'cause-backlog'],
  ['/entity/JGL/predictive', 'predictive'],
  // Screens built since Step 3b — the contrast walk must reach every one of them (Step 16 item 10)
  ['/entity/JGL/service', 'service-attribution'],
  ['/entity/JGL/vendor/suraksha-chemicals-pvt-ltd', 'vendor-page'],
  ['/entity/JGL/customer/jgl-amrit', 'customer-page'],
  ['/entity/JGL/cost-centre/jgl-nanjangud-operations', 'cost-centre-page'],
  ['/entity/JGL/plant/jgl-nanjangud', 'plant-page'],
  // The capped entity — the walk must reach JRP so the veto pairing is audited in situ, not only by unit test
  ['/entity/JRP', 'jrp-entity-home'],
  // §15 — the agent workforce; the never-automate box makes it a contrast-audit target too
  ['/agents', 'agents'],
  // §15.7 — the per-agent record page; reuses the roster's record block, so its pairs are already audited there
  ['/agents/follow-up', 'agent-detail'],
  // §15.3/§15.4 — touch economics; mono stat labels and raised stage cards are the audit targets
  ['/touch-economics', 'touch-economics'],
  // §15.7 — the commitments watch (chase-state badges in all four colours on JGL) and its PO detail (the amended beat)
  ['/entity/JGL/p2p/commitments', 'commitments-watch'],
  ['/entity/JGL/p2p/commitments/PO-48115', 'po-detail'],
]

// colors each route must show somewhere (evidence from source grep) — resolved via palette
const EXPECTED_PRESENT = {
  group: ['statusGreen', 'statusRed', 'textFaint', 'borderDefault'],
  'entity-home': ['statusAmber', 'statusRed', 'accentText'],
  'p2p-cockpit': ['statusAmber', 'statusRed', 'ageingBarAlt', 'accent'],
  'o2c-cockpit': ['statusAmber', 'statusRed', 'ageingBarAlt', 'accent'],
  worklist: ['accentText', 'textFaint'],
  'exception-detail': ['statusGreen', 'statusRed'],
  'root-cause-p2p': ['accentText', 'textFaint'],
  'root-cause-o2c': ['accentText', 'textFaint'],
  'working-capital': ['statusGreen', 'chartArOld', 'accent'], // no amber on the page itself — statusAmber was only ever in the top-bar score chip
  'risk-control': ['statusRed', 'bgRiskSoft', 'accentText'], // + agent governance rows drill into the record via accent links
  compliance: ['statusGreen', 'statusAmber', 'statusRed'], // filed / due / overdue tags
  'data-quality': ['statusGreen', 'statusAmber', 'statusRed'], // DQ-score header colours + interface health tags
  'service-desk': ['statusRed', 'statusGreen', 'textFaint', 'borderDefault'], // queue SLA words (breached/met) + measuring-since line
  'cause-backlog': ['statusGreen', 'statusAmber', 'accentText', 'borderDefault'], // elimination status colours + cause back-links
  predictive: ['statusAmber'], // base case renders four OPEN AT MONTH-END tags
  'service-attribution': ['accent', 'ageingBarAlt', 'borderAccent', 'statusAmber'], // SLA split segments (thirdParty folds into system) + JGL health score amber
  'vendor-page': ['accentText', 'statusRed', 'textFaint', 'accent'], // invoice links; Suraksha items at 41d/52d age red; single non-zero bucket bars accent
  'customer-page': ['statusGreen', 'textFaint', 'borderDefault', 'accent', 'ageingBarAlt'], // jgl-amrit is OPEN (not credit-blocked); seeded ageing keeps all five buckets non-zero
  'cost-centre-page': ['statusRed', 'accent', 'statusAmber', 'textFaint'], // Nanjangud Operations runs over budget; booked/committed bars
  'plant-page': ['accentText', 'statusRed', 'statusAmber', 'textFaint'], // Nanjangud items at 41d/52d red, 21d amber
  'jrp-entity-home': ['statusRed', 'statusAmber', 'accentText', 'textFaint', 'bgWarnSoft'], // capped entity: RED score + CAPPED badge, warn-soft cap strips
  agents: ['accentText', 'statusAmber', 'bgRiskSoft', 'borderDefault'], // type chips (preventive/reactive), never-automate items, sim tags
  'agent-detail': ['bgPanel', 'bgRaised', 'borderDefault', 'textMuted', 'textFaint', 'accentText'], // §15.7 record page: card + raised record block, sim tag, field labels, action-log links
  'touch-economics': ['textFaint', 'textMuted', 'borderDefault', 'bgRaised'], // mono stat/section labels, sim tag + touches-per-thousand captions, card borders, raised lever-stage cards
  'commitments-watch': ['statusRed', 'statusAmber', 'statusGreen', 'textFaint'], // JGL carries all four chase states (at-risk tile red, chased amber, amended green) + mono metric labels
  'po-detail': ['statusGreen', 'accentText', 'textFaint', 'borderDefault'], // PO-48115 is the amended beat: green badge/dots, AGENT tags + cost-centre link, time sub-labels, card borders
}

async function themePass(themeName, palette) {
  console.log(`\n=== ${themeName.toUpperCase()} PASS ===`)
  // set storage then reload so main.tsx bootstrap path is exercised
  await navigate(BASE + '/')
  await evaluate(`localStorage.setItem('fct-theme', '${themeName}')`)
  const reloaded = waitForEvent('Page.loadEventFired', 20000)
  await send('Page.reload')
  await reloaded
  for (let i = 0; i < 40; i++) {
    const ok = await evaluate(`getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'`)
    if (ok) break
    await new Promise((r) => setTimeout(r, 250))
  }

  // 1. exact CSS variable values
  const dump = await evaluate(VAR_DUMP_JS)
  let varFails = []
  for (const [k, expected] of Object.entries(palette)) {
    if (!sameColor(dump[k], expected)) varFails.push(`${toKebab(k)}: got ${JSON.stringify(dump[k])} want ${expected}`)
  }
  check(`${themeName}: all ${Object.keys(palette).length} CSS vars match palette`, varFails.length === 0, varFails.slice(0, 4).join('; '))
  const bodyOk = sameColor(dump.__bodyBg, palette.bgRoot) || sameColor(dump.__htmlBg, palette.bgRoot)
  check(`${themeName}: page background resolves to bgRoot`, bodyOk, `body=${dump.__bodyBg} html=${dump.__htmlBg}`)

  // 2. group view: hover + focus ring (probe a non-active element — active items pin their styles)
  const prep = await evaluate(HOVER_PREP_JS)
  if (prep && prep.x > 0) {
    await mouseMove(1, 1)
    await new Promise((r) => setTimeout(r, 120)) // ensure :hover is off before reading the baseline
    const before = await evaluate(HOVER_STYLE_JS)
    await mouseMove(prep.x, prep.y)
    await new Promise((r) => setTimeout(r, 150))
    const after = await evaluate(HOVER_STYLE_JS)
    check(`${themeName}: hover changes style on non-active nav/chip`, before && after && (before.bg !== after.bg || before.border !== after.border), `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
    await mouseMove(1, 1)
  } else {
    check(`${themeName}: hover target found`, false, 'no non-active .fct-nav-item / .fct-chip with size')
  }

  const focusInfo = await (async () => {
    await pressKey(TAB)
    await new Promise((r) => setTimeout(r, 120))
    return evaluate(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const cs = getComputedStyle(el)
      return { tag: el.tagName, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor }
    })()`)
  })()
  check(`${themeName}: keyboard focus shows 2px accent outline`,
    !!focusInfo && focusInfo.outlineWidth === '2px' && sameColor(focusInfo.outlineColor, palette.accent),
    JSON.stringify(focusInfo))

  // 3. command palette: scrim + shadow
  await ctrlK()
  await new Promise((r) => setTimeout(r, 450))
  const pal = await evaluate(`(() => {
    const cands = Array.from(document.querySelectorAll('body *')).filter((el) => {
      const cs = getComputedStyle(el)
      return cs.position === 'fixed' && el.getBoundingClientRect().width > window.innerWidth * 0.9
    })
    if (!cands.length) return null
    const overlay = cands[0]
    const ocs = getComputedStyle(overlay)
    let panel = Array.from(overlay.children).find((c) => getComputedStyle(c).boxShadow !== 'none') || overlay.firstElementChild
    const pcs = panel ? getComputedStyle(panel) : null
    return { overlayBg: ocs.backgroundColor, panelShadow: pcs ? pcs.boxShadow.slice(0, 80) : null }
  })()`)
  check(`${themeName}: palette scrim matches paletteScrim`, !!pal && sameColor(pal.overlayBg, palette.paletteScrim), JSON.stringify(pal))
  check(`${themeName}: palette panel has box-shadow`, !!pal && pal.panelShadow !== null && pal.panelShadow !== 'none', JSON.stringify(pal && pal.panelShadow))
  await screenshot(`${themeName}-command-palette.png`)
  await pressKey(ESC)
  await new Promise((r) => setTimeout(r, 250))

  // 4. AI drawer: open, ask a preset question, wait for the stream to finish, check bubble colors
  const ask = await evaluate(`(${FIND_BY_TEXT_JS})('Ask the cockpit')`)
  if (!ask) {
    check(`${themeName}: 'Ask the cockpit' button found`, false)
  } else {
    await clickAt(ask.x, ask.y)
    await new Promise((r) => setTimeout(r, 600)) // drawer mounts (fade-in 140ms)
    const preset = await evaluate(`(${FIND_BY_TEXT_JS})('Why is this entity amber?')`)
    if (!preset) {
      check(`${themeName}: preset question found in open drawer`, false)
    } else {
      await clickAt(preset.x, preset.y)
      // mockAssistant streams ~4 chars / 18ms; follow-up chips render when the stream ends
      let streamed = false
      for (let i = 0; i < 30 && !streamed; i++) {
        await new Promise((r) => setTimeout(r, 500))
        streamed = await evaluate(`!!document.querySelector('.fct-followup-chip')`)
      }
      const drawer = await evaluate(`(${DRAWER_CHECK_JS})('${palette.bgAccentSoft}', '${palette.assistantBorder}')`)
      check(`${themeName}: AI stream completed (follow-up chips)`, streamed, 'no .fct-followup-chip after 15s')
      check(`${themeName}: AI drawer shows bgAccentSoft user bubble`, !!drawer && drawer.softBubbles > 0, JSON.stringify(drawer))
      check(`${themeName}: AI drawer uses assistantBorder on assistant bubble`, !!drawer && drawer.assistantBorders > 0, JSON.stringify(drawer))
      await screenshot(`${themeName}-ai-drawer.png`)
    }
    // close the drawer (conditional render — unmounts) so it doesn't overlay the route walk
    const closeBtn = await evaluate(`(${RECT_JS})('.fct-drawer-close')`)
    if (closeBtn) { await clickAt(closeBtn.x, closeBtn.y); await new Promise((r) => setTimeout(r, 300)) }
    else { await pressKey(ESC); await new Promise((r) => setTimeout(r, 300)) }
    const stillOpen = await evaluate(`!!document.querySelector('.fct-followup-chip')`)
    check(`${themeName}: AI drawer closes`, !stillOpen, 'drawer content still in DOM after close')
  }

  // 5. walk all routes: census + in-situ contrast audit + screenshots
  const routeReports = []
  for (const [route, name] of ROUTES) {
    await navigate(BASE + route)
    const audit = await evaluate(AUDIT_JS)
    // Presence is judged on page content only (<main>): the rail and top bar carry their own
    // colors on every route, so a document-wide census would pass these checks for chrome.
    const present = new Set()
    for (const v of Object.keys(audit.mainFills)) present.add(v)
    for (const v of Object.keys(audit.mainBorders)) present.add(v)
    for (const k of Object.keys(audit.mainPairs)) present.add(k.split('|')[0]) // fg colors also count as "present"
    const missing = (EXPECTED_PRESENT[name] || []).filter((tok) => !Array.from(present).some((v) => sameColor(v, palette[tok])))
    check(`${themeName}/${name}: expected colors present`, missing.length === 0, 'missing: ' + missing.join(', '))
    routeReports.push({ theme: themeName, name, pairs: audit.pairs })
    await screenshot(`${themeName}-${name}.png`)
  }
  return routeReports
}

// ---------- contrast reporting ----------
// In-situ pairs allowed below AA, mirroring src/theme/tokens.test.ts EXEMPT (same roles, surfaces, rationale).
// A sub-AA pair not listed here — or a color that resolves to no palette token — fails the run.
const CONTRAST_EXEMPT = {
  dark: [['textFaint', '*'], ['textFaintest', '*']], // frozen baseline / footnote tier — sub-AA by design
  light: [
    ['textFaintest', '*'],
    ['textFaint', 'bgRoot'], ['textFaint', 'bgPanelAlt'], ['textFaint', 'bgRaised'],
    ['textFaint', 'bgSelected'], ['textFaint', 'bgAccentSoft'], ['textFaint', 'bgAccentPanel'],
  ],
}

function tokenFor(palette, value) {
  for (const [name, v] of Object.entries(palette)) if (sameColor(v, value)) return name
  return null
}

// Enforcing: every in-situ text pair must meet AA 4.5 unless it is a documented exemption above.
// Returns the violation list; main() gates on it via check().
function reportContrast(reports) {
  console.log('\n=== IN-SITU CONTRAST (text vs its resolved background) ===')
  const seen = new Map() // theme|fg|bg -> count
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
  const violations = []
  for (const r of rows) {
    if (r.ratio >= 4.5) {
      console.log(`${r.theme.padEnd(6)} ${r.ratio.toFixed(2).padStart(6)}:1  fg=${r.fg} bg=${r.bg} (x${r.count})`)
      continue
    }
    const pal = r.theme === 'light' ? light : dark
    const role = tokenFor(pal, r.fg)
    const surface = tokenFor(pal, r.bg)
    if (!role || !surface) {
      violations.push(`${r.theme}: unresolved color fg=${r.fg} bg=${r.bg} at ${r.ratio.toFixed(2)}:1`)
      console.log(`${r.theme.padEnd(6)} ${r.ratio.toFixed(2).padStart(6)}:1  fg=${r.fg} bg=${r.bg} (x${r.count})  <-- below AA, UNRESOLVED`)
      continue
    }
    const exempt = CONTRAST_EXEMPT[r.theme].some(([roleName, surf]) => roleName === role && (surf === '*' || surf === surface))
    if (exempt) {
      console.log(`${r.theme.padEnd(6)} ${r.ratio.toFixed(2).padStart(6)}:1  fg=${r.fg} bg=${r.bg} (x${r.count})  <-- below AA, exempt (${role}/${surface})`)
    } else {
      violations.push(`${r.theme}: ${role} on ${surface} = ${r.ratio.toFixed(2)}:1`)
      console.log(`${r.theme.padEnd(6)} ${r.ratio.toFixed(2).padStart(6)}:1  fg=${r.fg} bg=${r.bg} (x${r.count})  <-- below AA, NOT EXEMPT (${role}/${surface})`)
    }
  }
  return violations
}

function paletteMatrix(themeName, p) {
  console.log(`\n=== PALETTE MATRIX ${themeName} (text colors x backgrounds) ===`)
  const textColors = ['textPrimary', 'textSecondary', 'textMuted', 'textFaint', 'textFaintest', 'accentText', 'statusGreen', 'statusAmber', 'statusRed']
  const bgs = ['bgRoot', 'bgPanel', 'bgPanelAlt', 'bgRaised', 'bgSelected', 'bgAccentSoft', 'bgAccentPanel']
  let worst = { ratio: Infinity }
  for (const t of textColors) {
    for (const b of bgs) {
      const r = contrast(p[t], p[b])
      if (r < worst.ratio) worst = { ratio: r, pair: `${t} on ${b}` }
    }
  }
  console.log(`worst text pair: ${worst.pair} = ${worst.ratio.toFixed(2)}:1`)
  return worst
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
    reports.push(...(await themePass('dark', dark)))
    reports.push(...(await themePass('light', light)))

    // persistence + toggle (state is currently LIGHT from the last pass)
    console.log('\n=== PERSISTENCE / TOGGLE ===')
    const reloaded = waitForEvent('Page.loadEventFired', 20000)
    await send('Page.reload'); await reloaded
    for (let i = 0; i < 40; i++) { if (await evaluate(`getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'`)) break; await new Promise((r) => setTimeout(r, 250)) }
    const afterReload = await evaluate(VAR_DUMP_JS)
    check('persistence: reload keeps light theme', sameColor(afterReload.bgRoot, light.bgRoot), `bgRoot=${afterReload.bgRoot}`)

    await evaluate(`localStorage.removeItem('fct-theme')`)
    const reloaded2 = waitForEvent('Page.loadEventFired', 20000)
    await send('Page.reload'); await reloaded2
    for (let i = 0; i < 40; i++) { if (await evaluate(`getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'`)) break; await new Promise((r) => setTimeout(r, 250)) }
    const afterClear = await evaluate(VAR_DUMP_JS)
    check('persistence: cleared storage restores dark default', sameColor(afterClear.bgRoot, dark.bgRoot), `bgRoot=${afterClear.bgRoot}`)

    const modeBtn = await evaluate(`(${FIND_BY_TEXT_JS})('DARK MODE')`) || (await evaluate(`(${FIND_BY_TEXT_JS})('LIGHT MODE')`))
    if (modeBtn) {
      await clickAt(modeBtn.x, modeBtn.y)
      await new Promise((r) => setTimeout(r, 300))
      const afterToggle = await evaluate(VAR_DUMP_JS)
      const labelNow = await evaluate(`(() => Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).find(t=>/^(DARK|LIGHT) MODE$/.test(t)))()`)
      check('toggle: click flips theme without reload', sameColor(afterToggle.bgRoot, light.bgRoot) && labelNow === 'LIGHT MODE', `bgRoot=${afterToggle.bgRoot} label=${labelNow}`)
    } else {
      check('toggle: mode button found in top bar', false)
    }

    // contrast analysis — enforcing: every non-exempt in-situ text pair must meet AA 4.5
    const violations = reportContrast(reports)
    check('contrast: no non-exempt in-situ text pair below AA 4.5', violations.length === 0, violations.slice(0, 6).join('; '))
    paletteMatrix('dark', dark) // informational — the full design space is enforced by tokens.test.ts
    paletteMatrix('light', light)

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
