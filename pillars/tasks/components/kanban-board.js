/**
 * Tarteeb — Kanban Board
 *
 * Trello-style 3-column board with HTML5 Drag & Drop.
 * Columns: To Do (pending) | In Progress | Done (completed)
 *
 * Features:
 *   - Native drag & drop with visual cues
 *   - Touch fallback: "Move" menu on mobile
 *   - Silent IndexedDB updates on drop
 *   - Priority color coding per card
 *   - Card count per column
 */

'use strict';

import { PRIORITY_ORDER, formatMinutes } from '../domain/task-rules.js';

var COLUMNS = [
    { id: 'pending',     label: 'To Do',        icon: '📋', color: '#71717a' },
    { id: 'in_progress', label: 'In Progress',  icon: '⚡', color: '#60a5fa' },
    { id: 'completed',   label: 'Done',          icon: '✅', color: '#22c55e' },
];

var PRIORITY_COLORS = {
    critical: { bg: 'bg-red-500',     dot: '#ef4444', label: 'Critical' },
    high:     { bg: 'bg-orange-400',  dot: '#fb923c', label: 'High' },
    medium:   { bg: 'bg-yellow-500',  dot: '#eab308', label: 'Medium' },
    low:      { bg: 'bg-sky-500',     dot: '#38bdf8', label: 'Low' },
};

var SVG_MOVE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M7.25 1v2.5h1.5V1h-1.5zm3.25 0v2.5h1.5V1h-1.5zM5.5 3.75v-2.5H4v2.5h1.5zm-5 0v-2.5H0v2.5h.5zm10 0v-2.5H10v2.5h.5zM7.25 12.5v2.5h1.5v-2.5h-1.5zm3.25 0v2.5h1.5v-2.5h-1.5zM5.5 10.75v2.5H4v-2.5h1.5zm10 0v2.5H14v-2.5h.5zM2 8.5h2v1H2v-1zm10 0h2v1h-2v-1zM6.5 5.5h2v6h-2v-6zm-4 2h1.5v2H2.5v-2zm9 0H13v2h-1.5v-2z"/></svg>';

export function createKanbanBoard(opts) {
    var tasks = opts.tasks || [];
    var onDrop = opts.onDrop || function () {};
    var onEdit = opts.onEdit || function () {};

    var board = document.createElement('div');
    board.className = 'kanban-board';

    /* Group tasks by status */
    var groups = { pending: [], in_progress: [], completed: [] };
    for (var i = 0; i < tasks.length; i++) {
        var t = tasks[i];
        if (groups[t.status]) {
            groups[t.status].push(t);
        } else if (t.status === 'archived') {
            /* Archived tasks go to completed column with muted style */
            groups.completed.push(t);
        } else {
            groups.pending.push(t);
        }
    }

    /* Sort each column by priority */
    for (var key in groups) {
        groups[key].sort(function (a, b) {
            var pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 99;
            var pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 99;
            if (pa !== pb) return pa - pb;
            return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
        });
    }

    /* Render columns */
    for (var c = 0; c < COLUMNS.length; c++) {
        var col = COLUMNS[c];
        board.appendChild(_createColumn(col, groups[col.id], { onDrop: onDrop, onEdit: onEdit }));
    }

    return board;
}

function _createColumn(colDef, tasks, cbs) {
    var column = document.createElement('div');
    column.className = 'kanban-column';
    column.dataset.status = colDef.id;

    /* Column header */
    var header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.innerHTML =
        '<div class="kanban-column-title">' +
            '<span class="kanban-column-icon">' + colDef.icon + '</span>' +
            '<span class="kanban-column-label">' + colDef.label + '</span>' +
            '<span class="kanban-column-count" style="background:' + colDef.color + '15;color:' + colDef.color + '">' + tasks.length + '</span>' +
        '</div>' +
        '<div class="kanban-column-line" style="background:' + colDef.color + '30"></div>';

    column.appendChild(header);

    /* Scrollable card list */
    var cardList = document.createElement('div');
    cardList.className = 'kanban-card-list';

    if (tasks.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'kanban-empty';
        empty.innerHTML = '<span class="kanban-empty-text">Drop tasks here</span>';
        cardList.appendChild(empty);
    }

    for (var i = 0; i < tasks.length; i++) {
        cardList.appendChild(_createTaskCard(tasks[i], cbs));
    }

    column.appendChild(cardList);

    /* Drop zone events */
    _attachDropEvents(column, colDef.id, cbs.onDrop);

    return column;
}

