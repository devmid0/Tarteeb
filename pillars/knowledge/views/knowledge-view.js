/**
 * Life OS — Knowledge View (Main Wrapper)
 *
 * Top-level view for the Knowledge pillar. Manages section
 * switching (Notes / Links), hydration, and the shared
 * knowledge-store instance.
 *
 * Lifecycle:
 *   render()  → builds the shell (header, tabs, content slot)
 *   mount()   → hydrates store, binds events, renders section
 *   unmount() → unsubscribes all listeners, cleans up
 *
 * Design constraints:
 *   - Uses accent-knowledge color (#c084fc)
 *   - Filter/sort state lives on the class (survives event-driven re-renders)
 *   - Every card gets onEdit + onDelete callbacks
 *   - Edit modals wired via note-edit-modal.js / link-edit-modal.js
 *   - Every button wired to dispatch() → gateway
 *   - Single re-render trigger: 'knowledge:changed'
 */

'use strict';

import { KnowledgeStore } from '../state/knowledge-store.js';
import { KnowledgeGateway } from '../../../persistence/gateways/knowledge-gateway.js';
import { createKnowledgeSummary } from '../components/knowledge-summary.js';
import { createNoteForm } from '../components/note-form.js';
import { createLinkForm } from '../components/link-form.js';
import { createNoteCard } from '../components/note-card.js';
import { createLinkCard } from '../components/link-card.js';
import { openNoteEditModal } from '../components/note-edit-modal.js';
import { openLinkEditModal } from '../components/link-edit-modal.js';
import { createKnowledgeFilterBar } from '../components/knowledge-filters.js';
import { sortByPinnedThenCreated, sortByCreated, sortByTitle, selectByCategory, selectBySearch, summarizeTags } from '../domain/knowledge-rules.js';

var SECTIONS = [
    { id: 'notes', label: 'Notes', description: 'Written notes and documents' },
    { id: 'links', label: 'Links', description: 'Saved bookmarks and resources' },
];

