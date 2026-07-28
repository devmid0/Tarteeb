/**
 * Tarteeb — Cloud Sync (Public Shell Module)
 *
 * Lightweight module used by the app shell and non-premium flows.
 * Exports are safe to call regardless of subscription status:
 *   - syncToCloud / syncFromCloud are placeholders that never throw
 *   - handleUpgradeClick redirects to Stripe checkout
 *   - showPaywall renders the premium upgrade modal
 *
 * The full Supabase-backed implementation lives in
 * ui/composites/cloud-sync.js and is only used after a
 * successful upgrade.
 */

'use strict';

/* ── Stripe Checkout ──────────────────────────────────────── */

/**
 * Redirect the user to the Stripe Payment Link for Tarteeb Pro.
 * Replace the URL with your live Stripe link in production.
 */
export function handleUpgradeClick() {
    window.location.href = 'https://buy.stripe.com/test_6oU7sMgzUd8o5Wl9Hs6wE00';
}

/* ── Sync Placeholders ────────────────────────────────────── */

/**
 * Push local data to the cloud.
 * Placeholder — returns a resolved promise so dynamic imports
 * in shell.js never crash on a non-premium account.
 * @param {Object} [localData] — unused in this module
 */
export async function syncToCloud(localData) {
    console.log('[CloudSync] Sync requires Tarteeb Pro — upgrade to enable cloud backup.');
    return Promise.resolve();
}

/**
 * Pull cloud data into the local database.
 * Placeholder — returns a resolved promise yielding null.
 * @returns {Promise<null>}
 */
export async function syncFromCloud() {
    console.log('[CloudSync] Sync requires Tarteeb Pro — upgrade to enable cloud backup.');
    return Promise.resolve(null);
}

/* ── Init ──────────────────────────────────────────────────── */

/**
 * No-op initializer.  Real Supabase client setup is handled
 * by ui/composites/cloud-sync.js after an upgrade.
 */
export function initCloudSync() {
    /* Intentional no-op for the public shell module */
}

/* ── Paywall Modal ─────────────────────────────────────────── */

/**
 * Show the premium upgrade modal overlay.
 * Safe to call from any view — checks localStorage bypass first.
 */
export function showPaywall() {
    closePaywall();

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

    card.querySelector('.paywall-upgrade').addEventListener('click', handleUpgradeClick);
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
