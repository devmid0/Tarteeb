/**
 * Life OS — Finance View (Main Wrapper)
 *
 * Top-level view for the Finance pillar. Manages section
 * switching (Transactions / Budgets / Reports), hydration,
 * and the shared finance-store instance.
 *
 * Lifecycle:
 *   render()  → builds the shell (header, tabs, content slot)
 *   mount()   → hydrates store, binds events, renders section
 *   unmount() → unsubscribes all listeners, cleans up
 *
 * Design constraints:
 *   - Uses accent-finance color (#60a5fa)
 *   - Filter/sort state lives on the class (survives event-driven re-renders)
 *   - Every card gets onEdit + onDelete callbacks
 *   - Edit modal wired via transaction-edit-modal.js
 *   - Every button wired to dispatch() → gateway
 *   - Single re-render trigger: 'finance:changed'
 */

'use strict';

import { FinanceStore } from '../state/finance-store.js';
import { FinanceGateway } from '../../../persistence/gateways/finance-gateway.js';
import { createFinanceSummary } from '../components/finance-summary.js';
import { createTransactionForm } from '../components/transaction-form.js';
import { createTransactionCard } from '../components/transaction-card.js';
import { openTransactionEditModal } from '../components/transaction-edit-modal.js';
import { createFinanceFilterBar } from '../components/finance-filters.js';
import { createBudgetCard } from '../components/budget-card.js';
import { formatCurrency, TX_TYPE, EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_META, BUDGET_PERIOD, BUDGET_PERIOD_LABELS } from '../domain/finance-rules.js';

var SECTIONS = [
    { id: 'transactions', label: 'Transactions', description: 'Track income and expenses' },
    { id: 'budgets',      label: 'Budgets',      description: 'Set spending limits' },
    { id: 'reports',      label: 'Reports',      description: 'Financial summaries' },
];

