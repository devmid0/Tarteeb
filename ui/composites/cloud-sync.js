'use strict';

const SUPABASE_URL = 'https://rhstnoegynxqaveqnbju.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bSqzZAZgyo8iNNcH2jeggQ_luXGlgDs';

let _supabase = null;
let _database = null;
let _eventBus = null;

/* ── Store → Table mapping ─────────────────────────────────── */

var TABLE_MAP = {
    'finance-transactions': 'transactions',
    'finance-budgets':      'budgets',
    'tasks-items':          'tasks',
    'tasks-projects':       'projects',
    'habits-definitions':   'habits',
    'habits-records':       'habit_records',
    'goals-items':          'goals',
    'goals-milestones':     'milestones',
};

/* ── Init ─────────────────────────────────────────────────── */

export function initCloudSync(database, eventBus) {
    _database = database;
    _eventBus = eventBus;

    try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
    } catch (err) {
        console.error('[CloudSync] Failed to init Supabase client:', err);
    }
}

/* ── Push ──────────────────────────────────────────────────── */

export async function syncToCloud(localData) {
    try {
        var session = await _getSession();
        if (!session) {
            console.log('[CloudSync] No session — skipping push');
            return;
        }

        var userId = session.user.id;
        var storeKeys = Object.keys(TABLE_MAP);

        for (var i = 0; i < storeKeys.length; i++) {
            var storeName = storeKeys[i];
            var tableName = TABLE_MAP[storeName];
            var records = localData[storeName];

            if (!records || records.length === 0) continue;

            var rows = records.map(function (r) {
                var copy = Object.assign({}, r, { user_id: userId });
                return copy;
            });

            var { error } = await _supabase
                .from(tableName)
                .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });

            if (error) {
                console.error('[CloudSync] Push failed for ' + tableName + ':', error.message);
            } else {
                console.log('[CloudSync] Pushed ' + rows.length + ' rows to ' + tableName);
            }
        }

        _eventBus?.publish('cloud:synced', { direction: 'push', timestamp: new Date().toISOString() });
        console.log('[CloudSync] Push complete');
    } catch (err) {
        console.error('[CloudSync] Push error:', err);
    }
}

/* ── Pull ──────────────────────────────────────────────────── */

export async function syncFromCloud() {
    try {
        var session = await _getSession();
        if (!session) {
            console.log('[CloudSync] No session — skipping pull');
            return null;
        }

        var userId = session.user.id;
        var allData = {};
        var storeKeys = Object.keys(TABLE_MAP);

        for (var i = 0; i < storeKeys.length; i++) {
            var storeName = storeKeys[i];
            var tableName = TABLE_MAP[storeName];

            var { data, error } = await _supabase
                .from(tableName)
                .select('*')
                .eq('user_id', userId);

            if (error) {
                console.error('[CloudSync] Pull failed for ' + tableName + ':', error.message);
                continue;
            }

            /* Strip user_id from each row before returning */
            var cleaned = (data || []).map(function (r) {
                var copy = Object.assign({}, r);
                delete copy.user_id;
                return copy;
            });

            allData[storeName] = cleaned;
            console.log('[CloudSync] Pulled ' + cleaned.length + ' rows from ' + tableName);
        }

        _eventBus?.publish('cloud:synced', { direction: 'pull', timestamp: new Date().toISOString() });
        console.log('[CloudSync] Pull complete');
        return allData;
    } catch (err) {
        console.error('[CloudSync] Pull error:', err);
        return null;
    }
}

/* ── Session Helper ────────────────────────────────────────── */

async function _getSession() {
    if (!_supabase) return null;
    try {
        var { data, error } = await _supabase.auth.getSession();
        if (error || !data?.session) return null;
        return data.session;
    } catch (err) {
        console.error('[CloudSync] Session check error:', err);
        return null;
    }
}

/* ── Paywall Modal (manual trigger only) ─────────────────── */

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
                    '<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>' +
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
    var existing = document.getElementById('paywall-modal');
    if (existing) existing.remove();

    var portal = document.getElementById('modal-portal');
    if (portal) portal.style.pointerEvents = 'none';
}
