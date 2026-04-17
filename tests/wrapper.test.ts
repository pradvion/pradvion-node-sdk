import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { PradvionClient } from '../src/client'
import { wrapOpenAI, wrapAnthropic, StreamingCostTracker } from '../src/wrapper'

function makeClient(): { client: PradvionClient; tmpDir: string } {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pradvion-wrapper-test-')
  )
  const client = new PradvionClient({
    apiKey: 'test_key',
    asyncTracking: false,
    queuePath: path.join(tmpDir, 'queue.json'),
  })
  return { client, tmpDir }
}

describe('StreamingCostTracker', () => {

  test('known model has rates', () => {
    const t = new StreamingCostTracker('openai', 'gpt-4o', 1000)
    expect(t.onChunk()).toBeGreaterThan(0)
  })

  test('unknown model has zero rates', () => {
    const t = new StreamingCostTracker('unknown', 'unknown-model', 100)
    const cost = t.onChunk()
    expect(cost).toBe(0)
  })

  test('input cost pre-computed', () => {
    const t = new StreamingCostTracker('openai', 'gpt-4o', 1000)
    // $0.0000025 * 1000 = $0.0025 input cost
    // After 1 chunk, output cost adds tiny amount
    const cost = t.onChunk()
    expect(cost).toBeGreaterThan(0.0025)
  })

  test('chunk count increments', () => {
    const t = new StreamingCostTracker('openai', 'gpt-4o-mini', 0)
    t.onChunk()
    t.onChunk()
    t.onChunk()
    const c1 = t.onChunk()
    const c2 = t.onChunk()
    expect(c2).toBeGreaterThan(c1)
  })

  test('callback fires at interval', () => {
    const calls: number[] = []
    const t = new StreamingCostTracker(
      'openai', 'gpt-4o', 0,
      (cost) => calls.push(cost),
      3
    )
    for (let i = 0; i < 6; i++) t.onChunk()
    expect(calls.length).toBe(2)
  })

  test('callback not fired before interval', () => {
    const calls: number[] = []
    const t = new StreamingCostTracker(
      'openai', 'gpt-4o', 0,
      (cost) => calls.push(cost),
      10
    )
    for (let i = 0; i < 5; i++) t.onChunk()
    expect(calls.length).toBe(0)
  })

  test('finalize uses actual tokens', () => {
    const t = new StreamingCostTracker('openai', 'gpt-4o', 0)
    const final = t.finalize(1000, 500)
    // $0.0000025*1000 + $0.00001*500 = $0.0075
    expect(final).toBeCloseTo(0.0075, 4)
  })

  test('finalize falls back to estimate when no actual tokens', () => {
    const t = new StreamingCostTracker('openai', 'gpt-4o-mini', 100)
    for (let i = 0; i < 5; i++) t.onChunk()
    const estimated = (t as any)['estimatedCost']
    const final = t.finalize(0, 0)
    expect(final).toBe(estimated)
  })

  test('callback error does not throw', () => {
    const t = new StreamingCostTracker(
      'openai', 'gpt-4o', 0,
      () => { throw new Error('callback error') },
      1
    )
    expect(() => t.onChunk()).not.toThrow()
  })

  test('finalize fires final callback', () => {
    const calls: number[] = []
    const t = new StreamingCostTracker(
      'openai', 'gpt-4o', 0,
      (cost) => calls.push(cost),
      100
    )
    t.finalize(500, 250)
    expect(calls.length).toBe(1)
  })

  test('all openai models have rates', () => {
    const models = [
      'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo',
      'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'
    ]
    for (const model of models) {
      const t = new StreamingCostTracker('openai', model, 0)
      t.onChunk()
      expect((t as any)['estimatedCost']).toBeGreaterThan(0)
    }
  })

  test('all anthropic models have rates', () => {
    const models = [
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
      'claude-3-opus-20240229',
    ]
    for (const model of models) {
      const t = new StreamingCostTracker('anthropic', model, 0)
      t.onChunk()
      expect((t as any)['estimatedCost']).toBeGreaterThan(0)
    }
  })
})

