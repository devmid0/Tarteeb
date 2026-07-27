/**
 * Tarteeb — Tasks View (Main Wrapper)
 *
 * Top-level view for the Tasks pillar. Manages section
 * switching (Today / All / Projects), hydration, and
 * the shared task-store instance.
 *
 * Lifecycle:
 *   render()  → builds the shell (header, tabs, content slot)
 *   mount()   → hydrates store, binds events, renders section
 *   unmount() → unsubscribes all listeners, cleans up
 *
 * Design constraints:
 *   - Static imports only (no dynamic import chains → race conditions)
 *   - Filter/sort state lives on the class (survives event-driven re-renders)
 *   - Every card gets onUpdate + onEdit callbacks
 *   - Edit modal wired via task-edit-modal.js
 *   - No arguments.callee, no strict-mode violations
 */

'use strict';

import { TaskStore } from '../state/task-store.js';
import { TaskGateway } from '../../../persistence/gateways/task-gateway.js';
import { createTaskSummary } from '../components/task-summary.js';
import { createTaskForm } from '../components/task-form.js';
import { createTaskCard } from '../components/task-card.js';
import { createFilterBar } from '../components/task-filters.js';
import { openEditModal } from '../components/task-edit-modal.js';
import { formatMinutes } from '../domain/task-rules.js';

var SECTIONS = [
    { id: 'today', label: 'Today', description: 'What\'s due now' },
    { id: 'all', label: 'All Tasks', description: 'Everything in one place' },
    { id: 'projects', label: 'Projects', description: 'Group related work' },
];

