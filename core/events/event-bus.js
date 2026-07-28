// YAGNI: Stripped history, debugMode, wildcard subscribers, subscribeAll, getHistory, setDebugMode, reset

export class EventBus {
    constructor() {
        this.subscribers = new Map();
    }

    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event).add(callback);
        return () => this.unsubscribe(event, callback);
    }

    unsubscribe(event, callback) {
        const subs = this.subscribers.get(event);
        if (subs) {
            subs.delete(callback);
            if (subs.size === 0) {
                this.subscribers.delete(event);
            }
        }
    }

    publish(event, payload = null) {
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
    }
}
