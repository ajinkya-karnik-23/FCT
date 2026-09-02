import { describe, expect, it, vi } from 'vitest'
import {
  apControlEffectiveness,
  applySensitivity,
  applyWorklistAction,
  attributionReason,
  causeBacklog,
  causePool,
  computeScore,
  driverOpenAtMonthEnd,
  entityTileSubs,
  exceptionTimeline,
  getCashOpportunities,
  getBlockedInvoiceAgeing,
  getCause,
  getControlSignals,
  getEntity,
  getException,
  getForecast,
  getGroupSummary,
  groupRows,
  groupScore,
  groupScorePrevious,
  getO2cKpis,
  getO2cServiceControl,
  getPayablesByReason,
  getReceivablesAgeing,
  getRecurringCauses,
  getServiceControl,
  getServiceMetrics,
  itemEffort,
  listCauses,
  listEntities,
  listExceptions,
  listStages,
  monthEndIso,
  openExceptions,
  openExceptionsPrevious,
  pointDirection,
  priorScore,
  projectDsoDays,
  resetWorklistActionStore,
  serviceScorecard,
  slaBreachSplit,
  stageExceptionPct,
  trendDelta,
  valueAtRisk,
} from '../src/api'
import type { DimensionKey, DriverAssumption, Effort, Entity } from '../src/api'
import { formatRecurrence } from '../src/lib/format'
import { statusWord } from '../src/theme/derive'

// §7.21 — seeded timestamps are relative to today; the tests derive them the same way.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function daysAgo(n: number): string {
  const t = new Date()
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - n)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

describe('row counts (spec/03)', () => {
  it('6 entities', () => expect(listEntities()).toHaveLength(6))
  it('7 P2P stages', () => expect(listStages('p2p')).toHaveLength(7))
  it('72 exceptions — twelve per entity (§7.17)', () => expect(listExceptions()).toHaveLength(72))
  it('6 causes', () => expect(listCauses('p2p')).toHaveLength(6))
})

describe('spec values transcribed exactly', () => {
  it('JGL entity row', () => {
    expect(getEntity('JGL')).toMatchObject({
      code: 'JGL',
      name: 'Jubilant Generics Ltd',
      segment: 'Generics',
      geography: 'India',
      dimensions: { operational: 74, service: 78, risk: 62, workingCapital: 58, dataQuality: 90, compliance: 96 },
      metrics: {
        apBlocked: { current: 18.6, previous: 22.1 },
        arOver90: { current: 12.4, previous: 11.2 },
        cashUnapplied: { current: 3.1, previous: 2.6 },
        closePercent: { current: 78, previous: 74 },
        reconValue: { current: 14.3, previous: 15.8 },
        dso: { current: 62, previous: 59 },
        dpo: { current: 48, previous: 45 },
        dpoAdjusted: 41,
        controlBreaches: 4,
      },
    })
  })

  it('JRP entity row (weakest in group)', () => {
    expect(getEntity('JRP')).toMatchObject({
      code: 'JRP',
      name: 'Jubilant Radiopharma',
      segment: 'Radiopharma',
      geography: 'US / Canada',
      dimensions: { operational: 64, service: 66, risk: 46, workingCapital: 48, dataQuality: 74, compliance: 60 },
      metrics: {
        apBlocked: { current: 14.7, previous: 13.2 },
        arOver90: { current: 10.6, previous: 9.8 },
        cashUnapplied: { current: 4.0, previous: 3.4 },
        closePercent: { current: 52, previous: 58 },
        reconValue: { current: 12.6, previous: 11.2 },
        dso: { current: 74, previous: 69 },
        dpo: { current: 56, previous: 52 },
        dpoAdjusted: 50,
        controlBreaches: 7,
      },
    })
  })

  it('first exception row AP-104281', () => {
    expect(getException('AP-104281')).toMatchObject({
      entityCode: 'JGL',
      processKey: 'p2p',
      vendor: 'Suraksha Chemicals Pvt Ltd',
      amount: 2.84,
      ageDays: 41,
      reasonKey: 'missing-gr',
      plant: 'Nanjangud',
      owner: 'P. Nair',
      controlSignificance: 'High',
      po: 'PO-4471902',
      bookedOn: daysAgo(41), // §7.21 — relative to today, not a pinned date
      resolvableToday: false,
    })
  })

  it('missing-gr cause with narrative, drivers and actions intact', () => {
    const c = getCause('missing-gr')
    expect(c).toMatchObject({
      processKey: 'p2p',
      key: 'missing-gr',
      name: 'Missing GR',
      sharePct: 34,
      valueAtRisk: 6.4,
      avgDelayDays: 8.4,
      recurrence: 5,
      concentration: '11 vendors',
    })
    expect(c?.narrative).toContain('consignment')
    expect(c?.plants[0]).toEqual({ name: 'Nanjangud', pct: 43 })
    expect(c?.vendors).toHaveLength(4)
    expect(c?.actions).toHaveLength(3)
  })

  it('group summary aggregates', () => {
    const g = getGroupSummary()
    expect(g.score).toBe(76)
    expect(g.scorePrevious).toBe(77) // §7.15 — mean of the prior displayed scores, rounded
    expect(g.valueAtRiskCr).toBe(100.4)
    expect(g.openExceptions).toBe(1980)
    expect(g.openExceptionsPrevious).toBe(2012) // §7.16 — sum of the prior-period counts
    expect(g.closeProgress).toEqual({ pct: 71, totalTasks: 214, overdue: 19, blockers: 6, entitiesAtRisk: 3 })
    expect(g.transformationHealth).toEqual({
      automationRatePct: 68,
      repeatExceptionsQoqPct: -14,
      causeElimination: { identified: 34, eliminated: 11, inProgress: 6 }, // §7.5 — group backlog; notStarted derived
      touchlessInvoicesPct: 54,
    })
  })

  it('per-entity §7.18 mode-panel figures are pinned and cause elimination sums to the group backlog', () => {
    // §7.18 — unposted GR value is accrualExposure itself (§8.2), so only vendors/recurrence are stored per entity.
    const expected: Record<string, { unpostedGr: { vendors: number; recurrenceMonths: number }; causeElimination: { identified: number; eliminated: number; inProgress: number }; cashOpportunity: { value: number; items: number } }> = {
      JGL: { unpostedGr: { vendors: 11, recurrenceMonths: 5 }, causeElimination: { identified: 8, eliminated: 3, inProgress: 2 }, cashOpportunity: { value: 11.3, items: 88 } },
      JBL: { unpostedGr: { vendors: 8, recurrenceMonths: 4 }, causeElimination: { identified: 7, eliminated: 2, inProgress: 1 }, cashOpportunity: { value: 7.4, items: 61 } },
      JPS: { unpostedGr: { vendors: 5, recurrenceMonths: 2 }, causeElimination: { identified: 5, eliminated: 2, inProgress: 1 }, cashOpportunity: { value: 4.3, items: 34 } },
      JCP: { unpostedGr: { vendors: 2, recurrenceMonths: 1 }, causeElimination: { identified: 3, eliminated: 2, inProgress: 0 }, cashOpportunity: { value: 1.5, items: 12 } },
      JHS: { unpostedGr: { vendors: 3, recurrenceMonths: 2 }, causeElimination: { identified: 4, eliminated: 1, inProgress: 1 }, cashOpportunity: { value: 2.9, items: 24 } },
      JRP: { unpostedGr: { vendors: 14, recurrenceMonths: 6 }, causeElimination: { identified: 7, eliminated: 1, inProgress: 1 }, cashOpportunity: { value: 9.2, items: 79 } },
    }
    for (const e of listEntities()) {
      expect(e.metrics.unpostedGr).toEqual(expected[e.code].unpostedGr)
      expect(e.metrics.causeElimination).toEqual(expected[e.code].causeElimination)
      expect(e.metrics.cashOpportunity).toEqual(expected[e.code].cashOpportunity)
    }

    // §7.18 — per-entity cause elimination must sum to the group figures in §7.5: 34 identified, 11 eliminated, 6 in progress, 17 not started.
    const group = getGroupSummary().transformationHealth.causeElimination
    let sums = { identified: 0, eliminated: 0, inProgress: 0, notStarted: 0 }
    for (const e of listEntities()) {
      const b = causeBacklog(e.metrics.causeElimination!)
      sums = { identified: sums.identified + b.identified, eliminated: sums.eliminated + b.eliminated, inProgress: sums.inProgress + b.inProgress, notStarted: sums.notStarted + b.notStarted }
    }
    expect(sums).toEqual({ identified: 34, eliminated: 11, inProgress: 6, notStarted: 17 }) // §7.5 group figures
    expect(sums.identified).toBe(group.identified)
    expect(sums.eliminated).toBe(group.eliminated)
    expect(sums.inProgress).toBe(group.inProgress)
    expect(sums.notStarted).toBe(causeBacklog(group).notStarted) // derived, never stored
  })

  // §7.31 — ageing is per entity, and the buckets are shares of that entity's pool: a chart beside a stage
  // figure must sum to it. The profile stops at the bucket its pool oldest reaches, so array length encodes count.
  const BLOCKED_BUCKET_COUNTS: Record<string, number> = { JGL: 5, JBL: 5, JPS: 4, JCP: 3, JHS: 3, JRP: 5 }

  it('blocked-invoice ageing ties to each entity\'s blocked AP (§7.31)', () => {
    for (const e of listEntities()) {
      const buckets = getBlockedInvoiceAgeing(e.code)
      expect(buckets).toHaveLength(BLOCKED_BUCKET_COUNTS[e.code])
      const sum = Math.round(buckets.reduce((s, b) => s + b.value, 0) * 10) / 10
      expect(sum).toBe(e.metrics.apBlocked.current) // the chart sums to the invoice stage beside it
    }
    // JGL's pinned spec/05 values survive the per-entity split.
    const jgl = getBlockedInvoiceAgeing('JGL')
    expect(jgl[0]).toEqual({ label: '0-15 d', value: 5.9 })
    expect(jgl[jgl.length - 1]).toEqual({ label: '> 90 d', value: 1.8 })
  })

  it('receivables ageing ties to each entity\'s open AR (§7.31/§7.25)', () => {
    for (const e of listEntities()) {
      const buckets = getReceivablesAgeing(e.code)
      expect(buckets).toHaveLength(5)
      // Buckets 4–5 are the >90-day AR; all five sum to total open AR — the O2C collection stage (§7.25).
      const over90 = Math.round((buckets[3].value + buckets[4].value) * 10) / 10
      expect(over90).toBe(e.metrics.arOver90.current)
      const total = Math.round(buckets.reduce((s, b) => s + b.value, 0) * 10) / 10
      expect(total).toBe(listStages('o2c', e.code).find((s) => s.step === 'COL')!.inFlightValue)
    }
    // JGL's pinned spec/05 values survive the per-entity split.
    const jgl = getReceivablesAgeing('JGL')
    expect(jgl[0]).toEqual({ label: '0-30 d', value: 24.1 })
    expect(jgl[jgl.length - 1]).toEqual({ label: '> 180 d', value: 5 })
  })

  it('overdue service queries are pinned per entity (§7.31)', () => {
    const expected: Record<string, number> = { JGL: 27, JBL: 34, JPS: 11, JCP: 4, JHS: 8, JRP: 41 }
    for (const e of listEntities()) expect(e.metrics.queriesOverdue).toBe(expected[e.code])
  })

  it('cash opportunities and supporting datasets', () => {
    const cash = getCashOpportunities()
    expect(cash).toHaveLength(4)
    expect(cash[0]).toMatchObject({
      name: 'Release invoices where GR posted this week',
      value: 4.2,
      items: 38,
      effort: 'Low',
      owner: 'P2P tower',
    })

    const reasons = getPayablesByReason()
    expect(reasons).toHaveLength(5)
    expect(reasons[0]).toEqual({ name: 'Missing GR', value: 6.4 })

    expect(getRecurringCauses()).toHaveLength(4)
    // §7.31 — queriesOverdue moved to per-entity metrics; the service control keeps its three group figures.
    expect(getServiceControl()).toEqual({ slaInvoiceBookingPct: 93.1, duplicatePaymentRiskCr: 0.9, manualPaymentRuns: 4 })
  })
})

