import {
  BudgetTracker,
  BudgetExceededError,
  getBudgetTracker,
} from '../src/budget'

describe('BudgetTracker', () => {
  let tracker: BudgetTracker

  beforeEach(() => {
    tracker = new BudgetTracker()
  })

  test('setBudget and check within budget', () => {
    tracker.setBudget('samsung', 500, 'raise')
    expect(tracker.check('samsung', 0.05)).toBe(true)
  })

  test('check exceeds budget raises error', () => {
    tracker.setBudget('samsung', 100, 'raise')
    tracker.record('samsung', 99)
    expect(() => tracker.check('samsung', 5)).toThrow(
      BudgetExceededError
    )
  })

  test('check exceeds budget warn returns false', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation()
    tracker.setBudget('samsung', 100, 'warn')
    tracker.record('samsung', 99)
    const result = tracker.check('samsung', 5)
    expect(result).toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('check exceeds budget ignore returns false', () => {
    tracker.setBudget('samsung', 100, 'ignore')
    tracker.record('samsung', 101)
    expect(tracker.check('samsung')).toBe(false)
  })

  test('no budget set always returns true', () => {
    expect(tracker.check('unknown')).toBe(true)
  })

  test('record updates spend', () => {
    tracker.setBudget('samsung', 500)
    tracker.record('samsung', 100)
    expect(tracker.getSpend('samsung')).toBe(100)
  })

  test('remaining returns correct value', () => {
    tracker.setBudget('samsung', 500)
    tracker.record('samsung', 200)
    expect(tracker.remaining('samsung')).toBe(300)
  })

  test('removeBudget clears limits', () => {
    tracker.setBudget('samsung', 100, 'raise')
    tracker.removeBudget('samsung')
    expect(tracker.check('samsung', 999)).toBe(true)
  })

  test('summary returns all customers', () => {
    tracker.setBudget('samsung', 500)
    tracker.setBudget('tesla', 200)
    tracker.record('samsung', 100)
    const s = tracker.summary()
    expect(s.samsung.spend).toBe(100)
    expect(s.tesla.spend).toBe(0)
  })

  test('invalid limit throws', () => {
    expect(() => tracker.setBudget('x', 0)).toThrow()
    expect(() => tracker.setBudget('x', -1)).toThrow()
  })

  test('getBudgetTracker returns singleton', () => {
    const t1 = getBudgetTracker()
    const t2 = getBudgetTracker()
    expect(t1).toBe(t2)
  })
})
