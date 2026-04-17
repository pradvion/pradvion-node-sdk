import { LocalQueue } from './queue';
export interface WorkerOptions {
    queue: LocalQueue;
    apiKey: string;
    baseUrl: string;
    timeout: number;
    flushInterval?: number;
    batchSize?: number;
}
export declare class QueueWorker {
    private readonly queue;
    private readonly apiKey;
    private readonly ingestUrl;
    private readonly signalUrl;
    private readonly timeout;
    private readonly flushInterval;
    private readonly batchSize;
    private timer;
    private running;
    constructor(options: WorkerOptions);
    start(): void;
    stop(): void;
    flushOnce(): Promise<void>;
    private _send;
}
//# sourceMappingURL=worker.d.ts.map