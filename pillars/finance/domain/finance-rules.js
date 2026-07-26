/**
 * Life OS — Finance Domain Rules
 *
 * Pure business logic for financial management.
 * Zero DOM dependency. Every function is testable in isolation.
 *
 * Invariants enforced here:
 *   - Transaction amount must be a positive finite number
 *   - Transaction type is one of: 'income', 'expense', 'transfer'
 *   - Transaction date must be a valid ISO date string (YYYY-MM-DD)
 *   - Category must be a non-empty string from the allowed set
 *   - Budget limit must be a positive finite number
 *   - Budget period is one of: 'weekly', 'monthly', 'yearly'
 *   - Timestamps are ISO-8601 strings set at creation
 */

/* ── Enums ───────────────────────────────────────────────── */

export const TX_TYPE = Object.freeze({
    INCOME:    'income',
    EXPENSE:   'expense',
    TRANSFER:  'transfer',
});

export const EXPENSE_CATEGORIES = Object.freeze([
    'food',
    'housing',
    'transport',
    'entertainment',
    'shopping',
    'health',
    'education',
    'utilities',
    'subscriptions',
    'personal',
    'other',
]);

export const INCOME_CATEGORIES = Object.freeze([
    'salary',
    'freelance',
    'investment',
    'gift',
    'refund',
    'other',
]);

export const ALL_CATEGORIES = Object.freeze(
    EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES)
);

export const BUDGET_PERIOD = Object.freeze({
    WEEKLY:  'weekly',
    MONTHLY: 'monthly',
    YEARLY:  'yearly',
});

export const CATEGORY_META = Object.freeze({
    food:          { label: 'Food & Dining',   icon: '🍽', color: '#f97316' },
    housing:       { label: 'Housing',         icon: '🏠', color: '#6366f1' },
    transport:     { label: 'Transport',       icon: '🚗', color: '#14b8a6' },
    entertainment: { label: 'Entertainment',   icon: '🎬', color: '#ec4899' },
    shopping:      { label: 'Shopping',        icon: '🛍', color: '#a855f7' },
    health:        { label: 'Health',          icon: '💊', color: '#ef4444' },
    education:     { label: 'Education',       icon: '📚', color: '#3b82f6' },
    utilities:     { label: 'Utilities',       icon: '⚡', color: '#eab308' },
    subscriptions: { label: 'Subscriptions',   icon: '🔄', color: '#8b5cf6' },
    personal:      { label: 'Personal',        icon: '👤', color: '#06b6d4' },
    other:         { label: 'Other',           icon: '📌', color: '#71717a' },
    salary:        { label: 'Salary',          icon: '💰', color: '#22c55e' },
    freelance:     { label: 'Freelance',       icon: '💻', color: '#10b981' },
    investment:    { label: 'Investment',      icon: '📈', color: '#60a5fa' },
    gift:          { label: 'Gift',            icon: '🎁', color: '#f472b6' },
    refund:        { label: 'Refund',          icon: '↩️', color: '#34d399' },
});

export const BUDGET_PERIOD_LABELS = Object.freeze({
    weekly:  'Weekly',
    monthly: 'Monthly',
    yearly:  'Yearly',
});

/* ── Validation ──────────────────────────────────────────── */

