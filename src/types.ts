/**
 * All public TypeScript types for Pradvion Node SDK.
 */

export interface PradvionOptions {
  /** Your Pradvion API key (nx_live_...) */
  apiKey: string
  /** Pradvion API base URL. Default: production */
  baseUrl?: string
  /** HTTP request timeout in ms. Default: 5000 */
  timeout?: number
  /** Use background worker for async tracking. Default: true */
  asyncTracking?: boolean
  /** Register process exit handler for auto-flush. Default: true */
  autoFlush?: boolean
  /** Custom queue file path. Default: ~/.pradvion/queue.json */
  queuePath?: string
}

export interface TrackOptions {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  statusCode?: number
  cachedTokens?: number
  reasoningTokens?: number
  customerId?: string
  feature?: string
  team?: string
  department?: string
  environment?: string
  conversationId?: string
  requestId?: string
}

export interface TrackErrorOptions {
  provider: string
  model: string
  error: string
  latencyMs?: number
  statusCode?: number
  customerId?: string
  feature?: string
  team?: string
  department?: string
  environment?: string
  conversationId?: string
  requestId?: string
}

export interface SignalOptions {
  customerId: string
  event: string
  quantity?: number
  value?: number
  project?: string
  feature?: string
  team?: string
  environment?: string
  metadata?: Record<string, unknown>
}

export interface ContextOptions {
  customerId?: string
  project?: string
  feature?: string
  team?: string
  department?: string
  environment?: string
  conversationId?: string
}

export interface TrackPayload {
  request_id: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  cached_tokens: number
  reasoning_tokens: number
  latency_ms: number
  status_code: number
  timestamp: string
  customer_id_hash?: string
  feature?: string
  team?: string
  department?: string
  environment?: string
  conversation_id?: string
  error?: string
}

export interface SignalPayload {
  type: 'signal'
  signal_id: string
  event: string
  quantity: number
  timestamp: string
  customer_id_hash?: string
  value?: number
  project?: string
  feature?: string
  team?: string
  environment?: string
  metadata?: Record<string, unknown>
}

export type QueuePayload = TrackPayload | SignalPayload

export interface ForecastResult {
  projectedMonthly: number
  dailyRate: number
  daysElapsed: number
  currentSpend: number
  monthlyBudget?: number
  willExceedBudget: boolean
  daysUntilBudget?: number
  percentOfBudget?: number
}

export interface ComparisonResult {
  costs: Record<string, number>
  inputTokens: number
  outputTokens: number
  cheapest: string
  mostExpensive: string
  maxSavingsPct: number
  sortedByCost(): Array<[string, number]>
  savingsVs(current: string, compare: string): number | null
  formatTable(): string
}
