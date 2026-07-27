/**
 * Life OS — Transaction Form
 *
 * Premium inline expandable form for creating transactions.
 * Collapses into a single-row prompt; expands into a polished
 * form with live currency formatting, custom type/category
 * selectors, and keyboard-first submission.
 */

import {
    TX_TYPE,
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    CATEGORY_META,
} from '../domain/finance-rules.js';

var TYPE_OPTIONS = [
    { value: TX_TYPE.EXPENSE, label: 'Expense',  color: 'bg-status-error',  ring: 'ring-status-error/20', text: 'text-status-error' },
    { value: TX_TYPE.INCOME,  label: 'Income',   color: 'bg-status-success', ring: 'ring-status-success/20', text: 'text-status-success' },
];

export function createTransactionForm(opts) {
    var onSubmit = opts && opts.onSubmit;

    var wrapper = document.createElement('div');
    wrapper.className = 'mb-3';

    var expanded      = false;
    var currentType   = TX_TYPE.EXPENSE;
    var currentCat    = 'food';

    /* ── Collapsed Trigger ───────────────────────────────── */

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = [
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl',
        'bg-surface-raised/30 border border-dashed border-white/[0.06]',
        'hover:border-accent-finance/25 hover:bg-surface-raised/50',
        'focus:outline-none focus:border-accent-finance/40 focus:bg-surface-raised/50',
        'transition-all duration-200 group',
    ].join(' ');

    trigger.innerHTML =
        '<span class="flex-shrink-0 w-7 h-7 rounded-lg bg-accent-finance/10 flex items-center justify-center' +
                ' text-accent-finance text-[15px] font-medium leading-none' +
                ' group-hover:bg-accent-finance/15 transition-colors duration-200">+</span>' +
        '<span class="text-[13px] text-text-tertiary group-hover:text-text-secondary transition-colors duration-200 select-none">' +
            'Add a transaction\u2026' +
        '</span>';

    trigger.addEventListener('click', function () { expand(); });

    /* ── Expanded Panel ──────────────────────────────────── */

    var panel = document.createElement('div');
    panel.className = [
        'rounded-xl bg-surface-raised border border-white/[0.06]',
        'max-h-0 opacity-0',
        'transition-all duration-[300ms] ease-[cubic-bezier(0.45,0,0.55,1)]',
    ].join(' ');

    panel.innerHTML = _buildFormHTML();

    /* ── Expand / Collapse ───────────────────────────────── */

    function expand() {
        if (expanded) return;
        expanded = true;
        trigger.classList.add('hidden');
        panel.classList.remove('max-h-0', 'opacity-0');
        panel.classList.add('max-h-[500px]', 'opacity-100');
        panel.style.overflow = 'visible';
        _setDefaultDate();
        _syncTypeUI();
        var amt = panel.querySelector('.f-amount');
        if (amt) requestAnimationFrame(function () { amt.focus(); });
    }

    function collapse() {
        expanded = false;
        panel.style.overflow = 'hidden';
        panel.classList.add('max-h-0', 'opacity-0');
        panel.classList.remove('max-h-[500px]', 'opacity-100');
        trigger.classList.remove('hidden');
        _resetForm();
    }

    /* ── Type Selector ───────────────────────────────────── */

    function _syncTypeUI() {
        var meta = _typeMeta(currentType);

        /* Trigger button */
        var typeBtn = panel.querySelector('.f-type-btn');
        if (typeBtn) {
            typeBtn.className = typeBtn.className.replace(/bg-\S+/g, '').replace(/text-\S+/g, '');
            typeBtn.className = [
                'f-type-btn flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium',
                'border transition-all duration-200',
                'hover:brightness-110',
                meta.btnClasses,
            ].join(' ');
            typeBtn.innerHTML =
                '<span class="w-2 h-2 rounded-full ' + meta.dot + '"></span>' +
                '<span>' + meta.label + '</span>' +
                '<svg viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3 opacity-40 ml-auto"><path d="M3 5l3 3 3-3"/></svg>';
        }

        /* Dropdown highlight */
        var opts = panel.querySelectorAll('.f-type-opt');
        for (var i = 0; i < opts.length; i++) {
            var isActive = opts[i].dataset.type === currentType;
            opts[i].className = [
                'f-type-opt w-full flex items-center gap-2.5 px-3 py-2 text-[12px] rounded-lg transition-all duration-100',
                isActive
                    ? 'bg-white/[0.06] text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary',
            ].join(' ');
        }

        _populateCategories(currentType);
    }

    function _typeMeta(type) {
        if (type === TX_TYPE.INCOME) {
            return {
                label: 'Income',
                dot: 'bg-status-success',
                btnClasses: 'bg-status-success/[0.08] border-status-success/20 text-status-success',
            };
        }
        return {
            label: 'Expense',
            dot: 'bg-status-error',
            btnClasses: 'bg-status-error/[0.08] border-status-error/20 text-status-error',
        };
    }

    /* ── Category Selector ───────────────────────────────── */

    function _populateCategories(type) {
        var cats = type === TX_TYPE.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        var grid = panel.querySelector('.f-cat-grid');
        if (!grid) return;
        grid.innerHTML = '';

        for (var i = 0; i < cats.length; i++) {
            (function (catKey) {
                var meta = CATEGORY_META[catKey] || CATEGORY_META.other;
                var isActive = catKey === currentCat;

                var chip = document.createElement('button');
                chip.type = 'button';
                chip.dataset.cat = catKey;
                chip.className = [
                    'f-cat-chip flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium',
                    'border transition-all duration-150',
                    isActive
                        ? 'bg-accent-finance/10 border-accent-finance/20 text-accent-finance'
                        : 'bg-white/[0.02] border-white/[0.04] text-text-tertiary hover:bg-white/[0.04] hover:text-text-secondary hover:border-white/[0.08]',
                ].join(' ');

                chip.innerHTML =
                    '<span class="text-[13px] leading-none">' + meta.icon + '</span>' +
                    '<span>' + meta.label + '</span>';

                chip.addEventListener('click', function (e) {
                    e.stopPropagation();
                    currentCat = catKey;
                    _highlightCategory();
                });

                grid.appendChild(chip);
            })(cats[i]);
        }
    }

    function _highlightCategory() {
        var chips = panel.querySelectorAll('.f-cat-chip');
        for (var i = 0; i < chips.length; i++) {
            var isActive = chips[i].dataset.cat === currentCat;
            chips[i].className = [
                'f-cat-chip flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium',
                'border transition-all duration-150',
                isActive
                    ? 'bg-accent-finance/10 border-accent-finance/20 text-accent-finance'
                    : 'bg-white/[0.02] border-white/[0.04] text-text-tertiary hover:bg-white/[0.04] hover:text-text-secondary hover:border-white/[0.08]',
            ].join(' ');
        }
    }

    /* ── Helpers ─────────────────────────────────────────── */

    function _setDefaultDate() {
        var d = panel.querySelector('.f-date');
        if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
    }

    function _resetForm() {
        var amt  = panel.querySelector('.f-amount');
        var desc = panel.querySelector('.f-desc');
        if (amt)  amt.value = '';
        if (desc) desc.value = '';
        currentType = TX_TYPE.EXPENSE;
        currentCat  = 'food';
        _syncTypeUI();
    }

    function _gather() {
        var amt  = panel.querySelector('.f-amount');
        var desc = panel.querySelector('.f-desc');
        var date = panel.querySelector('.f-date');
        var raw  = amt ? amt.value : '';
        var num  = parseFloat(raw);

        return {
            amount:      isNaN(num) ? 0 : num,
            type:        currentType,
            category:    currentCat,
            date:        (date && date.value) || new Date().toISOString().slice(0, 10),
            description: desc ? desc.value.trim() : '',
        };
    }

    function _submit() {
        var data = _gather();
        if (!data.amount || data.amount <= 0) {
            var a = panel.querySelector('.f-amount');
            if (a) { a.focus(); a.classList.add('ring-2', 'ring-status-error/40'); setTimeout(function () { a.classList.remove('ring-2', 'ring-status-error/40'); }, 600); }
            return;
        }
        if (onSubmit) onSubmit(data);
        collapse();
    }

    /* ── Wire Events ─────────────────────────────────────── */

    /* Type dropdown toggle */
    var typeBtn = panel.querySelector('.f-type-btn');
    var typeDrop = panel.querySelector('.f-type-drop');
    if (typeBtn) {
        typeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            typeDrop.classList.toggle('hidden');
        });
    }

    /* Type option clicks */
    var typeOpts = panel.querySelectorAll('.f-type-opt');
    for (var t = 0; t < typeOpts.length; t++) {
        (function (opt) {
            opt.addEventListener('click', function (e) {
                e.stopPropagation();
                currentType = opt.dataset.type;
                _syncTypeUI();
                typeDrop.classList.add('hidden');
            });
        })(typeOpts[t]);
    }

    /* Close type dropdown on outside click */
    wrapper.addEventListener('click', function (e) {
        if (typeBtn && typeDrop && !typeBtn.contains(e.target) && !typeDrop.contains(e.target)) {
            typeDrop.classList.add('hidden');
        }
    });

    /* Amount: live formatting hint */
    var amtInput = panel.querySelector('.f-amount');
    if (amtInput) {
        amtInput.addEventListener('input', function () {
            var v = parseFloat(amtInput.value);
            var hint = panel.querySelector('.f-amount-hint');
            if (hint) {
                hint.textContent = (!isNaN(v) && v > 0) ? '= ' + formatCurrency(v) : '';
            }
        });
        amtInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _submit(); }
            if (e.key === 'Escape') collapse();
        });
    }

    /* Submit + Cancel */
    var submitBtn = panel.querySelector('.f-submit');
    var cancelBtn = panel.querySelector('.f-cancel');
    if (submitBtn) submitBtn.addEventListener('click', _submit);
    if (cancelBtn) cancelBtn.addEventListener('click', collapse);

    /* ── Assemble ────────────────────────────────────────── */

    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);

    _populateCategories(currentType);

    return wrapper;
}

