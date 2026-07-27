/**
 * Life OS — Goals View (Main Wrapper)
 *
 * Top-level view for the Goals & Projects pillar. Manages section
 * switching (Active / Completed / Statistics), hydration,
 * and the shared goals-store instance.
 *
 * Lifecycle:
 *   render()  → builds the shell (header, tabs, content slot)
 *   mount()   → hydrates store, binds events, renders section
 *   unmount() → unsubscribes all listeners, cleans up
 *
 * Data flow:
 *   GoalsStore publishes 'goals:changed' → _renderSection() rebuilds DOM
 *   User interactions dispatch to GoalsStore → gateway → IndexedDB
 *
 * Design constraints:
 *   - Uses accent-goals color (#f472b6)
 *   - Single re-render trigger: 'goals:changed'
 *   - Every button wired to dispatch() → gateway
 *   - Imports GoalsStore (plural) from goals-store.js
 *   - Imports GoalsGateway (plural) from goals-gateway.js
 */

'use strict';

import { GoalsStore } from '../state/goals-store.js';
import { GoalsGateway } from '../../../persistence/gateways/goals-gateway.js';
import { createGoalForm, createMilestoneForm } from '../components/goal-form.js';
import { createGoalBoard } from '../components/goal-board.js';

var SECTIONS = [
    { id: 'active',    label: 'Active',     description: 'Goals in progress' },
    { id: 'completed', label: 'Completed',  description: 'Achieved goals' },
    { id: 'stats',     label: 'Statistics', description: 'Progress overview' },
];

