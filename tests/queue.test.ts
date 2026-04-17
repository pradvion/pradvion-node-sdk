import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { LocalQueue } from '../src/queue'

describe('LocalQueue', () => {
  let tmpDir: string
  let queue: LocalQueue

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'pradvion-test-')
    )
    queue = new LocalQueue(path.join(tmpDir, 'queue.json'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('push adds pending entry', () => {
    const id = queue.push({
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
    expect(id).toBe(1)
    expect(queue.pendingCount()).toBe(1)
  })

  test('getPending returns pending entries', () => {
    queue.push({} as any)
    queue.push({} as any)
    const pending = queue.getPending()
    expect(pending.length).toBe(2)
  })

  test('markSent removes from pending count', () => {
    const id = queue.push({} as any)
    queue.markSent(id)
    expect(queue.pendingCount()).toBe(0)
  })

  test('markFailed keeps pending until 5 attempts', () => {
    const id = queue.push({} as any)
    for (let i = 0; i < 4; i++) {
      queue.markFailed(id)
      expect(queue.pendingCount()).toBe(1)
    }
    queue.markFailed(id)
    expect(queue.pendingCount()).toBe(0)
  })

  test('survives restart — loads existing queue', () => {
    const qPath = path.join(tmpDir, 'queue.json')
    const q1 = new LocalQueue(qPath)
    q1.push({} as any)
    q1.push({} as any)

    const q2 = new LocalQueue(qPath)
    expect(q2.pendingCount()).toBe(2)
  })

  test('atomic write — tmp file renamed', () => {
    const qPath = path.join(tmpDir, 'queue.json')
    queue.push({} as any)
    expect(fs.existsSync(qPath)).toBe(true)
    expect(
      fs.existsSync(qPath + '.tmp')
    ).toBe(false)
  })
})