/**
 * Validate a transaction data object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateTransaction(data) {
    var errors = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Transaction data must be an object'] };
    }

    if (typeof data.amount !== 'number' || !isFinite(data.amount) || data.amount <= 0) {
        errors.push('Amount must be a positive number');
    }

    if (data.amount && data.amount > 999999999) {
        errors.push('Amount exceeds maximum allowed value');
    }

    if (!data.type || !Object.values(TX_TYPE).indexOf(data.type) === -1) {
        if (!data.type || (data.type !== TX_TYPE.INCOME && data.type !== TX_TYPE.EXPENSE && data.type !== TX_TYPE.TRANSFER)) {
            errors.push('Type must be one of: income, expense, transfer');
        }
    }

    if (typeof data.category !== 'string' || data.category.trim().length === 0) {
        errors.push('Category is required');
    }

    if (typeof data.date !== 'string' || data.date.length === 0) {
        errors.push('Date is required');
    } else {
        var parsed = new Date(data.date + 'T00:00:00');
        if (isNaN(parsed.getTime())) {
            errors.push('Date must be a valid date (YYYY-MM-DD)');
        }
    }

    if (data.description !== undefined && data.description !== null) {
        if (typeof data.description !== 'string') {
            errors.push('Description must be a string');
        } else if (data.description.length > 500) {
            errors.push('Description must be 500 characters or fewer');
        }
    }

    return { valid: errors.length === 0, errors: errors };
}

/**
 * Validate a budget data object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateBudget(data) {
    var errors = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Budget data must be an object'] };
    }

    if (typeof data.category !== 'string' || data.category.trim().length === 0) {
        errors.push('Category is required');
    }

    if (typeof data.limit !== 'number' || !isFinite(data.limit) || data.limit <= 0) {
        errors.push('Budget limit must be a positive number');
    }

    if (data.period && !Object.values(BUDGET_PERIOD).indexOf(data.period) === -1) {
        if (!data.period || (data.period !== BUDGET_PERIOD.WEEKLY && data.period !== BUDGET_PERIOD.MONTHLY && data.period !== BUDGET_PERIOD.YEARLY)) {
            errors.push('Period must be one of: weekly, monthly, yearly');
        }
    }

    return { valid: errors.length === 0, errors: errors };
}

/* ── Factories ───────────────────────────────────────────── */

/**
 * Create a new transaction object with defaults.
 * Does NOT persist — call gateway separately.
 */
export function createTransactionData(overrides) {
    var now = new Date().toISOString();
    var defaults = {
        amount:      0,
        type:        TX_TYPE.EXPENSE,
        category:    'other',
        description: '',
        date:        new Date().toISOString().slice(0, 10),
        tags:        [],
        createdAt:   now,
        updatedAt:   now,
    };
    return Object.assign({}, defaults, overrides || {});
}

/**
 * Create a new budget object with defaults.
 * Does NOT persist — call gateway separately.
 */
export function createBudgetData(overrides) {
    var now = new Date().toISOString();
    var defaults = {
        category:  'other',
        limit:     0,
        period:    BUDGET_PERIOD.MONTHLY,
        startDate: new Date().toISOString().slice(0, 10),
        color:     '#60a5fa',
        createdAt: now,
        updatedAt: now,
    };
    return Object.assign({}, defaults, overrides || {});
}

/* ── Formatting ──────────────────────────────────────────── */

/**
 * Format a number as currency string.
 * @param {number} amount
 * @param {string} currency - ISO currency code, default 'USD'
 * @returns {string} e.g. "$1,234.56"
 */
export function formatCurrency(amount, currency) {
    currency = currency || 'USD';
    if (typeof amount !== 'number' || !isFinite(amount)) return '$0.00';
    var abs = Math.abs(amount);
    var formatted;
    if (abs >= 1000000) {
        formatted = (abs / 1000000).toFixed(1) + 'M';
    } else if (abs >= 1000) {
        formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        formatted = abs.toFixed(2);
    }
    var prefix = amount < 0 ? '-' : '';
    return prefix + '$' + formatted;
}

/* ── Selectors (pure derivations) ────────────────────────── */

/**
 * Filter transactions by type.
 */
export function selectByType(transactions, type) {
    return transactions.filter(function (t) { return t.type === type; });
}

/**
 * Filter transactions by category.
 */
export function selectByCategory(transactions, category) {
    return transactions.filter(function (t) { return t.category === category; });
}

/**
 * Filter transactions within a date range (inclusive).
 * Both dates are YYYY-MM-DD strings.
 */
export function selectByDateRange(transactions, from, to) {
    return transactions.filter(function (t) {
        return t.date >= from && t.date <= to;
    });
}

/**
 * Filter transactions for the current month.
 */
