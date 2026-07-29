/**
 * Tarteeb — Finance State Store
 *
 * Unidirectional data flow within the Finance pillar:
 *
 *   View ──dispatch(action)──▶ FinanceStore ──publish──▶ EventBus
 *              │                                         │
 *              ▼                                         ▼
 *        gateway.create()                      View re-renders
 *        gateway.update()
 *        gateway.delete()
 *
 * Constraints:
 *   - State mutations ONLY via dispatch()
 *   - Selectors are pure functions of the state
 *   - Gateway writes are optimistic — rollback on failure
 *   - UPDATE_TRANSACTION accepts { id, ...fields } — merges with existing
 *   - Every mutation publishes 'finance:changed' as the single re-render trigger
 */

'use strict';

import {
    createTransactionData,
    createBudgetData,
    validateTransaction,
    validateBudget,
    selectByType,
    selectByCategory,
    selectByDateRange,
    selectThisMonth,
    selectThisWeek,
    sortByDate,
    sortByAmount,
    summarizeTotals,
    summarizeByCategory,
    summarizeByMonth,
    summarizeByType,
    spendingForBudget,
    TX_TYPE,
} from '../domain/finance-rules.js';

import { canCreateEntity, showPaywall } from '../../core/freemium.js';

export class FinanceStore {
    constructor(eventBus, financeGateway) {
        this.eventBus    = eventBus;
        this.gateway     = financeGateway;

        this.transactions = [];
        this.budgets      = [];
        this.loading      = false;
        this.error        = null;
    }

    /* ── Hydration ─────────────────────────────────────────── */

    async hydrate() {
        this.loading = true;
        this.eventBus.publish('finance:loading', true);

        try {
            this.transactions = await this.gateway.getAllTransactions();
            this.budgets      = await this.gateway.getAllBudgets();
            this.error        = null;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('finance:error', err.message);
        } finally {
            this.loading = false;
            this.eventBus.publish('finance:loading', false);
            this.eventBus.publish('finance:hydrated', this.getStateSnapshot());
        }
    }

    /* ── Dispatch ──────────────────────────────────────────── */

    async dispatch(action) {
        switch (action.type) {
            case 'ADD_TRANSACTION':      return this._addTransaction(action.payload);
            case 'UPDATE_TRANSACTION':   return this._updateTransaction(action.payload);
            case 'DELETE_TRANSACTION':   return this._deleteTransaction(action.payload);
            case 'ADD_BUDGET':           return this._addBudget(action.payload);
            case 'UPDATE_BUDGET':        return this._updateBudget(action.payload);
            case 'DELETE_BUDGET':        return this._deleteBudget(action.payload);
            default:
                console.warn('[FinanceStore] Unknown action:', action.type);
        }
    }

    /* ── Internal Mutators: Transactions ──────────────────── */

    async _addTransaction(raw) {
        var data = createTransactionData(raw);
        var validation = validateTransaction(data);
        if (!validation.valid) {
            this.eventBus.publish('finance:validation-error', validation.errors);
            return null;
        }

        if (!canCreateEntity('finance', this.transactions.length)) {
            showPaywall();
            this.eventBus.publish('finance:freemium-blocked', { entityType: 'finance', limit: 10 });
            return null;
        }

        try {
            var saved = await this.gateway.createTransaction(data);
            this.transactions = this.transactions.concat([saved]);
            this.eventBus.publish('finance:transaction-added', saved);
            this.eventBus.publish('finance:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.eventBus.publish('finance:error', err.message);
            return null;
        }
    }

    /**
     * Patch-based update.  Accepts { id, ...fields }.
     * Merges onto the existing transaction, writes to gateway,
     * publishes change event.  Optimistic with rollback.
     */
    async _updateTransaction(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('finance:error', 'UPDATE_TRANSACTION requires an id');
            return null;
        }

        var index = -1;
        for (var i = 0; i < this.transactions.length; i++) {
            if (this.transactions[i].id === patch.id) { index = i; break; }
        }
        if (index === -1) {
            this.eventBus.publish('finance:error', 'Transaction ' + patch.id + ' not found');
            return null;
        }

        var existing = this.transactions[index];
        var updated  = Object.assign({}, existing, patch, { updatedAt: new Date().toISOString() });

        /* Optimistic: replace in local array */
        var next = this.transactions.slice();
        next[index] = updated;
        this.transactions = next;

        this.eventBus.publish('finance:transaction-updated', updated);
        this.eventBus.publish('finance:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateTransaction(updated);
        } catch (err) {
            /* Rollback */
            var rollback = this.transactions.slice();
            rollback[index] = existing;
            this.transactions = rollback;
            this.eventBus.publish('finance:rollback', existing);
            this.eventBus.publish('finance:error', err.message);
            this.eventBus.publish('finance:changed', this.getStateSnapshot());
        }

        return updated;
    }

    async _deleteTransaction(id) {
        var index = -1;
        for (var i = 0; i < this.transactions.length; i++) {
            if (this.transactions[i].id === id) { index = i; break; }
        }
        if (index === -1) return;

        var removed = this.transactions[index];
        this.transactions = this.transactions.filter(function (t) { return t.id !== id; });
        this.eventBus.publish('finance:transaction-deleted', removed);
        this.eventBus.publish('finance:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteTransaction(id);
        } catch (err) {
            var rollback = this.transactions.slice();
            rollback.splice(index, 0, removed);
            this.transactions = rollback;
            this.eventBus.publish('finance:rollback', removed);
            this.eventBus.publish('finance:error', err.message);
            this.eventBus.publish('finance:changed', this.getStateSnapshot());
        }
    }

