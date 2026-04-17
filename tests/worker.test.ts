import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { LocalQueue } from '../src/queue'
import { QueueWorker } from '../src/worker'

function makeWorker(overrides?: any) {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'pradvion-worker-test-')
  )
  const queue = new LocalQueue(
    path.join(tmpDir, 'queue.json')
  )
  const worker = new QueueWorker({
    queue,
    apiKey: 'test_key',
    baseUrl: 'https://pradvion-backend-production.up.railway.app',
    timeout: 5000,
    ...overrides,
  })
  return { worker, queue, tmpDir }
}

describe('QueueWorker', () => {

  test('start and stop without error', () => {
    const { worker, tmpDir } = makeWorker()
    worker.start()
    worker.stop()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('flushOnce with empty queue does nothing', async () => {
    const { worker, queue, tmpDir } = makeWorker()
    await worker.flushOnce()
    expect(queue.pendingCount()).toBe(0)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('routes signal to signal URL', async () => {
    const fetches: string[] = []
    const origFetch = global.fetch
    global.fetch = jest.fn().mockImplementation(
      async (url: string) => {
        fetches.push(url as string)
        return { status: 200 }
      }
    ) as any

    const { worker, queue, tmpDir } = makeWorker()
    queue.push({
      type: 'signal',
      signal_id: 'test-sig',
      event: 'test_event',
      quantity: 1,
      timestamp: new Date().toISOString(),
    })

    await worker.flushOnce()

    expect(fetches[0]).toContain('/sdk/signals')
    global.fetch = origFetch
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('routes ai request to ingest URL', async () => {
    const fetches: string[] = []
    const origFetch = global.fetch
    global.fetch = jest.fn().mockImplementation(
      async (url: string) => {
        fetches.push(url as string)
        return { status: 200 }
      }
    ) as any

    const { worker, queue, tmpDir } = makeWorker()
    queue.push({
      request_id: 'r1',
      provider: 'openai',
      model: 'gpt-4o',
      input_tokens: 100,
      output_tokens: 50,
      cached_tokens: 0,
      reasoning_tokens: 0,
      latency_ms: 1000,
      status_code: 200,
      timestamp: new Date().toISOString(),
    })

    await worker.flushOnce()

    expect(fetches[0]).toContain('/sdk/ingest')
    global.fetch = origFetch
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('marks entry as sent on 200', async () => {
    const origFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      status: 200
    }) as any

    const { worker, queue, tmpDir } = makeWorker()
    queue.push({
      request_id: 'r1',
      provider: 'openai',
      model: 'gpt-4o',
      input_tokens: 10,
      output_tokens: 5,
      cached_tokens: 0,
      reasoning_tokens: 0,
      latency_ms: 100,
      status_code: 200,
      timestamp: new Date().toISOString(),
    })

    await worker.flushOnce()
    expect(queue.pendingCount()).toBe(0)

    global.fetch = origFetch
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('marks entry as failed on 400', async () => {
    const origFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      status: 400
    }) as any

    const { worker, queue, tmpDir } = makeWorker()
    queue.push({} as any)
    await worker.flushOnce()

    // After 1 failed attempt entry still pending
    // (needs 5 attempts to be marked failed)
    expect(queue.pendingCount()).toBe(1)

    global.fetch = origFetch
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('retries on network error', async () => {
    const origFetch = global.fetch
    global.fetch = jest.fn().mockRejectedValue(
      new Error('network error')
    ) as any

    const { worker, queue, tmpDir } = makeWorker()
    queue.push({} as any)
    await worker.flushOnce()

    expect(queue.pendingCount()).toBe(1)

    global.fetch = origFetch
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('sends correct auth header', async () => {
    const headers: Record<string, string>[] = []
    const origFetch = global.fetch
    global.fetch = jest.fn().mockImplementation(
      async (_url: string, opts: any) => {
        headers.push(opts.headers)
        return { status: 200 }
      }
    ) as any

    const { worker, queue, tmpDir } = makeWorker()
    queue.push({
      request_id: 'r1',
      provider: 'openai',
      model: 'gpt-4o',
      input_tokens: 10,
      output_tokens: 5,
      cached_tokens: 0,
      reasoning_tokens: 0,
      latency_ms: 100,
      status_code: 200,
      timestamp: new Date().toISOString(),
    })

    await worker.flushOnce()

    expect(headers[0]['Authorization']).toBe('Bearer test_key')
    expect(headers[0]['X-Pradvion-SDK-Language']).toBe('nodejs')

    global.fetch = origFetch
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
