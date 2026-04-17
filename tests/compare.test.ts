import { compareCost, addCustomPricing } from '../src/compare'

describe('compareCost', () => {

  test('returns costs for all models', () => {
    const r = compareCost({ inputTokens: 1000, outputTokens: 500 })
    expect(Object.keys(r.costs).length).toBeGreaterThan(5)
  })

  test('cheapest is correct', () => {
    const r = compareCost({ inputTokens: 1000, outputTokens: 500 })
    const costs = r.sortedByCost()
    expect(r.cheapest).toBe(costs[0][0])
  })

  test('most expensive is correct', () => {
    const r = compareCost({ inputTokens: 1000, outputTokens: 500 })
    const costs = r.sortedByCost()
    expect(r.mostExpensive).toBe(costs[costs.length - 1][0])
  })

  test('savings calculation', () => {
    const r = compareCost({ inputTokens: 1000, outputTokens: 500 })
    const savings = r.savingsVs(
      'openai/gpt-4o',
      'openai/gpt-4o-mini'
    )
    expect(savings).toBeGreaterThan(0)
  })

  test('format table returns string', () => {
    const r = compareCost({ inputTokens: 1000, outputTokens: 500 })
    const table = r.formatTable()
    expect(typeof table).toBe('string')
    expect(table).toContain('gpt-4o')
  })

  test('filter by provider', () => {
    const r = compareCost({
      inputTokens: 1000,
      outputTokens: 500,
      providers: ['openai'],
    })
    for (const key of Object.keys(r.costs)) {
      expect(key.startsWith('openai/')).toBe(true)
    }
  })

  test('add custom pricing', () => {
    addCustomPricing('azure', 'gpt-4o-azure', 0.000003, 0.000012)
    const r = compareCost({ inputTokens: 1000, outputTokens: 500 })
    expect(r.costs['azure/gpt-4o-azure']).toBeDefined()
  })

  test('throws on negative tokens', () => {
    expect(() => compareCost({
      inputTokens: -1, outputTokens: 500
    })).toThrow()
  })
})
