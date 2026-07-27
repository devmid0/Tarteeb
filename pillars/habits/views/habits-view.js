/**
 * Life OS — Habits View (Main Wrapper)
 *
 * Top-level view for the Habits pillar. Manages section
 * switching (Today / All Habits / Statistics), hydration,
 * and the shared habit-store instance.
 *
 * Lifecycle:
 *   render()  → builds the shell (header, tabs, content slot)
 *   mount()   → hydrates store, binds events, renders section
 *   unmount() → unsubscribes all listeners, cleans up
 *
 * Design constraints:
 *   - Uses accent-habits color (#fb923c)
 *   - Filter/sort state lives on the class (survives event-driven re-renders)
 *   - Every button wired to dispatch() → gateway
 *   - Single re-render trigger: 'habits:changed'
 */

'use strict';

import { HabitStore, FREQUENCY, FREQUENCY_LABELS, DAY_LABELS, today } from '../state/habit-store.js';
import { HabitGateway } from '../../../persistence/gateways/habit-gateway.js';
import { createHabitForm } from '../components/habit-form.js';
import { createHabitList } from '../components/habit-list.js';

var SECTIONS = [
    { id: 'today',   label: 'Today',       description: 'Daily check-in' },
    { id: 'habits',  label: 'All Habits',  description: 'Manage habit definitions' },
    { id: 'stats',   label: 'Statistics',  description: 'Streak and completion data' },
];

export class HabitsView {
    constructor() {
        this.container = null;
        this.store     = null;
        this.currentSection = 'today';
        this._unsubs   = [];

        /* Stable UI state — survives event-driven re-renders */
        this._showArchived = false;
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render(section) {
        this.currentSection = section || 'today';

        var fragment = document.createDocumentFragment();

        /* Ambient gradient */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background = 'radial-gradient(ellipse at 30% 15%, rgba(251,146,60,0.04) 0%, transparent 60%)';

        /* Main container */
        var main = document.createElement('div');
        main.className = 'relative h-full p-6 md:p-8 max-w-4xl mx-auto';

        /* Header */
        var header = document.createElement('header');
        header.className = 'mb-6';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
                '<h1 class="text-[28px] font-heading font-semibold text-text-primary tracking-tight leading-none">' +
                    'Habits' +
                '</h1>' +
                '<span class="text-[12px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
                '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-1">Build consistency, one day at a time.</p>';

        /* Section Tabs */
        var tabs = document.createElement('div');
        tabs.className = 'flex gap-0.5 p-1 bg-surface-raised/60 rounded-xl mb-6 w-fit';

        for (var i = 0; i < SECTIONS.length; i++) {
            var sec = SECTIONS[i];
            var tab = document.createElement('button');
            var isActive = this.currentSection === sec.id;

            tab.className = [
                'px-4 py-2 rounded-lg text-[13px] font-medium',
                'transition-all duration-[200ms] ease-[cubic-bezier(0.45,0,0.55,1)]',
                isActive
                    ? 'bg-surface-elevated text-text-primary shadow-surface'
                    : 'text-text-tertiary hover:text-text-secondary',
            ].join(' ');
            tab.textContent = sec.label;
            tab.addEventListener('click', (function (secId) {
                return function () { window.location.hash = '/habits/' + secId; };
            })(sec.id));
            tabs.appendChild(tab);
        }

        /* Content slot (filled on mount) */
        var contentSlot = document.createElement('div');
        contentSlot.id = 'habits-content-slot';
        contentSlot.className = 'animate-entrance';

        main.appendChild(gradient);
        main.appendChild(header);
        main.appendChild(tabs);
        main.appendChild(contentSlot);
        fragment.appendChild(main);

        return fragment;
    }

    async mount(container) {
        this.container = container;

        /* Initialise persistence + state for this pillar */
        try {
            var db = window.__lifeOS && window.__lifeOS.database;
            if (db) {
                var gateway = new HabitGateway(db);
                this.store  = new HabitStore(window.__lifeOS.eventBus, gateway);
                await this.store.hydrate();
            }
        } catch (err) {
            console.error('[Habits] Failed to initialise store:', err);
        }

        this._renderSection();
        this._bindEvents();
    }

    unmount() {
        for (var i = 0; i < this._unsubs.length; i++) {
            this._unsubs[i]();
        }
        this._unsubs = [];
        this.container = null;
        this.store     = null;
    }

    /* ── Shared Callbacks ─────────────────────────────────── */

    _listCallbacks() {
        var self = this;
        var store = this.store;
        return {
            onToggle: function (id) {
                store.dispatch({ type: 'TOGGLE_COMPLETE', payload: { habitId: id } });
            },
            onArchive: function (id) {
                store.dispatch({ type: 'ARCHIVE_HABIT', payload: id });
            },
            onRestore: function (id) {
                store.dispatch({ type: 'RESTORE_HABIT', payload: id });
            },
            onDelete: function (id) {
                var habit = store.getHabitById(id);
                var name = habit ? habit.name : 'this habit';
                if (confirm('Delete "' + name + '" and all its records?')) {
                    store.dispatch({ type: 'DELETE_HABIT', payload: id });
                }
            },
        };
    }

    /* ── Section Rendering ────────────────────────────────── */

    _renderSection() {
        var slot = this.container && this.container.querySelector('#habits-content-slot');
        if (!slot) return;

        slot.innerHTML = '';
        slot.className = 'animate-entrance';

        switch (this.currentSection) {
            case 'today':
                this._renderTodaySection(slot);
                break;
            case 'habits':
                this._renderHabitsSection(slot);
                break;
            case 'stats':
                this._renderStatsSection(slot);
                break;
            default:
                this._renderTodaySection(slot);
        }
    }

    /* ── Today Section ────────────────────────────────────── */

    _renderTodaySection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading habits\u2026</div>';
            return;
        }

