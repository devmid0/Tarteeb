// YAGNI: Removed getTransactionsByType, getTransactionsByCategory, getTransactionsByDate, getBudgetsByCategory
// (store does in-memory filtering; none called from gateway)

const TX_STORE = 'finance-transactions';
const BUDGET_STORE = 'finance-budgets';

export class FinanceGateway {
    constructor(database) {
        this.db = database;
    }

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
}
