/**
 * Life OS — Finance Summary
 *
 * Premium stat dashboard: hero balance card + income/expense split.
 * Wire: pass { totals, weekTotals, monthTotals } from the store.
 */

import { formatCurrency } from '../domain/finance-rules.js';

export function createFinanceSummary(stats) {
    var s = stats || {};
    var totals    = s.totals    || { income: 0, expenses: 0, net: 0 };
    var week      = s.weekTotals  || { income: 0, expenses: 0, net: 0 };
    var month     = s.monthTotals || { income: 0, expenses: 0, net: 0 };

    var root = document.createElement('div');
    root.className = 'space-y-4 mb-6';

    /* ── Row 1: Hero Balance ─────────────────────────────── */

    var hero = document.createElement('div');
    hero.className = [
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br from-accent-finance/10 via-surface-raised/80 to-surface-raised/40',
        'border border-accent-finance/10',
        'px-6 py-5',
    ].join(' ');

    /* Decorative glow */
    hero.innerHTML =
        '<div class="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-accent-finance/[0.06] blur-3xl pointer-events-none"></div>' +
        '<div class="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-accent-finance/[0.04] blur-2xl pointer-events-none"></div>' +
        '<div class="relative">' +
            '<div class="flex items-center gap-2 mb-1">' +
                '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 text-accent-finance/60">' +
                    '<path d="M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718H4zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.879c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73l.348.086z"/>' +
                '</svg>' +
                '<span class="text-[11px] font-semibold text-accent-finance/70 uppercase tracking-widest">Total Balance</span>' +
            '</div>' +
            '<div class="text-[32px] font-heading font-bold text-text-primary leading-none tracking-tight tabular-nums mb-3">' +
                formatCurrency(totals.net) +
            '</div>' +
            '<div class="flex items-center gap-4">' +
                _statPill('Income', totals.income, 'text-status-success', 'bg-status-success/10') +
                '<div class="w-px h-5 bg-white/[0.06]"></div>' +
                _statPill('Expenses', totals.expenses, 'text-status-error', 'bg-status-error/10') +
                '<div class="flex-1"></div>' +
                '<div class="text-[11px] text-text-disabled font-medium">' +
                    '<span class="text-text-tertiary">' + _txCount(s) + ' txns</span>' +
                '</div>' +
            '</div>' +
        '</div>';

    root.appendChild(hero);

    /* ── Row 2: Period Split ─────────────────────────────── */

    var periods = document.createElement('div');
    periods.className = 'grid grid-cols-2 gap-3';

    periods.appendChild(_periodCard('This Week', week));
    periods.appendChild(_periodCard('This Month', month));

    root.appendChild(periods);

    return root;
}

/* ── Internal Builders ──────────────────────────────────── */

function _statPill(label, amount, textColor, bgColor) {
    return '<div class="flex items-center gap-1.5">' +
        '<span class="w-1.5 h-1.5 rounded-full ' + bgColor.replace('/10', '') + '"></span>' +
        '<span class="text-[11px] text-text-tertiary">' + label + '</span>' +
        '<span class="text-[12px] font-semibold ' + textColor + ' tabular-nums">' + formatCurrency(amount) + '</span>' +
    '</div>';
}

function _periodCard(label, data) {
    var isPositive = data.net >= 0;

    var card = document.createElement('div');
    card.className = [
        'rounded-xl bg-surface-raised/50 border border-white/[0.04]',
        'px-4 py-3.5',
        'hover:bg-surface-elevated/40 hover:border-white/[0.06]',
        'transition-all duration-200',
    ].join(' ');

    card.innerHTML =
        '<div class="flex items-center justify-between mb-2.5">' +
            '<span class="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">' + label + '</span>' +
            '<span class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ' +
                (isPositive ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error') + '">' +
                (isPositive ? _arrowUp() : _arrowDown()) +
                formatCurrency(Math.abs(data.net)) +
            '</span>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-3">' +
            '<div>' +
                '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-0.5">Income</div>' +
                '<div class="text-[15px] font-heading font-semibold text-status-success leading-none tabular-nums">' +
                    formatCurrency(data.income) +
                '</div>' +
            '</div>' +
            '<div class="text-right">' +
                '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-0.5">Expenses</div>' +
                '<div class="text-[15px] font-heading font-semibold text-status-error leading-none tabular-nums">' +
                    formatCurrency(data.expenses) +
                '</div>' +
            '</div>' +
        '</div>';

    return card;
}

function _txCount(s) {
    var txns = s.transactions;
    if (Array.isArray(txns)) return txns.length;
    return '0';
}

function _arrowUp() {
    return '<svg viewBox="0 0 10 10" fill="currentColor" class="w-2.5 h-2.5"><path d="M5 2.5l4 5H1z"/></svg>';
}

function _arrowDown() {
    return '<svg viewBox="0 0 10 10" fill="currentColor" class="w-2.5 h-2.5"><path d="M5 7.5l4-5H1z"/></svg>';
}
