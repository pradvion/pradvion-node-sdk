import {
  forecastMonthly,
  forecastFromRequests,
} from '../src/forecast'

describe('forecastMonthly', () => {

  test('basic projection', () => {
    const r = forecastMonthly({
      daysElapsed: 15,
      currentSpend: 150,
    })
    expect(r.projectedMonthly).toBe(300)
    expect(r.dailyRate).toBe(10)
  })

  test('budget exceeded detection', () => {
    const r = forecastMonthly({
      daysElapsed: 15,
      currentSpend: 300,
      monthlyBudget: 500,
    })
    expect(r.willExceedBudget).toBe(true)
    expect(r.daysUntilBudget).toBeDefined()
  })

  test('budget not exceeded', () => {
    const r = forecastMonthly({
      daysElapsed: 15,
      currentSpend: 100,
      monthlyBudget: 500,
    })
    expect(r.willExceedBudget).toBe(false)
    expect(r.daysUntilBudget).toBeUndefined()
  })

  test('percent of budget calculated', () => {
    const r = forecastMonthly({
      daysElapsed: 10,
      currentSpend: 100,
      monthlyBudget: 500,
    })
    expect(r.percentOfBudget).toBe(20)
  })

  test('throws on invalid inputs', () => {
    expect(() => forecastMonthly({
      daysElapsed: 0, currentSpend: 100
    })).toThrow()
    expect(() => forecastMonthly({
      daysElapsed: 10, currentSpend: -1
    })).toThrow()
  })
})

describe('forecastFromRequests', () => {
  test('projects from request volume', () => {
    const r = forecastFromRequests({
      requestsSoFar: 1000,
      spendSoFar: 10,
      expectedMonthlyRequests: 10000,
    })
    expect(r.projectedMonthly).toBe(100)
  })
})