    /* ── Internal Mutators: Budgets ────────────────────────── */

    async _addBudget(raw) {
        var data = createBudgetData(raw);
        var validation = validateBudget(data);
        if (!validation.valid) {
            this.eventBus.publish('finance:validation-error', validation.errors);
            return null;
        }

        /* Prevent duplicate budget for same category */
        for (var i = 0; i < this.budgets.length; i++) {
            if (this.budgets[i].category === data.category) {
                this.eventBus.publish('finance:validation-error',
                    ['A budget for "' + data.category + '" already exists']);
                return null;
            }
        }

        try {
            var saved = await this.gateway.createBudget(data);
            this.budgets = this.budgets.concat([saved]);
            this.eventBus.publish('finance:budget-added', saved);
            this.eventBus.publish('finance:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.eventBus.publish('finance:error', err.message);
            return null;
        }
    }

    async _updateBudget(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('finance:error', 'UPDATE_BUDGET requires an id');
            return null;
        }

        var index = -1;
        for (var i = 0; i < this.budgets.length; i++) {
            if (this.budgets[i].id === patch.id) { index = i; break; }
        }
        if (index === -1) {
            this.eventBus.publish('finance:error', 'Budget ' + patch.id + ' not found');
            return null;
        }

        var existing = this.budgets[index];
        var updated  = Object.assign({}, existing, patch, { updatedAt: new Date().toISOString() });

        var next = this.budgets.slice();
        next[index] = updated;
        this.budgets = next;

        this.eventBus.publish('finance:budget-updated', updated);
        this.eventBus.publish('finance:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateBudget(updated);
        } catch (err) {
            var rollback = this.budgets.slice();
            rollback[index] = existing;
            this.budgets = rollback;
            this.eventBus.publish('finance:rollback', existing);
            this.eventBus.publish('finance:error', err.message);
            this.eventBus.publish('finance:changed', this.getStateSnapshot());
        }

        return updated;
    }

    async _deleteBudget(id) {
        var index = -1;
        for (var i = 0; i < this.budgets.length; i++) {
            if (this.budgets[i].id === id) { index = i; break; }
        }
        if (index === -1) return;

        var removed = this.budgets[index];
        this.budgets = this.budgets.filter(function (b) { return b.id !== id; });
        this.eventBus.publish('finance:budget-deleted', removed);
        this.eventBus.publish('finance:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteBudget(id);
        } catch (err) {
            var rollback = this.budgets.slice();
            rollback.splice(index, 0, removed);
            this.budgets = rollback;
            this.eventBus.publish('finance:rollback', removed);
            this.eventBus.publish('finance:error', err.message);
            this.eventBus.publish('finance:changed', this.getStateSnapshot());
        }
    }

    /* ── Selectors ─────────────────────────────────────────── */

    getStateSnapshot() {
        return {
            transactions: this.transactions,
            budgets:      this.budgets,
            loading:      this.loading,
            error:        this.error,
        };
    }

    getAllTransactions()        { return sortByDate(this.transactions); }
    getThisWeekTransactions()  { return sortByDate(selectThisWeek(this.transactions)); }
    getThisMonthTransactions() { return sortByDate(selectThisMonth(this.transactions)); }

    getTransactionsByType(type)       { return sortByDate(selectByType(this.transactions, type)); }
    getTransactionsByCategory(cat)    { return sortByDate(selectByCategory(this.transactions, cat)); }
    getTransactionsByRange(from, to)  { return sortByDate(selectByDateRange(this.transactions, from, to)); }

    getExpenses()   { return sortByDate(selectByType(this.transactions, TX_TYPE.EXPENSE)); }
    getIncome()     { return sortByDate(selectByType(this.transactions, TX_TYPE.INCOME)); }

    getBudgets()    { return this.budgets.slice(); }

    getTransactionById(id) {
        for (var i = 0; i < this.transactions.length; i++) {
            if (this.transactions[i].id === id) return this.transactions[i];
        }
        return null;
    }

    getBudgetById(id) {
        for (var i = 0; i < this.budgets.length; i++) {
            if (this.budgets[i].id === id) return this.budgets[i];
        }
        return null;
    }

    /* ── Derived Aggregations ──────────────────────────────── */

    getTotals()              { return summarizeTotals(this.transactions); }
    getMonthTotals()         { return summarizeTotals(selectThisMonth(this.transactions)); }
    getWeekTotals()          { return summarizeTotals(selectThisWeek(this.transactions)); }
    getTotalsByCategory()    { return summarizeByCategory(this.transactions); }
    getMonthByCategory()     { return summarizeByCategory(selectThisMonth(this.transactions)); }
    getTotalsByMonth()       { return summarizeByMonth(this.transactions); }
    getTotalsByType()        { return summarizeByType(this.transactions); }

    /**
     * For each budget, compute actual spending in its period.
     * Returns array of { budget, spent, remaining, percentage }
     */
    getBudgetStatuses() {
        var self = this;
        return this.budgets.map(function (b) {
            var spent = spendingForBudget(self.transactions, b.category, b.period);
            var remaining = Math.max(0, b.limit - spent);
            var pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
            return {
                budget:     b,
                spent:      spent,
                remaining:  remaining,
                percentage: Math.min(pct, 100),
                overBudget: spent > b.limit,
            };
        });
    }
}