describe('O2C datasets (spec/08)', () => {
  it('7 O2C stages, 5 receivables ageing buckets and 6 O2C causes', () => {
    expect(listStages('o2c')).toHaveLength(7)
    expect(getReceivablesAgeing('JGL')).toHaveLength(5)
    expect(listCauses('o2c')).toHaveLength(6)
  })

  it('every O2C cause has a non-empty narrative and exactly three actions', () => {
    const o2c = listCauses('o2c')
    expect(o2c).toHaveLength(6) // guard: the loop below would pass vacuously on an empty set
    for (const c of o2c) {
      expect(c.narrative.length).toBeGreaterThan(0)
      expect(c.actions).toHaveLength(3)
    }
  })

  it('O2C header KPIs and service & control values transcribed exactly', () => {
    expect(getO2cKpis()).toEqual({ dsoDays: 62, overdueArCr: 20.6, unappliedCr: 3.1 })
    expect(getO2cServiceControl()).toEqual({ billingAccuracyPct: 96.4, openDisputes: 34, ordersOnCreditBlock: 18, unappliedReceipts: 19 })
  })
})

describe('per-entity stage tables (§7.25)', () => {
  const ENTITIES = ['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP'] as const
  // §7.25 — pinned in-flight values: PO ties to Σ cost-centre committed; collection to total open AR.
  const PO_IN_FLIGHT_CR: Record<string, number> = { JGL: 58.4, JBL: 35.5, JPS: 21.4, JCP: 6.6, JHS: 13.2, JRP: 46.2 }
  const COLLECTION_IN_FLIGHT_CR: Record<string, number> = { JGL: 56.3, JBL: 40.4, JPS: 23.2, JCP: 8.6, JHS: 17.3, JRP: 48.1 }

  it('all six tie points hold for all six entities', () => {
    for (const code of ENTITIES) {
      const e = getEntity(code)!
      const p2p = listStages('p2p', code)
      const o2c = listStages('o2c', code)
      // Invoice stage ties to the entity's blocked-AP metric (count and value).
      expect(p2p.find((s) => s.step === 'INV')!.inException).toBe(e.metrics.apBlockedCount)
      expect(p2p.find((s) => s.step === 'INV')!.exceptionValue).toBe(e.metrics.apBlocked.current)
      // PO in-flight ties to the pinned table (Σ cost-centre committed is asserted in counterparty.test.tsx).
      expect(p2p.find((s) => s.step === 'PO')!.inFlightValue).toBe(PO_IN_FLIGHT_CR[code])
      // Collection stage ties to the entity's O2C exception count and the pinned collection in-flight.
      const col = o2c.find((s) => s.step === 'COL')!
      expect(col.inException).toBe(e.metrics.o2cExceptionCount)
      expect(col.inFlightValue).toBe(COLLECTION_IN_FLIGHT_CR[code])
      // Cash application ties to the entity's unapplied cash.
      expect(o2c.find((s) => s.step === 'CSH')!.exceptionValue).toBe(e.metrics.cashUnapplied.current)
    }
  })

  it('non-JGL tables differ from the JGL default — one shared dataset is gone', () => {
    for (const code of ENTITIES) {
      if (code === 'JGL') continue
      expect(listStages('p2p', code)).not.toEqual(listStages('p2p'))
      expect(listStages('o2c', code)).not.toEqual(listStages('o2c'))
    }
  })
})

describe('derived status never drifts from score', () => {
  it('statusWord(displayed) equals the computed band for every entity', () => {
    for (const e of listEntities()) {
      const s = computeScore(e)
      expect(statusWord(s.displayed)).toBe(s.band)
    }
  })
})

describe('acceptance criteria (§3 scoring model)', () => {
  const byCode = (code: string) => computeScore(getEntity(code)!)

  it('per-entity displayed scores match §7', () => {
    expect(byCode('JGL').displayed).toBe(74)
    expect(byCode('JBL').displayed).toBe(67)
    expect(byCode('JPS').displayed).toBe(81)
    expect(byCode('JCP').displayed).toBe(91)
    expect(byCode('JHS').displayed).toBe(88)
    expect(byCode('JRP').displayed).toBe(55)
  })

  it('JRP is capped by the bank-change veto', () => {
    const s = byCode('JRP')
    expect(s.cappedBy?.rule).toContain('vendor bank detail change')
    expect(s.raw).toBeGreaterThan(55)
  })

  it('group aggregates match §7.2', () => {
    expect(groupScore()).toBe(76)
    expect(valueAtRisk()).toBe(100.4)
    expect(openExceptions()).toBe(1980)
  })
})

describe('pure helpers', () => {
  it('trendDelta reports direction and one-decimal percent change (§8.5.1)', () => {
    const jgl = getEntity('JGL')!
    // inverse=true — lower is better: a drop improves, a rise worsens.
    expect(trendDelta(jgl.metrics.apBlocked, true)).toEqual({ direction: 'improving', percent: -15.8 })
    expect(trendDelta(jgl.metrics.arOver90, true)).toEqual({ direction: 'worsening', percent: 10.7 })
    expect(trendDelta(jgl.metrics.cashUnapplied, true)).toEqual({ direction: 'worsening', percent: 19.2 })
    // inverse=false — higher is better (close %): 62 vs 58 is improving.
    expect(trendDelta({ current: 62, previous: 58, series: [] }, false)).toEqual({ direction: 'improving', percent: 6.9 })
    // null — direction-neutral (DPO): the move is reported but never coloured.
    expect(trendDelta({ current: 48, previous: 45, series: [] }, null)).toEqual({ direction: 'neutral', percent: 6.7 })
  })

  it('pointDirection mirrors trendDelta polarity for two-point figures (§7.15/§7.16)', () => {
    expect(pointDirection(74, 72, false)).toBe('improving') // score: higher is better
    expect(pointDirection(67, 69, false)).toBe('worsening')
    expect(pointDirection(88, 88, false)).toBe('flat')
    expect(pointDirection(1980, 2012, true)).toBe('improving') // exceptions: lower is better
    expect(pointDirection(214, 197, true)).toBe('worsening')
    expect(pointDirection(2, 2, true)).toBe('flat')
  })

  it('stageExceptionPct derives the §7.4 exception share', () => {
    expect(stageExceptionPct(listStages('p2p')[3])).toBe(26)
  })
})

describe('filters', () => {
  it('every entity carries its twelve seeded p2p exceptions (§7.17)', () => {
    for (const e of listEntities()) expect(listExceptions(e.code, 'p2p')).toHaveLength(12)
  })
  it('no stages for r2r in the mock set', () => expect(listStages('r2r')).toHaveLength(0))
})

