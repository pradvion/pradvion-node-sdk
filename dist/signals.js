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
exports.createSignalPayload = createSignalPayload;
const crypto = __importStar(require("crypto"));
function createSignalPayload(options) {
    const { customerId, event, quantity = 1, value, project, feature, team, environment, metadata, } = options;
    if (!event || event.trim() === '') {
        throw new Error('event name cannot be empty');
    }
    if (quantity < 0) {
        throw new Error('quantity must be >= 0');
    }
    if (value !== undefined && value < 0) {
        throw new Error('value must be >= 0');
    }
    const normalizedEvent = event.trim().toLowerCase();
    if (!/^[a-z0-9_]+$/.test(normalizedEvent)) {
        throw new Error('event must contain only lowercase letters, ' +
            'digits, and underscores');
    }
    const payload = {
        type: 'signal',
        signal_id: crypto.randomUUID(),
        event: normalizedEvent,
        quantity,
        timestamp: new Date().toISOString(),
    };
    if (customerId) {
        payload.customer_id_hash = crypto
            .createHash('sha256')
            .update(String(customerId))
            .digest('hex');
    }
    if (value !== undefined)
        payload.value = value;
    if (project)
        payload.project = project;
    if (feature)
        payload.feature = feature;
    if (team)
        payload.team = team;
    if (environment)
        payload.environment = environment;
    if (metadata && Object.keys(metadata).length > 0) {
        payload.metadata = metadata;
    }
    return payload;
}
//# sourceMappingURL=signals.js.map