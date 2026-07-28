/**
 * Tarteeb — Cloud Sync (Premium)
 *
 * Exports syncToCloud / syncFromCloud backed by Supabase.
 * All sync operations are gated behind a premium check.
 */

'use strict';

const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY  = 'YOUR_ANON_KEY';
const SYNC_TABLE    = 'user_data';

let _supabase = null;
let _database = null;
let _eventBus = null;

/* ── Init ─────────────────────────────────────────────────── */

export function initCloudSync(database, eventBus) {
    _database = database;
    _eventBus = eventBus;

    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
}

/* ── Premium Gate ─────────────────────────────────────────── */

function getCurrentUser() {
    return window.__tarteeb?.user || null;
}

function requirePremium() {
    const user = getCurrentUser();
    if (!user || !user.isPremium) {
        showPaywall();
        return false;
    }
    if (!_supabase) {
        console.warn('[CloudSync] Supabase client not initialised');
        return false;
    }
    return true;
}

/* ── Push to Cloud ────────────────────────────────────────── */

export async function syncToCloud() {
    if (!requirePremium()) return;

    const user = getCurrentUser();
    const payload = await _database.exportAll();

    const row = {
        user_id:  user.id,
        data:     payload,
        updated:  new Date().toISOString(),
    };

    const { error } = await _supabase
        .from(SYNC_TABLE)
        .upsert(row, { onConflict: 'user_id' });

    if (error) {
        console.error('[CloudSync] Push failed:', error);
        throw error;
    }

    _eventBus?.publish('cloud:synced', { direction: 'push', timestamp: row.updated });
    return row.updated;
}

/* ── Pull from Cloud ──────────────────────────────────────── */

export async function syncFromCloud() {
    if (!requirePremium()) return;

    const user = getCurrentUser();

    const { data, error } = await _supabase
        .from(SYNC_TABLE)
        .select('data, updated')
        .eq('user_id', user.id)
        .single();

    if (error) {
        console.error('[CloudSync] Pull failed:', error);
        throw error;
    }

    if (!data?.data) {
        console.warn('[CloudSync] No remote data found');
        return null;
    }

    await _database.importAll(data.data);
    _eventBus?.publish('cloud:synced', { direction: 'pull', timestamp: data.updated });

    return data.updated;
}

/* ── Paywall Modal ────────────────────────────────────────── */

export function showPaywall() {
    closePaywall();

    const portal = document.getElementById('modal-portal');
    if (!portal) return;

    const overlay = document.createElement('div');
    overlay.id = 'paywall-modal';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    overlay.style.pointerEvents = 'auto';

    const backdrop = document.createElement('div');
    backdrop.className = 'absolute inset-0 bg-black/60 backdrop-blur-sm animate-entrance';

    const card = document.createElement('div');
    card.className = [
        'relative bg-surface-raised rounded-2xl shadow-modal w-full max-w-sm',
        'border border-white/[0.06]',
        'animate-entrance',
    ].join(' ');

    card.innerHTML =
        '<div class="p-6 text-center">' +

            /* Icon */
            '<div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 ' +
                        'flex items-center justify-center shadow-[0_0_24px_rgba(251,191,36,0.25)] mb-5">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" class="w-7 h-7">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>' +
                '</svg>' +
            '</div>' +

            '<h2 class="text-lg font-heading font-semibold text-text-primary mb-2">Premium Feature</h2>' +
            '<p class="text-[13px] text-text-secondary leading-relaxed mb-6">' +
                'Cloud Sync keeps your data backed up and synced across devices. ' +
                'Upgrade to Tarteeb Pro to unlock.' +
            '</p>' +

            /* Actions */
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

    /* Close handlers */
    function close() { closePaywall(); }

    card.querySelector('.paywall-close').addEventListener('click', close);
    backdrop.addEventListener('click', close);

    document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', handler);
        }
    });
}

function closePaywall() {
    const existing = document.getElementById('paywall-modal');
    if (existing) existing.remove();

    const portal = document.getElementById('modal-portal');
    if (portal) portal.style.pointerEvents = 'none';
}
