/**
 * Life OS — Goal Board Component
 *
 * Premium visual board rendering a collection of goals with:
 *   - Dynamic progress bars with animated fill
 *   - Visual weight (opacity, saturation, glow) mapped to completion
 *   - Expandable sub-project / milestone management per card
 *   - Hover-reveal action buttons (complete, abandon, delete, restore)
 *   - Inline milestone addition
 *   - Responsive grid layout (1-col → 2-col at md)
 *
 * Design language:
 *   Active goals:   full opacity, accent glow, bright progress bar
 *   Completed:      reduced opacity, green-tinted progress, line-through title
 *   Abandoned:      minimal opacity, grey tones, no glow
 *   Overdue:        red-tinted border, red deadline badge
 *
 * Factory signature:
 *   createGoalBoard(opts) → HTMLElement
 *
 * opts:
 *   goals          {Object[]}
 *   milestones     {Object[]}
 *   progressMap    {Object}         — { [goalId]: { completed, total, percentage } }
 *   filter         {string}         — 'active' | 'completed' | 'abandoned' | 'all'
 *   onComplete     {Function(id)}
 *   onAbandon      {Function(id)}
 *   onRestore      {Function(id)}
 *   onDelete       {Function(id)}
 *   onToggleMilestone    {Function(milestoneId)}
 *   onDeleteMilestone    {Function(milestoneId)}
 *   onAddMilestone       {Function(goalId, title)}
 */

'use strict';

import {
    daysRemaining, formatDeadline, isOverdue,
    PRIORITY_LABELS, PRIORITY_COLORS,
} from '../domain/goal-rules.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_CHECK = '<svg viewBox="0 0 14 14" fill="none" class="w-3 h-3"><path d="M3 7.5l3 3 5.5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var SVG_CHEVRON_DOWN = '<svg viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3 transition-transform duration-200"><path d="M3 4.5l3 3 3-3"/></svg>';

var SVG_DELETE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';

var SVG_ARCHIVE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v1H0V2zm0 2h16v9a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm4 3a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z"/></svg>';

var SVG_RESTORE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path fill-rule="evenodd" d="M8 3a5 5 0 11-4.546 2.914.5.5 0 00-.908-.417A6 6 0 108 2v1z"/><path d="M8 4.466V.534a.25.25 0 00-.41-.192L5.23 2.308a.25.25 0 000 .384l2.36 1.966A.25.25 0 008 4.466z"/></svg>';

var SVG_TROPHY = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M2.5 0A2.5 2.5 0 000 2.5v1A2.5 2.5 0 002.5 6h1V4.5A2.5 2.5 0 006 2h4a2.5 2.5 0 002.5 2.5V6h1a2.5 2.5 0 002.5-2.5v-1A2.5 2.5 0 0013.5 0h-11zM1 8.5A1.5 1.5 0 002.5 10H4v2.5A2.5 2.5 0 006.5 15h3A2.5 2.5 0 0012 12.5V10h1.5a1.5 1.5 0 001.5-1.5v-1a.5.5 0 00-.5-.5H14V6h1.5a.5.5 0 00.5-.5v-1a1.5 1.5 0 00-1.5-1.5H1.5A1.5 1.5 0 000 4.5v1a.5.5 0 00.5.5H2v1H1.5A1.5 1.5 0 000 7.5v1z"/></svg>';

var SVG_PLUS_SM = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3 h-3"><path d="M7 3v8M3 7h8"/></svg>';

/* ================================================================
   GOAL BOARD — Factory
   ================================================================ */

export function createGoalBoard(opts) {
    var o = opts || {};
    var goals       = o.goals || [];
    var milestones  = o.milestones || [];
    var progressMap = o.progressMap || {};
    var filter      = o.filter || 'active';

    var board = document.createElement('div');

    if (goals.length === 0) {
        board.appendChild(_renderEmptyState(filter));
        return board;
    }

    var grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3';

    for (var i = 0; i < goals.length; i++) {
        grid.appendChild(_renderGoalCard(goals[i], milestones, progressMap, o));
    }

    board.appendChild(grid);
    return board;
}

/* ================================================================
   INTERNAL — Goal Card Builder
   ================================================================ */

