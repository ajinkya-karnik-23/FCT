import { createContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { defaultRootCauseTo } from '../../app/paths'
import { Eyebrow, StatusDot } from '../../components'
import { colors, fonts, layout, radius, shadows } from '../../theme/tokens'
import { mockAssistant, type AssistantProvider, type Citation, type FollowUpAction } from './provider'

// Lets any part of the app open the drawer and ask a question (spec/07) —
// used by the entity home's "Ask why this entity is amber" button. The optional
// second argument pins the conversation to an entity other than the page's own
// (the group view asks about a row's entity while the page itself has none).
export interface AssistantApi {
  ask(question?: string, contextEntityCode?: string): void
}

export const AssistantContext = createContext<AssistantApi | null>(null)

interface Message {
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[] // source chips the provider attached to this answer
  followUps?: FollowUpAction[] // provider-supplied follow-ups; absent → drawer defaults below
}

const PRESET_QUESTIONS = ['Why is this entity amber?', 'What lifts it fastest?', 'What is our exposure at close?'] as const

// Shown when a provider does not supply follow-ups for an answer.
function fallbackFollowUps(entityCode: string): FollowUpAction[] {
  return [
    { label: 'Open the worklist', to: `/entity/${entityCode}/p2p/invoices` },
    { label: 'Show root cause', to: defaultRootCauseTo(entityCode) },
  ]
}

// User bubbles are raised amber-tinted clay; assistant bubbles are raised neutral clay.
const userBubbleStyle: CSSProperties = {
  maxWidth: '88%',
  background: colors.bgAccentPanel,
  borderRadius: `${radius.md} ${radius.md} 4px ${radius.md}`,
  boxShadow: shadows.upSm,
  padding: '12px 15px',
  fontSize: 13,
  lineHeight: 1.5,
}

const assistantBubbleStyle: CSSProperties = {
  maxWidth: '92%',
  background: colors.bgPanel,
  borderRadius: `${radius.md} ${radius.md} ${radius.md} 4px`,
  boxShadow: shadows.upSm,
  padding: '14px 16px',
  fontSize: 13,
  lineHeight: 1.6,
}

interface HandedInQuestion {
  text: string
  entityCode?: string // pins the conversation to this entity instead of the page's own
}

interface AssistantDrawerProps {
  entityCode: string
  question: HandedInQuestion | null // handed in from outside (entity home, group view); asked once, then cleared via onQuestionConsumed
  onClose(): void
  onQuestionConsumed(): void
  provider?: AssistantProvider
}

export function AssistantDrawer({ entityCode, question, onClose, onQuestionConsumed, provider = mockAssistant }: AssistantDrawerProps) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState<string | null>(null)
  const [input, setInput] = useState('')
  // A question pinned to another entity (a group view row) keeps the whole conversation on that entity.
  const [pinnedEntity, setPinnedEntity] = useState<string | null>(null)
  const activeEntity = pinnedEntity ?? entityCode
  // A new question — or unmount — invalidates any in-flight stream.
  const streamId = useRef(0)

  useEffect(() => () => void (streamId.current += 1), [])

  async function submit(raw: string, contextEntityCode?: string) {
    const q = raw.trim()
    if (!q) return
    // The pin lands in state after this render, so resolve it locally for the first call.
    const ctx = contextEntityCode ?? activeEntity
    if (contextEntityCode !== undefined) setPinnedEntity(contextEntityCode)
    const id = ++streamId.current
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    let acc = ''
    const meta = provider.answerMeta?.(q, { entityCode: ctx })
    for await (const chunk of provider.ask(q, { entityCode: ctx })) {
      if (streamId.current !== id) return
      acc += chunk
      setStreaming(acc)
    }
    if (streamId.current === id) {
      setMessages((m) => [...m, { role: 'assistant', text: acc, citations: meta?.citations, followUps: meta?.followUps }])
      setStreaming(null)
    }
  }

  // A question handed in from outside is asked once on arrival.
  useEffect(() => {
    if (!question) return
    void submit(question.text, question.entityCode)
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
        boxShadow: shadows.in,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <StatusDot color={colors.accent} size={7} pulse />
        <Eyebrow style={{ color: colors.accentText }}>Cockpit intelligence</Eyebrow>
        <button type="button" className="fct-drawer-close" aria-label="Close assistant" onClick={onClose}>
          ×
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: colors.textMuted, margin: 0 }}>
          Grounded on the finance semantic model — every answer resolves to transactions, owners and SLA records.
        </p>

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle}>{msg.text}</div>
            {i === lastAssistantIndex && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {msg.citations !== undefined && msg.citations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Eyebrow>Sources</Eyebrow>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {msg.citations.map((c) => (
                        <button key={c.label} type="button" className="fct-followup-chip" onClick={() => navigate(c.to)}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(msg.followUps !== undefined && msg.followUps.length > 0 ? msg.followUps : fallbackFollowUps(activeEntity)).map((fu) => (
                    <button
                      key={fu.label}
                      type="button"
                      className="fct-followup-chip"
                      onClick={() => {
                        if (fu.ask !== undefined) void submit(fu.ask)
                        else if (fu.to !== undefined) navigate(fu.to)
                      }}
                    >
                      {fu.label}
                    </button>
                  ))}
                </div>
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

      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Eyebrow>Suggested</Eyebrow>
        {PRESET_QUESTIONS.map((q) => (
          <button key={q} type="button" className="fct-preset-btn" onClick={() => void submit(q)}>
            {q}
          </button>
        ))}
        <div className="fct-well" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="fct-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit(input)
            }}
            placeholder="Ask about any entity, process or exception"
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: colors.textPrimary }}
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