describe('cause pools (§7.20)', () => {
  // §7.20 — denominators follow the filter: each entity's cause pools partition its blocked AP exactly, and a
  // cause's sampled rows never exceed that cause's value at risk (the sample is value-ranked, so it over-represents value).
  const P2P_CAUSES = listCauses('p2p').map((c) => c.key)

  for (const e of listEntities()) {
    it(`${e.code}: the six cause pools sum to its ${e.metrics.apBlockedCount} blocked invoices`, () => {
      const counts = P2P_CAUSES.map((k) => causePool(e.code, k)?.count ?? -1)
      expect(counts.reduce((a, b) => a + b, 0)).toBe(e.metrics.apBlockedCount)
    })
  }

  it('JGL: the pools match the §7.20 table', () => {
    const byKey = Object.fromEntries(P2P_CAUSES.map((k) => [k, causePool('JGL', k)]))
    expect(byKey['missing-gr']).toEqual({ count: 111, valueCr: 6.4 })
    expect(byKey['po-price-mismatch']).toEqual({ count: 72, valueCr: 4.1 })
    expect(byKey['approval-pending']).toEqual({ count: 59, valueCr: 3.3 })
    expect(byKey['vendor-master']).toEqual({ count: 36, valueCr: 2.0 })
    expect(byKey['duplicate-suspicion']).toEqual({ count: 26, valueCr: 1.5 })
    expect(byKey['tax-mismatch']).toEqual({ count: 23, valueCr: 1.3 })
  })

  for (const e of listEntities()) {
    it(`${e.code}: sampled rows never exceed a cause's value at risk`, () => {
      const rows = listExceptions(e.code, 'p2p')
      for (const c of listCauses('p2p')) {
        const sum = Math.round(rows.filter((x) => x.reasonKey === c.key).reduce((s, x) => s + x.amount, 0) * 100) / 100
        expect(sum).toBeLessThanOrEqual(c.valueAtRisk)
      }
    })
  }

  it('unknown or non-p2p causes fall back to the entity-wide pool', () => {
    expect(causePool('JGL', 'not-a-cause')).toBeUndefined()
    expect(causePool('JGL', 'pricing-disputes')).toBeUndefined() // o2c node — no p2p worklist denominator
  })
})

describe('seeded exceptions per entity (§7.17)', () => {
  // §7.17 — each entity's twelve-row sample sums to its shown value, no row's age exceeds the
  // entity's pool oldest (§7.13; the oldest sampled row need not reach it), and every entity keeps
  // at least three goods-receipt rows so the filtered drill is never empty. JGL's pinned spec/05
  // literals sum to the table's ₹12.77 cr — the sample, not the pool.
  const SHOWN_VALUE: Record<string, number> = { JGL: 12.77, JBL: 7.8, JPS: 4.7, JCP: 1.4, JHS: 2.9, JRP: 10.1 }
  // §7.19 — resolvable-today count and value per entity (the chip carries a number on all six).
  const RESOLVABLE_TODAY: Record<string, { items: number; cash: number }> = {
    JGL: { items: 38, cash: 4.2 },
    JBL: { items: 25, cash: 2.6 },
    JPS: { items: 11, cash: 1.5 },
    JCP: { items: 5, cash: 0.5 },
    JHS: { items: 8, cash: 0.9 },
    JRP: { items: 31, cash: 3.3 },
  }
  const ATTRIBUTION_BY_CAUSE: Record<string, string> = {
    'missing-gr': 'client',
    'po-price-mismatch': 'client',
    'approval-pending': 'client',
    'vendor-master': 'provider',
    'duplicate-suspicion': 'system',
    'tax-mismatch': 'provider',
  }

  for (const code of ['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP']) {
    const rows = listExceptions(code, 'p2p')

    it(`${code}: twelve rows summing to the shown value in descending order`, () => {
      expect(rows).toHaveLength(12)
      const sum = Math.round(rows.reduce((s, x) => s + x.amount, 0) * 100) / 100
      expect(sum).toBe(SHOWN_VALUE[code])
      for (let i = 1; i < rows.length; i++) expect(rows[i].amount).toBeLessThanOrEqual(rows[i - 1].amount)
    })

    it(`${code}: ages respect the oldest-item ceiling`, () => {
      const maxAge = getEntity(code)!.metrics.apBlockedOldestDays
      for (const x of rows) expect(x.ageDays).toBeLessThanOrEqual(maxAge) // §7.17 — sampled rows stay ≤ the pool oldest; need not reach it
    })

    it(`${code}: at least three goods-receipt rows keep the filtered drill non-empty`, () => {
      const gr = rows.filter((x) => x.reasonKey === 'missing-gr')
      expect(gr.length).toBeGreaterThanOrEqual(3)
    })

    it(`${code}: attribution follows the §7.6 cause mapping`, () => {
      for (const x of rows) expect(x.attribution).toBe(ATTRIBUTION_BY_CAUSE[x.reasonKey])
    })

    it(`${code}: every row carries three stamped evidence lines and an open status`, () => {
      for (const x of rows) {
        expect(x.status).toBe('open')
        expect(x.evidence).toHaveLength(3)
        for (const line of x.evidence ?? []) expect(line).toMatch(/ \d{2}-[A-Za-z]{3} \d{2}:\d{2}$/)
      }
    })

    it(`${code}: resolvable-today count and value match §7.19`, () => {
      const m = getEntity(code)!.metrics
      expect(m.releasableItems).toBe(RESOLVABLE_TODAY[code].items)
      expect(m.releasableCash).toBe(RESOLVABLE_TODAY[code].cash)
    })

    if (code !== 'JGL') {
      it(`${code}: exactly three rows are resolvable today, all on tabulated causes (§7.19)`, () => {
        const resolvable = rows.filter((x) => x.resolvableToday)
        expect(resolvable).toHaveLength(3)
        for (const x of resolvable) expect(['missing-gr', 'po-price-mismatch', 'approval-pending']).toContain(x.reasonKey)
      })
    }
  }

  it('JGL: the four pinned resolvable-today rows are exactly §7.3\'s set (§7.19)', () => {
    expect(listExceptions('JGL', 'p2p').filter((x) => x.resolvableToday).map((x) => x.id).sort()).toEqual([
      'AP-104355',
      'AP-104473',
      'AP-104570',
      'AP-104588',
    ])
  })

  it('every seeded timestamp is today − ageDays (§7.21)', () => {
    for (const x of listExceptions()) expect(x.bookedOn).toBe(daysAgo(x.ageDays))
  })
})

describe('item effort and attribution reason (§7.19/§8.9)', () => {
  it('effort is a property of the item — cause plus resolvable state, per the §7.19 eight-situation table', () => {
    // The three tabulated causes: same cause reads High/Medium while open, Low when resolvable today.
    expect(itemEffort({ reasonKey: 'missing-gr', resolvableToday: false })).toBe('High')
    expect(itemEffort({ reasonKey: 'missing-gr', resolvableToday: true })).toBe('Low')
    expect(itemEffort({ reasonKey: 'po-price-mismatch', resolvableToday: false })).toBe('High')
    expect(itemEffort({ reasonKey: 'po-price-mismatch', resolvableToday: true })).toBe('Low')
    expect(itemEffort({ reasonKey: 'approval-pending', resolvableToday: false })).toBe('Medium')
    expect(itemEffort({ reasonKey: 'approval-pending', resolvableToday: true })).toBe('Low')
    // The untabulated causes follow the same shape.
    for (const key of ['vendor-master', 'duplicate-suspicion', 'tax-mismatch']) {
      expect(itemEffort({ reasonKey: key, resolvableToday: false })).toBe('Medium')
      expect(itemEffort({ reasonKey: key, resolvableToday: true })).toBe('Low')
    }
  })

  it('the resolvable-today set is exactly the Low-effort rows', () => {
    for (const x of listExceptions()) expect(itemEffort(x) === 'Low').toBe(x.resolvableToday)
  })

  it('attribution reason names the side that owns the fix', () => {
    expect(attributionReason('missing-gr')).toContain('client plant stores')
    expect(attributionReason('vendor-master')).toContain('provider-run AP process')
    expect(attributionReason('duplicate-suspicion')).toContain('dedup control')
  })
})

describe('worklist actions (§8.9)', () => {
  const x = getException('AP-104281')!

  it('assign / chase / release append a timestamped evidence line and set the status', () => {
    expect(x.evidence).toHaveLength(3)
    applyWorklistAction(x, 'assign')
    expect(x.status).toBe('assigned')
    expect(x.evidence![3]).toMatch(/^Assigned to P\. Nair \d{2}-[A-Za-z]{3} \d{2}:\d{2}$/)

    applyWorklistAction(x, 'chase')
    expect(x.status).toBe('chased')
    expect(x.evidence![4]).toMatch(/^Chased with Suraksha Chemicals Pvt Ltd \d{2}-[A-Za-z]{3} \d{2}:\d{2}$/)

    applyWorklistAction(x, 'release')
    expect(x.status).toBe('released')
    expect(x.evidence![5]).toMatch(/^Released — block cleared \d{2}-[A-Za-z]{3} \d{2}:\d{2}$/)
  })

  it('reset restores the seeded evidence and status exactly', () => {
    applyWorklistAction(x, 'chase')
    resetWorklistActionStore()
    expect(x.status).toBe('open')
    expect(x.evidence).toHaveLength(3)
  })
})

