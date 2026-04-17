# Pradvion Node.js SDK

Track AI API costs per client, project, and feature.
Know exactly what to bill each client.

[![npm version](https://img.shields.io/npm/v/pradvion-node.svg)](https://www.npmjs.com/package/pradvion-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Installation

```bash
npm install pradvion-node
```

## Quick Start — monitor()

The fastest integration. One line wraps your AI client.

```typescript
import pradvion from 'pradvion-node'
import OpenAI from 'openai'

pradvion.init({ apiKey: 'nx_live_YOUR_KEY' })
const openai = pradvion.monitor(new OpenAI())

// All calls tracked automatically — no other changes needed
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
})
```

## Auto-Instrument (Zero Setup)

The fastest way to add Pradvion to existing code:

```bash
# Preview changes (no files modified)
npx pradvion-instrument --dry-run

# Apply instrumentation
npx pradvion-instrument

# Instrument specific file or directory
npx pradvion-instrument src/
npx pradvion-instrument app.ts

# Remove instrumentation
npx pradvion-instrument --undo
```

What it adds automatically:

```typescript
// Before
import OpenAI from 'openai'
const client = new OpenAI()

// After
import pradvion from 'pradvion-node'
pradvion.init({ apiKey: process.env.PRADVION_API_KEY ?? '' })
import OpenAI from 'openai'
const client = pradvion.monitor(new OpenAI())
```

## Context Propagation

Tag calls with customer, feature, and environment using `AsyncLocalStorage` —
automatically propagated through all nested async calls:

```typescript
// trace() — simplest form
await pradvion.trace('samsung-001', async () => {
  const response = await openai.chat.completions.create(...)
  // Automatically attributed to samsung-001
})

// context() — full options
await pradvion.context(
  { customerId: 'samsung-001', feature: 'resume-summarizer', environment: 'production' },
  async () => {
    const response = await openai.chat.completions.create(...)
  }
)

// Manual context (e.g. Express middleware)
pradvion.setContext({ customerId: req.user.companyId, environment: 'production' })
const response = await openai.chat.completions.create(...)
pradvion.clearContext()
```

## Real-Time Streaming Cost

See estimated cost as tokens arrive:

```typescript
let currentCost = 0

const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
  onToken: (cost: number) => {
    currentCost = cost
    process.stdout.write(`\r~$${cost.toFixed(6)}`)
  },
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}
// Usage captured automatically from final chunk
```

## Business Signals

Track what your AI creates, not just what it costs:

```typescript
// After an AI call creates value, record it
pradvion.signal({
  customerId: 'samsung-001',
  event: 'email_generated',
  quantity: 1,
  value: 0.05,
  metadata: { type: 'outbound_sales' },
})

pradvion.signal({ customerId: 'samsung-001', event: 'meeting_booked', value: 150.00 })
pradvion.signal({ customerId: 'samsung-001', event: 'report_generated', quantity: 1, value: 50.00 })
```

## Conversation Tracking

Group multi-turn AI calls into a single conversation session:

```typescript
const convId = pradvion.newConversation()  // "conv_a3f9b2c1d4e5"

await pradvion.context(
  { customerId: 'samsung-001', conversationId: convId },
  async () => {
    const turn1 = await openai.chat.completions.create(...)  // both calls
    const turn2 = await openai.chat.completions.create(...)  // same convId
  }
)
```

## Budget Management

```typescript
import { getBudgetTracker } from 'pradvion-node'

const tracker = getBudgetTracker()
tracker.setBudget('samsung-001', 500.00, 'warn')  // 'warn' | 'raise' | 'ignore'
tracker.record('samsung-001', 0.05)
console.log(`Remaining: $${tracker.remaining('samsung-001')?.toFixed(2)}`)

// Check before a call (throws BudgetExceededError if action='raise')
tracker.check('samsung-001', estimatedCost)
```

## Cost Forecasting

```typescript
import { forecastMonthly } from 'pradvion-node'

const result = forecastMonthly({
  currentSpend: 150.00,
  daysElapsed: 15,
  monthlyBudget: 500.00,
})

console.log(`Projected: $${result.projectedMonthly.toFixed(2)}/mo`)
console.log(`Will exceed: ${result.willExceedBudget}`)
console.log(`Days until limit: ${result.daysUntilBudget}`)
```

## Compare Models

```typescript
import { compareCost } from 'pradvion-node'

const result = compareCost({ inputTokens: 1000, outputTokens: 500 })
console.log(result.formatTable())
// Cost comparison (1000 input, 500 output tokens)
// ───────────────────────────────────────────────────────
//   openai/gpt-4o-mini                            $0.000450 ← cheapest
//   openai/gpt-3.5-turbo                          $0.001250
//   ...
//   openai/o1                                     $0.045000
// ───────────────────────────────────────────────────────
//   Max savings: 99.0% (openai/o1 → openai/gpt-4o-mini)

console.log(`Cheapest: ${result.cheapest}`)
console.log(`Save ${result.savingsVs('openai/gpt-4o', 'openai/gpt-4o-mini')}%`)
```

## Middleware Pattern (Express)

```typescript
app.use(async (req, res, next) => {
  const user = getUser(req)
  pradvion.setContext({
    customerId: user.companyId,
    environment: 'production',
  })
  res.on('finish', () => pradvion.clearContext())
  next()
})
```

## Anthropic Support

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = pradvion.monitor(new Anthropic())

const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
})
// Tracked automatically ✅
```

## LangChain Integration

```typescript
import { PradvionCallbackHandler } from 'pradvion-node/langchain'
import { ChatOpenAI } from '@langchain/openai'

