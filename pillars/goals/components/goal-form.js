/**
 * Life OS — Goal Form Component
 *
 * Dual-mode modular form for:
 *   1. Creating high-level goals (mode: 'goal')
 *   2. Adding sub-projects / milestones to an existing goal (mode: 'milestone')
 *
 * Visual behavior (goal mode):
 *   1. Collapsed: dashed-border "Set a new goal..." trigger
 *   2. Focused: expands downward with title, description, emoji, category, priority, deadline
 *   3. Expanded: inline sub-project list builder for initial milestones
 *   4. Submitted: collapses, inputs clear, goal appears in board
 *   5. Escape: collapses without creating
 *
 * Visual behavior (milestone mode):
 *   1. Compact input row: text field + add button
 *   2. Enter / click: dispatches, field clears
 *   3. Escape: blurs
 *
 * Factory signatures:
 *   createGoalForm(opts)     → HTMLElement  (goal creation)
 *   createMilestoneForm(opts) → HTMLElement  (inline milestone addition)
 */

'use strict';

import { EMOJI_POOL, PRIORITY_LABELS } from '../domain/goal-rules.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_PLUS = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-4 h-4">' +
    '<path d="M7 3v8M3 7h8"/></svg>';

var SVG_PLUS_SM = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3 h-3">' +
    '<path d="M7 3v8M3 7h8"/></svg>';

var SVG_CHEVRON = '<svg viewBox="0 0 12 12" fill="currentColor" class="w-2.5 h-2.5"><path d="M3 5l3 3 3-3"/></svg>';

var SVG_CHECK = '<svg viewBox="0 0 14 14" fill="none" class="w-3 h-3"><path d="M3 7.5l3 3 5.5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var SVG_CLOSE = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3 h-3"><path d="M3 3l6 6M9 3l-6 6"/></svg>';

/* ── Priority color map (Tailwind classes) ──────────────── */

var PRIORITY_BTN_COLORS = {
    high:   'bg-status-error/15 text-status-error border-status-error/20',
    medium: 'bg-status-warning/15 text-status-warning border-status-warning/20',
    low:    'bg-status-success/15 text-status-success border-status-success/20',
};

/* ================================================================
   GOAL FORM — Factory
   ================================================================ */

/**
 * Create a goal creation form.
 * @param {Object} opts
 * @param {string[]} opts.categories — existing goal categories for autocomplete
 * @param {Function} opts.onSubmit — called with goal data object
 * @returns {HTMLElement}
 */
