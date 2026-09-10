import { describe, expect, it } from 'vitest'
import { ageColor, breachColor, controlColor, scoreColor, statusWord } from './derive'
import { colors } from './tokens'

describe('scoreColor', () => {
  it('is green at and above 85', () => {
    expect(scoreColor(100)).toBe(colors.statusGreen)
    expect(scoreColor(92.3)).toBe(colors.statusGreen)
    expect(scoreColor(85)).toBe(colors.statusGreen)
  })

  it('is amber from 65 up to just below 85', () => {
    expect(scoreColor(84.9)).toBe(colors.statusAmber)
    expect(scoreColor(76.5)).toBe(colors.statusAmber)
    expect(scoreColor(69.9)).toBe(colors.statusAmber)
    expect(scoreColor(65)).toBe(colors.statusAmber)
  })

  it('is red below 65', () => {
    expect(scoreColor(64.9)).toBe(colors.statusRed)
    expect(scoreColor(41)).toBe(colors.statusRed)
    expect(scoreColor(0)).toBe(colors.statusRed)
  })
})

describe('statusWord', () => {
  it('maps the same thresholds to words', () => {
    expect(statusWord(85)).toBe('GREEN')
    expect(statusWord(97)).toBe('GREEN')
    expect(statusWord(84.9)).toBe('AMBER')
    expect(statusWord(65)).toBe('AMBER')
    expect(statusWord(64.9)).toBe('RED')
  })

  it('agrees with scoreColor at every boundary', () => {
    for (const n of [0, 42, 64.9, 65, 76.5, 84.9, 85, 100]) {
      const word = statusWord(n)
      const color = scoreColor(n)
      if (word === 'GREEN') expect(color).toBe(colors.statusGreen)
      if (word === 'AMBER') expect(color).toBe(colors.statusAmber)
      if (word === 'RED') expect(color).toBe(colors.statusRed)
    }
  })
})

describe('ageColor', () => {
  it('is red above 30 days', () => {
    expect(ageColor(31)).toBe(colors.statusRed)
    expect(ageColor(94)).toBe(colors.statusRed)
  })

  it('is amber above 15 up to and including 30 days', () => {
    expect(ageColor(16)).toBe(colors.statusAmber)
    expect(ageColor(30)).toBe(colors.statusAmber)
  })

  it('is text-secondary at 15 days and below', () => {
    expect(ageColor(15)).toBe(colors.textSecondary)
    expect(ageColor(4)).toBe(colors.textSecondary)
    expect(ageColor(0)).toBe(colors.textSecondary)
  })
})

describe('controlColor', () => {
  it('maps impact levels to colors', () => {
    expect(controlColor('High')).toBe(colors.statusRed)
    expect(controlColor('Medium')).toBe(colors.statusAmber)
    expect(controlColor('Low')).toBe(colors.textMuted)
  })
})

describe('breachColor', () => {
  it('is red above 3 breaches', () => {
    expect(breachColor(4)).toBe(colors.statusRed)
    expect(breachColor(12)).toBe(colors.statusRed)
  })

  it('is amber for 1 to 3 breaches', () => {
    expect(breachColor(1)).toBe(colors.statusAmber)
    expect(breachColor(3)).toBe(colors.statusAmber)
  })

  it('is green at zero breaches', () => {
    expect(breachColor(0)).toBe(colors.statusGreen)
  })
})
