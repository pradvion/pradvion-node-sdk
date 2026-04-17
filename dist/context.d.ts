import { ContextOptions } from './types';
export declare function runWithContext<T>(ctx: ContextOptions, fn: () => Promise<T>): Promise<T>;
export declare function getCurrentContext(): ContextOptions;
export declare function setContext(ctx: ContextOptions): void;
export declare function clearContext(): void;
export declare function getEffectiveContext(): ContextOptions;
//# sourceMappingURL=context.d.ts.map