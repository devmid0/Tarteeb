/**
 * Tarteeb — Transaction Card
 *
 * Premium single-transaction row with type-accented left border,
 * category icon, contextual amount coloring, relative date,
 * and hover-reveal action buttons with micro-interactions.
 */

import { TX_TYPE, CATEGORY_META, formatCurrency } from '../domain/finance-rules.js';

var TYPE_ACCENT = {
    income:   { border: 'border-l-status-success', text: 'text-status-success', badge: 'bg-status-success/10 text-status-success', prefix: '+' },
    expense:  { border: 'border-l-status-error',   text: 'text-status-error',   badge: 'bg-status-error/10 text-status-error',   prefix: '\u2212' },
    transfer: { border: 'border-l-accent-finance',  text: 'text-accent-finance',  badge: 'bg-accent-finance/10 text-accent-finance',  prefix: '' },
};

export function createTransactionCard(tx, callbacks) {
    var cbs = callbacks || {};
    var el = document.createElement('div');
    el.dataset.transactionId = tx.id;

    var accent  = TYPE_ACCENT[tx.type] || TYPE_ACCENT.expense;
    var catMeta = CATEGORY_META[tx.category] || CATEGORY_META.other;
    var isIncome = tx.type === TX_TYPE.INCOME;

    el.className = [
        'group relative flex items-center gap-3',
        'pl-1 pr-2 py-0 rounded-xl',
        'bg-surface-raised/40 hover:bg-surface-elevated/60',
        'border border-transparent hover:border-white/[0.04]',
        'border-l-[3px] ' + accent.border,
        'transition-all duration-200',
        'hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.3)]',
    ].join(' ');

    /* ── Category Icon ── */

    var iconWrap = document.createElement('div');
    iconWrap.className = [
        'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[15px]',
        'transition-transform duration-200 group-hover:scale-105',
    ].join(' ');
    iconWrap.style.backgroundColor = catMeta.color + '12';
    iconWrap.textContent = catMeta.icon;

    /* ── Content ── */

    var content = document.createElement('div');
    content.className = 'flex-1 min-w-0 py-2.5';

    /* Line 1: Category + Description */
    var line1 = document.createElement('div');
    line1.className = 'flex items-center gap-2 min-w-0';

    var catLabel = document.createElement('span');
    catLabel.className = 'text-[13px] font-medium text-text-primary truncate';
    catLabel.textContent = catMeta.label;
    line1.appendChild(catLabel);

    if (tx.description) {
        var sep = document.createElement('span');
        sep.className = 'text-text-disabled text-[10px]';
        sep.textContent = '\u00b7';
        line1.appendChild(sep);

        var desc = document.createElement('span');
        desc.className = 'text-[12px] text-text-disabled truncate';
        desc.textContent = tx.description;
        line1.appendChild(desc);
    }

    /* Line 2: Date + Type badge + (optional) tags */
    var line2 = document.createElement('div');
    line2.className = 'flex items-center gap-2 mt-0.5';

    if (tx.date) {
        var dateEl = document.createElement('span');
        dateEl.className = 'text-[11px] text-text-tertiary';
        dateEl.textContent = _relativeDate(tx.date);
        line2.appendChild(dateEl);
    }

    var typeBadge = document.createElement('span');
    typeBadge.className = [
        'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider',
        'px-1.5 py-[1px] rounded',
        accent.badge,
    ].join(' ');
    typeBadge.textContent = tx.type;
    line2.appendChild(typeBadge);

    content.appendChild(line1);
    content.appendChild(line2);

    /* ── Amount ── */

    var amountCol = document.createElement('div');
    amountCol.className = 'flex-shrink-0 text-right pl-2';

    var amountEl = document.createElement('div');
    amountEl.className = [
        'text-[15px] font-heading font-bold tabular-nums leading-none',
        accent.text,
    ].join(' ');
    amountEl.textContent = accent.prefix + formatCurrency(tx.amount);
    amountCol.appendChild(amountEl);

    /* ── Actions (hover-reveal) ── */

    var actions = document.createElement('div');
    actions.className = [
        'flex-shrink-0 flex items-center gap-0.5 pl-1',
        'opacity-0 group-hover:opacity-100',
        'transition-opacity duration-150',
    ].join(' ');

    actions.appendChild(_actionBtn('Edit', _svgEdit(), function (e) {
        e.stopPropagation();
        if (cbs.onEdit) cbs.onEdit(tx.id);
    }));

    actions.appendChild(_actionBtn('Delete', _svgTrash(), function (e) {
        e.stopPropagation();
        if (cbs.onDelete) cbs.onDelete(tx.id);
    }, 'hover:text-status-error hover:bg-status-error/10'));

    /* ── Assemble ── */

    el.appendChild(iconWrap);
    el.appendChild(content);
    el.appendChild(amountCol);
    el.appendChild(actions);

    return el;
}

/* ── Internal Helpers ───────────────────────────────────── */

function _actionBtn(title, icon, onClick, extraHover) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = [
        'p-2 rounded-lg text-text-disabled',
        'transition-colors duration-150',
        extraHover || 'hover:text-text-secondary hover:bg-white/[0.06]',
    ].join(' ');
    btn.innerHTML = icon;
    btn.addEventListener('click', onClick);
    return btn;
}

function _relativeDate(dateStr) {
    if (!dateStr) return '';
    try {
        var txDate  = new Date(dateStr + 'T00:00:00');
        var today   = new Date();
        today.setHours(0, 0, 0, 0);
        var txDay   = new Date(txDate); txDay.setHours(0, 0, 0, 0);
        var diffMs  = today - txDay;
        var diffDay = Math.round(diffMs / 86400000);

        if (diffDay === 0) return 'Today';
        if (diffDay === 1) return 'Yesterday';
        if (diffDay === -1) return 'Tomorrow';
        if (diffDay > 1 && diffDay <= 6) return diffDay + ' days ago';
        if (diffDay < -1 && diffDay >= -6) return 'In ' + Math.abs(diffDay) + ' days';

        return txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function _svgEdit() {
    return '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">' +
        '<path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 015 12.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.468-.325z"/>' +
    '</svg>';
}

function _svgTrash() {
    return '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">' +
        '<path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>' +
        '<path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/>' +
    '</svg>';
}
