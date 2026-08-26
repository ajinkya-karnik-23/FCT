import { createContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { defaultRootCauseTo } from '../../app/paths'
import { Eyebrow, StatusDot } from '../../components'
import { colors, fonts, layout } from '../../theme/tokens'
import { mockAssistant, type AssistantProvider } from './provider'

// Lets any part of the app open the drawer and ask a question (spec/07) —
// used by the entity home's "Ask why this entity is amber" button.
export interface AssistantApi {
  ask(question?: string): void
}

export const AssistantContext = createContext<AssistantApi | null>(null)

interface Message {
  role: 'user' | 'assistant'
  text: string
}

const PRESET_QUESTIONS = ['Why is AP exposure building?', 'Which plants and vendors drive it?', 'What should I do first?'] as const

const userBubbleStyle: CSSProperties = {
  maxWidth: '88%',
  background: colors.bgAccentSoft,
  border: `1px solid ${colors.borderAccent}`,
  padding: '12px 15px',
  fontSize: 13,
  lineHeight: 1.5,
}

const assistantBubbleStyle: CSSProperties = {
  maxWidth: '92%',
  background: colors.bgRaised,
  border: `1px solid ${colors.assistantBorder}`,
  padding: '14px 16px',
  fontSize: 13,
  lineHeight: 1.6,
}

interface AssistantDrawerProps {
  entityCode: string
  question: string | null // handed in from outside (entity home); asked once, then cleared via onQuestionConsumed
  onClose(): void
  onQuestionConsumed(): void
  provider?: AssistantProvider
}

export function AssistantDrawer({ entityCode, question, onClose, onQuestionConsumed, provider = mockAssistant }: AssistantDrawerProps) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState<string | null>(null)
  const [input, setInput] = useState('')
  // A new question — or unmount — invalidates any in-flight stream.
  const streamId = useRef(0)

  useEffect(() => () => void (streamId.current += 1), [])

  async function submit(raw: string) {
    const q = raw.trim()
    if (!q) return
    const id = ++streamId.current
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    let acc = ''
    for await (const chunk of provider.ask(q, { entityCode })) {
      if (streamId.current !== id) return
      acc += chunk
      setStreaming(acc)
    }
    if (streamId.current === id) {
      setMessages((m) => [...m, { role: 'assistant', text: acc }])
      setStreaming(null)
    }
  }

  // A question handed in from outside is asked once on arrival.
  useEffect(() => {
    if (!question) return
    void submit(question)
    onQuestionConsumed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  let lastAssistantIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      lastAssistantIndex = i
      break
    }
  }

  return (
    <aside
      aria-label="Cockpit intelligence"
      style={{
        width: layout.aiDrawerWidth,
        flexShrink: 0,
        background: colors.bgPanelAlt,
        borderLeft: `1px solid ${colors.borderDefault}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.borderDefault}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <StatusDot color={colors.accent} size={7} pulse />
        <Eyebrow style={{ color: colors.accentText }}>Cockpit intelligence</Eyebrow>
        <button type="button" className="fct-drawer-close" aria-label="Close assistant" onClick={onClose}>
          ×
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: colors.textMuted, margin: 0 }}>
          Grounded on the finance semantic model — every answer resolves to transactions, owners and SLA records.
        </p>

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle}>{msg.text}</div>
            {i === lastAssistantIndex && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="fct-followup-chip" onClick={() => navigate(`/entity/${entityCode}/p2p/invoices`)}>
                  Open the worklist
                </button>
                <button type="button" className="fct-followup-chip" onClick={() => navigate(defaultRootCauseTo(entityCode))}>
                  Show root cause
                </button>
              </div>
            )}
          </div>
        ))}

        {streaming !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <div style={assistantBubbleStyle}>
              {streaming}
              <span aria-hidden style={{ color: colors.accent }}>▋</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderTop: `1px solid ${colors.borderDefault}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Eyebrow>Suggested</Eyebrow>
        {PRESET_QUESTIONS.map((q) => (
          <button key={q} type="button" className="fct-preset-btn" onClick={() => void submit(q)}>
            {q}
          </button>
        ))}
        <div style={{ border: `1px solid ${colors.borderStrong}`, padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="fct-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit(input)
            }}
            placeholder="Ask about any entity, process or exception"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', fontSize: 13, color: colors.textPrimary }}
          />
          <button
            type="button"
            onClick={() => void submit(input)}
            style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.accentText, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            SEND
          </button>
        </div>
      </div>
    </aside>
  )
}
