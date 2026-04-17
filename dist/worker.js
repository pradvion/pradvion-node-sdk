"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueWorker = void 0;
const version_1 = require("./version");
const INGEST_URL_SUFFIX = '/sdk/ingest';
const SIGNAL_URL_SUFFIX = '/sdk/signals';
class QueueWorker {
    queue;
    apiKey;
    ingestUrl;
    signalUrl;
    timeout;
    flushInterval;
    batchSize;
    timer = null;
    running = false;
    constructor(options) {
        this.queue = options.queue;
        this.apiKey = options.apiKey;
        this.ingestUrl = `${options.baseUrl}${INGEST_URL_SUFFIX}`;
        this.signalUrl = `${options.baseUrl}${SIGNAL_URL_SUFFIX}`;
        this.timeout = options.timeout;
        this.flushInterval = options.flushInterval ?? 5000;
        this.batchSize = options.batchSize ?? 20;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.timer = setInterval(() => this.flushOnce(), this.flushInterval);
        if (this.timer.unref) {
            this.timer.unref();
        }
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.running = false;
    }
    async flushOnce() {
        const pending = this.queue.getPending(this.batchSize);
        if (pending.length === 0)
            return;
        await Promise.allSettled(pending.map(entry => this._send(entry.id, entry.payload)));
    }
    async _send(id, payload) {
        const isSignal = payload.type === 'signal';
        const url = isSignal ? this.signalUrl : this.ingestUrl;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Pradvion-SDK-Version': version_1.SDK_VERSION,
                    'X-Pradvion-SDK-Language': version_1.SDK_LANGUAGE,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (response.status >= 200 && response.status < 300) {
                this.queue.markSent(id);
            }
            else {
                this.queue.markFailed(id);
            }
        }
        catch {
            this.queue.markFailed(id);
        }
    }
}
exports.QueueWorker = QueueWorker;
//# sourceMappingURL=worker.js.map