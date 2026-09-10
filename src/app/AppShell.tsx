import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CommandPalette } from '../components/CommandPalette'
import { AssistantContext, AssistantDrawer } from '../features/assistant/AssistantDrawer'
import type { AssistantApi } from '../features/assistant/AssistantDrawer'
import { colors, fonts } from '../theme/tokens'
import { AppModeContext, DEFAULT_COCKPIT_MODE, type AppModeState, type CockpitMode } from './mode'
import { AppRoutes, DEFAULT_ENTITY, entityCodeFromPath } from './routes'
import { Rail } from './Rail'
import { TopBar } from './TopBar'

export function AppShell() {
  const { pathname, search, hash } = useLocation()
  const code = entityCodeFromPath(pathname) ?? DEFAULT_ENTITY
  // The cash attribution spine is a fixed-size prototype (public/cash-attribution.html)
  // that needs all the room it can get, so the rail collapses off this route.
  const railCollapsed = pathname.startsWith('/cash-attribution')

  // §8.2 — cross-page drill anchors (e.g. #fct-stage-COL): pushState does not scroll to the fragment, so do it here post-commit.
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' })
  }, [pathname, search, hash])

  // §8.5 — cockpit mode is a demo simulation control; it deliberately does not persist (unlike the theme).
  const [mode, setMode] = useState<CockpitMode>(DEFAULT_COCKPIT_MODE)
  const appMode = useMemo<AppModeState>(() => ({ mode, setMode }), [mode])

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState<{ text: string; entityCode?: string } | null>(null)

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  // Open the drawer and optionally ask a question (entity home's "Ask why" button);
  // contextEntityCode pins the conversation to an entity other than the page's own.
  const askAssistant = useCallback((question?: string, contextEntityCode?: string) => {
    setAssistantOpen(true)
    if (question !== undefined) setPendingQuestion({ text: question, entityCode: contextEntityCode })
  }, [])
  const assistantApi = useMemo<AssistantApi>(() => ({ ask: askAssistant }), [askAssistant])

  return (
    <AppModeContext.Provider value={appMode}>
      <AssistantContext.Provider value={assistantApi}>
        <div
          style={{
            height: '100%',
            display: 'flex',
            background: colors.bgRoot,
            color: colors.textPrimary,
            fontFamily: fonts.sans,
            fontSize: 14,
            overflow: 'hidden',
          }}
        >
          <Rail onSearch={openPalette} collapsed={railCollapsed} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <TopBar
              drawerOpen={assistantOpen}
              onToggleDrawer={() => {
                if (assistantOpen) setAssistantOpen(false)
                else askAssistant()
              }}
            />
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
                <AppRoutes />
              </main>
              {assistantOpen && (
                <AssistantDrawer entityCode={code} question={pendingQuestion} onClose={() => setAssistantOpen(false)} onQuestionConsumed={() => setPendingQuestion(null)} />
              )}
            </div>
          </div>
          <CommandPalette open={paletteOpen} onOpen={openPalette} onClose={closePalette} />
        </div>
      </AssistantContext.Provider>
    </AppModeContext.Provider>
  )
}