export class FinanceView {
    constructor() {
        this.container = null;
        this.store = null;
        this.currentSection = 'transactions';
        this._unsubs = [];

        /* Stable filter/sort state — survives event-driven re-renders */
        this._txFilter = 'all';
        this._txSort   = 'date';
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render(section) {
        this.currentSection = section || 'transactions';

        var fragment = document.createDocumentFragment();

        /* ── Ambient gradient ── */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background = 'radial-gradient(ellipse at 20% 15%, rgba(96,165,250,0.04) 0%, transparent 60%)';

        /* ── Main scrollable container ── */
        var main = document.createElement('div');
        main.className = 'relative h-full p-6 md:p-8 max-w-4xl mx-auto';

        /* ── Header ── */
        var header = document.createElement('header');
        header.className = 'mb-6';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
                '<h1 class="text-[28px] font-heading font-semibold text-text-primary tracking-tight leading-none">' +
                    'Finance' +
                '</h1>' +
                '<span class="text-[12px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
                '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-1">Manage your money.</p>';

        /* ── Section Tabs ── */
        var tabs = document.createElement('div');
        tabs.className = 'flex gap-0.5 p-1 bg-surface-raised/60 rounded-xl mb-6 w-fit';

        for (var i = 0; i < SECTIONS.length; i++) {
            var sec = SECTIONS[i];
            var tab = document.createElement('button');
            var isActive = this.currentSection === sec.id;

            tab.className = [
                'px-4 py-2 rounded-lg text-[13px] font-medium',
                'transition-all duration-[200ms] ease-[cubic-bezier(0.45,0,0.55,1)]',
                isActive
                    ? 'bg-surface-elevated text-text-primary shadow-surface'
                    : 'text-text-tertiary hover:text-text-secondary',
            ].join(' ');
            tab.textContent = sec.label;
            tab.addEventListener('click', (function (secId) {
                return function () { window.location.hash = '/finance/' + secId; };
            })(sec.id));
            tabs.appendChild(tab);
        }

        /* ── Content slot (filled on mount) ── */
        var contentSlot = document.createElement('div');
        contentSlot.id = 'finance-content-slot';
        contentSlot.className = 'animate-entrance';

        main.appendChild(gradient);
        main.appendChild(header);
        main.appendChild(tabs);
        main.appendChild(contentSlot);
        fragment.appendChild(main);

        return fragment;
    }

    async mount(container) {
        this.container = container;

        /* Initialise persistence + state for this pillar */
        var db = window.__lifeOS && window.__lifeOS.database;
        if (db) {
            var gateway = new FinanceGateway(db);
            this.store = new FinanceStore(window.__lifeOS.eventBus, gateway);
            await this.store.hydrate();
        }

        this._renderSection();
        this._bindEvents();
    }

    unmount() {
        for (var i = 0; i < this._unsubs.length; i++) {
            this._unsubs[i]();
        }
        this._unsubs = [];
        this.container = null;
        this.store = null;
    }

    /* ── Shared Card Callbacks ───────────────────────────── */

    _cardCallbacks() {
        var self = this;
        var store = this.store;
        return {
            onEdit: function (id) {
                var tx = store.getTransactionById(id);
                if (!tx) return;
                openTransactionEditModal(tx,
                    function (patch) { store.dispatch({ type: 'UPDATE_TRANSACTION', payload: patch }); },
                    function (txId) { store.dispatch({ type: 'DELETE_TRANSACTION', payload: txId }); }
                );
            },
            onDelete: function (id) {
                if (confirm('Delete this transaction?')) {
                    store.dispatch({ type: 'DELETE_TRANSACTION', payload: id });
                }
            },
        };
    }

    /* ── Section Rendering ────────────────────────────────── */

    _renderSection() {
        var slot = this.container && this.container.querySelector('#finance-content-slot');
        if (!slot) return;

        slot.innerHTML = '';
        slot.className = 'animate-entrance';

        switch (this.currentSection) {
            case 'transactions':
                this._renderTransactionsSection(slot);
                break;
            case 'budgets':
                this._renderBudgetsSection(slot);
                break;
            case 'reports':
                this._renderReportsSection(slot);
                break;
            default:
                this._renderTransactionsSection(slot);
        }
    }

    /* ── Transactions Section ────────────────────────────── */

    _renderTransactionsSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading transactions\u2026</div>';
            return;
        }

        var self = this;
        var cbs = this._cardCallbacks();

        /* Summary stats */
        slot.appendChild(createFinanceSummary({
            totals:      store.getTotals(),
            weekTotals:  store.getWeekTotals(),
            monthTotals: store.getMonthTotals(),
            transactions: store.transactions,
        }));

        /* Inline form */
        slot.appendChild(createTransactionForm({
            onSubmit: function (data) {
                store.dispatch({ type: 'ADD_TRANSACTION', payload: data });
            },
        }));

        /* Filter/sort state — uses class-level fields (stable across re-renders) */
        var renderList = function () {
            var existing = slot.querySelector('.tx-list-container');
            if (existing) existing.remove();

            var transactions = store.getAllTransactions();
            var filter = self._txFilter;
            var sort   = self._txSort;

            if (filter !== 'all') {
                if (filter === 'expense' || filter === 'income') {
                    transactions = store.getTransactionsByType(filter);
                } else {
                    transactions = store.getTransactionsByCategory(filter);
                }
            }

            if (sort === 'amount') {
                transactions = transactions.slice().sort(function (a, b) { return b.amount - a.amount; });
            }
            /* 'date' is default sort from store.getAllTransactions() */

            var container = document.createElement('div');
            container.className = 'tx-list-container';

            if (transactions.length === 0) {
                container.innerHTML =
                    '<div class="text-center py-16">' +
                        '<div class="text-4xl mb-3 opacity-20">\uD83D\uDCB0</div>' +
                        '<p class="text-[14px] text-text-secondary font-medium">No transactions yet</p>' +
                        '<p class="text-[12px] text-text-tertiary mt-1">Add your first transaction above to get started.</p>' +
                    '</div>';
            } else {
                var list = document.createElement('div');
                list.className = 'space-y-1';

                for (var i = 0; i < transactions.length; i++) {
                    list.appendChild(createTransactionCard(transactions[i], cbs));
                }
                container.appendChild(list);
            }

            slot.appendChild(container);
        };

