/**
 * Tarteeb — Focus Mode Dashboard
 *
 * A calm command center that exposes ONLY items relevant to
 * the current moment. No historical data, no complex charts,
 * no future milestones — just what needs your attention NOW.
 *
 * Focus widgets:
 *   1. Top 3 priority tasks due today (or overdue)
 *   2. Today's active habits requiring immediate checking
 *
 * Global Quick Capture:
 *   Floating action button → instant modal for logging a task,
 *   note, or expense without leaving the dashboard.
 *
 * Progressive Disclosure:
 *   "View All" links route the user to full pillar views.
 *
 * Lifecycle:
 *   render()  → builds the outer shell (gradient, header, focus grid, FAB)
 *   mount()   → instantiates TaskStore + HabitStore only, hydrates,
 *               subscribes to change events, binds Quick Capture
 *   unmount() → tears down subscriptions, nullifies stores, removes FAB
 *
 * Design constraints:
 *   - Neutral accent palette — calm, not clinical
 *   - Micro-spacing, restrained typography, zero visual clutter
 *   - Only TaskGateway + HabitGateway touch IndexedDB — no other pillars
 *   - Quick Capture dispatches directly through gateways (lightweight)
 */

'use strict';

/* ── Domain Imports ──────────────────────────────────────── */

import { TaskStore }   from '../../tasks/state/task-store.js';
import { TaskGateway }  from '../../../persistence/gateways/task-gateway.js';

import { HabitStore }   from '../../habits/state/habit-store.js';
import { HabitGateway } from '../../../persistence/gateways/habit-gateway.js';

import { KnowledgeGateway } from '../../../persistence/gateways/knowledge-gateway.js';

import { FinanceGateway } from '../../../persistence/gateways/finance-gateway.js';

import { OptimisticDispatcher } from '../../../core/events/optimistic-dispatcher.js';
import { canCreateEntity, showPaywall } from '../../core/freemium.js';

/* ── Constants ───────────────────────────────────────────── */

var WIDGET_IDS = {
    tasks: 'dash-focus-tasks',
    habits: 'dash-focus-habits',
};

var QUICK_CAPTURE_TYPES = [
    { id: 'task',    label: 'Task',    icon: '\u2713', color: 'accent-tasks',     placeholder: 'What needs to be done?' },
    { id: 'note',    label: 'Note',    icon: '\u2261', color: 'accent-knowledge', placeholder: 'Capture a thought...' },
    { id: 'expense', label: 'Expense', icon: '\u00A5', color: 'accent-finance',   placeholder: 'How much was spent?' },
];

/* ================================================================
   DASHBOARD VIEW — Class
   ================================================================ */