export class TasksView {
    constructor() {
        this.container = null;
        this.store = null;
        this.currentSection = 'today';
        this._unsubs = [];

        /* Stable filter/sort state — survives event-driven re-renders */
        this._allFilter = 'all';
        this._allSort   = 'priority';
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render(section) {
        this.currentSection = section || 'today';

        var fragment = document.createDocumentFragment();

        /* ── Ambient gradient ── */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background = 'radial-gradient(ellipse at 15% 10%, rgba(52,211,153,0.04) 0%, transparent 60%)';

        /* ── Main scrollable container ── */
        var main = document.createElement('div');
        main.className = 'relative h-full p-6 md:p-8 max-w-4xl mx-auto';

        /* ── Header ── */
        var header = document.createElement('header');
        header.className = 'mb-6';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
                '<h1 class="text-[28px] font-heading font-semibold text-text-primary tracking-tight leading-none">' +
                    'Tasks' +
                '</h1>' +
                '<span class="text-[12px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
                '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-1">What needs your attention today.</p>';

        /* ── Section Tabs ── */
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
                return function () { window.location.hash = '/tasks/' + secId; };
            })(sec.id));
            tabs.appendChild(tab);
        }

        /* ── Content slot (filled on mount) ── */
        var contentSlot = document.createElement('div');
        contentSlot.id = 'tasks-content-slot';
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
            var db = window.__tarteeb && window.__tarteeb.database;
            if (db) {
                var gateway = new TaskGateway(db);
                this.store = new TaskStore(window.__tarteeb.eventBus, gateway);
                await this.store.hydrate();
            }
        } catch (err) {
            console.error('[Tasks] Failed to initialise store:', err);
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
    }

    /* ── Shared Card Callbacks ───────────────────────────── */

    /**
     * Returns a stable set of card callbacks for the current store.
     * Passed to every createTaskCard() call.
     */
    _cardCallbacks() {
        var self = this;
        var store = this.store;
        return {
            onToggle: function (id) { store.dispatch({ type: 'TOGGLE_COMPLETE', payload: id }); },
            onDelete: function (id) { store.dispatch({ type: 'DELETE_TASK', payload: id }); },
            onUpdate: function (id, patch) { store.dispatch({ type: 'UPDATE_TASK', payload: Object.assign({ id: id }, patch) }); },
            onEdit:   function (id) {
                var task = store.getTaskById(id);
                if (!task) return;
                openEditModal(task, store.getProjects(),
                    function (patch) { store.dispatch({ type: 'UPDATE_TASK', payload: patch }); },
                    function (taskId) { store.dispatch({ type: 'DELETE_TASK', payload: taskId }); }
                );
            },
        };
    }

    /* ── Section Rendering ────────────────────────────────── */

    _renderSection() {
        var slot = this.container && this.container.querySelector('#tasks-content-slot');
        if (!slot) return;

        slot.innerHTML = '';
        slot.className = 'animate-entrance';

        switch (this.currentSection) {
            case 'today':
                this._renderTodaySection(slot);
                break;
            case 'all':
                this._renderAllSection(slot);
                break;
            case 'projects':
                this._renderProjectsSection(slot);
                break;
            default:
                this._renderTodaySection(slot);
        }
    }

    /* ── Today ────────────────────────────────────────────── */

    _renderTodaySection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading tasks…</div>';
            return;
        }

        var cbs = this._cardCallbacks();

        /* Summary stats */
        var summary = store.getSummary();
        var overdue = store.getOverdueTasks().length;
        slot.appendChild(createTaskSummary({ pending: summary.pending, in_progress: summary.in_progress, completed: summary.completed, overdue: overdue }));

        /* Time summary */
        var timeStats = store.getTimeSummary();
        if (timeStats.totalEstimate > 0 || timeStats.totalSpent > 0) {
            var timeBar = document.createElement('div');
            timeBar.className = 'flex items-center gap-4 mb-5 px-1';
            timeBar.innerHTML =
                '<div class="flex items-center gap-1.5 text-[11px] text-text-tertiary">' +
                    '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 opacity-50"><path d="M8 3.5a.5.5 0 01.5.5v4.25l3.15 1.89a.5.5 0 01-.5.87L7.76 8.87a.5.5 0 01-.26-.44v-4.7a.5.5 0 01.5-.5z"/><path fill-rule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm0-1A7 7 0 118 1a7 7 0 010 14z" clip-rule="evenodd"/></svg>' +
                    '<span>Est: <strong class="text-text-secondary font-medium">' + formatMinutes(timeStats.totalEstimate) + '</strong></span>' +
                    '<span class="text-white/[0.08]">·</span>' +
                    '<span>Done: <strong class="text-accent-tasks font-medium">' + formatMinutes(timeStats.totalSpent) + '</strong></span>' +
                    (timeStats.remaining > 0
                        ? '<span class="text-white/[0.08]">·</span><span>Left: <strong class="text-text-secondary font-medium">' + formatMinutes(timeStats.remaining) + '</strong></span>'
                        : '') +
                '</div>';
            slot.appendChild(timeBar);
        }

        /* Inline form */
        slot.appendChild(createTaskForm({
            projects: store.getProjects(),
            onSubmit: function (data) {
                var tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                data.dueDate = data.dueDate || tomorrow.toISOString().slice(0, 10);
                store.dispatch({ type: 'ADD_TASK', payload: data });
            },
        }));

        /* Task list: overdue + active (excluding completed) */
        var overdueTasks = store.getOverdueTasks();
        var activeTasks  = store.getActiveTasks();
        var combined = overdueTasks.concat(activeTasks);

        /* Deduplicate by id */
        var seen = {};
        var unique = [];
        for (var i = 0; i < combined.length; i++) {
            if (!seen[combined[i].id]) {
                seen[combined[i].id] = true;
                unique.push(combined[i]);
            }
        }

        this._renderTaskList(slot, unique, cbs);
    }

    /* ── All Tasks ────────────────────────────────────────── */

    _renderAllSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading tasks…</div>';
            return;
        }

        var self = this;
        var cbs  = this._cardCallbacks();

        /* Summary stats */
        var summary = store.getSummary();
        var overdue = store.getOverdueTasks().length;
        slot.appendChild(createTaskSummary({ pending: summary.pending, in_progress: summary.in_progress, completed: summary.completed, overdue: overdue }));

        /* Time summary */
        var timeStats = store.getTimeSummary();
        if (timeStats.totalEstimate > 0 || timeStats.totalSpent > 0) {
            var timeBar = document.createElement('div');
            timeBar.className = 'flex items-center gap-4 mb-5 px-1';
            timeBar.innerHTML =
                '<div class="flex items-center gap-1.5 text-[11px] text-text-tertiary">' +
                    '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 opacity-50"><path d="M8 3.5a.5.5 0 01.5.5v4.25l3.15 1.89a.5.5 0 01-.5.87L7.76 8.87a.5.5 0 01-.26-.44v-4.7a.5.5 0 01.5-.5z"/><path fill-rule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm0-1A7 7 0 118 1a7 7 0 010 14z" clip-rule="evenodd"/></svg>' +
                    '<span>Est: <strong class="text-text-secondary font-medium">' + formatMinutes(timeStats.totalEstimate) + '</strong></span>' +
                    '<span class="text-white/[0.08]">·</span>' +
                    '<span>Done: <strong class="text-accent-tasks font-medium">' + formatMinutes(timeStats.totalSpent) + '</strong></span>' +
                    (timeStats.remaining > 0
                        ? '<span class="text-white/[0.08]">·</span><span>Left: <strong class="text-text-secondary font-medium">' + formatMinutes(timeStats.remaining) + '</strong></span>'
                        : '') +
                '</div>';
            slot.appendChild(timeBar);
        }

        /* Filter/sort state — uses class-level fields (stable across re-renders) */
        var renderList = function () {
            var existing = slot.querySelector('.task-list-container');
            if (existing) existing.remove();

            var tasks = store.getActiveTasks();
            var filter = self._allFilter;
            var sort   = self._allSort;

            if (filter !== 'all') {
                if (filter === 'overdue') {
                    tasks = store.getOverdueTasks();
                } else {
                    tasks = tasks.filter(function (t) { return t.status === filter; });
                }
            }

            if (sort === 'dueDate') {
                tasks = tasks.slice().sort(function (a, b) { return (a.dueDate || '9999').localeCompare(b.dueDate || '9999'); });
            } else if (sort === 'created') {
                tasks = tasks.slice().sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
            }

            var container = document.createElement('div');
            container.className = 'task-list-container';

            if (tasks.length === 0) {
                container.innerHTML =
                    '<div class="text-center py-16">' +
                        '<div class="text-4xl mb-3 opacity-20">📋</div>' +
                        '<p class="text-[14px] text-text-secondary font-medium">No matching tasks</p>' +
                        '<p class="text-[12px] text-text-tertiary mt-1">Try a different filter or add a new task above.</p>' +
                    '</div>';
            } else {
                var list = document.createElement('div');
                list.className = 'space-y-1';

                for (var i = 0; i < tasks.length; i++) {
                    list.appendChild(createTaskCard(tasks[i], cbs));
                }
                container.appendChild(list);
            }

            slot.appendChild(container);
        };

        /* Inline form */
        slot.appendChild(createTaskForm({
            projects: store.getProjects(),
            onSubmit: function (data) { store.dispatch({ type: 'ADD_TASK', payload: data }); },
        }));

        /* Filter bar — recreated on each renderList() with current state */
        var renderFilterBar = function () {
            var old = slot.querySelector('.tasks-filter-bar');
            if (old) old.remove();

            var bar = createFilterBar({
                activeFilter: self._allFilter,
                activeSort:   self._allSort,
                onFilterChange: function (f) {
                    self._allFilter = f;
                    renderList();
                    renderFilterBar();
                },
                onSortChange: function (s) {
                    self._allSort = s;
                    renderList();
                    renderFilterBar();
                },
            });
            bar.classList.add('tasks-filter-bar');
            slot.insertBefore(bar, slot.querySelector('.task-list-container'));
        };

        renderFilterBar();
        renderList();
    }

    /* ── Projects ─────────────────────────────────────────── */

    _renderProjectsSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading projects…</div>';
            return;
        }

        var self = this;
        var cbs  = this._cardCallbacks();

        /* New project form */
        var newProjectForm = document.createElement('div');
        newProjectForm.className = 'mb-6 p-4 rounded-xl bg-surface-raised/40 border border-dashed border-white/[0.06]';
        newProjectForm.innerHTML =
            '<div class="flex items-center gap-3">' +
                '<input type="text"' +
                       ' class="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none"' +
                       ' placeholder="New project name…"' +
                       ' id="new-project-input">' +
                '<button id="new-project-btn"' +
                        ' class="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-accent-tasks text-white hover:brightness-110 transition-all">' +
                    'Create' +
                '</button>' +
            '</div>';

        slot.appendChild(newProjectForm);

        var projectInput = newProjectForm.querySelector('#new-project-input');
        var projectBtn   = newProjectForm.querySelector('#new-project-btn');

        if (projectBtn) {
            projectBtn.addEventListener('click', function () {
                var name = projectInput.value.trim();
                if (name) {
                    store.dispatch({ type: 'ADD_PROJECT', payload: { name: name } });
                    projectInput.value = '';
                }
            });
        }

        if (projectInput) {
            projectInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && projectBtn) projectBtn.click();
            });
        }

        /* Project list */
        var projects = store.getProjects();
        var listContainer = document.createElement('div');
        listContainer.className = 'space-y-4';

        if (projects.length === 0) {
            listContainer.innerHTML =
                '<div class="text-center py-16">' +
                    '<div class="text-4xl mb-3 opacity-20">📁</div>' +
                    '<p class="text-[14px] text-text-secondary font-medium">No projects yet</p>' +
                    '<p class="text-[12px] text-text-tertiary mt-1">Create one above to organize your tasks.</p>' +
                '</div>';
        } else {
            for (var p = 0; p < projects.length; p++) {
                var project = projects[p];
                var projectTasks = store.getTasksByProject(project.id);
                var completedCount = 0;
                for (var j = 0; j < projectTasks.length; j++) {
                    if (projectTasks[j].status === 'completed') completedCount++;
                }

                var projectCard = document.createElement('div');
                projectCard.className = 'rounded-xl bg-surface-raised/40 border border-white/[0.04] overflow-hidden';

                projectCard.innerHTML =
                    '<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">' +
                        '<div class="flex items-center gap-3">' +
                            '<span class="w-3 h-3 rounded-full bg-accent-tasks"></span>' +
                            '<span class="text-[14px] font-medium text-text-primary">' + project.name + '</span>' +
                            '<span class="text-[11px] text-text-tertiary px-2 py-0.5 rounded-full bg-white/[0.04]">' +
                                completedCount + '/' + projectTasks.length + ' done' +
                            '</span>' +
                        '</div>' +
                        '<button class="delete-project-btn p-1.5 rounded-lg text-text-disabled hover:text-status-error hover:bg-status-error/10 transition-colors"' +
                                ' data-project-id="' + project.id + '" title="Delete project">' +
                            '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>' +
                        '</button>' +
                    '</div>' +
                    '<div class="project-tasks-list px-4 py-2"></div>';

                var tasksList = projectCard.querySelector('.project-tasks-list');

                if (projectTasks.length === 0) {
                    tasksList.innerHTML = '<p class="text-[12px] text-text-disabled py-3 text-center">No tasks in this project</p>';
                } else {
                    for (var k = 0; k < projectTasks.length; k++) {
                        tasksList.appendChild(createTaskCard(projectTasks[k], cbs));
                    }
                }

                (function (proj) {
                    var deleteBtn = projectCard.querySelector('.delete-project-btn');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', function (e) {
                            var id = Number(e.currentTarget.dataset.projectId);
                            if (confirm('Delete project "' + proj.name + '"? Tasks will be unassigned.')) {
                                store.dispatch({ type: 'DELETE_PROJECT', payload: id });
                            }
                        });
                    }
                })(project);

                listContainer.appendChild(projectCard);
            }
        }

        slot.appendChild(listContainer);
    }

    /* ── Shared Task List ─────────────────────────────────── */

    _renderTaskList(slot, tasks, cbs) {
        var container = document.createElement('div');
        container.className = 'task-list-container mt-4';

        if (tasks.length === 0) {
            container.innerHTML =
                '<div class="text-center py-16">' +
                    '<div class="text-4xl mb-3 opacity-20">✨</div>' +
                    '<p class="text-[14px] text-text-secondary font-medium">All clear for today</p>' +
                    '<p class="text-[12px] text-text-tertiary mt-1">Nothing overdue and nothing pending. Well done.</p>' +
                '</div>';
        } else {
            var list = document.createElement('div');
            list.className = 'space-y-1';

            for (var i = 0; i < tasks.length; i++) {
                list.appendChild(createTaskCard(tasks[i], cbs));
            }
            container.appendChild(list);
        }

        slot.appendChild(container);
    }

    /* ── Event Binding ────────────────────────────────────── */

    _bindEvents() {
        if (!this.store) return;
        var bus = this.store.eventBus;
        var self = this;

        var refresh = function () { self._renderSection(); };

        /* Single subscription to the aggregate change event.
           The store publishes 'tasks:changed' after every mutation,
           so individual event subscriptions are unnecessary and
           would cause duplicate re-renders. */
        bus.subscribe('tasks:changed', refresh);
        bus.subscribe('tasks:validation-error', function (errors) {
            console.warn('[Tasks] Validation:', errors);
        });

        this._unsubs.push(
            function () { bus.unsubscribe('tasks:changed', refresh); },
            function () {
                bus.unsubscribe('tasks:validation-error', function (errors) {
                    console.warn('[Tasks] Validation:', errors);
                });
            }
        );
    }
}

export default TasksView;
