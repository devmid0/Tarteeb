/**
 * Life OS — Core Event Bus
 * 
 * Centralized publish-subscribe system for cross-pillar communication.
 * This is the ONLY sanctioned mechanism for inter-pillar messaging.
 * 
 * Design constraints:
 * - Events are immutable once published
 * - Subscribers receive events in registration order
 * - Event payloads are passed by value, not by reference
 * - Wildcard subscriptions are supported for debugging
 */

export class EventBus {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this.subscribers = new Map();
        
        /** @type {Array<{event: string, payload: any, timestamp: number}>} */
        this.history = [];
        
        /** @type {number} */
        this.maxHistorySize = 100;
        
        /** @type {boolean} */
        this.debugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name (past-tense, kebab-case)
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        
        this.subscribers.get(event).add(callback);
        
        // Return unsubscribe function for cleanup
        return () => this.unsubscribe(event, callback);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    unsubscribe(event, callback) {
        const subs = this.subscribers.get(event);
        if (subs) {
            subs.delete(callback);
            if (subs.size === 0) {
                this.subscribers.delete(event);
            }
        }
    }

    /**
     * Publish an event to all subscribers
     * @param {string} event - Event name (past-tense, kebab-case)
     * @param {any} payload - Event data (passed by value)
     */
    publish(event, payload = null) {
        // Record in history
        this.history.push({
            event,
            payload,
            timestamp: Date.now()
        });
        
        // Trim history if needed
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
        
        // Debug logging
        if (this.debugMode) {
            console.log(`[EventBus] ${event}`, payload);
        }
        
        // Notify all subscribers
        const subs = this.subscribers.get(event);
        if (subs) {
            subs.forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`[EventBus] Error in subscriber for "${event}":`, error);
                }
            });
        }
        
        // Notify wildcard subscribers
        const wildcards = this.subscribers.get('*');
        if (wildcards) {
            wildcards.forEach(callback => {
                try {
                    callback(event, payload);
                } catch (error) {
                    console.error(`[EventBus] Error in wildcard subscriber:`, error);
                }
            });
        }
    }

    /**
     * Subscribe to all events (wildcard)
     * @param {Function} callback - Handler receiving (eventName, payload)
     * @returns {Function} Unsubscribe function
     */
    subscribeAll(callback) {
        return this.subscribe('*', callback);
    }

    /**
     * Get recent event history
     * @param {number} count - Number of recent events to return
     * @returns {Array} Recent events
     */
    getHistory(count = 10) {
        return this.history.slice(-count);
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Clear all subscribers and history
     */
    reset() {
        this.subscribers.clear();
        this.history = [];
    }
}
