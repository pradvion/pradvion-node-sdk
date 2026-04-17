"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PradvionCallbackHandler = void 0;
const context_1 = require("../context");
const PROVIDER_MAP = {
    openai: 'openai',
    chatopenai: 'openai',
    azurechatopenai: 'openai',
    anthropic: 'anthropic',
    chatanthropic: 'anthropic',
    google: 'google',
    chatgoogle: 'google',
};
function detectProvider(serialized) {
    const ids = serialized?.id ?? [];
    const last = (ids[ids.length - 1] ?? '').toLowerCase();
    for (const [key, provider] of Object.entries(PROVIDER_MAP)) {
        if (last.includes(key))
            return provider;
    }
    return 'unknown';
}
function extractModel(serialized, kwargs) {
    const skwargs = serialized?.kwargs ?? {};
    for (const field of ['model_name', 'model', 'deployment_name']) {
        if (skwargs[field])
            return String(skwargs[field]);
    }
    const inv = kwargs?.invocation_params ?? {};
    for (const field of ['model', 'model_name', 'engine']) {
        if (inv[field])
            return String(inv[field]);
    }
    return 'unknown';
}
class PradvionCallbackHandler {
    options;
    raiseError = false;
    startTimes = new Map();
    runInfo = new Map();
    constructor(options = {}) {
        this.options = options;
    }
    getClient() {
        if (this.options.pradvionClient) {
            return this.options.pradvionClient;
        }
        try {
            const { getClient } = require('../index');
            return getClient();
        }
        catch {
            return null;
        }
    }
    getCtx() {
        const ctx = (0, context_1.getEffectiveContext)();
        return {
            customerId: this.options.customerId ?? ctx.customerId,
            feature: this.options.feature ?? ctx.feature,
            team: this.options.team ?? ctx.team,
            environment: this.options.environment ?? ctx.environment,
            conversationId: this.options.conversationId ?? ctx.conversationId,
        };
    }
    async handleLLMStart(serialized, _prompts, runId, _parentRunId, _extraParams, _tags, _metadata, kwargs) {
        this.startTimes.set(runId, Date.now());
        const provider = detectProvider(serialized);
        const model = extractModel(serialized, kwargs ?? {});
        this.runInfo.set(runId, [provider, model]);
    }
    async handleChatModelStart(serialized, _messages, runId, _parentRunId, _extraParams, _tags, _metadata, kwargs) {
        this.startTimes.set(runId, Date.now());
        const provider = detectProvider(serialized);
        const model = extractModel(serialized, kwargs ?? {});
        this.runInfo.set(runId, [provider, model]);
    }
    async handleLLMEnd(output, runId) {
        const client = this.getClient();
        if (!client)
            return;
        const start = this.startTimes.get(runId);
        const latencyMs = start ? Date.now() - start : 0;
        const [provider, model] = this.runInfo.get(runId) ?? ['unknown', 'unknown'];
        this.startTimes.delete(runId);
        this.runInfo.delete(runId);
        let inputTokens = 0;
        let outputTokens = 0;
        try {
            const llmOutput = output?.llm_output ?? {};
            const usage = llmOutput.token_usage ?? llmOutput.usage ?? {};
            inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
            outputTokens =
                usage.completion_tokens ?? usage.output_tokens ?? 0;
        }
        catch { }
        if (inputTokens === 0 && outputTokens === 0)
            return;
        const ctx = this.getCtx();
        client.track({
            provider,
            model,
            inputTokens,
            outputTokens,
            latencyMs,
            statusCode: 200,
            customerId: ctx.customerId,
            feature: ctx.feature,
            team: ctx.team,
            environment: ctx.environment,
            conversationId: ctx.conversationId,
            requestId: runId,
        });
    }
    async handleLLMError(_error, runId) {
        this.startTimes.delete(runId);
        this.runInfo.delete(runId);
    }
    async handleChainStart() { }
    async handleChainEnd() { }
    async handleChainError() { }
    async handleToolStart() { }
    async handleToolEnd() { }
    async handleToolError() { }
    async handleText() { }
    async handleAgentAction() { }
    async handleAgentEnd() { }
    async handleRetrieverStart() { }
    async handleRetrieverEnd() { }
    async handleRetrieverError() { }
}
exports.PradvionCallbackHandler = PradvionCallbackHandler;
//# sourceMappingURL=langchain.js.map