/**
 * Life OS — Goal Card Component
 *
 * Premium card displaying a goal with progress bar, expandable
 * milestones, inline milestone management, and hover-reveal actions.
 *
 * Factory signature:
 *   createGoalCard(opts) → HTMLElement
 *
 * opts:
 *   goal          {Object}   — goal definition
 *   milestones    {Object[]} — milestones for this goal (pre-sorted)
 *   progress      {Object}   — { completed, total, percentage }
 *   showActions   {boolean}  — show complete/abandon/delete actions
 *   showMilestones {boolean} — show milestone management (default true for active)
 *   onComplete    {Function(goalId)}
 *   onAbandon     {Function(goalId)}
 *   onRestore     {Function(goalId)}
 *   onDelete      {Function(goalId)}
 *   onToggleMilestone  {Function(milestoneId)}
 *   onDeleteMilestone  {Function(milestoneId)}
 *   onAddMilestone     {Function(goalId, title)}
 */

'use strict';

import { daysRemaining, formatDeadline, isOverdue, PRIORITY_LABELS, PRIORITY_COLORS } from '../domain/goal-rules.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_CHECK = '<svg viewBox="0 0 14 14" fill="none" class="w-3 h-3"><path d="M3 7.5l3 3 5.5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var SVG_CHEVRON_DOWN = '<svg viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3 transition-transform duration-200"><path d="M3 4.5l3 3 3-3"/></svg>';

var SVG_DELETE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';

var SVG_ARCHIVE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v1H0V2zm0 2h16v9a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm4 3a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z"/></svg>';

var SVG_RESTORE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path fill-rule="evenodd" d="M8 3a5 5 0 11-4.546 2.914.5.5 0 00-.908-.417A6 6 0 108 2v1z"/><path d="M8 4.466V.534a.25.25 0 00-.41-.192L5.23 2.308a.25.25 0 000 .384l2.36 1.966A.25.25 0 008 4.466z"/></svg>';

var SVG_TROPHY = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M2.5 0A2.5 2.5 0 000 2.5v1A2.5 2.5 0 002.5 6h1V4.5A2.5 2.5 0 006 2h4a2.5 2.5 0 002.5 2.5V6h1a2.5 2.5 0 002.5-2.5v-1A2.5 2.5 0 0013.5 0h-11zM1 8.5A1.5 1.5 0 002.5 10H4v2.5A2.5 2.5 0 006.5 15h3A2.5 2.5 0 0012 12.5V10h1.5a1.5 1.5 0 001.5-1.5v-1a.5.5 0 00-.5-.5H14V6h1.5a.5.5 0 00.5-.5v-1a1.5 1.5 0 00-1.5-1.5H1.5A1.5 1.5 0 000 4.5v1a.5.5 0 00.5.5H2v1H1.5A1.5 1.5 0 000 7.5v1z"/></svg>';

var SVG_PLUS = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3 h-3"><path d="M7 3v8M3 7h8"/></svg>';

/* ── Factory ─────────────────────────────────────────────── */