        var self = this;

        /* Summary hero */
        var summary = store.getTodaySummary();
        slot.appendChild(_todayHero(summary));

        /* Today's habits due */
        var todayStr = today();
        var dueHabits = store.getHabitsDueOnDate(todayStr);
        var completedMap = {};
        for (var i = 0; i < dueHabits.length; i++) {
            if (store.isHabitCompletedOnDate(dueHabits[i].id, todayStr)) {
                completedMap[dueHabits[i].id] = true;
            }
        }

        /* Build streaks + heatmap for due habits */
        var streaks = {};
        var heatmaps = {};
        for (var j = 0; j < dueHabits.length; j++) {
            var h = dueHabits[j];
            streaks[h.id] = {
                streak:         store.getStreak(h.id),
                bestStreak:     store.getBestStreak(h.id),
                completionRate: store.getCompletionRate(h.id),
            };
            heatmaps[h.id] = store.getWeekHeatmap(h.id);
        }

        /* Section label */
        var label = document.createElement('div');
        label.className = 'flex items-center justify-between mb-3';
        label.innerHTML =
            '<h3 class="text-[13px] font-medium text-text-secondary">Due Today</h3>' +
            '<span class="text-[11px] text-text-disabled tabular-nums">' +
                summary.completed + '/' + summary.totalDue + ' done' +
            '</span>';
        slot.appendChild(label);

        /* List */
        slot.appendChild(createHabitList({
            habits:       dueHabits,
            streaks:      streaks,
            completedMap: completedMap,
            heatmapData:  heatmaps,
            onToggle:     function (id) { self._dispatch('TOGGLE_COMPLETE', { habitId: id }); },
            onDelete:     function (id) {
                var habit = store.getHabitById(id);
                if (confirm('Delete "' + (habit ? habit.name : '') + '"?')) {
                    self._dispatch('DELETE_HABIT', id);
                }
            },
        }));

