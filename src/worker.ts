import { LocalQueue } from './queue'
import { QueuePayload } from './types'
import { SDK_VERSION, SDK_LANGUAGE } from './version'

const INGEST_URL_SUFFIX = '/sdk/ingest'
const SIGNAL_URL_SUFFIX = '/sdk/signals'

export interface WorkerOptions {
  queue: LocalQueue
  apiKey: string
  baseUrl: string
  timeout: number
  flushInterval?: number
  batchSize?: number
}

export class QueueWorker {
  private readonly queue: LocalQueue
  private readonly apiKey: string
  private readonly ingestUrl: string
  private readonly signalUrl: string
  private readonly timeout: number
  private readonly flushInterval: number
  private readonly batchSize: number
  private timer: ReturnType<typeof setInterval> | null = null
  private running: boolean = false

  constructor(options: WorkerOptions) {
    this.queue = options.queue
    this.apiKey = options.apiKey
    this.ingestUrl = `${options.baseUrl}${INGEST_URL_SUFFIX}`
    this.signalUrl = `${options.baseUrl}${SIGNAL_URL_SUFFIX}`
    this.timeout = options.timeout
    this.flushInterval = options.flushInterval ?? 5000
    this.batchSize = options.batchSize ?? 20
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(
      () => this.flushOnce(),
      this.flushInterval
    )
    if (this.timer.unref) {
      this.timer.unref()
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.running = false
  }

  async flushOnce(): Promise<void> {
    const pending = this.queue.getPending(this.batchSize)
    if (pending.length === 0) return

    await Promise.allSettled(
      pending.map(entry => this._send(entry.id, entry.payload))
    )
  }

  private async _send(
    id: number,
    payload: QueuePayload
  ): Promise<void> {
    const isSignal = (payload as any).type === 'signal'
    const url = isSignal ? this.signalUrl : this.ingestUrl

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.timeout
      )

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Pradvion-SDK-Version': SDK_VERSION,
          'X-Pradvion-SDK-Language': SDK_LANGUAGE,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status >= 200 && response.status < 300) {
        this.queue.markSent(id)
      } else {
        this.queue.markFailed(id)
      }
    } catch {
      this.queue.markFailed(id)
    }
  }
}
