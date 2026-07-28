/**
 * Tarteeb — Vision Board Component
 *
 * Premium visual board rendering goals as massive "Vision Cards" with:
 *   - SVG Circular Progress Ring (animated stroke-dashoffset)
 *   - Milestone pills (custom UI — dim + strike-through on toggle)
 *   - CSS Grid responsive layout (1-col → 2-col at md)
 *   - Hover-reveal action buttons
 *   - Inline milestone addition
 *   - Inspiring empty state ("Define your North Star")
 *
 * SVG Ring math:
 *   radius = 36, circumference = 2 * PI * 36 ≈ 226.19
 *   stroke-dasharray  = circumference
 *   stroke-dashoffset = circumference * (1 - percentage / 100)
 *   CSS transition on stroke-dashoffset for smooth fill
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
 *   onOpenQuickCapture   {Function()}  — opens quick capture modal for goals
 */

'use strict';

import {
    daysRemaining, formatDeadline, isOverdue,
    PRIORITY_LABELS, PRIORITY_COLORS,
} from '../domain/goal-rules.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_CHECK = '<svg viewBox="0 0 14 14" fill="none" class="w-3 h-3"><path d="M3 7.5l3 3 5.5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var SVG_DELETE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';

var SVG_RESTORE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path fill-rule="evenodd" d="M8 3a5 5 0 11-4.546 2.914.5.5 0 00-.908-.417A6 6 0 108 2v1z"/><path d="M8 4.466V.534a.25.25 0 00-.41-.192L5.23 2.308a.25.25 0 000 .384l2.36 1.966A.25.25 0 008 4.466z"/></svg>';

var SVG_TROPHY = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M2.5 0A2.5 2.5 0 000 2.5v1A2.5 2.5 0 002.5 6h1V4.5A2.5 2.5 0 006 2h4a2.5 2.5 0 002.5 2.5V6h1a2.5 2.5 0 002.5-2.5v-1A2.5 2.5 0 0013.5 0h-11zM1 8.5A1.5 1.5 0 002.5 10H4v2.5A2.5 2.5 0 006.5 15h3A2.5 2.5 0 0012 12.5V10h1.5a1.5 1.5 0 001.5-1.5v-1a.5.5 0 00-.5-.5H14V6h1.5a.5.5 0 00.5-.5v-1a1.5 1.5 0 00-1.5-1.5H1.5A1.5 1.5 0 000 4.5v1a.5.5 0 00.5.5H2v1H1.5A1.5 1.5 0 000 7.5v1z"/></svg>';

var SVG_PLUS_SM = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3.5 h-3.5"><path d="M7 3v8M3 7h8"/></svg>';

var SVG_STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

/* ── SVG Ring Constants ──────────────────────────────────── */

var RING_RADIUS = 36;
var RING_STROKE = 5;
var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; /* ≈ 226.19 */

/* ================================================================
   VISION BOARD — Factory
   ================================================================ */

export function createGoalBoard(opts) {
    var o = opts || {};
    var goals       = o.goals || [];
    var milestones  = o.milestones || [];
    var progressMap = o.progressMap || {};
    var filter      = o.filter || 'active';

    var board = document.createElement('div');
    board.className = 'vision-board';

    if (goals.length === 0) {
        board.appendChild(_renderEmptyState(filter, o));
        return board;
    }

    var grid = document.createElement('div');
    grid.className = 'vision-grid';

    for (var i = 0; i < goals.length; i++) {
        grid.appendChild(_renderVisionCard(goals[i], milestones, progressMap, o));
    }

    board.appendChild(grid);
    return board;
}

/* ================================================================
   INTERNAL — Vision Card Builder
   ================================================================ */