        /* Inline form */
        if (dueHabits.length === 0 && store.getActiveHabits().length === 0) {
            var emptyHint = document.createElement('div');
            emptyHint.className = 'text-center py-8';
            emptyHint.innerHTML =
                '<div class="text-4xl mb-3 opacity-20">\u26A1</div>' +
                '<p class="text-[14px] text-text-secondary font-medium mb-1">No habits to track today</p>' +
                '<p class="text-[12px] text-text-tertiary mb-4">Create habits in the All Habits tab to start building consistency.</p>';
            slot.appendChild(emptyHint);
        }

        slot.appendChild(createHabitForm({
            categories: store.getAllCategories(),
            onSubmit: function (data) { self._dispatch('ADD_HABIT', data); },
        }));
    }

    /* ── All Habits Section ───────────────────────────────── */

    _renderHabitsSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading habits\u2026</div>';
            return;
        }

        var self = this;
        var cbs  = this._listCallbacks();

        /* Archive toggle */
        var archiveRow = document.createElement('div');
        archiveRow.className = 'flex items-center justify-between mb-4';

        var countLabel = document.createElement('span');
        countLabel.className = 'text-[12px] text-text-tertiary';
        var activeCount = store.getActiveHabits().length;
        countLabel.textContent = activeCount + ' active habit' + (activeCount !== 1 ? 's' : '');
        archiveRow.appendChild(countLabel);

        var archiveBtn = document.createElement('button');
        archiveBtn.type = 'button';
        archiveBtn.className = [
            'px-2.5 py-1 rounded-lg text-[11px] font-medium',
            'border border-white/[0.05]',
            'transition-all duration-150',
            this._showArchived
                ? 'bg-status-warning/10 text-status-warning border-status-warning/20'
                : 'text-text-tertiary hover:text-text-secondary hover:border-white/[0.1]',
        ].join(' ');
        archiveBtn.textContent = this._showArchived ? 'Hide Archived' : 'Archived';
        archiveBtn.addEventListener('click', function () {
            self._showArchived = !self._showArchived;
            self._renderSection();
        });
        archiveRow.appendChild(archiveBtn);
        slot.appendChild(archiveRow);

        /* Habit list */
        var habits = this._showArchived ? store.getArchivedHabits() : store.getActiveHabits();

        var streaks = {};
        var heatmaps = {};
        var completedMap = {};
        var todayStr = today();

        for (var i = 0; i < habits.length; i++) {
            var h = habits[i];
            streaks[h.id] = {
                streak:         store.getStreak(h.id),
                bestStreak:     store.getBestStreak(h.id),
                completionRate: store.getCompletionRate(h.id),
            };
            heatmaps[h.id] = store.getWeekHeatmap(h.id);
            if (!h.archived && store.isHabitCompletedOnDate(h.id, todayStr)) {
                completedMap[h.id] = true;
            }
        }

        slot.appendChild(createHabitList({
            habits:        habits,
            streaks:       streaks,
            completedMap:  completedMap,
            heatmapData:   heatmaps,
            onToggle:      cbs.onToggle,
            onArchive:     cbs.onArchive,
            onRestore:     cbs.onRestore,
            onDelete:      cbs.onDelete,
            showArchived:  this._showArchived,
        }));

        /* Inline form (only when viewing active habits) */
        if (!this._showArchived) {
            slot.appendChild(createHabitForm({
                categories: store.getAllCategories(),
                onSubmit: function (data) { self._dispatch('ADD_HABIT', data); },
            }));
        }
    }

    /* ── Statistics Section ───────────────────────────────── */

    _renderStatsSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading habits\u2026</div>';
            return;
        }

        var stats = store.getStats();
        var allStreaks = store.getAllStreaks();

        /* Stats hero */
        slot.appendChild(_statsHero(stats));

        /* Streak leaderboard */
        if (allStreaks.length > 0) {
            var lbLabel = document.createElement('h3');
            lbLabel.className = 'text-[13px] font-medium text-text-secondary mb-3';
            lbLabel.textContent = 'Streak Leaderboard';
            slot.appendChild(lbLabel);

            var sorted = allStreaks.slice().sort(function (a, b) { return b.streak - a.streak; });

            var lbList = document.createElement('div');
            lbList.className = 'space-y-1.5';

            for (var i = 0; i < sorted.length; i++) {
                var entry = sorted[i];
                lbList.appendChild(_leaderboardRow(entry, i));
            }

            slot.appendChild(lbList);
        }

        /* Empty state */
        if (stats.totalHabits === 0) {
            slot.innerHTML +=
                '<div class="text-center py-12">' +
                    '<div class="text-4xl mb-3 opacity-20">\uD83D\uDCCA</div>' +
                    '<p class="text-[14px] text-text-secondary font-medium">No statistics yet</p>' +
                    '<p class="text-[12px] text-text-tertiary mt-1">Create habits and start completing them to see your progress.</p>' +
                '</div>';
        }
    }

    /* ── Helpers ──────────────────────────────────────────── */

    _dispatch(type, payload) {
        if (this.store) {
            this.store.dispatch({ type: type, payload: payload });
        }
    }

    /* ── Event Binding ────────────────────────────────────── */

    _bindEvents() {
        if (!this.store) return;
        var bus  = this.store.eventBus;
        var self = this;

        var refresh = function () { self._renderSection(); };

        bus.subscribe('habits:changed', refresh);
        bus.subscribe('habits:validation-error', function (errors) {
            console.warn('[Habits] Validation:', errors);
        });

        this._unsubs.push(
            function () { bus.unsubscribe('habits:changed', refresh); },
            function () {
                bus.unsubscribe('habits:validation-error', function (errors) {
                    console.warn('[Habits] Validation:', errors);
                });
            }
        );
    }
}

