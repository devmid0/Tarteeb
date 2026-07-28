/**
 * Tarteeb — Transaction Feed
 *
 * Sleek vertical activity feed replacing traditional tables.
 * Each transaction is a minimalist row with:
 *   - Left: Circular soft-background category icon
 *   - Center: Category name (bold) + muted relative timestamp
 *   - Right: Amount with color coding (red=expense, green=income)
 */

import { TX_TYPE, CATEGORY_META } from '../domain/finance-rules.js';

export function createTransactionFeed(transactions, opts) {
    var callbacks = opts || {};

    var root = document.createElement('div');
    root.className = 'tx-feed';

    if (!transactions || transactions.length === 0) {
        root.innerHTML =
            '<div class="tx-feed-empty">' +
                '<div class="tx-feed-empty-icon">$</div>' +
                '<div class="tx-feed-empty-title">No transactions yet</div>' +
                '<div class="tx-feed-empty-hint">Type an amount and tap a category above</div>' +
            '</div>';
        return root;
    }

    /* Group transactions by date */
    var groups = groupByDate(transactions);

    for (var g = 0; g < groups.length; g++) {
        var group = groups[g];

        /* Date header */
        var dateHeader = document.createElement('div');
        dateHeader.className = 'tx-feed-date-header';
        dateHeader.textContent = group.label;
        root.appendChild(dateHeader);

        /* Transaction rows */
        var list = document.createElement('div');
        list.className = 'tx-feed-list';

        for (var i = 0; i < group.items.length; i++) {
            var tx = group.items[i];
            list.appendChild(createFeedRow(tx, callbacks));
        }

        root.appendChild(list);
    }

    return root;
}

function createFeedRow(tx, callbacks) {
    var meta = CATEGORY_META[tx.category] || CATEGORY_META.other;
    var isExpense = tx.type === TX_TYPE.EXPENSE;
    var isIncome = tx.type === TX_TYPE.INCOME;

    var row = document.createElement('div');
    row.className = 'tx-feed-row';
    row.dataset.transactionId = tx.id;

    /* Category Icon (left) */
    var iconWrap = document.createElement('div');
    iconWrap.className = 'tx-feed-icon';
    iconWrap.style.backgroundColor = meta.color + '15';
    iconWrap.style.color = meta.color;
    iconWrap.textContent = meta.icon;

    /* Content (center) */
    var content = document.createElement('div');
    content.className = 'tx-feed-content';

    var catName = document.createElement('div');
    catName.className = 'tx-feed-category';
    catName.textContent = meta.label;

    var timestamp = document.createElement('div');
    timestamp.className = 'tx-feed-time';
    timestamp.textContent = formatRelativeTime(tx.date, tx.createdAt);

    content.appendChild(catName);
    content.appendChild(timestamp);

    /* Amount (right) */
    var amountWrap = document.createElement('div');
    amountWrap.className = 'tx-feed-amount';

    var amount = document.createElement('div');
    amount.className = 'tx-feed-amount-value';
    if (isExpense) {
        amount.classList.add('tx-feed-amount--expense');
        amount.textContent = '\u2212$' + tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (isIncome) {
        amount.classList.add('tx-feed-amount--income');
        amount.textContent = '+$' + tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        amount.textContent = '$' + tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    amountWrap.appendChild(amount);

    /* Actions (hidden, show on hover) */
    var actions = document.createElement('div');
    actions.className = 'tx-feed-actions';

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'tx-feed-action-btn';
    deleteBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';
    deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (callbacks.onDelete) callbacks.onDelete(tx.id);
    });

    actions.appendChild(deleteBtn);

    /* Assemble */
    row.appendChild(iconWrap);
    row.appendChild(content);
    row.appendChild(amountWrap);
    row.appendChild(actions);

    return row;
}

/* ── Date Grouping ── */

function groupByDate(transactions) {
    var groups = [];
    var seen = {};

    for (var i = 0; i < transactions.length; i++) {
        var tx = transactions[i];
        var key = tx.date || 'unknown';
        if (!seen[key]) {
            seen[key] = { date: key, label: formatDateLabel(key), items: [] };
            groups.push(seen[key]);
        }
        seen[key].items.push(tx);
    }

    /* Sort groups by date descending */
    groups.sort(function (a, b) { return b.date.localeCompare(a.date); });

    return groups;
}

function formatDateLabel(dateStr) {
    try {
        var txDate = new Date(dateStr + 'T00:00:00');
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var txDay = new Date(txDate);
        txDay.setHours(0, 0, 0, 0);
        var diffMs = today - txDay;
        var diffDay = Math.round(diffMs / 86400000);

        if (diffDay === 0) return 'Today';
        if (diffDay === 1) return 'Yesterday';
        if (diffDay > 1 && diffDay <= 6) return diffDay + ' days ago';
        return txDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function formatRelativeTime(dateStr, createdAt) {
    if (!dateStr) return '';
    try {
        var txDate = new Date(dateStr + 'T00:00:00');
        var now = new Date();
        var diffMs = now - txDate;
        var diffMin = Math.floor(diffMs / 60000);
        var diffHr = Math.floor(diffMs / 3600000);
        var diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return diffMin + 'm ago';
        if (diffHr < 24) return diffHr + 'h ago';
        if (diffDay < 7) return diffDay + 'd ago';
        return txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}