describe('exception timeline (§7.6/§8.9)', () => {
  it("AP-104281 renders the seeded lifecycle plus today's open status", () => {
    const events = exceptionTimeline(getException('AP-104281')!)
    expect(events).toHaveLength(6)
    expect(events[0].text).toBe('PO released to vendor')
    expect(events[5]).toEqual({ dateLabel: 'Today', text: 'Awaiting GR — escalation due in 6 hours', tone: 'now' })
  })

  it('a cleared blocker reads as ready, not as still waiting (§7.19)', () => {
    const events = exceptionTimeline(getException('AP-104355')!)
    expect(events[events.length - 1]).toEqual({ dateLabel: 'Today', text: 'Approver active — one nudge releases it', tone: 'ok' })
  })

  it('session actions appear as timeline rows; release drops the open status line', () => {
    const x = getException('AP-104281')!
    applyWorklistAction(x, 'chase')
    let events = exceptionTimeline(x)
    expect(events).toHaveLength(7)
    expect(events[5].text).toBe('Chased with Suraksha Chemicals Pvt Ltd')

    applyWorklistAction(x, 'release')
    events = exceptionTimeline(x)
    expect(events.some((e) => e.text === 'Awaiting GR — escalation due in 6 hours')).toBe(false)
    resetWorklistActionStore()
  })
})

describe('sensitivity (§7.10)', () => {
  // Deltas are computed, never stored — the table holds dimension movements only.
  const expected: Record<string, Array<[string, number, DimensionKey | null, Effort]>> = {
    JGL: [
      ['Clear GR compliance on 11 consignment vendors', 35, 'workingCapital', 'Low'],
      ['Close 18 aged reconciliation breaks', 15, 'risk', 'Medium'],
      ['Apply matched receipts to open AR', 5, 'workingCapital', 'Low'],
      ['Resolve 12 high-risk manual journals', 10, 'risk', 'Low'],
    ],
    JBL: [
      ['Clear SoD conflict on vendor creation and payment release', 25, 'risk', 'Medium'],
      ['Reduce approval cycle at Ambernath', 15, 'operational', 'Medium'],
      ['Settle 9 open close blockers', 10, 'operational', 'High'],
    ],
    JPS: [
      ['Complete intercompany matching with JGL', 20, 'workingCapital', 'Medium'],
      ['Clear 7 aged reconciliation breaks', 10, 'risk', 'Low'],
    ],
    JCP: [
      ['Close 2 open reconciliation breaks', 5, 'risk', 'Low'],
      ['Apply 2 unapplied receipts', 5, 'workingCapital', 'Low'],
    ],
    JHS: [
      ['Clear 4 aged reconciliation breaks', 10, 'risk', 'Low'],
      ['Resolve GR timing on the sterile line', 10, 'operational', 'Medium'],
    ],
    JRP: [
      ['Resolve the unauthorised vendor bank change', 0, null, 'High'],
      ['File the overdue GST/HST return', 40, 'compliance', 'Low'],
      ['Clear 26 aged reconciliation breaks', 20, 'risk', 'Medium'],
    ],
  }

  it('every entity carries its §7.10 sensitivity table verbatim', () => {
    for (const e of listEntities()) {
      expect(e.sensitivity.map((i) => [i.action, i.dimensionMovement, i.dimension, i.effort] as const)).toEqual(expected[e.code])
    }
  })

  it('no item implies a dimension moving beyond its headroom to 100', () => {
    for (const e of listEntities()) {
      const cumulative: Partial<Record<DimensionKey, number>> = {}
      for (const item of e.sensitivity) {
        if (item.dimension === null) continue // veto-clear only — no weighted movement (§7.10)
        expect(e.dimensions[item.dimension] + item.dimensionMovement).toBeLessThanOrEqual(100)
        cumulative[item.dimension] = (cumulative[item.dimension] ?? 0) + item.dimensionMovement
      }
      for (const key of Object.keys(cumulative) as DimensionKey[]) {
        expect(e.dimensions[key] + cumulative[key]).toBeLessThanOrEqual(100)
      }
    }
  })

  it('JRP names the vetoes its items clear, and the bank-change item carries no movement', () => {
    const jrp = getEntity('JRP')!
    expect(jrp.sensitivity.map((i) => i.clearsVeto)).toEqual(['bankChange', 'gstOverdue', undefined])
    const bank = jrp.sensitivity[0]
    expect(bank.dimension).toBeNull()
    expect(bank.dimensionMovement).toBe(0)
  })
})

describe('JRP cascade (§7.10.1)', () => {
  const jrp = getEntity('JRP')!
  const byAction = (action: string) => jrp.sensitivity.find((i) => i.action === action)!

  function walk(actions: string[]): number[] {
    let state = jrp
    const path = [computeScore(state).displayed]
    for (const action of actions) {
      state = applySensitivity(state, byAction(action)).state
      path.push(computeScore(state).displayed)
    }
    return path
  }

  it('correct order: bank change first — 55 → 58 → 64 → 68', () => {
    expect(
      walk([
        'Resolve the unauthorised vendor bank change',
        'File the overdue GST/HST return',
        'Clear 26 aged reconciliation breaks',
      ]),
    ).toEqual([55, 58, 64, 68])
  })

  it('wrong order: filing the return first delivers nothing while the bank-change cap binds', () => {
    expect(
      walk([
        'File the overdue GST/HST return',
        'Resolve the unauthorised vendor bank change',
        'Clear 26 aged reconciliation breaks',
      ]),
    ).toEqual([55, 55, 64, 68])
  })

  it('filing first: raw rises to 63.9 but the binding cap stays at 55 (bank change)', () => {
    const step = applySensitivity(jrp, byAction('File the overdue GST/HST return'))
    expect(step.score.raw).toBe(63.9)
    expect(step.score.displayed).toBe(55)
    expect(step.score.cappedBy?.id).toBe('bankChange')
  })
})

describe('JRP vetoes (§7.1)', () => {
  it('carries both active vetoes and displays the minimum cap', () => {
    const jrp = getEntity('JRP')!
    expect(jrp.vetoes).toHaveLength(2)
    for (const v of jrp.vetoes) expect(v.active).toBe(true)
    const s = computeScore(jrp)
    expect(s.displayed).toBe(55)
    expect(s.cappedBy?.cap).toBe(55)
  })

  it('demo path: with the bank-change veto cleared, JRP displays 58', () => {
    const jrp = getEntity('JRP')!
    const demo: Entity = { ...jrp, vetoes: jrp.vetoes.map((v) => (v.cap === 55 ? { ...v, active: false } : v)) }
    const s = computeScore(demo)
    expect(s.displayed).toBe(58)
    expect(s.raw).toBe(57.9)
    expect(s.cappedBy).toBeNull() // raw 57.9 sits under the remaining cap of 60
  })
})

describe('attribution split (§7.11)', () => {
  it('group split computed from entity counts is 71/18/7/4 of 142', () => {
    const g = slaBreachSplit()
    expect(g.total).toBe(142)
    expect(g.counts).toEqual({ client: 101, provider: 25, system: 10, thirdParty: 6 })
    expect(g.pct).toEqual({ client: 71, provider: 18, system: 7, thirdParty: 4 })
  })

  it('JGL split is 72/19/6/3 of 32 — an entity is not the group', () => {
    const jgl = slaBreachSplit('JGL')
    expect(jgl.total).toBe(32)
    expect(jgl.pct).toEqual({ client: 72, provider: 19, system: 6, thirdParty: 3 })
  })

  it('entity breach totals match §7.11', () => {
    const totals: Record<string, number> = {}
    for (const e of listEntities()) totals[e.code] = slaBreachSplit(e.code).total
    expect(totals).toEqual({ JGL: 32, JBL: 41, JPS: 12, JCP: 3, JHS: 6, JRP: 48 })
  })

  it('JGL per-SLA rows cross-tie to its entity counts', () => {
    const jgl = getEntity('JGL')!
    for (const row of getServiceMetrics('JGL').filter((r) => r.measurability === 'day-one')) {
      expect(row.attributionSplit).toBeDefined()
      const sum = Object.values(row.attributionSplit!).reduce((a, b) => a + b, 0)
      expect(sum).toBe(row.breaches)
    }
    for (const k of ['client', 'provider', 'system', 'thirdParty'] as const) {
      const perSla = getServiceMetrics('JGL').filter((r) => r.measurability === 'day-one').reduce((sum, r) => sum + r.attributionSplit![k], 0)
      expect(perSla).toBe(jgl.metrics.slaBreachCounts[k])
    }
  })
})