describe('wrapOpenAI', () => {

  test('wraps client and returns proxy', () => {
    const { client, tmpDir } = makeClient()
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }
    const wrapped = wrapOpenAI(mockOpenAI, client)
    expect(wrapped).toBeDefined()
    expect(wrapped.chat).toBeDefined()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('tracks non-streaming call', async () => {
    const { client, tmpDir } = makeClient()

    const mockResponse = {
      id: 'test-id',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        prompt_tokens_details: { cached_tokens: 0 }
      },
      choices: [{ message: { content: 'Hello' } }]
    }

    const mockCreate = jest.fn().mockResolvedValue(mockResponse)
    const mockOpenAI = {
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }

    const wrapped = wrapOpenAI(mockOpenAI, client)
    await (wrapped as any).chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hi' }]
    })

    expect(client.queue.pendingCount()).toBe(1)
    const pending = client.queue.getPending()
    const payload = pending[0].payload as any
    expect(payload.provider).toBe('openai')
    expect(payload.model).toBe('gpt-4o')
    expect(payload.input_tokens).toBe(100)
    expect(payload.output_tokens).toBe(50)
    expect(payload.status_code).toBe(200)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('tracks error and re-throws', async () => {
    const { client, tmpDir } = makeClient()

    const mockError = new Error('rate limit') as any
    mockError.status = 429

    const mockCreate = jest.fn().mockRejectedValue(mockError)
    const mockOpenAI = {
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }

    const wrapped = wrapOpenAI(mockOpenAI, client)

    await expect(
      (wrapped as any).chat.completions.create({
        model: 'gpt-4o',
        messages: []
      })
    ).rejects.toThrow('rate limit')

    expect(client.queue.pendingCount()).toBe(1)
    const pending = client.queue.getPending()
    const payload = pending[0].payload as any
    expect(payload.status_code).toBe(429)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('passes through non-chat properties', () => {
    const { client, tmpDir } = makeClient()
    const mockOpenAI = {
      chat: { completions: { create: jest.fn() } },
      models: { list: jest.fn() },
      apiKey: 'test'
    }
    const wrapped = wrapOpenAI(mockOpenAI, client) as any
    expect(wrapped.models).toBe(mockOpenAI.models)
    expect(wrapped.apiKey).toBe('test')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('removes onToken from params before calling OpenAI', async () => {
    const { client, tmpDir } = makeClient()

    const mockCreate = jest.fn().mockResolvedValue({
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    })
    const mockOpenAI = {
      chat: { completions: { create: mockCreate } }
    }

    const wrapped = wrapOpenAI(mockOpenAI, client)
    await (wrapped as any).chat.completions.create({
      model: 'gpt-4o',
      messages: [],
      onToken: jest.fn()
    })

    const calledWith = mockCreate.mock.calls[0][0]
    expect(calledWith.onToken).toBeUndefined()

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('tracks streaming call', async () => {
    const { client, tmpDir } = makeClient()

    async function* mockStream() {
      yield { choices: [{ delta: { content: 'Hello' } }] }
      yield { choices: [{ delta: { content: ' world' } }] }
      yield {
        choices: [{ delta: {} }],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      }
    }

    const mockCreate = jest.fn().mockResolvedValue(mockStream())
    const mockOpenAI = {
      chat: { completions: { create: mockCreate } }
    }

    const wrapped = wrapOpenAI(mockOpenAI, client)
    const stream = await (wrapped as any).chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [],
      stream: true,
    })

    for await (const _chunk of stream) {
      // consume stream
    }

    await new Promise(r => setTimeout(r, 50))

    expect(client.queue.pendingCount()).toBe(1)
    const pending = client.queue.getPending()
    const payload = pending[0].payload as any
    expect(payload.provider).toBe('openai')
    expect(payload.model).toBe('gpt-4o-mini')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

describe('wrapAnthropic', () => {

  test('wraps client and returns proxy', () => {
    const { client, tmpDir } = makeClient()
    const mockAnthropic = {
      messages: { create: jest.fn() }
    }
    const wrapped = wrapAnthropic(mockAnthropic, client)
    expect(wrapped).toBeDefined()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('tracks anthropic call', async () => {
    const { client, tmpDir } = makeClient()

    const mockResponse = {
      usage: {
        input_tokens: 200,
        output_tokens: 100,
      }
    }

    const mockCreate = jest.fn().mockResolvedValue(mockResponse)
    const mockAnthropic = {
      messages: { create: mockCreate }
    }

    const wrapped = wrapAnthropic(mockAnthropic, client)
    await (wrapped as any).messages.create({
      model: 'claude-3-haiku-20240307',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 100,
    })

    expect(client.queue.pendingCount()).toBe(1)
    const pending = client.queue.getPending()
    const payload = pending[0].payload as any
    expect(payload.provider).toBe('anthropic')
    expect(payload.model).toBe('claude-3-haiku-20240307')
    expect(payload.input_tokens).toBe(200)
    expect(payload.output_tokens).toBe(100)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('tracks anthropic error', async () => {
    const { client, tmpDir } = makeClient()

    const mockError = new Error('overloaded') as any
    mockError.status = 529

    const mockCreate = jest.fn().mockRejectedValue(mockError)
    const mockAnthropic = {
      messages: { create: mockCreate }
    }

    const wrapped = wrapAnthropic(mockAnthropic, client)

    await expect(
      (wrapped as any).messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [],
        max_tokens: 10
      })
    ).rejects.toThrow()

    expect(client.queue.pendingCount()).toBe(1)
    const pending = client.queue.getPending()
    expect((pending[0].payload as any).status_code).toBe(529)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('passes through non-messages properties', () => {
    const { client, tmpDir } = makeClient()
    const mockAnthropic = {
      messages: { create: jest.fn() },
      apiKey: 'test-key',
    }
    const wrapped = wrapAnthropic(mockAnthropic, client) as any
    expect(wrapped.apiKey).toBe('test-key')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