export class KnowledgeView {
    constructor() {
        this.container = null;
        this.store = null;
        this.currentSection = 'notes';
        this._unsubs = [];

        /* Stable filter/sort state — survives event-driven re-renders */
        this._noteFilter = 'all';
        this._noteSort   = 'recent';
        this._linkSearch = '';
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render(section) {
        this.currentSection = section || 'notes';

        var fragment = document.createDocumentFragment();

        /* ── Ambient gradient ── */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background = 'radial-gradient(ellipse at 20% 15%, rgba(192,132,252,0.04) 0%, transparent 60%)';

        /* ── Main scrollable container ── */
        var main = document.createElement('div');
        main.className = 'relative h-full p-6 md:p-8 max-w-4xl mx-auto';

        /* ── Header ── */
        var header = document.createElement('header');
        header.className = 'mb-6';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
                '<h1 class="text-[28px] font-heading font-semibold text-text-primary tracking-tight leading-none">' +
                    'Knowledge' +
                '</h1>' +
                '<span class="text-[12px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
                '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-1">Capture and organize your thoughts.</p>';

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
                return function () { window.location.hash = '/knowledge/' + secId; };
            })(sec.id));
            tabs.appendChild(tab);
        }

        /* ── Content slot (filled on mount) ── */
        var contentSlot = document.createElement('div');
        contentSlot.id = 'knowledge-content-slot';
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
            var gateway = new KnowledgeGateway(db);
            this.store = new KnowledgeStore(window.__lifeOS.eventBus, gateway);
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
        this.store = null;
    }

    /* ── Shared Card Callbacks ───────────────────────────── */

    _noteCallbacks() {
        var store = this.store;
        return {
            onEdit: function (id) {
                var note = store.getNoteById(id);
                if (!note) return;
                openNoteEditModal(note,
                    function (patch) { store.dispatch({ type: 'UPDATE_NOTE', payload: patch }); },
                    function (noteId) { store.dispatch({ type: 'DELETE_NOTE', payload: noteId }); }
                );
            },
            onDelete: function (id) {
                if (confirm('Delete this note?')) {
                    store.dispatch({ type: 'DELETE_NOTE', payload: id });
                }
            },
            onTogglePin: function (id) {
                store.dispatch({ type: 'TOGGLE_PIN_NOTE', payload: id });
            },
        };
    }

    _linkCallbacks() {
        var store = this.store;
        return {
            onEdit: function (id) {
                var link = store.getLinkById(id);
                if (!link) return;
                openLinkEditModal(link,
                    function (patch) { store.dispatch({ type: 'UPDATE_LINK', payload: patch }); },
                    function (linkId) { store.dispatch({ type: 'DELETE_LINK', payload: linkId }); }
                );
            },
            onDelete: function (id) {
                if (confirm('Delete this link?')) {
                    store.dispatch({ type: 'DELETE_LINK', payload: id });
                }
            },
        };
    }

    /* ── Section Rendering ────────────────────────────────── */

    _renderSection() {
        var slot = this.container && this.container.querySelector('#knowledge-content-slot');
        if (!slot) return;

        slot.innerHTML = '';
        slot.className = 'animate-entrance';

        switch (this.currentSection) {
            case 'notes':
                this._renderNotesSection(slot);
                break;
            case 'links':
                this._renderLinksSection(slot);
                break;
            default:
                this._renderNotesSection(slot);
        }
    }

    /* ── Notes Section ────────────────────────────────────── */

    _renderNotesSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading notes\u2026</div>';
            return;
        }

        var self = this;
        var cbs = this._noteCallbacks();

        /* Summary stats */
        slot.appendChild(createKnowledgeSummary({
            notes: store.notes,
            links: store.links,
        }));

        /* Inline form */
        slot.appendChild(createNoteForm({
            onSubmit: function (data) {
                store.dispatch({ type: 'ADD_NOTE', payload: data });
            },
        }));

        /* Filter/sort state — uses class-level fields (stable across re-renders) */
        var renderList = function () {
            var existing = slot.querySelector('.note-list-container');
            if (existing) existing.remove();

            var notes = store.getAllNotes();
            var filter = self._noteFilter;
            var sort   = self._noteSort;

            if (filter !== 'all') {
                notes = store.getNotesByCategory(filter);
            }

            if (sort === 'alpha') {
                notes = sortByTitle(notes);
            }
            /* 'recent' is default sort from store.getAllNotes() */

            var container = document.createElement('div');
            container.className = 'note-list-container';

            if (notes.length === 0) {
                container.innerHTML =
                    '<div class="text-center py-16">' +
                        '<div class="text-4xl mb-3 opacity-20">\uD83D\uDCDD</div>' +
                        '<p class="text-[14px] text-text-secondary font-medium">No notes yet</p>' +
                        '<p class="text-[12px] text-text-tertiary mt-1">Create your first note above to get started.</p>' +
                    '</div>';
            } else {
                var list = document.createElement('div');
                list.className = 'space-y-1';

                for (var i = 0; i < notes.length; i++) {
                    list.appendChild(createNoteCard(notes[i], cbs));
                }
                container.appendChild(list);
            }

            slot.appendChild(container);
        };

        /* Filter bar — recreated on each renderList() with current state */
        var renderFilterBar = function () {
            var old = slot.querySelector('.note-filter-bar');
            if (old) old.remove();

            var allTags = store.getAllTags();
            var tagKeys = Object.keys(allTags);

            var bar = createKnowledgeFilterBar({
                activeFilter: self._noteFilter,
                activeSort:   self._noteSort,
                allTags:      tagKeys,
                onFilterChange: function (f) {
                    self._noteFilter = f;
                    renderList();
                    renderFilterBar();
                },
                onSortChange: function (s) {
                    self._noteSort = s;
                    renderList();
                    renderFilterBar();
                },
            });
            bar.classList.add('note-filter-bar');
            slot.insertBefore(bar, slot.querySelector('.note-list-container'));
        };

        renderFilterBar();
        renderList();
    }

    /* ── Links Section ───────────────────────────────────── */

    _renderLinksSection(slot) {
        var store = this.store;
        if (!store) {
            slot.innerHTML = '<div class="text-center py-20 text-text-tertiary text-[13px]">Loading links\u2026</div>';
            return;
        }

        var self = this;
        var cbs = this._linkCallbacks();

        /* Link summary — a compact hero card */
        var linkCount = store.links.length;
        var tagSummary = summarizeTags(store.links);
        var tagCount = Object.keys(tagSummary).length;

        var summaryCard = document.createElement('div');
        summaryCard.className = [
            'relative overflow-hidden rounded-2xl mb-4',
            'bg-gradient-to-br from-accent-finance/8 via-surface-raised/80 to-surface-raised/40',
            'border border-accent-finance/10',
            'px-6 py-4',
        ].join(' ');
        summaryCard.innerHTML =
            '<div class="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-accent-finance/[0.05] blur-3xl pointer-events-none"></div>' +
            '<div class="relative flex items-center justify-between">' +
                '<div>' +
                    '<div class="text-[11px] font-semibold text-accent-finance/70 uppercase tracking-widest mb-0.5">Saved Links</div>' +
                    '<div class="text-[24px] font-heading font-bold text-text-primary leading-none tabular-nums">' +
                        linkCount +
                        '<span class="text-[13px] font-medium text-text-tertiary ml-1">' + (linkCount === 1 ? 'link' : 'links') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="text-right">' +
                    '<div class="text-[11px] text-text-tertiary">' + tagCount + ' unique tags</div>' +
                '</div>' +
            '</div>';
        slot.appendChild(summaryCard);

        /* Inline form */
        slot.appendChild(createLinkForm({
            onSubmit: function (data) {
                store.dispatch({ type: 'ADD_LINK', payload: data });
            },
        }));

        /* Link list */
        var renderList = function () {
            var existing = slot.querySelector('.link-list-container');
            if (existing) existing.remove();

            var links = store.getAllLinks();
            var searchTerm = self._linkSearch;

            if (searchTerm) {
                links = store.getLinksBySearch(searchTerm);
            }

            var container = document.createElement('div');
            container.className = 'link-list-container';

            if (links.length === 0) {
                container.innerHTML =
                    '<div class="text-center py-16">' +
                        '<div class="text-4xl mb-3 opacity-20">\uD83C\uDF10</div>' +
                        '<p class="text-[14px] text-text-secondary font-medium">No saved links</p>' +
                        '<p class="text-[12px] text-text-tertiary mt-1">Save your first link above to get started.</p>' +
                    '</div>';
            } else {
                var list = document.createElement('div');
                list.className = 'space-y-1';

                for (var i = 0; i < links.length; i++) {
                    list.appendChild(createLinkCard(links[i], cbs));
                }
                container.appendChild(list);
            }

            slot.appendChild(container);
        };

        /* Search bar for links */
        var renderSearchBar = function () {
            var old = slot.querySelector('.link-search-bar');
            if (old) old.remove();

            var bar = document.createElement('div');
            bar.className = 'link-search-bar flex items-center gap-2 mb-4';

            var searchWrap = document.createElement('div');
            searchWrap.className = 'relative flex-1';

            searchWrap.innerHTML =
                '<svg viewBox="0 0 16 16" fill="currentColor" class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-disabled pointer-events-none">' +
                    '<path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.44.856a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/>' +
                '</svg>' +
                '<input type="text"' +
                       ' class="link-search-input w-full bg-surface-raised/40 text-[13px] text-text-secondary' +
                              ' pl-9 pr-3 py-2.5 rounded-xl border border-white/[0.06]' +
                              ' hover:border-white/[0.1] focus:outline-none' +
                              ' focus:border-accent-finance/40 transition-colors duration-150' +
                              ' placeholder:text-text-disabled/50"' +
                       ' placeholder="Search links\u2026"' +
                       ' value="' + (self._linkSearch || '') + '">';

            bar.appendChild(searchWrap);
            slot.insertBefore(bar, slot.querySelector('.link-list-container'));

            /* Wire search input */
            var input = bar.querySelector('.link-search-input');
            var debounceTimer = null;
            input.addEventListener('input', function () {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function () {
                    self._linkSearch = input.value.trim();
                    renderList();
                }, 200);
            });
        };

        renderSearchBar();
        renderList();
    }

    /* ── Event Binding ────────────────────────────────────── */

    _bindEvents() {
        if (!this.store) return;
        var bus = this.store.eventBus;
        var self = this;

        var refresh = function () { self._renderSection(); };

        /* Single subscription to the aggregate change event.
           The store publishes 'knowledge:changed' after every mutation,
           so individual event subscriptions are unnecessary and
           would cause duplicate re-renders. */
        bus.subscribe('knowledge:changed', refresh);
        bus.subscribe('knowledge:validation-error', function (errors) {
            console.warn('[Knowledge] Validation:', errors);
        });

        this._unsubs.push(
            function () { bus.unsubscribe('knowledge:changed', refresh); },
            function () {
                bus.unsubscribe('knowledge:validation-error', function (errors) {
                    console.warn('[Knowledge] Validation:', errors);
                });
            }
        );
    }
}

export default KnowledgeView;
