"use strict";
/**
 * AI client wrappers for automatic tracking.
 * Privacy: Prompts and responses are NEVER captured.
 */
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
exports.StreamingCostTracker = void 0;
exports.wrapOpenAI = wrapOpenAI;
exports.wrapAnthropic = wrapAnthropic;
const crypto = __importStar(require("crypto"));
const context_1 = require("./context");
const OUTPUT_RATES = {
    'openai/gpt-4o': 0.00001,
    'openai/gpt-4o-mini': 0.0000006,
    'openai/gpt-4-turbo': 0.00003,
    'openai/gpt-3.5-turbo': 0.0000015,
    'openai/o1': 0.00006,
    'openai/o1-mini': 0.0000044,
    'openai/o3-mini': 0.0000044,
    'anthropic/claude-3-5-sonnet-20241022': 0.000015,
    'anthropic/claude-3-haiku-20240307': 0.00000125,
    'anthropic/claude-3-opus-20240229': 0.000075,
};
const INPUT_RATES = {
    'openai/gpt-4o': 0.0000025,
    'openai/gpt-4o-mini': 0.00000015,
    'openai/gpt-4-turbo': 0.00001,
    'openai/gpt-3.5-turbo': 0.0000005,
    'openai/o1': 0.000015,
    'openai/o1-mini': 0.0000011,
    'openai/o3-mini': 0.0000011,
    'anthropic/claude-3-5-sonnet-20241022': 0.000003,
    'anthropic/claude-3-haiku-20240307': 0.00000025,
    'anthropic/claude-3-opus-20240229': 0.000015,
};
class StreamingCostTracker {
    onToken;
    callbackInterval;
    outRate;
    inRate;
    inputCost;
    outputChunks = 0;
    estimatedCost = 0;
    constructor(provider, model, inputTokens = 0, onToken, callbackInterval = 5) {
        this.onToken = onToken;
        this.callbackInterval = callbackInterval;
        const key = `${provider}/${model}`;
        this.outRate = OUTPUT_RATES[key] ?? 0;
        this.inRate = INPUT_RATES[key] ?? 0;
        this.inputCost = this.inRate * inputTokens;
        this.callbackInterval = Math.max(1, callbackInterval);
    }
    onChunk() {
        this.outputChunks++;
        this.estimatedCost = (this.inputCost + this.outRate * this.outputChunks);
        if (this.onToken &&
            this.outputChunks % this.callbackInterval === 0) {
            try {
                this.onToken(this.estimatedCost);
            }
            catch { }
        }
        return this.estimatedCost;
    }
    finalize(actualInputTokens = 0, actualOutputTokens = 0) {
        const final = actualInputTokens > 0 || actualOutputTokens > 0
            ? this.inRate * actualInputTokens +
                this.outRate * actualOutputTokens
            : this.estimatedCost;
        if (this.onToken) {
            try {
                this.onToken(final);
            }
            catch { }
        }
        return final;
    }
}
exports.StreamingCostTracker = StreamingCostTracker;
function wrapOpenAI(client, pradvion) {
    return new Proxy(client, {
        get(target, prop) {
            if (prop === 'chat') {
                return new Proxy(target.chat, {
                    get(chatTarget, chatProp) {
                        if (chatProp === 'completions') {
                            return new Proxy(chatTarget.completions, {
                                get(compTarget, compProp) {
                                    if (compProp === 'create') {
                                        return createOpenAICreateWrapper(compTarget.create.bind(compTarget), pradvion);
                                    }
                                    return compTarget[compProp];
                                }
                            });
                        }
                        return chatTarget[chatProp];
                    }
                });
            }
            return target[prop];
        }
    });
}
function createOpenAICreateWrapper(originalCreate, pradvion) {
    return async function (params, options) {
        const model = params?.model ?? 'unknown';
        const isStream = params?.stream === true;
        const onToken = params?.onToken;
        const ctx = (0, context_1.getEffectiveContext)();
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        const cleanParams = { ...params };
        delete cleanParams.onToken;
        if (isStream) {
            return handleOpenAIStream(originalCreate, cleanParams, options, pradvion, model, ctx, startTime, requestId, onToken);
        }
        try {
            const response = await originalCreate(cleanParams, options);
            const latencyMs = Date.now() - startTime;
            const usage = response?.usage ?? {};
            pradvion.track({
                provider: 'openai',
                model,
                inputTokens: usage.prompt_tokens ?? 0,
                outputTokens: usage.completion_tokens ?? 0,
                cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
                latencyMs,
                statusCode: 200,
                customerId: ctx.customerId,
                feature: ctx.feature,
                team: ctx.team,
                department: ctx.department,
                environment: ctx.environment,
                conversationId: ctx.conversationId,
                requestId,
            });
            return response;
        }
        catch (err) {
            const statusCode = err?.status ?? 500;
            pradvion.trackError({
                provider: 'openai',
                model,
                error: err?.message ?? String(err),
                statusCode,
                latencyMs: Date.now() - startTime,
                customerId: ctx.customerId,
                feature: ctx.feature,
                environment: ctx.environment,
                requestId,
            });
            throw err;
        }
    };
}
async function* handleOpenAIStream(originalCreate, params, options, pradvion, model, ctx, startTime, requestId, onToken) {
    const tracker = new StreamingCostTracker('openai', model, 0, onToken);
    let inputTokens = 0;
    let outputTokens = 0;
    let chunkCount = 0;
    let statusCode = 200;
    try {
        const stream = await originalCreate(params, options);
        for await (const chunk of stream) {
            chunkCount++;
            tracker.onChunk();
            if (chunk?.usage) {
                inputTokens = chunk.usage.prompt_tokens ?? 0;
                outputTokens = chunk.usage.completion_tokens ?? 0;
            }
            yield chunk;
        }
    }
    catch (err) {
        statusCode = err?.status ?? 500;
        pradvion.trackError({
            provider: 'openai',
            model,
            error: err?.message ?? String(err),
            statusCode,
            latencyMs: Date.now() - startTime,
            customerId: ctx.customerId,
            requestId,
        });
        throw err;
    }
    finally {
        tracker.finalize(inputTokens, outputTokens);
        const latencyMs = Date.now() - startTime;
        if (statusCode === 200) {
            pradvion.track({
                provider: 'openai',
                model,
                inputTokens: inputTokens || 0,
                outputTokens: outputTokens || chunkCount,
                latencyMs,
                statusCode: 200,
                customerId: ctx.customerId,
                feature: ctx.feature,
                team: ctx.team,
                department: ctx.department,
                environment: ctx.environment,
                conversationId: ctx.conversationId,
                requestId,
            });
        }
    }
}
function wrapAnthropic(client, pradvion) {
    return new Proxy(client, {
        get(target, prop) {
            if (prop === 'messages') {
                return new Proxy(target.messages, {
                    get(msgTarget, msgProp) {
                        if (msgProp === 'create') {
                            return createAnthropicCreateWrapper(msgTarget.create.bind(msgTarget), pradvion);
                        }
                        return msgTarget[msgProp];
                    }
                });
            }
            return target[prop];
        }
    });
}
function createAnthropicCreateWrapper(originalCreate, pradvion) {
    return async function (params, options) {
        const model = params?.model ?? 'unknown';
        const ctx = (0, context_1.getEffectiveContext)();
        const startTime = Date.now();
        const requestId = crypto.randomUUID();
        try {
            const response = await originalCreate(params, options);
            const latencyMs = Date.now() - startTime;
            const usage = response?.usage ?? {};
            pradvion.track({
                provider: 'anthropic',
                model,
                inputTokens: usage.input_tokens ?? 0,
                outputTokens: usage.output_tokens ?? 0,
                latencyMs,
                statusCode: 200,
                customerId: ctx.customerId,
                feature: ctx.feature,
                team: ctx.team,
                department: ctx.department,
                environment: ctx.environment,
                conversationId: ctx.conversationId,
                requestId,
            });
            return response;
        }
        catch (err) {
            pradvion.trackError({
                provider: 'anthropic',
                model,
                error: err?.message ?? String(err),
                statusCode: err?.status ?? 500,
                latencyMs: Date.now() - startTime,
                customerId: ctx.customerId,
                requestId,
            });
            throw err;
        }
    };
}
//# sourceMappingURL=wrapper.js.map