function _renderVisionCard(goal, allMilestones, progressMap, o) {
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

    /* Limit to 4 visible milestones in the card */
    var visibleMilestones = goalMilestones.slice(0, 4);
    var hiddenCount = goalMilestones.length - 4;

    /* ── Card wrapper ── */
    var card = document.createElement('div');
    card.className = 'vision-card';
    if (isCompleted) card.classList.add('vision-card--completed');
    if (isAbandoned) card.classList.add('vision-card--abandoned');
    if (isOverdueGoal) card.classList.add('vision-card--overdue');

    /* ── Ambient glow ── */
    if (!isCompleted && !isAbandoned) {
        var glow = document.createElement('div');
        glow.className = 'vision-card-glow';
        card.appendChild(glow);
    }

    /* ── Top accent strip ── */
    var strip = document.createElement('div');
    strip.className = 'vision-card-strip';
    if (progress.percentage >= 75) strip.classList.add('vision-card-strip--hot');
    card.appendChild(strip);

    /* ── Card inner layout ── */
    var inner = document.createElement('div');
    inner.className = 'vision-card-inner';

    /* ── Left column: SVG Ring + percentage ── */
    var ringCol = document.createElement('div');
    ringCol.className = 'vision-card-ring-col';

    ringCol.appendChild(_buildSVGRing(progress.percentage, isCompleted));

    var pctText = document.createElement('div');
    pctText.className = 'vision-card-pct';
    pctText.textContent = progress.total > 0 ? progress.percentage + '%' : '—';
    ringCol.appendChild(pctText);

    var milestoneSummary = document.createElement('div');
    milestoneSummary.className = 'vision-card-msummary';
    if (progress.total > 0) {
        milestoneSummary.textContent = progress.completed + ' / ' + progress.total;
    } else {
        milestoneSummary.textContent = 'No milestones';
    }
    ringCol.appendChild(milestoneSummary);

    inner.appendChild(ringCol);

    /* ── Right column: Content ── */
    var contentCol = document.createElement('div');
    contentCol.className = 'vision-card-content-col';

    /* ── Header: Emoji + Title + Priority ── */
    var header = document.createElement('div');
    header.className = 'vision-card-header';

    var emojiEl = document.createElement('span');
    emojiEl.className = 'vision-card-emoji';
    emojiEl.textContent = goal.emoji || '\uD83C\uDFAF';
    header.appendChild(emojiEl);

    var titleWrap = document.createElement('div');
    titleWrap.className = 'vision-card-title-wrap';

    var title = document.createElement('h3');
    title.className = 'vision-card-title';
    title.textContent = goal.title || 'Untitled vision';
    titleWrap.appendChild(title);

    /* Priority badge */
    var prioColor = PRIORITY_COLORS[goal.priority] || PRIORITY_COLORS.medium;
    var prioBadge = document.createElement('span');
    prioBadge.className = 'vision-card-prio';
    prioBadge.style.color = 'var(--goals-prio-' + (goal.priority || 'medium') + ')';
    prioBadge.style.background = 'var(--goals-prio-' + (goal.priority || 'medium') + '-bg)';
    prioBadge.textContent = PRIORITY_LABELS[goal.priority] || 'Medium';
    titleWrap.appendChild(prioBadge);

    header.appendChild(titleWrap);
    contentCol.appendChild(header);

    /* ── Description ── */
    if (goal.description) {
        var desc = document.createElement('p');
        desc.className = 'vision-card-desc';
        desc.textContent = goal.description;
        contentCol.appendChild(desc);
    }

    /* ── Deadline badge ── */
    var deadlineBadge = document.createElement('div');
    deadlineBadge.className = 'vision-card-deadline';
    if (isOverdueGoal) deadlineBadge.classList.add('vision-card-deadline--overdue');
    else if (goal.deadline && daysRemaining(goal.deadline) <= 7 && !isCompleted) {
        deadlineBadge.classList.add('vision-card-deadline--soon');
    }
    deadlineBadge.textContent = formatDeadline(goal.deadline);
    contentCol.appendChild(deadlineBadge);

    /* ── Milestone Pills ── */
    if (goalMilestones.length > 0) {
        var pillsWrap = document.createElement('div');
        pillsWrap.className = 'vision-card-pills';

        for (var mi = 0; mi < visibleMilestones.length; mi++) {
            pillsWrap.appendChild(_buildMilestonePill(visibleMilestones[mi], o));
        }

        if (hiddenCount > 0) {
            var morePill = document.createElement('span');
            morePill.className = 'vision-card-pill vision-card-pill--more';
            morePill.textContent = '+' + hiddenCount + ' more';
            pillsWrap.appendChild(morePill);
        }

        contentCol.appendChild(pillsWrap);
    }

    /* ── Inline add milestone (active goals only) ── */
    if (!isCompleted && !isAbandoned) {
        var addWrap = document.createElement('div');
        addWrap.className = 'vision-card-add-wrap';

        var addInput = document.createElement('input');
        addInput.type = 'text';
        addInput.className = 'vision-card-add-input';
        addInput.placeholder = 'Add milestone\u2026';

        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'vision-card-add-btn';
        addBtn.innerHTML = SVG_PLUS_SM;
        addBtn.title = 'Add milestone';

        function _submitMs() {
            var val = addInput.value.trim();
            if (val && o.onAddMilestone) {
                o.onAddMilestone(goal.id, val);
                addInput.value = '';
            }
        }

        addInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _submitMs(); }
        });
        addBtn.addEventListener('click', _submitMs);

        addWrap.appendChild(addInput);
        addWrap.appendChild(addBtn);
        contentCol.appendChild(addWrap);
    }

    inner.appendChild(contentCol);
    card.appendChild(inner);

    /* ── Footer: Actions (hover-reveal) ── */
    var footer = document.createElement('div');
    footer.className = 'vision-card-footer';

    if (isCompleted || isAbandoned) {
        footer.appendChild(_actionPill('Restore', SVG_RESTORE, function (e) {
            e.stopPropagation();
            if (o.onRestore) o.onRestore(goal.id);
        }, 'vision-card-action--restore'));
    } else {
        footer.appendChild(_actionPill('Complete', SVG_TROPHY, function (e) {
            e.stopPropagation();
            if (o.onComplete) o.onComplete(goal.id);
        }, 'vision-card-action--complete'));
    }

    footer.appendChild(_actionPill('Delete', SVG_DELETE, function (e) {
        e.stopPropagation();
        if (o.onDelete) o.onDelete(goal.id);
    }, 'vision-card-action--delete'));

    card.appendChild(footer);

    return card;
}

