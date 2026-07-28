/**
 * Tarteeb — Optimistic Event Dispatcher
 *
 * Zero-latency bridge between user actions and IndexedDB writes.
 * Fires events synchronously BEFORE the async write begins,
 * enabling instant DOM updates without waiting for persistence.
 *
 * Flow:
 *   1. dispatch() fires optimistic event immediately (sync)
 *   2. Executes async writeFn()
 *   3. On success: fires -confirmed event with real saved data
 *   4. On failure: fires tarteeb:sync-error for UI revert
 *
 * Design constraints:
 *   - Pure utility — zero DOM awareness, zero pillar coupling
 *   - Uses existing EventBus — no CustomEvent, no window globals
 *   - Temp IDs are monotonically unique (timestamp + counter + random)
 *   - Pending writes tracked in a Map for dedup / abort
 */

'use strict';

/* ── Counter for unique temp IDs ──────────────────────────── */

var _counter = 0;

/* ================================================================
   OptimisticDispatcher — Class
   ================================================================ */

export class OptimisticDispatcher {
    /**
     * @param {import('./event-bus.js').EventBus} eventBus
     */
    constructor(eventBus) {
        if (!eventBus) {
            throw new Error('OptimisticDispatcher requires an EventBus instance');
        }
        this._bus = eventBus;

        /** @type {Map<string, {type: string, payload: Object}>} */
        this._pending = new Map();
    }

    /* ── Public API ───────────────────────────────────────── */

    /**
     * Dispatch an optimistic event and execute the async write.
     * Returns the optimistic item immediately (before the write completes).
     *
     * @param {string} eventType - e.g. 'tarteeb:task-created'
     * @param {Object} payload - item data (without id)
     * @param {Function} writeFn - async function returning saved item with real id
     * @returns {Object} optimistic item with temp id and _optimistic flag
     */
    dispatch(eventType, payload, writeFn) {
        if (!eventType || !writeFn) {
            console.warn('[OptimisticDispatcher] dispatch() requires eventType and writeFn');
            return payload;
        }

        /* Generate unique temp id */
        _counter++;
        var tempId = '_opt_' + Date.now() + '_' + _counter + '_' +
                     Math.random().toString(36).slice(2, 8);

        var optimistic = Object.assign({}, payload, {
            id: tempId,
            _optimistic: true,
        });

        /* Track pending write */
        this._pending.set(tempId, { type: eventType, payload: optimistic });

        /* Fire optimistic event synchronously — DOM updates instantly */
        this._bus.publish(eventType, optimistic);

        /* Execute async write in background */
        var self = this;
        var confirmType = eventType.replace('-created', '-confirmed');

        writeFn()
            .then(function (saved) {
                /* Reconcile: fire confirmed event with real saved data */
                self._pending.delete(tempId);
                self._bus.publish(confirmType, {
                    tempId: tempId,
                    saved: saved,
                });
            })
            .catch(function (err) {
                /* Revert: fire sync-error for UI rollback */
                self._pending.delete(tempId);
                self._bus.publish('tarteeb:sync-error', {
                    tempId: tempId,
                    eventType: eventType,
                    error: err,
                });
            });

        return optimistic;
    }

    /**
     * Check if an optimistic item is still pending persistence.
     * @param {string} tempId
     * @returns {boolean}
     */
    isPending(tempId) {
        return this._pending.has(tempId);
    }

    /**
     * Number of writes currently in-flight.
     * @returns {number}
     */
    get pendingCount() {
        return this._pending.size;
    }

    /**
     * Clear all pending tracks (e.g. on unmount).
     */
    clear() {
        this._pending.clear();
    }
}