export function createGoalCard(opts) {
    var o = opts || {};
    var goal       = o.goal || {};
    var milestones = o.milestones || [];
    var progress   = o.progress || { completed: 0, total: 0, percentage: 0 };
    var showActions    = o.showActions !== false;
    var showMilestones = o.showMilestones !== false;
    var isCompleted    = goal.status === 'completed';
    var isAbandoned    = goal.status === 'abandoned';
    var isOverdueGoal  = !isCompleted && !isAbandoned && isOverdue(goal.deadline);

    /* ── Card wrapper ── */
    var card = document.createElement('div');
    card.className = [
        'group relative rounded-2xl border transition-all duration-[200ms]',
        isCompleted
            ? 'bg-accent-goals/[0.04] border-accent-goals/10 opacity-70'
            : isAbandoned
                ? 'bg-surface-raised/30 border-white/[0.03] opacity-50'
                : isOverdueGoal
                    ? 'bg-status-error/[0.03] border-status-error/10 hover:border-status-error/20'
                    : 'bg-surface-raised/60 hover:bg-surface-elevated/50 border-white/[0.04] hover:border-white/[0.08]',
    ].join(' ');

    /* ── Decorative gradient for active goals ── */
    if (!isCompleted && !isAbandoned) {
        var glow = document.createElement('div');
        glow.className = 'absolute -top-8 -right-8 w-24 h-24 rounded-full bg-accent-goals/[0.05] blur-2xl pointer-events-none';
        card.appendChild(glow);
    }

    /* ── Card content ── */
    var content = document.createElement('div');
    content.className = 'relative p-4';

    /* ── Top row: Emoji + Title + Priority badge ── */
    var topRow = document.createElement('div');
    topRow.className = 'flex items-start gap-3 mb-2';

    var emojiEl = document.createElement('span');
    emojiEl.className = 'flex-shrink-0 text-xl leading-none select-none mt-0.5';
    emojiEl.textContent = goal.emoji || '🎯';
    topRow.appendChild(emojiEl);

    var titleCol = document.createElement('div');
    titleCol.className = 'flex-1 min-w-0';

    var titleRow = document.createElement('div');
    titleRow.className = 'flex items-center gap-2 flex-wrap';

    var title = document.createElement('h3');
    title.className = [
        'text-[14px] font-semibold leading-tight',
        isCompleted ? 'text-accent-goals/60 line-through' : 'text-text-primary',
    ].join(' ');
    title.textContent = goal.title || 'Untitled goal';
    titleRow.appendChild(title);

    /* Priority badge */
    var prioBadge = document.createElement('span');
    var prioColor = PRIORITY_COLORS[goal.priority] || PRIORITY_COLORS.medium;
    prioBadge.className = [
        'flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded',
        'bg-white/[0.04]',
        prioColor,
    ].join(' ');
    prioBadge.textContent = PRIORITY_LABELS[goal.priority] || 'Medium';
    titleRow.appendChild(prioBadge);

    titleCol.appendChild(titleRow);

    /* Category badge */
    if (goal.category && goal.category !== 'general') {
        var catBadge = document.createElement('span');
        catBadge.className = 'inline-block text-[10px] text-text-disabled px-1.5 py-0.5 rounded bg-white/[0.03] mt-1';
        catBadge.textContent = goal.category;
        titleCol.appendChild(catBadge);
    }

    topRow.appendChild(titleCol);
    content.appendChild(topRow);

    /* ── Description ── */
    if (goal.description) {
        var desc = document.createElement('p');
        desc.className = 'text-[12px] text-text-tertiary leading-relaxed mb-3 line-clamp-2';
        desc.textContent = goal.description;
        content.appendChild(desc);
    }

    /* ── Deadline + Progress row ── */
    var metaRow = document.createElement('div');
    metaRow.className = 'flex items-center justify-between gap-3 mb-3';

    /* Deadline */
    var deadlineEl = document.createElement('span');
    var deadlineText = formatDeadline(goal.deadline);
    var deadlineColor = isOverdueGoal
        ? 'text-status-error'
        : goal.deadline && daysRemaining(goal.deadline) <= 7 && !isCompleted
            ? 'text-status-warning'
            : 'text-text-disabled';
    deadlineEl.className = 'text-[11px] font-medium ' + deadlineColor;
    deadlineEl.textContent = deadlineText;
    metaRow.appendChild(deadlineEl);

    /* Milestone count */
    if (progress.total > 0) {
        var milestoneCount = document.createElement('span');
        milestoneCount.className = 'text-[11px] text-text-disabled tabular-nums';
        milestoneCount.textContent = progress.completed + '/' + progress.total + ' milestones';
        metaRow.appendChild(milestoneCount);
    }

    content.appendChild(metaRow);

    /* ── Progress bar ── */
    if (progress.total > 0) {
        var progressBarWrap = document.createElement('div');
        progressBarWrap.className = 'relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-1';

        var progressBar = document.createElement('div');
        progressBar.className = [
            'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
            isCompleted ? 'bg-accent-goals/60' : 'bg-accent-goals',
        ].join(' ');
        progressBar.style.width = progress.percentage + '%';
        progressBarWrap.appendChild(progressBar);
        content.appendChild(progressBarWrap);

        /* Percentage label */
        var pctLabel = document.createElement('div');
        pctLabel.className = 'text-[10px] text-text-disabled text-right tabular-nums mb-2';
        pctLabel.textContent = progress.percentage + '%';
        content.appendChild(pctLabel);
    }

    /* ── Expandable Milestones Section ── */
    if (showMilestones && milestones.length > 0) {
        var milestonesWrap = document.createElement('div');
        milestonesWrap.className = 'border-t border-white/[0.04] pt-2 mt-1';

        /* Toggle header */
        var milestonesHeader = document.createElement('button');
        milestonesHeader.type = 'button';
        milestonesHeader.className = [
            'flex items-center gap-2 w-full text-left py-1.5 px-1 rounded-lg',
            'text-[12px] font-medium text-text-tertiary',
            'hover:text-text-secondary hover:bg-white/[0.03]',
            'transition-colors duration-150',
        ].join(' ');

        var milestonesExpanded = false;

        var chevron = document.createElement('span');
        chevron.innerHTML = SVG_CHEVRON_DOWN;
        milestonesHeader.appendChild(chevron);

        var milestonesLabel = document.createElement('span');
        milestonesLabel.textContent = 'Milestones (' + progress.completed + '/' + progress.total + ')';
        milestonesHeader.appendChild(milestonesLabel);

        var milestonesList = document.createElement('div');
        milestonesList.className = 'space-y-1 mt-1 max-h-0 opacity-0 overflow-hidden transition-all duration-[250ms]';

        milestonesHeader.addEventListener('click', function () {
            milestonesExpanded = !milestonesExpanded;
            if (milestonesExpanded) {
                milestonesList.classList.remove('max-h-0', 'opacity-0');
                milestonesList.classList.add('max-h-[500px]', 'opacity-100');
                chevron.style.transform = 'rotate(180deg)';
            } else {
                milestonesList.classList.add('max-h-0', 'opacity-0');
                milestonesList.classList.remove('max-h-[500px]', 'opacity-100');
                chevron.style.transform = '';
            }
        });

        /* Milestone items */
        for (var mi = 0; mi < milestones.length; mi++) {
            milestonesList.appendChild(_milestoneRow(milestones[mi], o));
        }

        /* Add milestone input */
        if (!isCompleted && !isAbandoned) {
            var addMilestoneRow = document.createElement('div');
            addMilestoneRow.className = 'flex items-center gap-2 mt-2';

            var addMilestoneInput = document.createElement('input');
            addMilestoneInput.type = 'text';
            addMilestoneInput.className = [
                'flex-1 bg-transparent text-[12px] text-text-secondary',
                'px-2 py-1 rounded-lg',
                'border border-dashed border-white/[0.06]',
                'hover:border-white/[0.1] focus:border-accent-goals/30',
                'focus:outline-none transition-colors duration-150',
                'placeholder:text-text-disabled/40',
            ].join(' ');
            addMilestoneInput.placeholder = 'Add a milestone\u2026';

            var addMilestoneBtn = document.createElement('button');
            addMilestoneBtn.type = 'button';
            addMilestoneBtn.className = [
                'p-1 rounded-lg text-accent-goals/60 hover:text-accent-goals',
                'hover:bg-white/[0.04] transition-colors duration-150',
            ].join(' ');
            addMilestoneBtn.innerHTML = SVG_PLUS;
            addMilestoneBtn.title = 'Add milestone';

            function _submitMilestone() {
                var val = addMilestoneInput.value.trim();
                if (val && o.onAddMilestone) {
                    o.onAddMilestone(goal.id, val);
                    addMilestoneInput.value = '';
                }
            }

            addMilestoneInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); _submitMilestone(); }
            });
            addMilestoneBtn.addEventListener('click', _submitMilestone);

            addMilestoneRow.appendChild(addMilestoneInput);
            addMilestoneRow.appendChild(addMilestoneBtn);
            milestonesList.appendChild(addMilestoneRow);
        }

        milestonesWrap.appendChild(milestonesHeader);
        milestonesWrap.appendChild(milestonesList);
        content.appendChild(milestonesWrap);
    }

    /* ── Empty milestones prompt for active goals ── */
    if (showMilestones && milestones.length === 0 && !isCompleted && !isAbandoned) {
        var emptyMilestones = document.createElement('div');
        emptyMilestones.className = 'border-t border-white/[0.04] pt-3 mt-2';

        var addFirstRow = document.createElement('div');
        addFirstRow.className = 'flex items-center gap-2';

        var addFirstInput = document.createElement('input');
        addFirstInput.type = 'text';
        addFirstInput.className = [
            'flex-1 bg-transparent text-[12px] text-text-secondary',
            'px-2 py-1 rounded-lg',
            'border border-dashed border-white/[0.06]',
            'hover:border-white/[0.1] focus:border-accent-goals/30',
            'focus:outline-none transition-colors duration-150',
            'placeholder:text-text-disabled/40',
        ].join(' ');
        addFirstInput.placeholder = 'Add first milestone\u2026';

        var addFirstBtn = document.createElement('button');
        addFirstBtn.type = 'button';
        addFirstBtn.className = [
            'p-1 rounded-lg text-accent-goals/60 hover:text-accent-goals',
            'hover:bg-white/[0.04] transition-colors duration-150',
        ].join(' ');
        addFirstBtn.innerHTML = SVG_PLUS;

        function _submitFirstMilestone() {
            var val = addFirstInput.value.trim();
            if (val && o.onAddMilestone) {
                o.onAddMilestone(goal.id, val);
                addFirstInput.value = '';
            }
        }

        addFirstInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _submitFirstMilestone(); }
        });
        addFirstBtn.addEventListener('click', _submitFirstMilestone);

        addFirstRow.appendChild(addFirstInput);
        addFirstRow.appendChild(addFirstBtn);
        emptyMilestones.appendChild(addFirstRow);
        content.appendChild(emptyMilestones);
    }

    /* ── Hover-reveal Actions ── */
    if (showActions) {
        var actions = document.createElement('div');
        actions.className = [
            'flex items-center gap-1 pt-3 mt-2 border-t border-white/[0.04]',
            'opacity-0 group-hover:opacity-100',
            'transition-opacity duration-150',
        ].join(' ');

        if (isCompleted || isAbandoned) {
            /* Restore button for completed/abandoned goals */
            actions.appendChild(_actionBtn('Restore', SVG_RESTORE, function (e) {
                e.stopPropagation();
                if (o.onRestore) o.onRestore(goal.id);
            }, 'text-accent-goals'));
        } else {
            /* Complete button */
            actions.appendChild(_actionBtn('Complete', SVG_TROPHY, function (e) {
                e.stopPropagation();
                if (o.onComplete) o.onComplete(goal.id);
            }, 'text-accent-goals'));

            /* Abandon button */
            actions.appendChild(_actionBtn('Abandon', SVG_ARCHIVE, function (e) {
                e.stopPropagation();
                if (o.onAbandon) o.onAbandon(goal.id);
            }, 'text-text-disabled'));
        }

        /* Delete button (always available) */
        actions.appendChild(_actionBtn('Delete', SVG_DELETE, function (e) {
            e.stopPropagation();
            if (o.onDelete) o.onDelete(goal.id);
        }, 'text-text-disabled hover:text-status-error'));

        content.appendChild(actions);
    }

    card.appendChild(content);
    return card;
}