function _createTaskCard(task, cbs) {
    var pri = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

    var card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.taskId = task.id;
    card.draggable = true;

    if (task.status === 'archived') {
        card.classList.add('kanban-card--archived');
    }

    /* Priority stripe */
    var stripe = document.createElement('div');
    stripe.className = 'kanban-card-stripe';
    stripe.style.background = pri.dot;

    /* Card content */
    var content = document.createElement('div');
    content.className = 'kanban-card-content';

    /* Title row */
    var titleRow = document.createElement('div');
    titleRow.className = 'kanban-card-title-row';

    var title = document.createElement('h4');
    title.className = 'kanban-card-title';
    title.textContent = task.title || 'Untitled';

    var moveBtn = document.createElement('button');
    moveBtn.type = 'button';
    moveBtn.className = 'kanban-card-move-btn';
    moveBtn.innerHTML = SVG_MOVE;
    moveBtn.title = 'Move task';

    titleRow.appendChild(title);
    titleRow.appendChild(moveBtn);

    /* Meta row */
    var metaRow = document.createElement('div');
    metaRow.className = 'kanban-card-meta';

    /* Priority badge */
    var priBadge = document.createElement('span');
    priBadge.className = 'kanban-pri-badge';
    priBadge.style.color = pri.dot;
    priBadge.style.background = pri.dot + '15';
    priBadge.textContent = pri.label;
    metaRow.appendChild(priBadge);

    /* Due date */
    if (task.dueDate) {
        var dueEl = document.createElement('span');
        dueEl.className = 'kanban-card-due';
        var today = new Date().toISOString().slice(0, 10);
        if (task.dueDate < today && task.status !== 'completed') {
            dueEl.classList.add('kanban-card-due--overdue');
        }
        dueEl.textContent = _formatDateShort(task.dueDate);
        metaRow.appendChild(dueEl);
    }

    /* Time estimate */
    if (task.timeEstimate) {
        var timeEl = document.createElement('span');
        timeEl.className = 'kanban-card-time';
        timeEl.textContent = formatMinutes(task.timeEstimate);
        metaRow.appendChild(timeEl);
    }

    content.appendChild(titleRow);
    content.appendChild(metaRow);

    card.appendChild(stripe);
    card.appendChild(content);

    /* Drag events */
    _attachDragEvents(card);

    /* Click to edit */
    card.addEventListener('click', function (e) {
        if (e.target.closest('.kanban-card-move-btn')) return;
        if (cbs.onEdit) cbs.onEdit(task.id);
    });

    /* Move button (mobile fallback) */
    moveBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _showMoveMenu(card, task.id, cbs.onDrop);
    });

    return card;
}

/* ── Drag & Drop ───────────────────────────────────────── */

function _attachDragEvents(card) {
    card.addEventListener('dragstart', function (e) {
        card.classList.add('kanban-card--dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.taskId);
        /* Slight delay for visual feedback */
        requestAnimationFrame(function () {
            card.classList.add('kanban-card--ghost');
        });
    });

    card.addEventListener('dragend', function () {
        card.classList.remove('kanban-card--dragging', 'kanban-card--ghost');
        /* Remove all drop zone highlights */
        var cols = document.querySelectorAll('.kanban-column');
        for (var i = 0; i < cols.length; i++) {
            cols[i].classList.remove('kanban-column--drag-over');
        }
    });
}

function _attachDropEvents(column, targetStatus, onDrop) {
    column.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        column.classList.add('kanban-column--drag-over');
    });

    column.addEventListener('dragleave', function (e) {
        /* Only remove highlight if leaving the column entirely */
        if (!column.contains(e.relatedTarget)) {
            column.classList.remove('kanban-column--drag-over');
        }
    });

    column.addEventListener('drop', function (e) {
        e.preventDefault();
        column.classList.remove('kanban-column--drag-over');

        var taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!taskId) return;

        onDrop(taskId, targetStatus);
    });
}

/* ── Mobile Move Menu ──────────────────────────────────── */

function _showMoveMenu(card, taskId, onDrop) {
    /* Remove any existing menu */
    var existing = document.querySelector('.kanban-move-menu');
    if (existing) existing.remove();

    var menu = document.createElement('div');
    menu.className = 'kanban-move-menu';
    menu.innerHTML =
        '<button type="button" class="kanban-move-option" data-status="pending">' +
            '<span class="kanban-move-dot" style="background:#71717a"></span>To Do' +
        '</button>' +
        '<button type="button" class="kanban-move-option" data-status="in_progress">' +
            '<span class="kanban-move-dot" style="background:#60a5fa"></span>In Progress' +
        '</button>' +
        '<button type="button" class="kanban-move-option" data-status="completed">' +
            '<span class="kanban-move-dot" style="background:#22c55e"></span>Done' +
        '</button>';

    /* Position near the card */
    var rect = card.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.left = rect.left + 'px';
    menu.style.zIndex = '100';

    /* Handle option clicks */
    var options = menu.querySelectorAll('.kanban-move-option');
    for (var i = 0; i < options.length; i++) {
        options[i].addEventListener('click', (function (btn) {
            return function () {
                var status = btn.dataset.status;
                onDrop(taskId, status);
                menu.remove();
            };
        })(options[i]));
    }

    document.body.appendChild(menu);

    /* Close on outside click */
    function closeMenu(e) {
        if (!menu.contains(e.target) && !card.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    }
    setTimeout(function () {
        document.addEventListener('click', closeMenu);
    }, 10);
}

/* ── Helpers ───────────────────────────────────────────── */

function _formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}