function _renderGoalCard(goal, allMilestones, progressMap, o) {
    var isCompleted   = goal.status === 'completed';
    var isAbandoned   = goal.status === 'abandoned';
    var isOverdueGoal = !isCompleted && !isAbandoned && isOverdue(goal.deadline);
    var progress      = progressMap[goal.id] || { completed: 0, total: 0, percentage: 0 };

    /* Filter milestones for this goal */
    var goalMilestones = [];
    for (var i = 0; i < allMilestones.length; i++) {
        if (allMilestones[i].goalId === goal.id) {
            goalMilestones.push(allMilestones[i]);
        }
    }
    goalMilestones.sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });

    /* ── Visual weight calculation ── */
    var weight = _computeVisualWeight(progress.percentage, isCompleted, isAbandoned);

    /* ── Card wrapper ── */
    var card = document.createElement('div');
    card.className = [
        'group relative rounded-2xl border transition-all duration-[250ms]',
        weight.cardBorder,
        weight.cardBg,
    ].join(' ');

    /* ── Decorative glow ── */
    if (!isCompleted && !isAbandoned) {
        var glow = document.createElement('div');
        glow.className = [
            'absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl pointer-events-none',
            'transition-opacity duration-500',
            weight.glowColor,
        ].join(' ');
        glow.style.opacity = String(weight.glowOpacity);
        card.appendChild(glow);
    }

    /* ── Progress ribbon (top edge accent) ── */
    if (progress.total > 0 && !isAbandoned) {
        var ribbon = document.createElement('div');
        ribbon.className = [
            'absolute top-0 left-4 right-4 h-[2px] rounded-b-full',
            'transition-all duration-500',
            isCompleted ? 'bg-status-success/40' : 'bg-accent-goals',
        ].join(' ');
        ribbon.style.width = Math.max(progress.percentage, 4) + '%';
        card.appendChild(ribbon);
    }

    /* ── Card content ── */
    var content = document.createElement('div');
    content.className = 'relative p-4';

    /* ── Top row: Emoji + Title + Priority ── */
    var topRow = document.createElement('div');
    topRow.className = 'flex items-start gap-3 mb-2';

    /* Emoji with subtle background */
    var emojiEl = document.createElement('span');
    emojiEl.className = [
        'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg',
        'transition-all duration-300 select-none',
        weight.emojiBg,
    ].join(' ');
    emojiEl.textContent = goal.emoji || '\uD83C\uDFAF';
    topRow.appendChild(emojiEl);

    var titleCol = document.createElement('div');
    titleCol.className = 'flex-1 min-w-0';

    var titleRow = document.createElement('div');
    titleRow.className = 'flex items-center gap-2 flex-wrap';

    var title = document.createElement('h3');
    title.className = [
        'text-[14px] font-semibold leading-tight transition-colors duration-300',
        weight.titleColor,
    ].join(' ');
    title.textContent = goal.title || 'Untitled goal';
    titleRow.appendChild(title);

    /* Priority badge */
    var prioColor = PRIORITY_COLORS[goal.priority] || PRIORITY_COLORS.medium;
    var prioBadge = document.createElement('span');
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

    /* ── Meta row: Deadline + Milestone count ── */
    var metaRow = document.createElement('div');
    metaRow.className = 'flex items-center justify-between gap-3 mb-3';

    var deadlineEl = document.createElement('span');
    var deadlineText = formatDeadline(goal.deadline);
    var deadlineColor = isOverdueGoal
        ? 'text-status-error font-semibold'
        : goal.deadline && daysRemaining(goal.deadline) <= 7 && !isCompleted
            ? 'text-status-warning'
            : 'text-text-disabled';
    deadlineEl.className = 'text-[11px] ' + deadlineColor;
    deadlineEl.textContent = deadlineText;
    metaRow.appendChild(deadlineEl);

    if (progress.total > 0) {
        var milestoneCount = document.createElement('span');
        milestoneCount.className = 'text-[11px] text-text-disabled tabular-nums';
        milestoneCount.textContent = progress.completed + '/' + progress.total + ' sub-projects';
        metaRow.appendChild(milestoneCount);
    }

    content.appendChild(metaRow);

    /* ── Progress bar ── */
    if (progress.total > 0) {
        var barWrap = document.createElement('div');
        barWrap.className = 'relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-1';

        var bar = document.createElement('div');
        bar.className = [
            'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
            isCompleted ? 'bg-status-success' : 'bg-accent-goals',
        ].join(' ');
        bar.style.width = '0%';
        barWrap.appendChild(bar);
        content.appendChild(barWrap);

        /* Animate progress fill after paint */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                bar.style.width = progress.percentage + '%';
            });
        });

        /* Percentage label */
        var pctLabel = document.createElement('div');
        pctLabel.className = 'text-[10px] text-text-disabled text-right tabular-nums mb-2';
        pctLabel.textContent = progress.percentage + '%';
        content.appendChild(pctLabel);
    }

    /* ── Expandable Milestones Section ── */
    var milestonesWrap = document.createElement('div');
    milestonesWrap.className = 'border-t border-white/[0.04] pt-2 mt-1';

    var milestonesExpanded = false;

    var milestonesHeader = document.createElement('button');
    milestonesHeader.type = 'button';
    milestonesHeader.className = [
        'flex items-center gap-2 w-full text-left py-1.5 px-1 rounded-lg',
        'text-[12px] font-medium text-text-tertiary',
        'hover:text-text-secondary hover:bg-white/[0.03]',
        'transition-colors duration-150',
    ].join(' ');

    var chevron = document.createElement('span');
    chevron.innerHTML = SVG_CHEVRON_DOWN;
    milestonesHeader.appendChild(chevron);

    var milestonesLabel = document.createElement('span');
    milestonesLabel.textContent = goalMilestones.length > 0
        ? 'Sub-Projects (' + progress.completed + '/' + progress.total + ')'
        : 'Sub-Projects';
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

    /* Milestone rows */
    for (var mi = 0; mi < goalMilestones.length; mi++) {
        milestonesList.appendChild(_milestoneRow(goalMilestones[mi], o));
    }

    /* Inline add milestone input (active goals only) */
    if (!isCompleted && !isAbandoned) {
        var addRow = document.createElement('div');
        addRow.className = 'flex items-center gap-2 mt-2';

        var addInput = document.createElement('input');
        addInput.type = 'text';
        addInput.className = [
            'flex-1 bg-transparent text-[12px] text-text-secondary',
            'px-2 py-1 rounded-lg',
            'border border-dashed border-white/[0.06]',
            'hover:border-white/[0.1] focus:border-accent-goals/30',
            'focus:outline-none transition-colors duration-150',
            'placeholder:text-text-disabled/40',
        ].join(' ');
        addInput.placeholder = 'Add a sub-project\u2026';

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = [
            'p-1 rounded-lg text-accent-goals/60 hover:text-accent-goals',
            'hover:bg-white/[0.04] transition-colors duration-150',
        ].join(' ');
        addBtn.innerHTML = SVG_PLUS_SM;
        addBtn.title = 'Add sub-project';

        function _submitMilestone() {
            var val = addInput.value.trim();
            if (val && o.onAddMilestone) {
                o.onAddMilestone(goal.id, val);
                addInput.value = '';
            }
        }

        addInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _submitMilestone(); }
        });
        addBtn.addEventListener('click', _submitMilestone);

        addRow.appendChild(addInput);
        addRow.appendChild(addBtn);
        milestonesList.appendChild(addRow);
    }

    milestonesWrap.appendChild(milestonesHeader);
    milestonesWrap.appendChild(milestonesList);
    content.appendChild(milestonesWrap);

    /* ── Empty milestones prompt ── */
    if (goalMilestones.length === 0 && !isCompleted && !isAbandoned) {
        var emptyPrompt = document.createElement('div');
        emptyPrompt.className = 'border-t border-white/[0.04] pt-3 mt-2';

        var emptyRow = document.createElement('div');
        emptyRow.className = 'flex items-center gap-2';

        var emptyInput = document.createElement('input');
        emptyInput.type = 'text';
        emptyInput.className = [
            'flex-1 bg-transparent text-[12px] text-text-secondary',
            'px-2 py-1 rounded-lg',
            'border border-dashed border-white/[0.06]',
            'hover:border-white/[0.1] focus:border-accent-goals/30',
            'focus:outline-none transition-colors duration-150',
            'placeholder:text-text-disabled/40',
        ].join(' ');
        emptyInput.placeholder = 'Add first sub-project\u2026';

        var emptyBtn = document.createElement('button');
        emptyBtn.type = 'button';
        emptyBtn.className = [
            'p-1 rounded-lg text-accent-goals/60 hover:text-accent-goals',
            'hover:bg-white/[0.04] transition-colors duration-150',
        ].join(' ');
        emptyBtn.innerHTML = SVG_PLUS_SM;

        function _submitFirst() {
            var val = emptyInput.value.trim();
            if (val && o.onAddMilestone) {
                o.onAddMilestone(goal.id, val);
                emptyInput.value = '';
            }
        }

        emptyInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _submitFirst(); }
        });
        emptyBtn.addEventListener('click', _submitFirst);

        emptyRow.appendChild(emptyInput);
        emptyRow.appendChild(emptyBtn);
        emptyPrompt.appendChild(emptyRow);
        content.appendChild(emptyPrompt);
    }

    /* ── Hover-reveal Actions ── */
    var actions = document.createElement('div');
    actions.className = [
        'flex items-center gap-1 pt-3 mt-2 border-t border-white/[0.04]',
        'opacity-0 group-hover:opacity-100',
        'transition-opacity duration-150',
    ].join(' ');

    if (isCompleted || isAbandoned) {
        actions.appendChild(_actionBtn('Restore', SVG_RESTORE, function (e) {
            e.stopPropagation();
            if (o.onRestore) o.onRestore(goal.id);
        }, 'text-accent-goals'));
    } else {
        actions.appendChild(_actionBtn('Complete', SVG_TROPHY, function (e) {
            e.stopPropagation();
            if (o.onComplete) o.onComplete(goal.id);
        }, 'text-accent-goals'));

        actions.appendChild(_actionBtn('Abandon', SVG_ARCHIVE, function (e) {
            e.stopPropagation();
            if (o.onAbandon) o.onAbandon(goal.id);
        }, 'text-text-disabled'));
    }

    actions.appendChild(_actionBtn('Delete', SVG_DELETE, function (e) {
        e.stopPropagation();
        if (o.onDelete) o.onDelete(goal.id);
    }, 'text-text-disabled hover:text-status-error'));

    content.appendChild(actions);
    card.appendChild(content);
    return card;
}

