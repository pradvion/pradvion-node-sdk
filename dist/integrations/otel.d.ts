import { PradvionClient } from '../client';
export declare class PradvionSpanExporter {
    private readonly pradvionClient?;
    constructor(pradvionClient?: PradvionClient | undefined);
    private getClient;
    export(spans: any[]): number;
    private _processSpan;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
}
export declare function setupOtel(pradvionClient?: PradvionClient, batch?: boolean): any;
//# sourceMappingURL=otel.d.ts.map