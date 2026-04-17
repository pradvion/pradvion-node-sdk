/**
 * AI client wrappers for automatic tracking.
 * Privacy: Prompts and responses are NEVER captured.
 */

import * as crypto from 'crypto'
import { PradvionClient } from './client'
import { getEffectiveContext } from './context'

const OUTPUT_RATES: Record<string, number> = {
  'openai/gpt-4o':           0.00001,
  'openai/gpt-4o-mini':      0.0000006,
  'openai/gpt-4-turbo':      0.00003,
  'openai/gpt-3.5-turbo':    0.0000015,
  'openai/o1':               0.00006,
  'openai/o1-mini':          0.0000044,
  'openai/o3-mini':          0.0000044,
  'anthropic/claude-3-5-sonnet-20241022': 0.000015,
  'anthropic/claude-3-haiku-20240307':    0.00000125,
  'anthropic/claude-3-opus-20240229':     0.000075,
}

const INPUT_RATES: Record<string, number> = {
  'openai/gpt-4o':           0.0000025,
  'openai/gpt-4o-mini':      0.00000015,
  'openai/gpt-4-turbo':      0.00001,
  'openai/gpt-3.5-turbo':    0.0000005,
  'openai/o1':               0.000015,
  'openai/o1-mini':          0.0000011,
  'openai/o3-mini':          0.0000011,
  'anthropic/claude-3-5-sonnet-20241022': 0.000003,
  'anthropic/claude-3-haiku-20240307':    0.00000025,
  'anthropic/claude-3-opus-20240229':     0.000015,
}

export class StreamingCostTracker {
  private readonly outRate: number
  private readonly inRate: number
  private readonly inputCost: number
  private outputChunks: number = 0
  private estimatedCost: number = 0

  constructor(
    provider: string,
    model: string,
    inputTokens: number = 0,
    private readonly onToken?: (cost: number) => void,
    private readonly callbackInterval: number = 5,
  ) {
    const key = `${provider}/${model}`
    this.outRate = OUTPUT_RATES[key] ?? 0
    this.inRate = INPUT_RATES[key] ?? 0
    this.inputCost = this.inRate * inputTokens
    this.callbackInterval = Math.max(1, callbackInterval)
  }

  onChunk(): number {
    this.outputChunks++
    this.estimatedCost = (
      this.inputCost + this.outRate * this.outputChunks
    )
    if (
      this.onToken &&
      this.outputChunks % this.callbackInterval === 0
    ) {
      try { this.onToken(this.estimatedCost) } catch {}
    }
    return this.estimatedCost
  }

  finalize(
    actualInputTokens: number = 0,
    actualOutputTokens: number = 0,
  ): number {
    const final = actualInputTokens > 0 || actualOutputTokens > 0
      ? this.inRate * actualInputTokens +
        this.outRate * actualOutputTokens
      : this.estimatedCost
    if (this.onToken) {
      try { this.onToken(final) } catch {}
    }
    return final
  }
}

export function wrapOpenAI<T extends object>(
  client: T,
  pradvion: PradvionClient,
): T {
  return new Proxy(client, {
    get(target: any, prop: string) {
      if (prop === 'chat') {
        return new Proxy(target.chat, {
          get(chatTarget: any, chatProp: string) {
            if (chatProp === 'completions') {
              return new Proxy(chatTarget.completions, {
                get(compTarget: any, compProp: string) {
                  if (compProp === 'create') {
                    return createOpenAICreateWrapper(
                      compTarget.create.bind(compTarget),
                      pradvion,
                    )
                  }
                  return compTarget[compProp]
                }
              })
            }
            return chatTarget[chatProp]
          }
        })
      }
      return target[prop]
    }
  }) as T
}