export class DashboardView {
    constructor() {
        this.container   = null;
        this.stores      = {};
        this._dispatcher = null;
        this._unsubs     = [];
        this._booted     = false;
        this._fabEl      = null;
        this._qcOpen     = false;
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render() {
        var fragment = document.createDocumentFragment();

        /* Ambient gradient — single, subtle */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background =
            'radial-gradient(ellipse at 30% 15%, rgba(52,211,153,0.025) 0%, transparent 55%),' +
            'radial-gradient(ellipse at 70% 85%, rgba(251,146,60,0.02) 0%, transparent 55%)';

        /* Main wrapper */
        var main = document.createElement('div');
        main.className = 'relative h-full px-6 py-8 md:px-10 md:py-10 lg:px-12 max-w-3xl mx-auto';

        /* ── Header ── */
        var header = document.createElement('header');
        header.className = 'mb-10';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
                '<h1 id="dash-greeting" class="text-[28px] font-heading font-bold text-text-primary tracking-tight leading-none">' +
                    _greetingText() +
                '</h1>' +
                '<span class="text-[11px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    _dateString() +
                '</span>' +
            '</div>' +
            '<p id="dash-subtitle" class="text-[13px] text-text-tertiary mt-2">' + _subtitleText() + '</p>';
        main.appendChild(header);

        /* ── Focus Grid ── */
        var grid = document.createElement('div');
        grid.className = 'space-y-5';

        /* Tasks Focus Widget */
        var tasksSlot = _focusWidgetShell(
            'Today\'s Focus',
            'Tasks',
            WIDGET_IDS.tasks,
            '/tasks',
            'accent-tasks'
        );
        grid.appendChild(tasksSlot);

        /* Habits Focus Widget */
        var habitsSlot = _focusWidgetShell(
            'Daily Check-in',
            'Habits',
            WIDGET_IDS.habits,
            '/habits',
            'accent-habits'
        );
        grid.appendChild(habitsSlot);

        main.appendChild(grid);

        /* ── Quick Capture FAB ── */
        this._fabEl = _createFAB();

        fragment.appendChild(gradient);
        fragment.appendChild(main);
        fragment.appendChild(this._fabEl);
        return fragment;
    }

    async mount(container) {
        this.container = container;
        var db  = window.__tarteeb && window.__tarteeb.database;
        var bus = window.__tarteeb && window.__tarteeb.eventBus;
        if (!db || !bus) return;

        /* Only instantiate the two stores we need */
        this.stores.tasks = new TaskStore(bus, new TaskGateway(db));
        this.stores.habits = new HabitStore(bus, new HabitGateway(db));

        /* Keep lightweight gateway references for Quick Capture */
        this._db  = db;
        this._bus = bus;

        /* Optimistic dispatcher for zero-latency UI */
        this._dispatcher = new OptimisticDispatcher(bus);

        /* Subscribe to change streams — only the two we care about */
        var self = this;
        this._unsubs.push(
            bus.subscribe('tasks:changed', function () {
                self._refreshWidget('tasks');
                self._updateQuickStats();
            }),
            bus.subscribe('habits:changed', function () {
                self._refreshWidget('habits');
                self._updateQuickStats();
            }),
            /* ── Optimistic: instant DOM injection ── */
            bus.subscribe('tarteeb:task-created', function (item) {
                self._injectOptimisticTask(item);
            }),
            bus.subscribe('tarteeb:task-confirmed', function (data) {
                self._reconcileOptimisticTask(data.tempId, data.saved);
            }),
            bus.subscribe('tarteeb:sync-error', function (data) {
                if (data.eventType === 'tarteeb:task-created') {
                    self._revertOptimisticTask(data);
                }
            }),
        );

        /* Hydrate only tasks + habits in parallel */
        await Promise.all([
            this.stores.tasks.hydrate(),
            this.stores.habits.hydrate(),
        ]);

        this._booted = true;
        this._refreshAll();
        this._bindFAB();
    }

    unmount() {
        for (var i = 0; i < this._unsubs.length; i++) {
            this._unsubs[i]();
        }
        this._unsubs     = [];
        this.stores      = {};
        this._db         = null;
        this._bus        = null;
        this._dispatcher = null;
        this.container   = null;
        this._booted     = false;
        this._qcOpen     = false;

        /* Remove FAB + Quick Capture overlay if present */
        if (this._fabEl && this._fabEl.parentNode) {
            this._fabEl.parentNode.removeChild(this._fabEl);
        }
        this._fabEl = null;
        this._removeQuickCapture();
    }

    /* ── Rendering ────────────────────────────────────────── */

    _refreshAll() {
        this._refreshWidget('tasks');
        this._refreshWidget('habits');
        this._updateQuickStats();
    }

    _refreshWidget(domain) {
        var slot = this._slot(WIDGET_IDS[domain]);
        if (!slot) return;
        slot.innerHTML = '';

        switch (domain) {
            case 'tasks':  _renderTasksFocus(slot, this.stores.tasks); break;
            case 'habits': _renderHabitsFocus(slot, this.stores.habits); break;
        }
    }

    _updateQuickStats() {
        var el = this.container && this.container.querySelector('#dash-quick-stats');
        if (!el) return;

        var taskCount = this.stores.tasks
            ? this.stores.tasks.getTodayTasks().length + this.stores.tasks.getOverdueTasks().length
            : 0;
        var habitSummary = this.stores.habits
            ? this.stores.habits.getTodaySummary()
            : { completed: 0, totalDue: 0 };

        var parts = [];
        if (taskCount > 0) parts.push(taskCount + ' task' + (taskCount !== 1 ? 's' : ''));
        if (habitSummary.totalDue > 0) {
            parts.push(habitSummary.completed + '/' + habitSummary.totalDue + ' habits');
        }
        if (parts.length === 0) {
            el.textContent = 'All clear — enjoy your focus time.';
            el.className = 'text-[13px] text-accent-tasks/80 font-medium';
        } else {
            el.textContent = parts.join('  \u00B7  ');
            el.className = 'text-[12px] text-text-tertiary';
        }
    }

    _slot(id) {
        return this.container && this.container.querySelector('#' + id);
    }

    /* ── Quick Capture ────────────────────────────────────── */

    _bindFAB() {
        var self = this;
        if (!this._fabEl) return;
        var btn = this._fabEl.querySelector('#dash-qc-trigger');
        if (btn) {
            btn.addEventListener('click', function () {
                var qc = window.__tarteeb && window.__tarteeb.quickCapture;
                if (qc) {
                    qc.open();
                } else {
                    self._openQuickCapture();
                }
            });
        }
    }

    _openQuickCapture() {
        if (this._qcOpen) return;
        this._qcOpen = true;
        this._removeQuickCapture();

        var overlay = document.createElement('div');
        overlay.id = 'dash-qc-overlay';
        overlay.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 200ms ease';

        var panel = document.createElement('div');
        panel.className = [
            'w-full max-w-md rounded-2xl bg-surface-elevated border border-white/[0.06]',
            'shadow-modal overflow-hidden',
            'transform translate-y-4 sm:translate-y-0 sm:scale-95',
            'transition-all duration-200',
        ].join(' ');

        /* Header */
        var header = document.createElement('div');
        header.className = 'flex items-center justify-between px-5 pt-5 pb-3';
        header.innerHTML =
            '<h3 class="text-[15px] font-heading font-semibold text-text-primary">Quick Capture</h3>' +
            '<button id="dash-qc-close" class="w-7 h-7 rounded-lg flex items-center justify-center ' +
                'text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors">' +
                '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">' +
                    '<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>' +
                '</svg>' +
            '</button>';
        panel.appendChild(header);

        /* Type Tabs */
        var tabs = document.createElement('div');
        tabs.className = 'flex gap-1.5 px-5 pb-4';

        for (var t = 0; t < QUICK_CAPTURE_TYPES.length; t++) {
            var qt = QUICK_CAPTURE_TYPES[t];
            var tab = document.createElement('button');
            tab.className = [
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium',
                'transition-all duration-150',
                t === 0
                    ? 'bg-' + qt.color + '/15 text-' + qt.color + ' border border-' + qt.color + '/20'
                    : 'bg-white/[0.03] text-text-tertiary border border-transparent hover:bg-white/[0.06] hover:text-text-secondary',
            ].join(' ');
            tab.dataset.type = qt.id;
            tab.innerHTML = '<span>' + qt.icon + '</span> ' + qt.label;
            tabs.appendChild(tab);
        }

        panel.appendChild(tabs);

        /* Input Area */
        var inputWrap = document.createElement('div');
        inputWrap.className = 'px-5 pb-5';

        var activeType = QUICK_CAPTURE_TYPES[0];

        /* Task fields */
        var taskFields = _createTaskFields(activeType);
        taskFields.id = 'dash-qc-fields-task';
        inputWrap.appendChild(taskFields);

        /* Note fields (hidden by default) */
        var noteFields = _createNoteFields();
        noteFields.id = 'dash-qc-fields-note';
        noteFields.style.display = 'none';
        inputWrap.appendChild(noteFields);

        /* Expense fields (hidden by default) */
        var expenseFields = _createExpenseFields();
        expenseFields.id = 'dash-qc-fields-expense';
        expenseFields.style.display = 'none';
        inputWrap.appendChild(expenseFields);

        /* Submit button */
        var submitBtn = document.createElement('button');
        submitBtn.id = 'dash-qc-submit';
        submitBtn.className = [
            'w-full mt-3 py-2.5 rounded-xl text-[13px] font-semibold',
            'bg-accent-tasks text-white',
            'hover:brightness-110 active:scale-[0.98]',
            'transition-all duration-150',
        ].join(' ');
        submitBtn.textContent = 'Add Task';
        inputWrap.appendChild(submitBtn);

        panel.appendChild(inputWrap);
        overlay.appendChild(panel);

        document.body.appendChild(overlay);

        /* Animate in */
        requestAnimationFrame(function () {
            overlay.style.opacity = '1';
            panel.style.transform = 'translate-y-0 sm:scale-100';
        });

        /* Close handlers */
        var self = this;
        var closeBtn = overlay.querySelector('#dash-qc-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () { self._closeQuickCapture(); });
        }
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) self._closeQuickCapture();
        });
        document.addEventListener('keydown', this._qcEscHandler = function (e) {
            if (e.key === 'Escape') self._closeQuickCapture();
        });

        /* Tab switching */
        var tabBtns = tabs.querySelectorAll('button');
        var activeTab = 0;
        for (var ti = 0; ti < tabBtns.length; ti++) {
            (function (idx) {
                tabBtns[idx].addEventListener('click', function () {
                    activeTab = idx;
                    var selectedType = QUICK_CAPTURE_TYPES[idx];

                    /* Update tab styles */
                    for (var j = 0; j < tabBtns.length; j++) {
                        var tq = QUICK_CAPTURE_TYPES[j];
                        if (j === idx) {
                            tabBtns[j].className = [
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium',
                                'transition-all duration-150',
                                'bg-' + tq.color + '/15 text-' + tq.color + ' border border-' + tq.color + '/20',
                            ].join(' ');
                        } else {
                            tabBtns[j].className = [
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium',
                                'transition-all duration-150',
                                'bg-white/[0.03] text-text-tertiary border border-transparent hover:bg-white/[0.06] hover:text-text-secondary',
                            ].join(' ');
                        }
                    }

                    /* Show/hide fields */
                    var fields = ['task', 'note', 'expense'];
                    for (var f = 0; f < fields.length; f++) {
                        var fEl = overlay.querySelector('#dash-qc-fields-' + fields[f]);
                        if (fEl) fEl.style.display = fields[f] === selectedType.id ? '' : 'none';
                    }

                    /* Update submit button */
                    submitBtn.textContent = 'Add ' + selectedType.label;
                    submitBtn.className = [
                        'w-full mt-3 py-2.5 rounded-xl text-[13px] font-semibold',
                        'bg-' + selectedType.color + ' text-white',
                        'hover:brightness-110 active:scale-[0.98]',
                        'transition-all duration-150',
                    ].join(' ');
                });
            })(ti);
        }

        /* Submit handler */
        submitBtn.addEventListener('click', function () {
            self._handleQuickCapture(activeTab, overlay);
        });

        /* Focus first input */
        var firstInput = taskFields.querySelector('input');
        if (firstInput) {
            setTimeout(function () { firstInput.focus(); }, 100);
        }
    }

    _closeQuickCapture() {
        this._qcOpen = false;
        this._removeQuickCapture();
    }

    _removeQuickCapture() {
        var overlay = document.getElementById('dash-qc-overlay');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        if (this._qcEscHandler) {
            document.removeEventListener('keydown', this._qcEscHandler);
            this._qcEscHandler = null;
        }
    }

    _countForType(entityType) {
        var MAP = { finance:'finance-transactions', tasks:'tasks-items', knowledge:'knowledge-notes', habits:'habits-definitions', goals:'goals-items' };
        var storeName = MAP[entityType];
        if (!storeName) return Promise.resolve(0);
        return new Promise(function (resolve) {
            var req = indexedDB.open('tarteeb', 1);
            req.onsuccess = function () {
                var db = req.result;
                var tx = db.transaction(storeName, 'readonly');
                var store = tx.objectStore(storeName);
                var countReq = store.count();
                countReq.onsuccess = function () { resolve(countReq.result); db.close(); };
                countReq.onerror   = function () { resolve(0); db.close(); };
            };
            req.onerror = function () { resolve(0); };
        });
    }

    async _handleQuickCapture(typeIndex, overlay) {
        var type = QUICK_CAPTURE_TYPES[typeIndex];
        var db   = this._db;
        var bus  = this._bus;

        var ENTITY_MAP = { task: 'tasks', note: 'knowledge', expense: 'finance' };
        if (!canCreateEntity(ENTITY_MAP[type.id], await this._countForType(ENTITY_MAP[type.id]))) {
            showPaywall();
            return;
        }

        if (type.id === 'task') {
            var nameInput = overlay.querySelector('#dash-qc-task-name');
            var prioritySel = overlay.querySelector('#dash-qc-task-priority');
            var name = nameInput ? nameInput.value.trim() : '';
            if (!name) { nameInput && nameInput.focus(); return; }

            var now = new Date().toISOString();
            var data = {
                name: name,
                status: 'pending',
                priority: prioritySel ? prioritySel.value : 'medium',
                dueDate: _todayISO(),
                projectId: null,
                createdAt: now,
                updatedAt: now,
            };

            var gateway = new TaskGateway(db);
            this._dispatcher.dispatch('tarteeb:task-created', data, function () {
                return gateway.createTask(data);
            });
            this._showToast('Task added');

        } else if (type.id === 'note') {
            var titleInput = overlay.querySelector('#dash-qc-note-title');
            var contentInput = overlay.querySelector('#dash-qc-note-content');
            var title = titleInput ? titleInput.value.trim() : '';
            var content = contentInput ? contentInput.value.trim() : '';
            if (!title && !content) { titleInput && titleInput.focus(); return; }

            var now2 = new Date().toISOString();
            var noteData = {
                title: title,
                content: content,
                category: '',
                tags: [],
                isPinned: false,
                isArchived: false,
                isFavorited: false,
                wordCount: content ? content.split(/\s+/).length : 0,
                charCount: content ? content.length : 0,
                createdAt: now2,
                updatedAt: now2,
            };

            try {
                var kGateway = new KnowledgeGateway(db);
                var savedNote = await kGateway.createNote(noteData);
                bus.publish('knowledge:changed', null);
                this._showToast('Note captured');
            } catch (err) {
                this._showToast('Failed to capture note', true);
            }

        } else if (type.id === 'expense') {
            var amountInput = overlay.querySelector('#dash-qc-expense-amount');
            var descInput = overlay.querySelector('#dash-qc-expense-desc');
            var amount = amountInput ? parseFloat(amountInput.value) : 0;
            if (!amount || amount <= 0) { amountInput && amountInput.focus(); return; }

            var now3 = new Date().toISOString();
            var txData = {
                type: 'expense',
                amount: amount,
                category: 'uncategorized',
                description: descInput ? descInput.value.trim() : '',
                date: _todayISO(),
                createdAt: now3,
                updatedAt: now3,
            };

            try {
                var fGateway = new FinanceGateway(db);
                var savedTx = await fGateway.createTransaction(txData);
                bus.publish('finance:changed', null);
                this._showToast('Expense logged');
            } catch (err) {
                this._showToast('Failed to log expense', true);
            }
        }

        this._closeQuickCapture();
    }

    _showToast(message, isError) {
        var container = document.getElementById('toast-container');
        if (!container) return;

        var toast = document.createElement('div');
        toast.className = [
            'pointer-events-auto px-4 py-2.5 rounded-xl text-[12px] font-medium',
            'border shadow-elevated',
            'animate-entrance',
            isError
                ? 'bg-status-error/10 border-status-error/20 text-status-error'
                : 'bg-surface-elevated border-white/[0.06] text-text-primary',
        ].join(' ');
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(function () {
            toast.style.animation = 'exit 200ms cubic-bezier(0.55,0,1,0.45) forwards';
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 200);
        }, 2200);
    }

    /* ── Optimistic UI: instant DOM injection ─────────────── */

    /**
     * Inject a task row instantly from the optimistic event payload.
     * Hides the empty state, prepends the row with a slide-in animation.
     * @param {Object} task — optimistic task payload (with temp id)
     */
    _injectOptimisticTask(task) {
        if (!this.container || !this._booted) return;
        var slot = this._slot(WIDGET_IDS.tasks);
        if (!slot) return;

        /* 1. Hide empty state if present */
        var emptyEl = slot.querySelector('.dash-focus-empty');
        if (emptyEl) {
            emptyEl.style.display = 'none';
        }

        /* 2. Find or create the task list container */
        var list = slot.querySelector('.dash-focus-list');
        if (!list) {
            list = document.createElement('div');
            list.className = 'dash-focus-list space-y-1.5';
            slot.appendChild(list);
        }

        /* 3. Create row and prepend with slide-in animation */
        var row = _createTaskRow(task);
        row.style.opacity   = '0';
        row.style.transform = 'translateY(-8px)';
        list.insertBefore(row, list.firstChild);

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                row.style.transition = 'opacity 200ms ease, transform 200ms ease';
                row.style.opacity    = '1';
                row.style.transform  = 'translateY(0)';
            });
        });

        this._updateQuickStats();
    }

    /**
     * Reconcile a temp id with the real persisted id.
     * @param {string} tempId — optimistic temp id
     * @param {Object} saved — real saved item from gateway (has real id)
     */
    _reconcileOptimisticTask(tempId, saved) {
        if (!this.container) return;
        var slot = this._slot(WIDGET_IDS.tasks);
        if (!slot) return;

        var row = slot.querySelector('[data-task-id="' + tempId + '"]');
        if (row && saved && saved.id) {
            row.dataset.taskId = saved.id;
        }
    }

    /**
     * Revert an optimistic DOM node on sync failure.
     * Slides the row out, removes it, re-shows empty state if list is empty.
     * @param {{ tempId: string, eventType: string, error: Error }} data
     */
    _revertOptimisticTask(data) {
        if (!this.container) return;
        var slot = this._slot(WIDGET_IDS.tasks);
        if (!slot) return;

        var row = slot.querySelector('[data-task-id="' + data.tempId + '"]');
        if (row) {
            row.style.transition = 'opacity 150ms ease, transform 150ms ease';
            row.style.opacity    = '0';
            row.style.transform  = 'translateX(20px)';

            var self = this;
            setTimeout(function () {
                if (row.parentNode) row.parentNode.removeChild(row);

                /* Re-show empty state if list is now empty */
                var list = slot.querySelector('.dash-focus-list');
                if (list && list.children.length === 0) {
                    if (list.parentNode) list.parentNode.removeChild(list);
                    var emptyEl = slot.querySelector('.dash-focus-empty');
                    if (emptyEl) emptyEl.style.display = '';
                }
                self._updateQuickStats();
            }, 150);
        }

        this._showToast('Failed to save — reverted', true);
    }
}