export function selectThisMonth(transactions) {
    var now = new Date();
    var yearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    return transactions.filter(function (t) {
        return t.date && t.date.slice(0, 7) === yearMonth;
    });
}

/**
 * Filter transactions for the current week (Mon–Sun).
 */
export function selectThisWeek(transactions) {
    var now = new Date();
    var day = now.getDay();
    var mondayOffset = day === 0 ? 6 : day - 1;
    var monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    var from = monday.toISOString().slice(0, 10);
    var to = sunday.toISOString().slice(0, 10);
    return selectByDateRange(transactions, from, to);
}

/**
 * Sort transactions by date descending (newest first),
 * then by id descending (newer records first).
 */
export function sortByDate(transactions) {
    return transactions.slice().sort(function (a, b) {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return (b.id || 0) - (a.id || 0);
    });
}

/**
 * Sort transactions by amount descending.
 */
export function sortByAmount(transactions) {
    return transactions.slice().sort(function (a, b) {
        return b.amount - a.amount;
    });
}

/* ── Aggregators (pure derivations) ──────────────────────── */

/**
 * Compute total income, total expenses, and net balance.
 * Returns { income, expenses, net }
 */
export function summarizeTotals(transactions) {
    var income = 0;
    var expenses = 0;
    for (var i = 0; i < transactions.length; i++) {
        var t = transactions[i];
        if (t.type === TX_TYPE.INCOME) {
            income += t.amount;
        } else if (t.type === TX_TYPE.EXPENSE) {
            expenses += t.amount;
        }
    }
    return {
        income:   income,
        expenses: expenses,
        net:      income - expenses,
    };
}

/**
 * Sum amounts grouped by category.
 * Returns { categoryName: totalAmount, ... }
 */
export function summarizeByCategory(transactions) {
    var groups = {};
    for (var i = 0; i < transactions.length; i++) {
        var cat = transactions[i].category;
        if (!groups[cat]) groups[cat] = 0;
        groups[cat] += transactions[i].amount;
    }
    return groups;
}

/**
 * Sum amounts grouped by month (YYYY-MM key).
 * Returns { '2026-01': total, ... } sorted ascending.
 */
export function summarizeByMonth(transactions) {
    var groups = {};
    for (var i = 0; i < transactions.length; i++) {
        var key = transactions[i].date ? transactions[i].date.slice(0, 7) : 'unknown';
        if (!groups[key]) groups[key] = 0;
        groups[key] += transactions[i].amount;
    }
    return groups;
}

/**
 * Sum amounts grouped by type (income vs expense vs transfer).
 * Returns { income: total, expense: total, transfer: total }
 */
export function summarizeByType(transactions) {
    var totals = {};
    totals[TX_TYPE.INCOME] = 0;
    totals[TX_TYPE.EXPENSE] = 0;
    totals[TX_TYPE.TRANSFER] = 0;
    for (var i = 0; i < transactions.length; i++) {
        var t = transactions[i];
        if (totals[t.type] !== undefined) {
            totals[t.type] += t.amount;
        }
    }
    return totals;
}

/**
 * Compute spending per category for a given budget period.
 * Used to compare actuals against budget limits.
 * Returns { categoryName: totalSpent }
 */
export function spendingForBudget(transactions, category, period) {
    var now = new Date();
    var filtered = transactions.filter(function (t) {
        if (t.type !== TX_TYPE.EXPENSE) return false;
        if (t.category !== category) return false;
        if (period === BUDGET_PERIOD.WEEKLY) {
            return selectThisWeek([t]).length > 0;
        } else if (period === BUDGET_PERIOD.YEARLY) {
            return t.date && t.date.slice(0, 4) === String(now.getFullYear());
        } else {
            /* Monthly (default) */
            var yearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            return t.date && t.date.slice(0, 7) === yearMonth;
        }
    });
    var total = 0;
    for (var i = 0; i < filtered.length; i++) {
        total += filtered[i].amount;
    }
    return total;
}