function createOpenAICreateWrapper(
  originalCreate: Function,
  pradvion: PradvionClient,
) {
  return async function(
    params: any,
    options?: any,
  ): Promise<any> {
    const model = params?.model ?? 'unknown'
    const isStream = params?.stream === true
    const onToken = params?.onToken
    const ctx = getEffectiveContext()
    const startTime = Date.now()
    const requestId = crypto.randomUUID()

    const cleanParams = { ...params }
    delete cleanParams.onToken

    if (isStream) {
      return handleOpenAIStream(
        originalCreate,
        cleanParams,
        options,
        pradvion,
        model,
        ctx,
        startTime,
        requestId,
        onToken,
      )
    }

    try {
      const response = await originalCreate(cleanParams, options)
      const latencyMs = Date.now() - startTime
      const usage = response?.usage ?? {}

      pradvion.track({
        provider: 'openai',
        model,
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        cachedTokens:
          usage.prompt_tokens_details?.cached_tokens ?? 0,
        latencyMs,
        statusCode: 200,
        customerId: ctx.customerId,
        feature: ctx.feature,
        team: ctx.team,
        department: ctx.department,
        environment: ctx.environment,
        conversationId: ctx.conversationId,
        requestId,
      })

      return response
    } catch (err: any) {
      const statusCode = err?.status ?? 500
      pradvion.trackError({
        provider: 'openai',
        model,
        error: err?.message ?? String(err),
        statusCode,
        latencyMs: Date.now() - startTime,
        customerId: ctx.customerId,
        feature: ctx.feature,
        environment: ctx.environment,
        requestId,
      })
      throw err
    }
  }
}

async function* handleOpenAIStream(
  originalCreate: Function,
  params: any,
  options: any,
  pradvion: PradvionClient,
  model: string,
  ctx: any,
  startTime: number,
  requestId: string,
  onToken?: (cost: number) => void,
): AsyncGenerator<any> {
  const tracker = new StreamingCostTracker(
    'openai', model, 0, onToken
  )
  let inputTokens = 0
  let outputTokens = 0
  let chunkCount = 0
  let statusCode = 200

  try {
    const stream = await originalCreate(params, options)

    for await (const chunk of stream) {
      chunkCount++
      tracker.onChunk()

      if (chunk?.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0
        outputTokens = chunk.usage.completion_tokens ?? 0
      }

      yield chunk
    }
  } catch (err: any) {
    statusCode = err?.status ?? 500
    pradvion.trackError({
      provider: 'openai',
      model,
      error: err?.message ?? String(err),
      statusCode,
      latencyMs: Date.now() - startTime,
      customerId: ctx.customerId,
      requestId,
    })
    throw err
  } finally {
    tracker.finalize(inputTokens, outputTokens)
    const latencyMs = Date.now() - startTime

    if (statusCode === 200) {
      pradvion.track({
        provider: 'openai',
        model,
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || chunkCount,
        latencyMs,
        statusCode: 200,
        customerId: ctx.customerId,
        feature: ctx.feature,
        team: ctx.team,
        department: ctx.department,
        environment: ctx.environment,
        conversationId: ctx.conversationId,
        requestId,
      })
    }
  }
}

export function wrapAnthropic<T extends object>(
  client: T,
  pradvion: PradvionClient,
): T {
  return new Proxy(client, {
    get(target: any, prop: string) {
      if (prop === 'messages') {
        return new Proxy(target.messages, {
          get(msgTarget: any, msgProp: string) {
            if (msgProp === 'create') {
              return createAnthropicCreateWrapper(
                msgTarget.create.bind(msgTarget),
                pradvion,
              )
            }
            return msgTarget[msgProp]
          }
        })
      }
      return target[prop]
    }
  }) as T
}

function createAnthropicCreateWrapper(
  originalCreate: Function,
  pradvion: PradvionClient,
) {
  return async function(
    params: any,
    options?: any,
  ): Promise<any> {
    const model = params?.model ?? 'unknown'
    const ctx = getEffectiveContext()
    const startTime = Date.now()
    const requestId = crypto.randomUUID()

    try {
      const response = await originalCreate(params, options)
      const latencyMs = Date.now() - startTime
      const usage = response?.usage ?? {}

      pradvion.track({
        provider: 'anthropic',
        model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        latencyMs,
        statusCode: 200,
        customerId: ctx.customerId,
        feature: ctx.feature,
        team: ctx.team,
        department: ctx.department,
        environment: ctx.environment,
        conversationId: ctx.conversationId,
        requestId,
      })

      return response
    } catch (err: any) {
      pradvion.trackError({
        provider: 'anthropic',
        model,
        error: err?.message ?? String(err),
        statusCode: err?.status ?? 500,
        latencyMs: Date.now() - startTime,
        customerId: ctx.customerId,
        requestId,
      })
      throw err
    }
  }
}