/* ================================================================
   WIDGET BUILDERS — Pure functions (Focus Mode)
   ================================================================ */

/* ── Optimistic: create a task row from payload (no store needed) ── */

function _createTaskRow(t) {
    var isDone = t.status === 'completed';

    var row = document.createElement('div');
    row.className = [
        'task-row dash-row flex items-center gap-3 px-4 py-3 rounded-xl',
        'bg-white/[0.02] hover:bg-white/[0.05]',
        'cursor-pointer group',
        isDone ? 'is-done' : '',
    ].join(' ');
    row.dataset.taskId = t.id;

    /* Custom checkbox */
    var checkbox = document.createElement('button');
    checkbox.type = 'button';
    checkbox.className = 'task-checkbox' + (isDone ? ' is-checked' : '');
    checkbox.innerHTML = '<svg class="checkmark" viewBox="0 0 12 12" fill="none" width="10" height="10">' +
        '<path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    row.appendChild(checkbox);

    /* Title */
    var title = document.createElement('span');
    title.className = [
        'task-title flex-1 text-[13px] truncate',
        isDone ? 'text-text-disabled' : 'text-text-secondary',
    ].join(' ');
    title.textContent = t.name || t.title || 'Untitled';
    row.appendChild(title);

    /* Priority badge */
    var badge = document.createElement('span');
    var badgeColor =
        t.priority === 'high'   ? 'text-status-error bg-status-error/10' :
        t.priority === 'medium' ? 'text-status-warning bg-status-warning/10' :
        'text-text-disabled bg-white/[0.04]';
    badge.className = 'flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ' + badgeColor;
    badge.textContent = (t.priority || 'med').slice(0, 3);
    row.appendChild(badge);

    return row;
}