export function createGoalForm(opts) {
    var o = opts || {};
    var existingCategories = o.categories || [];

    var wrapper = document.createElement('div');
    wrapper.className = 'mb-4';

    var expanded = false;

    /* ── Collapsed state: single trigger ── */
    var collapsedRow = document.createElement('div');
    collapsedRow.className = [
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        'bg-surface-raised/40 border border-dashed border-white/[0.06]',
        'hover:border-accent-goals/30 hover:bg-surface-raised/60',
        'transition-all duration-200 cursor-text',
    ].join(' ');

    var plusIcon = document.createElement('span');
    plusIcon.className = 'text-accent-goals/60';
    plusIcon.innerHTML = SVG_PLUS;

    var placeholderText = document.createElement('span');
    placeholderText.className = 'text-[13px] text-text-tertiary select-none';
    placeholderText.textContent = 'Set a new goal\u2026';

    collapsedRow.appendChild(plusIcon);
    collapsedRow.appendChild(placeholderText);
    collapsedRow.addEventListener('click', function () { expand(); });

    /* ── Expanded state: full form ── */
    var expandedForm = document.createElement('div');
    expandedForm.className = [
        'rounded-xl bg-surface-raised border border-white/[0.06]',
        'overflow-hidden max-h-0 opacity-0',
        'transition-all duration-[300ms] ease-[cubic-bezier(0.45,0,0.55,1)]',
    ].join(' ');

    var formInner = document.createElement('div');
    formInner.className = 'p-4 space-y-3';

    /* ── Row 1: Emoji + Title ── */
    var row1 = document.createElement('div');
    row1.className = 'flex items-center gap-3';

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = [
        'flex-1 bg-transparent text-[14px] text-text-primary font-medium',
        'placeholder:text-text-disabled focus:outline-none',
    ].join(' ');
    titleInput.placeholder = 'What do you want to achieve?';
    titleInput.maxLength = 200;

    /* Emoji trigger */
    var emojiBtn = document.createElement('button');
    emojiBtn.type = 'button';
    emojiBtn.className = [
        'w-9 h-9 rounded-lg flex items-center justify-center text-lg',
        'bg-white/[0.04] hover:bg-white/[0.08]',
        'border border-white/[0.06] transition-colors duration-150',
    ].join(' ');
    emojiBtn.textContent = '\uD83C\uDFAF';
    emojiBtn.title = 'Pick an icon';

    /* Emoji picker dropdown */
    var emojiDropdown = document.createElement('div');
    emojiDropdown.className = [
        'hidden absolute left-0 top-full mt-1 z-20',
        'bg-surface-floating rounded-xl shadow-floating border border-white/[0.08]',
        'p-2 grid grid-cols-8 gap-1',
    ].join(' ');

    var selectedEmoji = '\uD83C\uDFAF';

    for (var ic = 0; ic < EMOJI_POOL.length; ic++) {
        (function (emoji) {
            var ib = document.createElement('button');
            ib.type = 'button';
            ib.className = 'w-7 h-7 rounded flex items-center justify-center text-sm hover:bg-white/[0.08] transition-colors';
            ib.textContent = emoji;
            ib.addEventListener('click', function (e) {
                e.stopPropagation();
                selectedEmoji = emoji;
                emojiBtn.textContent = emoji;
                emojiDropdown.classList.add('hidden');
            });
            emojiDropdown.appendChild(ib);
        })(EMOJI_POOL[ic]);
    }

    var emojiWrap = document.createElement('div');
    emojiWrap.className = 'relative';
    emojiWrap.appendChild(emojiBtn);
    emojiWrap.appendChild(emojiDropdown);

    emojiBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        emojiDropdown.classList.toggle('hidden');
    });

    row1.appendChild(titleInput);
    row1.appendChild(emojiWrap);

    /* ── Row 2: Description ── */
    var descInput = document.createElement('textarea');
    descInput.rows = 2;
    descInput.className = [
        'w-full bg-transparent text-[13px] text-text-secondary',
        'placeholder:text-text-disabled/50 focus:outline-none',
        'resize-none',
    ].join(' ');
    descInput.placeholder = 'Why is this important to you? (optional)';
    descInput.maxLength = 1000;

    /* ── Row 3: Category + Priority + Deadline ── */
    var row3 = document.createElement('div');
    row3.className = 'flex items-center gap-2 flex-wrap';

    var categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.className = [
        'flex-1 min-w-[100px] bg-transparent text-[12px] text-text-secondary',
        'px-2.5 py-1.5 rounded-lg',
        'border border-white/[0.06] hover:border-white/[0.1]',
        'focus:outline-none focus:border-accent-goals/40',
        'transition-colors duration-150',
        'placeholder:text-text-disabled/50',
    ].join(' ');
    categoryInput.placeholder = 'Category';
    categoryInput.maxLength = 50;

    /* Priority selector */
    var priorityWrap = document.createElement('div');
    priorityWrap.className = 'relative';

    var priorityBtn = document.createElement('button');
    priorityBtn.type = 'button';
    priorityBtn.className = [
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium',
        'text-text-secondary bg-white/[0.03] hover:bg-white/[0.06]',
        'border border-white/[0.06] transition-colors duration-150',
    ].join(' ');
    priorityBtn.innerHTML = '<span class="priority-label">Medium</span>' + SVG_CHEVRON;

    var priorityDropdown = document.createElement('div');
    priorityDropdown.className = [
        'hidden absolute left-0 top-full mt-1 z-20',
        'bg-surface-floating rounded-lg shadow-floating border border-white/[0.06]',
        'py-1 min-w-[120px]',
    ].join(' ');

    var priorityKeys = ['high', 'medium', 'low'];
    var currentPriority = 'medium';

    for (var pi = 0; pi < priorityKeys.length; pi++) {
        (function (key) {
            var pItem = document.createElement('button');
            pItem.type = 'button';
            pItem.className = [
                'w-full text-left px-3 py-1.5 text-[12px]',
                'hover:bg-white/[0.06] hover:text-text-primary',
                'transition-colors duration-100',
            ].join(' ');
            pItem.textContent = PRIORITY_LABELS[key];
            pItem.addEventListener('click', function (e) {
                e.stopPropagation();
                currentPriority = key;
                priorityBtn.querySelector('.priority-label').textContent = PRIORITY_LABELS[key];
                priorityDropdown.classList.add('hidden');
            });
            priorityDropdown.appendChild(pItem);
        })(priorityKeys[pi]);
    }

    priorityBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        priorityDropdown.classList.toggle('hidden');
    });

    priorityWrap.appendChild(priorityBtn);
    priorityWrap.appendChild(priorityDropdown);

    /* Deadline date picker */
    var deadlineInput = document.createElement('input');
    deadlineInput.type = 'date';
    deadlineInput.className = [
        'bg-transparent text-[12px] text-text-secondary',
        'px-2.5 py-1.5 rounded-lg',
        'border border-white/[0.06] hover:border-white/[0.1]',
        'focus:outline-none focus:border-accent-goals/40',
        'transition-colors duration-150',
        '[color-scheme:dark]',
    ].join(' ');
    deadlineInput.title = 'Deadline (optional)';

    row3.appendChild(categoryInput);
    row3.appendChild(priorityWrap);
    row3.appendChild(deadlineInput);

    /* ── Row 4: Inline Sub-Project Builder ── */
    var milestonesSection = document.createElement('div');
    milestonesSection.className = 'border-t border-white/[0.04] pt-3';

    var milestonesLabel = document.createElement('div');
    milestonesLabel.className = 'flex items-center justify-between mb-2';

    var milestonesLabelText = document.createElement('span');
    milestonesLabelText.className = 'text-[11px] font-medium text-text-tertiary uppercase tracking-wider';
    milestonesLabelText.textContent = 'Sub-Projects (optional)';

    var milestoneCount = document.createElement('span');
    milestoneCount.className = 'text-[11px] text-accent-goals/70 tabular-nums font-medium';
    milestoneCount.textContent = '0 added';

    milestonesLabel.appendChild(milestonesLabelText);
    milestonesLabel.appendChild(milestoneCount);
    milestonesSection.appendChild(milestonesLabel);

    /* Milestone list (items added inline) */
    var milestoneList = document.createElement('div');
    milestoneList.className = 'space-y-1.5 mb-2';
    milestonesSection.appendChild(milestoneList);

    /* Internal array tracking added milestones before goal submission */
    var pendingMilestones = [];

    /* Milestone input row */
    var milestoneInputRow = document.createElement('div');
    milestoneInputRow.className = 'flex items-center gap-2';

    var milestoneInput = document.createElement('input');
    milestoneInput.type = 'text';
    milestoneInput.className = [
        'flex-1 bg-transparent text-[12px] text-text-secondary',
        'px-2.5 py-1.5 rounded-lg',
        'border border-dashed border-white/[0.06]',
        'hover:border-white/[0.1] focus:border-accent-goals/30',
        'focus:outline-none transition-colors duration-150',
        'placeholder:text-text-disabled/40',
    ].join(' ');
    milestoneInput.placeholder = 'Define a sub-project step\u2026';

    var milestoneAddBtn = document.createElement('button');
    milestoneAddBtn.type = 'button';
    milestoneAddBtn.className = [
        'p-1.5 rounded-lg text-accent-goals/60 hover:text-accent-goals',
        'hover:bg-white/[0.04] transition-colors duration-150',
    ].join(' ');
    milestoneAddBtn.innerHTML = SVG_PLUS_SM;
    milestoneAddBtn.title = 'Add sub-project';

    function _addPendingMilestone() {
        var val = milestoneInput.value.trim();
        if (!val) return;
        pendingMilestones.push({ title: val });
        _renderPendingMilestones();
        milestoneInput.value = '';
        milestoneInput.focus();
    }

    function _removePendingMilestone(index) {
        pendingMilestones.splice(index, 1);
        _renderPendingMilestones();
    }

    function _renderPendingMilestones() {
        milestoneList.innerHTML = '';
        milestoneCount.textContent = pendingMilestones.length + ' added';

        for (var mi = 0; mi < pendingMilestones.length; mi++) {
            (function (idx) {
                var row = document.createElement('div');
                row.className = [
                    'group/ms flex items-center gap-2 py-1 px-2 rounded-lg',
                    'bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-100',
                ].join(' ');

                var num = document.createElement('span');
                num.className = 'flex-shrink-0 w-4 h-4 rounded-full bg-accent-goals/15 text-accent-goals text-[9px] font-bold flex items-center justify-center';
                num.textContent = String(idx + 1);
                row.appendChild(num);

                var title = document.createElement('span');
                title.className = 'flex-1 text-[12px] text-text-secondary truncate';
                title.textContent = pendingMilestones[idx].title;
                row.appendChild(title);

                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = [
                    'flex-shrink-0 p-0.5 rounded text-text-disabled',
                    'opacity-0 group-hover/ms:opacity-100',
                    'hover:text-status-error hover:bg-white/[0.04]',
                    'transition-all duration-100',
                ].join(' ');
                removeBtn.innerHTML = SVG_CLOSE;
                removeBtn.addEventListener('click', function () { _removePendingMilestone(idx); });
                row.appendChild(removeBtn);

                milestoneList.appendChild(row);
            })(mi);
        }
    }

    milestoneInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); _addPendingMilestone(); }
    });
    milestoneAddBtn.addEventListener('click', _addPendingMilestone);

    milestoneInputRow.appendChild(milestoneInput);
    milestoneInputRow.appendChild(milestoneAddBtn);
    milestonesSection.appendChild(milestoneInputRow);

    /* ── Row 5: Actions ── */
    var row4 = document.createElement('div');
    row4.className = 'flex items-center justify-end gap-2 pt-1';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = [
        'px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-tertiary',
        'hover:text-text-secondary hover:bg-white/[0.04]',
        'transition-colors duration-150',
    ].join(' ');
    cancelBtn.textContent = 'Cancel';

    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = [
        'px-4 py-1.5 rounded-lg text-[12px] font-medium',
        'bg-accent-goals text-white hover:brightness-110',
        'transition-all duration-200 shadow-[0_0_12px_rgba(244,114,182,0.15)]',
    ].join(' ');
    submitBtn.textContent = 'Create Goal';

    row4.appendChild(cancelBtn);
    row4.appendChild(submitBtn);

    /* ── Assemble form ── */
    formInner.appendChild(row1);
    formInner.appendChild(descInput);
    formInner.appendChild(row3);
    formInner.appendChild(milestonesSection);
    formInner.appendChild(row4);
    expandedForm.appendChild(formInner);

    /* ── Expand / Collapse ── */

    function expand() {
        if (expanded) return;
        expanded = true;
        collapsedRow.classList.add('hidden');
        expandedForm.classList.remove('max-h-0', 'opacity-0');
        expandedForm.classList.add('max-h-[600px]', 'opacity-100');
        requestAnimationFrame(function () { titleInput.focus(); });
    }

    function collapse() {
        expanded = false;
        expandedForm.classList.add('max-h-0', 'opacity-0');
        expandedForm.classList.remove('max-h-[600px]', 'opacity-100');
        collapsedRow.classList.remove('hidden');
        _resetForm();
    }

    function _resetForm() {
        titleInput.value = '';
        descInput.value = '';
        categoryInput.value = '';
        deadlineInput.value = '';
        selectedEmoji = '\uD83C\uDFAF';
        emojiBtn.textContent = '\uD83C\uDFAF';
        currentPriority = 'medium';
        priorityBtn.querySelector('.priority-label').textContent = 'Medium';
        pendingMilestones.length = 0;
        _renderPendingMilestones();
    }

    /* ── Gather Form Data ── */

    function gatherData() {
        return {
            title:       titleInput.value.trim(),
            description: descInput.value.trim(),
            emoji:       selectedEmoji,
            category:    categoryInput.value.trim() || 'general',
            priority:    currentPriority,
            deadline:    deadlineInput.value || null,
            milestones:  pendingMilestones.slice(),
        };
    }

    /* ── Submit ── */

    submitBtn.addEventListener('click', function () {
        var data = gatherData();
        if (!data.title) {
            titleInput.focus();
            return;
        }
        if (o.onSubmit) o.onSubmit(data);
        collapse();
    });

    cancelBtn.addEventListener('click', collapse);

    titleInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitBtn.click(); }
        if (e.key === 'Escape') collapse();
    });

    descInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') collapse();
    });

    /* ── Close dropdowns on outside click ── */
    wrapper.addEventListener('click', function (e) {
        if (!emojiWrap.contains(e.target)) {
            emojiDropdown.classList.add('hidden');
        }
        if (!priorityWrap.contains(e.target)) {
            priorityDropdown.classList.add('hidden');
        }
    });

    /* ── Assemble ── */
    wrapper.appendChild(collapsedRow);
    wrapper.appendChild(expandedForm);

    return wrapper;
}

