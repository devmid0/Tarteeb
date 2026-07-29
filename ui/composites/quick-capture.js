/**
 * Tarteeb — Global Quick Capture
 *
 * Standalone module providing instant task / note / expense
 * logging from ANY view. Triggered by:
 *   - Floating Action Button (persistent, always visible)
 *   - Command Palette (Ctrl+K → "Quick Capture" action)
 *
 * Lifecycle:
 *   init(db, bus) → creates persistent FAB
 *   open()        → builds overlay, animates in
 *   close()       → animates out, removes overlay
 *   destroy()     → removes FAB
 *
 * Design constraints:
 *   - Zero dependency on any pillar view
 *   - Writes directly through gateways (no store hydration needed)
 *   - Publishes change events so downstream views react
 *   - ES5-compatible var usage, vanilla JS, no frameworks
 */

'use strict';

/* ── Imports ──────────────────────────────────────────────── */

import { TaskGateway }          from '../../persistence/gateways/task-gateway.js';
import { KnowledgeGateway }      from '../../persistence/gateways/knowledge-gateway.js';
import { FinanceGateway }        from '../../persistence/gateways/finance-gateway.js';
import { OptimisticDispatcher }  from '../../core/events/optimistic-dispatcher.js';
import { canCreateEntity, showPaywall } from '../../pillars/core/freemium.js';

/* ── Constants ───────────────────────────────────────────── */

var TYPES = [
    { id: 'task',    label: 'Task',    icon: '\u2713', color: 'accent-tasks',     placeholder: 'What needs to be done?' },
    { id: 'note',    label: 'Note',    icon: '\u2261', color: 'accent-knowledge', placeholder: 'Capture a thought...' },
    { id: 'expense', label: 'Expense', icon: '\u00A5', color: 'accent-finance',   placeholder: 'How much was spent?' },
];

var OVERLAY_ID   = 'qc-overlay';
var FAB_ID       = 'qc-global-fab';
var FAB_TRIGGER  = 'qc-global-trigger';

/* ================================================================
   QuickCapture — Class
   ================================================================ */

