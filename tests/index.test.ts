import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

let pradvion: any
let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pradvion-index-test-')
  )
  jest.resetModules()
  pradvion = require('../src/index')
})

afterEach(async () => {
  try {
    await pradvion.shutdown()
  } catch {}
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('pradvion public API', () => {

  test('getClient throws before init', () => {
    expect(() => pradvion.getClient()).toThrow(
      'Pradvion not initialized'
    )
  })

  test('init creates client', () => {
    pradvion.init({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })
    expect(() => pradvion.getClient()).not.toThrow()
  })

  test('monitor returns wrapped client', () => {
    pradvion.init({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })
    const mockOpenAI = {
      chat: { completions: { create: jest.fn() } }
    }
    const wrapped = pradvion.monitor(mockOpenAI)
    expect(wrapped).toBeDefined()
  })

  test('monitor warns if not initialized', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation()
    const mockClient = { chat: { completions: { create: jest.fn() } } }
    const result = pradvion.monitor(mockClient)
    expect(result).toBe(mockClient)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('monitor warns for unknown client', () => {
    pradvion.init({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })
    const spy = jest.spyOn(console, 'warn').mockImplementation()
    pradvion.monitor({ unknown: true })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('track queues event', () => {
    pradvion.init({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })
    pradvion.track({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 1000,
    })
    expect(pradvion.getClient().queue.pendingCount()).toBe(1)
  })

  test('signal queues signal event', () => {
    pradvion.init({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })
    pradvion.signal({
      customerId: 'samsung',
      event: 'email_sent',
      quantity: 5,
    })
    expect(pradvion.getClient().queue.pendingCount()).toBe(1)
  })

  test('newConversation returns valid id', () => {
    const id = pradvion.newConversation()
    expect(id).toMatch(/^conv_[0-9a-f]{12}$/)
  })

  test('trace propagates context', async () => {
    pradvion.init({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })

    let capturedCustomerId: string | undefined

    await pradvion.trace('samsung_001', async () => {
      pradvion.track({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 10,
        outputTokens: 5,
        latencyMs: 100,
      })
      const { getEffectiveContext } = require('../src/context')
      capturedCustomerId = getEffectiveContext().customerId
    })

    expect(capturedCustomerId).toBe('samsung_001')
  })

  test('flush resolves without error', async () => {
    pradvion.init({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })
    await expect(pradvion.flush()).resolves.not.toThrow()
  })

  test('version is defined', () => {
    expect(pradvion.SDK_VERSION).toBeDefined()
    expect(typeof pradvion.SDK_VERSION).toBe('string')
  })

  test('context() runs fn with context', async () => {
    pradvion.init({
      apiKey: 'test_key',
      asyncTracking: false,
      queuePath: path.join(tmpDir, 'queue.json'),
    })
    let result = ''
    await pradvion.context(
      { customerId: 'test_customer' },
      async () => { result = 'ran' }
    )
    expect(result).toBe('ran')
  })
})
