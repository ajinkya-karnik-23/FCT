// Answer source for the cockpit-intelligence drawer (spec/07).
// The UI only depends on this interface — a real endpoint can replace the mock
// without touching AssistantDrawer.

export interface AssistantProvider {
  ask(question: string, context: { entityCode: string }): AsyncIterable<string>
}

const CANNED_ANSWERS: [question: string, answer: string][] = [
  [
    'Why is this entity showing amber?',
    'Jubilant Generics is amber on two of five dimensions. Control health is 46 — four control breaches and 12 high-risk manual journals sit open. Working capital health is 58, driven by ₹18.6 cr of blocked payables and ₹3.1 cr of unapplied cash. Close and process health are both green, so this is a controllership issue rather than a throughput issue.',
  ],
  [
    'Why is AP exposure building?',
    '₹18.6 cr is blocked across 327 invoices. 68% of the exposure sits in items older than 30 days, and 54% of those trace to missing goods receipts — concentrated in Nanjangud (43%) and Roorkee (29%). The same 11 vendors have appeared in this pattern for five consecutive months.',
  ],
  [
    'Which plants and vendors drive it?',
    'Nanjangud accounts for 43% of the missing-GR value, Roorkee 29%. Within that, consignment chemical vendors are 38% and packaging 27%. Suraksha Chemicals alone holds ₹2.84 cr across four invoices with an average age of 41 days.',
  ],
  [
    'What should I do first?',
    'Three actions, in order. One: release the 38 invoices where GR was posted this week — ₹4.2 cr of payment capacity, no approvals needed. Two: set a 48-hour GR escalation for the top 11 vendor/plant pairs, which removes roughly 60% of recurrence. Three: take the two intercompany reconciliation breaks with Entity B to the close call today; they are blocking close sign-off.',
  ],
  [
    'Why did close health drop this week?',
    'Close health fell 6 points. Three balance-sheet reconciliations remain unresolved, two of them intercompany mismatches with Jubilant Ingrevia, and one late manual journal of ₹7.2 cr is awaiting controller approval. Nothing else in the close plan slipped.',
  ],
]

const FALLBACK_ANSWER =
  'Across the six entities, ₹92.4 cr is currently at risk with 1,486 open exceptions. The largest single driver is missing goods receipts in P2P at ₹6.3 cr, followed by pricing disputes in O2C at ₹5.4 cr. Both are concentrated in Jubilant Generics and Jubilant Life Sciences.'

function answerFor(question: string): string {
  const q = question.trim().toLowerCase()
  for (const [key, text] of CANNED_ANSWERS) {
    if (q === key.toLowerCase()) return text
  }
  return FALLBACK_ANSWER
}

// Streams a canned answer in ~4-character chunks every 18ms. Breaking out of the
// loop calls return(), which clears the pending tick, so an abandoned stream stops.
export class MockAssistantProvider implements AssistantProvider {
  ask(question: string, _context: { entityCode: string }): AsyncIterable<string> {
    const full = answerFor(question)
    let index = 0
    let pending: ReturnType<typeof setTimeout> | undefined
    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (index >= full.length) return { value: undefined, done: true }
            const chunk = full.slice(index, index + 4)
            index += 4
            await new Promise<void>((resolve) => {
              pending = setTimeout(resolve, 18)
            })
            return { value: chunk, done: false }
          },
          async return() {
            if (pending !== undefined) clearTimeout(pending)
            return { value: undefined, done: true }
          },
        }
      },
    }
  }
}

export const mockAssistant = new MockAssistantProvider()