export class QuickCapture {
    constructor() {
        this._db         = null;
        this._bus        = null;
        this._dispatcher = null;
        this._open       = false;
        this._fabEl      = null;
        this._esc        = null;
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    /**
     * Initialize the global Quick Capture.
     * @param {Object} database — Database instance
     * @param {Object} eventBus — EventBus instance
     */
    init(database, eventBus) {
        if (!database || !eventBus) return;
        this._db  = database;
        this._bus = eventBus;
        this._dispatcher = new OptimisticDispatcher(eventBus);

        this._createFAB();
    }

    destroy() {
        this.close();
        this._removeFAB();
        this._db         = null;
        this._bus        = null;
        this._dispatcher = null;
    }

    /* ── Public API ───────────────────────────────────────── */

    open() {
        if (this._open) return;
        this._open = true;
        this._buildOverlay();
    }

    close() {
        if (!this._open) return;
        this._open = false;
        this._removeOverlay();
    }

    /* ── FAB ──────────────────────────────────────────────── */

    _createFAB() {
        if (this._fabEl) return;

        var wrap = document.createElement('div');
        wrap.id = FAB_ID;
        wrap.className = 'fixed bottom-6 right-6 z-40 sm:bottom-8 sm:right-8';

        var btn = document.createElement('button');
        btn.id = FAB_TRIGGER;
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

        btn.addEventListener('click', this.open.bind(this));
        wrap.appendChild(btn);
        document.body.appendChild(wrap);
        this._fabEl = wrap;
    }

    _removeFAB() {
        if (this._fabEl && this._fabEl.parentNode) {
            this._fabEl.parentNode.removeChild(this._fabEl);
        }
        this._fabEl = null;
    }

    /* ── Overlay ──────────────────────────────────────────── */

    _buildOverlay() {
        this._removeOverlay();

        var overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
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
            '<button id="qc-close-btn" class="w-7 h-7 rounded-lg flex items-center justify-center ' +
                'text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-colors">' +
                '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">' +
                    '<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>' +
                '</svg>' +
            '</button>';
        panel.appendChild(header);

        /* Type Tabs */
        var tabs = document.createElement('div');
        tabs.className = 'flex gap-1.5 px-5 pb-4';

        for (var t = 0; t < TYPES.length; t++) {
            var qt = TYPES[t];
            var tab = document.createElement('button');
            tab.className = this._tabCls(t === 0, qt);
            tab.dataset.type = qt.id;
            tab.innerHTML = '<span>' + qt.icon + '</span> ' + qt.label;
            tabs.appendChild(tab);
        }
        panel.appendChild(tabs);

        /* Input Area */
        var inputWrap = document.createElement('div');
        inputWrap.className = 'px-5 pb-5';

        var taskFields = this._createTaskFields(TYPES[0]);
        taskFields.id = 'qc-fields-task';
        inputWrap.appendChild(taskFields);

        var noteFields = this._createNoteFields();
        noteFields.id = 'qc-fields-note';
        noteFields.style.display = 'none';
        inputWrap.appendChild(noteFields);

        var expenseFields = this._createExpenseFields();
        expenseFields.id = 'qc-fields-expense';
        expenseFields.style.display = 'none';
        inputWrap.appendChild(expenseFields);

        var submitBtn = document.createElement('button');
        submitBtn.id = 'qc-submit';
        submitBtn.className = this._submitCls(TYPES[0]);
        submitBtn.textContent = 'Add Task';
        inputWrap.appendChild(submitBtn);

        panel.appendChild(inputWrap);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        /* Animate in */
        var self = this;
        requestAnimationFrame(function () {
            overlay.style.opacity = '1';
            panel.style.transform = 'translate-y-0 sm:scale-100';
        });

        /* Close handlers */
        var closeBtn = overlay.querySelector('#qc-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () { self.close(); });
        }
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) self.close();
        });
        this._esc = function (e) {
            if (e.key === 'Escape') self.close();
        };
        document.addEventListener('keydown', this._esc);

        /* Tab switching */
        var tabBtns = tabs.querySelectorAll('button');
        var activeTab = 0;
        for (var ti = 0; ti < tabBtns.length; ti++) {
            (function (idx) {
                tabBtns[idx].addEventListener('click', function () {
                    activeTab = idx;
                    var selectedType = TYPES[idx];

                    for (var j = 0; j < tabBtns.length; j++) {
                        tabBtns[j].className = self._tabCls(j === idx, TYPES[j]);
                    }

                    var fields = ['task', 'note', 'expense'];
                    for (var f = 0; f < fields.length; f++) {
                        var fEl = overlay.querySelector('#qc-fields-' + fields[f]);
                        if (fEl) fEl.style.display = fields[f] === selectedType.id ? '' : 'none';
                    }

                    submitBtn.textContent = 'Add ' + selectedType.label;
                    submitBtn.className = self._submitCls(selectedType);
                });
            })(ti);
        }

        /* Submit handler */
        submitBtn.addEventListener('click', function () {
            self._handleSubmit(activeTab, overlay);
        });

        /* Focus first input */
        var firstInput = taskFields.querySelector('input');
        if (firstInput) {
            setTimeout(function () { firstInput.focus(); }, 100);
        }
    }

    _removeOverlay() {
        var overlay = document.getElementById(OVERLAY_ID);
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        if (this._esc) {
            document.removeEventListener('keydown', this._esc);
            this._esc = null;
        }
    }

    /* ── Submit Handler ───────────────────────────────────── */

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

    async _handleSubmit(typeIndex, overlay) {
        var type = TYPES[typeIndex];
        var db   = this._db;
        var bus  = this._bus;
        var self = this;

        var ENTITY_MAP = { task: 'tasks', note: 'knowledge', expense: 'finance' };
        if (!await canCreateEntity(ENTITY_MAP[type.id], await this._countForType(ENTITY_MAP[type.id]))) {
            showPaywall();
            return;
        }

        if (type.id === 'task') {
            var nameInput     = overlay.querySelector('#qc-task-name');
            var prioritySel   = overlay.querySelector('#qc-task-priority');
            var name = nameInput ? nameInput.value.trim() : '';
            if (!name) { nameInput && nameInput.focus(); return; }

            var now  = new Date().toISOString();
            var data = {
                name: name,
                status: 'pending',
                priority: prioritySel ? prioritySel.value : 'medium',
                dueDate: this._todayISO(),
                projectId: null,
                createdAt: now,
                updatedAt: now,
            };

            var gateway = new TaskGateway(db);
            this._dispatcher.dispatch('tarteeb:task-created', data, function () {
                return gateway.createTask(data);
            });
            this._toast('Task added');

        } else if (type.id === 'note') {
            var titleInput   = overlay.querySelector('#qc-note-title');
            var contentInput = overlay.querySelector('#qc-note-content');
            var title    = titleInput ? titleInput.value.trim() : '';
            var content  = contentInput ? contentInput.value.trim() : '';
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

            var kGateway = new KnowledgeGateway(db);
            this._dispatcher.dispatch('tarteeb:note-created', noteData, function () {
                return kGateway.createNote(noteData);
            });
            this._toast('Note captured');

        } else if (type.id === 'expense') {
            var amountInput = overlay.querySelector('#qc-expense-amount');
            var descInput   = overlay.querySelector('#qc-expense-desc');
            var amount = amountInput ? parseFloat(amountInput.value) : 0;
            if (!amount || amount <= 0) { amountInput && amountInput.focus(); return; }

            var now3 = new Date().toISOString();
            var txData = {
                type: 'expense',
                amount: amount,
                category: 'uncategorized',
                description: descInput ? descInput.value.trim() : '',
                date: this._todayISO(),
                createdAt: now3,
                updatedAt: now3,
            };

            var fGateway = new FinanceGateway(db);
            this._dispatcher.dispatch('tarteeb:expense-created', txData, function () {
                return fGateway.createTransaction(txData);
            });
            this._toast('Expense logged');
        }

        this.close();
    }

    /* ── Field Builders ───────────────────────────────────── */

    _createTaskFields(type) {
        var wrap = document.createElement('div');
        wrap.className = 'space-y-3';

        var nameInput = document.createElement('input');
        nameInput.id = 'qc-task-name';
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

        var sel = document.createElement('select');
        sel.id = 'qc-task-priority';
        sel.className = 'sr-only';
        sel.innerHTML = '<option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option>';
        wrap.appendChild(sel);

        var buttons = priRow.querySelectorAll('button');
        for (var b = 0; b < buttons.length; b++) {
            (function (idx) {
                buttons[idx].addEventListener('click', function () {
                    sel.value = buttons[idx].dataset.value;
                    for (var j = 0; j < buttons.length; j++) {
                        var pp = priorities[j];
                        buttons[j].className = [
                            'flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150',
                            j === idx
                                ? 'bg-' + pp.color + '/10 border-' + pp.color + '/20 text-' + pp.color
                                : 'bg-white/[0.02] border-transparent text-text-tertiary hover:bg-white/[0.04]',
                        ].join(' ');
                    }
                });
            })(b);
        }

        return wrap;
    }

    _createNoteFields() {
        var wrap = document.createElement('div');
        wrap.className = 'space-y-3';

        var titleInput = document.createElement('input');
        titleInput.id = 'qc-note-title';
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
        contentInput.id = 'qc-note-content';
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

    _createExpenseFields() {
        var wrap = document.createElement('div');
        wrap.className = 'space-y-3';

        var amountRow = document.createElement('div');
        amountRow.className = 'relative';

        var dollarSign = document.createElement('span');
        dollarSign.className = 'absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-text-disabled font-medium';
        dollarSign.textContent = '$';
        amountRow.appendChild(dollarSign);

        var amountInput = document.createElement('input');
        amountInput.id = 'qc-expense-amount';
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
        descInput.id = 'qc-expense-desc';
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

    /* ── Toast ────────────────────────────────────────────── */

    _toast(message, isError) {
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

    /* ── Helpers ──────────────────────────────────────────── */

    _tabCls(active, qt) {
        if (active) {
            return [
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium',
                'transition-all duration-150',
                'bg-' + qt.color + '/15 text-' + qt.color + ' border border-' + qt.color + '/20',
            ].join(' ');
        }
        return [
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium',
            'transition-all duration-150',
            'bg-white/[0.03] text-text-tertiary border border-transparent hover:bg-white/[0.06] hover:text-text-secondary',
        ].join(' ');
    }

    _submitCls(qt) {
        return [
            'w-full mt-3 py-2.5 rounded-xl text-[13px] font-semibold',
            'bg-' + qt.color + ' text-white',
            'hover:brightness-110 active:scale-[0.98]',
            'transition-all duration-150',
        ].join(' ');
    }

    _todayISO() {
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }
}
