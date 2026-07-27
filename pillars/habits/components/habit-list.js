/**
 * Tarteeb — Habit List Component
 *
 * Premium list displaying habits with interactive completion toggles,
 * visual streak counters, 7-day mini heatmaps, and hover-reveal actions.
 *
 * Factory signature:
 *   createHabitList(opts) → HTMLElement
 *
 * opts:
 *   habits        {Object[]}  — array of habit definitions (pre-sorted)
 *   streaks       {Object}    — { habitId: { streak, bestStreak, completionRate } }
 *   completedMap  {Object}    — { "habitId": true } for habits completed today
 *   heatmapData   {Object}    — { habitId: [{ date, dayLabel, completed, due }] }
 *   onToggle      {Function(habitId)}  — completion toggle click
 *   onArchive     {Function(habitId)}  — archive action
 *   onDelete      {Function(habitId)}  — delete action
 *   showArchived  {boolean}   — true when viewing archived habits
 */

'use strict';

import { FREQUENCY_LABELS } from '../state/habit-store.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_CHECK = '<svg viewBox="0 0 14 14" fill="none" class="w-3.5 h-3.5"><path d="M3 7.5l3 3 5.5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var SVG_FIRE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16z"/></svg>';

var SVG_ARCHIVE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v1H0V2zm0 2h16v9a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm4 3a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z"/></svg>';

var SVG_DELETE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';

var SVG_RESTORE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path fill-rule="evenodd" d="M8 3a5 5 0 11-4.546 2.914.5.5 0 00-.908-.417A6 6 0 108 2v1z"/><path d="M8 4.466V.534a.25.25 0 00-.41-.192L5.23 2.308a.25.25 0 000 .384l2.36 1.966A.25.25 0 008 4.466z"/></svg>';

var SVG_EMPTY = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" class="w-12 h-12 mx-auto opacity-15"><rect x="6" y="6" width="36" height="36" rx="8"/><path d="M16 24h16M24 16v16" stroke-linecap="round"/></svg>';

/* ── Factory ─────────────────────────────────────────────── */

export function createHabitList(opts) {
    var o = opts || {};
    var habits       = o.habits || [];
    var streaks      = o.streaks || {};
    var completedMap = o.completedMap || {};
    var heatmapData  = o.heatmapData || {};
    var showArchived = !!o.showArchived;

    var el = document.createElement('div');

    if (habits.length === 0) {
        el.appendChild(_emptyState(showArchived));
        return el;
    }

    var list = document.createElement('div');
    list.className = 'space-y-1.5';

    for (var i = 0; i < habits.length; i++) {
        list.appendChild(_habitRow(habits[i], o));
    }

    el.appendChild(list);
    return el;
}

/* ── Habit Row Builder ───────────────────────────────────── */

