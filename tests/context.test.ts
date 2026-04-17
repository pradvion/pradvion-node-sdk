import {
  runWithContext,
  getCurrentContext,
  getEffectiveContext,
  setContext,
  clearContext,
} from '../src/context'

describe('Context', () => {

  afterEach(() => {
    clearContext()
  })

  test('runWithContext propagates context', async () => {
    let captured: any = null
    await runWithContext(
      { customerId: 'samsung' },
      async () => {
        captured = getCurrentContext()
      }
    )
    expect(captured?.customerId).toBe('samsung')
  })

  test('context not visible outside runWithContext', async () => {
    await runWithContext(
      { customerId: 'samsung' },
      async () => {}
    )
    const ctx = getCurrentContext()
    expect(ctx.customerId).toBeUndefined()
  })

  test('nested contexts work correctly', async () => {
    await runWithContext(
      { customerId: 'outer' },
      async () => {
        await runWithContext(
          { customerId: 'inner', feature: 'chat' },
          async () => {
            const ctx = getCurrentContext()
            expect(ctx.customerId).toBe('inner')
            expect(ctx.feature).toBe('chat')
          }
        )
        const ctx = getCurrentContext()
        expect(ctx.customerId).toBe('outer')
      }
    )
  })

  test('setContext and getEffectiveContext', () => {
    setContext({ customerId: 'manual' })
    const ctx = getEffectiveContext()
    expect(ctx.customerId).toBe('manual')
  })

  test('clearContext removes manual context', () => {
    setContext({ customerId: 'manual' })
    clearContext()
    const ctx = getEffectiveContext()
    expect(ctx.customerId).toBeUndefined()
  })

  test('AsyncLocalStorage takes priority over manual', async () => {
    setContext({ customerId: 'manual' })
    await runWithContext(
      { customerId: 'async' },
      async () => {
        const ctx = getEffectiveContext()
        expect(ctx.customerId).toBe('async')
      }
    )
  })
})