/* ── Form Template ──────────────────────────────────────── */

function _buildFormHTML() {
    return (
        '<div class="p-4 space-y-4">' +

            /* ── Amount Row ── */
            '<div class="relative">' +
                '<div class="flex items-baseline gap-1">' +
                    '<span class="text-[18px] font-heading font-bold text-text-disabled select-none">$</span>' +
                    '<input type="number"' +
                           ' class="f-amount flex-1 bg-transparent text-[28px] font-heading font-bold text-text-primary' +
                                  ' placeholder:text-text-disabled/40 focus:outline-none w-full' +
                                  ' [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none' +
                                  ' [&::-webkit-inner-spin-button]:appearance-none' +
                                  ' transition-all duration-200"' +
                           ' placeholder="0.00"' +
                           ' min="0" step="0.01"' +
                           ' aria-label="Amount">' +
                '</div>' +
                '<div class="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mt-2"></div>' +
                '<div class="f-amount-hint text-[11px] text-text-disabled mt-1 h-3 tabular-nums"></div>' +
            '</div>' +

            /* ── Type Selector ── */
            '<div class="relative">' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Type</label>' +
                '<button type="button"' +
                        ' class="f-type-btn w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium' +
                               ' bg-status-error/[0.08] border border-status-error/20 text-status-error' +
                               ' hover:brightness-110 transition-all duration-200">' +
                    '<span class="w-2 h-2 rounded-full bg-status-error"></span>' +
                    '<span>Expense</span>' +
                    '<svg viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3 opacity-40 ml-auto"><path d="M3 5l3 3 3-3"/></svg>' +
                '</button>' +
                '<div class="f-type-drop hidden absolute left-0 top-full mt-1.5 z-[100]' +
                            ' bg-surface-floating rounded-xl shadow-floating border border-white/[0.08]' +
                            ' py-1.5 w-full max-w-[200px]">' +
                    '<button type="button" data-type="expense"' +
                            ' class="f-type-opt w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary' +
                                   ' rounded-lg transition-all duration-100' +
                                   ' bg-white/[0.06] text-text-primary font-medium">' +
                        '<span class="w-2 h-2 rounded-full bg-status-error"></span>Expense' +
                    '</button>' +
                    '<button type="button" data-type="income"' +
                            ' class="f-type-opt w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary' +
                                   ' rounded-lg transition-all duration-100 hover:bg-white/[0.04] hover:text-text-primary">' +
                        '<span class="w-2 h-2 rounded-full bg-status-success"></span>Income' +
                    '</button>' +
                '</div>' +
            '</div>' +

            /* ── Category Grid ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Category</label>' +
                '<div class="f-cat-grid flex flex-wrap gap-1.5"></div>' +
            '</div>' +

            /* ── Date + Description Row ── */
            '<div class="grid grid-cols-[auto_1fr] gap-3 items-end">' +
                '<div>' +
                    '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Date</label>' +
                    '<input type="date"' +
                           ' class="f-date bg-surface-elevated text-[12px] text-text-secondary px-3 py-2 rounded-lg' +
                                  ' border border-white/[0.06] hover:border-white/[0.1] focus:outline-none' +
                                  ' focus:border-accent-finance/40 transition-colors duration-150' +
                                  ' [color-scheme:dark]"' +
                           ' aria-label="Date">' +
                '</div>' +
                '<div>' +
                    '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Description</label>' +
                    '<input type="text"' +
                           ' class="f-desc w-full bg-surface-elevated text-[12px] text-text-secondary px-3 py-2 rounded-lg' +
                                  ' border border-white/[0.06] hover:border-white/[0.1] focus:outline-none' +
                                  ' focus:border-accent-finance/40 transition-colors duration-150' +
                                  ' placeholder:text-text-disabled/50"' +
                           ' placeholder="Optional note"' +
                           ' maxlength="200">' +
                '</div>' +
            '</div>' +

            /* ── Actions ── */
            '<div class="flex items-center gap-2 pt-1">' +
                '<div class="flex-1"></div>' +
                '<button type="button"' +
                        ' class="f-cancel px-3.5 py-2 rounded-lg text-[12px] font-medium text-text-tertiary' +
                               ' hover:text-text-secondary hover:bg-white/[0.04] transition-colors duration-150">' +
                    'Cancel' +
                '</button>' +
                '<button type="button"' +
                        ' class="f-submit inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-semibold' +
                               ' bg-accent-finance text-white' +
                               ' hover:brightness-110 active:scale-[0.97]' +
                               ' transition-all duration-200' +
                               ' shadow-[0_0_20px_-4px_rgba(96,165,250,0.35)]' +
                               ' hover:shadow-[0_0_24px_-2px_rgba(96,165,250,0.45)]">' +
                    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3.5 h-3.5">' +
                        '<path d="M7 3v8M3 7h8"/>' +
                    '</svg>' +
                    'Add Transaction' +
                '</button>' +
            '</div>' +

        '</div>'
    );
}

function formatCurrency(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '$0.00';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
