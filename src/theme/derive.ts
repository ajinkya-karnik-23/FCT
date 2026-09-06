import { colors } from './tokens'

export type StatusWord = 'GREEN' | 'AMBER' | 'RED'

// The single place that decides a score band (spec §3.3).
export function scoreBand(n: number): StatusWord {
  if (n >= 85) return 'GREEN'
  if (n >= 65) return 'AMBER'
  return 'RED'
}

export function scoreColor(n: number): string {
  return statusColor(scoreBand(n))
}

export function statusWord(n: number): StatusWord {
  return scoreBand(n)
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

export type ControlSignificance = 'High' | 'Medium' | 'Low'

export function controlColor(significance: ControlSignificance): string {
  switch (significance) {
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

// §8.3/§8.5.1 — direction colour follows improvement, not arithmetic sign (the inverse flag lives in trendDelta).
export function trendColor(direction: 'improving' | 'worsening' | 'flat' | 'neutral'): string {
  if (direction === 'improving') return colors.statusGreen
  if (direction === 'worsening') return colors.statusRed
  return colors.textMuted // flat or neutral — no direction to colour
}

// §7.26 — compliance status colour; the single place that decides it.
export function complianceColor(status: 'filed' | 'due' | 'overdue'): string {
  if (status === 'filed') return colors.statusGreen
  if (status === 'due') return colors.statusAmber
  return colors.statusRed
}

// §7.27 — interface health colour; the single place that decides it.
export function interfaceColor(status: 'on schedule' | 'delayed' | 'stale'): string {
  if (status === 'on schedule') return colors.statusGreen
  if (status === 'delayed') return colors.statusAmber
  return colors.statusRed
}

// §7.29 — per-request SLA status against its type's committed TAT; the single place that decides this band. The
// effective age already has stop-clock hours subtracted (§5 attribution logic applied to requests).
export type RequestSlaWord = 'on track' | 'breached' | 'met'

export function requestSlaStatusWord(effectiveAgeDays: number, targetDays: number, closed: boolean): RequestSlaWord {
  if (closed) return effectiveAgeDays <= targetDays ? 'met' : 'breached'
  return effectiveAgeDays > targetDays ? 'breached' : 'on track'
}

export function requestSlaColor(word: RequestSlaWord): string {
  if (word === 'breached') return colors.statusRed
  if (word === 'met') return colors.statusGreen
  return colors.textSecondary // on track — nothing to flag yet; green is reserved for met
}

// §7.30 — cause elimination status; the single place that decides this band. Eliminated is done (green), in
// progress is work underway (amber); identified-but-not-started stays muted — a blank target date is the honest
// state, and there is nothing to flag.
export type CauseEliminationWord = 'identified' | 'in-progress' | 'eliminated'

export function causeEliminationColor(status: CauseEliminationWord): string {
  if (status === 'eliminated') return colors.statusGreen
  if (status === 'in-progress') return colors.statusAmber
  return colors.textMuted // identified — not started yet; no commitment to flag
}

// §15.2/§15.2.0 — preventive vs reactive on the roster and coverage strip; the single place that decides this pair.
// accentText (not accent) so chip text clears AA on white in the light theme.
export type AgentTypeWord = 'preventive' | 'reactive'

export function agentTypeColor(type: AgentTypeWord): string {
  return type === 'preventive' ? colors.accentText : colors.statusAmber
}
