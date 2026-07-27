/**
 * Tarteeb — Task Card Component
 *
 * Single task row. Fully interactive: toggle, inline-edit title,
 * status-cycle, delete, and a context-sensitive edit button.
 *
 * Micro-interactions:
 *   Checkbox  → scale-pop + fill transition
 *   Title     → strikethrough on complete, click-to-edit
 *   Row       → bg shift on hover, delete slides out
 *   Overdue   → subtle red left-border accent
 */

import { PRIORITY, STATUS, formatMinutes } from '../domain/task-rules.js';

var PRIORITY_COLORS = {
    critical: 'bg-red-500',
    high:     'bg-orange-400',
    medium:   'bg-yellow-500',
    low:      'bg-sky-500',
};

var PRIORITY_LABELS = {
    critical: 'Critical',
    high:     'High',
    medium:   'Medium',
    low:      'Low',
};

var STATUS_NEXT = {
    pending:     'in_progress',
    in_progress: 'completed',
    completed:   'pending',
};

var STATUS_ICONS = {
    pending:     '<circle cx="12" cy="12" r="9" stroke-dasharray="4 2"/>',
    in_progress: '<path d="M12 6v6l4 2"/>',
    completed:   '<path d="M8 12l3 3 5-6"/>',
};

/**
 * Build a task card element.
 *
 * @param {Object} task
 * @param {Object} callbacks
 * @param {Function} callbacks.onToggle    (id)
 * @param {Function} callbacks.onDelete    (id)
 * @param {Function} callbacks.onUpdate    (id, patch)
 * @param {Function} callbacks.onEdit      (id)  — open full edit modal
 * @returns {HTMLElement}
 */