describe('service scorecard (§4, §7.22)', () => {
  it('JGL is pinned: gross 95.2, net 98.6 — the 3.4-point gap is the attribution argument', () => {
    // Gross: (93.1 + 96.4 + 98.2 + 91.0 + 97.5) / 5 = 95.24 → 95.2
    // Net per SLA: 100 − (100 − achieved) × providerShare, then averaged → 98.6
    // altNet counts system delay against the provider too — for JGL the two readings differ by 0.6 points.
    expect(serviceScorecard('JGL')).toEqual({ gross: 95.2, net: 98.6, altNet: 98 })
  })

  it("JGL's five day-one rows are the pinned §7.7 values and never move", () => {
    expect(getServiceMetrics('JGL').filter((r) => r.measurability === 'day-one')).toEqual([
      { sla: 'Invoice processing TAT', process: 'p2p', target: '3 business days', achieved: 93.1, breaches: 22, attributionSplit: { client: 18, provider: 3, system: 1, thirdParty: 0 }, measurability: 'day-one' },
      { sla: 'Urgent invoice TAT', process: 'p2p', target: '1 business day', achieved: 96.4, breaches: 4, attributionSplit: { client: 3, provider: 1, system: 0, thirdParty: 0 }, measurability: 'day-one' },
      { sla: 'Payment processing', process: 'p2p', target: '2 business days', achieved: 98.2, breaches: 3, attributionSplit: { client: 1, provider: 1, system: 0, thirdParty: 1 }, measurability: 'day-one' },
      { sla: 'Sub-ledger close TAT', process: 'r2r', target: 'Day 2', achieved: 91.0, breaches: 2, attributionSplit: { client: 1, provider: 1, system: 0, thirdParty: 0 }, measurability: 'day-one' },
      { sla: 'Bank reconciliation TAT', process: 'r2r', target: 'Day 3', achieved: 97.5, breaches: 1, attributionSplit: { client: 0, provider: 0, system: 1, thirdParty: 0 }, measurability: 'day-one' },
    ])
  })

  it('per-entity rows satisfy the §7.22 constraints for every entity', () => {
    const GROSS_MEANS: Record<string, number> = { JCP: 98.8, JHS: 97.6, JPS: 96.8, JGL: 95.2, JBL: 94.0, JRP: 92.4 }
    const NET_MEANS: Record<string, number> = { JCP: 98.9, JHS: 98.5, JPS: 98.6, JGL: 98.6, JBL: 98.2, JRP: 97.9 }
    const ALT_NETS: Record<string, number> = { JCP: 98.9, JHS: 98.5, JPS: 98.6, JGL: 98, JBL: 96.9, JRP: 95.8 }
    for (const code of Object.keys(GROSS_MEANS)) {
      const rows = getServiceMetrics(code)
      expect(rows).toHaveLength(10) // five day-one + five needs-*
      const dayOne = rows.filter((r) => r.measurability === 'day-one')

      // Per-SLA breach counts sum to the entity's stored total.
      expect(dayOne.reduce((s, r) => s + r.breaches!, 0)).toBe(slaBreachSplit(code).total)

      // Per-SLA attribution sums to the entity's stored attribution counts.
      for (const k of ['client', 'provider', 'system', 'thirdParty'] as const) {
        expect(dayOne.reduce((s, r) => s + r.attributionSplit![k], 0)).toBe(slaBreachSplit(code).counts[k])
      }

      // The mean of the five gross achievements equals the entity's §7.22 value.
      expect(serviceScorecard(code).gross).toBe(GROSS_MEANS[code])

      // Net and altNet are pinned per entity too — the exclusion set is a contract term, not a rounding choice.
      expect(serviceScorecard(code).net).toBe(NET_MEANS[code])
      expect(serviceScorecard(code).altNet).toBe(ALT_NETS[code])

      // needs-* rows stay unmeasurable on every entity — no clock start anywhere.
      for (const r of rows.filter((r) => r.measurability !== 'day-one')) {
        expect(r.achieved).toBeUndefined()
        expect(r.breaches).toBeUndefined()
      }
    }
  })
})

describe('control signals (§7.8, §7.21)', () => {
  it('the eight §7.8 rows are transcribed exactly; detection dates derive as today − N days', () => {
    expect(getControlSignals()).toEqual([
      { id: 'cs-bank-change', category: 'payment', title: 'Vendor bank detail changed 3 days before payment run', detail: 'The change bypassed the vendor-master approval step and lands ahead of the scheduled payment run.', severity: 'High', valueAtRiskCr: 2.4, entityCode: 'JRP', detectedOn: daysAgo(12) },
      { id: 'cs-first-payee', category: 'payment', title: 'First-time payee above ₹50 lakh threshold', detail: 'A first-time payee cleared for payment before onboarding verification completed.', severity: 'Medium', valueAtRiskCr: 0.8, entityCode: 'JGL', detectedOn: daysAgo(21) },
      { id: 'cs-po-split', category: 'authority', title: 'PO split into 3 below approval threshold', detail: 'Each part clears on its own authority level; the combined value does not.', severity: 'High', valueAtRiskCr: 1.9, entityCode: 'JBL', detectedOn: daysAgo(34) },
      { id: 'cs-retro-po', category: 'authority', title: 'Retrospective PO — dated after invoice', detail: 'The purchase order was created after the invoice it covers, reversing the required sequence.', severity: 'Medium', valueAtRiskCr: 0.6, entityCode: 'JGL', detectedOn: daysAgo(46) },
      { id: 'cs-sod-conflict', category: 'system', title: 'SoD conflict: same user creates vendor and releases payment', detail: 'One user id can create a vendor master record and release its first payment.', severity: 'High', entityCode: 'JBL', detectedOn: daysAgo(28) },
      { id: 'cs-terms-change', category: 'system', title: 'Payment terms changed on 7 vendors without approval', detail: 'Terms were edited outside the change-approval workflow.', severity: 'Medium', entityCode: 'JRP', detectedOn: daysAgo(40) },
      { id: 'cs-cutoff-grs', category: 'cutoff', title: '14 goods receipts posted across period end', detail: 'Receipts landed on both sides of the cut-off and shift expense between periods.', severity: 'High', valueAtRiskCr: 3.1, entityCode: 'JGL', detectedOn: daysAgo(30) },
      { id: 'cs-grni-ageing', category: 'exposure', title: 'Goods received not invoiced, ageing beyond 90 days', detail: 'Received goods without a matching invoice; the related liability is not in the recorded AP balance.', severity: 'High', valueAtRiskCr: 5.2, entityCode: 'JRP', detectedOn: daysAgo(25) },
    ])
  })

  it('five categories in spec order; exactly the two system rows carry no quantifiable value', () => {
    const signals = getControlSignals()
    expect(signals.map((s) => s.category)).toEqual(['payment', 'payment', 'authority', 'authority', 'system', 'system', 'cutoff', 'exposure'])
    expect(signals.filter((s) => s.valueAtRiskCr == null).map((s) => s.id)).toEqual(['cs-sod-conflict', 'cs-terms-change'])
  })

  it('JRP carries the unauthorised bank change that triggers its veto (§7.10)', () => {
    const sig = getControlSignals().find((s) => s.entityCode === 'JRP' && s.category === 'payment')!
    expect(sig.title).toBe('Vendor bank detail changed 3 days before payment run')
    expect(sig.severity).toBe('High')
    expect(sig.valueAtRiskCr).toBe(2.4)
  })
})

describe('AP control effectiveness (§7.8.1)', () => {
  it('override rates are computed from the pinned counts, never stored themselves', () => {
    const eff = apControlEffectiveness()
    expect(eff.duplicate).toEqual({ flaggedYtd: 41, overriddenYtd: 2, overrideRatePct: 4.9 }) // 2/41 → 4.878… → 4.9
    expect(eff.threeWayMatch).toEqual({ failedYtd: 67, overriddenYtd: 5, overrideRatePct: 7.5 }) // 5/67 → 7.462… → 7.5
    expect(eff.valuePreventedYtdCr).toBe(23.4)
  })
})

describe('narrative and display conventions (§7.12)', () => {
  it('recurrence is stored as an integer number of months', () => {
    for (const c of [...listCauses('p2p'), ...listCauses('o2c')]) {
      expect(Number.isInteger(c.recurrence)).toBe(true)
    }
  })

  it('missing-gr narrative reconciles with the §7.5 plant split', () => {
    const c = getCause('missing-gr')!
    expect(c.plants[0].pct + c.plants[1].pct).toBe(72)
    expect(c.narrative).toContain('72%')
    expect(c.narrative).not.toContain('62%')
  })

  it('po-price-mismatch narrative no longer claims four contracts at 71%', () => {
    const c = getCause('po-price-mismatch')!
    expect(c.narrative).not.toContain('71%')
    expect(c.narrative).toContain('₹4.1 cr')
  })

  it('approval-pending stores its approver split so the narrative derives from data', () => {
    const c = getCause('approval-pending')!
    expect(c.byGroup).toEqual([{ name: 'Approvers', count: 7, pct: 64 }])
    expect(c.narrative).toContain('seven approvers')
    expect(c.narrative).toContain('64%')
    expect(c.narrative).toContain(`₹${c.valueAtRisk} cr`)
  })

  it('formatRecurrence renders the ordinal form', () => {
    expect(formatRecurrence(1)).toBe('1st consecutive month')
    expect(formatRecurrence(2)).toBe('2nd consecutive month')
    expect(formatRecurrence(3)).toBe('3rd consecutive month')
    expect(formatRecurrence(5)).toBe('5th consecutive month')
  })

  it('entity tile sub-labels are composed from dataset counts', () => {
    const jgl = getEntity('JGL')!
    expect(entityTileSubs(jgl)).toEqual({
      cashUnapplied: '19 receipts · oldest 22 d',
      apBlocked: '327 invoices · oldest 118 d',
      arOver90: '41 customers · oldest 148 d',
      close: '7 blockers',
      recon: '18 aged breaks · oldest 61 d',
      controls: '12 high-risk JEs',
    })
  })
})

