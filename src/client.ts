import * as crypto from 'crypto'
import { LocalQueue } from './queue'
import { QueueWorker } from './worker'
import { createSignalPayload } from './signals'
import {
  PradvionOptions,
  TrackOptions,
  TrackErrorOptions,
  SignalOptions,
  TrackPayload,
} from './types'

export class PradvionClient {
  readonly apiKey: string
  readonly baseUrl: string
  private readonly timeout: number
  readonly queue: LocalQueue
  private readonly worker: QueueWorker

  constructor(options: PradvionOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ??
      'https://pradvion-backend-production.up.railway.app'
    ).replace(/\/$/, '')
    this.timeout = options.timeout ?? 5000

    this.queue = new LocalQueue(options.queuePath)
    this.worker = new QueueWorker({
      queue: this.queue,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      flushInterval: 5000,
      batchSize: 20,
    })

    if (options.asyncTracking !== false) {
      this.worker.start()
    }
  }

  track(options: TrackOptions): void {
    const payload: TrackPayload = {
      request_id: options.requestId ?? crypto.randomUUID(),
      provider: options.provider,
      model: options.model,
      input_tokens: Math.max(0, options.inputTokens),
      output_tokens: Math.max(0, options.outputTokens),
      cached_tokens: Math.max(0, options.cachedTokens ?? 0),
      reasoning_tokens: Math.max(
        0, options.reasoningTokens ?? 0
      ),
      latency_ms: Math.max(0, options.latencyMs),
      status_code: options.statusCode ?? 200,
      timestamp: new Date().toISOString(),
    }

    if (options.customerId) {
      payload.customer_id_hash = this._hashCustomerId(
        options.customerId
      )
    }
    if (options.feature) payload.feature = options.feature
    if (options.team) payload.team = options.team
    if (options.department) {
      payload.department = options.department
    }
    if (options.environment) {
      payload.environment = options.environment
    }
    if (options.conversationId) {
      payload.conversation_id = options.conversationId
    }

    this.queue.push(payload)
  }

  trackError(options: TrackErrorOptions): void {
    const payload: TrackPayload = {
      request_id: options.requestId ?? crypto.randomUUID(),
      provider: options.provider,
      model: options.model,
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      reasoning_tokens: 0,
      latency_ms: Math.max(0, options.latencyMs ?? 0),
      status_code: options.statusCode ?? 500,
      timestamp: new Date().toISOString(),
      error: String(options.error).substring(0, 500),
    }

    if (options.customerId) {
      payload.customer_id_hash = this._hashCustomerId(
        options.customerId
      )
    }
    if (options.feature) payload.feature = options.feature
    if (options.team) payload.team = options.team
    if (options.department) {
      payload.department = options.department
    }
    if (options.environment) {
      payload.environment = options.environment
    }
    if (options.conversationId) {
      payload.conversation_id = options.conversationId
    }

    this.queue.push(payload)
  }

  trackBatch(events: TrackOptions[]): void {
    if (!events?.length) return
    for (const event of events) {
      try {
        this.track(event)
      } catch (e) {
        // Skip invalid events silently
      }
    }
  }

  signal(options: SignalOptions): void {
    const payload = createSignalPayload(options)
    this.queue.push(payload)
  }

  signalBatch(signals: SignalOptions[]): void {
    if (!signals?.length) return
    for (const sig of signals) {
      try {
        this.signal(sig)
      } catch (e) {
        // Skip invalid signals silently
      }
    }
  }

  async flush(): Promise<void> {
    await this.worker.flushOnce()
  }

  async shutdown(): Promise<void> {
    await this.flush()
    this.worker.stop()
  }

  private _hashCustomerId(customerId: string): string {
    return crypto
      .createHash('sha256')
      .update(String(customerId))
      .digest('hex')
  }
}
