/**
 * Persistent JSON file queue for zero data loss.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { QueuePayload } from './types'

interface QueueEntry {
  id: number
  payload: QueuePayload
  attempts: number
  createdAt: string
  lastAttemptAt?: string
  status: 'pending' | 'sent' | 'failed'
}

interface QueueStore {
  nextId: number
  entries: QueueEntry[]
}

export class LocalQueue {
  private readonly queuePath: string
  private readonly tmpPath: string
  private nextId: number = 1
  private lock: boolean = false

  constructor(queuePath?: string) {
    const defaultDir = path.join(os.homedir(), '.pradvion')
    const defaultPath = path.join(defaultDir, 'queue.json')
    this.queuePath = queuePath ?? defaultPath
    this.tmpPath = this.queuePath + '.tmp'
    this._initQueue()
  }

  private _initQueue(): void {
    const dir = path.dirname(this.queuePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    if (!fs.existsSync(this.queuePath)) {
      this._write({ nextId: 1, entries: [] })
    } else {
      try {
        const store = this._read()
        this.nextId = store.nextId
      } catch {
        this._write({ nextId: 1, entries: [] })
      }
    }
  }

  push(payload: QueuePayload): number {
    const store = this._read()
    const id = store.nextId++
    this.nextId = store.nextId

    store.entries.push({
      id,
      payload,
      attempts: 0,
      createdAt: new Date().toISOString(),
      status: 'pending',
    })

    if (store.entries.length > 10000) {
      store.entries = [
        ...store.entries.filter(e => e.status === 'pending'),
        ...store.entries
          .filter(e => e.status !== 'pending')
          .slice(-1000)
      ]
    }

    this._write(store)
    return id
  }

  getPending(limit: number = 20): QueueEntry[] {
    const store = this._read()
    return store.entries
      .filter(e => e.status === 'pending')
      .slice(0, limit)
  }

  markSent(id: number): void {
    this._update(id, {
      status: 'sent',
      lastAttemptAt: new Date().toISOString(),
    })
  }

  markFailed(id: number): void {
    const store = this._read()
    const entry = store.entries.find(e => e.id === id)
    if (!entry) return

    entry.attempts += 1
    entry.lastAttemptAt = new Date().toISOString()

    if (entry.attempts >= 5) {
      entry.status = 'failed'
    }

    this._write(store)
  }

  pendingCount(): number {
    const store = this._read()
    return store.entries.filter(e => e.status === 'pending').length
  }

  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    const store = this._read()
    const cutoff = Date.now() - maxAgeMs
    store.entries = store.entries.filter(e => {
      if (e.status !== 'sent') return true
      return new Date(e.createdAt).getTime() > cutoff
    })
    this._write(store)
  }

  private _read(): QueueStore {
    try {
      const content = fs.readFileSync(this.queuePath, 'utf-8')
      return JSON.parse(content) as QueueStore
    } catch {
      return { nextId: this.nextId, entries: [] }
    }
  }

  private _write(store: QueueStore): void {
    const content = JSON.stringify(store, null, 0)
    fs.writeFileSync(this.tmpPath, content, 'utf-8')
    fs.renameSync(this.tmpPath, this.queuePath)
  }

  private _update(
    id: number,
    updates: Partial<QueueEntry>
  ): void {
    const store = this._read()
    const entry = store.entries.find(e => e.id === id)
    if (entry) {
      Object.assign(entry, updates)
      this._write(store)
    }
  }
}
