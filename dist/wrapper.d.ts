/**
 * AI client wrappers for automatic tracking.
 * Privacy: Prompts and responses are NEVER captured.
 */
import { PradvionClient } from './client';
export declare class StreamingCostTracker {
    private readonly onToken?;
    private readonly callbackInterval;
    private readonly outRate;
    private readonly inputCost;
    private outputChunks;
    private estimatedCost;
    constructor(provider: string, model: string, inputTokens?: number, onToken?: ((cost: number) => void) | undefined, callbackInterval?: number);
    onChunk(): number;
    finalize(actualInputTokens?: number, actualOutputTokens?: number): number;
}
export declare function wrapOpenAI<T extends object>(client: T, pradvion: PradvionClient): T;
export declare function wrapAnthropic<T extends object>(client: T, pradvion: PradvionClient): T;
//# sourceMappingURL=wrapper.d.ts.map