/* ── Tasks Focus Widget ──────────────────────────────────── */

function _renderTasksFocus(slot, store) {
    if (!store) { slot.innerHTML = _skeletonLines(3); return; }

    var todayTasks = store.getTodayTasks();
    var overdue    = store.getOverdueTasks();

    /* Merge: overdue first, then today's tasks, sorted by priority */
    var merged = overdue.concat(todayTasks);
    var seen   = {};
    var unique = [];
    for (var i = 0; i < merged.length; i++) {
        if (!seen[merged[i].id]) {
            seen[merged[i].id] = true;
            unique.push(merged[i]);
        }
    }

    /* Take top 3 by priority */
    var top3 = unique.slice(0, 3);

    /* Empty state */
    if (top3.length === 0) {
        var emptyWrap = _emptyState(
            '\uD83C\uDF1F',
            'No tasks for today',
            'All clear — enjoy your focus time.'
        );
        emptyWrap.classList.add('dash-focus-empty');
        slot.appendChild(emptyWrap);
        return;
    }

    var list = document.createElement('div');
    list.className = 'dash-focus-list space-y-1.5';

    for (var j = 0; j < top3.length; j++) {
        var t = top3[j];
        var isDone = t.status === 'completed';
        var isOverdue = t.dueDate && t.dueDate < _todayISO() && !isDone;

        var row = document.createElement('div');
        row.className = [
            'task-row dash-row flex items-center gap-3 px-4 py-3 rounded-xl',
            'bg-white/[0.02] hover:bg-white/[0.05]',
            'cursor-pointer group',
            isDone ? 'is-done' : '',
        ].join(' ');
        row.dataset.taskId = t.id;

        /* Custom checkbox */
        var checkbox = document.createElement('button');
        checkbox.type = 'button';
        checkbox.className = 'task-checkbox' + (isDone ? ' is-checked' : '');
        checkbox.innerHTML = '<svg class="checkmark" viewBox="0 0 12 12" fill="none" width="10" height="10">' +
            '<path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        (function (taskId, btn, rowEl) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (store.dispatch) {
                    store.dispatch({ type: 'TOGGLE_COMPLETE', payload: taskId });
                }
                /* Visual reward animation */
                if (!rowEl.classList.contains('is-done')) {
                    rowEl.classList.add('is-completing');
                    setTimeout(function () {
                        rowEl.classList.remove('is-completing');
                        rowEl.classList.add('is-done');
                        btn.classList.add('is-checked');
                    }, 400);
                } else {
                    rowEl.classList.remove('is-done', 'is-completing');
                    btn.classList.remove('is-checked');
                }
            });
        })(t.id, checkbox, row);
        row.appendChild(checkbox);

        /* Title — inline editable */
        var title = document.createElement('span');
        title.className = [
            'task-title flex-1 text-[13px] truncate',
            isDone ? 'text-text-disabled' : 'text-text-secondary',
        ].join(' ');
        title.textContent = t.name || t.title || 'Untitled';

        if (!isDone) {
            (function (taskObj, titleEl, rowEl) {
                titleEl.addEventListener('click', function (e) {
                    e.stopPropagation();
                    _startInlineEdit(taskObj, titleEl, rowEl, store);
                });
            })(t, title, row);
        }
        row.appendChild(title);

        /* Priority badge */
        var badge = document.createElement('span');
        var badgeColor =
            t.priority === 'high'   ? 'text-status-error bg-status-error/10' :
            t.priority === 'medium' ? 'text-status-warning bg-status-warning/10' :
            'text-text-disabled bg-white/[0.04]';
        badge.className = 'flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ' + badgeColor;
        badge.textContent = (t.priority || 'med').slice(0, 3);
        row.appendChild(badge);

        list.appendChild(row);
    }

    slot.appendChild(list);

    /* Overflow indicator */
    if (unique.length > 3) {
        var overflow = document.createElement('div');
        overflow.className = 'mt-2.5 text-[11px] text-text-disabled';
        overflow.textContent = '+' + (unique.length - 3) + ' more today';
        slot.appendChild(overflow);
    }
}

