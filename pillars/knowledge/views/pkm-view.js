/**
 * Life OS — PKM View (Main Wrapper)
 *
 * Top-level view for the Knowledge / PKM pillar.
 * Two-panel layout: sidebar (note-list) + editor (note-editor).
 *
 * Lifecycle:
 *   render()  → builds the shell (header, two-panel content slot)
 *   mount()   → hydrates store, binds events, renders layout
 *   unmount() → unsubscribes all listeners, cleans up
 *
 * Design constraints:
 *   - Two-panel sidebar+editor layout (NOT tab-based)
 *   - Uses accent-knowledge color (#c084fc)
 *   - Filter/sort state lives on the class (survives event-driven re-renders)
 *   - Every button wired to dispatch() → gateway
 *   - Single re-render trigger: 'knowledge:changed'
 *   - Sidebar + editor re-render independently (no full-panel teardown)
 */

'use strict';

import { KnowledgeStore } from '../state/knowledge-store.js';
import { KnowledgeGateway } from '../../../persistence/gateways/knowledge-gateway.js';
import { createNoteList } from '../components/note-list.js';
import { createNoteEditor } from '../components/note-editor.js';
import { CATEGORY_META } from '../domain/knowledge-rules.js';

export class PKMView {
    constructor() {
        this.container  = null;
        this.store      = null;
        this._unsubs    = [];

        /* ── View-local UI state ── */
        this.selectedNoteId = null;
        this.searchTerm     = '';
        this.activeCategory = null;    /* null = All Notes */
        this.showArchived   = false;
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

        /* Header — compact, sits above the panels */
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
        archiveBtn.className = [
            'px-2.5 py-1 rounded-lg text-[11px] font-medium',
            'border border-white/[0.05]',
            'transition-all duration-150',
            this.showArchived
                ? 'bg-status-warning/10 text-status-warning border-status-warning/20'
                : 'text-text-tertiary hover:text-text-secondary hover:border-white/[0.1]',
        ].join(' ');
        archiveBtn.textContent = this.showArchived ? 'Hide Archived' : 'Archived';
        archiveBtn.addEventListener('click', this._toggleArchived.bind(this));
        headerActions.appendChild(archiveBtn);

        header.appendChild(titleGroup);
        header.appendChild(headerActions);
        main.appendChild(header);

        /* Two-panel body */
        var panels = document.createElement('div');
        panels.className = 'flex flex-1 min-h-0';

        /* Sidebar slot */
        var sidebarSlot = document.createElement('div');
        sidebarSlot.id = 'pkm-sidebar';
        sidebarSlot.className = 'flex-shrink-0 w-[280px] border-r border-white/[0.04]';
        panels.appendChild(sidebarSlot);

        /* Editor slot */
        var editorSlot = document.createElement('div');
        editorSlot.id = 'pkm-editor';
        editorSlot.className = 'flex-1 min-w-0';
        panels.appendChild(editorSlot);

        main.appendChild(panels);
        fragment.appendChild(gradient);
        fragment.appendChild(main);

        return fragment;
    }

    async mount(container) {
        this.container = container;

        /* Initialise persistence + state for this pillar */
        var db = window.__lifeOS && window.__lifeOS.database;
        if (db) {
            var gateway = new KnowledgeGateway(db);
            this.store  = new KnowledgeStore(window.__lifeOS.eventBus, gateway);
            await this.store.hydrate();
        }

        this._renderSidebar();
        this._renderEditor();
        this._renderStats();
        this._bindEvents();
    }

    unmount() {
        for (var i = 0; i < this._unsubs.length; i++) {
            this._unsubs[i]();
        }
        this._unsubs = [];
        this.container  = null;
        this.store      = null;
        this.selectedNoteId = null;
    }

    /* ================================================================
       SIDEBAR
       ================================================================ */

