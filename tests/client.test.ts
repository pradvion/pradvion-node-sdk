import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { PradvionClient } from '../src/client'

describe('PradvionClient', () => {
  let tmpDir: string
  let client: PradvionClient

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'pradvion-test-')
    )
    client = new PradvionClient({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })
  })

  afterEach(async () => {
    await client.shutdown()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('track queues event', () => {
    client.track({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 1200,
    })
    expect(client.queue.pendingCount()).toBe(1)
  })

  test('track hashes customer id', () => {
    client.track({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 1200,
      customerId: 'samsung_001',
    })
    const pending = client.queue.getPending()
    expect(pending[0].payload).not.toHaveProperty('customerId')
    expect(pending[0].payload).toHaveProperty('customer_id_hash')
  })

  test('trackError queues error event', () => {
    client.trackError({
      provider: 'openai',
      model: 'gpt-4o',
      error: 'rate_limit',
      statusCode: 429,
    })
    expect(client.queue.pendingCount()).toBe(1)
    const pending = client.queue.getPending()
    expect((pending[0].payload as any).status_code).toBe(429)
  })

  test('trackBatch queues multiple events', () => {
    client.trackBatch([
      {
        provider: 'openai', model: 'gpt-4o',
        inputTokens: 100, outputTokens: 50, latencyMs: 100
      },
      {
        provider: 'anthropic', model: 'claude-3-haiku-20240307',
        inputTokens: 200, outputTokens: 100, latencyMs: 200
      },
    ])
    expect(client.queue.pendingCount()).toBe(2)
  })

  test('signal queues signal event', () => {
    client.signal({
      customerId: 'samsung',
      event: 'email_sent',
      quantity: 5,
      value: 0.25,
    })
    expect(client.queue.pendingCount()).toBe(1)
    const pending = client.queue.getPending()
    expect((pending[0].payload as any).type).toBe('signal')
  })

  test('signalBatch queues multiple signals', () => {
    client.signalBatch([
      { customerId: 'x', event: 'email_sent' },
      { customerId: 'x', event: 'meeting_booked', value: 150 },
    ])
    expect(client.queue.pendingCount()).toBe(2)
  })

  test('negative tokens clamped to zero', () => {
    client.track({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: -100,
      outputTokens: -50,
      latencyMs: 100,
    })
    const pending = client.queue.getPending()
    expect((pending[0].payload as any).input_tokens).toBe(0)
    expect((pending[0].payload as any).output_tokens).toBe(0)
  })
})
