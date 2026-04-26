import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { PradvionClient } from '../src/client'
import { PradvionCallbackHandler } from '../src/integrations/langchain'
import { PradvionSpanExporter } from '../src/integrations/otel'

function makeClient() {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pradvion-int-test-')
  )
  const client = new PradvionClient({
    apiKey: 'test_key',
    asyncTracking: false,
    queuePath: path.join(tmpDir, 'queue.json'),
  })
  return { client, tmpDir }
}

describe('PradvionCallbackHandler', () => {

  test('creates with options', () => {
    const handler = new PradvionCallbackHandler({
      customerId: 'samsung',
      feature: 'chatbot',
    })
    expect(handler).toBeDefined()
    expect(handler.raiseError).toBe(false)
  })

  test('handleLLMStart records start time', async () => {
    const { client, tmpDir } = makeClient()
    const handler = new PradvionCallbackHandler({
      pradvionClient: client
    })
    await handler.handleLLMStart(
      { id: ['langchain', 'chat_models', 'openai', 'ChatOpenAI'] },
      ['Hello'],
      'run-123'
    )
    expect((handler as any).startTimes.has('run-123')).toBe(true)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('handleLLMEnd tracks to pradvion', async () => {
    const { client, tmpDir } = makeClient()
    const handler = new PradvionCallbackHandler({
      pradvionClient: client,
      customerId: 'samsung',
    })

    await handler.handleLLMStart(
      { id: ['ChatOpenAI'] },
      ['Hello'],
      'run-456'
    )

    await handler.handleLLMEnd(
      {
        llm_output: {
          token_usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
          }
        }
      },
      'run-456'
    )

    expect(client.queue.pendingCount()).toBe(1)
    const pending = client.queue.getPending()
    const payload = pending[0].payload as any
    expect(payload.input_tokens).toBe(100)
    expect(payload.output_tokens).toBe(50)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('handleLLMEnd skips zero token response', async () => {
    const { client, tmpDir } = makeClient()
    const handler = new PradvionCallbackHandler({
      pradvionClient: client
    })

    await handler.handleLLMStart({}, [], 'run-789')
    await handler.handleLLMEnd({ llm_output: {} }, 'run-789')

    expect(client.queue.pendingCount()).toBe(0)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('handleLLMError cleans up state', async () => {
    const { client, tmpDir } = makeClient()
    const handler = new PradvionCallbackHandler({
      pradvionClient: client
    })

    await handler.handleLLMStart({}, [], 'run-err')
    await handler.handleLLMError(new Error('test'), 'run-err')

    expect((handler as any).startTimes.has('run-err')).toBe(false)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('handleChatModelStart records start time', async () => {
    const { client, tmpDir } = makeClient()
    const handler = new PradvionCallbackHandler({
      pradvionClient: client
    })
    await handler.handleChatModelStart(
      { id: ['ChatOpenAI'] },
      [[]],
      'run-chat'
    )
    expect((handler as any).startTimes.has('run-chat')).toBe(true)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('no-op handlers do not throw', async () => {
    const handler = new PradvionCallbackHandler()
    await expect(handler.handleChainStart()).resolves.not.toThrow()
    await expect(handler.handleChainEnd()).resolves.not.toThrow()
    await expect(handler.handleToolStart()).resolves.not.toThrow()
    await expect(handler.handleToolEnd()).resolves.not.toThrow()
    await expect(handler.handleAgentAction()).resolves.not.toThrow()
    await expect(handler.handleAgentEnd()).resolves.not.toThrow()
  })
})

describe('PradvionSpanExporter', () => {

  test('creates exporter', () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)
    expect(exporter).toBeDefined()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('export returns SUCCESS (0)', () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)
    const result = exporter.export([])
    expect(result).toBe(0)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('processes LLM span with token data', () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)

    const span = {
      attributes: {
        'gen_ai.system': 'openai',
        'gen_ai.request.model': 'gpt-4o',
        'gen_ai.usage.prompt_tokens': 100,
        'gen_ai.usage.completion_tokens': 50,
      },
      startTime: 1000000000,
      endTime: 2000000000,
      status: { code: 1 },
    }

    exporter.export([span])
    expect(client.queue.pendingCount()).toBe(1)

    const pending = client.queue.getPending()
    const payload = pending[0].payload as any
    expect(payload.provider).toBe('openai')
    expect(payload.input_tokens).toBe(100)
    expect(payload.output_tokens).toBe(50)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('skips non-LLM spans', () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)

    const span = {
      attributes: {
        'http.method': 'GET',
        'http.url': 'https://example.com',
      },
      startTime: 0,
      endTime: 0,
    }

    exporter.export([span])
    expect(client.queue.pendingCount()).toBe(0)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('skips spans with zero tokens', () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)

    const span = {
      attributes: {
        'gen_ai.system': 'openai',
        'gen_ai.request.model': 'gpt-4o',
      },
      startTime: 0,
      endTime: 0,
    }

    exporter.export([span])
    expect(client.queue.pendingCount()).toBe(0)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('normalizes provider names', () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)

    const span = {
      attributes: {
        'gen_ai.system': 'OpenAI',
        'gen_ai.usage.prompt_tokens': 50,
        'gen_ai.usage.completion_tokens': 25,
      },
      startTime: 0,
      endTime: 0,
    }

    exporter.export([span])
    const pending = client.queue.getPending()
    expect((pending[0].payload as any).provider).toBe('openai')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('status code ERROR maps to 500', () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)

    const span = {
      attributes: {
        'gen_ai.system': 'openai',
        'gen_ai.usage.prompt_tokens': 10,
        'gen_ai.usage.completion_tokens': 5,
      },
      startTime: 0,
      endTime: 0,
      status: { code: 2 }, // ERROR
    }

    exporter.export([span])
    const pending = client.queue.getPending()
    expect((pending[0].payload as any).status_code).toBe(500)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('shutdown resolves', async () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)
    await expect(exporter.shutdown()).resolves.not.toThrow()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('forceFlush resolves', async () => {
    const { client, tmpDir } = makeClient()
    const exporter = new PradvionSpanExporter(client)
    await expect(exporter.forceFlush()).resolves.not.toThrow()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
