/**
 * Life OS — Finance Gateway
 *
 * The ONLY code path that touches the finance-transactions and
 * finance-budgets IndexedDB object stores. All other modules
 * call through this gateway.
 *
 * Responsibilities:
 *   - CRUD for transactions and budgets
 *   - Query by index (date, category, type)
 *   - Aggregate queries for summaries
 */

const TX_STORE = 'finance-transactions';
const BUDGET_STORE = 'finance-budgets';

export class FinanceGateway {
    constructor(database) {
        this.db = database;
    }

    /* ── Transactions ────────────────────────────────────── */

    async createTransaction(data) {
        var id = await this.db.save(TX_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async updateTransaction(data) {
        if (!data.id) throw new Error('Transaction must have an id to update');
        await this.db.update(TX_STORE, data);
        return data;
    }

    async getTransaction(id) {
        return this.db.get(TX_STORE, id);
    }

    async getAllTransactions() {
        return this.db.getAll(TX_STORE);
    }

    async deleteTransaction(id) {
        return this.db.delete(TX_STORE, id);
    }

    async getTransactionsByType(type) {
        return this.db.getByIndex(TX_STORE, 'by-type', type);
    }

    async getTransactionsByCategory(category) {
        return this.db.getByIndex(TX_STORE, 'by-category', category);
    }

    async getTransactionsByDate(date) {
        return this.db.getByIndex(TX_STORE, 'by-date', date);
    }

    /* ── Budgets ─────────────────────────────────────────── */

    async createBudget(data) {
        var id = await this.db.save(BUDGET_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async updateBudget(data) {
        if (!data.id) throw new Error('Budget must have an id to update');
        await this.db.update(BUDGET_STORE, data);
        return data;
    }

    async getBudget(id) {
        return this.db.get(BUDGET_STORE, id);
    }

    async getAllBudgets() {
        return this.db.getAll(BUDGET_STORE);
    }

    async deleteBudget(id) {
        return this.db.delete(BUDGET_STORE, id);
    }

    async getBudgetsByCategory(category) {
        return this.db.getByIndex(BUDGET_STORE, 'by-category', category);
    }
}