/* ================================================================
   INTERNAL — SVG Circular Progress Ring
   ================================================================ */

function _buildSVGRing(percentage, isCompleted) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'vision-ring');
    svg.setAttribute('viewBox', '0 0 82 82');

    /* Background track circle */
    var bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', '41');
    bgCircle.setAttribute('cy', '41');
    bgCircle.setAttribute('r', String(RING_RADIUS));
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    bgCircle.setAttribute('stroke-width', String(RING_STROKE));
    svg.appendChild(bgCircle);

    /* Foreground progress circle */
    var fgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fgCircle.setAttribute('class', 'vision-ring-progress');
    fgCircle.setAttribute('cx', '41');
    fgCircle.setAttribute('cy', '41');
    fgCircle.setAttribute('r', String(RING_RADIUS));
    fgCircle.setAttribute('fill', 'none');
    fgCircle.setAttribute('stroke-width', String(RING_STROKE));
    fgCircle.setAttribute('stroke-linecap', 'round');
    fgCircle.setAttribute('transform', 'rotate(-90 41 41)');

    /* Set initial state: circumference dasharray, offset = full (empty) */
    fgCircle.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE));

    if (isCompleted) {
        fgCircle.setAttribute('stroke', '#22c55e');
    } else {
        fgCircle.setAttribute('stroke', 'url(#ring-gradient-' + Math.round(percentage) + ')');
    }

    /* Start with offset = full circumference (0% filled) */
    fgCircle.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE));

    svg.appendChild(fgCircle);

    /* Gradient definition for the active ring */
    if (!isCompleted && percentage > 0) {
        var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        var grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', 'ring-gradient-' + Math.round(percentage));
        grad.setAttribute('x1', '0%');
        grad.setAttribute('y1', '0%');
        grad.setAttribute('x2', '100%');
        grad.setAttribute('y2', '100%');

        var stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', '#f472b6');
        grad.appendChild(stop1);

        var stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', '#c084fc');
        grad.appendChild(stop2);

        defs.appendChild(grad);
        svg.insertBefore(defs, svg.firstChild);
    }

    /* Animate the ring fill after paint */
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            var offset = RING_CIRCUMFERENCE * (1 - percentage / 100);
            fgCircle.setAttribute('stroke-dashoffset', String(offset));
        });
    });

    return svg;
}

