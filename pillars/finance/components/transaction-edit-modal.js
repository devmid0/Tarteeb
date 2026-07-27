/**
 * Tarteeb — Transaction Edit Modal
 *
 * Full transaction editor rendered into the #modal-portal.
 * Handles amount, type, category, date, and description.
 *
 * Lifecycle:
 *   openTransactionEditModal(tx, onSave, onDelete) — renders + shows
 *   closeTransactionEditModal()                     — tears down + removes
 *
 * Design: glassmorphic overlay, centered card, entrance animation.
 */

'use strict';

import {
    TX_TYPE,
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    CATEGORY_META,
    formatCurrency,
} from '../domain/finance-rules.js';

var TYPE_META = {
    expense: { label: 'Expense', dotClass: 'bg-status-error' },
    income:  { label: 'Income',  dotClass: 'bg-status-success' },
};

var _activeModal = null;

/**
 * Show the edit modal.
 *
 * @param {Object}   transaction — full transaction object
 * @param {Function} onSave      — called with patch { id, ...fields }
 * @param {Function} onDelete    — called with transaction id
 */
export function openTransactionEditModal(transaction, onSave, onDelete) {
    closeTransactionEditModal();

    var portal = document.getElementById('modal-portal');
    if (!portal) return;

    var currentType = transaction.type || TX_TYPE.EXPENSE;
    var currentCategory = transaction.category || 'other';

    /* ── Overlay ── */
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    overlay.style.pointerEvents = 'auto';

    /* ── Backdrop ── */
    var backdrop = document.createElement('div');
    backdrop.className = 'absolute inset-0 bg-black/60 backdrop-blur-sm animate-entrance';

    /* ── Card ── */
    var card = document.createElement('div');
    card.className = [
        'relative bg-surface-raised rounded-2xl shadow-modal w-full max-w-lg',
        'border border-white/[0.06]',
        'animate-entrance',
    ].join(' ');

    card.innerHTML =
        '<div class="p-6">' +

            /* Header */
            '<div class="flex items-center justify-between mb-5">' +
                '<h2 class="text-lg font-heading font-semibold text-text-primary">Edit Transaction</h2>' +
                '<button class="modal-close-btn p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-colors">' +
                    '<svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>' +
                '</button>' +
            '</div>' +

            /* Form fields */
            '<div class="space-y-4">' +

                /* Amount */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Amount</label>' +
                    '<input type="number" class="edit-amount w-full bg-surface-elevated text-[18px] font-heading font-semibold text-text-primary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-finance/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" min="0" step="0.01" placeholder="0.00">' +
                '</div>' +

                /* Type + Category row */
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div>' +
                        '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Type</label>' +
                        '<div class="relative">' +
                            '<button type="button" class="edit-type-trigger w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-elevated border border-white/[0.06] hover:border-white/[0.1] transition-colors">' +
                                '<span class="edit-type-dot w-2.5 h-2.5 rounded-full"></span>' +
                                '<span class="edit-type-label text-[13px] text-text-secondary flex-1 text-left"></span>' +
                                '<svg viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3 text-text-disabled"><path d="M3 5l3 3 3-3"/></svg>' +
                            '</button>' +
                            '<div class="edit-type-dropdown hidden absolute left-0 top-full mt-1 z-20 bg-surface-floating rounded-lg shadow-floating border border-white/[0.06] py-1 w-full"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div>' +
                        '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Category</label>' +
                        '<select class="edit-category w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-finance/50 transition-colors [color-scheme:dark]"></select>' +
                    '</div>' +
                '</div>' +

                /* Date */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Date</label>' +
                    '<input type="date" class="edit-date w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-finance/50 transition-colors [color-scheme:dark]">' +
                '</div>' +

                /* Description */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Description</label>' +
                    '<textarea rows="2" class="edit-desc w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-finance/50 transition-colors resize-none placeholder:text-text-disabled"></textarea>' +
                '</div>' +

                /* Timestamps */
                '<div class="flex items-center gap-4 text-[11px] text-text-disabled pt-1">' +
                    '<span>Created: ' + formatDate(transaction.createdAt) + '</span>' +
                    '<span>Updated: ' + formatDate(transaction.updatedAt) + '</span>' +
                '</div>' +

            '</div>' +

            /* Footer actions */
            '<div class="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">' +
                '<button class="edit-delete-btn px-3 py-2 rounded-lg text-[12px] font-medium text-status-error/70 hover:text-status-error hover:bg-status-error/10 transition-colors">' +
                    'Delete Transaction' +
                '</button>' +
                '<div class="flex items-center gap-2">' +
                    '<button class="edit-cancel-btn px-4 py-2 rounded-lg text-[13px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-colors">' +
                        'Cancel' +
                    '</button>' +
                    '<button class="edit-save-btn px-5 py-2 rounded-lg text-[13px] font-medium bg-accent-finance text-white hover:brightness-110 transition-all shadow-[0_0_16px_rgba(96,165,250,0.15)]">' +
                        'Save Changes' +
                    '</button>' +
                '</div>' +
            '</div>';

    overlay.appendChild(backdrop);
    overlay.appendChild(card);
    portal.appendChild(overlay);
    portal.style.pointerEvents = 'auto';

    _activeModal = overlay;

    /* ── Populate fields ── */

    var amountInput = card.querySelector('.edit-amount');
    var dateInput   = card.querySelector('.edit-date');
    var descInput   = card.querySelector('.edit-desc');
    var categorySelect = card.querySelector('.edit-category');
    var typeDot     = card.querySelector('.edit-type-dot');
    var typeLabel   = card.querySelector('.edit-type-label');
    var typeDropdown = card.querySelector('.edit-type-dropdown');
    var typeTrigger = card.querySelector('.edit-type-trigger');

    amountInput.value = transaction.amount || '';
    dateInput.value   = transaction.date || '';
    descInput.value   = transaction.description || '';

    /* ── Type dropdown ── */
    function setType(type) {
        currentType = type;
        var meta = TYPE_META[type] || TYPE_META.expense;
        typeDot.className = 'edit-type-dot w-2.5 h-2.5 rounded-full ' + meta.dotClass;
        typeLabel.textContent = meta.label;
        populateCategories(type);
    }

    function populateCategories(type) {
        var cats = type === TX_TYPE.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        categorySelect.innerHTML = '';
        for (var i = 0; i < cats.length; i++) {
            var opt = document.createElement('option');
            opt.value = cats[i];
            var meta = CATEGORY_META[cats[i]];
            opt.textContent = (meta ? meta.icon + ' ' : '') + (meta ? meta.label : cats[i]);
            if (cats[i] === currentCategory) opt.selected = true;
            categorySelect.appendChild(opt);
        }
        if (cats.indexOf(currentCategory) === -1) {
            currentCategory = 'other';
            categorySelect.value = 'other';
        }
    }

    /* Build type dropdown options */
    typeDropdown.innerHTML = '';
    var typeKeys = Object.keys(TYPE_META);
    for (var t = 0; t < typeKeys.length; t++) {
        (function (key) {
            var meta = TYPE_META[key];
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'w-full flex items-center gap-2 px-3 py-2 text-[12px] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary transition-colors';
            btn.innerHTML = '<span class="w-2 h-2 rounded-full ' + meta.dotClass + '"></span>' + meta.label;
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                setType(key);
                typeDropdown.classList.add('hidden');
            });
            typeDropdown.appendChild(btn);
        })(typeKeys[t]);
    }

    typeTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        typeDropdown.classList.toggle('hidden');
    });

    /* Close dropdown on clicks inside card */
    card.addEventListener('click', function (e) {
        if (!typeTrigger.contains(e.target) && !typeDropdown.contains(e.target)) {
            typeDropdown.classList.add('hidden');
        }
    });

    /* Initialize type + categories */
    setType(currentType);

    /* ── Close handlers ── */

    function close() { closeTransactionEditModal(); }

    card.querySelector('.modal-close-btn').addEventListener('click', close);
    card.querySelector('.edit-cancel-btn').addEventListener('click', close);
    backdrop.addEventListener('click', close);

    document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', handler);
        }
    });

    /* ── Save ── */

    card.querySelector('.edit-save-btn').addEventListener('click', function () {
        var rawAmount = amountInput.value;
        var amount = parseFloat(rawAmount);

        var patch = {
            id:          transaction.id,
            amount:      isNaN(amount) ? transaction.amount : amount,
            type:        currentType,
            category:    categorySelect.value,
            date:        dateInput.value || transaction.date,
            description: descInput.value.trim(),
        };

        if (!patch.amount || patch.amount <= 0) {
            amountInput.focus();
            return;
        }

        if (onSave) onSave(patch);
        closeTransactionEditModal();
    });

    /* ── Delete ── */

    card.querySelector('.edit-delete-btn').addEventListener('click', function () {
        if (onDelete) onDelete(transaction.id);
        closeTransactionEditModal();
    });

    /* Focus amount on open */
    requestAnimationFrame(function () { amountInput.focus(); amountInput.select(); });
}

/**
 * Close and tear down the active modal.
 */
export function closeTransactionEditModal() {
    if (_activeModal) {
        _activeModal.remove();
        _activeModal = null;
    }
    var portal = document.getElementById('modal-portal');
    if (portal) {
        portal.style.pointerEvents = 'none';
    }
}

/* ── Helpers ── */

function formatDate(iso) {
    if (!iso) return '\u2014';
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    } catch (e) {
        return '\u2014';
    }
}