describe('narrative backing data (§7.13)', () => {
  it('pricing-disputes stores the customer cut separately from the segment cut', () => {
    const c = getCause('pricing-disputes')!
    expect(c.concentrationCount).toBe(9)
    expect(c.concentrationPctOfValue).toBe(64)
    expect(c.plants[0]).toEqual({ name: 'Distribution', pct: 41 })
    // Two cuts, not one — the conflated wording is gone.
    expect(c.narrative).toContain('Nine customers account for 64% of disputed value, 41% of it in Distribution')
    expect(c.narrative).not.toContain('distribution customers')
  })

  it('the five remaining claims each resolve to a stored field', () => {
    const vm = getCause('vendor-master')!
    expect(vm.recordsCreatedQuarter).toBe(23)
    expect(vm.narrative).toContain('23 vendor records')

    const ds = getCause('duplicate-suspicion')!
    expect(ds.concentrationCount).toBe(9)
    expect(ds.concentration).toBe('9 invoice pairs')
    expect(ds.narrative).toContain('Nine invoice pairs')

    const ded = getCause('deductions')!
    expect(ded.acceptanceRatePct).toBe(71)
    expect(ded.narrative).toContain('71% of deductions are eventually accepted')

    const tm = getCause('tax-mismatch')!
    expect(tm.byGroup).toHaveLength(2)
    expect(tm.byGroup!.reduce((sum, g) => sum + g.pct, 0)).toBe(100) // sums to the ₹1.3 cr value
    expect(tm.narrative).toContain('two states')

    const ca = getCause('cash-application')!
    expect(getEntity('JGL')!.metrics.cashUnappliedOldestDays).toBe(22)
    expect(ca.narrative).toContain('the oldest for 22 days')
  })

  it('oldest-item ageing is transcribed from the §7.13 table', () => {
    // §7.13 — pool oldest per entity; every arOver90OldestDays exceeds 90 (the >90-day bucket is real).
    const expected: Record<string, [number, number, number, number]> = {
      JGL: [118, 148, 22, 61],
      JBL: [142, 172, 31, 79],
      JPS: [76, 112, 14, 38],
      JCP: [34, 98, 8, 16],
      JHS: [51, 104, 11, 22],
      JRP: [168, 210, 44, 94],
    }
    for (const e of listEntities()) {
      const m = e.metrics
      expect([m.apBlockedOldestDays, m.arOver90OldestDays, m.cashUnappliedOldestDays, m.reconOldestDays]).toEqual(expected[e.code])
    }
  })

  it('oldest-item ageing orders with entity health — JCP lowest and JRP highest on all four', () => {
    const keys = ['apBlockedOldestDays', 'arOver90OldestDays', 'cashUnappliedOldestDays', 'reconOldestDays'] as const
    for (const k of keys) {
      expect(getEntity('JCP')!.metrics[k]).toBe(Math.min(...listEntities().map((e) => e.metrics[k])))
      expect(getEntity('JRP')!.metrics[k]).toBe(Math.max(...listEntities().map((e) => e.metrics[k])))
    }
  })
})

describe('§2 entities and groupings', () => {
  it('JCP is classified under Generics per §2', () => {
    expect(getEntity('JCP')?.segment).toBe('Generics')
  })

  it('entity rows pass the six legal entities through unchanged', () => {
    const rows = groupRows('entity')
    expect(rows.map((r) => r.key)).toEqual(['JGL', 'JBL', 'JPS', 'JCP', 'JHS', 'JRP'])
    expect(rows[0]).toMatchObject({
      key: 'JGL',
      label: 'Jubilant Generics Ltd',
      entityCodes: ['JGL'],
      score: 74,
      dimensions: { operational: 74, service: 78, risk: 62, workingCapital: 58, dataQuality: 90, compliance: 96 },
      apBlockedCr: { current: 18.6 },
      closePercent: { current: 78 },
      controlBreaches: 4,
    })
  })

  it('segment rows aggregate the five §2 segments (mean scores and dims, summed money)', () => {
    const rows = groupRows('segment')
    expect(rows.map((r) => r.key)).toEqual(['Generics', 'CRDMO', 'Holding', 'CDMO Sterile Injectables', 'Radiopharma'])

    const generics = rows[0]
    expect(generics.entityCodes).toEqual(['JGL', 'JCP'])
    expect(generics.score).toBe(83) // mean of displayed 74 and 91, rounded
    expect(generics.dimensions).toEqual({ operational: 83, service: 86, risk: 75, workingCapital: 72, dataQuality: 92, compliance: 96 })
    expect(generics.apBlockedCr.current).toBeCloseTo(20.7)
    expect(generics.arOver90Cr.current).toBeCloseTo(14.3)
    expect(generics.cashUnappliedCr.current).toBeCloseTo(3.4)
    expect(generics.closePercent.current).toBe(87)
    expect(generics.controlBreaches).toBe(4)

    // Single-member groups pass the entity through unchanged.
    const crdmo = rows[1]
    expect(crdmo.entityCodes).toEqual(['JBL'])
    expect(crdmo.score).toBe(67)
    expect(crdmo.apBlockedCr.current).toBeCloseTo(11.3)
  })

  it('geography rows bucket United States and US / Canada into North America', () => {
    const rows = groupRows('geography')
    expect(rows.map((r) => r.key)).toEqual(['India', 'Singapore', 'North America'])

    const india = rows[0]
    expect(india.entityCodes).toEqual(['JGL', 'JBL'])
    expect(india.score).toBe(71) // mean of displayed 74 and 67, rounded
    expect(india.dimensions).toEqual({ operational: 70, service: 75, risk: 58, workingCapital: 56, dataQuality: 86, compliance: 92 })
    expect(india.apBlockedCr.current).toBeCloseTo(29.9)
    expect(india.arOver90Cr.current).toBeCloseTo(21.3)
    expect(india.cashUnappliedCr.current).toBeCloseTo(5.5)
    expect(india.closePercent.current).toBe(70)
    expect(india.controlBreaches).toBe(10)

    const na = rows[2]
    expect(na.entityCodes).toEqual(['JCP', 'JHS', 'JRP'])
    expect(na.score).toBe(78) // mean of displayed 91, 88 and 55
    expect(na.dimensions).toEqual({ operational: 81, service: 83, risk: 73, workingCapital: 73, dataQuality: 87, compliance: 83 })
    expect(na.apBlockedCr.current).toBeCloseTo(21.0)
    expect(na.arOver90Cr.current).toBeCloseTo(16.3)
    expect(na.cashUnappliedCr.current).toBeCloseTo(4.9)
    expect(na.closePercent.current).toBe(81)
    expect(na.controlBreaches).toBe(7)
  })
})

describe('trend series (§7.14)', () => {
  const TREND_KEYS = ['apBlocked', 'arOver90', 'cashUnapplied', 'closePercent', 'reconValue', 'dso', 'dpo', 'touchlessRate', 'slaBreaches'] as const

  it('every §7.14 prior period is transcribed (current ← previous)', () => {
    const expected: Record<string, Partial<Record<(typeof TREND_KEYS)[number], [number, number]>>> = {
      JGL: { apBlocked: [18.6, 22.1], arOver90: [12.4, 11.2], cashUnapplied: [3.1, 2.6], closePercent: [78, 74], reconValue: [14.3, 15.8], dso: [62, 59], dpo: [48, 45], touchlessRate: [54, 49], slaBreaches: [32, 38] },
      JBL: { apBlocked: [11.3, 10.4], arOver90: [8.9, 9.6], cashUnapplied: [2.4, 2.9], closePercent: [61, 66], reconValue: [9.8, 8.9], dso: [68, 71], dpo: [52, 50], touchlessRate: [46, 44], slaBreaches: [41, 39] },
      JPS: { apBlocked: [6.8, 7.9], arOver90: [5.1, 4.8], cashUnapplied: [1.2, 1.5], closePercent: [88, 85], reconValue: [4.1, 4.6], dso: [54, 52], dpo: [41, 42], touchlessRate: [62, 58], slaBreaches: [12, 14] },
      JCP: { apBlocked: [2.1, 2.4], arOver90: [1.9, 2.1], cashUnapplied: [0.3, 0.4], closePercent: [96, 95], reconValue: [1.4, 1.6], dso: [47, 49], dpo: [38, 39], touchlessRate: [78, 74], slaBreaches: [3, 4] },
      JHS: { apBlocked: [4.2, 4.0], arOver90: [3.8, 4.1], cashUnapplied: [0.6, 0.5], closePercent: [94, 91], reconValue: [2.7, 2.5], dso: [51, 50], dpo: [40, 40], touchlessRate: [71, 68], slaBreaches: [6, 5] },
      JRP: { apBlocked: [14.7, 13.2], arOver90: [10.6, 9.8], cashUnapplied: [4.0, 3.4], closePercent: [52, 58], reconValue: [12.6, 11.2], dso: [74, 69], dpo: [56, 52], touchlessRate: [41, 39], slaBreaches: [48, 48] },
    }
    for (const e of listEntities()) {
      const table = expected[e.code]!
      for (const key of TREND_KEYS) {
        expect([e.metrics[key].current, e.metrics[key].previous]).toEqual(table[key])
      }
    }
  })

  it('every point stays within max(25% of current, the metric floor) (§7.14)', () => {
    const FLOORS: Record<(typeof TREND_KEYS)[number], number> = {
      apBlocked: 0.5, arOver90: 0.5, cashUnapplied: 0.5, reconValue: 0.5,
      closePercent: 5, dso: 5, dpo: 5, touchlessRate: 5, slaBreaches: 5,
    }
    for (const e of listEntities()) {
      for (const key of TREND_KEYS) {
        const t = e.metrics[key]
        expect(t.series).toHaveLength(6)
        expect(t.series[5]).toBe(t.current)
        expect(t.series[4]).toBe(t.previous)
        // §7.14 — the floor keeps a small movement on a small denominator from reading as a large swing,
        // so pinned points 4/5 are held to the same bound as generated ones (JCP cashUnapplied's +33%
        // sits inside its ₹0.5 cr floor).
        const bound = Math.max(0.25 * t.current, FLOORS[key])
        for (const point of t.series) {
          expect(point).toBeGreaterThanOrEqual(Math.max(0, t.current - bound) - 1e-6)
          expect(point).toBeLessThanOrEqual(t.current + bound + 1e-6)
        }
      }
    }
  })

  // §7.14 — "the series must not contradict a stated recurrence", in checkable form: for a down-is-good
  // metric the last N points (N = the mapped cause's recurrence) must not be monotonically decreasing.
  const CAUSE_METRIC: Record<string, 'apBlocked' | 'arOver90' | 'cashUnapplied'> = {
    'missing-gr': 'apBlocked',
    'po-price-mismatch': 'apBlocked',
    'approval-pending': 'apBlocked',
    'vendor-master': 'apBlocked',
    'duplicate-suspicion': 'apBlocked',
    'tax-mismatch': 'apBlocked',
    'pricing-disputes': 'arOver90',
    deductions: 'arOver90',
    'billing-errors': 'arOver90',
    'credit-block': 'arOver90',
    'customer-master': 'arOver90',
    'cash-application': 'cashUnapplied',
  }

  it('no mapped cause recurrence window shows steady decline (§7.14)', () => {
    for (const e of listEntities()) {
      for (const [causeKey, metric] of Object.entries(CAUSE_METRIC)) {
        const n = getCause(causeKey)!.recurrence
        if (n < 3) continue // one step of movement is not a trend; §7.2 pins one-month dips on the N=2 metrics
        const window = e.metrics[metric].series.slice(6 - n)
        // 1e-9 tolerance: grid spacing is 0.1/1, so this only absorbs double-representation noise
        // (a generated point can sit 5e-16 above the literal for the same nominal value).
        const strictlyDecreasing = window.every((v, i) => i === 0 || window[i - 1] > v + 1e-9) // flat or rising pair breaks the run
        expect(strictlyDecreasing).toBe(false)
      }
    }
  })

  it('DSO and DPO both rank with the working-capital dimension — JCP best, JRP worst', () => {
    const order = ['JCP', 'JHS', 'JPS', 'JGL', 'JBL', 'JRP']
    expect([...listEntities()].sort((a, b) => a.metrics.dso.current - b.metrics.dso.current).map((e) => e.code)).toEqual(order)
    expect([...listEntities()].sort((a, b) => a.metrics.dpo.current - b.metrics.dpo.current).map((e) => e.code)).toEqual(order)
    expect([...listEntities()].sort((a, b) => b.dimensions.workingCapital - a.dimensions.workingCapital).map((e) => e.code)).toEqual(order)
  })

  it('adjusted DPO transcribed from §8.6', () => {
    const expected: Record<string, number> = { JGL: 41, JBL: 46, JPS: 38, JCP: 37, JHS: 38, JRP: 50 }
    for (const e of listEntities()) expect(e.metrics.dpoAdjusted).toBe(expected[e.code])
  })

  it('touchless rate orders with the operational dimension — JCP highest, JRP lowest (§7.14)', () => {
    const order = ['JCP', 'JHS', 'JPS', 'JGL', 'JBL', 'JRP']
    expect([...listEntities()].sort((a, b) => b.metrics.touchlessRate.current - a.metrics.touchlessRate.current).map((e) => e.code)).toEqual(order)
    expect([...listEntities()].sort((a, b) => b.dimensions.operational - a.dimensions.operational).map((e) => e.code)).toEqual(order)
  })

  it('group SLA breaches move 148 → 142 (§7.14)', () => {
    const total = (pick: 'current' | 'previous') => listEntities().reduce((sum, e) => sum + e.metrics.slaBreaches[pick], 0)
    expect(total('previous')).toBe(148)
    expect(total('current')).toBe(142)
  })

  it('group value-at-risk trend aggregates entity trends per period (§7.14)', () => {
    const summary = getGroupSummary()
    const ents = listEntities()
    for (let i = 0; i < 6; i++) {
      const point = Math.round(ents.reduce((sum, e) => sum + e.metrics.apBlocked.series[i] + e.metrics.arOver90.series[i], 0) * 10) / 10
      expect(summary.valueAtRiskTrend.series[i]).toBeCloseTo(point)
    }
    expect(summary.valueAtRiskTrend.current).toBe(summary.valueAtRiskCr)
  })

  it('series are seeded and deterministic across fresh module evaluations', async () => {
    vi.resetModules()
    const first = await import('../src/api/mock/entities')
    vi.resetModules()
    const second = await import('../src/api/mock/entities')
    expect(first.entities).toHaveLength(second.entities.length)
    for (let i = 0; i < first.entities.length; i++) {
      for (const key of TREND_KEYS) {
        expect(second.entities[i].metrics[key].series).toEqual(first.entities[i].metrics[key].series)
      }
    }
  })
})

