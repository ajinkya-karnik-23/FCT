import type { CSSProperties, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAccrualProvisions, getBalanceSheetIntegrity, getEntity, getIntercompany, getJournalRisk, getReconPanel, INTEGRITY_WEIGHTS, journalRiskFlagStates, listCauses, listStages } from '../api'
import type { AgeingBucket, IntegrityComponents } from '../api'
import { Bar, CrossProcessTrace, Eyebrow, FreshnessStamp, Metric, StageFlow } from '../components'
import { formatCr } from '../lib/format'
import { breachColor, scoreBand, scoreColor } from '../theme/derive'
import { colors, fonts, radius, spacing, typeScale } from '../theme/tokens'
import * as clay from '../theme/clay'

const pageStyle: CSSProperties = clay.pageStyle
const titleStyle: CSSProperties = { ...typeScale.viewTitle, margin: 0 }

// §8.3 — close % trends per entity; the Kpi look (mono 26) is kept via valueStyle.
const kpiValueStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 26 }
const cardStyle: CSSProperties = { ...clay.card, padding: 20, gap: 14 }

// §16.4 — the six components in display order; weights are read from INTEGRITY_WEIGHTS (one source).
type ComponentKey = keyof IntegrityComponents | 'provisionAdequacy'
const COMPONENT_ROWS: { key: ComponentKey; label: string }[] = [
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'intercompany', label: 'Intercompany' },
  { key: 'grIrExposure', label: 'GR/IR exposure' },
  { key: 'unappliedCash', label: 'Unapplied cash' },
  { key: 'provisionAdequacy', label: 'Provision adequacy' },
  { key: 'cutOffIntegrity', label: 'Cut-off integrity' },
]

const statLabelStyle: CSSProperties = { fontFamily: fonts.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: colors.textFaint }

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={statLabelStyle}>{label}</span>
      <span style={{ ...kpiValueStyle, color: colors.textPrimary }}>{value}</span>
    </div>
  )
}

function Stat({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={statLabelStyle}>{label}</span>
      <span style={{ ...typeScale.tileValue, color: tone ?? colors.textPrimary }}>{value}</span>
      {sub && <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{sub}</span>}
    </div>
  )
}

