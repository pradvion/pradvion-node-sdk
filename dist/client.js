"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PradvionClient = void 0;
const crypto = __importStar(require("crypto"));
const queue_1 = require("./queue");
const worker_1 = require("./worker");
const signals_1 = require("./signals");
class PradvionClient {
    apiKey;
    baseUrl;
    timeout;
    queue;
    worker;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl ??
            'https://pradvion-backend-production.up.railway.app').replace(/\/$/, '');
        this.timeout = options.timeout ?? 5000;
        this.queue = new queue_1.LocalQueue(options.queuePath);
        this.worker = new worker_1.QueueWorker({
            queue: this.queue,
            apiKey: this.apiKey,
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            flushInterval: 5000,
            batchSize: 20,
        });
        if (options.asyncTracking !== false) {
            this.worker.start();
        }
    }
    track(options) {
        const payload = {
            request_id: options.requestId ?? crypto.randomUUID(),
            provider: options.provider,
            model: options.model,
            input_tokens: Math.max(0, options.inputTokens),
            output_tokens: Math.max(0, options.outputTokens),
            cached_tokens: Math.max(0, options.cachedTokens ?? 0),
            reasoning_tokens: Math.max(0, options.reasoningTokens ?? 0),
            latency_ms: Math.max(0, options.latencyMs),
            status_code: options.statusCode ?? 200,
            timestamp: new Date().toISOString(),
        };
        if (options.customerId) {
            payload.customer_id_hash = this._hashCustomerId(options.customerId);
        }
        if (options.feature)
            payload.feature = options.feature;
        if (options.team)
            payload.team = options.team;
        if (options.department) {
            payload.department = options.department;
        }
        if (options.environment) {
            payload.environment = options.environment;
        }
        if (options.conversationId) {
            payload.conversation_id = options.conversationId;
        }
        this.queue.push(payload);
    }
    trackError(options) {
        const payload = {
            request_id: options.requestId ?? crypto.randomUUID(),
            provider: options.provider,
            model: options.model,
            input_tokens: 0,
            output_tokens: 0,
            cached_tokens: 0,
            reasoning_tokens: 0,
            latency_ms: Math.max(0, options.latencyMs ?? 0),
            status_code: options.statusCode ?? 500,
            timestamp: new Date().toISOString(),
            error: String(options.error).substring(0, 500),
        };
        if (options.customerId) {
            payload.customer_id_hash = this._hashCustomerId(options.customerId);
        }
        if (options.feature)
            payload.feature = options.feature;
        if (options.team)
            payload.team = options.team;
        if (options.department) {
            payload.department = options.department;
        }
        if (options.environment) {
            payload.environment = options.environment;
        }
        if (options.conversationId) {
            payload.conversation_id = options.conversationId;
        }
        this.queue.push(payload);
    }
    trackBatch(events) {
        if (!events?.length)
            return;
        for (const event of events) {
            try {
                this.track(event);
            }
            catch (e) {
                // Skip invalid events silently
            }
        }
    }
    signal(options) {
        const payload = (0, signals_1.createSignalPayload)(options);
        this.queue.push(payload);
    }
    signalBatch(signals) {
        if (!signals?.length)
            return;
        for (const sig of signals) {
            try {
                this.signal(sig);
            }
            catch (e) {
                // Skip invalid signals silently
            }
        }
    }
    async flush() {
        await this.worker.flushOnce();
    }
    async shutdown() {
        await this.flush();
        this.worker.stop();
    }
    _hashCustomerId(customerId) {
        return crypto
            .createHash('sha256')
            .update(String(customerId))
            .digest('hex');
    }
}
exports.PradvionClient = PradvionClient;
//# sourceMappingURL=client.js.map