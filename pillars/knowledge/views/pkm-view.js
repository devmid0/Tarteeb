/**
 * Tarteeb — PKM View (Masonry + Canvas)
 *
 * Top-level view for the Knowledge / PKM pillar.
 * Two modes: masonry grid (overview) and canvas editor (editing).
 * Seamless transition between modes — no modals.
 *
 * Lifecycle:
 *   render()  → builds the shell (header, content slot)
 *   mount()   → hydrates store, binds events, renders grid
 *   unmount() → unsubscribes all listeners, cleans up
 *
 * Design constraints:
 *   - Masonry grid layout for browsing
 *   - Notion-style canvas editor for editing
 *   - Uses accent-knowledge color (#c084fc)
 *   - Filter/sort state lives on the class (survives event-driven re-renders)
 *   - Every button wired to dispatch() → gateway
 *   - Single re-render trigger: 'knowledge:changed'
 *   - Invisible auto-save (500ms debounce)
 */

'use strict';

import { KnowledgeStore } from '../state/knowledge-store.js';
import { KnowledgeGateway } from '../../../persistence/gateways/knowledge-gateway.js';
import { createNoteMasonryGrid } from '../components/note-masonry.js';
import { createNoteCanvas } from '../components/note-canvas.js';
import { CATEGORY_META } from '../domain/knowledge-rules.js';

