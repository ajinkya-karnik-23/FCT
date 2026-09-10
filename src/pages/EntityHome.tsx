import { useContext, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { applySensitivity, causeBacklog, computeScore, DIMENSION_KEYS, DIMENSION_LABELS, DIMENSION_WEIGHTS, entityTileSubs, getEntity, listCauses, pointDirection, priorScore } from '../api'
import type { Effort, Trend } from '../api'
import { useAppMode, type CockpitMode } from '../app/mode'
import { defaultRootCauseTo } from '../app/paths'
import { Bar, CrossProcessTrace, DimensionBar, Eyebrow, FreshnessStamp, Metric, StatusDot } from '../components'
import { AssistantContext } from '../features/assistant/AssistantDrawer'
import { formatCr, formatRecurrence } from '../lib/format'
import { scoreColor, statusWord, trendColor } from '../theme/derive'
import { colors, fonts, fontWeights, spacing, typeScale, shadows } from '../theme/tokens'
import * as clay from '../theme/clay'

// §7.10 — one computed row in "What moves this score": from/to are recomputed at render, never stored.
type MoveRow = { action: string; from: number; to: number; effort: Effort }
// §8.3 — headline tiles carry a trend (delta + sparkline); Controls has no prior period and stays plain.
type Tile = { label: string; value: string; sub: string; tone: string; to: string } & (
  | { trend: Trend; inverse: boolean | null } // §8.5.1 — true when lower is better; null = direction-neutral
  | { trend?: undefined }
)
// Prototype scaling: insight fill is sharePct * 2.6 % of the track width.
const INSIGHT_FILL_SCALE = 2.6

// §8.5 — mode-aware top panel cell; readOnlySource tags a figure that cannot drill (§8.4).
type PanelCell = { label: string; value: string; sub?: string; subTone?: string; to?: string; readOnlySource?: string }

const MODE_PANEL_TITLE: Record<CockpitMode, string> = {
  close: 'At close',
  bau: 'Business as usual',
  preclose: 'Pre-close readiness',
}

// §8.2 — the connecting sentence's middle clause is mode-aware; the pre-close wording is preventive and still actionable.
const CALLOUT_MID: Record<CockpitMode, string> = {
  close: 'not accrued at Day 4',
  bau: 'will not accrue at close',
  preclose: 'will not accrue in 3 days unless goods receipts are posted',
}

function countDelta(current: number, previous: number): string {
  const d = current - previous
  return `${d > 0 ? '+' : ''}${d} vs last period`
}

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }

