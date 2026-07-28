/**
 * Tarteeb — Command Palette
 *
 * A global, keyboard-first command palette (Cmd/Ctrl+K).
 * Apple Spotlight / Raycast-inspired glassmorphism overlay.
 *
 * Capabilities:
 *   - Omni-search across tasks, notes, transactions
 *   - Navigation commands (go to Finance, Tasks, etc.)
 *   - Action commands (Quick Capture, theme toggle, etc.)
 *   - Keyboard trap, arrow-key navigation, Enter to execute
 *
 * Lifecycle:
 *   init(database, eventBus) → binds global shortcut
 *   open()                   → builds overlay, animates in, focuses input
 *   close()                  → animates out, removes overlay
 *   destroy()                → unbinds all listeners
 *
 * Design constraints:
 *   - Zero dependency on any pillar view
 *   - Reads data through gateways for search
 *   - ES5-compatible var usage in older patterns, vanilla JS
 *   - No frameworks
 */

'use strict';

/* ── Imports ──────────────────────────────────────────────── */

import { TaskGateway }      from '../../persistence/gateways/task-gateway.js';
import { KnowledgeGateway }  from '../../persistence/gateways/knowledge-gateway.js';
import { FinanceGateway }    from '../../persistence/gateways/finance-gateway.js';

/* ── Constants ───────────────────────────────────────────── */

var OVERLAY_ID   = 'cmd-palette-overlay';
var INPUT_ID     = 'cmd-palette-input';
var RESULTS_ID   = 'cmd-palette-results';
var MAX_RESULTS  = 12;

/* ── Static Commands ─────────────────────────────────────── */

var NAV_COMMANDS = [
    { id: 'nav-dashboard',  label: 'Go to Overview',   icon: _iconHome(),     category: 'Navigation', hash: '/dashboard',  color: '' },
    { id: 'nav-tasks',      label: 'Go to Tasks',      icon: _iconCalendar(), category: 'Navigation', hash: '/tasks',      color: 'accent-tasks' },
    { id: 'nav-finance',    label: 'Go to Finance',    icon: _iconDollar(),   category: 'Navigation', hash: '/finance',    color: 'accent-finance' },
    { id: 'nav-knowledge',  label: 'Go to Knowledge',  icon: _iconBook(),     category: 'Navigation', hash: '/knowledge',  color: 'accent-knowledge' },
    { id: 'nav-habits',     label: 'Go to Habits',     icon: _iconBolt(),     category: 'Navigation', hash: '/habits',     color: 'accent-habits' },
    { id: 'nav-goals',      label: 'Go to Goals',      icon: _iconStar(),     category: 'Navigation', hash: '/goals',      color: 'accent-goals' },
];

var ACTION_COMMANDS = [
    { id: 'action-qc',      label: 'Quick Capture',    icon: _iconPlus(),     category: 'Actions', action: 'quickCapture', color: 'accent-tasks' },
    { id: 'action-theme',   label: 'Toggle Theme',     icon: _iconMoon(),     category: 'Actions', action: 'toggleTheme',  color: 'accent-knowledge' },
    { id: 'action-sidebar', label: 'Toggle Sidebar',   icon: _iconSidebar(),  category: 'Actions', action: 'toggleSidebar', color: '' },
];

/* ── SVG Icons ───────────────────────────────────────────── */

function _iconHome() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>';
}
function _iconCalendar() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>';
}
function _iconDollar() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>';
}
function _iconBook() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V14a.5.5 0 01-1 0V4.804z"/></svg>';
}
function _iconBolt() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>';
}
function _iconStar() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>';
}
function _iconPlus() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>';
}
function _iconMoon() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>';
}
function _iconSidebar() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v3h8V6z" clip-rule="evenodd"/></svg>';
}
function _iconSearch() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>';
}
function _iconArrow() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>';
}
function _iconTask() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>';
}
function _iconNote() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V14a.5.5 0 01-1 0V4.804z"/></svg>';
}
function _iconFinance() {
    return '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>';
}

/* ── Helpers ─────────────────────────────────────────────── */

