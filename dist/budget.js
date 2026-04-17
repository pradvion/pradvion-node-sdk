"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetTracker = exports.BudgetExceededError = void 0;
exports.getBudgetTracker = getBudgetTracker;
class BudgetExceededError extends Error {
    customerId;
    limit;
    current;
    constructor(customerId, limit, current) {
        super(`Budget exceeded for customer '${customerId}': ` +
            `$${current.toFixed(4)} / $${limit.toFixed(2)} monthly limit`);
        this.customerId = customerId;
        this.limit = limit;
        this.current = current;
        this.name = 'BudgetExceededError';
    }
}
exports.BudgetExceededError = BudgetExceededError;
class BudgetTracker {
    budgets = new Map();
    spend = new Map();
    setBudget(customerId, monthlyLimit, onExceed = 'warn') {
        if (monthlyLimit <= 0) {
            throw new Error('monthlyLimit must be > 0');
        }
        this.budgets.set(customerId, { limit: monthlyLimit, onExceed });
    }
    removeBudget(customerId) {
        this.budgets.delete(customerId);
        this.spend.delete(customerId);
    }
    record(customerId, actualCost) {
        if (actualCost < 0)
            return;
        const entry = this._getOrReset(customerId);
        entry.spend += actualCost;
    }
    check(customerId, estimatedCost = 0) {
        const budget = this.budgets.get(customerId);
        if (!budget)
            return true;
        const entry = this._getOrReset(customerId);
        const projected = entry.spend + estimatedCost;
        if (projected > budget.limit) {
            if (budget.onExceed === 'raise') {
                throw new BudgetExceededError(customerId, budget.limit, projected);
            }
            else if (budget.onExceed === 'warn') {
                console.warn(`[Pradvion] Budget exceeded for '${customerId}': ` +
                    `$${projected.toFixed(4)} / $${budget.limit.toFixed(2)}`);
            }
            return false;
        }
        return true;
    }
    remaining(customerId) {
        const budget = this.budgets.get(customerId);
        if (!budget)
            return null;
        const entry = this._getOrReset(customerId);
        return budget.limit - entry.spend;
    }
    getSpend(customerId) {
        return this._getOrReset(customerId).spend;
    }
    getBudget(customerId) {
        return this.budgets.get(customerId)?.limit ?? null;
    }
    summary() {
        const result = {};
        for (const [id, budget] of this.budgets) {
            const entry = this._getOrReset(id);
            result[id] = {
                limit: budget.limit,
                spend: entry.spend,
                remaining: budget.limit - entry.spend,
                percentUsed: (entry.spend / budget.limit) * 100,
                onExceed: budget.onExceed,
            };
        }
        return result;
    }
    _getOrReset(customerId) {
        const currentMonth = new Date()
            .toISOString()
            .substring(0, 7);
        const entry = this.spend.get(customerId);
        if (!entry || entry.month !== currentMonth) {
            const fresh = { spend: 0, month: currentMonth };
            this.spend.set(customerId, fresh);
            return fresh;
        }
        return entry;
    }
}
exports.BudgetTracker = BudgetTracker;
let _defaultTracker = null;
function getBudgetTracker() {
    if (!_defaultTracker) {
        _defaultTracker = new BudgetTracker();
    }
    return _defaultTracker;
}
//# sourceMappingURL=budget.js.map