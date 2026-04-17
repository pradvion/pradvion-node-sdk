import { LocalQueue } from './queue';
import { PradvionOptions, TrackOptions, TrackErrorOptions, SignalOptions } from './types';
export declare class PradvionClient {
    readonly apiKey: string;
    readonly baseUrl: string;
    private readonly timeout;
    readonly queue: LocalQueue;
    private readonly worker;
    constructor(options: PradvionOptions);
    track(options: TrackOptions): void;
    trackError(options: TrackErrorOptions): void;
    trackBatch(events: TrackOptions[]): void;
    signal(options: SignalOptions): void;
    signalBatch(signals: SignalOptions[]): void;
    flush(): Promise<void>;
    shutdown(): Promise<void>;
    private _hashCustomerId;
}
//# sourceMappingURL=client.d.ts.map