/* ================================================================
   INTERNAL — Milestone Pill
   ================================================================ */

function _buildMilestonePill(milestone, o) {
    var pill = document.createElement('div');
    pill.className = 'vision-card-pill';
    if (milestone.isCompleted) pill.classList.add('vision-card-pill--done');

    var dot = document.createElement('span');
    dot.className = 'vision-card-pill-dot';
    if (milestone.isCompleted) dot.classList.add('vision-card-pill-dot--done');
    pill.appendChild(dot);

    var label = document.createElement('span');
    label.className = 'vision-card-pill-label';
    label.textContent = milestone.title;
    pill.appendChild(label);

    /* Click to toggle */
    pill.addEventListener('click', function (e) {
        e.stopPropagation();
        if (o.onToggleMilestone) o.onToggleMilestone(milestone.id);
    });

    /* Delete (hover-reveal) */
    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'vision-card-pill-del';
    delBtn.innerHTML = SVG_DELETE;
    delBtn.title = 'Remove milestone';
    delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (o.onDeleteMilestone) o.onDeleteMilestone(milestone.id);
    });
    pill.appendChild(delBtn);

    return pill;
}

/* ================================================================
   INTERNAL — Action Pill
   ================================================================ */

function _actionPill(label, icon, onClick, extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vision-card-action ' + (extraClass || '');
    btn.innerHTML = icon + '<span>' + label + '</span>';
    btn.addEventListener('click', onClick);
    return btn;
}

/* ================================================================
   INTERNAL — Empty State
   ================================================================ */

function _renderEmptyState(filter, o) {
    var empty = document.createElement('div');
    empty.className = 'vision-empty';

    if (filter === 'completed') {
        empty.innerHTML =
            '<div class="vision-empty-icon">\uD83C\uDFC6</div>' +
            '<p class="vision-empty-title">No completed goals yet</p>' +
            '<p class="vision-empty-hint">Your achievements will appear here.</p>';
    } else if (filter === 'abandoned') {
        empty.innerHTML =
            '<div class="vision-empty-icon">\uD83D\uDCCD</div>' +
            '<p class="vision-empty-title">No abandoned goals</p>' +
            '<p class="vision-empty-hint">Nothing here — that\'s a good sign.</p>';
    } else {
        /* Active / All — the inspiring North Star state */
        var starWrap = document.createElement('div');
        starWrap.className = 'vision-empty-star';
        starWrap.innerHTML = SVG_STAR;

        var title = document.createElement('h3');
        title.className = 'vision-empty-title vision-empty-title--hero';
        title.textContent = 'Define Your North Star';

        var hint = document.createElement('p');
        hint.className = 'vision-empty-hint vision-empty-hint--hero';
        hint.textContent = 'Set bold intentions. Break them into milestones. Watch your vision come to life.';

        var trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'vision-empty-trigger';
        trigger.innerHTML = SVG_PLUS_SM + '<span>Create Your First Goal</span>';
        trigger.addEventListener('click', function () {
            if (o && o.onOpenQuickCapture) {
                o.onOpenQuickCapture();
            }
        });

        empty.appendChild(starWrap);
        empty.appendChild(title);
        empty.appendChild(hint);
        empty.appendChild(trigger);
    }

    return empty;
}
