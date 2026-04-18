import { PradvionClient } from './client'
import {
  runWithContext,
  setContext,
  clearContext,
} from './context'
import { wrapOpenAI, wrapAnthropic } from './wrapper'
import { newConversationId } from './conversation'
import { SDK_VERSION } from './version'
import type {
  PradvionOptions,
  TrackOptions,
  TrackErrorOptions,
  SignalOptions,
  ContextOptions,
} from './types'

let _client: PradvionClient | null = null

function init(options: PradvionOptions): void {
  _client = new PradvionClient(options)

  if (options.autoFlush !== false) {
    process.on('exit', () => {
      _client?.queue.pendingCount()
    })
    process.on('beforeExit', async () => {
      await _client?.flush()
    })
    process.on('SIGINT', async () => {
      await _client?.flush()
      process.exit(0)
    })
    process.on('SIGTERM', async () => {
      await _client?.flush()
      process.exit(0)
    })
  }
}

function getClient(): PradvionClient {
  if (!_client) {
    throw new Error(
      'Pradvion not initialized. ' +
      "Call pradvion.init({ apiKey: 'nx_live_...' }) first."
    )
  }
  return _client
}

function monitor<T extends object>(
  client: T,
  pradvionClient?: PradvionClient,
): T {
  const pc = pradvionClient ?? _client
  if (!pc) {
    console.warn(
      '[Pradvion] monitor() called before init(). ' +
      'Call pradvion.init() first.'
    )
    return client
  }

  const c = client as any
  if (typeof c.chat?.completions?.create === 'function') {
    return wrapOpenAI(client, pc)
  }
  if (typeof c.messages?.create === 'function') {
    return wrapAnthropic(client, pc)
  }

  console.warn(
    '[Pradvion] monitor(): unrecognized client type. ' +
    'Supported: OpenAI, Anthropic'
  )
  return client
}

function track(options: TrackOptions): void {
  getClient().track(options)
}

function trackError(options: TrackErrorOptions): void {
  getClient().trackError(options)
}

function trackBatch(events: TrackOptions[]): void {
  getClient().trackBatch(events)
}

function signal(options: SignalOptions): void {
  getClient().signal(options)
}

function signalBatch(signals: SignalOptions[]): void {
  getClient().signalBatch(signals)
}

async function trace<T>(
  customerIdOrContext: string | ContextOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const ctx: ContextOptions =
    typeof customerIdOrContext === 'string'
      ? { customerId: customerIdOrContext }
      : customerIdOrContext
  return runWithContext(ctx, fn)
}

async function context<T>(
  ctx: ContextOptions,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithContext(ctx, fn)
}

function newConversation(): string {
  return newConversationId()
}

async function flush(): Promise<void> {
  await _client?.flush()
}

async function shutdown(): Promise<void> {
  await _client?.shutdown()
  _client = null
}

const pradvion = {
  init,
  getClient,
  monitor,
  track,
  trackError,
  trackBatch,
  signal,
  signalBatch,
  trace,
  context,
  setContext,
  clearContext,
  newConversation,
  flush,
  shutdown,
  version: SDK_VERSION,
}

export default pradvion
export {
  init,
  getClient,
  monitor,
  track,
  trackError,
  trackBatch,
  signal,
  signalBatch,
  trace,
  context,
  setContext,
  clearContext,
  newConversation,
  flush,
  shutdown,
  SDK_VERSION,
}

export type {
  PradvionOptions,
  TrackOptions,
  TrackErrorOptions,
  SignalOptions,
  ContextOptions,
}