function _escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function _highlightMatch(text, query) {
    if (!query) return _escapeHtml(text);
    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(' + escaped + ')', 'gi');
    return _escapeHtml(text).replace(re, '<mark class="cmd-palette-mark">$1</mark>');
}

function _colorClass(color) {
    return color ? 'text-' + color : 'text-text-secondary';
}

/* ================================================================
   CommandPalette — Class
   ================================================================ */

export class CommandPalette {
    constructor() {
        this._db           = null;
        this._bus          = null;
        this._open         = false;
        this._overlay      = null;
        this._input        = null;
        this._resultsEl    = null;
        this._selected     = 0;
        this._flat         = [];
        this._query        = '';
        this._esc          = null;
        this._boundKey     = this._onGlobalKey.bind(this);
        this._searchVer    = 0;
        this._debounceTimer = null;
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    init(database, eventBus) {
        if (!database || !eventBus) return;
        this._db  = database;
        this._bus = eventBus;
        window.addEventListener('keydown', this._boundKey);
    }

    destroy() {
        this.close();
        window.removeEventListener('keydown', this._boundKey);
        this._db  = null;
        this._bus = null;
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

    toggle() {
        if (this._open) this.close(); else this.open();
    }

    /* ── Global Keyboard ──────────────────────────────────── */

    _onGlobalKey(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        }
    }

    /* ── Overlay Builder ──────────────────────────────────── */

    _buildOverlay() {
        this._removeOverlay();
        this._selected = 0;
        this._query = '';
        this._flat = [];

        /* Backdrop */
        var overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'cmd-palette-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Command Palette');

        /* Panel */
        var panel = document.createElement('div');
        panel.className = 'cmd-palette-panel';

        /* Search Input Row */
        var searchRow = document.createElement('div');
        searchRow.className = 'cmd-palette-search-row';

        var searchIcon = document.createElement('span');
        searchIcon.className = 'cmd-palette-search-icon';
        searchIcon.innerHTML = _iconSearch();
        searchRow.appendChild(searchIcon);

        var input = document.createElement('input');
        input.id = INPUT_ID;
        input.type = 'text';
        input.className = 'cmd-palette-input';
        input.placeholder = 'Type a command or search...';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', RESULTS_ID);
        input.setAttribute('aria-activedescendant', '');
        searchRow.appendChild(input);

        var kbd = document.createElement('span');
        kbd.className = 'cmd-palette-kbd';
        kbd.textContent = 'ESC';
        searchRow.appendChild(kbd);

        panel.appendChild(searchRow);

        /* Separator */
        var sep = document.createElement('div');
        sep.className = 'cmd-palette-separator';
        panel.appendChild(sep);

        /* Results */
        var results = document.createElement('div');
        results.id = RESULTS_ID;
        results.className = 'cmd-palette-results';
        results.setAttribute('role', 'listbox');
        panel.appendChild(results);

        /* Footer */
        var footer = document.createElement('div');
        footer.className = 'cmd-palette-footer';
        footer.innerHTML =
            '<span class="cmd-palette-footer-hint">' +
                '<kbd>\u2191\u2193</kbd> Navigate' +
            '</span>' +
            '<span class="cmd-palette-footer-hint">' +
                '<kbd>\u21B5</kbd> Select' +
            '</span>' +
            '<span class="cmd-palette-footer-hint">' +
                '<kbd>Esc</kbd> Close' +
            '</span>';
        panel.appendChild(footer);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        /* Store refs */
        this._overlay  = overlay;
        this._input    = input;
        this._resultsEl = results;

        /* Animate in */
        var self = this;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                overlay.classList.add('is-active');
                input.focus();
            });
        });

        /* Input handler */
        var self2 = this;
        input.addEventListener('input', function () {
            self2._query = input.value.trim();
            self2._selected = 0;
            self2._renderStatic();

            /* Debounced async search */
            clearTimeout(self2._debounceTimer);
            if (self2._query.length >= 2) {
                self2._debounceTimer = setTimeout(function () {
                    self2._renderAsyncSearch();
                }, 150);
            }
        });

        /* Keyboard navigation */
        input.addEventListener('keydown', function (e) {
            self._onOverlayKey(e);
        });

        /* Backdrop click = close */
        overlay.addEventListener('mousedown', function (e) {
            if (e.target === overlay) self.close();
        });

        /* ESC listener inside overlay */
        this._esc = function (e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                self.close();
            }
        };
        document.addEventListener('keydown', this._esc, true);

        /* Initial render (show all commands) */
        this._renderStatic();
    }

    _removeOverlay() {
        clearTimeout(this._debounceTimer);
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay   = null;
        this._input     = null;
        this._resultsEl = null;
        this._flat      = [];
        this._searchVer = 0;

        if (this._esc) {
            document.removeEventListener('keydown', this._esc, true);
            this._esc = null;
        }
    }

    /* ── Keyboard Navigation ──────────────────────────────── */

    _onOverlayKey(e) {
        var total = this._flat.length;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._selected = (this._selected + 1) % Math.max(total, 1);
            this._updateSelection();
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._selected = (this._selected - 1 + total) % Math.max(total, 1);
            this._updateSelection();
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (total > 0 && this._flat[this._selected]) {
                this._execute(this._flat[this._selected]);
            }
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                this._selected = (this._selected - 1 + total) % Math.max(total, 1);
            } else {
                this._selected = (this._selected + 1) % Math.max(total, 1);
            }
            this._updateSelection();
        }
    }

    _updateSelection() {
        if (!this._resultsEl) return;
        var items = this._resultsEl.querySelectorAll('[role="option"]');
        for (var i = 0; i < items.length; i++) {
            items[i].classList.toggle('is-selected', i === this._selected);
            if (i === this._selected) {
                items[i].scrollIntoView({ block: 'nearest' });
                this._input.setAttribute('aria-activedescendant', items[i].id);
            }
        }
    }

    /* ── Results Rendering ────────────────────────────────── */

    _renderStatic() {
        if (!this._resultsEl) return;
        var container = this._resultsEl;
        container.innerHTML = '';
        this._flat = [];

        var q = this._query.toLowerCase();

        /* Build candidate list */
        var candidates = [];
        for (var n = 0; n < NAV_COMMANDS.length; n++) candidates.push(NAV_COMMANDS[n]);
        for (var a = 0; a < ACTION_COMMANDS.length; a++) candidates.push(ACTION_COMMANDS[a]);

        /* Filter */
        var matched = [];
        if (!q) {
            matched = candidates;
        } else {
            for (var c = 0; c < candidates.length; c++) {
                if (candidates[c].label.toLowerCase().indexOf(q) !== -1 ||
                    candidates[c].category.toLowerCase().indexOf(q) !== -1) {
                    matched.push(candidates[c]);
                }
            }
        }

        /* Render sections */
        var idx = 0;
        if (matched.length > 0) {
            var navItems = [];
            var actionItems = [];
            for (var ci = 0; ci < matched.length; ci++) {
                if (matched[ci].category === 'Navigation') navItems.push(matched[ci]);
                else actionItems.push(matched[ci]);
            }
            if (navItems.length > 0) {
                this._renderSection(container, 'Navigation', navItems, idx, q);
                idx += navItems.length;
            }
            if (actionItems.length > 0) {
                this._renderSection(container, 'Actions', actionItems, idx, q);
                idx += actionItems.length;
            }
        }

        /* Empty state (no query yet, or no static matches) */
        if (this._flat.length === 0 && !q) {
            var empty = document.createElement('div');
            empty.className = 'cmd-palette-empty';
            empty.textContent = 'Start typing to search...';
            container.appendChild(empty);
        } else if (this._flat.length === 0 && q) {
            var empty2 = document.createElement('div');
            empty2.className = 'cmd-palette-empty';
            empty2.id = 'cmd-palette-empty-static';
            empty2.textContent = 'No commands match "' + this._query + '"';
            container.appendChild(empty2);
        }

        if (this._selected >= this._flat.length) {
            this._selected = Math.max(0, this._flat.length - 1);
        }
        this._updateSelection();
    }

    _renderAsyncSearch() {
        if (!this._resultsEl || !this._open) return;
        var self = this;
        var container = this._resultsEl;
        var ver = ++this._searchVer;
        var query = this._query;
        var q = query.toLowerCase();

        /* Remove "no commands" placeholder if present */
        var placeholder = document.getElementById('cmd-palette-empty-static');
        if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);

        /* Show loading */
        var loading = document.createElement('div');
        loading.className = 'cmd-palette-section-header';
        loading.textContent = 'Searching...';
        loading.id = 'cmd-palette-loading';
        container.appendChild(loading);

        this._searchData(query).then(function (dataResults) {
            /* Stale — a newer search superseded this one */
            if (ver !== self._searchVer) return;
            if (!self._open) return;

            /* Remove loading indicator */
            var el = document.getElementById('cmd-palette-loading');
            if (el && el.parentNode) el.parentNode.removeChild(el);

            if (dataResults.length > 0) {
                self._renderSection(container, 'Results', dataResults, self._flat.length, q);
            } else if (self._flat.length === 0) {
                var empty = document.createElement('div');
                empty.className = 'cmd-palette-empty';
                empty.textContent = 'No results for "' + query + '"';
                container.appendChild(empty);
            }

            if (self._selected >= self._flat.length) {
                self._selected = Math.max(0, self._flat.length - 1);
            }
            self._updateSelection();
        });
    }

    _renderSection(container, sectionLabel, items, startIdx, query) {
        var header = document.createElement('div');
        header.className = 'cmd-palette-section-header';
        header.textContent = sectionLabel;
        container.appendChild(header);

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var flatIdx = startIdx + i;
            this._flat.push(item);

            var row = document.createElement('div');
            row.id = 'cmd-palette-item-' + flatIdx;
            row.className = 'cmd-palette-item' + (flatIdx === this._selected ? ' is-selected' : '');
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', flatIdx === this._selected ? 'true' : 'false');
            row.dataset.index = flatIdx;

            var iconWrap = document.createElement('span');
            iconWrap.className = 'cmd-palette-item-icon ' + _colorClass(item.color);
            iconWrap.innerHTML = item.icon;
            row.appendChild(iconWrap);

            var labelWrap = document.createElement('span');
            labelWrap.className = 'cmd-palette-item-label';
            labelWrap.innerHTML = _highlightMatch(item.label, query);
            row.appendChild(labelWrap);

            if (item.category) {
                var cat = document.createElement('span');
                cat.className = 'cmd-palette-item-category';
                cat.textContent = item.category;
                row.appendChild(cat);
            }

            var arrow = document.createElement('span');
            arrow.className = 'cmd-palette-item-arrow';
            arrow.innerHTML = _iconArrow();
            row.appendChild(arrow);

            /* Hover + click */
            var self = this;
            var idx = flatIdx;
            row.addEventListener('mouseenter', function () {
                self._selected = parseInt(this.dataset.index, 10);
                self._updateSelection();
            });
            row.addEventListener('click', function () {
                var itemIdx = parseInt(this.dataset.index, 10);
                if (self._flat[itemIdx]) self._execute(self._flat[itemIdx]);
            });

            container.appendChild(row);
        }
    }

    /* ── Data Search (async, via gateways) ─────────────────── */

    _searchData(query) {
        /* Returns a promise — callers must handle async.
           We kick off all three searches in parallel and merge. */
        var self = this;
        var db = this._db;
        if (!db) return Promise.resolve([]);

        var tasksP   = this._searchTasks(query, 5, db);
        var notesP   = this._searchNotes(query, 5, db);
        var txsP     = this._searchTransactions(query, 3, db);

        return Promise.all([tasksP, notesP, txsP]).then(function (results) {
            var merged = [];
            for (var i = 0; i < results.length; i++) {
                merged = merged.concat(results[i]);
            }
            return merged.slice(0, MAX_RESULTS);
        });
    }

    _searchTasks(query, limit, db) {
        var gw = new TaskGateway(db);
        return gw.getAllTasks().then(function (tasks) {
            var results = [];
            var q = query.toLowerCase();
            for (var i = 0; i < tasks.length && results.length < limit; i++) {
                var t = tasks[i];
                if (t.status === 'completed' || t.status === 'archived') continue;
                var title = (t.title || t.name || '').toLowerCase();
                if (title.indexOf(q) !== -1) {
                    results.push({
                        id: 'search-task-' + t.id,
                        label: t.title || t.name || 'Untitled Task',
                        icon: _iconTask(),
                        category: 'Task',
                        color: 'accent-tasks',
                        action: 'navigate',
                        hash: '/tasks/today',
                    });
                }
            }
            return results;
        }).catch(function () { return []; });
    }

    _searchNotes(query, limit, db) {
        var gw = new KnowledgeGateway(db);
        return gw.getAllNotes().then(function (notes) {
            var results = [];
            var q = query.toLowerCase();
            for (var i = 0; i < notes.length && results.length < limit; i++) {
                var n = notes[i];
                if (n.isArchived) continue;
                var title = (n.title || '').toLowerCase();
                var content = (n.content || '').toLowerCase();
                if (title.indexOf(q) !== -1 || content.indexOf(q) !== -1) {
                    results.push({
                        id: 'search-note-' + n.id,
                        label: n.title || 'Untitled Note',
                        icon: _iconNote(),
                        category: 'Note',
                        color: 'accent-knowledge',
                        action: 'navigate',
                        hash: '/knowledge',
                    });
                }
            }
            return results;
        }).catch(function () { return []; });
    }

    _searchTransactions(query, limit, db) {
        var gw = new FinanceGateway(db);
        return gw.getAllTransactions().then(function (txs) {
            var results = [];
            var q = query.toLowerCase();
            for (var i = 0; i < txs.length && results.length < limit; i++) {
                var tx = txs[i];
                var desc = (tx.description || '').toLowerCase();
                var cat = (tx.category || '').toLowerCase();
                if (desc.indexOf(q) !== -1 || cat.indexOf(q) !== -1) {
                    results.push({
                        id: 'search-tx-' + tx.id,
                        label: (tx.type === 'expense' ? '\u2212' : '+') + '$' + tx.amount.toFixed(2) + ' \u2014 ' + (tx.description || tx.category || 'Transaction'),
                        icon: _iconFinance(),
                        category: 'Transaction',
                        color: 'accent-finance',
                        action: 'navigate',
                        hash: '/finance/transactions',
                    });
                }
            }
            return results;
        }).catch(function () { return []; });
    }

    /* ── Action Execution ─────────────────────────────────── */

    _execute(item) {
        if (!item) return;
        this.close();

        if (item.action === 'navigate' && item.hash) {
            window.location.hash = item.hash;
            return;
        }

        if (item.hash) {
            window.location.hash = item.hash;
            return;
        }

        if (item.action === 'quickCapture') {
            if (window.__tarteeb && window.__tarteeb.quickCapture) {
                /* Defer to next frame so palette close animation completes first */
                var qc = window.__tarteeb.quickCapture;
                requestAnimationFrame(function () { qc.open(); });
            }
            return;
        }

        if (item.action === 'toggleTheme') {
            var store = window.__tarteeb && window.__tarteeb.store;
            if (store) {
                var current = store.get('theme');
                var next = current === 'dark' ? 'light' : 'dark';
                store.set('theme', next);
                document.documentElement.classList.toggle('dark', next === 'dark');
                document.documentElement.classList.toggle('light', next === 'light');
            }
            return;
        }

        if (item.action === 'toggleSidebar') {
            var store2 = window.__tarteeb && window.__tarteeb.store;
            if (store2) {
                store2.toggle('sidebar.collapsed');
                /* Trigger shell re-render */
                if (window.__tarteeb.shell && window.__tarteeb.shell._renderSidebar) {
                    window.__tarteeb.shell._renderSidebar();
                }
            }
            return;
        }
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
}
