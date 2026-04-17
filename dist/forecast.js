"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forecastMonthly = forecastMonthly;
exports.forecastFromRequests = forecastFromRequests;
function forecastMonthly(options) {
    const { daysElapsed, currentSpend, daysInMonth = 30, monthlyBudget, } = options;
    if (daysElapsed <= 0) {
        throw new Error('daysElapsed must be > 0');
    }
    if (currentSpend < 0) {
        throw new Error('currentSpend must be >= 0');
    }
    const clampedDays = Math.min(daysElapsed, daysInMonth);
    const dailyRate = currentSpend / clampedDays;
    const projectedMonthly = dailyRate * daysInMonth;
    let willExceedBudget = false;
    let daysUntilBudget;
    let percentOfBudget;
    if (monthlyBudget !== undefined && monthlyBudget > 0) {
        percentOfBudget = (currentSpend / monthlyBudget) * 100;
        if (projectedMonthly > monthlyBudget) {
            willExceedBudget = true;
            const remaining = monthlyBudget - currentSpend;
            if (remaining > 0 && dailyRate > 0) {
                daysUntilBudget = Math.floor(remaining / dailyRate);
            }
            else {
                daysUntilBudget = 0;
            }
        }
    }
    return {
        projectedMonthly: Math.round(projectedMonthly * 1e6) / 1e6,
        dailyRate: Math.round(dailyRate * 1e6) / 1e6,
        daysElapsed: clampedDays,
        currentSpend: Math.round(currentSpend * 1e6) / 1e6,
        monthlyBudget,
        willExceedBudget,
        daysUntilBudget,
        percentOfBudget,
    };
}
function forecastFromRequests(options) {
    const { requestsSoFar, spendSoFar, expectedMonthlyRequests } = options;
    if (requestsSoFar <= 0) {
        throw new Error('requestsSoFar must be > 0');
    }
    if (spendSoFar < 0) {
        throw new Error('spendSoFar must be >= 0');
    }
    const costPerRequest = spendSoFar / requestsSoFar;
    const projectedMonthly = costPerRequest * expectedMonthlyRequests;
    const daysElapsed = Math.max(1, Math.floor((requestsSoFar / expectedMonthlyRequests) * 30));
    return {
        projectedMonthly: Math.round(projectedMonthly * 1e6) / 1e6,
        dailyRate: Math.round((projectedMonthly / 30) * 1e6) / 1e6,
        daysElapsed,
        currentSpend: Math.round(spendSoFar * 1e6) / 1e6,
        willExceedBudget: false,
    };
}
//# sourceMappingURL=forecast.js.map