/* ================================================================
   INTERNAL UI BUILDERS — Pure functions, no state
   ================================================================ */

/**
 * Today's summary hero card.
 */
function _todayHero(summary) {
    var s = summary || {};
    var total    = s.totalDue || 0;
    var done     = s.completed || 0;
    var pct      = s.percentage || 0;

    var hero = document.createElement('div');
    hero.className = [
        'relative overflow-hidden rounded-2xl mb-5',
        'bg-gradient-to-br from-accent-habits/8 via-surface-raised/80 to-surface-raised/40',
        'border border-accent-habits/10',
        'px-6 py-5',
    ].join(' ');

    var inner = '<div class="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-accent-habits/[0.06] blur-3xl pointer-events-none"></div>';
    inner += '<div class="relative">';
    inner +=   '<div class="flex items-center justify-between mb-3">';
    inner +=     '<div>';
    inner +=       '<div class="text-[11px] font-semibold text-accent-habits/70 uppercase tracking-widest mb-0.5">Today</div>';
    inner +=       '<div class="text-[28px] font-heading font-bold text-text-primary leading-none tabular-nums">';
    inner +=         done + '<span class="text-[14px] font-medium text-text-tertiary ml-1">/ ' + total + '</span>';
    inner +=       '</div>';
    inner +=     '</div>';

    /* Circular progress ring */
    if (total > 0) {
        var radius = 28;
        var circumference = 2 * Math.PI * radius;
        var offset = circumference - (pct / 100) * circumference;

        inner += '<div class="relative w-16 h-16">';
        inner +=   '<svg class="w-16 h-16 -rotate-90" viewBox="0 0 64 64">';
        inner +=     '<circle cx="32" cy="32" r="' + radius + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>';
        inner +=     '<circle cx="32" cy="32" r="' + radius + '" fill="none" stroke="#fb923c" stroke-width="4" stroke-linecap="round"' +
                         ' stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"' +
                         ' class="transition-all duration-700 ease-out"/>';
        inner +=   '</svg>';
        inner +=   '<div class="absolute inset-0 flex items-center justify-center">';
        inner +=     '<span class="text-[13px] font-bold text-accent-habits tabular-nums">' + pct + '%</span>';
        inner +=   '</div>';
        inner += '</div>';
    }

    inner += '</div>';

    /* Progress bar */
    if (total > 0) {
        inner += '<div class="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-1">';
        inner +=   '<div class="absolute inset-y-0 left-0 rounded-full bg-accent-habits transition-all duration-500" style="width:' + pct + '%"></div>';
        inner += '</div>';
    }

    inner += '</div>';
    hero.innerHTML = inner;
    return hero;
}