/* ================================================================
   MILESTONE FORM — Factory (inline addition to existing goal)
   ================================================================ */

/**
 * Create an inline milestone addition form.
 * @param {Object} opts
 * @param {number} opts.goalId — target goal
 * @param {Function} opts.onSubmit — called with (goalId, title)
 * @returns {HTMLElement}
 */
export function createMilestoneForm(opts) {
    var o = opts || {};

    var row = document.createElement('div');
    row.className = 'flex items-center gap-2';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = [
        'flex-1 bg-transparent text-[12px] text-text-secondary',
        'px-2.5 py-1.5 rounded-lg',
        'border border-dashed border-white/[0.06]',
        'hover:border-white/[0.1] focus:border-accent-goals/30',
        'focus:outline-none transition-colors duration-150',
        'placeholder:text-text-disabled/40',
    ].join(' ');
    input.placeholder = 'Add a sub-project\u2026';

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = [
        'p-1.5 rounded-lg text-accent-goals/60 hover:text-accent-goals',
        'hover:bg-white/[0.04] transition-colors duration-150',
    ].join(' ');
    addBtn.innerHTML = SVG_PLUS_SM;
    addBtn.title = 'Add sub-project';

    function _submit() {
        var val = input.value.trim();
        if (val && o.onSubmit) {
            o.onSubmit(o.goalId, val);
            input.value = '';
        }
    }

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); _submit(); }
    });
    addBtn.addEventListener('click', _submit);

    row.appendChild(input);
    row.appendChild(addBtn);

    return row;
}
