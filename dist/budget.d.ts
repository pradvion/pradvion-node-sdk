export type OnExceedAction = 'raise' | 'warn' | 'ignore';
export declare class BudgetExceededError extends Error {
    readonly customerId: string;
    readonly limit: number;
    readonly current: number;
    constructor(customerId: string, limit: number, current: number);
}
export declare class BudgetTracker {
    private budgets;
    private spend;
    setBudget(customerId: string, monthlyLimit: number, onExceed?: OnExceedAction): void;
    removeBudget(customerId: string): void;
    record(customerId: string, actualCost: number): void;
    check(customerId: string, estimatedCost?: number): boolean;
    remaining(customerId: string): number | null;
    getSpend(customerId: string): number;
    getBudget(customerId: string): number | null;
    summary(): Record<string, {
        limit: number;
        spend: number;
        remaining: number;
        percentUsed: number;
        onExceed: OnExceedAction;
    }>;
    private _getOrReset;
}
export declare function getBudgetTracker(): BudgetTracker;
//# sourceMappingURL=budget.d.ts.map