/* ── Inline Edit Helper (Dashboard tasks) ──────────────────── */

function _startInlineEdit(task, titleEl, rowEl, store) {
    var currentText = task.name || task.title || '';

    /* Swap span for input */
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-inline-edit';
    input.value = currentText;
    input.maxLength = 200;

    titleEl.style.display = 'none';
    rowEl.insertBefore(input, titleEl.nextSibling);
    input.focus();
    input.select();

    var committed = false;

    function commit() {
        if (committed) return;
        committed = true;
        var val = input.value.trim();
        if (val && val !== currentText && store.dispatch) {
            store.dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, name: val } });
        }
        input.remove();
        titleEl.style.display = '';
        if (val) titleEl.textContent = val;
    }

    function cancel() {
        if (committed) return;
        committed = true;
        input.remove();
        titleEl.style.display = '';
    }

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') cancel();
    });
    input.addEventListener('blur', function () {
        setTimeout(commit, 80);
    });
}

/* ── Habits Focus Widget ─────────────────────────────────── */

function _renderHabitsFocus(slot, store) {
    if (!store) { slot.innerHTML = _skeletonLines(3); return; }

    var summary = store.getTodaySummary();
    var dueHabits = store.getHabitsDueOnDate ? store.getHabitsDueOnDate() : [];

    /* Empty state */
    if (summary.totalDue === 0) {
        slot.appendChild(_emptyState(
            '\u26A1',
            'No habits due today',
            'Rest day or no habits defined.'
        ));
        return;
    }

    /* Progress summary row */
    var progressRow = document.createElement('div');
    progressRow.className = 'flex items-center gap-4 mb-4';

    /* Mini progress ring */
    progressRow.appendChild(_miniProgressRing(summary.percentage, 40));

    var progressInfo = document.createElement('div');
    progressInfo.innerHTML =
        '<div class="text-[18px] font-heading font-bold text-text-primary leading-none tabular-nums">' +
            summary.completed +
            '<span class="text-[13px] text-text-disabled font-normal">/' + summary.totalDue + '</span>' +
        '</div>' +
        '<div class="text-[11px] text-text-tertiary mt-0.5">' +
            (summary.remaining === 0 ? 'All done!' : summary.remaining + ' remaining') +
        '</div>';
    progressRow.appendChild(progressInfo);

    /* Percentage badge */
    if (summary.percentage > 0) {
        var pctBadge = document.createElement('span');
        pctBadge.className = [
            'ml-auto text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-lg',
            summary.percentage === 100
                ? 'bg-accent-tasks/15 text-accent-tasks'
                : 'bg-white/[0.04] text-text-tertiary',
        ].join(' ');
        pctBadge.textContent = summary.percentage + '%';
        progressRow.appendChild(pctBadge);
    }

    slot.appendChild(progressRow);

        /* Due habits list (inline toggle) */
        if (dueHabits.length > 0) {
            var habitList = document.createElement('div');
            habitList.className = 'space-y-1.5';

            for (var i = 0; i < dueHabits.length; i++) {
                var h = dueHabits[i];
                var completed = store.isHabitCompletedOnDate(h.id);

                var row = document.createElement('div');
                row.className = [
                    'dash-row flex items-center gap-3 px-4 py-2.5 rounded-xl',
                    'bg-white/[0.02] hover:bg-white/[0.05]',
                    'cursor-pointer group',
                ].join(' ');

            /* Checkbox */
            var checkbox = document.createElement('span');
            checkbox.className = [
                'flex-shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center',
                'transition-all duration-200',
                completed
                    ? 'bg-accent-tasks border-accent-tasks'
                    : 'border-text-disabled/30 group-hover:border-text-tertiary',
            ].join(' ');
            if (completed) {
                checkbox.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-white"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>';
            }
            row.appendChild(checkbox);

            /* Habit icon + name */
            var name = document.createElement('span');
            name.className = [
                'flex-1 text-[13px] truncate',
                completed ? 'text-text-disabled line-through' : 'text-text-secondary',
            ].join(' ');
            name.textContent = (h.icon || '\u26A1') + ' ' + (h.name || 'Habit');
            row.appendChild(name);

            /* Streak indicator */
            var streak = store.getStreak(h.id);
            if (streak > 0) {
                var streakEl = document.createElement('span');
                streakEl.className = 'flex-shrink-0 text-[10px] font-semibold tabular-nums text-accent-habits/80';
                streakEl.textContent = streak + 'd';
                row.appendChild(streakEl);
            }

            habitList.appendChild(row);
        }

        slot.appendChild(habitList);
    }
}

