// Answer source for the cockpit-intelligence drawer (spec/07, §11). The UI only depends on this
// interface — a real endpoint can replace the mock without touching AssistantDrawer. Answers are
// computed from the api layer at answer time so they stay consistent with the dataset; every answer
// carries citations (drill targets) and follow-up actions, and a question the dataset cannot answer
// gets a plain "no answer" instead of a guess (§11: never assert what the data does not contain).

import {
  applySensitivity,
  causeBacklogCounts,
  computeScore,
  currentPeriodEliminations,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  getControlSignals,
  getCause,
  getEntity,
  getForecast,
  getRecurringCauses,
  listCauseBacklog,
  listCompliance,
  listDataQuality,
  priorScore,
  slaBreachSplit,
} from '../../api'
import type { Attribution, DimensionKey, Entity, Veto } from '../../api'
import type { ScoreResult } from '../../api'
import { defaultRootCauseTo } from '../../app/paths'
import { formatCr, formatRecurrence } from '../../lib/format'
import { statusWord } from '../../theme/derive'

export interface Citation {
  label: string
  to: string // route the drawer navigates to when the chip is clicked
}

export interface FollowUpAction {
  label: string
  to?: string // navigate here when present
  ask?: string // otherwise pose this question in the drawer
}

export interface AnswerMeta {
  citations: Citation[]
  followUps: FollowUpAction[]
}

