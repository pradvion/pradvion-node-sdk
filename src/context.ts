import { AsyncLocalStorage } from 'async_hooks'
import { ContextOptions } from './types'

const storage = new AsyncLocalStorage<ContextOptions>()

export async function runWithContext<T>(
  ctx: ContextOptions,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(ctx, fn)
}

export function getCurrentContext(): ContextOptions {
  return storage.getStore() ?? {}
}

export function setContext(ctx: ContextOptions): void {
  _manualContext = { ..._manualContext, ...ctx }
}

export function clearContext(): void {
  _manualContext = {}
}

export function getEffectiveContext(): ContextOptions {
  const asyncCtx = storage.getStore()
  if (asyncCtx) return asyncCtx
  return _manualContext
}

let _manualContext: ContextOptions = {}