/* ================================================================
   SHARED UI BUILDERS — Pure functions
   ================================================================ */

function _focusWidgetShell(title, domain, id, href, color) {
    var wrapper = document.createElement('div');
    wrapper.className = [
        'dash-card rounded-2xl',
        'bg-surface-raised/60 border border-white/[0.04]',
        'p-5 md:p-6',
    ].join(' ');

    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-4';

    var left = document.createElement('div');
    left.className = 'flex items-center gap-2.5';

    var indicator = document.createElement('span');
    indicator.className = 'w-1.5 h-1.5 rounded-full bg-' + color;
    left.appendChild(indicator);

    var heading = document.createElement('h3');
    heading.className = 'text-[13px] font-semibold text-text-primary tracking-wide';
    heading.textContent = title;
    left.appendChild(heading);

    header.appendChild(left);

    var link = document.createElement('a');
    link.href = '#' + href;
    link.className = 'text-[11px] text-text-disabled hover:text-text-tertiary transition-colors duration-150';
    link.textContent = 'View all \u2192';
    header.appendChild(link);

    var body = document.createElement('div');
    body.id = id;
    body.innerHTML = _skeletonLines(3);

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    return wrapper;
}

function _createFAB() {
    var wrap = document.createElement('div');
    wrap.id = 'dash-qc-fab';
    wrap.className = 'fixed bottom-6 right-6 z-40 sm:bottom-8 sm:right-8';

    var btn = document.createElement('button');
    btn.id = 'dash-qc-trigger';
    btn.className = [
        'w-14 h-14 rounded-2xl flex items-center justify-center',
        'bg-gradient-to-br from-accent-tasks to-accent-habits',
        'shadow-elevated hover:shadow-floating',
        'hover:scale-105 active:scale-95',
        'transition-all duration-200',
        'group',
    ].join(' ');
    btn.setAttribute('aria-label', 'Quick capture');
    btn.innerHTML =
        '<svg viewBox="0 0 20 20" fill="currentColor" class="w-6 h-6 text-white transition-transform duration-200 group-hover:rotate-90">' +
            '<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>' +
        '</svg>';

    wrap.appendChild(btn);
    return wrap;
}

