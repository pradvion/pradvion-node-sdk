"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithContext = runWithContext;
exports.getCurrentContext = getCurrentContext;
exports.setContext = setContext;
exports.clearContext = clearContext;
exports.getEffectiveContext = getEffectiveContext;
const async_hooks_1 = require("async_hooks");
const storage = new async_hooks_1.AsyncLocalStorage();
async function runWithContext(ctx, fn) {
    return storage.run(ctx, fn);
}
function getCurrentContext() {
    return storage.getStore() ?? {};
}
function setContext(ctx) {
    _manualContext = { ..._manualContext, ...ctx };
}
function clearContext() {
    _manualContext = {};
}
function getEffectiveContext() {
    const asyncCtx = storage.getStore();
    if (asyncCtx)
        return asyncCtx;
    return _manualContext;
}
let _manualContext = {};
//# sourceMappingURL=context.js.map