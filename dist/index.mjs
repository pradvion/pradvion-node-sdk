"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDK_VERSION = exports.BudgetExceededError = exports.BudgetTracker = exports.getBudgetTracker = exports.addCustomPricing = exports.compareCost = exports.forecastFromRequests = exports.forecastMonthly = exports.clearContext = exports.setContext = void 0;
exports.init = init;
exports.getClient = getClient;
exports.monitor = monitor;
exports.track = track;
exports.trackError = trackError;
exports.trackBatch = trackBatch;
exports.signal = signal;
exports.signalBatch = signalBatch;
exports.trace = trace;
exports.context = context;
exports.newConversation = newConversation;
exports.flush = flush;
exports.shutdown = shutdown;
const client_1 = require("./client");
const context_1 = require("./context");
Object.defineProperty(exports, "setContext", { enumerable: true, get: function () { return context_1.setContext; } });
Object.defineProperty(exports, "clearContext", { enumerable: true, get: function () { return context_1.clearContext; } });
const wrapper_1 = require("./wrapper");
const conversation_1 = require("./conversation");
const budget_1 = require("./budget");
Object.defineProperty(exports, "BudgetTracker", { enumerable: true, get: function () { return budget_1.BudgetTracker; } });
Object.defineProperty(exports, "BudgetExceededError", { enumerable: true, get: function () { return budget_1.BudgetExceededError; } });
Object.defineProperty(exports, "getBudgetTracker", { enumerable: true, get: function () { return budget_1.getBudgetTracker; } });
const forecast_1 = require("./forecast");
Object.defineProperty(exports, "forecastMonthly", { enumerable: true, get: function () { return forecast_1.forecastMonthly; } });
Object.defineProperty(exports, "forecastFromRequests", { enumerable: true, get: function () { return forecast_1.forecastFromRequests; } });
const compare_1 = require("./compare");
Object.defineProperty(exports, "compareCost", { enumerable: true, get: function () { return compare_1.compareCost; } });
Object.defineProperty(exports, "addCustomPricing", { enumerable: true, get: function () { return compare_1.addCustomPricing; } });
const version_1 = require("./version");
Object.defineProperty(exports, "SDK_VERSION", { enumerable: true, get: function () { return version_1.SDK_VERSION; } });
let _client = null;
function init(options) {
    _client = new client_1.PradvionClient(options);
    if (options.autoFlush !== false) {
        process.on('exit', () => {
            _client?.queue.pendingCount();
        });
        process.on('beforeExit', async () => {
            await _client?.flush();
        });
        process.on('SIGINT', async () => {
            await _client?.flush();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            await _client?.flush();
            process.exit(0);
        });
    }
}
function getClient() {
    if (!_client) {
        throw new Error('Pradvion not initialized. ' +
            "Call pradvion.init({ apiKey: 'nx_live_...' }) first.");
    }
    return _client;
}
function monitor(client, pradvionClient) {
    const pc = pradvionClient ?? _client;
    if (!pc) {
        console.warn('[Pradvion] monitor() called before init(). ' +
            'Call pradvion.init() first.');
        return client;
    }
    const c = client;
    if (typeof c.chat?.completions?.create === 'function') {
        return (0, wrapper_1.wrapOpenAI)(client, pc);
    }
    if (typeof c.messages?.create === 'function') {
        return (0, wrapper_1.wrapAnthropic)(client, pc);
    }
    console.warn('[Pradvion] monitor(): unrecognized client type. ' +
        'Supported: OpenAI, Anthropic');
    return client;
}
function track(options) {
    getClient().track(options);
}
function trackError(options) {
    getClient().trackError(options);
}
function trackBatch(events) {
    getClient().trackBatch(events);
}
function signal(options) {
    getClient().signal(options);
}
function signalBatch(signals) {
    getClient().signalBatch(signals);
}
async function trace(customerIdOrContext, fn) {
    const ctx = typeof customerIdOrContext === 'string'
        ? { customerId: customerIdOrContext }
        : customerIdOrContext;
    return (0, context_1.runWithContext)(ctx, fn);
}
async function context(ctx, fn) {
    return (0, context_1.runWithContext)(ctx, fn);
}
function newConversation() {
    return (0, conversation_1.newConversationId)();
}
async function flush() {
    await _client?.flush();
}
async function shutdown() {
    await _client?.shutdown();
    _client = null;
}
const pradvion = {
    init,
    getClient,
    monitor,
    track,
    trackError,
    trackBatch,
    signal,
    signalBatch,
    trace,
    context,
    setContext: context_1.setContext,
    clearContext: context_1.clearContext,
    newConversation,
    flush,
    shutdown,
    forecastMonthly: forecast_1.forecastMonthly,
    forecastFromRequests: forecast_1.forecastFromRequests,
    compareCost: compare_1.compareCost,
    addCustomPricing: compare_1.addCustomPricing,
    getBudgetTracker: budget_1.getBudgetTracker,
    version: version_1.SDK_VERSION,
};
exports.default = pradvion;
//# sourceMappingURL=index.js.map