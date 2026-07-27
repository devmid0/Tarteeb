/**
 * Tarteeb — Task Edit Modal
 *
 * Full-task editor rendered into the #modal-portal.
 * Handles title, description, priority, status, due date,
 * and project assignment.
 *
 * Lifecycle:
 *   openEditModal(task, projects, onSave)  — renders + shows
 *   closeEditModal()                       — tears down + removes
 *
 * Design: glassmorphic overlay, centered card, entrance animation.
 */

'use strict';

import { PRIORITY, STATUS } from '../domain/task-rules.js';

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

var STATUS_LABELS = {
    pending:     'To Do',
    in_progress: 'In Progress',
    completed:   'Completed',
    archived:    'Archived',
};

var _activeModal = null;

/**
 * Show the edit modal.
 *
 * @param {Object}   task       — full task object
 * @param {Array}    projects   — available projects
 * @param {Function} onSave     — called with patch { id, ...fields }
 * @param {Function} onDelete   — called with task id
 */
export function openEditModal(task, projects, onSave, onDelete) {
    closeEditModal();

    var portal = document.getElementById('modal-portal');
    if (!portal) return;

    var currentPriority = task.priority || PRIORITY.MEDIUM;
    var currentStatus   = task.status   || STATUS.PENDING;
    var currentProject  = task.projectId || null;

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
                '<h2 class="text-lg font-heading font-semibold text-text-primary">Edit Task</h2>' +
                '<button class="modal-close-btn p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-colors">' +
                    '<svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>' +
                '</button>' +
            '</div>' +

            /* Form fields */
            '<div class="space-y-4">' +

                /* Title */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Title</label>' +
                    '<input type="text" class="edit-title w-full bg-surface-elevated text-[14px] text-text-primary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-tasks/50 transition-colors" maxlength="200">' +
                '</div>' +

                /* Description */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Description</label>' +
                    '<textarea rows="3" class="edit-desc w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-tasks/50 transition-colors resize-none placeholder:text-text-disabled"></textarea>' +
                '</div>' +

                /* Priority + Status row */
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div>' +
                        '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Priority</label>' +
                        '<div class="relative">' +
                            '<button type="button" class="edit-priority-trigger w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-elevated border border-white/[0.06] hover:border-white/[0.1] transition-colors">' +
                                '<span class="edit-priority-dot w-2.5 h-2.5 rounded-full"></span>' +
                                '<span class="edit-priority-label text-[13px] text-text-secondary flex-1 text-left"></span>' +
                                '<svg viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3 text-text-disabled"><path d="M3 5l3 3 3-3"/></svg>' +
                            '</button>' +
                            '<div class="edit-priority-dropdown hidden absolute left-0 top-full mt-1 z-20 bg-surface-floating rounded-lg shadow-floating border border-white/[0.06] py-1 w-full"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div>' +
                        '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Status</label>' +
                        '<select class="edit-status w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-tasks/50 transition-colors [color-scheme:dark]"></select>' +
                    '</div>' +
                '</div>' +

                /* Due date + Project row */
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div>' +
                        '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Due Date</label>' +
                        '<input type="date" class="edit-due w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-tasks/50 transition-colors [color-scheme:dark]">' +
                    '</div>' +
                    '<div>' +
                        '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Project</label>' +
                        '<select class="edit-project w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-tasks/50 transition-colors [color-scheme:dark]"></select>' +
                    '</div>' +
                '</div>' +

                /* Time estimate + Time spent row */
                '<div class="grid grid-cols-2 gap-3">' +
                    '<div>' +
                        '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Time Estimate (min)</label>' +
                        '<input type="number" class="edit-time-estimate w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-tasks/50 transition-colors [color-scheme:dark]" min="0" step="15" placeholder="0">' +
                    '</div>' +
                    '<div>' +
                        '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Time Spent (min)</label>' +
                        '<input type="number" class="edit-time-spent w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-tasks/50 transition-colors [color-scheme:dark]" min="0" step="15" placeholder="0">' +
                    '</div>' +
                '</div>' +

                /* Timestamps */
                '<div class="flex items-center gap-4 text-[11px] text-text-disabled pt-1">' +
                    '<span>Created: ' + formatDate(task.createdAt) + '</span>' +
                    '<span>Updated: ' + formatDate(task.updatedAt) + '</span>' +
                '</div>' +

            '</div>' +

            /* Footer actions */
            '<div class="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">' +
                '<button class="edit-delete-btn px-3 py-2 rounded-lg text-[12px] font-medium text-status-error/70 hover:text-status-error hover:bg-status-error/10 transition-colors">' +
                    'Delete Task' +
                '</button>' +
                '<div class="flex items-center gap-2">' +
                    '<button class="edit-cancel-btn px-4 py-2 rounded-lg text-[13px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-colors">' +
                        'Cancel' +
                    '</button>' +
                    '<button class="edit-save-btn px-5 py-2 rounded-lg text-[13px] font-medium bg-accent-tasks text-white hover:brightness-110 transition-all shadow-[0_0_16px_rgba(52,211,153,0.15)]">' +
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

    var titleInput  = card.querySelector('.edit-title');
    var descInput   = card.querySelector('.edit-desc');
    var dueInput    = card.querySelector('.edit-due');
    var statusSelect= card.querySelector('.edit-status');
    var projectSelect= card.querySelector('.edit-project');
    var priorityDot = card.querySelector('.edit-priority-dot');
    var priorityLabel= card.querySelector('.edit-priority-label');
    var priorityDrop= card.querySelector('.edit-priority-dropdown');
    var priorityTrigger = card.querySelector('.edit-priority-trigger');

    titleInput.value = task.title || '';
    descInput.value  = task.description || '';
    dueInput.value   = task.dueDate || '';

    var timeEstimateInput = card.querySelector('.edit-time-estimate');
    var timeSpentInput    = card.querySelector('.edit-time-spent');
    if (timeEstimateInput) timeEstimateInput.value = task.timeEstimate || '';
    if (timeSpentInput) timeSpentInput.value = task.timeSpent || '';

    /* Status options */
    Object.keys(STATUS_LABELS).forEach(function (key) {
        var opt = document.createElement('option');
        opt.value = key;
        opt.textContent = STATUS_LABELS[key];
        if (key === currentStatus) opt.selected = true;
        statusSelect.appendChild(opt);
    });

    /* Project options */
    var noProj = document.createElement('option');
    noProj.value = '';
    noProj.textContent = 'No project';
    projectSelect.appendChild(noProj);
    projects.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === currentProject) opt.selected = true;
        projectSelect.appendChild(opt);
    });

    /* Priority dropdown */
    function setPriority(p) {
        currentPriority = p;
        priorityDot.className = 'edit-priority-dot w-2.5 h-2.5 rounded-full ' + (PRIORITY_COLORS[p] || PRIORITY_COLORS.medium);
        priorityLabel.textContent = PRIORITY_LABELS[p] || 'Medium';
    }

    setPriority(currentPriority);

    priorityDrop.innerHTML = '';
    Object.keys(PRIORITY).forEach(function (key) {
        var val = PRIORITY[key];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full flex items-center gap-2 px-3 py-2 text-[12px] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary transition-colors';
        btn.innerHTML = '<span class="w-2 h-2 rounded-full ' + (PRIORITY_COLORS[val] || '') + '"></span>' + (PRIORITY_LABELS[val] || val);
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            setPriority(val);
            priorityDrop.classList.add('hidden');
        });
        priorityDrop.appendChild(btn);
    });

    priorityTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        priorityDrop.classList.toggle('hidden');
    });

    /* Close dropdown on clicks inside the card */
    card.addEventListener('click', function (e) {
        if (!priorityTrigger.contains(e.target) && !priorityDrop.contains(e.target)) {
            priorityDrop.classList.add('hidden');
        }
    });

    /* ── Close handlers ── */

    function close() { closeEditModal(); }

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
        var patch = {
            id:          task.id,
            title:       titleInput.value.trim(),
            description: descInput.value.trim(),
            priority:    currentPriority,
            status:      statusSelect.value,
            dueDate:     dueInput.value || null,
            projectId:   projectSelect.value ? Number(projectSelect.value) : null,
            timeEstimate: timeEstimateInput && timeEstimateInput.value ? Number(timeEstimateInput.value) : null,
            timeSpent:    timeSpentInput && timeSpentInput.value ? Number(timeSpentInput.value) : null,
        };

        if (!patch.title) {
            titleInput.focus();
            return;
        }

        if (onSave) onSave(patch);
        closeEditModal();
    });

    /* ── Delete ── */

    card.querySelector('.edit-delete-btn').addEventListener('click', function () {
        if (onDelete) onDelete(task.id);
        closeEditModal();
    });

    /* Focus title on open */
    requestAnimationFrame(function () { titleInput.focus(); titleInput.select(); });
}

/**
 * Close and tear down the active modal.
 */
export function closeEditModal() {
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
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    } catch (e) {
        return '—';
    }
}