const handler = new PradvionCallbackHandler({
  customerId: 'samsung-001',
  feature: 'chatbot',
})

const llm = new ChatOpenAI({ callbacks: [handler] })
const response = await llm.invoke('Hello')
// Tracked automatically ✅
```

## OpenTelemetry Integration

```typescript
import { setupOtel } from 'pradvion-node/otel'

setupOtel()

// Now any OTEL-instrumented framework automatically
// tracks token usage to Pradvion
```

## Agent / RAG Usage

```typescript
await pradvion.context(
  { feature: 'research-agent', customerId: 'samsung-001' },
  async () => {
    // All sub-calls tracked under the same context
    const search = await openai.chat.completions.create(...)
    const analyze = await openai.chat.completions.create(...)
    const report = await openai.chat.completions.create(...)
  }
)
```

## Manual Tracking

For frameworks not yet wrapped:

```typescript
const start = Date.now()
try {
  const response = await myLLMClient.generate(prompt)
  pradvion.track({
    provider: 'openai',
    model: 'gpt-4o',
    inputTokens: response.usage.input,
    outputTokens: response.usage.output,
    latencyMs: Date.now() - start,
    customerId: 'samsung-001',
  })
} catch (err: any) {
  pradvion.trackError({
    provider: 'openai',
    model: 'gpt-4o',
    error: err.message,
    statusCode: err.status ?? 500,
    latencyMs: Date.now() - start,
  })
  throw err
}
```

## Flush and Shutdown

Auto-flush is on by default (flushes on process exit via `SIGINT`, `SIGTERM`,
and `beforeExit`). For scripts or graceful shutdown:

```typescript
// Flush manually before shutdown
await pradvion.flush()

// Graceful shutdown
await pradvion.shutdown()
```

---

## Configuration

```typescript
pradvion.init({
  apiKey: 'nx_live_YOUR_KEY',      // Required
  baseUrl: 'https://...',          // Optional: custom endpoint
  timeout: 5000,                   // Optional: HTTP timeout ms
  asyncTracking: true,             // Optional: background worker
  autoFlush: true,                 // Optional: flush on exit
  queuePath: '~/.pradvion/queue.json', // Optional: custom path
})
```

---

## Privacy

Pradvion is **privacy-first** by design:

- ✅ Only token counts, model names, and latency are tracked
- ✅ Customer IDs are SHA-256 hashed before leaving your server
- ✅ Prompts and responses are **never** captured or transmitted
- ✅ All source code is open source and auditable
- ✅ MIT licensed — verify our claims yourself

---

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 4.5 (optional but recommended)

**Zero hard dependencies.** OpenAI and Anthropic are optional
peer dependencies — only install what you use.

---

## Support

- 📧 Email: hello@pradvion.com
- 🌐 Dashboard: [pradvion.com](https://pradvion.com)
- 🐛 Issues: [GitHub](https://github.com/pradvion/pradvion-node-sdk/issues)
- 📦 npm: [pradvion-node](https://www.npmjs.com/package/pradvion-node)

---

## License

MIT — see [LICENSE](LICENSE)