/* ── Milestone Row ───────────────────────────────────────── */

function _milestoneRow(milestone, o) {
    var row = document.createElement('div');
    row.className = [
        'group/ms flex items-center gap-2 py-1 px-1 rounded-lg',
        'hover:bg-white/[0.02] transition-colors duration-150',
    ].join(' ');

    /* Toggle checkbox */
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = [
        'flex-shrink-0 w-[18px] h-[18px] rounded-md',
        'border-[1.5px] flex items-center justify-center',
        'transition-all duration-200',
        milestone.isCompleted
            ? 'bg-accent-goals border-accent-goals text-white'
            : 'border-text-tertiary/40 hover:border-accent-goals/50',
    ].join(' ');
    toggle.innerHTML = milestone.isCompleted ? SVG_CHECK : '';

    toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (o.onToggleMilestone) o.onToggleMilestone(milestone.id);
    });

    row.appendChild(toggle);

    /* Title */
    var title = document.createElement('span');
    title.className = [
        'flex-1 text-[12px]',
        milestone.isCompleted
            ? 'text-text-disabled line-through'
            : 'text-text-secondary',
    ].join(' ');
    title.textContent = milestone.title;
    row.appendChild(title);

    /* Delete (hover-reveal) */
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = [
        'flex-shrink-0 p-0.5 rounded',
        'text-text-disabled opacity-0 group-hover/ms:opacity-100',
        'hover:text-status-error hover:bg-white/[0.04]',
        'transition-all duration-150',
    ].join(' ');
    delBtn.innerHTML = SVG_DELETE;
    delBtn.title = 'Delete milestone';
    delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (o.onDeleteMilestone) o.onDeleteMilestone(milestone.id);
    });
    row.appendChild(delBtn);

    return row;
}

/* ── Action Button Helper ────────────────────────────────── */

function _actionBtn(title, icon, onClick, extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = [
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
        'text-[11px] font-medium',
        'hover:bg-white/[0.06]',
        'transition-colors duration-150',
        extraClass || '',
    ].join(' ');
    btn.innerHTML = icon + '<span>' + title + '</span>';
    btn.addEventListener('click', onClick);
    return btn;
}