describe('dimension and count trends (§7.15, §7.16)', () => {
  it('every §7.15 prior dimension score is transcribed', () => {
    const expected: Record<string, Record<DimensionKey, number>> = {
      JGL: { operational: 71, service: 74, risk: 58, workingCapital: 60, dataQuality: 89, compliance: 96 },
      JBL: { operational: 69, service: 74, risk: 58, workingCapital: 55, dataQuality: 82, compliance: 88 },
      JPS: { operational: 80, service: 82, risk: 73, workingCapital: 74, dataQuality: 87, compliance: 90 },
      JCP: { operational: 91, service: 93, risk: 87, workingCapital: 85, dataQuality: 93, compliance: 96 },
      JHS: { operational: 88, service: 90, risk: 88, workingCapital: 86, dataQuality: 92, compliance: 94 },
      JRP: { operational: 66, service: 68, risk: 52, workingCapital: 51, dataQuality: 75, compliance: 60 },
    }
    for (const e of listEntities()) expect(e.dimensionsPrevious).toEqual(expected[e.code])
  })

  it('prior scores follow the same weighted formula over prior dimensions and prior-active vetoes (§7.15)', () => {
    const expectedDisplayed: Record<string, number> = { JGL: 72, JBL: 69, JPS: 80, JCP: 90, JHS: 89, JRP: 60 }
    for (const e of listEntities()) expect(priorScore(e).displayed).toBe(expectedDisplayed[e.code])
  })

  it('JRP fall is the veto rule visible as a trend — raw barely moved, the cap changed (§7.15)', () => {
    const jrp = getEntity('JRP')!
    const prior = priorScore(jrp)
    const current = computeScore(jrp)
    expect(prior.raw).toBe(60.5) // last period only gstOverdue (cap 60) was active
    expect(current.raw).toBe(57.9)
    expect(prior.cappedBy?.id).toBe('gstOverdue')
    expect(current.cappedBy?.id).toBe('bankChange')
    expect(prior.displayed).toBe(60)
    expect(current.displayed).toBe(55) // a five-point fall from a 2.6 raw movement
  })

  it('group score carries the trend: 77 → 76 (§7.15)', () => {
    expect(groupScorePrevious()).toBe(77)
    expect(groupScore()).toBe(76)
  })

  it('every §7.16 prior count is transcribed (current ← previous)', () => {
    const expected: Record<string, { apBlockedCount: [number, number]; o2cExceptionCount: [number, number]; reconAgedBreaks: [number, number] }> = {
      JGL: { apBlockedCount: [327, 389], o2cExceptionCount: [284, 301], reconAgedBreaks: [18, 21] },
      JBL: { apBlockedCount: [214, 197], o2cExceptionCount: [196, 188], reconAgedBreaks: [21, 19] },
      JPS: { apBlockedCount: [96, 112], o2cExceptionCount: [84, 92], reconAgedBreaks: [7, 8] },
      JCP: { apBlockedCount: [41, 47], o2cExceptionCount: [31, 34], reconAgedBreaks: [2, 2] },
      JHS: { apBlockedCount: [68, 65], o2cExceptionCount: [52, 49], reconAgedBreaks: [4, 4] },
      JRP: { apBlockedCount: [268, 241], o2cExceptionCount: [241, 220], reconAgedBreaks: [26, 23] },
    }
    for (const e of listEntities()) {
      const t = expected[e.code]!
      expect([e.metrics.apBlockedCount, e.metrics.apBlockedCountPrevious]).toEqual(t.apBlockedCount)
      expect([e.metrics.o2cExceptionCount, e.metrics.o2cExceptionCountPrevious]).toEqual(t.o2cExceptionCount)
      expect([e.metrics.reconAgedBreaks, e.metrics.reconAgedBreaksPrevious]).toEqual(t.reconAgedBreaks)
    }
  })

  it('open exceptions carry the trend: 2,012 → 1,980 (§7.16)', () => {
    expect(openExceptionsPrevious()).toBe(2012)
    expect(openExceptions()).toBe(1980)
  })

  it('count directions match their value counterparts', () => {
    for (const e of listEntities()) {
      // apBlockedCount moves with the ₹ figure: same sign on both deltas.
      const moneyDelta = Math.sign(e.metrics.apBlocked.current - e.metrics.apBlocked.previous)
      const countDelta = Math.sign(e.metrics.apBlockedCount - e.metrics.apBlockedCountPrevious)
      expect(moneyDelta * countDelta).toBeGreaterThanOrEqual(0)
      // reconAgedBreaks moves with the reconciliation value; a flat count is tolerated.
      const valueDelta = Math.sign(e.metrics.reconValue.current - e.metrics.reconValue.previous)
      const breaksDelta = Math.sign(e.metrics.reconAgedBreaks - e.metrics.reconAgedBreaksPrevious)
      expect(valueDelta * breaksDelta).toBeGreaterThanOrEqual(0)
    }
  })

  it('dimension trends are directionally consistent with the metrics beneath them (§7.15)', () => {
    const jgl = getEntity('JGL')!
    // operational rising together with touchless and close: all three deltas positive.
    expect(jgl.dimensions.operational - jgl.dimensionsPrevious.operational).toBeGreaterThan(0)
    expect(jgl.metrics.touchlessRate.current - jgl.metrics.touchlessRate.previous).toBeGreaterThan(0)
    expect(jgl.metrics.closePercent.current - jgl.metrics.closePercent.previous).toBeGreaterThan(0)

    const jbl = getEntity('JBL')!
    // working capital falling while AP blocked rises.
    expect(jbl.dimensions.workingCapital - jbl.dimensionsPrevious.workingCapital).toBeLessThan(0)
    expect(jbl.metrics.apBlocked.current - jbl.metrics.apBlocked.previous).toBeGreaterThan(0)
  })
})

