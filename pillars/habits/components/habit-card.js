/**
 * Tarteeb — Habit Card (Gamified)
 *
 * Premium minimalist card for each habit with:
 *   - Header: Habit name (left) + streak counter (right)
 *   - 30-day CSS Grid heatmap (GitHub-style contribution graph)
 *   - Clickable squares: today toggles, past colored if done, future outlines
 *   - Micro-interactions: glow on activation, bounce on click
 *
 * Factory signature:
 *   createHabitCard(opts) → HTMLElement
 *
 * opts:
 *   habit         {Object}   — habit definition
 *   heatmap30     {Object[]} — [{ date, completed, due }, ...] last 30 days
 *   streak        {number}   — current streak
 *   bestStreak    {number}   — best streak ever
 *   isTodayDone   {boolean}  — whether today is completed
 *   onToggleDay   {Function(dateStr)} — called when a day square is clicked
 *   onArchive     {Function(habitId)} — archive action
 *   onDelete      {Function(habitId)} — delete action
 */

'use strict';

var SVG_FIRE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M8 16c3.314 0 6-2 6-5.5 0-1.5-.5-4-2.5-6 .25 1.5-1.25 2-1.25 2C11 4 9 .5 6 0c.357 2 .5 4-2 6-1.25 1-2 2.729-2 4.5C2 14 4.686 16 8 16z"/></svg>';

var SVG_ARCHIVE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v1H0V2zm0 2h16v9a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm4 3a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z"/></svg>';

var SVG_DELETE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';

export function createHabitCard(opts) {
    var o = opts || {};
    var habit = o.habit || {};
    var heatmap30 = o.heatmap30 || [];
    var streak = o.streak || 0;
    var bestStreak = o.bestStreak || 0;
    var isTodayDone = !!o.isTodayDone;
    var onToggleDay = o.onToggleDay || function () {};
    var onArchive = o.onArchive || function () {};
    var onDelete = o.onDelete || function () {};

    var card = document.createElement('div');
    card.className = 'habit-card';
    card.dataset.habitId = habit.id;

    /* ── Header Row ── */
    var header = document.createElement('div');
    header.className = 'habit-card-header';

    /* Left: Icon + Name */
    var nameGroup = document.createElement('div');
    nameGroup.className = 'habit-card-name-group';

    var icon = document.createElement('span');
    icon.className = 'habit-card-icon';
    icon.textContent = habit.icon || '✅';

    var name = document.createElement('span');
    name.className = 'habit-card-name';
    name.textContent = habit.name || 'Unnamed habit';

    nameGroup.appendChild(icon);
    nameGroup.appendChild(name);

    /* Right: Streak counter */
    var streakWrap = document.createElement('div');
    streakWrap.className = 'habit-card-streak-wrap';

    if (streak > 0) {
        var streakBadge = document.createElement('div');
        streakBadge.className = 'habit-card-streak-badge';
        streakBadge.innerHTML = SVG_FIRE + '<span class="habit-card-streak-num">' + streak + '</span><span class="habit-card-streak-label"> Days</span>';
        streakBadge.title = 'Best: ' + bestStreak + ' days';
        streakWrap.appendChild(streakBadge);
    } else {
        var noStreak = document.createElement('div');
        noStreak.className = 'habit-card-streak-empty';
        noStreak.textContent = 'Start today';
        streakWrap.appendChild(noStreak);
    }

    header.appendChild(nameGroup);
    header.appendChild(streakWrap);

    /* ── Heatmap Grid (30 days) ── */
    var heatmapGrid = document.createElement('div');
    heatmapGrid.className = 'habit-heatmap-grid';

    for (var i = 0; i < heatmap30.length; i++) {
        (function (day, index) {
            var cell = document.createElement('div');
            cell.className = 'habit-heatmap-cell';
            cell.dataset.date = day.date;

            /* Determine cell state */
            var isToday = index === heatmap30.length - 1;
            var isPast = index < heatmap30.length - 1;
            var isFuture = index > heatmap30.length - 1;

            if (isFuture) {
                /* Future: empty outline */
                cell.classList.add('habit-cell--future');
                cell.title = _formatDateShort(day.date) + ' — Upcoming';
            } else if (day.completed) {
                /* Completed: filled with brand color */
                cell.classList.add('habit-cell--completed');
                cell.title = _formatDateShort(day.date) + ' — Done!';
            } else if (isToday) {
                /* Today, not completed: interactive pulse */
                cell.classList.add('habit-cell--today');
                cell.title = 'Click to mark complete';
            } else if (isPast) {
                /* Past, not completed: muted */
                cell.classList.add('habit-cell--missed');
                cell.title = _formatDateShort(day.date) + ' — Missed';
            }

            /* Only today is clickable */
            if (isToday) {
                cell.addEventListener('click', function () {
                    onToggleDay(day.date);
                });
            }

            heatmapGrid.appendChild(cell);
        })(heatmap30[i], i);
    }

    /* ── Footer Row: Date range + Actions ── */
    var footer = document.createElement('div');
    footer.className = 'habit-card-footer';

    var dateRange = document.createElement('span');
    dateRange.className = 'habit-card-date-range';
    if (heatmap30.length > 0) {
        dateRange.textContent = _formatDateShort(heatmap30[0].date) + ' — ' + _formatDateShort(heatmap30[heatmap30.length - 1].date);
    }

    var actions = document.createElement('div');
    actions.className = 'habit-card-actions';

    var archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.className = 'habit-card-action-btn';
    archiveBtn.title = 'Archive';
    archiveBtn.innerHTML = SVG_ARCHIVE;
    archiveBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        onArchive(habit.id);
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'habit-card-action-btn habit-card-action-danger';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = SVG_DELETE;
    deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        onDelete(habit.id);
    });

    actions.appendChild(archiveBtn);
    actions.appendChild(deleteBtn);

    footer.appendChild(dateRange);
    footer.appendChild(actions);

    /* ── Assemble ── */
    card.appendChild(header);
    card.appendChild(heatmapGrid);
    card.appendChild(footer);

    return card;
}

/* ── Helpers ────────────────────────────────────────────── */

function _formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}