export function EntityHome() {
  const { code } = useParams()
  const assistant = useContext(AssistantContext)
  const { mode } = useAppMode() // §8.5 — which phase of the month the demo is simulating
  const [revealed, setRevealed] = useState(false)
  const [weightsOpen, setWeightsOpen] = useState(false)
  const entity = getEntity(code ?? '')
  if (!entity) return <UnknownEntity code={code ?? ''} />

  const score = computeScore(entity)
  const prior = priorScore(entity) // §7.15 — same formula over dimensionsPrevious + prior-active vetoes
  const scoreDelta = score.displayed - prior.displayed
  const statusColor = scoreColor(score.displayed)
  const word = statusWord(score.displayed)
  const capped = score.cappedBy ?? null
  const activeVetoes = entity.vetoes.filter((v) => v.active)
  // §11 — the drawer's seed question branches on whether a cap binds: JRP asks "why is it capped", others ask why amber.
  const askQuestion = capped ? 'Why is this entity capped?' : 'Why is this entity showing amber?'

  // §7.10 — deltas are computed, never stored: each row recomputes the score with its movement applied.
  // While a cap binds (§7.10.1), ordinary actions deliver zero, so only the cap-clearing action is shown
  // (promoted above the banner) and the remaining cascade threads state through in order.
  let capRow: MoveRow | null = null
  const moveRows: MoveRow[] = []
  if (capped) {
    const clearItem = entity.sensitivity.find((i) => i.clearsVeto === capped.id)!
    const clearedState = applySensitivity(entity, clearItem).state
    capRow = { action: clearItem.action, from: score.displayed, to: computeScore(clearedState).displayed, effort: clearItem.effort }
    let state = clearedState
    for (const item of entity.sensitivity.filter((i) => i !== clearItem)) {
      const step = applySensitivity(state, item)
      moveRows.push({ action: item.action, from: computeScore(state).displayed, to: step.score.displayed, effort: item.effort })
      state = step.state
    }
  } else {
    for (const item of entity.sensitivity) {
      moveRows.push({ action: item.action, from: score.displayed, to: applySensitivity(entity, item).score.displayed, effort: item.effort })
    }
  }

  const subs = entityTileSubs(entity)

  // §8.5 — top panel foregrounds what matters in the simulated phase; every figure comes from the dataset.
  const m = entity.metrics
  let panel: PanelCell[]
  if (mode === 'close') {
    panel = [
      { label: 'Close status', value: `${m.closePercent.current}%`, sub: countDelta(m.closePercent.current, m.closePercent.previous), subTone: trendColor(pointDirection(m.closePercent.current, m.closePercent.previous, false)), readOnlySource: 'close tracker' },
      { label: 'Blockers', value: `${m.closeBlockers}`, sub: 'blocking the close', readOnlySource: 'close tracker' },
      { label: 'Exposure at close', value: formatCr(m.accrualExposure!), sub: m.accrualExposureNote ?? 'blocked payables not yet accrued', to: `/entity/${entity.code}/p2p/invoices?cause=missing-gr` },
    ]
  } else if (mode === 'bau') {
    const backlog = causeBacklog(m.causeElimination!) // §7.18 — per-entity backlog; notStarted derived in the data layer
    panel = [
      { label: 'AP blocked invoices', value: `${m.apBlockedCount}`, sub: countDelta(m.apBlockedCount, m.apBlockedCountPrevious), subTone: trendColor(pointDirection(m.apBlockedCount, m.apBlockedCountPrevious, true)), to: `/entity/${entity.code}/p2p/invoices` },
      { label: 'O2C exceptions', value: `${m.o2cExceptionCount}`, sub: countDelta(m.o2cExceptionCount, m.o2cExceptionCountPrevious), subTone: trendColor(pointDirection(m.o2cExceptionCount, m.o2cExceptionCountPrevious, true)), to: `/entity/${entity.code}/o2c` },
      { label: 'Cash opportunity', value: formatCr(m.cashOpportunity!.value), sub: `${m.cashOpportunity!.items} items`, to: `/entity/${entity.code}/working-capital` },
      { label: 'Cause elimination', value: `${backlog.eliminated} of ${backlog.identified}`, sub: `${backlog.inProgress} in progress · ${backlog.notStarted} not started`, to: '/' },
    ]
  } else {
    panel = [
      // §7.18 — unposted GR is the same quantity as accrual exposure (§8.2); vendors and recurrence come from the per-entity row.
      { label: 'Unposted goods receipts', value: formatCr(m.accrualExposure!), sub: `${m.unpostedGr!.vendors} vendors · ${formatRecurrence(m.unpostedGr!.recurrenceMonths)}`, to: `/entity/${entity.code}/root-cause/p2p/missing-gr` },
      { label: 'Unapplied cash', value: formatCr(m.cashUnapplied.current), sub: subs.cashUnapplied, to: `/entity/${entity.code}/working-capital` },
      { label: 'Aged reconciliation breaks', value: `${m.reconAgedBreaks}`, sub: `${formatCr(m.reconValue.current)} at stake · oldest ${m.reconOldestDays} d`, to: defaultRootCauseTo(entity.code) },
      { label: 'Open disputes', value: formatCr(m.revenueAtRisk!), sub: 'disputes and credit blocks', to: `/entity/${entity.code}/o2c#fct-stage-COL` },
    ]
  }

  const tiles: Tile[] = [
    { label: 'Cash unapplied', value: formatCr(entity.metrics.cashUnapplied.current), trend: entity.metrics.cashUnapplied, inverse: true, sub: subs.cashUnapplied, tone: colors.statusAmber, to: `/entity/${entity.code}/working-capital` },
    { label: 'AP blocked', value: formatCr(entity.metrics.apBlocked.current), trend: entity.metrics.apBlocked, inverse: true, sub: subs.apBlocked, tone: colors.statusRed, to: `/entity/${entity.code}/p2p` },
    { label: 'AR > 90 days', value: formatCr(entity.metrics.arOver90.current), trend: entity.metrics.arOver90, inverse: true, sub: subs.arOver90, tone: colors.statusRed, to: `/entity/${entity.code}/working-capital` },
    { label: 'Close', value: `${entity.metrics.closePercent.current}%`, trend: entity.metrics.closePercent, inverse: false, sub: subs.close, tone: colors.statusAmber, to: `/entity/${entity.code}` },
    { label: 'Reconciliations', value: formatCr(entity.metrics.reconValue.current), trend: entity.metrics.reconValue, inverse: true, sub: subs.recon, tone: colors.statusRed, to: defaultRootCauseTo(entity.code) },
    { label: 'Controls', value: `${entity.metrics.controlBreaches} breaches`, sub: subs.controls, tone: colors.statusAmber, to: defaultRootCauseTo(entity.code) },
  ]

  // §7.31 — every figure per entity; the JGL-only literals contradicted the panels on this same screen.
  const issues = [
    { dot: colors.statusRed, label: 'AP blocked > 30 days', value: formatCr(m.apBlocked.current), age: `oldest ${m.apBlockedOldestDays} d`, owner: 'Entity controller', to: `/entity/${entity.code}/p2p` },
    { dot: colors.statusRed, label: 'Overdue AR > 90 days', value: formatCr(m.arOver90.current), age: `oldest ${m.arOver90OldestDays} d`, owner: 'Collections lead', to: `/entity/${entity.code}/working-capital` },
    { dot: colors.statusAmber, label: 'Unapplied cash', value: formatCr(m.cashUnapplied.current), age: `oldest ${m.cashUnappliedOldestDays} d`, owner: 'Cash application', to: `/entity/${entity.code}/working-capital` },
    { dot: colors.statusAmber, label: 'Reconciliation breaks', value: `${m.reconAgedBreaks} items`, age: `oldest ${m.reconOldestDays} d`, owner: 'R2R tower', to: `/entity/${entity.code}/root-cause/p2p/missing-gr` },
    { dot: colors.statusAmber, label: 'High-risk manual journals', value: `${m.highRiskJEs} JEs`, age: 'this period', owner: 'Financial controller', to: `/entity/${entity.code}/root-cause/p2p/missing-gr` },
    { dot: colors.statusAmber, label: 'Overdue queries', value: `${m.queriesOverdue} tickets`, age: 'SLA breached', owner: 'Service delivery', to: `/entity/${entity.code}/p2p/invoices` },
  ]

  const insights = listCauses('p2p').slice(0, 3)

  // §8.2 — financial consequence strip; all six entities carry the four figures, so render where they exist.
  const consequenceReady = entity.metrics.accrualExposure !== undefined && entity.metrics.revenueAtRisk !== undefined && entity.metrics.provisionAdequacyPct !== undefined && entity.metrics.fxIntercompanyExposure !== undefined
  // §8.2 drill targets: accrual → blocked worklist filtered to the goods-receipt cause; revenue at risk → O2C collection stage; FX/intercompany → working-capital netting row. Provision adequacy has no target — tagged read-only per §8.4.
  const consequence: Array<{ label: string; value: string; explanation: string; to?: string; readOnly?: boolean }> = [
    { label: 'Accrual exposure at close', value: formatCr(entity.metrics.accrualExposure!), explanation: entity.metrics.accrualExposureNote ?? 'blocked payables not yet accrued', to: `/entity/${entity.code}/p2p/invoices?cause=missing-gr` },
    { label: 'Revenue at risk', value: formatCr(entity.metrics.revenueAtRisk!), explanation: 'open disputes and credit blocks', to: `/entity/${entity.code}/o2c#fct-stage-COL` },
    { label: 'Provision adequacy', value: `${entity.metrics.provisionAdequacyPct}%`, explanation: 'provision vs actual utilisation', readOnly: true },
    { label: 'FX / intercompany exposure', value: formatCr(entity.metrics.fxIntercompanyExposure!), explanation: 'unmatched intercompany with related parties', to: `/entity/${entity.code}/working-capital#fct-ic-netting` },
  ]

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 300 }}>
          <Eyebrow>Level 1 — Legal entity</Eyebrow>
          <h1 style={titleStyle}>{entity.name}</h1>
          {/* §8.7 — mixed sources: SAP ECC for the health figures, close tracker and trial balance extract cited inline below */}
          <FreshnessStamp sources={['SAP ECC', 'close tracker', 'trial balance extract']} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap', ...clay.card, padding: '18px 22px', flexDirection: 'row' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ ...typeScale.bigScore, color: statusColor }}>{score.displayed}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.textFaint }}>/100</span>
              {/* §7.15 — two-point delta vs the prior period; colour follows improvement */}
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: trendColor(pointDirection(score.displayed, prior.displayed, false)) }}>{`${scoreDelta > 0 ? '+' : ''}${scoreDelta} vs last period`}</span>
              <span style={{ ...clay.tag(statusColor), fontSize: 11, letterSpacing: '0.12em' }}>{word}</span>
            </div>
            {capped && (
              <>
                {/* §3.5 — the badge names the binding veto; click reveals raw score and every active cap */}
                <button
                  type="button"
                  onClick={() => setRevealed(!revealed)}
                  style={{ ...clay.tag(colors.statusRed, colors.bgRiskSoft), border: 'none', cursor: 'pointer', textAlign: 'left', whiteSpace: 'normal' }}
                >
                  {`CAPPED — ${capped.reason}`}
                </button>
                {/* §7.15 — where the drop is shown: a veto detected this period makes the fall bigger than
                    the raw movement, so say exactly which cap bound last period and which one now binds. */}
                {capped.detectedThisPeriod && prior.cappedBy && (
                  <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, maxWidth: 340, lineHeight: 1.5 }}>
                    {`Raw score moved only ${prior.raw} → ${score.raw}: last period's binding cap was "${prior.cappedBy.reason}" (${prior.cappedBy.cap}); this period a new control failure — "${capped.reason}" (cap ${capped.cap}) — was detected and now binds.`}
                  </span>
                )}
                {revealed && (
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>
                    <span>{`raw ${score.raw}`}</span>
                    {activeVetoes.map((v) => (
                      <span key={v.id}>{`${v.reason} — cap ${v.cap}${v.id === capped.id ? ' · binding' : ''}`}</span>
                    ))}
                  </span>
                )}
                {/* §11 — the veto badge can pose its own question to the drawer */}
                <button type="button" className="fct-ask-btn" onClick={() => assistant?.ask('Why is this entity capped?')} style={{ padding: '9px 14px', fontSize: 13 }}>Ask why it is capped</button>
              </>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(96px, 124px))', gap: 12 }}>
            {DIMENSION_KEYS.map((key) => (
              <DimensionBar key={key} dimension={key} value={entity.dimensions[key]} previous={entity.dimensionsPrevious[key]} />
            ))}
          </div>
        </div>
      </div>

      {/* §8.5 — mode-aware top panel: foregrounds what matters in the simulated phase of the month */}
      <section style={{ ...clay.card, padding: 0, gap: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <Eyebrow style={typeScale.tableHeader}>{MODE_PANEL_TITLE[mode]}</Eyebrow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${panel.length}, 1fr)` }}>
          {panel.map((c, i) => (
            c.to ? (
              <Link key={c.label} to={c.to} className="fct-table-row" style={{ padding: '18px 20px', borderRight: i < panel.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined, display: 'flex', flexDirection: 'column', gap: 8, color: colors.textPrimary, textDecoration: 'none' }}>
                <span style={{ fontSize: 12, color: colors.textMuted }}>{c.label}</span>
                <span style={typeScale.tileValue}>{c.value}</span>
                {c.sub && <span style={{ fontSize: 12, color: c.subTone ?? colors.textSecondary }}>{c.sub}</span>}
              </Link>
            ) : (
              <div key={c.label} style={{ padding: '18px 20px', borderRight: i < panel.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, color: colors.textMuted }}>{c.label}</span>
                <span style={typeScale.tileValue}>{c.value}</span>
                {c.sub && <span style={{ fontSize: 12, color: c.subTone ?? colors.textSecondary }}>{c.sub}</span>}
                {c.readOnlySource && (
                  // §8.4 — a figure that cannot drill is tagged read-only rather than silently unclickable
                  <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>read-only · source: {c.readOnlySource}</span>
                )}
              </div>
            )
          ))}
        </div>
      </section>

      <section style={{ ...clay.card, padding: 0, gap: 0, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {tiles.map((t, i) => (
          <Link
            key={t.label}
            to={t.to}
            className="fct-table-row"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '18px 20px',
              borderRight: i < tiles.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined,
              color: colors.textPrimary,
              textDecoration: 'none',
            }}
          >
            {t.trend ? (
              <Metric label={t.label} value={t.value} trend={t.trend} inverse={t.inverse} />
            ) : (
              <>
                <span style={{ fontSize: 12, color: colors.textMuted }}>{t.label}</span>
                <span style={typeScale.tileValue}>{t.value}</span>
              </>
            )}
            <span style={{ fontSize: 12, color: t.tone }}>{t.sub}</span>
          </Link>
        ))}
      </section>

      {/* §8.2 — connecting callout + consequence strip below the tiles; §8.7 tags the mixed-source screen with its source */}
      {consequenceReady && (
        <>
          <div style={{ padding: '12px 20px', fontFamily: fonts.mono, fontSize: 11, color: colors.statusAmber, background: colors.bgWarnSoft, borderRadius: 14, boxShadow: shadows.in }}>
            <Link to={`/entity/${entity.code}/p2p/invoices`} style={{ color: colors.accentText }}>{formatCr(entity.metrics.apBlocked.current)}</Link> blocked →{' '}
            <a href="#fct-consequence" style={{ color: colors.accentText }}>{formatCr(entity.metrics.accrualExposure!)}</a> {CALLOUT_MID[mode]} → COGS understated
          </div>
          <section id="fct-consequence" style={{ ...clay.card, padding: 0, gap: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Eyebrow style={typeScale.tableHeader}>Financial consequence</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* §11 — the consequence strip can pose its exposure question to the drawer */}
                <button type="button" className="fct-ask-btn" onClick={() => assistant?.ask('What is our exposure at close?')} style={{ padding: '9px 14px', fontSize: 13 }}>Ask about this exposure</button>
                <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>source: trial balance extract</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {consequence.map((c, i) => (
                c.to ? (
                  <Link key={c.label} to={c.to} className="fct-table-row" style={{ padding: '18px 20px', borderRight: i < consequence.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined, display: 'flex', flexDirection: 'column', gap: 8, color: colors.textPrimary, textDecoration: 'none' }}>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>{c.label}</span>
                    <span style={typeScale.tileValue}>{c.value}</span>
                    <span style={{ fontSize: 12, color: colors.textSecondary }}>{c.explanation}</span>
                  </Link>
                ) : (
                  <div key={c.label} style={{ padding: '18px 20px', borderRight: i < consequence.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 12, color: colors.textMuted }}>{c.label}</span>
                    <span style={typeScale.tileValue}>{c.value}</span>
                    <span style={{ fontSize: 12, color: colors.textSecondary }}>{c.explanation}</span>
                    {c.readOnly && (
                      // §8.4 — a figure that cannot drill is tagged read-only rather than silently unclickable
                      <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>read-only · source: trial balance extract</span>
                    )}
                  </div>
                )
              ))}
            </div>

            <div style={{ padding: '12px 20px', borderTop: `1px solid ${colors.borderSubtle}` }}>
              {/* §8.10 — the accrual row above is the chain's third point; the strip carries the full trace */}
              <CrossProcessTrace code={entity.code} current="accrual" />
            </div>
          </section>
        </>
      )}

      {/* §7.10 — "What moves this score": every from/to is recomputed at render; while a cap binds,
          ordinary actions deliver zero and only the cap-clearing action is shown (promoted above). */}
      <section id="fct-moves" style={{ ...clay.card, padding: 0, gap: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <Eyebrow style={typeScale.tableHeader}>What moves this score</Eyebrow>
        </div>
        {capRow && (
          <>
            <MoveRow row={capRow} emphasized />
            <div style={{ padding: '10px 20px', fontFamily: fonts.mono, fontSize: 11, color: colors.statusAmber, background: colors.bgWarnSoft, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              While the bank-change cap binds, no other action moves this score
            </div>
          </>
        )}
        {moveRows.map((row, i) => (
          <MoveRow key={row.action} row={row} last={i === moveRows.length - 1} />
        ))}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${colors.borderSubtle}` }}>
          <button type="button" onClick={() => setWeightsOpen(!weightsOpen)} style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: '0.08em', background: 'transparent', border: 'none', color: colors.accentText, cursor: 'pointer', padding: 0 }}>
            {weightsOpen ? 'Hide how this score is built' : 'How this score is built'}
          </button>
          {weightsOpen && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10 }}>
              {DIMENSION_KEYS.map((k) => (
                <span key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>
                  <span>{DIMENSION_LABELS[k]}</span>
                  <span>{`${Math.round(DIMENSION_WEIGHTS[k] * 100)}%`}</span>
                </span>
              ))}
              <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint }}>raw = Σ(dimension score × weight) · final = min(raw, active veto caps) · displayed = round(final)</span>
            </span>
          )}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: spacing.gapCards }}>
        <section style={{ ...clay.card, padding: 0, gap: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Eyebrow style={typeScale.tableHeader}>Top issues requiring attention</Eyebrow>
            <Link to={`/entity/${entity.code}/p2p/invoices`} style={{ fontSize: 12, color: colors.accentText, textDecoration: 'none' }}>Open worklist →</Link>
          </div>
          {issues.map((x) => (
            <Link
              key={x.label}
              to={x.to}
              className="fct-table-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '16px 1fr 110px 100px 150px',
                alignItems: 'center',
                gap: 12,
                padding: spacing.tableCellPadding,
                borderBottom: `1px solid ${colors.borderSubtle}`,
                color: colors.textPrimary,
                textDecoration: 'none',
              }}
            >
              <StatusDot size={8} color={x.dot} />
              <span style={{ fontSize: 13 }}>{x.label}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 13, textAlign: 'right' }}>{x.value}</span>
              <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, textAlign: 'right' }}>{x.age}</span>
              <span style={{ fontSize: 12, color: colors.textMuted, textAlign: 'right' }}>{x.owner}</span>
            </Link>
          ))}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.gapCards }}>
          <section style={{ ...clay.card, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Eyebrow style={typeScale.tableHeader}>Root cause insights</Eyebrow>
              <Link to={defaultRootCauseTo(entity.code)} style={{ fontSize: 12, color: colors.accentText, textDecoration: 'none' }}>Analyse →</Link>
            </div>
            {insights.map((c) => (
              <Link key={c.key} to={`/entity/${entity.code}/root-cause/p2p/${c.key}`} style={{ display: 'flex', flexDirection: 'column', gap: 7, color: colors.textPrimary, textDecoration: 'none' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{c.name}</span>
                  <span style={{ fontFamily: fonts.mono, color: colors.textMuted }}>{`${c.sharePct}%`}</span>
                </span>
                <Bar value={c.sharePct * INSIGHT_FILL_SCALE} max={100} />
              </Link>
            ))}
          </section>

          <section style={{ ...clay.cardAccent, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Eyebrow style={{ ...typeScale.tableHeader, color: colors.accentText }}>Recommended actions</Eyebrow>
            <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>{`${formatCr(entity.metrics.releasableCash)} working-capital release available by clearing GR compliance on ${entity.metrics.unpostedGr?.vendors ?? '—'} vendors.`}</p>
            <div style={{ display: 'flex', gap: 20, fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted }}>
              <span>{`${entity.metrics.releasableItems} resolvable today`}</span>
              {/* §7.18 — systemic = causes with no structural fix underway (notStarted); the pairing is the managed-services argument in five words */}
              <span>{`${causeBacklog(m.causeElimination!).notStarted} systemic`}</span>
            </div>
            {/* Opens the AI drawer and asks the entity's seed question (spec/07, §11) — capped entities ask why they are capped. */}
            <button type="button" className="fct-ask-btn" onClick={() => assistant?.ask(askQuestion)} style={{ padding: '9px 14px', fontSize: 13, textAlign: 'center' }}>{`Ask why this entity is ${capped ? 'capped' : 'amber'}`}</button>
          </section>
        </div>
      </div>
    </div>
  )
}

function MoveRow({ row, emphasized = false, last = false }: { row: MoveRow; emphasized?: boolean; last?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px', alignItems: 'baseline', gap: 12, padding: spacing.tableCellPadding, borderBottom: last ? undefined : `1px solid ${colors.borderSubtle}` }}>
      <span style={{ fontSize: 13, fontWeight: emphasized ? fontWeights.semibold : undefined }}>{row.action}</span>
      <span style={{ fontFamily: fonts.mono, fontSize: 13, textAlign: 'right' }}>{`${row.from} → ${row.to}`}</span>
      <span style={{ fontSize: 12, color: colors.textMuted, textAlign: 'right' }}>{`${row.effort} effort`}</span>
    </div>
  )
}

function UnknownEntity({ code }: { code: string }) {
  return (
    <div style={pageStyle}>
      <Eyebrow>Entity health</Eyebrow>
      <h1 style={titleStyle}>{`Unknown entity ${code}`}</h1>
      <p style={{ ...typeScale.body, color: colors.textSecondary, margin: 0, maxWidth: 640, lineHeight: 1.55 }}>This entity code is not in the group.</p>
      <Link to="/" className="fct-link" style={{ display: 'flex', alignItems: 'baseline', padding: '10px 12px', fontSize: 13, textDecoration: 'none' }}>Back to group view</Link>
    </div>
  )
}
