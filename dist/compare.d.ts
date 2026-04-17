import { ComparisonResult } from './types';
export declare function compareCost(options: {
    inputTokens: number;
    outputTokens: number;
    providers?: string[];
    models?: string[];
}): ComparisonResult;
export declare function addCustomPricing(provider: string, model: string, inputCostPerToken: number, outputCostPerToken: number): void;
//# sourceMappingURL=compare.d.ts.map