describe('financial consequence strip (§8.2)', () => {
  it('pins all four figures for all six entities', () => {
    const pinned: Record<string, [number, number, number, number]> = {
      JGL: [6.4, 8.7, 92, 3.6],
      JBL: [4.1, 6.4, 88, 2.4],
      JPS: [2.1, 3.3, 94, 5.8],
      JCP: [0.6, 1.1, 98, 1.9],
      JHS: [1.3, 2.3, 97, 2.2],
      JRP: [5.7, 8.3, 84, 4.7],
    }
    for (const e of listEntities()) {
      const [accrual, revenue, provision, fx] = pinned[e.code]!
      expect(e.metrics.accrualExposure).toBe(accrual)
      expect(e.metrics.revenueAtRisk).toBe(revenue)
      expect(e.metrics.provisionAdequacyPct).toBe(provision)
      expect(e.metrics.fxIntercompanyExposure).toBe(fx)
    }
  })

  it('orders provision adequacy with the risk dimension — JCP highest, JRP lowest', () => {
    const byProvision = [...listEntities()].sort((a, b) => (b.metrics.provisionAdequacyPct ?? 0) - (a.metrics.provisionAdequacyPct ?? 0)).map((e) => e.code)
    const byRisk = [...listEntities()].sort((a, b) => b.dimensions.risk - a.dimensions.risk).map((e) => e.code)
    expect(byProvision[0]).toBe('JCP')
    expect(byProvision[byProvision.length - 1]).toBe('JRP')
    expect(byRisk).toEqual(byProvision) // full ranking: JCP, JHS, JPS, JGL, JBL, JRP
  })

  it('ties JGL accrual exposure to the §7.5 missing-GR cause value — one number, one meaning', () => {
    const jgl = getEntity('JGL')!
    const missingGr = listCauses('p2p').find((c) => c.key === 'missing-gr')!
    expect(jgl.metrics.accrualExposure).toBe(missingGr.valueAtRisk) // §8.2 — equality against the cause table, not a rounded share
    expect(jgl.metrics.accrualExposureNote).toBe('34% of blocked AP — no goods receipt means no accrual')
    for (const e of listEntities().filter((x) => x.code !== 'JGL')) {
      expect(e.metrics.accrualExposureNote).toBeUndefined() // the tie is assertable only where §7.5 pins a missing-GR share
    }
  })
})

describe('DSO forecast (§7.3/§7.23)', () => {
  // §7.23 table — deterioration in severity order; JRP worst, JCP best.
  const TABLE: Array<[string, number, number]> = [
    ['JRP', 74, 86],
    ['JBL', 68, 79],
    ['JGL', 62, 72],
    ['JPS', 54, 59],
    ['JHS', 51, 55],
    ['JCP', 47, 50],
  ]

  it('pins the JGL headline, four drivers and four ranked actions verbatim (§7.3)', () => {
    const fc = getForecast('JGL')!
    expect(fc.metric).toBe('dso')
    expect(fc.current).toBe(62)
    expect(fc.projected).toBe(72)
    expect(fc.unit).toBe('days')

    // §7.23 — the drivers carry real customers from the India pool, not placeholders.
    expect(fc.drivers.map((d) => [d.id, d.label, d.valueCr, d.impact])).toEqual([
      ['jgl-amrit', 'Amrit Distributors — pricing dispute', 9.4, 4.1],
      ['jgl-sanjeevani', 'Sanjeevani Healthcare — deduction unresolved', 6.2, 2.7],
      ['jgl-deccan', 'Deccan Pharma Retail — credit block', 4.8, 2.1],
      ['jgl-cash', 'Cash awaiting application', 3.1, 1.1],
    ])
    for (const d of fc.drivers) {
      expect(d.assumptionEditable).toBe(true)
      expect(d.baseSettleOn).toBeTruthy()
      expect(d.baseSettleIso).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }

    // Spec order is by movement per unit of effort — not by size of improvement.
    expect(fc.actions.map((a) => [a.rank, a.action, a.owner, a.effort, a.improvement])).toEqual([
      [1, 'Settle two disputes under ₹10 lakh', 'Collections', 'Low', 6.0],
      [2, 'Apply matched receipts to open AR', 'Cash application', 'Low', 1.1],
      [3, 'Release credit block on Deccan Pharma Retail', 'Entity controller', 'Medium', 2.1],
      [4, 'Escalate Amrit Distributors to commercial', 'Business partner', 'High', 4.1],
    ])
    for (const a of fc.actions) expect(a.unit).toBe('days')
  })

  it("carries the §7.23 table: every entity's current DSO ties to its metrics and impacts sum exactly to the deterioration", () => {
    for (const [code, current, projected] of TABLE) {
      const fc = getForecast(code)!
      expect(fc.current).toBe(current)
      expect(fc.projected).toBe(projected)
      expect(fc.current).toBe(getEntity(code)!.metrics.dso.current) // one number, one meaning
      const impactSum = Math.round(fc.drivers.reduce((s, d) => s + d.impact, 0) * 10) / 10
      expect(impactSum).toBe(projected - current) // day impacts sum exactly to the deterioration
    }
  })

  it('orders deterioration inversely with the working capital dimension — JRP worst at +12, JCP best at +3', () => {
    const rows = TABLE.map(([code]) => ({ code, deteriorate: getForecast(code)!.projected - getForecast(code)!.current, wc: getEntity(code)!.dimensions.workingCapital }))
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.deteriorate).toBeLessThan(rows[i - 1]!.deteriorate) // strictly decreasing deterioration...
      expect(rows[i]!.wc).toBeGreaterThan(rows[i - 1]!.wc) // ...and strictly increasing working-capital score
    }
    expect(rows[0]!.code).toBe('JRP')
    expect(rows[0]!.deteriorate).toBe(12)
    expect(rows[rows.length - 1]!.deteriorate).toBe(3)
  })

  it('sizes driver values around 1.5× (AR over 90 + cash unapplied) for every entity', () => {
    for (const [code] of TABLE) {
      const e = getEntity(code)!
      const fc = getForecast(code)!
      const valueSum = Math.round(fc.drivers.reduce((s, d) => s + d.valueCr, 0) * 10) / 10
      const base = e.metrics.arOver90.current + e.metrics.cashUnapplied.current
      const ratio = valueSum / base
      expect(ratio).toBeGreaterThanOrEqual(1.45)
      expect(ratio).toBeLessThanOrEqual(1.6)
    }
  })

  it('ranks actions by days recovered per unit of effort, not by size — strictly descending for every entity', () => {
    const units: Record<Effort, number> = { Low: 1, Medium: 2, High: 4 }
    for (const [code] of TABLE) {
      const actions = getForecast(code)!.actions
      expect(actions.map((a) => a.rank)).toEqual(actions.map((_, i) => i + 1)) // sequential ranks
      for (let i = 1; i < actions.length; i++) {
        const prev = actions[i - 1]!
        const cur = actions[i]!
        expect(prev.improvement / units[prev.effort]).toBeGreaterThan(cur.improvement / units[cur.effort])
      }
    }
  })

  it('keeps every base settlement after month-end so each pinned headline holds whenever opened (§7.21)', () => {
    for (const [code] of TABLE) {
      for (const d of getForecast(code)!.drivers) expect(d.baseSettleIso! > monthEndIso()).toBe(true) // ISO strings compare chronologically
    }
  })

  it('names drivers with real customers from the §7.23 pools — no placeholders, stable ids', () => {
    for (const [code] of TABLE) {
      const fc = getForecast(code)!
      for (const d of fc.drivers) {
        expect(d.id).toBeTruthy()
        expect(/Customer [A-Z]/.test(d.label)).toBe(false)
      }
      // ids are unique within the forecast and entity-prefixed, so state cannot leak across entities
      const ids = fc.drivers.map((d) => d.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('projects current plus the impact of every driver still open at month-end (assumptions keyed by id)', () => {
    const fc = getForecast('JGL')!
    expect(projectDsoDays(fc, {})).toBe(72) // base case: all four open

    // Resolving Amrit drops its 4.1 days out entirely.
    expect(projectDsoDays(fc, { 'jgl-amrit': { resolved: true } })).toBe(67.9)

    // Pulling only Deccan's settlement to the first of the month settles it by month-end (2.1 drops).
    const firstOfMonth = monthEndIso().slice(0, 7) + '-01'
    expect(projectDsoDays(fc, { 'jgl-deccan': { settleIso: firstOfMonth } })).toBe(69.9)

    // Resolving everything returns to today's DSO.
    const allResolved: Record<string, DriverAssumption> = {}
    for (const d of fc.drivers) allResolved[d.id] = { resolved: true }
    expect(projectDsoDays(fc, allResolved)).toBe(62)
  })

  it('decides open-at-month-end once: resolved drivers are closed; settlements on or before month-end are', () => {
    const fc = getForecast('JGL')!
    const a = fc.drivers[0]! // Amrit — base settlement sits after month-end
    expect(driverOpenAtMonthEnd(a, {})).toBe(true)
    expect(driverOpenAtMonthEnd(a, { resolved: true })).toBe(false)
    expect(driverOpenAtMonthEnd(a, { settleIso: monthEndIso() })).toBe(false) // on the boundary counts as settled
    expect(driverOpenAtMonthEnd(a, { settleIso: '' })).toBe(true) // cleared override falls back to base
  })
})