    _renderSidebar() {
        var slot = this.container && this.container.querySelector('#pkm-sidebar');
        if (!slot) return;
        slot.innerHTML = '';

        var self   = this;
        var store  = this.store;
        if (!store) return;

        /* Compute filtered notes list */
        var notes = this.showArchived ? store.getArchivedNotes() : store.getActiveNotes();

        if (this.activeCategory) {
            notes = store.getNotesByCategoryPrefix(this.activeCategory);
            if (this.showArchived) {
                /* Filter to only archived within category */
                notes = notes.filter(function (n) { return !!n.isArchived; });
            }
        }

        if (this.searchTerm) {
            notes = store.getNotesBySearch(this.searchTerm);
            if (this.showArchived) {
                notes = notes.filter(function (n) { return !!n.isArchived; });
            }
        }

        var tree = store.getCategoryTree();

        var sidebar = createNoteList({
            notes:           notes,
            categories:      tree,
            activeNoteId:    self.selectedNoteId,
            activeCategory:  self.activeCategory,
            search:          self.searchTerm,
            onSelect:        function (id) { self._selectNote(id); },
            onSearch:        function (term) { self._onSearch(term); },
            onCategoryClick: function (path) { self._onCategoryClick(path); },
            onNewNote:       function () { self._onNewNote(); },
            onTogglePin:     function (id) { self._dispatch('TOGGLE_PIN_NOTE', id); },
        });

        slot.appendChild(sidebar);
    }

    /* ================================================================
       EDITOR
       ================================================================ */

    _renderEditor() {
        var slot = this.container && this.container.querySelector('#pkm-editor');
        if (!slot) return;
        slot.innerHTML = '';

        var self  = this;
        var store = this.store;
        if (!store) return;

        var note = self.selectedNoteId ? store.getNoteById(self.selectedNoteId) : null;

        var editor = createNoteEditor({
            note:         note,
            categories:   store.getAllCategoryPaths(),
            categoryMeta: CATEGORY_META,
            onSave:       function (patch) { self._dispatch('UPDATE_NOTE', patch); },
            onPin:        function (id)    { self._dispatch('TOGGLE_PIN_NOTE', id); },
            onFavorite:   function (id)    { self._dispatch('TOGGLE_FAVORITE_NOTE', id); },
            onArchive:    function (id)    { self._dispatch('ARCHIVE_NOTE', id); },
            onRestore:    function (id)    { self._dispatch('RESTORE_NOTE', id); },
            onDelete:     function (id)    { self._onDelete(id); },
        });

        slot.appendChild(editor);
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

    _selectNote(id) {
        this.selectedNoteId = id;
        this._renderSidebar();
        this._renderEditor();
    }

    _onSearch(term) {
        this.searchTerm = term;
        this._renderSidebar();
    }

    _onCategoryClick(path) {
        this.activeCategory = path;
        this._renderSidebar();
    }

    _onNewNote() {
        var self = this;
        if (!this.store) return;

        /* Determine default category from active filter */
        var defaultCategory = 'other';
        if (this.activeCategory) {
            /* Use the leaf of the selected path */
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
                self._selectNote(saved.id);
                /* Focus the title input after render */
                setTimeout(function () {
                    var titleInput = self.container && self.container.querySelector('#pkm-editor input[type="text"]');
                    if (titleInput) titleInput.focus();
                }, 50);
            }
        });
    }

    _onDelete(id) {
        var self = this;
        if (confirm('Delete this note?')) {
            this.store.dispatch({ type: 'DELETE_NOTE', payload: id }).then(function () {
                if (self.selectedNoteId === id) {
                    self.selectedNoteId = null;
                    self._renderEditor();
                }
            });
        }
    }

    _toggleArchived() {
        this.showArchived = !this.showArchived;
        this.selectedNoteId = null;

        /* Re-render archive toggle button */
        var archiveBtn = this.container && this.container.querySelector('header button:last-child');
        if (archiveBtn) {
            archiveBtn.className = [
                'px-2.5 py-1 rounded-lg text-[11px] font-medium',
                'border border-white/[0.05]',
                'transition-all duration-150',
                this.showArchived
                    ? 'bg-status-warning/10 text-status-warning border-status-warning/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:border-white/[0.1]',
            ].join(' ');
            archiveBtn.textContent = this.showArchived ? 'Hide Archived' : 'Archived';
        }

        this._renderSidebar();
        this._renderEditor();
        this._renderStats();
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
            /* Sidebar always re-renders on data change.
               Editor only re-renders if the active note was modified
               or if the note list changed shape (new/deleted note). */
            var sidebarChanged = true;
            var editorChanged  = false;

            if (self.selectedNoteId) {
                var currentNote = self.store.getNoteById(self.selectedNoteId);
                editorChanged = !currentNote || currentNote.isArchived !== self.showArchived;
            } else {
                editorChanged = true;
            }

            if (sidebarChanged) self._renderSidebar();
            if (editorChanged)  self._renderEditor();
            self._renderStats();
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
