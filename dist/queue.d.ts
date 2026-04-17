/**
 * Persistent JSON file queue for zero data loss.
 */
import { QueuePayload } from './types';
interface QueueEntry {
    id: number;
    payload: QueuePayload;
    attempts: number;
    createdAt: string;
    lastAttemptAt?: string;
    status: 'pending' | 'sent' | 'failed';
}
export declare class LocalQueue {
    private readonly queuePath;
    private readonly tmpPath;
    private nextId;
    private lock;
    constructor(queuePath?: string);
    private _initQueue;
    push(payload: QueuePayload): number;
    getPending(limit?: number): QueueEntry[];
    markSent(id: number): void;
    markFailed(id: number): void;
    pendingCount(): number;
    cleanup(maxAgeMs?: number): void;
    private _read;
    private _write;
    private _update;
}
export {};
//# sourceMappingURL=queue.d.ts.map