// answerMeta is optional so existing providers keep compiling; the drawer falls back to its own
// default chips when a provider does not supply it.
export interface AssistantProvider {
  ask(question: string, context: { entityCode: string }): AsyncIterable<string>
  answerMeta?(question: string, context: { entityCode: string }): AnswerMeta | undefined
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDue(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

interface ResolvedAnswer extends AnswerMeta {
  text: string
}

function noAnswer(): ResolvedAnswer {
  return {
    text: 'The dataset has no answer for that question, so I will not guess. I can only say what the transactions, owners and service records contain — try one of the seeded questions below.',
    citations: [],
    followUps: [
      { label: 'Why is this entity amber?', ask: 'Why is this entity showing amber?' },
      { label: 'What is our exposure at close?', ask: 'What is our exposure at close?' },
    ],
  }
}

const ATTRIBUTION_LABELS: Record<Attribution, string> = { client: 'Client', provider: 'Provider', system: 'System', thirdParty: 'Third party' }

// The clause behind a weak dimension in the amber answer — always a figure from the dataset.
function driverClause(entity: Entity, k: DimensionKey): string {
  const m = entity.metrics
  switch (k) {
    case 'operational':
      return `${m.closeBlockers} close blockers at ${m.closePercent.current}% complete`
    case 'service': {
      const split = slaBreachSplit(entity.code)
      return `${split.total} SLA breaches this period, ${split.pct.client}% client-attributed`
    }
    case 'risk':
      return `${m.controlBreaches} control breaches and ${m.highRiskJEs} high-risk manual journals open`
    case 'workingCapital':
      return `${formatCr(m.apBlocked.current)} blocked across ${m.apBlockedCount} invoices, plus ${formatCr(m.cashUnapplied.current)} unapplied cash`
    case 'dataQuality': {
      const fails = listDataQuality(entity.code).reduce((sum, d) => sum + d.failCount, 0)
      return `${fails} master-data and interface checks failing`
    }
    case 'compliance': {
      const overdue = listCompliance(entity.code).filter((c) => c.status === 'overdue').length
      return overdue > 0 ? `${overdue} obligation${overdue === 1 ? '' : 's'} overdue` : 'no obligations overdue'
    }
  }
}

// Seed 1 — "Why is this entity amber?" (and, on a capped entity, "why is it capped?").
function whyAmber(entity: Entity): ResolvedAnswer {
  const score = computeScore(entity)
  if (score.cappedBy !== null) return whyCapped(entity, score, score.cappedBy)
  const prior = priorScore(entity)
  const ranked = DIMENSION_KEYS.map((k) => ({ k, v: entity.dimensions[k] })).sort((a, b) => a.v - b.v)
  const w1 = ranked[0]
  const w2 = ranked[1]
  const delta = score.displayed - prior.displayed
  const move = delta > 0 ? `up ${delta} vs last period` : delta < 0 ? `down ${-delta} vs last period` : 'level with last period'
  return {
    text: `${entity.name} scores ${score.displayed}/100 — ${statusWord(score.displayed)}, ${move}. The weakest dimensions are ${DIMENSION_LABELS[w1.k].toLowerCase()} at ${w1.v} — ${driverClause(entity, w1.k)} — and ${DIMENSION_LABELS[w2.k].toLowerCase()} at ${w2.v} — ${driverClause(entity, w2.k)}.`,
    citations: [
      { label: 'Score & dimensions', to: `/entity/${entity.code}` },
      { label: 'Open the worklist', to: `/entity/${entity.code}/p2p/invoices` },
    ],
    followUps: [
      { label: 'What lifts it fastest?', ask: 'What lifts it fastest?' },
      { label: 'Show root cause', to: defaultRootCauseTo(entity.code) },
      { label: 'Open the worklist', to: `/entity/${entity.code}/p2p/invoices` },
    ],
  }
}

// The demo highlight (§11): on JRP the fall is a control event — the cap, not the raw score.
function whyCapped(entity: Entity, score: ScoreResult, capped: Veto): ResolvedAnswer {
  const prior = priorScore(entity)
  let text = `${entity.name} fell from ${prior.displayed} to ${score.displayed}. The cap "${capped.reason}" (${capped.cap}) now binds the score${capped.detectedThisPeriod ? ' — it was detected this period' : ''}, and the raw score moved only ${prior.raw} → ${score.raw}, so the fall is a control event, not a performance slide.`
  const clearItem = entity.sensitivity.find((i) => i.clearsVeto === capped.id)
  if (clearItem) {
    const to = applySensitivity(entity, clearItem).score.displayed
    const others = entity.sensitivity.filter((i) => i !== clearItem)
    if (others.every((i) => applySensitivity(entity, i).score.cappedBy !== null)) {
      text += ` Until that cap is lifted, no other action moves the number: "${clearItem.action}" alone takes it to ${to}.`
    }
  }
  const second = entity.vetoes.find((v) => v.active && v.id !== capped.id)
  if (second) text += ` A second active cap — ${second.reason} (${second.cap}) — is not binding while this one holds.`
  const sig = getControlSignals().find((s) => s.entityCode === entity.code && /bank/i.test(s.title))
  return {
    text,
    citations: [
      ...(sig ? [{ label: sig.valueAtRiskCr !== undefined ? `${sig.title} · ${formatCr(sig.valueAtRiskCr)}` : sig.title, to: '/risk-control' }] : []),
      { label: `Score history · ${prior.displayed} → ${score.displayed}`, to: `/entity/${entity.code}` },
      { label: 'What moves this score', to: `/entity/${entity.code}#fct-moves` },
    ],
    followUps: [
      { label: 'What lifts it fastest?', ask: 'What lifts it fastest?' },
      { label: 'Show the control signal', to: '/risk-control' },
      { label: 'Open the worklist', to: `/entity/${entity.code}/p2p/invoices` },
    ],
  }
}

// Seed 2 — "What lifts it fastest?"
function liftsFastest(entity: Entity): ResolvedAnswer {
  const score = computeScore(entity)
  if (score.cappedBy !== null) {
    const clearItem = entity.sensitivity.find((i) => i.clearsVeto === score.cappedBy!.id)
    if (clearItem) {
      const to = applySensitivity(entity, clearItem).score.displayed
      return {
        text: `While the "${score.cappedBy.reason}" cap binds, only one action moves the score: "${clearItem.action}", ${score.displayed} → ${to}. Every other action delivers zero until that cap is lifted.`,
        citations: [
          { label: 'What moves this score', to: `/entity/${entity.code}#fct-moves` },
          { label: 'Open the worklist', to: `/entity/${entity.code}/p2p/invoices` },
        ],
        followUps: [
          { label: 'Why is this entity capped?', ask: 'Why is this entity capped?' },
          { label: 'What is our exposure at close?', ask: 'What is our exposure at close?' },
        ],
      }
    }
  }
  const steps = entity.sensitivity
    .map((i) => ({ i, to: applySensitivity(entity, i).score.displayed }))
    .filter((s) => s.to > score.displayed)
    .sort((a, b) => b.to - a.to)
  const t1 = steps[0]
  if (!t1) return noAnswer()
  const t2 = steps[1]
  let text = `The largest single move is "${t1.i.action}", lifting the score from ${score.displayed} to ${t1.to} (${t1.i.effort.toLowerCase()} effort).`
  if (t2) text += ` Next, "${t2.i.action}" takes it to ${t2.to}.`
  return {
    text,
    citations: [
      { label: 'What moves this score', to: `/entity/${entity.code}#fct-moves` },
      { label: 'Open the worklist', to: `/entity/${entity.code}/p2p/invoices` },
    ],
    followUps: [
      { label: 'Why is this entity amber?', ask: 'Why is this entity showing amber?' },
      { label: 'What is our exposure at close?', ask: 'What is our exposure at close?' },
    ],
  }
}

// Seed 3 — "Why do blocked invoices keep recurring?"
function blockedRecurring(entity: Entity): ResolvedAnswer {
  const m = entity.metrics
  const gr = getCause('missing-gr')
  const recurring = getRecurringCauses()
  const parts: string[] = [`${formatCr(m.apBlocked.current)} is blocked across ${m.apBlockedCount} invoices at ${entity.name}.`]
  if (m.accrualExposure !== undefined) {
    parts.push(`${formatCr(m.accrualExposure)} of it cannot be accrued because goods receipts are unposted — the same ${m.unpostedGr?.vendors ?? '—'} vendors, now in their ${formatRecurrence(m.unpostedGr?.recurrenceMonths ?? 1)}.`)
  }
  if (gr) parts.push(`Missing GR is the largest P2P cause at ${gr.sharePct}% of blocked value.`)
  if (recurring.length > 0) {
    parts.push(`Across the group, ${recurring.map((r) => `${r.name} (${r.sharePct}%)`).join(', ')} are the causes that keep coming back.`)
  }
  return {
    text: parts.join(' '),
    citations: [
      ...(gr ? [{ label: `Missing GR · ${formatCr(gr.valueAtRisk)}`, to: `/entity/${entity.code}/root-cause/p2p/missing-gr` }] : []),
      { label: 'Blocked invoices worklist', to: `/entity/${entity.code}/p2p/invoices?cause=missing-gr` },
    ],
    followUps: [
      { label: 'What is our exposure at close?', ask: 'What is our exposure at close?' },
      { label: 'Show the root cause', to: `/entity/${entity.code}/root-cause/p2p/missing-gr` },
    ],
  }
}

// Seed 4 — "What is our exposure at close?"
function exposureAtClose(entity: Entity): ResolvedAnswer {
  const m = entity.metrics
  const parts: string[] = []
  if (m.accrualExposure !== undefined) {
    parts.push(`${formatCr(m.accrualExposure)} of blocked payables cannot be accrued at close (${m.accrualExposureNote ?? 'blocked payables not yet accrued'}).`)
  }
  if (m.revenueAtRisk !== undefined) parts.push(`On top of it, ${formatCr(m.revenueAtRisk)} of revenue sits behind open disputes and credit blocks.`)
  if (m.fxIntercompanyExposure !== undefined) parts.push(`${formatCr(m.fxIntercompanyExposure)} of intercompany balances are unmatched with related parties.`)
  if (m.provisionAdequacyPct !== undefined) parts.push(`Provision adequacy is ${m.provisionAdequacyPct}% of actual utilisation.`)
  return {
    text: parts.join(' '),
    citations: [
      { label: 'Blocked invoices worklist', to: `/entity/${entity.code}/p2p/invoices?cause=missing-gr` },
      { label: 'O2C collection stage', to: `/entity/${entity.code}/o2c#fct-stage-COL` },
      { label: 'Intercompany netting', to: `/entity/${entity.code}/working-capital#fct-ic-netting` },
    ],
    followUps: [
      { label: 'Why do blocked invoices keep recurring?', ask: 'Why do blocked invoices keep recurring?' },
      { label: 'Open the worklist', to: `/entity/${entity.code}/p2p/invoices` },
    ],
  }
}

// Seed 5 — "Whose delay is driving the SLA breach?"
function slaWhose(entity: Entity): ResolvedAnswer {
  const split = slaBreachSplit(entity.code)
  const keys = Object.keys(split.counts) as Attribution[]
  let topKey = keys[0]
  for (const k of keys) if (split.counts[k] > split.counts[topKey]) topKey = k
  return {
    text: `${split.total} SLA breaches at ${entity.name} this period. By responsibility: ${keys.map((k) => `${ATTRIBUTION_LABELS[k].toLowerCase()} ${split.counts[k]} (${split.pct[k]}%)`).join(', ')}. ${ATTRIBUTION_LABELS[topKey]} delays are the largest share.`,
    citations: [{ label: `SLA attribution · ${split.total} breaches`, to: `/entity/${entity.code}/service` }],
    followUps: [
      { label: 'Open the service desk', to: '/service-desk' },
      { label: 'Why is this entity amber?', ask: 'Why is this entity showing amber?' },
    ],
  }
}

// Seed 6 — "What will DSO be at month-end?"
function dsoMonthEnd(entity: Entity): ResolvedAnswer {
  const f = getForecast(entity.code)
  if (!f || f.metric !== 'dso') return noAnswer()
  const drivers = [...f.drivers].sort((a, b) => b.impact - a.impact)
  const t1 = drivers[0]
  const t2 = drivers[1]
  let text = `DSO is ${f.current} days today and projects to ${f.projected} by month-end if nothing changes.`
  if (t1) {
    text += ` The largest driver is ${t1.label}, holding ${formatCr(t1.valueCr)} open for an estimated +${t1.impact} days.`
    if (t2) text += ` Next, ${t2.label} adds +${t2.impact} days.`
  }
  return {
    text,
    citations: [{ label: `DSO forecast · ${f.current} → ${f.projected}`, to: `/entity/${entity.code}/predictive` }],
    followUps: [
      { label: 'Open the predictive view', to: `/entity/${entity.code}/predictive` },
      { label: 'What is our exposure at close?', ask: 'What is our exposure at close?' },
    ],
  }
}

// Seed 7 — "What compliance is overdue?"
function complianceOverdue(entity: Entity): ResolvedAnswer {
  const items = listCompliance(entity.code)
  const overdue = items.filter((c) => c.status === 'overdue')
  let text: string
  if (overdue.length > 0) {
    text = `${entity.name} has ${overdue.length === 1 ? 'one obligation' : `${overdue.length} obligations`} overdue. ` + overdue.map((o) => `${o.obligation} was due ${formatDue(o.dueDate)}${o.valueAtRiskCr !== undefined ? `, with ${formatCr(o.valueAtRiskCr)} at risk` : ''}.`).join(' ')
  } else {
    const next = items.filter((c) => c.status === 'due').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
    if (!next) return noAnswer()
    text = `Nothing is overdue at ${entity.name}. Next up: ${next.obligation}, due ${formatDue(next.dueDate)}${next.failCount !== undefined && next.failureLabel ? `, with ${next.failCount} ${next.failureLabel}` : ''}.`
  }
  return {
    text,
    citations: [{ label: 'Compliance register', to: '/compliance' }],
    followUps: [
      { label: 'Open the compliance register', to: '/compliance' },
      { label: 'Why is this entity amber?', ask: 'Why is this entity showing amber?' },
    ],
  }
}

// Seed 8 — "What has master data quality cost us?"
function masterDataCost(entity: Entity): ResolvedAnswer {
  const vm = getCause('vendor-master')
  const vendorChecks = listDataQuality(entity.code, 'vendor')
  const fails = vendorChecks.reduce((sum, d) => sum + d.failCount, 0)
  let text = ''
  if (vm) text += `Vendor master data is ${vm.sharePct}% of blocked P2P value group-wide — ${formatCr(vm.valueAtRisk)} at risk.`
  if (vendorChecks.length > 0) {
    const detail = vendorChecks.map((d) => `${d.failCount} ${d.check.toLowerCase()}`).join(', ')
    text += ` At ${entity.name}, vendor checks are failing on ${fails} records: ${detail}.`
  }
  return {
    text,
    citations: [
      ...(vm ? [{ label: `Vendor master · ${formatCr(vm.valueAtRisk)}`, to: `/entity/${entity.code}/root-cause/p2p/vendor-master` }] : []),
      { label: 'Data quality checks', to: '/data-quality' },
    ],
    followUps: [
      { label: 'Show the root cause', to: `/entity/${entity.code}/root-cause/p2p/vendor-master` },
      { label: 'Open data quality', to: '/data-quality' },
    ],
  }
}

// Seed 9 — "Which causes have we eliminated?" (group-wide, spans the register screen)
function causesEliminated(): ResolvedAnswer {
  const counts = causeBacklogCounts()
  const p6 = currentPeriodEliminations()
  const thisPeriod = listCauseBacklog().filter((r) => r.status === 'eliminated' && r.eliminatedInPeriod === 6)
  let text = `Of ${counts.identified} identified causes, ${counts.eliminated} are fully eliminated and ${counts.inProgress} are in progress.`
  if (p6.count > 0 && thisPeriod.length > 0) {
    const names = thisPeriod.map((r) => r.name).join(' and ')
    text += ` This period closed ${p6.count === 1 ? 'one elimination' : `${p6.count} eliminations`} — ${names} — which generated ${p6.generatedLastPeriod} exceptions last period and none in this one.`
  }
  return {
    text,
    citations: [
      { label: 'Cause elimination register', to: '/cause-backlog' },
      ...thisPeriod.map((r) => ({ label: r.name, to: `/entity/${r.entityCode}/root-cause/${r.processKey}/${r.causeKey}` })),
    ],
    followUps: [
      { label: 'Open the register', to: '/cause-backlog' },
      { label: 'What lifts it fastest?', ask: 'What lifts it fastest?' },
    ],
  }
}

// Match order matters: specific phrases first, the broad amber/capped catch last. Patterns are
// stateless (no /g), so reusing them across questions is safe.
const SEEDS: { pattern: RegExp; build(entity: Entity): ResolvedAnswer }[] = [
  { pattern: /lift.*fastest|fastest lift/i, build: liftsFastest },
  { pattern: /blocked invoices?[\s\S]*recurr|keep recurring/i, build: blockedRecurring },
  { pattern: /exposure at close/i, build: exposureAtClose },
  { pattern: /sla breach|whose delay/i, build: slaWhose },
  { pattern: /\bdso\b[\s\S]*month.?end|month.?end[\s\S]*\bdso\b/i, build: dsoMonthEnd },
  { pattern: /compliance[\s\S]*overdue|overdue[\s\S]*compliance|what compliance/i, build: complianceOverdue },
  { pattern: /master data|data quality/i, build: masterDataCost },
  { pattern: /eliminat/i, build: () => causesEliminated() },
  { pattern: /amber|capped/i, build: whyAmber },
]

function resolve(question: string, entityCode: string): ResolvedAnswer {
  const entity = getEntity(entityCode)
  if (!entity) return noAnswer()
  const q = question.trim().toLowerCase()
  for (const seed of SEEDS) {
    if (seed.pattern.test(q)) return seed.build(entity)
  }
  return noAnswer()
}

// Streams a computed answer in ~4-character chunks every 18ms. Breaking out of the loop calls
// return(), which clears the pending tick, so an abandoned stream stops.
export class MockAssistantProvider implements AssistantProvider {
  ask(question: string, context: { entityCode: string }): AsyncIterable<string> {
    const full = resolve(question, context.entityCode).text
    let index = 0
    let pending: ReturnType<typeof setTimeout> | undefined
    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (index >= full.length) return { value: undefined, done: true }
            const chunk = full.slice(index, index + 4)
            index += 4
            await new Promise<void>((resolve) => {
              pending = setTimeout(resolve, 18)
            })
            return { value: chunk, done: false }
          },
          async return() {
            if (pending !== undefined) clearTimeout(pending)
            return { value: undefined, done: true }
          },
        }
      },
    }
  }

  answerMeta(question: string, context: { entityCode: string }): AnswerMeta | undefined {
    const resolved = resolve(question, context.entityCode)
    return { citations: resolved.citations, followUps: resolved.followUps }
  }
}

export const mockAssistant = new MockAssistantProvider()