/* ── Quick Capture Field Builders ────────────────────────── */

function _createTaskFields(type) {
    var wrap = document.createElement('div');
    wrap.className = 'space-y-3';

    /* Task name */
    var nameInput = document.createElement('input');
    nameInput.id = 'dash-qc-task-name';
    nameInput.type = 'text';
    nameInput.placeholder = type.placeholder;
    nameInput.className = [
        'w-full px-4 py-3 rounded-xl text-[13px]',
        'bg-white/[0.04] border border-white/[0.06]',
        'text-text-primary placeholder:text-text-disabled',
        'focus:outline-none focus:border-accent-tasks/40 focus:bg-white/[0.06]',
        'transition-all duration-150',
    ].join(' ');
    wrap.appendChild(nameInput);

    /* Priority selector */
    var priRow = document.createElement('div');
    priRow.className = 'flex gap-2';

    var priorities = [
        { value: 'high',   label: 'High',   color: 'status-error' },
        { value: 'medium', label: 'Medium', color: 'status-warning' },
        { value: 'low',    label: 'Low',    color: 'text-disabled' },
    ];

    for (var i = 0; i < priorities.length; i++) {
        var p = priorities[i];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.value = p.value;
        btn.className = [
            'flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150',
            i === 1
                ? 'bg-' + p.color + '/10 border-' + p.color + '/20 text-' + p.color
                : 'bg-white/[0.02] border-transparent text-text-tertiary hover:bg-white/[0.04]',
        ].join(' ');
        btn.textContent = p.label;
        priRow.appendChild(btn);
    }

    wrap.appendChild(priRow);

    /* Hidden select for programmatic access */
    var sel = document.createElement('select');
    sel.id = 'dash-qc-task-priority';
    sel.className = 'sr-only';
    sel.innerHTML = '<option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option>';
    wrap.appendChild(sel);

    /* Wire priority buttons */
    var buttons = priRow.querySelectorAll('button');
    for (var b = 0; b < buttons.length; b++) {
        (function (idx) {
            buttons[idx].addEventListener('click', function () {
                sel.value = buttons[idx].dataset.value;
                for (var j = 0; j < buttons.length; j++) {
                    var pp = priorities[j];
                    if (j === idx) {
                        buttons[j].className = [
                            'flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150',
                            'bg-' + pp.color + '/10 border-' + pp.color + '/20 text-' + pp.color,
                        ].join(' ');
                    } else {
                        buttons[j].className = [
                            'flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150',
                            'bg-white/[0.02] border-transparent text-text-tertiary hover:bg-white/[0.04]',
                        ].join(' ');
                    }
                }
            });
        })(b);
    }

    return wrap;
}

function _createNoteFields() {
    var wrap = document.createElement('div');
    wrap.className = 'space-y-3';

    var titleInput = document.createElement('input');
    titleInput.id = 'dash-qc-note-title';
    titleInput.type = 'text';
    titleInput.placeholder = 'Note title (optional)';
    titleInput.className = [
        'w-full px-4 py-3 rounded-xl text-[13px]',
        'bg-white/[0.04] border border-white/[0.06]',
        'text-text-primary placeholder:text-text-disabled',
        'focus:outline-none focus:border-accent-knowledge/40 focus:bg-white/[0.06]',
        'transition-all duration-150',
    ].join(' ');
    wrap.appendChild(titleInput);

    var contentInput = document.createElement('textarea');
    contentInput.id = 'dash-qc-note-content';
    contentInput.placeholder = 'Capture a thought...';
    contentInput.rows = 3;
    contentInput.className = [
        'w-full px-4 py-3 rounded-xl text-[13px] resize-none',
        'bg-white/[0.04] border border-white/[0.06]',
        'text-text-primary placeholder:text-text-disabled',
        'focus:outline-none focus:border-accent-knowledge/40 focus:bg-white/[0.06]',
        'transition-all duration-150',
    ].join(' ');
    wrap.appendChild(contentInput);

    return wrap;
}