function _habitRow(habit, o) {
    var isCompleted = !!(o.completedMap && o.completedMap[habit.id]);
    var streakInfo  = (o.streaks && o.streaks[habit.id]) || { streak: 0, bestStreak: 0, completionRate: 0 };
    var heatmap     = (o.heatmapData && o.heatmapData[habit.id]) || [];
    var isArchived  = !!habit.archived;

    var row = document.createElement('div');
    row.className = [
        'group relative flex items-center gap-3 px-4 py-3 rounded-xl',
        'transition-all duration-[200ms]',
        isCompleted
            ? 'bg-accent-habits/[0.06] border border-accent-habits/10'
            : 'bg-surface-raised/50 hover:bg-surface-elevated/70 border border-transparent hover:border-white/[0.04]',
        isArchived ? 'opacity-60' : '',
    ].join(' ');

    /* ── Completion Toggle ── */
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = [
        'flex-shrink-0 w-[22px] h-[22px] rounded-full',
        'border-[2px] flex items-center justify-center',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-accent-habits/40 focus:ring-offset-1 focus:ring-offset-surface-canvas',
        isCompleted
            ? 'bg-accent-habits border-accent-habits scale-100 shadow-[0_0_8px_rgba(251,146,60,0.25)]'
            : 'border-text-tertiary/50 hover:border-accent-habits/50 hover:scale-110',
    ].join(' ');
    toggle.innerHTML = isCompleted ? SVG_CHECK : '';
    toggle.title = isCompleted ? 'Mark incomplete' : 'Mark complete';

    toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        if (o.onToggle) o.onToggle(habit.id);
    });

    /* ── Icon ── */
    var icon = document.createElement('span');
    icon.className = 'flex-shrink-0 text-lg leading-none select-none w-7 text-center';
    icon.textContent = habit.icon || '✅';

    /* ── Content Column ── */
    var content = document.createElement('div');
    content.className = 'flex-1 min-w-0';

    /* Row 1: Name + badges */
    var nameRow = document.createElement('div');
    nameRow.className = 'flex items-center gap-2 min-w-0';

    var name = document.createElement('span');
    name.className = [
        'text-[13px] font-medium truncate',
        isCompleted ? 'text-accent-habits/80' : 'text-text-primary',
    ].join(' ');
    name.textContent = habit.name || 'Unnamed habit';
    nameRow.appendChild(name);

    /* Frequency badge */
    var freqBadge = document.createElement('span');
    freqBadge.className = 'flex-shrink-0 text-[10px] text-text-disabled px-1.5 py-0.5 rounded bg-white/[0.04]';
    freqBadge.textContent = FREQUENCY_LABELS[habit.frequency] || 'Daily';
    nameRow.appendChild(freqBadge);

    /* Category badge */
    if (habit.category && habit.category !== 'other') {
        var catBadge = document.createElement('span');
        catBadge.className = 'flex-shrink-0 text-[10px] text-text-disabled px-1.5 py-0.5 rounded bg-white/[0.04]';
        catBadge.textContent = habit.category;
        nameRow.appendChild(catBadge);
    }

    content.appendChild(nameRow);

    /* Row 2: Heatmap + Streak */
    var metaRow = document.createElement('div');
    metaRow.className = 'flex items-center gap-3 mt-1.5';

    /* 7-day heatmap dots */
    if (heatmap.length > 0) {
        var heatmapWrap = document.createElement('div');
        heatmapWrap.className = 'flex items-center gap-0.5';

        for (var h = 0; h < heatmap.length; h++) {
            var day = heatmap[h];
            var dot = document.createElement('span');
            var isToday = h === heatmap.length - 1;

            if (!day.due) {
                /* Not a scheduled day — empty space */
                dot.className = 'w-2 h-2 rounded-full bg-white/[0.02]';
            } else if (day.completed) {
                dot.className = [
                    'w-2 h-2 rounded-full',
                    'bg-accent-habits',
                    isToday ? 'shadow-[0_0_4px_rgba(251,146,60,0.4)]' : 'opacity-80',
                ].join(' ');
            } else {
                dot.className = 'w-2 h-2 rounded-full bg-white/[0.08]';
            }

            dot.title = day.dayLabel + ': ' + (day.completed ? 'Done' : day.due ? 'Missed' : 'Rest');
            heatmapWrap.appendChild(dot);
        }

        metaRow.appendChild(heatmapWrap);
    }

    /* Streak counter */
    if (streakInfo.streak > 0) {
        var streakPill = document.createElement('span');
        streakPill.className = [
            'inline-flex items-center gap-1 text-[11px] font-semibold',
            'text-accent-habits/90 tabular-nums',
        ].join(' ');
        streakPill.innerHTML = SVG_FIRE + '<span>' + streakInfo.streak + '</span>';
        streakPill.title = 'Best: ' + streakInfo.bestStreak + ' days';
        metaRow.appendChild(streakPill);
    }

    /* Completion rate */
    if (streakInfo.completionRate > 0) {
        var rateText = document.createElement('span');
        rateText.className = 'text-[10px] text-text-disabled tabular-nums';
        rateText.textContent = streakInfo.completionRate + '%';
        rateText.title = '30-day completion rate';
        metaRow.appendChild(rateText);
    }

    content.appendChild(metaRow);
    row.appendChild(toggle);
    row.appendChild(icon);
    row.appendChild(content);

    /* ── Hover-reveal Actions ── */
    var actions = document.createElement('div');
    actions.className = [
        'flex-shrink-0 flex items-center gap-0.5',
        'opacity-0 group-hover:opacity-100',
        'transition-opacity duration-150',
    ].join(' ');

    if (isArchived) {
        actions.appendChild(_actionBtn('Restore', SVG_RESTORE, function (e) {
            e.stopPropagation();
            if (o.onRestore) o.onRestore(habit.id);
        }, 'text-accent-habits'));
    } else {
        actions.appendChild(_actionBtn('Archive', SVG_ARCHIVE, function (e) {
            e.stopPropagation();
            if (o.onArchive) o.onArchive(habit.id);
        }, 'text-text-disabled'));
    }

    actions.appendChild(_actionBtn('Delete', SVG_DELETE, function (e) {
        e.stopPropagation();
        if (o.onDelete) o.onDelete(habit.id);
    }, 'text-text-disabled hover:text-status-error'));

    row.appendChild(actions);

    return row;
}

/* ── Empty State ─────────────────────────────────────────── */

function _emptyState(showArchived) {
    var el = document.createElement('div');
    el.className = 'text-center py-16';

    if (showArchived) {
        el.innerHTML =
            SVG_EMPTY +
            '<p class="text-[14px] text-text-secondary font-medium mt-4 mb-1">No archived habits</p>' +
            '<p class="text-[12px] text-text-tertiary">Habits you archive will appear here.</p>';
    } else {
        el.innerHTML =
            SVG_EMPTY +
            '<p class="text-[14px] text-text-secondary font-medium mt-4 mb-1">No habits yet</p>' +
            '<p class="text-[12px] text-text-tertiary">Create your first habit above to start building consistency.</p>';
    }

    return el;
}

/* ── Helpers ─────────────────────────────────────────────── */

function _actionBtn(title, icon, onClick, extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = [
        'p-1.5 rounded-lg',
        'text-text-tertiary',
        'hover:bg-white/[0.06]',
        'transition-colors duration-150',
        extraClass || '',
    ].join(' ');
    btn.innerHTML = icon;
    btn.addEventListener('click', onClick);
    return btn;
}