/* ================================================================
   INTERNAL — Milestone Row
   ================================================================ */

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
        'flex-1 text-[12px] transition-colors duration-200',
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
    delBtn.title = 'Delete sub-project';
    delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (o.onDeleteMilestone) o.onDeleteMilestone(milestone.id);
    });
    row.appendChild(delBtn);

    return row;
}

/* ================================================================
   INTERNAL — Action Button Helper
   ================================================================ */

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

/* ================================================================
   INTERNAL — Visual Weight Calculator
   ================================================================ */

/**
 * Derive visual properties from progress and status.
 * Maps percentage to opacity, glow, border, and background intensity.
 */
function _computeVisualWeight(percentage, isCompleted, isAbandoned) {
    if (isAbandoned) {
        return {
            cardBg:      'bg-surface-raised/30',
            cardBorder:  'border-white/[0.03]',
            titleColor:  'text-text-disabled',
            emojiBg:     'bg-white/[0.03]',
            glowColor:   '',
            glowOpacity: 0,
        };
    }

    if (isCompleted) {
        return {
            cardBg:      'bg-accent-goals/[0.04]',
            cardBorder:  'border-accent-goals/10',
            titleColor:  'text-accent-goals/60 line-through',
            emojiBg:     'bg-accent-goals/10',
            glowColor:   'bg-status-success/[0.06]',
            glowOpacity: 0.6,
        };
    }

    /* Active: scale visual weight by percentage */
    var p = percentage / 100;
    var glowOpacity = 0.2 + (p * 0.6);

    var bgClass, borderClass;
    if (p >= 0.75) {
        bgClass     = 'bg-accent-goals/[0.06] hover:bg-accent-goals/[0.09]';
        borderClass = 'border-accent-goals/15 hover:border-accent-goals/25';
    } else if (p >= 0.40) {
        bgClass     = 'bg-surface-raised/60 hover:bg-surface-elevated/50';
        borderClass = 'border-white/[0.06] hover:border-white/[0.10]';
    } else {
        bgClass     = 'bg-surface-raised/40 hover:bg-surface-raised/60';
        borderClass = 'border-white/[0.04] hover:border-white/[0.08]';
    }

    return {
        cardBg:      bgClass,
        cardBorder:  borderClass,
        titleColor:  'text-text-primary',
        emojiBg:     'bg-white/[0.04]',
        glowColor:   'bg-accent-goals/[0.06]',
        glowOpacity: glowOpacity,
    };
}

/* ================================================================
   INTERNAL — Empty State
   ================================================================ */

function _renderEmptyState(filter) {
    var empty = document.createElement('div');
    empty.className = 'text-center py-16';

    var configs = {
        active: {
            emoji: '\uD83C\uDFAF',
            title: 'No active goals',
            desc:  'Set your first goal below to start making progress.',
        },
        completed: {
            emoji: '\uD83C\uDFC6',
            title: 'No completed goals yet',
            desc:  'Your achievements will appear here.',
        },
        abandoned: {
            emoji: '\uD83D\uDCCD',
            title: 'No abandoned goals',
            desc:  'Nothing here — that\'s a good sign.',
        },
        all: {
            emoji: '\uD83C\uDFAF',
            title: 'No goals yet',
            desc:  'Set your first goal to get started.',
        },
    };

    var cfg = configs[filter] || configs.all;

    empty.innerHTML =
        '<div class="text-5xl mb-4 opacity-20">' + cfg.emoji + '</div>' +
        '<p class="text-[14px] text-text-secondary font-medium mb-1">' + cfg.title + '</p>' +
        '<p class="text-[12px] text-text-tertiary">' + cfg.desc + '</p>';

    return empty;
}
