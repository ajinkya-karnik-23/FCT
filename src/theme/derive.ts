import { colors } from './tokens'

export type StatusWord = 'GREEN' | 'AMBER' | 'RED'

export function scoreColor(n: number): string {
  if (n >= 85) return colors.statusGreen
  if (n >= 70) return colors.statusAmber
  return colors.statusRed
}

export function statusWord(n: number): StatusWord {
  if (n >= 85) return 'GREEN'
  if (n >= 70) return 'AMBER'
  return 'RED'
}

export function statusColor(status: StatusWord): string {
  switch (status) {
    case 'GREEN':
      return colors.statusGreen
    case 'AMBER':
      return colors.statusAmber
    case 'RED':
      return colors.statusRed
  }
}

export function ageColor(days: number): string {
  if (days > 30) return colors.statusRed
  if (days > 15) return colors.statusAmber
  return colors.textSecondary
}

export type ControlImpact = 'High' | 'Medium' | 'Low'

export function controlColor(impact: ControlImpact): string {
  switch (impact) {
    case 'High':
      return colors.statusRed
    case 'Medium':
      return colors.statusAmber
    case 'Low':
      return colors.textMuted
  }
}

export function breachColor(n: number): string {
  if (n > 3) return colors.statusRed
  if (n > 0) return colors.statusAmber
  return colors.statusGreen
}
