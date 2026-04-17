export type OnExceedAction = 'raise' | 'warn' | 'ignore'

export class BudgetExceededError extends Error {
  constructor(
    public readonly customerId: string,
    public readonly limit: number,
    public readonly current: number,
  ) {
    super(
      `Budget exceeded for customer '${customerId}': ` +
      `$${current.toFixed(4)} / $${limit.toFixed(2)} monthly limit`
    )
    this.name = 'BudgetExceededError'
  }
}

interface BudgetEntry {
  limit: number
  onExceed: OnExceedAction
}

interface SpendEntry {
  spend: number
  month: string
}

export class BudgetTracker {
  private budgets = new Map<string, BudgetEntry>()
  private spend = new Map<string, SpendEntry>()

  setBudget(
    customerId: string,
    monthlyLimit: number,
    onExceed: OnExceedAction = 'warn',
  ): void {
    if (monthlyLimit <= 0) {
      throw new Error('monthlyLimit must be > 0')
    }
    this.budgets.set(customerId, { limit: monthlyLimit, onExceed })
  }

  removeBudget(customerId: string): void {
    this.budgets.delete(customerId)
    this.spend.delete(customerId)
  }

  record(customerId: string, actualCost: number): void {
    if (actualCost < 0) return
    const entry = this._getOrReset(customerId)
    entry.spend += actualCost
  }

  check(customerId: string, estimatedCost: number = 0): boolean {
    const budget = this.budgets.get(customerId)
    if (!budget) return true

    const entry = this._getOrReset(customerId)
    const projected = entry.spend + estimatedCost

    if (projected > budget.limit) {
      if (budget.onExceed === 'raise') {
        throw new BudgetExceededError(
          customerId, budget.limit, projected
        )
      } else if (budget.onExceed === 'warn') {
        console.warn(
          `[Pradvion] Budget exceeded for '${customerId}': ` +
          `$${projected.toFixed(4)} / $${budget.limit.toFixed(2)}`
        )
      }
      return false
    }
    return true
  }

  remaining(customerId: string): number | null {
    const budget = this.budgets.get(customerId)
    if (!budget) return null
    const entry = this._getOrReset(customerId)
    return budget.limit - entry.spend
  }

  getSpend(customerId: string): number {
    return this._getOrReset(customerId).spend
  }

  getBudget(customerId: string): number | null {
    return this.budgets.get(customerId)?.limit ?? null
  }

  summary(): Record<string, {
    limit: number
    spend: number
    remaining: number
    percentUsed: number
    onExceed: OnExceedAction
  }> {
    const result: Record<string, any> = {}
    for (const [id, budget] of this.budgets) {
      const entry = this._getOrReset(id)
      result[id] = {
        limit: budget.limit,
        spend: entry.spend,
        remaining: budget.limit - entry.spend,
        percentUsed: (entry.spend / budget.limit) * 100,
        onExceed: budget.onExceed,
      }
    }
    return result
  }

  private _getOrReset(customerId: string): SpendEntry {
    const currentMonth = new Date()
      .toISOString()
      .substring(0, 7)
    const entry = this.spend.get(customerId)
    if (!entry || entry.month !== currentMonth) {
      const fresh = { spend: 0, month: currentMonth }
      this.spend.set(customerId, fresh)
      return fresh
    }
    return entry
  }
}

let _defaultTracker: BudgetTracker | null = null

export function getBudgetTracker(): BudgetTracker {
  if (!_defaultTracker) {
    _defaultTracker = new BudgetTracker()
  }
  return _defaultTracker
}
