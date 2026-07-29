/**
 * Tarteeb — Cloud Sync (Public Shell Module)
 *
 * Handles the full sync cycle via profiles.app_data JSONB column.
 *   - syncCloudData checks premium, gathers local data, pushes to
 *     Supabase, pulls back, and writes to localStorage + IndexedDB
 *   - handleUpgradeClick redirects to Stripe checkout
 *   - showPaywall renders the premium upgrade modal
 */

'use strict';

import { verifyPremiumStatus, getCurrentSession, getSupabase } from '../../ui/composites/auth.js';
import { trackEvent } from '../../ui/composites/analytics.js';

/* ── Stripe Checkout ──────────────────────────────────────── */

export function handleUpgradeClick() {
    window.location.href = 'https://buy.stripe.com/test_6oU7sMgzUd8o5Wl9Hs6wE00';
}

/* ── Sync ──────────────────────────────────────────────────── */

export async function syncCloudData() {
    try {
        var isPremium = await verifyPremiumStatus(true);
        if (!isPremium) {
            showPaywall('cloud_sync');
            return;
        }

        var session = await getCurrentSession();
        if (!session) {
            console.warn('[CloudSync] No active session — cannot sync');
            return;
        }

        var supabase = getSupabase();
        if (!supabase) {
            console.error('[CloudSync] Supabase client not available');
            return;
        }

        /* ── Gather local data ── */
        var payload = { localStorage: {}, stores: null };

        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf('tarteeb_') === 0) {
                try {
                    payload.localStorage[key] = JSON.parse(localStorage.getItem(key));
                } catch (_) {
                    payload.localStorage[key] = localStorage.getItem(key);
                }
            }
        }

        var db = window.__tarteeb && window.__tarteeb.database;
        if (db) {
            payload.stores = await db.exportAll();
        }

        /* ── Push to Supabase ── */
        var { error: pushError } = await supabase
            .from('profiles')
            .update({ app_data: payload })
            .eq('id', session.user.id);

        if (pushError) {
            console.error('[CloudSync] Push failed:', pushError.message);
            return;
        }

        /* ── Pull from Supabase ── */
        var { data, error: pullError } = await supabase
            .from('profiles')
            .select('app_data')
            .eq('id', session.user.id)
            .maybeSingle();

        if (pullError) {
            console.error('[CloudSync] Pull failed:', pullError.message);
            return;
        }

        if (!data?.app_data) {
            console.warn('[CloudSync] No cloud data returned after push');
            return;
        }

        var cloudData = data.app_data;

        /* ── Write localStorage keys from cloud ── */
        if (cloudData.localStorage && typeof cloudData.localStorage === 'object') {
            for (var lsKey in cloudData.localStorage) {
                if (lsKey.indexOf('tarteeb_') === 0) {
                    var val = cloudData.localStorage[lsKey];
                    if (typeof val === 'object' && val !== null) {
                        localStorage.setItem(lsKey, JSON.stringify(val));
                    } else {
                        localStorage.setItem(lsKey, String(val));
                    }
                }
            }
        }

        /* ── Restore IndexedDB stores from cloud ── */
        if (cloudData.stores && db) {
            await db.importAll(cloudData.stores);
        }

        /* ── Notify UI ── */
        window.dispatchEvent(new CustomEvent('cloud:synced', {
            detail: { timestamp: new Date().toISOString() },
        }));

        console.log('[CloudSync] Sync complete');
    } catch (err) {
        console.error('[CloudSync] Sync error:', err);
    }
}

/* ── Init ──────────────────────────────────────────────────── */

export function initCloudSync() {
    /* no-op — auth module owns the Supabase client */
}

/* ── Paywall Modal ─────────────────────────────────────────── */

/**
 * Show the premium upgrade modal overlay.
 * Safe to call from any view — checks localStorage bypass first.
 */
export function showPaywall(featureName) {
    closePaywall();

    trackEvent('paywall_viewed', { feature_attempted: featureName || 'unknown' });

    var portal = document.getElementById('modal-portal');
    if (!portal) return;

    var overlay = document.createElement('div');
    overlay.id = 'paywall-modal';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    overlay.style.pointerEvents = 'auto';

    var backdrop = document.createElement('div');
    backdrop.className = 'absolute inset-0 bg-black/60 backdrop-blur-sm animate-entrance';

    var card = document.createElement('div');
    card.className = [
        'relative bg-surface-raised rounded-2xl shadow-modal w-full max-w-sm',
        'border border-white/[0.06]',
        'animate-entrance',
    ].join(' ');

    card.innerHTML =
        '<div class="p-6 text-center">' +
            '<div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 ' +
                        'flex items-center justify-center shadow-[0_0_24px_rgba(251,191,36,0.25)] mb-5">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" class="w-7 h-7">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" ' +
                          'd="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>' +
                '</svg>' +
            '</div>' +
            '<h2 class="text-lg font-heading font-semibold text-text-primary mb-2">Premium Feature</h2>' +
            '<p class="text-[13px] text-text-secondary leading-relaxed mb-6">' +
                'Cloud Sync keeps your data backed up and synced across devices. ' +
                'Upgrade to Tarteeb Pro to unlock.' +
            '</p>' +
            '<div class="flex flex-col gap-2">' +
                '<button class="paywall-upgrade w-full py-2.5 rounded-xl text-[13px] font-semibold text-white ' +
                              'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 transition-all ' +
                              'shadow-[0_0_20px_rgba(251,191,36,0.2)]">' +
                    'Upgrade to Pro' +
                '</button>' +
                '<button class="paywall-close w-full py-2.5 rounded-xl text-[13px] font-medium ' +
                              'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-colors">' +
                    'Maybe Later' +
                '</button>' +
            '</div>' +
        '</div>';

    overlay.appendChild(backdrop);
    overlay.appendChild(card);
    portal.appendChild(overlay);
    portal.style.pointerEvents = 'auto';

    function close() { closePaywall(); }

    card.querySelector('.paywall-upgrade').addEventListener('click', function () {
        trackEvent('checkout_started', { source: 'app_paywall' });
        handleUpgradeClick();
    });
    card.querySelector('.paywall-close').addEventListener('click', close);
    backdrop.addEventListener('click', close);

    document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', handler);
        }
    });
}

/* ── Internal ──────────────────────────────────────────────── */

function closePaywall() {
    var existing = document.getElementById('paywall-modal');
    if (existing) existing.remove();

    var portal = document.getElementById('modal-portal');
    if (portal) portal.style.pointerEvents = 'none';
}