export function createTaskCard(task, callbacks) {
    var cbs = callbacks || {};
    var el = document.createElement('div');
    el.dataset.taskId = task.id;

    var isDone     = task.status === STATUS.COMPLETED;
    var isOverdue  = !isDone && task.dueDate && task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
    var isEditing  = false;

    el.className = [
        'group relative flex items-start gap-3 px-4 py-3 rounded-xl',
        'bg-surface-raised/50 hover:bg-surface-elevated/70',
        'border border-transparent hover:border-white/[0.04]',
        isOverdue ? 'border-l-2 border-l-status-error/60' : '',
        'transition-all duration-[200ms]',
    ].join(' ');

    /* ── Checkbox ── */
    var checkbox = document.createElement('button');
    checkbox.type = 'button';
    checkbox.role = 'checkbox';
    checkbox.setAttribute('aria-checked', String(isDone));
    checkbox.setAttribute('aria-label', 'Toggle completion');
    checkbox.className = [
        'flex-shrink-0 mt-[3px] w-[18px] h-[18px] rounded-md',
        'border-[1.5px] flex items-center justify-center',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-accent-tasks/40 focus:ring-offset-1 focus:ring-offset-surface-canvas',
        isDone
            ? 'bg-accent-tasks border-accent-tasks scale-100'
            : 'border-text-tertiary hover:border-text-secondary hover:scale-105',
    ].join(' ');

    checkbox.innerHTML = isDone
        ? '<svg viewBox="0 0 14 14" fill="none" class="w-3 h-3"><path d="M3 7.5l3 3 5.5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';

    checkbox.addEventListener('click', function (e) {
        e.stopPropagation();
        if (cbs.onToggle) cbs.onToggle(task.id);
    });

    /* ── Priority Dot ── */
    var dot = document.createElement('span');
    dot.className = 'mt-[7px] flex-shrink-0 w-2 h-2 rounded-full ' + (PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium);

    /* ── Content Column ── */
    var content = document.createElement('div');
    content.className = 'flex-1 min-w-0';

    /* Title (click to inline-edit) */
    var title = document.createElement('h4');
    title.className = [
        'text-[13px] font-medium leading-snug',
        'transition-all duration-300',
        isDone ? 'line-through text-text-disabled' : 'text-text-primary',
        !isDone ? 'cursor-pointer hover:text-accent-tasks' : '',
    ].join(' ');
    title.textContent = task.title || 'Untitled task';

    if (!isDone && cbs.onUpdate) {
        title.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            startInlineEdit();
        });
    }

    /* Meta row */
    var meta = document.createElement('div');
    meta.className = 'flex items-center gap-2 mt-1 flex-wrap';

    if (task.dueDate) {
        var due = document.createElement('span');
        var dateStr = new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        due.className = 'text-[11px] font-medium ' + (isOverdue ? 'text-status-error' : isDone ? 'text-text-disabled' : 'text-text-tertiary');
        due.textContent = (isOverdue ? 'Overdue · ' : '') + dateStr;
        meta.appendChild(due);
    }

    if (task.description) {
        var desc = document.createElement('span');
        desc.className = 'text-[11px] text-text-disabled truncate max-w-[120px]';
        desc.textContent = task.description;
        meta.appendChild(desc);
    }

    if (task.timeEstimate || task.timeSpent) {
        var timeInfo = document.createElement('span');
        timeInfo.className = 'text-[11px] text-text-disabled inline-flex items-center gap-1';
        var timeLabel = formatMinutes(task.timeEstimate || 0);
        if (task.timeSpent) {
            timeLabel = formatMinutes(task.timeSpent) + '/' + timeLabel;
        }
        timeInfo.innerHTML = '<svg viewBox="0 0 12 12" fill="currentColor" class="w-2.5 h-2.5 opacity-40"><path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 1a4 4 0 110 8 4 4 0 010-8zm.5 1a.5.5 0 00-.5.5v3.25l2.15 1.29a.5.5 0 00.5-.87L6.5 5.67V3a.5.5 0 00-.5-.5z"/></svg>' + timeLabel;
        meta.appendChild(timeInfo);
    }

    content.appendChild(title);
    content.appendChild(meta);

    /* ── Inline Edit Field ── */
    var editRow = document.createElement('div');
    editRow.className = 'mt-2 hidden';
    editRow.innerHTML =
        '<input type="text" class="inline-edit-input w-full bg-surface-elevated text-[13px] text-text-primary ' +
        'px-3 py-1.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-accent-tasks/50" maxlength="200">';

    var editInput = editRow.querySelector('.inline-edit-input');
    editInput.value = task.title;

    editInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') commitInlineEdit();
        if (e.key === 'Escape') cancelInlineEdit();
    });
    editInput.addEventListener('blur', function () {
        setTimeout(commitInlineEdit, 100);
    });

    function startInlineEdit() {
        isEditing = true;
        title.classList.add('hidden');
        editRow.classList.remove('hidden');
        editInput.value = task.title;
        editInput.focus();
        editInput.select();
    }

    function commitInlineEdit() {
        if (!isEditing) return;
        isEditing = false;
        var val = editInput.value.trim();
        if (val && val !== task.title) {
            if (cbs.onUpdate) cbs.onUpdate(task.id, { title: val });
        }
        editRow.classList.add('hidden');
        title.classList.remove('hidden');
    }

    function cancelInlineEdit() {
        isEditing = false;
        editInput.value = task.title;
        editRow.classList.add('hidden');
        title.classList.remove('hidden');
    }

    /* ── Action Buttons (hover-reveal) ── */
    var actions = document.createElement('div');
    actions.className = 'flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200';

    /* Status cycle button */
    var nextStatus = STATUS_NEXT[task.status] || 'pending';
    var cycleBtn = document.createElement('button');
    cycleBtn.type = 'button';
    cycleBtn.className = 'p-1.5 rounded-lg text-text-disabled hover:text-accent-tasks hover:bg-accent-tasks/10 transition-colors duration-150';
    cycleBtn.title = 'Move to ' + nextStatus.replace('_', ' ');
    cycleBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" class="w-3.5 h-3.5"><circle cx="8" cy="8" r="6"/>' + STATUS_ICONS[nextStatus] + '</svg>';
    cycleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (cbs.onUpdate) cbs.onUpdate(task.id, { status: nextStatus });
    });
    actions.appendChild(cycleBtn);

    /* Edit button */
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'p-1.5 rounded-lg text-text-disabled hover:text-text-secondary hover:bg-white/[0.06] transition-colors duration-150';
    editBtn.title = 'Edit task';
    editBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 015 12.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.468-.325z"/></svg>';
    editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (cbs.onEdit) cbs.onEdit(task.id);
    });
    actions.appendChild(editBtn);

    /* Delete button */
    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'p-1.5 rounded-lg text-text-disabled hover:text-status-error hover:bg-status-error/10 transition-colors duration-150';
    deleteBtn.title = 'Delete task';
    deleteBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';
    deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (cbs.onDelete) cbs.onDelete(task.id);
    });
    actions.appendChild(deleteBtn);

    /* ── Assemble ── */
    el.appendChild(checkbox);
    el.appendChild(dot);
    el.appendChild(content);
    el.appendChild(actions);
    el.appendChild(editRow);

    return el;
}
