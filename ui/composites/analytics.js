'use strict';

/**
 * Analytics tracking via Google Analytics 4 (G-91W4M368ZK).
 * Falls back to no-op if gtag is not loaded.
 */
window.trackEvent = function (eventName, eventParams) {
    eventParams = eventParams || {};
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, eventParams);
    }
    console.log('[Analytics] Event: ' + eventName + ' | Data: ' + JSON.stringify(eventParams));
};

export function trackEvent(eventName, eventParams) {
    window.trackEvent(eventName, eventParams);
}

window.__tarteeb = window.__tarteeb || {};
window.__tarteeb.analytics = { trackEvent: trackEvent };
