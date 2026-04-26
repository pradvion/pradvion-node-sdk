/**
 * AI client wrappers for automatic tracking.
 * Privacy: Prompts and responses are NEVER captured.
 */
import { PradvionClient } from './client';
export declare function wrapOpenAI<T extends object>(client: T, pradvion: PradvionClient): T;
export declare function wrapAnthropic<T extends object>(client: T, pradvion: PradvionClient): T;
//# sourceMappingURL=wrapper.d.ts.map