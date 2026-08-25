import { describe, expect, it } from 'vitest'
import {
  getCashOpportunities,
  getBlockedInvoiceAgeing,
  getCause,
  getEntity,
  getException,
  getGroupSummary,
  getPayablesByReason,
  getReceivablesAgeing,
  getRecurringCauses,
  getServiceControl,
  listCauses,
  listEntities,
  listExceptions,
  listStages,
} from '../src/api'
import { statusWord } from '../src/theme/derive'

describe('row counts (spec/03)', () => {
  it('6 entities', () => expect(listEntities()).toHaveLength(6))
  it('7 P2P stages', () => expect(listStages('p2p')).toHaveLength(7))
  it('12 exceptions', () => expect(listExceptions()).toHaveLength(12))
  it('6 causes', () => expect(listCauses('p2p')).toHaveLength(6))
})

describe('spec values transcribed exactly', () => {
  it('JGL entity row', () => {
    expect(getEntity('JGL')).toMatchObject({
      code: 'JGL',
      name: 'Jubilant Generics Ltd',
      score: 74,
      status: 'AMBER',
      dims: [78, 46, 58, 82, 70],
      apBlocked: 18.6,
      arOver90: 12.4,
      cashUnapplied: 3.1,
      closePct: 78,
      controlBreaches: 4,
    })
  })

  it('JLS entity row (weakest in group)', () => {
    expect(getEntity('JLS')).toMatchObject({
      score: 58,
      status: 'RED',
      dims: [48, 44, 55, 68, 62],
      apBlocked: 14.7,
      arOver90: 10.6,
      cashUnapplied: 4.0,
      closePct: 52,
      controlBreaches: 7,
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
      controlImpact: 'High',
      po: 'PO-4471902',
      bookedOn: '14 Jul 2026',
    })
  })

  it('missing-gr cause with narrative, drivers and actions intact', () => {
    const c = getCause('missing-gr')
    expect(c).toMatchObject({
      processKey: 'p2p',
      key: 'missing-gr',
      name: 'Missing GR',
      sharePct: 34,
      valueAtRisk: 6.3,
      avgDelayDays: 8.4,
      recurrence: '5th month',
      concentration: '11 vendors',
    })
    expect(c?.narrative).toContain('consignment')
    expect(c?.plants[0]).toEqual({ name: 'Nanjangud', pct: 43 })
    expect(c?.vendors).toHaveLength(4)
    expect(c?.actions).toHaveLength(3)
  })

  it('group summary aggregates', () => {
    const g = getGroupSummary()
    expect(g.score).toBe(76.5)
    expect(g.valueAtRiskCr).toBe(92.4)
    expect(g.openExceptions).toBe(1486)
    expect(g.closeProgress).toEqual({ pct: 71, totalTasks: 214, overdue: 19, blockers: 6, entitiesAtRisk: 3 })
    expect(g.transformationHealth).toEqual({
      automationRatePct: 68,
      repeatExceptionsQoqPct: -14,
      causesEliminated: '11 of 34',
      touchlessInvoicesPct: 54,
    })
  })

  it('ageing datasets keep their bucket order and values', () => {
    const blocked = getBlockedInvoiceAgeing()
    expect(blocked).toHaveLength(5)
    expect(blocked[0]).toEqual({ label: '0-15 d', value: 5.9 })
    expect(blocked[blocked.length - 1]).toEqual({ label: '> 90 d', value: 1.8 })

    const ar = getReceivablesAgeing()
    expect(ar).toHaveLength(5)
    expect(ar[0]).toEqual({ label: '0-30 d', value: 24.1 })
    expect(ar[ar.length - 1]).toEqual({ label: '> 180 d', value: 5 })
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
    expect(reasons[0]).toEqual({ name: 'Missing GR', value: 6.3 })

    expect(getRecurringCauses()).toHaveLength(4)
    expect(getServiceControl()).toEqual({ slaInvoiceBookingPct: 93.1, queriesOverdue: 27, duplicatePaymentRiskCr: 0.9, manualPaymentRuns: 4 })
  })
})

describe('derived status never drifts from score', () => {
  it('statusWord(score) equals the stored status for every entity', () => {
    for (const e of listEntities()) {
      expect(statusWord(e.score)).toBe(e.status)
    }
  })
})

describe('filters', () => {
  it('no exceptions outside JGL in the mock set', () => expect(listExceptions('JBS')).toHaveLength(0))
  it('no stages outside p2p in the mock set', () => expect(listStages('o2c')).toHaveLength(0))
})