export class GoalsView {
    constructor() {
        this.container = null;
        this.store     = null;
        this.currentSection = 'active';
        this._unsubs   = [];
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render(section) {
        this.currentSection = section || 'active';

        var fragment = document.createDocumentFragment();

        /* Ambient gradient */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background = 'radial-gradient(ellipse at 70% 20%, rgba(244,114,182,0.04) 0%, transparent 60%)';

        /* Main container */
        var main = document.createElement('div');
        main.className = 'relative h-full p-6 md:p-8 max-w-4xl mx-auto';

        /* Header */
        var header = document.createElement('header');
        header.className = 'mb-6';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
                '<h1 class="text-[28px] font-heading font-semibold text-text-primary tracking-tight leading-none">' +
                    'Goals & Projects' +
                '</h1>' +
                '<span class="text-[12px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
                '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-1">Set intentions, define sub-projects, track progress.</p>';

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
                return function () { window.location.hash = '/goals/' + secId; };
            })(sec.id));
            tabs.appendChild(tab);
        }

        /* Content slot (filled on mount) */
        var contentSlot = document.createElement('div');
        contentSlot.id = 'goals-content-slot';
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
                var gateway = new GoalsGateway(db);
                this.store  = new GoalsStore(window.__lifeOS.eventBus, gateway);
                await this.store.hydrate();
            }
        } catch (err) {
            console.error('[Goals] Failed to initialise store:', err);
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

    _goalCardCallbacks() {
        var store = this.store;
        return {
            onComplete: function (id) {
                var goal = store.getGoalById(id);
                var name = goal ? goal.title : 'this goal';
                if (confirm('Mark "' + name + '" as completed?')) {
                    store.dispatch({ type: 'COMPLETE_GOAL', payload: id });
                }
            },
            onAbandon: function (id) {
                var goal = store.getGoalById(id);
                var name = goal ? goal.title : 'this goal';
                if (confirm('Abandon "' + name + '"?')) {
                    store.dispatch({ type: 'ABANDON_GOAL', payload: id });
                }
            },
            onRestore: function (id) {
                store.dispatch({ type: 'RESTORE_GOAL', payload: id });
            },
            onDelete: function (id) {
                var goal = store.getGoalById(id);
                var name = goal ? goal.title : 'this goal';
                if (confirm('Permanently delete "' + name + '" and all its sub-projects?')) {
                    store.dispatch({ type: 'DELETE_GOAL', payload: id });
                }
            },
            onToggleMilestone: function (milestoneId) {
                store.dispatch({ type: 'TOGGLE_MILESTONE', payload: milestoneId });
            },
            onDeleteMilestone: function (milestoneId) {
                store.dispatch({ type: 'DELETE_MILESTONE', payload: milestoneId });
            },
            onAddMilestone: function (goalId, title) {
                store.dispatch({ type: 'ADD_MILESTONE', payload: { goalId: goalId, title: title } });
            },
        };
    }

    /* ── Section Rendering ────────────────────────────────── */

    _renderSection() {
        var slot = this.container && this.container.querySelector('#goals-content-slot');
        if (!slot) return;

        slot.innerHTML = '';
        slot.className = 'animate-entrance';

        switch (this.currentSection) {
            case 'active':
                this._renderActiveSection(slot);
                break;
            case 'completed':
                this._renderCompletedSection(slot);
                break;
            case 'stats':
                this._renderStatsSection(slot);
                break;
            default:
                this._renderActiveSection(slot);
        }
    }

    /* ── Active Section ───────────────────────────────────── */

    _renderActiveSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading goals\u2026</div>';
            return;
        }

        var self = this;
        var cbs  = this._goalCardCallbacks();
        var activeGoals = store.getActiveGoals();

        /* Section label */
        var label = document.createElement('div');
        label.className = 'flex items-center justify-between mb-4';
        label.innerHTML =
            '<span class="text-[12px] text-text-tertiary">' +
                activeGoals.length + ' active goal' + (activeGoals.length !== 1 ? 's' : '') +
            '</span>';
        slot.appendChild(label);

        /* Goal board */
        slot.appendChild(createGoalBoard({
            goals:       activeGoals,
            milestones:  store.milestones,
            progressMap: store.getAllProgress(),
            filter:      'active',
            onComplete:     cbs.onComplete,
            onAbandon:      cbs.onAbandon,
            onDelete:       cbs.onDelete,
            onToggleMilestone: cbs.onToggleMilestone,
            onDeleteMilestone: cbs.onDeleteMilestone,
            onAddMilestone: cbs.onAddMilestone,
        }));

        /* Goal creation form */
        slot.appendChild(createGoalForm({
            categories: store.getAllCategories(),
            onSubmit: function (data) {
                self._dispatch('ADD_GOAL', data);
                /* After goal is created, add any inline milestones */
                if (data.milestones && data.milestones.length > 0) {
                    /* Wait for the next state update so we have the new goal's id */
                    setTimeout(function () {
                        var latestGoals = store.goals;
                        var newest = latestGoals[latestGoals.length - 1];
                        if (newest) {
                            for (var m = 0; m < data.milestones.length; m++) {
                                store.dispatch({
                                    type: 'ADD_MILESTONE',
                                    payload: {
                                        goalId: newest.id,
                                        title:  data.milestones[m].title,
                                    },
                                });
                            }
                        }
                    }, 50);
                }
            },
        }));
    }

    /* ── Completed Section ────────────────────────────────── */

    _renderCompletedSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading goals\u2026</div>';
            return;
        }

        var cbs  = this._goalCardCallbacks();
        var completedGoals = store.getCompletedGoals();
        var abandonedGoals = store.getAbandonedGoals();

        /* Section label */
        var label = document.createElement('div');
        label.className = 'flex items-center justify-between mb-4';
        label.innerHTML =
            '<span class="text-[12px] text-text-tertiary">' +
                completedGoals.length + ' completed, ' +
                abandonedGoals.length + ' abandoned' +
            '</span>';
        slot.appendChild(label);

        /* Completed goals board */
        if (completedGoals.length > 0) {
            var completedHeading = document.createElement('h3');
            completedHeading.className = 'text-[12px] font-semibold text-accent-goals/60 uppercase tracking-wider mb-2';
            completedHeading.textContent = 'Completed';
            slot.appendChild(completedHeading);

            slot.appendChild(createGoalBoard({
                goals:       completedGoals,
                milestones:  store.milestones,
                progressMap: store.getAllProgress(),
                filter:      'completed',
                onRestore:      cbs.onRestore,
                onDelete:       cbs.onDelete,
                onToggleMilestone: cbs.onToggleMilestone,
                onDeleteMilestone: cbs.onDeleteMilestone,
            }));
        }

        /* Abandoned goals board */
        if (abandonedGoals.length > 0) {
            var abandonedHeading = document.createElement('h3');
            abandonedHeading.className = 'text-[12px] font-semibold text-text-disabled uppercase tracking-wider mb-2 mt-6';
            abandonedHeading.textContent = 'Abandoned';
            slot.appendChild(abandonedHeading);

            slot.appendChild(createGoalBoard({
                goals:       abandonedGoals,
                milestones:  store.milestones,
                progressMap: store.getAllProgress(),
                filter:      'abandoned',
                onRestore:      cbs.onRestore,
                onDelete:       cbs.onDelete,
                onToggleMilestone: cbs.onToggleMilestone,
                onDeleteMilestone: cbs.onDeleteMilestone,
            }));
        }

        /* Empty state */
        if (completedGoals.length === 0 && abandonedGoals.length === 0) {
            slot.appendChild(createGoalBoard({
                goals:      [],
                milestones: [],
                filter:     'completed',
            }));
        }
    }

    /* ── Statistics Section ───────────────────────────────── */

    _renderStatsSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading goals\u2026</div>';
            return;
        }

        var stats = store.getStats();

        /* Stats hero */
        slot.appendChild(_statsHero(stats));

        /* Upcoming deadlines */
        var upcoming = store.getUpcomingDeadlines(5);
        if (upcoming.length > 0) {
            var upcomingLabel = document.createElement('h3');
            upcomingLabel.className = 'text-[13px] font-medium text-text-secondary mb-3 mt-6';
            upcomingLabel.textContent = 'Upcoming Deadlines';
            slot.appendChild(upcomingLabel);

            var upcomingList = document.createElement('div');
            upcomingList.className = 'space-y-1.5';

            for (var u = 0; u < upcoming.length; u++) {
                var ug = upcoming[u];
                var uProgress = store.getProgress(ug.id);
                upcomingList.appendChild(_deadlineRow(ug, uProgress));
            }

            slot.appendChild(upcomingList);
        }

        /* Category breakdown */
        var categories = store.getAllCategories();
        if (categories.length > 0 && stats.totalGoals > 0) {
            var catLabel = document.createElement('h3');
            catLabel.className = 'text-[13px] font-medium text-text-secondary mb-3 mt-6';
            catLabel.textContent = 'By Category';
            slot.appendChild(catLabel);

            var catList = document.createElement('div');
            catList.className = 'space-y-1.5';

            for (var i = 0; i < categories.length; i++) {
                var cat = categories[i];
                var catGoals = store.getGoalsByCategory(cat);
                var catActive = catGoals.filter(function (g) { return g.status === 'active'; }).length;
                var catCompleted = catGoals.filter(function (g) { return g.status === 'completed'; }).length;

                var catRow = document.createElement('div');
                catRow.className = [
                    'flex items-center justify-between px-4 py-2.5 rounded-xl',
                    'bg-surface-raised/40 border border-white/[0.03]',
                ].join(' ');

                var catName = document.createElement('span');
                catName.className = 'text-[13px] font-medium text-text-primary';
                catName.textContent = cat;
                catRow.appendChild(catName);

                var catStats = document.createElement('span');
                catStats.className = 'text-[12px] text-text-disabled tabular-nums';
                catStats.textContent = catActive + ' active \u00B7 ' + catCompleted + ' done';
                catRow.appendChild(catStats);

                catList.appendChild(catRow);
            }

            slot.appendChild(catList);
        }

        /* Priority breakdown */
        if (stats.totalGoals > 0) {
            var prioLabel = document.createElement('h3');
            prioLabel.className = 'text-[13px] font-medium text-text-secondary mb-3 mt-6';
            prioLabel.textContent = 'By Priority';
            slot.appendChild(prioLabel);

            var prioList = document.createElement('div');
            prioList.className = 'grid grid-cols-3 gap-3';

            var priorities = ['high', 'medium', 'low'];
            var prioLabels = { high: 'High', medium: 'Medium', low: 'Low' };
            var prioColors = {
                high:   'text-status-error',
                medium: 'text-status-warning',
                low:    'text-status-success',
            };

            for (var p = 0; p < priorities.length; p++) {
                var prio = priorities[p];
                var prioGoals = store.getGoalsByPriority(prio);
                var prioActive = prioGoals.filter(function (g) { return g.status === 'active'; }).length;

                var prioCell = document.createElement('div');
                prioCell.className = [
                    'rounded-xl px-4 py-3 text-center',
                    'bg-surface-raised/40 border border-white/[0.03]',
                ].join(' ');

                prioCell.innerHTML =
                    '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-1">' + prioLabels[prio] + '</div>' +
                    '<div class="text-[18px] font-heading font-bold leading-none tabular-nums ' + (prioColors[prio] || 'text-text-primary') + '">' + prioActive + '</div>' +
                    '<div class="text-[10px] text-text-disabled mt-0.5">active</div>';

                prioList.appendChild(prioCell);
            }

            slot.appendChild(prioList);
        }

        /* Goals without milestones */
        var orphanGoals = store.getGoalsWithoutMilestones();
        if (orphanGoals.length > 0) {
            var orphanLabel = document.createElement('h3');
            orphanLabel.className = 'text-[13px] font-medium text-status-warning mb-3 mt-6';
            orphanLabel.textContent = 'Goals Without Sub-Projects';
            slot.appendChild(orphanLabel);

            var orphanNote = document.createElement('p');
            orphanNote.className = 'text-[12px] text-text-tertiary mb-3';
            orphanNote.textContent = 'These goals have no defined sub-projects. Breaking them into steps improves trackability.';
            slot.appendChild(orphanNote);

            var orphanList = document.createElement('div');
            orphanList.className = 'space-y-1.5';

            for (var oi = 0; oi < orphanGoals.length; oi++) {
                var og = orphanGoals[oi];
                var orphanRow = document.createElement('div');
                orphanRow.className = [
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl',
                    'bg-surface-raised/40 border border-white/[0.03]',
                ].join(' ');

                var orphanEmoji = document.createElement('span');
                orphanEmoji.className = 'text-base select-none';
                orphanEmoji.textContent = og.emoji || '\uD83C\uDFAF';
                orphanRow.appendChild(orphanEmoji);

                var orphanTitle = document.createElement('span');
                orphanTitle.className = 'flex-1 text-[13px] text-text-secondary font-medium';
                orphanTitle.textContent = og.title;
                orphanRow.appendChild(orphanTitle);

                var orphanBadge = document.createElement('span');
                orphanBadge.className = 'text-[10px] text-status-warning bg-status-warning/10 px-2 py-0.5 rounded font-medium';
                orphanBadge.textContent = 'No sub-projects';
                orphanRow.appendChild(orphanBadge);

                orphanList.appendChild(orphanRow);
            }

            slot.appendChild(orphanList);
        }

        /* Empty state */
        if (stats.totalGoals === 0) {
            slot.innerHTML +=
                '<div class="text-center py-12">' +
                    '<div class="text-5xl mb-3 opacity-20">\uD83D\uDCCA</div>' +
                    '<p class="text-[14px] text-text-secondary font-medium">No statistics yet</p>' +
                    '<p class="text-[12px] text-text-tertiary mt-1">Create goals and track sub-projects to see your progress.</p>' +
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

        var unsubChanged = bus.subscribe('goals:changed', refresh);
        var unsubError   = bus.subscribe('goals:error', function (msg) {
            console.warn('[Goals] Error:', msg);
        });
        var unsubValidation = bus.subscribe('goals:validation-error', function (errors) {
            console.warn('[Goals] Validation:', errors);
        });

        this._unsubs.push(unsubChanged, unsubError, unsubValidation);
    }
}

