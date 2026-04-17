import { ForecastResult } from './types';
export declare function forecastMonthly(options: {
    daysElapsed: number;
    currentSpend: number;
    daysInMonth?: number;
    monthlyBudget?: number;
}): ForecastResult;
export declare function forecastFromRequests(options: {
    requestsSoFar: number;
    spendSoFar: number;
    expectedMonthlyRequests: number;
}): ForecastResult;
//# sourceMappingURL=forecast.d.ts.map