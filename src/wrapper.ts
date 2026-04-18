/**
 * AI client wrappers for automatic tracking.
 * Privacy: Prompts and responses are NEVER captured.
 */

import * as crypto from 'crypto'
import { PradvionClient } from './client'
import { getEffectiveContext } from './context'

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
    const ctx = getEffectiveContext()
    const startTime = Date.now()
    const requestId = crypto.randomUUID()

    if (isStream) {
      return handleOpenAIStream(
        originalCreate,
        params,
        options,
        pradvion,
        model,
        ctx,
        startTime,
        requestId,
      )
    }

    try {
      const response = await originalCreate(params, options)
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
): AsyncGenerator<any> {
  let inputTokens = 0
  let outputTokens = 0
  let chunkCount = 0
  let statusCode = 200

  try {
    const stream = await originalCreate(params, options)

    for await (const chunk of stream) {
      chunkCount++

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