// §16.5 — overdue breaks by age band; the same bar grammar as AgeingChart (one data hue, top two full) at panel scale.
function ReconBars({ buckets }: { buckets: AgeingBucket[] }) {
  const maxBucket = Math.max(...buckets.map((b) => b.value))
  const topTwo = new Set(buckets.slice().sort((a, b) => b.value - a.value).slice(0, 2).map((b) => b.label))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 84 }}>
      {buckets.map((b) => (
        <div key={b.label} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>{formatCr(b.value)}</span>
          <div
            style={{
              width: '100%',
              height: Math.round((b.value / maxBucket) * 100),
              background: colors.ageingBarAlt,
              opacity: topTwo.has(b.label) ? 1 : 0.55,
              borderRadius: `${radius.sm} ${radius.sm} 3px 3px`,
            }}
          />
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

function PanelHead({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
      <Eyebrow>{title}</Eyebrow>
      <span style={clay.monoNote}>{note}</span>
    </div>
  )
}

export function R2RCockpit() {
  const { code } = useParams()
  const entity = getEntity(code ?? '')
  const stages = listStages('r2r', code)
  const firstCause = listCauses('r2r')[0].key
  // §16.4/§16.5 — the consequence layer: headline index plus the four panels, all joined from EntityMetrics in the data layer.
  const integrity = getBalanceSheetIntegrity(code ?? '')
  const recon = getReconPanel(code ?? '')
  const journal = getJournalRisk(code ?? '')
  const flags = journalRiskFlagStates(code ?? '')
  const intercompany = getIntercompany(code ?? '')
  const accruals = getAccrualProvisions(code ?? '')
  const fxExposure = entity?.metrics.fxIntercompanyExposure

  return (
    <div style={pageStyle}>
      {/* Plain div, not <header> — a nested header would register as a second banner landmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Level 2 — Process · Record to Report</Eyebrow>
          <h1 style={titleStyle}>Record to report, as one flow</h1>
          {/* §16.8 — stage figures read from SAP; breaks come from the reconciliation platform */}
          <FreshnessStamp sources={['SAP ECC', 'Reconciliation platform']} />
        </div>
        {entity && (
          <div id="fct-r2r-header-kpis" style={{ display: 'flex', gap: 34 }}>
            <Metric label="Close" value={`${entity.metrics.closePercent.current}%`} trend={entity.metrics.closePercent} inverse={false} valueStyle={kpiValueStyle} />
            {/* §7.2 — open breaks tie to the rail count and the REC stage */}
            <Kpi label="Open breaks" value={`${entity.metrics.reconAgedBreaks}`} />
          </div>
        )}
      </div>

      <StageFlow stages={stages} to={`/entity/${code}/root-cause/r2r/${firstCause}`} />

      {/* §16.4 — the balance sheet integrity index: computed at read time, never stored; it feeds the risk dimension */}
      {integrity && (
        <section id="fct-integrity" style={{ ...cardStyle, gap: 16 }}>
          <PanelHead title="Balance sheet integrity" note="weighted composite of six components" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ ...typeScale.bigScore, color: scoreColor(integrity.index) }}>{integrity.index}</span>
            <span style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.textFaint }}>/100</span>
            <span style={clay.tag(scoreColor(integrity.index))}>{scoreBand(integrity.index)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
            {COMPONENT_ROWS.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{label}</span>
                  <span style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint }}>{`${Math.round(INTEGRITY_WEIGHTS[key] * 100)}%`}</span>
                </div>
                <Bar value={integrity.components[key]} max={100} color={scoreColor(integrity.components[key])} />
                <span style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary }}>{integrity.components[key]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.gapCards }}>
        {/* §16.5 — sourced from the reconciliation platform, not SAP; overdue breaks drill to the R2R root cause */}
        <section id="fct-panel-recon" style={cardStyle}>
          <PanelHead title="Reconciliations" note="source: reconciliation platform" />
          {recon && (
            <>
              <div style={{ display: 'flex', gap: 28 }}>
                <Stat label="Accounts reconciled" value={recon.accountsReconciled} />
                <Stat label="Certified" value={recon.certified} />
                <Stat
                  label="Overdue breaks"
                  value={<Link to={`/entity/${code}/root-cause/r2r/reconciliation`} style={{ color: colors.statusRed, textDecoration: 'none' }}>{recon.overdueBreaks}</Link>}
                  sub={`oldest ${recon.oldestDays} d · ${formatCr(recon.valueCr)}`}
                />
              </div>
              <ReconBars buckets={recon.buckets} />
              <span style={{ fontSize: 12, color: colors.textMuted }}>{`${recon.breaksWithEvidence} of ${recon.overdueBreaks} with evidence attached`}</span>
            </>
          )}
        </section>

        {/* §16.5 — the seven flags are scored over the whole journal population; change-doc flags degrade to 'not scored' */}
        <section id="fct-panel-journal-risk" style={cardStyle}>
          <PanelHead title="Journal risk" note="source: SAP journal extract" />
          {journal && (
            <>
              <div style={{ display: 'flex', gap: 28 }}>
                <Stat label="Journals" value={journal.journals.toLocaleString()} />
                <Stat
                  label="High-risk JEs"
                  value={<Link to={`/entity/${code}/root-cause/r2r/journal`} style={{ color: breachColor(journal.highRiskJEs), textDecoration: 'none' }}>{journal.highRiskJEs}</Link>}
                  sub="drill to the journal root cause"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {flags.map((f) => (
                  <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 64px', alignItems: 'center', gap: 12, fontSize: 12 }}>
                    <span>{f.name}</span>
                    {f.available ? (
                      <>
                        <Bar value={journal.flagCounts[f.key] ?? 0} max={Math.max(...Object.values(journal.flagCounts))} />
                        <span style={{ fontFamily: fonts.mono, fontSize: 12, textAlign: 'right', color: colors.textSecondary }}>{journal.flagCounts[f.key] ?? 0}</span>
                      </>
                    ) : (
                      <>
                        <div><Bar value={0} /></div>
                        <span style={{ fontFamily: fonts.mono, fontSize: 10, textAlign: 'right', color: colors.textFaint }}>not scored</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {/* §16.8 — the product says which flags are missing rather than silently omitting them */}
              <span style={clay.monoNote}>preparer-equals-approver and outside-hours need SAP change documents (CDHDR/CDPOS); without the extract they read not scored</span>
            </>
          )}
        </section>

        {/* §16.5 — matched vs unmatched by counterparty with ageing and netting; Ingrevia is a related party, not a group entity */}
        <section id="fct-panel-intercompany" style={cardStyle}>
          <PanelHead title="Intercompany" note="read-only · source: trial balance extract" />
          {intercompany && fxExposure !== undefined && (
            <>
              <Stat
                label="Unmatched exposure"
                value={<Link to={`/entity/${code}/working-capital#fct-ic-netting`} style={{ color: colors.accentText, textDecoration: 'none' }}>{formatCr(fxExposure)}</Link>}
                sub="netting opportunity on the working-capital screen"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.7fr 0.8fr', gap: 12 }}>
                  <span style={typeScale.tableHeader}>Counterparty</span>
                  <span style={{ ...typeScale.tableHeader, textAlign: 'right' }}>Matched</span>
                  <span style={{ ...typeScale.tableHeader, textAlign: 'right' }}>Unmatched</span>
                  <span style={{ ...typeScale.tableHeader, textAlign: 'right' }}>Oldest</span>
                  <span style={{ ...typeScale.tableHeader, textAlign: 'right' }}>Netting</span>
                </div>
                {intercompany.map((row) => (
                  <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.9fr 0.7fr 0.8fr', gap: 12, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.name}
                      {row.relatedParty && <span style={clay.tag(colors.textMuted)}>related party</span>}
                    </span>
                    <span style={{ fontFamily: fonts.mono, textAlign: 'right' }}>{formatCr(row.matchedCr)}</span>
                    <span style={{ fontFamily: fonts.mono, textAlign: 'right', color: colors.statusRed }}>{formatCr(row.unmatchedCr)}</span>
                    <span style={{ fontFamily: fonts.mono, textAlign: 'right' }}>{`${row.oldestDays} d`}</span>
                    <span style={{ fontFamily: fonts.mono, textAlign: 'right', color: colors.accentText }}>{formatCr(row.nettingCr)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* §16.5 — prior-period accruals and their auto-reversal; the unreversed gap is derived, never stored */}
        <section id="fct-panel-accruals" style={cardStyle}>
          <PanelHead title="Accruals & provisions" note="read-only · source: trial balance extract" />
          {accruals && (
            <>
              <div style={{ display: 'flex', gap: 28 }}>
                <Stat
                  label="Accrual exposure"
                  value={<Link to={`/entity/${code}/p2p/invoices?cause=missing-gr`} style={{ color: colors.accentText, textDecoration: 'none' }}>{formatCr(accruals.exposureCr)}</Link>}
                  sub={entity?.metrics.accrualExposureNote ?? 'blocked payables not yet accrued'}
                />
                <Stat label="Provision adequacy" value={`${accruals.provisionAdequacyPct}%`} tone={scoreColor(accruals.provisionAdequacyPct)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Prior-period accruals reversed</span>
                  <span style={{ fontFamily: fonts.mono }}>{`${formatCr(accruals.reversedCr)} of ${formatCr(accruals.priorPeriodCr)}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Not auto-reversed</span>
                  <span style={{ fontFamily: fonts.mono, color: accruals.unreversedCr > 0 ? colors.statusAmber : colors.textSecondary }}>{formatCr(accruals.unreversedCr)}</span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* §8.10/§16.7 — the chain's fourth point lands here: close exposure resolves on this screen, not an anchor on the overview */}
      {entity && <CrossProcessTrace code={entity.code} current="close" />}
    </div>
  )
}
