import { describe, expect, it } from 'vitest'
import { formatCr } from './format'

describe('formatCr', () => {
  it('formats aggregates with one decimal by default', () => {
    expect(formatCr(18.6)).toBe('₹18.6 cr')
    expect(formatCr(92.4)).toBe('₹92.4 cr')
    expect(formatCr(7)).toBe('₹7.0 cr')
  })

  it('formats transaction amounts with two decimals when requested', () => {
    expect(formatCr(2.84, 2)).toBe('₹2.84 cr')
    expect(formatCr(0.5, 2)).toBe('₹0.50 cr')
  })

  it('rounds to the requested precision', () => {
    expect(formatCr(1.999)).toBe('₹2.0 cr')
    expect(formatCr(1.004, 2)).toBe('₹1.00 cr')
  })

  it('handles zero and negative values', () => {
    expect(formatCr(0)).toBe('₹0.0 cr')
    expect(formatCr(-3.25, 2)).toBe('-₹3.25 cr')
  })
})
