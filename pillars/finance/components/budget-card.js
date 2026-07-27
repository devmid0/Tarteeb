/**
 * Tarteeb — Budget Card Component
 *
 * Displays a single budget with its spending progress bar.
 * Shows spent amount, limit, remaining, and percentage.
 * Includes a delete button.
 *
 * Visual behavior:
 *   Progress bar → green when under budget, red when over
 *   Percentage → bold when over budget
 *   Delete → confirms before removing
 */

import { formatCurrency, CATEGORY_META, BUDGET_PERIOD_LABELS } from '../domain/finance-rules.js';

/**
 * Build a budget card element.
 *
 * @param {Object} status — { budget, spent, remaining, percentage, overBudget }
 * @param {Object} callbacks
 * @param {Function} callbacks.onDelete — called with budget id
 * @returns {HTMLElement}
 */
export function createBudgetCard(status, callbacks) {
    var cbs = callbacks || {};
    var budget = status.budget;
    var el = document.createElement('div');

    el.className = [
        'rounded-xl bg-surface-raised/50 border border-white/[0.04]',
        'px-4 py-3 transition-all duration-200',
    ].join(' ');

    var catMeta = CATEGORY_META[budget.category] || CATEGORY_META.other;
    var pct = status.percentage || 0;
    var barColor = status.overBudget ? 'bg-status-error' : 'bg-accent-finance';

    var inner =
        '<div class="flex items-center justify-between mb-2">' +
            '<div class="flex items-center gap-2">' +
                '<span class="text-[14px]">' + catMeta.icon + '</span>' +
                '<span class="text-[13px] font-medium text-text-primary">' + catMeta.label + '</span>' +
                '<span class="text-[10px] text-text-disabled px-1.5 py-0.5 rounded bg-white/[0.04]">' +
                    (BUDGET_PERIOD_LABELS[budget.period] || budget.period) +
                '</span>' +
            '</div>' +
            '<button class="budget-delete-btn p-1.5 rounded-lg text-text-disabled hover:text-status-error hover:bg-status-error/10 transition-colors duration-150 opacity-0 group-hover:opacity-100"' +
                    ' data-budget-id="' + budget.id + '" title="Delete budget">' +
                '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>' +
            '</button>' +
        '</div>' +
        '<div class="flex items-center gap-3 mb-2">' +
            '<div class="flex-1">' +
                '<div class="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">' +
                    '<div class="h-full rounded-full ' + barColor + ' transition-all duration-500 ease-out" style="width: ' + pct + '%"></div>' +
                '</div>' +
            '</div>' +
            '<span class="text-[12px] font-medium tabular-nums ' +
                (status.overBudget ? 'text-status-error' : 'text-text-secondary') + '">' +
                pct + '%' +
            '</span>' +
        '</div>' +
        '<div class="flex items-center justify-between text-[11px]">' +
            '<span class="text-text-tertiary">' +
                '<span class="font-medium text-text-secondary">' + formatCurrency(status.spent) + '</span> spent' +
            '</span>' +
            '<span class="text-text-tertiary">' +
                'of ' + formatCurrency(budget.limit) +
            '</span>' +
            '<span class="' + (status.overBudget ? 'text-status-error font-medium' : 'text-text-tertiary') + '">' +
                (status.overBudget ? 'Over by ' + formatCurrency(status.spent - budget.limit) : formatCurrency(status.remaining) + ' left') +
            '</span>' +
        '</div>';

    el.innerHTML = inner;
    el.classList.add('group');

    /* ── Wire delete button ── */
    var deleteBtn = el.querySelector('.budget-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (cbs.onDelete) cbs.onDelete(budget.id);
        });
    }

    return el;
}