/* ================================================================
   INTERNAL UI BUILDERS — Pure functions, no state
   ================================================================ */

function _statsHero(stats) {
    var hero = document.createElement('div');
    hero.className = [
        'relative overflow-hidden rounded-2xl mb-6',
        'bg-gradient-to-br from-accent-goals/8 via-surface-raised/80 to-surface-raised/40',
        'border border-accent-goals/10',
        'px-6 py-5',
    ].join(' ');

    var inner = '<div class="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-accent-goals/[0.05] blur-3xl pointer-events-none"></div>';
    inner += '<div class="relative">';
    inner +=   '<div class="text-[11px] font-semibold text-accent-goals/70 uppercase tracking-widest mb-3">Overview</div>';
    inner +=   '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">';

    inner += _statCell('Total Goals', stats.totalGoals, 'primary');
    inner += _statCell('Active', stats.activeGoals, 'active');
    inner += _statCell('Completed', stats.completedGoals, 'done');
    inner += _statCell('Avg Progress', stats.avgProgress + '%', 'progress');

    inner +=   '</div>';

    /* Overdue warning */
    if (stats.overdueGoals > 0) {
        inner += '<div class="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-status-error/10 border border-status-error/15">';
        inner +=   '<span class="text-[12px] text-status-error font-medium">' + stats.overdueGoals + ' goal' + (stats.overdueGoals !== 1 ? 's' : '') + ' overdue</span>';
        inner += '</div>';
    }

    inner += '</div>';
    hero.innerHTML = inner;
    return hero;
}

