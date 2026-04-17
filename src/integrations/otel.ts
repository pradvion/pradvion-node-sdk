import { PradvionClient } from '../client'
import { getEffectiveContext } from '../context'

const INPUT_TOKEN_ATTRS = [
  'llm.token_count.prompt',
  'gen_ai.usage.prompt_tokens',
  'gen_ai.usage.input_tokens',
  'llm.usage.prompt_tokens',
]

const OUTPUT_TOKEN_ATTRS = [
  'llm.token_count.completion',
  'gen_ai.usage.completion_tokens',
  'gen_ai.usage.output_tokens',
  'llm.usage.completion_tokens',
]

const MODEL_ATTRS = [
  'llm.model_name',
  'gen_ai.request.model',
  'gen_ai.response.model',
]

const PROVIDER_ATTRS = [
  'llm.provider',
  'gen_ai.system',
]

function getAttr(
  attrs: Record<string, any>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const val = attrs[key]
    if (val != null) return String(val)
  }
  return undefined
}

function getIntAttr(
  attrs: Record<string, any>,
  keys: string[],
): number {
  for (const key of keys) {
    const val = attrs[key]
    if (val != null) {
      const n = parseInt(String(val), 10)
      if (!isNaN(n)) return n
    }
  }
  return 0
}

export class PradvionSpanExporter {
  constructor(
    private readonly pradvionClient?: PradvionClient
  ) {}

  private getClient(): PradvionClient | null {
    if (this.pradvionClient) return this.pradvionClient
    try {
      const { getClient } = require('../index')
      return getClient()
    } catch {
      return null
    }
  }

  export(spans: any[]): number {
    const client = this.getClient()
    if (!client) return 0

    for (const span of spans) {
      try {
        this._processSpan(span, client)
      } catch {}
    }
    return 0
  }

  private _processSpan(
    span: any,
    client: PradvionClient,
  ): void {
    const attrs = span.attributes ?? {}
    const spanKind = attrs['openinference.span.kind'] ?? ''
    const genAiSystem = attrs['gen_ai.system'] ?? ''

    const isLlm = (
      ['LLM', 'CHAIN', 'llm'].includes(spanKind) ||
      Boolean(genAiSystem) ||
      Object.keys(attrs).some(k =>
        k.startsWith('llm.') || k.startsWith('gen_ai.')
      )
    )

    if (!isLlm) return

    const inputTokens = getIntAttr(attrs, INPUT_TOKEN_ATTRS)
    const outputTokens = getIntAttr(attrs, OUTPUT_TOKEN_ATTRS)

    if (inputTokens === 0 && outputTokens === 0) return

    let model = getAttr(attrs, MODEL_ATTRS) ?? 'unknown'
    let provider = getAttr(attrs, PROVIDER_ATTRS) ?? 'unknown'

    const providerLower = provider.toLowerCase()
    if (providerLower.includes('openai')) provider = 'openai'
    else if (providerLower.includes('anthropic')) {
      provider = 'anthropic'
    }

    const startNs = span.startTime ?? 0
    const endNs = span.endTime ?? 0
    const latencyMs = startNs && endNs
      ? Math.round((endNs - startNs) / 1_000_000)
      : 0

    const statusCode =
      (span.status?.code ?? 0) === 2 ? 500 : 200

    const ctx = getEffectiveContext()
    const customerId =
      attrs['pradvion.customer_id'] ?? ctx.customerId
    const feature = attrs['pradvion.feature'] ?? ctx.feature
    const team = attrs['pradvion.team'] ?? ctx.team
    const conversationId =
      attrs['pradvion.conversation_id'] ?? ctx.conversationId
    const environment =
      attrs['pradvion.environment'] ?? ctx.environment

    client.track({
      provider,
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      statusCode,
      customerId,
      feature,
      team,
      environment,
      conversationId,
    })
  }

  shutdown(): Promise<void> {
    return Promise.resolve()
  }

  forceFlush(): Promise<void> {
    return Promise.resolve()
  }
}

export function setupOtel(
  pradvionClient?: PradvionClient,
  batch: boolean = true,
): any {
  try {
    const {
      trace,
    } = require('@opentelemetry/api')
    const {
      TracerProvider,
      BatchSpanProcessor,
      SimpleSpanProcessor,
    } = require('@opentelemetry/sdk-trace-base')

    const exporter = new PradvionSpanExporter(pradvionClient)
    const Processor = batch
      ? BatchSpanProcessor
      : SimpleSpanProcessor
    const processor = new Processor(exporter)

    const provider = trace.getTracerProvider()
    if (provider?.addSpanProcessor) {
      provider.addSpanProcessor(processor)
    } else {
      const newProvider = new TracerProvider()
      newProvider.addSpanProcessor(processor)
      trace.setGlobalTracerProvider(newProvider)
    }

    return processor
  } catch (e) {
    throw new Error(
      'opentelemetry packages required for OTEL integration.\n' +
      'Install: npm install @opentelemetry/api ' +
      '@opentelemetry/sdk-trace-base'
    )
  }
}
