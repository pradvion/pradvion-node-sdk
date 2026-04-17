import { PradvionClient } from '../client'
import { getEffectiveContext } from '../context'

const PROVIDER_MAP: Record<string, string> = {
  openai: 'openai',
  chatopenai: 'openai',
  azurechatopenai: 'openai',
  anthropic: 'anthropic',
  chatanthropic: 'anthropic',
  google: 'google',
  chatgoogle: 'google',
}

function detectProvider(serialized: Record<string, any>): string {
  const ids: string[] = serialized?.id ?? []
  const last = (ids[ids.length - 1] ?? '').toLowerCase()
  for (const [key, provider] of Object.entries(PROVIDER_MAP)) {
    if (last.includes(key)) return provider
  }
  return 'unknown'
}

function extractModel(
  serialized: Record<string, any>,
  kwargs: Record<string, any>,
): string {
  const skwargs = serialized?.kwargs ?? {}
  for (const field of ['model_name', 'model', 'deployment_name']) {
    if (skwargs[field]) return String(skwargs[field])
  }
  const inv = kwargs?.invocation_params ?? {}
  for (const field of ['model', 'model_name', 'engine']) {
    if (inv[field]) return String(inv[field])
  }
  return 'unknown'
}

export interface PradvionCallbackOptions {
  customerId?: string
  project?: string
  feature?: string
  team?: string
  environment?: string
  conversationId?: string
  pradvionClient?: PradvionClient
}

export class PradvionCallbackHandler {
  readonly raiseError = false
  private startTimes = new Map<string, number>()
  private runInfo = new Map<string, [string, string]>()

  constructor(
    private readonly options: PradvionCallbackOptions = {}
  ) {}

  private getClient(): PradvionClient | null {
    if (this.options.pradvionClient) {
      return this.options.pradvionClient
    }
    try {
      const { getClient } = require('../index')
      return getClient()
    } catch {
      return null
    }
  }

  private getCtx() {
    const ctx = getEffectiveContext()
    return {
      customerId: this.options.customerId ?? ctx.customerId,
      feature: this.options.feature ?? ctx.feature,
      team: this.options.team ?? ctx.team,
      environment: this.options.environment ?? ctx.environment,
      conversationId:
        this.options.conversationId ?? ctx.conversationId,
    }
  }

  async handleLLMStart(
    serialized: Record<string, any>,
    _prompts: string[],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, any>,
    _tags?: string[],
    _metadata?: Record<string, any>,
    kwargs?: Record<string, any>,
  ): Promise<void> {
    this.startTimes.set(runId, Date.now())
    const provider = detectProvider(serialized)
    const model = extractModel(serialized, kwargs ?? {})
    this.runInfo.set(runId, [provider, model])
  }

  async handleChatModelStart(
    serialized: Record<string, any>,
    _messages: any[][],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, any>,
    _tags?: string[],
    _metadata?: Record<string, any>,
    kwargs?: Record<string, any>,
  ): Promise<void> {
    this.startTimes.set(runId, Date.now())
    const provider = detectProvider(serialized)
    const model = extractModel(serialized, kwargs ?? {})
    this.runInfo.set(runId, [provider, model])
  }

  async handleLLMEnd(
    output: any,
    runId: string,
  ): Promise<void> {
    const client = this.getClient()
    if (!client) return

    const start = this.startTimes.get(runId)
    const latencyMs = start ? Date.now() - start : 0
    const [provider, model] =
      this.runInfo.get(runId) ?? ['unknown', 'unknown']

    this.startTimes.delete(runId)
    this.runInfo.delete(runId)

    let inputTokens = 0
    let outputTokens = 0

    try {
      const llmOutput = output?.llm_output ?? {}
      const usage =
        llmOutput.token_usage ?? llmOutput.usage ?? {}
      inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0
      outputTokens =
        usage.completion_tokens ?? usage.output_tokens ?? 0
    } catch {}

    if (inputTokens === 0 && outputTokens === 0) return

    const ctx = this.getCtx()
    client.track({
      provider,
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      statusCode: 200,
      customerId: ctx.customerId,
      feature: ctx.feature,
      team: ctx.team,
      environment: ctx.environment,
      conversationId: ctx.conversationId,
      requestId: runId,
    })
  }

  async handleLLMError(
    _error: Error,
    runId: string,
  ): Promise<void> {
    this.startTimes.delete(runId)
    this.runInfo.delete(runId)
  }

  async handleChainStart(): Promise<void> {}
  async handleChainEnd(): Promise<void> {}
  async handleChainError(): Promise<void> {}
  async handleToolStart(): Promise<void> {}
  async handleToolEnd(): Promise<void> {}
  async handleToolError(): Promise<void> {}
  async handleText(): Promise<void> {}
  async handleAgentAction(): Promise<void> {}
  async handleAgentEnd(): Promise<void> {}
  async handleRetrieverStart(): Promise<void> {}
  async handleRetrieverEnd(): Promise<void> {}
  async handleRetrieverError(): Promise<void> {}
}
