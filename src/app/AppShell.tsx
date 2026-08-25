import { useCallback, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CommandPalette } from '../components/CommandPalette'
import { AssistantContext, AssistantDrawer } from '../features/assistant/AssistantDrawer'
import type { AssistantApi } from '../features/assistant/AssistantDrawer'
import { colors, fonts } from '../theme/tokens'
import { AppRoutes, DEFAULT_ENTITY, entityCodeFromPath } from './routes'
import { Rail } from './Rail'
import { TopBar } from './TopBar'

export function AppShell() {
  const { pathname } = useLocation()
  const code = entityCodeFromPath(pathname) ?? DEFAULT_ENTITY

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  // Open the drawer and optionally ask a question (entity home's "Ask why" button).
  const askAssistant = useCallback((question?: string) => {
    setAssistantOpen(true)
    if (question !== undefined) setPendingQuestion(question)
  }, [])
  const assistantApi = useMemo<AssistantApi>(() => ({ ask: askAssistant }), [askAssistant])

  return (
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
        <Rail onSearch={openPalette} />
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
  )
}