        /* Filter bar — recreated on each renderList() with current state */
        var renderFilterBar = function () {
            var old = slot.querySelector('.tx-filter-bar');
            if (old) old.remove();

            var bar = createFinanceFilterBar({
                activeFilter: self._txFilter,
                activeSort:   self._txSort,
                onFilterChange: function (f) {
                    self._txFilter = f;
                    renderList();
                    renderFilterBar();
                },
                onSortChange: function (s) {
                    self._txSort = s;
                    renderList();
                    renderFilterBar();
                },
            });
            bar.classList.add('tx-filter-bar');
            slot.insertBefore(bar, slot.querySelector('.tx-list-container'));
        };

        renderFilterBar();
        renderList();
    }

    /* ── Budgets Section ─────────────────────────────────── */

    _renderBudgetsSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading budgets\u2026</div>';
            return;
        }

        var self = this;

        /* Budget creation form */
        var form = document.createElement('div');
        form.className = 'mb-6 p-4 rounded-xl bg-surface-raised/40 border border-dashed border-white/[0.06]';
        form.innerHTML =
            '<div class="flex items-center gap-3 flex-wrap">' +
                '<select class="budget-cat-select bg-transparent text-[13px] text-text-secondary px-3 py-2 rounded-lg' +
                           ' border border-white/[0.06] hover:border-white/[0.1] focus:outline-none focus:border-accent-finance/40' +
                           ' transition-colors duration-150 [color-scheme:dark]">' +
                '</select>' +
                '<input type="number"' +
                       ' class="budget-limit-input bg-transparent text-[13px] text-text-primary px-3 py-2 rounded-lg' +
                              ' border border-white/[0.06] hover:border-white/[0.1] focus:outline-none focus:border-accent-finance/40' +
                              ' transition-colors duration-150 w-[120px] [color-scheme:dark] [appearance:textfield]' +
                              ' [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"' +
                       ' placeholder="Limit"' +
                       ' min="0" step="10"' +
                       ' aria-label="Budget limit">' +
                '<select class="budget-period-select bg-transparent text-[11px] text-text-tertiary px-2.5 py-1.5 rounded-lg' +
                           ' border border-white/[0.06] hover:border-white/[0.1] focus:outline-none focus:border-accent-finance/40' +
                           ' transition-colors duration-150 [color-scheme:dark]">' +
                    '<option value="weekly">Weekly</option>' +
                    '<option value="monthly" selected>Monthly</option>' +
                    '<option value="yearly">Yearly</option>' +
                '</select>' +
                '<div class="flex-1"></div>' +
                '<button class="budget-create-btn px-3 py-1.5 rounded-lg text-[12px] font-medium' +
                               ' bg-accent-finance text-white hover:brightness-110 transition-all"' +
                        ' id="budget-create-btn">' +
                    'Create Budget' +
                '</button>' +
            '</div>';

        slot.appendChild(form);

        /* Populate category dropdown (only expense categories that don't already have budgets) */
        var budgetCatSelect = form.querySelector('.budget-cat-select');
        var existingBudgets = store.getBudgets();
        var usedCategories = {};
        for (var b = 0; b < existingBudgets.length; b++) {
            usedCategories[existingBudgets[b].category] = true;
        }

        var availableCats = EXPENSE_CATEGORIES.filter(function (c) { return !usedCategories[c]; });
        if (availableCats.length === 0) {
            var optNone = document.createElement('option');
            optNone.value = '';
            optNone.textContent = 'All categories have budgets';
            budgetCatSelect.appendChild(optNone);
        } else {
            for (var c = 0; c < availableCats.length; c++) {
                var opt = document.createElement('option');
                opt.value = availableCats[c];
                var meta = CATEGORY_META[availableCats[c]];
                opt.textContent = (meta ? meta.icon + ' ' : '') + (meta ? meta.label : availableCats[c]);
                budgetCatSelect.appendChild(opt);
            }
        }

        /* Wire create button */
        var createBtn = form.querySelector('#budget-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', function () {
                var category = budgetCatSelect.value;
                var limitInput = form.querySelector('.budget-limit-input');
                var periodSelect = form.querySelector('.budget-period-select');
                var limit = parseFloat(limitInput.value);

                if (!category) return;
                if (!limit || limit <= 0) {
                    limitInput.focus();
                    return;
                }

                store.dispatch({
                    type: 'ADD_BUDGET',
                    payload: {
                        category: category,
                        limit: limit,
                        period: periodSelect.value || 'monthly',
                    },
                });
            });
        }

        /* Budget list */
        var renderBudgets = function () {
            var existing = slot.querySelector('.budget-list-container');
            if (existing) existing.remove();

            var statuses = store.getBudgetStatuses();
            var container = document.createElement('div');
            container.className = 'budget-list-container';

            if (statuses.length === 0) {
                container.innerHTML =
                    '<div class="text-center py-16">' +
                        '<div class="text-4xl mb-3 opacity-20">\uD83D\uDCCA</div>' +
                        '<p class="text-[14px] text-text-secondary font-medium">No budgets set</p>' +
                        '<p class="text-[12px] text-text-tertiary mt-1">Create a budget above to control your spending.</p>' +
                    '</div>';
            } else {
                var list = document.createElement('div');
                list.className = 'space-y-3';

                for (var i = 0; i < statuses.length; i++) {
                    list.appendChild(createBudgetCard(statuses[i], {
                        onDelete: function (id) {
                            if (confirm('Delete this budget?')) {
                                store.dispatch({ type: 'DELETE_BUDGET', payload: id });
                            }
                        },
                    }));
                }
                container.appendChild(list);
            }

            slot.appendChild(container);
        };

        renderBudgets();
    }

    /* ── Reports Section ─────────────────────────────────── */

    _renderReportsSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading reports\u2026</div>';
            return;
        }

        /* ── Overall Totals ── */
        var totals = store.getTotals();
        var totalsCard = document.createElement('div');
        totalsCard.className = 'mb-6 p-5 rounded-xl bg-surface-raised/50 ring-1 ring-white/[0.04]';
        totalsCard.innerHTML =
            '<h3 class="text-[11px] text-text-tertiary font-medium uppercase tracking-wider mb-3">All Time</h3>' +
            '<div class="grid grid-cols-3 gap-4">' +
                '<div>' +
                    '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-0.5">Income</div>' +
                    '<div class="text-[20px] font-heading font-semibold text-status-success leading-none tabular-nums">' + formatCurrency(totals.income) + '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-0.5">Expenses</div>' +
                    '<div class="text-[20px] font-heading font-semibold text-status-error leading-none tabular-nums">' + formatCurrency(totals.expenses) + '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-0.5">Net</div>' +
                    '<div class="text-[20px] font-heading font-semibold leading-none tabular-nums ' + (totals.net >= 0 ? 'text-status-success' : 'text-status-error') + '">' + formatCurrency(totals.net) + '</div>' +
                '</div>' +
            '</div>';
        slot.appendChild(totalsCard);

        /* ── By Category ── */
        var byCategory = store.getTotalsByCategory();
        var catKeys = Object.keys(byCategory).sort(function (a, b) { return byCategory[b] - byCategory[a]; });

        if (catKeys.length > 0) {
            var catCard = document.createElement('div');
            catCard.className = 'mb-6 p-5 rounded-xl bg-surface-raised/50 ring-1 ring-white/[0.04]';
            var catInner = '<h3 class="text-[11px] text-text-tertiary font-medium uppercase tracking-wider mb-3">Spending by Category</h3>';
            catInner += '<div class="space-y-2">';

            var maxCat = byCategory[catKeys[0]] || 1;
            for (var i = 0; i < catKeys.length; i++) {
                var cat = catKeys[i];
                var meta = CATEGORY_META[cat] || CATEGORY_META.other;
                var pct = maxCat > 0 ? Math.round((byCategory[cat] / maxCat) * 100) : 0;

                catInner +=
                    '<div class="flex items-center gap-3">' +
                        '<span class="text-[12px] w-5 text-center">' + meta.icon + '</span>' +
                        '<span class="text-[12px] text-text-secondary w-20 truncate">' + meta.label + '</span>' +
                        '<div class="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">' +
                            '<div class="h-full rounded-full transition-all duration-500" style="width: ' + pct + '%; background: ' + meta.color + '"></div>' +
                        '</div>' +
                        '<span class="text-[12px] font-medium text-text-secondary tabular-nums w-20 text-right">' + formatCurrency(byCategory[cat]) + '</span>' +
                    '</div>';
            }

            catInner += '</div>';
            catCard.innerHTML = catInner;
            slot.appendChild(catCard);
        }

        /* ── By Month ── */
        var byMonth = store.getTotalsByMonth();
        var monthKeys = Object.keys(byMonth).sort();

        if (monthKeys.length > 0) {
            var monthCard = document.createElement('div');
            monthCard.className = 'mb-6 p-5 rounded-xl bg-surface-raised/50 ring-1 ring-white/[0.04]';
            var monthInner = '<h3 class="text-[11px] text-text-tertiary font-medium uppercase tracking-wider mb-3">Monthly Trend</h3>';
            monthInner += '<div class="space-y-2">';

            for (var j = 0; j < monthKeys.length; j++) {
                var mk = monthKeys[j];
                var monthLabel = mk;
                try {
                    var parts = mk.split('-');
                    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1);
                    monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                } catch (e) { /* keep raw */ }

                monthInner +=
                    '<div class="flex items-center justify-between py-1">' +
                        '<span class="text-[12px] text-text-secondary">' + monthLabel + '</span>' +
                        '<span class="text-[13px] font-medium text-text-primary tabular-nums">' + formatCurrency(byMonth[mk]) + '</span>' +
                    '</div>';
            }

            monthInner += '</div>';
            monthCard.innerHTML = monthInner;
            slot.appendChild(monthCard);
        }

        /* ── Empty state if no data at all ── */
        if (catKeys.length === 0 && monthKeys.length === 0) {
            slot.innerHTML +=
                '<div class="text-center py-16">' +
                    '<div class="text-4xl mb-3 opacity-20">\uD83D\uDCC8</div>' +
                    '<p class="text-[14px] text-text-secondary font-medium">No data to report</p>' +
                    '<p class="text-[12px] text-text-tertiary mt-1">Add transactions to see your financial reports.</p>' +
                '</div>';
        }
    }

    /* ── Event Binding ────────────────────────────────────── */

    _bindEvents() {
        if (!this.store) return;
        var bus = this.store.eventBus;
        var self = this;

        var refresh = function () { self._renderSection(); };

        /* Single subscription to the aggregate change event.
           The store publishes 'finance:changed' after every mutation,
           so individual event subscriptions are unnecessary and
           would cause duplicate re-renders. */
        bus.subscribe('finance:changed', refresh);
        bus.subscribe('finance:validation-error', function (errors) {
            console.warn('[Finance] Validation:', errors);
        });

        this._unsubs.push(
            function () { bus.unsubscribe('finance:changed', refresh); },
            function () {
                bus.unsubscribe('finance:validation-error', function (errors) {
                    console.warn('[Finance] Validation:', errors);
                });
            }
        );
    }
}

export default FinanceView;
