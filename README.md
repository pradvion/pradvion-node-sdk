# Pradvion Node.js SDK

[![npm version](https://img.shields.io/npm/v/pradvion-node.svg)](https://www.npmjs.com/package/pradvion-node)
[![Node.js](https://img.shields.io/node/v/pradvion-node.svg)](https://www.npmjs.com/package/pradvion-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Track AI API costs by client, feature, and team. Connect every dollar spent to the business outcome behind it — meetings booked, deals closed, reports generated.

**[pradvion.com](https://pradvion.com) · [Docs](https://pradvion.com/docs) · [Dashboard](https://pradvion.com)**

---

## Installation

```bash
npm install pradvion-node
```

OpenAI and Anthropic are optional peer dependencies — install only what you use:

```bash
npm install openai              # OpenAI support
npm install @anthropic-ai/sdk   # Anthropic support
```

---

## Quick Start

```typescript
import OpenAI from "openai"
import * as pradvion from "pradvion-node"

// Initialize once at startup
pradvion.init({ apiKey: "nx_live_..." })

// Wrap your OpenAI client — drop-in replacement
const client = pradvion.monitor(new OpenAI())

// Tag with business context, then call as normal
await pradvion.context(
  {
    feature: "resume-summarizer",
    customerId: "customer-001",   // hashed with SHA-256 before sending
    team: "hr-team",
    environment: "production",
  },
  async () => {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Summarize this resume" }],
    })
  }
)
// Cost, tokens, and latency tracked automatically — zero prompt storage
```

---

## Supported Providers

```typescript
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import * as pradvion from "pradvion-node"

const openai    = pradvion.monitor(new OpenAI())
const anthropic = pradvion.monitor(new Anthropic())

// Streaming — tokens accumulate correctly across chunks
const stream = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
  stream: true,
})
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "")
}
// Usage tracked automatically from the final chunk
```

---

## Context Tagging

### trace() — simplest form

Pass a customer ID string directly:

```typescript
const result = await pradvion.trace("customer-001", async () => {
  return await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
  })
})
```

### context() — full options

All parameters are optional:

```typescript
await pradvion.context(
  {
    feature: "resume-summarizer",   // what the AI is doing
    customerId: "customer-001",      // auto-hashed with SHA-256
    team: "hr-team",                // team that owns this feature
    environment: "production",      // filters out test traffic in analytics
    conversationId: "run-abc-123",  // groups multi-step agent calls
    project: "my-project",          // optional project tag
  },
  async () => {
    await client.chat.completions.create(...)
  }
)
```

### Express middleware

Set context once per request so every AI call in that request is tagged:

```typescript
app.use(async (req, res, next) => {
  const user = getUser(req)
  pradvion.setContext({
    customerId: user.companyId,
    environment: "production",
  })
  res.on("finish", () => pradvion.clearContext())
  next()
})
```

---

## Business Signals

Track the outcomes your AI produces — not just the cost.

```typescript
// After an AI call creates a downstream result, record the signal
pradvion.signal({
  customerId: "customer-001",   // links back to AI costs for this customer
  event: "meeting_booked",     // lowercase, snake_case
  quantity: 1,
  value: 150.00,               // dollar value of the outcome
  feature: "outreach-agent",
  environment: "production",
})

// Batch version
pradvion.signalBatch([
  { customerId: "my-company", event: "email_sent",     quantity: 50 },
  { customerId: "my-company", event: "meeting_booked", quantity: 3, value: 450.0 },
  { customerId: "my-company", event: "deal_closed",    quantity: 1, value: 12000.0 },
])
```

Pradvion automatically computes **cost per meeting booked**, **margin per customer**, and **ROI per feature** in the Unit Economics dashboard.

---

## Agent / Multi-step Tracking

Group all LLM calls within a single agent run:

```typescript
const runId = pradvion.newConversation()  // generates a unique ID

await pradvion.context(
  {
    feature: "research-agent",
    customerId: "my-company",
    conversationId: runId,
    environment: "production",
  },
  async () => {
    const plan   = await client.chat.completions.create(...)   // step 1
    const search = await client.chat.completions.create(...)   // step 2
    const report = await client.chat.completions.create(...)   // step 3
  }
)

// All 3 calls appear in the dashboard linked by conversationId
// Record the business outcome once the agent completes
if (taskCompleted) {
  pradvion.signal({ customerId: "my-company", event: "report_generated", quantity: 1, value: 50.0 })
}
```

---

## Manual Tracking

Track calls from providers not yet wrapped:

```typescript
const start = Date.now()
try {
  const response = await myLLMClient.generate(prompt)
  pradvion.track({
    provider: "openai",
    model: "gpt-4o",
    inputTokens: response.usage.promptTokens,
    outputTokens: response.usage.completionTokens,
    latencyMs: Date.now() - start,
    statusCode: 200,
    customerId: "my-company",
    feature: "chatbot",
  })
} catch (err: any) {
  pradvion.trackError({
    provider: "openai",
    model: "gpt-4o",
    error: err.message,
    statusCode: err.status ?? 500,
    latencyMs: Date.now() - start,
  })
  throw err
}

// Batch version
pradvion.trackBatch([
  { provider: "openai", model: "gpt-4o",         inputTokens: 500, outputTokens: 200, latencyMs: 800 },
  { provider: "anthropic", model: "claude-sonnet-4-6", inputTokens: 300, outputTokens: 150, latencyMs: 600 },
])
```

---

## Integrations

### LangChain

```typescript
import { ChatOpenAI } from "@langchain/openai"
import { PradvionCallbackHandler } from "pradvion-node/integrations/langchain"
import * as pradvion from "pradvion-node"

pradvion.init({ apiKey: "nx_live_..." })

const callback = new PradvionCallbackHandler({
  feature: "research-chain",
  customerId: "my-company",
  environment: "production",
})

const llm = new ChatOpenAI({
  model: "gpt-4o",
  callbacks: [callback],
})

const response = await llm.invoke("Summarize this document")
```

### OpenTelemetry

```typescript
import { PradvionSpanExporter } from "pradvion-node/integrations/otel"
import { TracerProvider } from "@opentelemetry/sdk-trace-node"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"

const exporter = new PradvionSpanExporter({ apiKey: "nx_live_..." })
const provider = new TracerProvider()
provider.addSpanProcessor(new BatchSpanProcessor(exporter))

// Pradvion reads GenAI semantic conventions from OTEL spans
// Compatible with: OpenLLMetry, traceloop, Langfuse OTEL, etc.
```

---

## init() Options

```typescript
pradvion.init({
  apiKey: "nx_live_...",   // required — from Dashboard → Projects → API Keys
  baseUrl: "https://...",  // optional — default: Pradvion cloud
  timeout: 5000,           // HTTP timeout in milliseconds (default: 5000)
  autoFlush: true,         // flush on process exit (default: true)
})
```

---

## Flush & Shutdown

Auto-flush is on by default (fires on `beforeExit`, `SIGINT`, and `SIGTERM`). In short-lived processes — scripts, Lambda functions, or tests — call flush explicitly:

```typescript
await pradvion.flush()     // wait for all pending events to send
await pradvion.shutdown()  // flush + stop background worker
```

---

## Privacy

Pradvion is **privacy-first** by design:

- Tracks token counts, model names, and latency — nothing else
- Customer IDs are SHA-256 hashed before leaving your server
- Prompts and responses are **never** captured or transmitted
- All source code is open source and auditable

---

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 4.5 (optional but recommended)
- Zero hard dependencies — OpenAI and Anthropic are optional peer dependencies

---

## Support

- Email: [hello@pradvion.com](mailto:hello@pradvion.com)
- Dashboard: [pradvion.com](https://pradvion.com)
- Docs: [pradvion.com/docs](https://pradvion.com/docs)
- Issues: [GitHub](https://github.com/pradvion/pradvion-node-sdk/issues)

---

## License

MIT — see [LICENSE](LICENSE)
