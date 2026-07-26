/**
 * Life OS — Goals View (Main Wrapper)
 *
 * Top-level view for the Goals pillar. Manages section
 * switching (Active / Completed / Statistics), hydration,
 * and the shared goal-store instance.
 *
 * Lifecycle:
 *   render()  → builds the shell (header, tabs, content slot)
 *   mount()   → hydrates store, binds events, renders section
 *   unmount() → unsubscribes all listeners, cleans up
 *
 * Design constraints:
 *   - Uses accent-goals color (#f472b6)
 *   - Single re-render trigger: 'goals:changed'
 *   - Every button wired to dispatch() → gateway
 */

'use strict';

import { GoalStore } from '../state/goal-store.js';
import { GoalGateway } from '../../../persistence/gateways/goal-gateway.js';
import { createGoalForm } from '../components/goal-form.js';
import { createGoalCard } from '../components/goal-card.js';

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
                    'Goals' +
                '</h1>' +
                '<span class="text-[12px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
                '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-1">Set intentions, track progress.</p>';

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
        var db = window.__lifeOS && window.__lifeOS.database;
        if (db) {
            var gateway = new GoalGateway(db);
            this.store  = new GoalStore(window.__lifeOS.eventBus, gateway);
            await this.store.hydrate();
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
        var self = this;
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
                if (confirm('Permanently delete "' + name + '" and all its milestones?')) {
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

        /* Goal cards */
        if (activeGoals.length > 0) {
            var goalList = document.createElement('div');
            goalList.className = 'space-y-3';

            for (var i = 0; i < activeGoals.length; i++) {
                var goal = activeGoals[i];
                var milestones = store.getMilestonesByGoalId(goal.id);
                var progress = store.getProgress(goal.id);

                goalList.appendChild(createGoalCard({
                    goal:           goal,
                    milestones:     milestones,
                    progress:       progress,
                    showActions:    true,
                    showMilestones: true,
                    onComplete:     cbs.onComplete,
                    onAbandon:      cbs.onAbandon,
                    onDelete:       cbs.onDelete,
                    onToggleMilestone: cbs.onToggleMilestone,
                    onDeleteMilestone: cbs.onDeleteMilestone,
                    onAddMilestone: cbs.onAddMilestone,
                }));
            }

            slot.appendChild(goalList);
        } else {
            /* Empty state */
            var emptyState = document.createElement('div');
            emptyState.className = 'text-center py-16';
            emptyState.innerHTML =
                '<div class="text-5xl mb-4 opacity-20">\uD83C\uDFAF</div>' +
                '<p class="text-[14px] text-text-secondary font-medium mb-1">No active goals</p>' +
                '<p class="text-[12px] text-text-tertiary">Set your first goal below to start making progress.</p>';
            slot.appendChild(emptyState);
        }

        /* Inline goal form */
        slot.appendChild(createGoalForm({
            categories: store.getAllCategories(),
            onSubmit: function (data) { self._dispatch('ADD_GOAL', data); },
        }));
    }

    /* ── Completed Section ────────────────────────────────── */

    _renderCompletedSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading goals\u2026</div>';
            return;
        }

        var self = this;
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

        /* Completed goals */
        if (completedGoals.length > 0) {
            var completedLabel = document.createElement('h3');
            completedLabel.className = 'text-[12px] font-semibold text-accent-goals/60 uppercase tracking-wider mb-2';
            completedLabel.textContent = 'Completed';
            slot.appendChild(completedLabel);

            var completedList = document.createElement('div');
            completedList.className = 'space-y-3 mb-6';

            for (var i = 0; i < completedGoals.length; i++) {
                var goal = completedGoals[i];
                var milestones = store.getMilestonesByGoalId(goal.id);
                var progress = store.getProgress(goal.id);

                completedList.appendChild(createGoalCard({
                    goal:           goal,
                    milestones:     milestones,
                    progress:       progress,
                    showActions:    true,
                    showMilestones: true,
                    onRestore:      cbs.onRestore,
                    onDelete:       cbs.onDelete,
                    onToggleMilestone: cbs.onToggleMilestone,
                    onDeleteMilestone: cbs.onDeleteMilestone,
                }));
            }

            slot.appendChild(completedList);
        }

        /* Abandoned goals */
        if (abandonedGoals.length > 0) {
            var abandonedLabel = document.createElement('h3');
            abandonedLabel.className = 'text-[12px] font-semibold text-text-disabled uppercase tracking-wider mb-2';
            abandonedLabel.textContent = 'Abandoned';
            slot.appendChild(abandonedLabel);

            var abandonedList = document.createElement('div');
            abandonedList.className = 'space-y-3';

            for (var j = 0; j < abandonedGoals.length; j++) {
                var aGoal = abandonedGoals[j];
                var aMilestones = store.getMilestonesByGoalId(aGoal.id);
                var aProgress = store.getProgress(aGoal.id);

                abandonedList.appendChild(createGoalCard({
                    goal:           aGoal,
                    milestones:     aMilestones,
                    progress:       aProgress,
                    showActions:    true,
                    showMilestones: true,
                    onRestore:      cbs.onRestore,
                    onDelete:       cbs.onDelete,
                    onToggleMilestone: cbs.onToggleMilestone,
                    onDeleteMilestone: cbs.onDeleteMilestone,
                }));
            }

            slot.appendChild(abandonedList);
        }

        /* Empty state */
        if (completedGoals.length === 0 && abandonedGoals.length === 0) {
            var emptyState = document.createElement('div');
            emptyState.className = 'text-center py-16';
            emptyState.innerHTML =
                '<div class="text-5xl mb-4 opacity-20">\uD83C\uDFC6</div>' +
                '<p class="text-[14px] text-text-secondary font-medium mb-1">No completed goals yet</p>' +
                '<p class="text-[12px] text-text-tertiary">Your achievements will appear here.</p>';
            slot.appendChild(emptyState);
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
                var catGoals = store.goals.filter(function (g) { return g.category === cat; });
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
                var prioGoals = store.goals.filter(function (g) { return g.priority === prio; });
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

        /* Empty state */
        if (stats.totalGoals === 0) {
            slot.innerHTML +=
                '<div class="text-center py-12">' +
                    '<div class="text-5xl mb-3 opacity-20">\uD83D\uDCCA</div>' +
                    '<p class="text-[14px] text-text-secondary font-medium">No statistics yet</p>' +
                    '<p class="text-[12px] text-text-tertiary mt-1">Create goals and track milestones to see your progress.</p>' +
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

        bus.subscribe('goals:changed', refresh);
        bus.subscribe('goals:validation-error', function (errors) {
            console.warn('[Goals] Validation:', errors);
        });

        this._unsubs.push(
            function () { bus.unsubscribe('goals:changed', refresh); },
            function () {
                bus.unsubscribe('goals:validation-error', function (errors) {
                    console.warn('[Goals] Validation:', errors);
                });
            }
        );
    }
}

/* ================================================================
   INTERNAL UI BUILDERS — Pure functions, no state
   ================================================================ */

/**
 * Stats hero card with key metrics.
 */
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
        primary: 'text-text-primary',
        active:  'text-accent-goals',
        done:    'text-status-success',
        progress: 'text-accent-goals',
    };
    return '<div>' +
        '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-0.5">' + label + '</div>' +
        '<div class="text-[18px] font-heading font-bold leading-none tabular-nums ' + (colors[type] || 'text-text-primary') + '">' + value + '</div>' +
    '</div>';
}

export default GoalsView;