function _createExpenseFields() {
    var wrap = document.createElement('div');
    wrap.className = 'space-y-3';

    var amountRow = document.createElement('div');
    amountRow.className = 'relative';

    var dollarSign = document.createElement('span');
    dollarSign.className = 'absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-text-disabled font-medium';
    dollarSign.textContent = '$';
    amountRow.appendChild(dollarSign);

    var amountInput = document.createElement('input');
    amountInput.id = 'dash-qc-expense-amount';
    amountInput.type = 'number';
    amountInput.step = '0.01';
    amountInput.min = '0';
    amountInput.placeholder = '0.00';
    amountInput.className = [
        'w-full pl-8 pr-4 py-3 rounded-xl text-[14px] tabular-nums',
        'bg-white/[0.04] border border-white/[0.06]',
        'text-text-primary placeholder:text-text-disabled',
        'focus:outline-none focus:border-accent-finance/40 focus:bg-white/[0.06]',
        'transition-all duration-150',
    ].join(' ');
    amountRow.appendChild(amountInput);
    wrap.appendChild(amountRow);

    var descInput = document.createElement('input');
    descInput.id = 'dash-qc-expense-desc';
    descInput.type = 'text';
    descInput.placeholder = 'Description (optional)';
    descInput.className = [
        'w-full px-4 py-3 rounded-xl text-[13px]',
        'bg-white/[0.04] border border-white/[0.06]',
        'text-text-primary placeholder:text-text-disabled',
        'focus:outline-none focus:border-accent-finance/40 focus:bg-white/[0.06]',
        'transition-all duration-150',
    ].join(' ');
    wrap.appendChild(descInput);

    return wrap;
}

function _emptyState(emoji, title, desc) {
    var wrap = document.createElement('div');
    wrap.className = 'text-center py-8';
    wrap.innerHTML =
        '<div class="text-3xl mb-3 opacity-15">' + emoji + '</div>' +
        '<p class="text-[13px] text-text-secondary font-medium mb-1">' + title + '</p>' +
        '<p class="text-[11px] text-text-tertiary leading-relaxed">' + desc + '</p>';
    return wrap;
}

function _skeletonLines(count) {
    var html = '<div class="space-y-3">';
    for (var i = 0; i < count; i++) {
        var w = 50 + Math.round(Math.random() * 40);
        html +=
            '<div class="flex items-center gap-3">' +
                '<div class="w-2.5 h-2.5 rounded-full bg-white/[0.04] animate-pulse"></div>' +
                '<div class="h-3 rounded bg-white/[0.04] animate-pulse" style="width:' + w + '%"></div>' +
            '</div>';
    }
    html += '</div>';
    return html;
}

function _miniProgressRing(percentage, size) {
    var wrap = document.createElement('div');
    wrap.className = 'relative flex-shrink-0';
    wrap.style.width = size + 'px';
    wrap.style.height = size + 'px';

    var r = (size - 6) / 2;
    var c = 2 * Math.PI * r;
    var offset = c - (percentage / 100) * c;

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);

    var bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('cx', String(size / 2));
    bgCircle.setAttribute('cy', String(size / 2));
    bgCircle.setAttribute('r', String(r));
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    bgCircle.setAttribute('stroke-width', '3');
    svg.appendChild(bgCircle);

    var progCircle = document.createElementNS(svgNS, 'circle');
    progCircle.setAttribute('cx', String(size / 2));
    progCircle.setAttribute('cy', String(size / 2));
    progCircle.setAttribute('r', String(r));
    progCircle.setAttribute('fill', 'none');
    progCircle.setAttribute('stroke', percentage === 100 ? 'var(--color-accent-tasks, #34d399)' : 'var(--color-accent-habits, #fb923c)');
    progCircle.setAttribute('stroke-width', '3');
    progCircle.setAttribute('stroke-linecap', 'round');
    progCircle.setAttribute('stroke-dasharray', String(c));
    progCircle.setAttribute('stroke-dashoffset', String(c));
    progCircle.setAttribute('transform', 'rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')');
    progCircle.style.transition = 'stroke-dashoffset 800ms cubic-bezier(0.45,0,0.55,1)';
    svg.appendChild(progCircle);

    wrap.appendChild(svg);

    var center = document.createElement('div');
    center.className = 'absolute inset-0 flex items-center justify-center text-[11px] font-bold text-text-primary tabular-nums';
    center.textContent = percentage + '%';
    wrap.appendChild(center);

    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            progCircle.setAttribute('stroke-dashoffset', String(offset));
        });
    });

    return wrap;
}

/* ================================================================
   HELPERS — Pure functions
   ================================================================ */

function _greetingText() {
    var h = new Date().getHours();
    if (h < 5)  return 'Good Night';
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}

function _subtitleText() {
    var h = new Date().getHours();
    if (h < 5)  return 'Rest well \u2014 tomorrow is a new opportunity.';
    if (h < 12) return 'Start the day with clarity and intention.';
    if (h < 17) return 'Stay focused. Progress is built one step at a time.';
    return 'Reflect on what you accomplished today.';
}

function _dateString() {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
}

function _todayISO() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

export default DashboardView;
