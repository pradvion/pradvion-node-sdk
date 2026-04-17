"use strict";
/**
 * Persistent JSON file queue for zero data loss.
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
exports.LocalQueue = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class LocalQueue {
    queuePath;
    tmpPath;
    nextId = 1;
    lock = false;
    constructor(queuePath) {
        const defaultDir = path.join(os.homedir(), '.pradvion');
        const defaultPath = path.join(defaultDir, 'queue.json');
        this.queuePath = queuePath ?? defaultPath;
        this.tmpPath = this.queuePath + '.tmp';
        this._initQueue();
    }
    _initQueue() {
        const dir = path.dirname(this.queuePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.queuePath)) {
            this._write({ nextId: 1, entries: [] });
        }
        else {
            try {
                const store = this._read();
                this.nextId = store.nextId;
            }
            catch {
                this._write({ nextId: 1, entries: [] });
            }
        }
    }
    push(payload) {
        const store = this._read();
        const id = store.nextId++;
        this.nextId = store.nextId;
        store.entries.push({
            id,
            payload,
            attempts: 0,
            createdAt: new Date().toISOString(),
            status: 'pending',
        });
        if (store.entries.length > 10000) {
            store.entries = [
                ...store.entries.filter(e => e.status === 'pending'),
                ...store.entries
                    .filter(e => e.status !== 'pending')
                    .slice(-1000)
            ];
        }
        this._write(store);
        return id;
    }
    getPending(limit = 20) {
        const store = this._read();
        return store.entries
            .filter(e => e.status === 'pending')
            .slice(0, limit);
    }
    markSent(id) {
        this._update(id, {
            status: 'sent',
            lastAttemptAt: new Date().toISOString(),
        });
    }
    markFailed(id) {
        const store = this._read();
        const entry = store.entries.find(e => e.id === id);
        if (!entry)
            return;
        entry.attempts += 1;
        entry.lastAttemptAt = new Date().toISOString();
        if (entry.attempts >= 5) {
            entry.status = 'failed';
        }
        this._write(store);
    }
    pendingCount() {
        const store = this._read();
        return store.entries.filter(e => e.status === 'pending').length;
    }
    cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
        const store = this._read();
        const cutoff = Date.now() - maxAgeMs;
        store.entries = store.entries.filter(e => {
            if (e.status !== 'sent')
                return true;
            return new Date(e.createdAt).getTime() > cutoff;
        });
        this._write(store);
    }
    _read() {
        try {
            const content = fs.readFileSync(this.queuePath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return { nextId: this.nextId, entries: [] };
        }
    }
    _write(store) {
        const content = JSON.stringify(store, null, 0);
        fs.writeFileSync(this.tmpPath, content, 'utf-8');
        fs.renameSync(this.tmpPath, this.queuePath);
    }
    _update(id, updates) {
        const store = this._read();
        const entry = store.entries.find(e => e.id === id);
        if (entry) {
            Object.assign(entry, updates);
            this._write(store);
        }
    }
}
exports.LocalQueue = LocalQueue;
//# sourceMappingURL=queue.js.map