function _statCell(label, value, type) {
    var colors = {
        primary:  'text-text-primary',
        active:   'text-accent-goals',
        done:     'text-status-success',
        progress: 'text-accent-goals',
    };
    return '<div>' +
        '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-0.5">' + label + '</div>' +
        '<div class="text-[18px] font-heading font-bold leading-none tabular-nums ' + (colors[type] || 'text-text-primary') + '">' + value + '</div>' +
    '</div>';
}

function _deadlineRow(goal, progress) {
    var row = document.createElement('div');
    row.className = [
        'flex items-center justify-between px-4 py-2.5 rounded-xl',
        'bg-surface-raised/40 border border-white/[0.03]',
    ].join(' ');

    var left = document.createElement('div');
    left.className = 'flex items-center gap-2.5 min-w-0';

    var emoji = document.createElement('span');
    emoji.className = 'text-base select-none flex-shrink-0';
    emoji.textContent = goal.emoji || '\uD83C\uDFAF';
    left.appendChild(emoji);

    var titleCol = document.createElement('div');
    titleCol.className = 'min-w-0';

    var title = document.createElement('span');
    title.className = 'text-[13px] font-medium text-text-primary block truncate';
    title.textContent = goal.title;
    titleCol.appendChild(title);

    var pct = document.createElement('span');
    pct.className = 'text-[11px] text-text-disabled tabular-nums';
    pct.textContent = progress.total > 0
        ? progress.completed + '/' + progress.total + ' sub-projects'
        : 'No sub-projects';
    titleCol.appendChild(pct);

    left.appendChild(titleCol);
    row.appendChild(left);

    var deadline = document.createElement('span');
    var days = goal.deadline ? _daysRemaining(goal.deadline) : null;
    var dlColor = days !== null && days < 0
        ? 'text-status-error font-semibold'
        : days !== null && days <= 3
            ? 'text-status-warning'
            : 'text-text-disabled';
    deadline.className = 'text-[11px] flex-shrink-0 ml-3 ' + dlColor;
    deadline.textContent = _formatDeadline(goal.deadline);
    row.appendChild(deadline);

    return row;
}

function _daysRemaining(deadline) {
    if (!deadline) return null;
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var parts = deadline.split('-');
    var target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return Math.ceil((target - now) / 86400000);
}

function _formatDeadline(deadline) {
    if (!deadline) return 'No deadline';
    var days = _daysRemaining(deadline);
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days === -1) return 'Overdue 1d';
    if (days < -1) return 'Overdue ' + Math.abs(days) + 'd';
    if (days > 0) return days + 'd left';
    return deadline;
}

export default GoalsView;