export class PKMView {
    constructor() {
        this.container  = null;
        this.store      = null;
        this._unsubs    = [];

        /* ── View-local UI state ── */
        this.searchTerm     = '';
        this.activeCategory = null;    /* null = All Notes */
        this.showArchived   = false;
        this._searchTimer   = null;
        this._selfUpdating  = false;

        /* ── Canvas state ── */
        this._canvasNoteId  = null;    /* null = grid mode, number = canvas mode */
        this._canvasEl      = null;    /* reference to active canvas DOM */
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render() {
        var fragment = document.createDocumentFragment();

        /* Ambient gradient */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background = 'radial-gradient(ellipse at 10% 20%, rgba(192,132,252,0.04) 0%, transparent 60%)';

        /* Main wrapper */
        var main = document.createElement('div');
        main.className = 'relative h-full flex flex-col';

        /* Header — compact, sits above the content */
        var header = document.createElement('header');
        header.className = [
            'flex items-center justify-between gap-4',
            'px-5 py-3 border-b border-white/[0.04]',
            'bg-surface-base/60 backdrop-blur-sm flex-shrink-0',
        ].join(' ');

        var titleGroup = document.createElement('div');
        titleGroup.className = 'flex items-center gap-3';
        titleGroup.innerHTML =
            '<h1 class="text-[16px] font-heading font-semibold text-text-primary tracking-tight">' +
                'Knowledge' +
            '</h1>' +
            '<span class="text-[11px] text-text-disabled font-medium uppercase tracking-widest">' +
                'PKM' +
            '</span>';

        var headerActions = document.createElement('div');
        headerActions.className = 'flex items-center gap-2';

        /* Stats pill */
        var statsPill = document.createElement('span');
        statsPill.className = 'notes-count-pill text-[11px] text-text-disabled tabular-nums';
        headerActions.appendChild(statsPill);

        /* Archive toggle */
        var archiveBtn = document.createElement('button');
        archiveBtn.type = 'button';
        archiveBtn.className = this._archiveBtnCls();
        archiveBtn.textContent = this.showArchived ? 'Hide Archived' : 'Archived';
        archiveBtn.addEventListener('click', this._toggleArchived.bind(this));
        headerActions.appendChild(archiveBtn);

        header.appendChild(titleGroup);
        header.appendChild(headerActions);
        main.appendChild(header);

        /* Content slot (grid or canvas) */
        var contentSlot = document.createElement('div');
        contentSlot.id = 'pkm-content-slot';
        contentSlot.className = 'flex-1 min-h-0';
        main.appendChild(contentSlot);

        fragment.appendChild(gradient);
        fragment.appendChild(main);

        return fragment;
    }

    async mount(container) {
        this.container = container;

        /* Initialise persistence + state for this pillar */
        try {
            var db = window.__tarteeb && window.__tarteeb.database;
            if (db) {
                var gateway = new KnowledgeGateway(db);
                this.store  = new KnowledgeStore(window.__tarteeb.eventBus, gateway);
                await this.store.hydrate();
            }
        } catch (err) {
            console.error('[Knowledge] Failed to initialise store:', err);
        }

        this._renderContent();
        this._renderStats();
        this._bindEvents();
    }

    unmount() {
        clearTimeout(this._searchTimer);
        /* Flush any pending canvas auto-save */
        if (this._canvasEl && this._canvasEl._canvasFlush) {
            this._canvasEl._canvasFlush();
        }
        for (var i = 0; i < this._unsubs.length; i++) {
            this._unsubs[i]();
        }
        this._unsubs = [];
        this.container    = null;
        this.store        = null;
        this._canvasNoteId = null;
        this._canvasEl    = null;
    }

    /* ================================================================
       CONTENT RENDERING (Grid or Canvas)
       ================================================================ */

    _renderContent() {
        clearTimeout(this._searchTimer);
        var slot = this.container && this.container.querySelector('#pkm-content-slot');
        if (!slot) return;
        slot.innerHTML = '';

        if (this._canvasNoteId) {
            this._renderCanvas(slot);
        } else {
            this._renderGrid(slot);
        }
    }

    /* ── Grid Mode ─────────────────────────────────────────── */

    _renderGrid(slot) {
        slot = slot || this.container && this.container.querySelector('#pkm-content-slot');
        if (!slot) return;
        slot.innerHTML = '';

        var self  = this;
        var store = this.store;
        if (!store) return;

        /* Compute filtered notes */
        var notes = this.showArchived ? store.getArchivedNotes() : store.getActiveNotes();

        if (this.activeCategory) {
            notes = store.getNotesByCategoryPrefix(this.activeCategory);
            if (this.showArchived) {
                notes = notes.filter(function (n) { return !!n.isArchived; });
            }
        }

        if (this.searchTerm) {
            notes = store.getNotesBySearch(this.searchTerm);
            if (this.showArchived) {
                notes = notes.filter(function (n) { return !!n.isArchived; });
            }
        }

        var grid = createNoteMasonryGrid({
            notes:           notes,
            activeCategory:  self.activeCategory,
            search:          self.searchTerm,
            onSelect:        function (id) { self._openCanvas(id); },
            onTogglePin:     function (id) { self._dispatch('TOGGLE_PIN_NOTE', id); },
            onDelete:        function (id) { self._onDelete(id); },
            onNewNote:       function () { self._onNewNote(); },
            onCategoryClick: function (path) { self._onCategoryClick(path); },
            onSearch:        function (term) { self._onSearchInput(term); },
        });

        slot.appendChild(grid);
    }

    /* ── Canvas Mode ───────────────────────────────────────── */

    _renderCanvas(slot) {
        slot = slot || this.container && this.container.querySelector('#pkm-content-slot');
        if (!slot) return;
        slot.innerHTML = '';

        var self  = this;
        var store = this.store;
        if (!store) return;

        var note = store.getNoteById(this._canvasNoteId);
        if (!note) {
            /* Note was deleted — fall back to grid */
            this._canvasNoteId = null;
            this._renderGrid(slot);
            return;
        }

        var canvas = createNoteCanvas({
            note:         note,
            categories:   store.getAllCategoryPaths(),
            categoryMeta: CATEGORY_META,
            onSave:       function (patch) {
                self._selfUpdating = true;
                self._dispatch('UPDATE_NOTE', patch);
                self._selfUpdating = false;
            },
            onDelete:     function (id) { self._onDelete(id); },
            onBack:       function () { self._closeCanvas(); },
            onTogglePin:  function (id) { self._dispatch('TOGGLE_PIN_NOTE', id); },
            onToggleFav:  function (id) { self._dispatch('TOGGLE_FAVORITE_NOTE', id); },
            onArchive:    function (id) {
                self._dispatch('ARCHIVE_NOTE', id);
                self._closeCanvas();
            },
            onRestore:    function (id) {
                self._dispatch('RESTORE_NOTE', id);
                self._closeCanvas();
            },
        });

        this._canvasEl = canvas;
        slot.appendChild(canvas);
    }

    /* ================================================================
       STATS PILL
       ================================================================ */

    _renderStats() {
        var pill = this.container && this.container.querySelector('.notes-count-pill');
        if (!pill || !this.store) return;
        var stats = this.store.getStats();
        pill.textContent = stats.totalNotes + ' notes \u00B7 ' + stats.totalLinks + ' links';
    }

    /* ================================================================
       USER ACTIONS
       ================================================================ */

    _openCanvas(id) {
        /* Flush any pending auto-save from previous canvas */
        if (this._canvasEl && this._canvasEl._canvasFlush) {
            this._canvasEl._canvasFlush();
        }
        this._canvasNoteId = id;
        this._renderContent();
    }

    _closeCanvas() {
        /* Flush pending auto-save */
        if (this._canvasEl && this._canvasEl._canvasFlush) {
            this._canvasEl._canvasFlush();
        }
        this._canvasNoteId = null;
        this._canvasEl = null;
        this._renderContent();
    }

    _onSearchInput(term) {
        var self = this;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(function () {
            self.searchTerm = term;
            self._renderContent();
            self._refocusSearch();
        }, 150);
    }

    _refocusSearch() {
        var input = this.container && this.container.querySelector('.pkm-masonry-search');
        if (input) {
            input.focus();
            var len = input.value.length;
            input.setSelectionRange(len, len);
        }
    }

    _isSearchFocused() {
        var input = this.container && this.container.querySelector('.pkm-masonry-search');
        return document.activeElement === input;
    }

    _onCategoryClick(path) {
        this.activeCategory = path;
        this._renderContent();
    }

    _onNewNote() {
        var self = this;
        if (!this.store) return;

        /* Flush any open canvas */
        if (this._canvasEl && this._canvasEl._canvasFlush) {
            this._canvasEl._canvasFlush();
        }

        /* Determine default category from active filter */
        var defaultCategory = 'other';
        if (this.activeCategory) {
            var parts = this.activeCategory.split('/');
            defaultCategory = parts[parts.length - 1];
        }

        this.store.dispatch({
            type: 'ADD_NOTE',
            payload: {
                title:    '',
                content:  '',
                category: defaultCategory,
                tags:     [],
            },
        }).then(function (saved) {
            if (saved && saved.id) {
                self._openCanvas(saved.id);
            }
        });
    }

    _onDelete(id) {
        var self = this;
        if (confirm('Delete this note?')) {
            this.store.dispatch({ type: 'DELETE_NOTE', payload: id }).then(function () {
                /* If we were editing this note, go back to grid */
                if (self._canvasNoteId === id) {
                    self._closeCanvas();
                }
            });
        }
    }

    _toggleArchived() {
        this.showArchived = !this.showArchived;

        /* If we're in canvas mode, go back to grid */
        if (this._canvasNoteId) {
            this._closeCanvas();
        }

        /* Re-render archive toggle button */
        var archiveBtn = this.container && this.container.querySelector('header button:last-child');
        if (archiveBtn) {
            archiveBtn.className = this._archiveBtnCls();
            archiveBtn.textContent = this.showArchived ? 'Hide Archived' : 'Archived';
        }

        this._renderContent();
        this._renderStats();
    }

    _archiveBtnCls() {
        return [
            'px-2.5 py-1 rounded-lg text-[11px] font-medium',
            'border border-white/[0.05]',
            'transition-all duration-150',
            this.showArchived
                ? 'bg-status-warning/10 text-status-warning border-status-warning/20'
                : 'text-text-tertiary hover:text-text-secondary hover:border-white/[0.1]',
        ].join(' ');
    }

    _dispatch(type, payload) {
        if (this.store) {
            this.store.dispatch({ type: type, payload: payload });
        }
    }

    /* ================================================================
       EVENT BINDING
       ================================================================ */

    _bindEvents() {
        if (!this.store) return;
        var bus  = this.store.eventBus;
        var self = this;

        var onKnowledgeChanged = function () {
            if (self._selfUpdating) return;

            /* If in canvas mode, re-render canvas with fresh data */
            if (self._canvasNoteId) {
                var currentNote = self.store.getNoteById(self._canvasNoteId);
                if (!currentNote) {
                    /* Note was deleted externally */
                    self._closeCanvas();
                    return;
                }
                /* Don't re-render canvas while user is typing — the auto-save handles that */
            }

            self._renderStats();

            /* Re-render grid if we're in grid mode */
            if (!self._canvasNoteId) {
                self._renderContent();
            }
        };

        var onValidationError = function (errors) {
            console.warn('[PKM] Validation:', errors);
        };

        bus.subscribe('knowledge:changed', onKnowledgeChanged);
        bus.subscribe('knowledge:validation-error', onValidationError);

        this._unsubs.push(
            function () { bus.unsubscribe('knowledge:changed', onKnowledgeChanged); },
            function () { bus.unsubscribe('knowledge:validation-error', onValidationError); }
        );
    }
}

export default PKMView;
