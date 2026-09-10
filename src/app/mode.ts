import { createContext, useContext } from 'react'

// §8.5 — cockpit mode: which phase of the month the demo is simulating.
export type CockpitMode = 'close' | 'bau' | 'preclose'

export const COCKPIT_MODES: Array<{ id: CockpitMode; label: string }> = [
  { id: 'close', label: 'CLOSE' },
  { id: 'bau', label: 'BAU' },
  { id: 'preclose', label: 'PRE-CLOSE' },
]

// §8.5 — pre-close is the default: it is preventive, and the mode worth demonstrating.
export const DEFAULT_COCKPIT_MODE: CockpitMode = 'preclose'

// §8.5 — header period text per mode; the day numbers are demo-control constants (the original "DAY 4" was hardcoded too).
export const MODE_PERIOD: Record<CockpitMode, string> = {
  close: 'DAY 4 OF CLOSE',
  bau: 'BUSINESS AS USUAL · DAY 12',
  preclose: 'PRE-CLOSE READINESS · 3 DAYS TO CLOSE',
}

export interface AppModeState {
  mode: CockpitMode
  setMode: (mode: CockpitMode) => void
}

export const AppModeContext = createContext<AppModeState>({ mode: DEFAULT_COCKPIT_MODE, setMode: () => {} })

export function useAppMode() {
  return useContext(AppModeContext)
}