/**
 * Stats hero card with key metrics.
 */
function _statsHero(stats) {
    var hero = document.createElement('div');
    hero.className = [
        'relative overflow-hidden rounded-2xl mb-6',
        'bg-gradient-to-br from-accent-habits/8 via-surface-raised/80 to-surface-raised/40',
        'border border-accent-habits/10',
        'px-6 py-5',
    ].join(' ');

    var inner = '<div class="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-accent-habits/[0.05] blur-3xl pointer-events-none"></div>';
    inner += '<div class="relative">';
    inner +=   '<div class="text-[11px] font-semibold text-accent-habits/70 uppercase tracking-widest mb-3">Overview</div>';
    inner +=   '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">';

    inner += _statCell('Habits', stats.totalHabits, 'active');
    inner += _statCell('Completed Today', stats.todayCompleted, 'done');
    inner += _statCell('Longest Streak', stats.longestStreak + 'd', 'streak');
    inner += _statCell('Avg Streak', stats.averageStreak + 'd', 'avg');

    inner +=   '</div>';
    inner += '</div>';
    hero.innerHTML = inner;
    return hero;
}

function _statCell(label, value, type) {
    var colors = {
        active: 'text-text-primary',
        done:   'text-accent-habits',
        streak: 'text-accent-habits',
        avg:    'text-text-secondary',
    };
    return '<div>' +
        '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-0.5">' + label + '</div>' +
        '<div class="text-[18px] font-heading font-bold leading-none tabular-nums ' + (colors[type] || 'text-text-primary') + '">' + value + '</div>' +
    '</div>';
}

/**
 * Leaderboard row for the stats section.
 */
function _leaderboardRow(entry, rank) {
    var habit = entry.habit;
    var row = document.createElement('div');
    row.className = [
        'flex items-center gap-3 px-4 py-2.5 rounded-xl',
        'bg-surface-raised/40 border border-white/[0.03]',
    ].join(' ');

    /* Rank */
    var rankEl = document.createElement('span');
    rankEl.className = 'flex-shrink-0 w-6 text-center text-[12px] font-bold text-text-disabled tabular-nums';
    rankEl.textContent = rank + 1;
    row.appendChild(rankEl);

    /* Icon */
    var icon = document.createElement('span');
    icon.className = 'flex-shrink-0 text-base';
    icon.textContent = habit.icon || '✅';
    row.appendChild(icon);

    /* Name */
    var name = document.createElement('span');
    name.className = 'flex-1 text-[13px] font-medium text-text-primary truncate';
    name.textContent = habit.name || 'Unnamed';
    row.appendChild(name);

    /* Streak */
    var streak = document.createElement('span');
    streak.className = [
        'flex-shrink-0 inline-flex items-center gap-1',
        'text-[12px] font-bold tabular-nums',
        entry.streak > 0 ? 'text-accent-habits' : 'text-text-disabled',
    ].join(' ');
    streak.innerHTML = SVG_FIRE + '<span>' + entry.streak + '</span>';
    streak.title = 'Best: ' + entry.bestStreak + ' | 30d rate: ' + entry.completionRate + '%';
    row.appendChild(streak);

    /* Rate */
    var rate = document.createElement('span');
    rate.className = 'flex-shrink-0 text-[11px] text-text-disabled tabular-nums w-10 text-right';
    rate.textContent = entry.completionRate + '%';
    row.appendChild(rate);

    return row;
}

export default HabitsView;
