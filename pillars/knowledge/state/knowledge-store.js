/**
 * Life OS — PKM State Store
 *
 * Unidirectional data flow within the Knowledge (PKM) pillar:
 *
 *   View ──dispatch(action)──▶ KnowledgeStore ──publish──▶ EventBus
 *              │                                          │
 *              ▼                                          ▼
 *        gateway.create()                       View re-renders
 *        gateway.update()
 *        gateway.delete()
 *
 * Invariants:
 *   - State mutations ONLY via dispatch() — never direct assignment.
 *   - Every mutation publishes 'knowledge:changed' with a full state
 *     snapshot.  This is the SINGLE re-render trigger for views.
 *   - Gateway writes are optimistic: local state mutates immediately,
 *     then the gateway write fires async.  On failure the store
 *     rolls back to the previous snapshot and publishes
 *     'knowledge:rollback'.
 *   - Selectors are pure derivations of the in-memory arrays.
 *     They never mutate state.
 *   - The store owns tag normalization and word-count computation
 *     so the gateway stays thin.
 *
 * Note document shape:
 *   { id, title, content, category, tags[], isPinned, isArchived,
 *     isFavorited, wordCount, charCount, createdAt, updatedAt }
 *
 * Link document shape:
 *   { id, url, title, description, favicon, tags[],
 *     createdAt, updatedAt }
 */

'use strict';

import {
    createNoteData,
    createLinkData,
    validateNote,
    validateLink,
    normalizeTags,
    sortByCreated,
    sortByPinnedThenCreated,
    sortByTitle,
    sortByUpdated,
    selectByCategory,
    selectByTag,
    selectByAnyTag,
    selectBySearch,
    selectRecent,
    summarizeByCategory,
    summarizeTags,
} from '../domain/knowledge-rules.js';

/* ── Helpers ──────────────────────────────────────────────── */

/**
 * Count words in a string (whitespace-delimited).
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    var trimmed = text.trim();
    if (trimmed.length === 0) return 0;
    return trimmed.split(/\s+/).length;
}

/**
 * Count characters in a string.
 * @param {string} text
 * @returns {number}
 */
function countChars(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.length;
}

/* ── Store ────────────────────────────────────────────────── */

export class KnowledgeStore {
    /**
     * @param {import('../../../core/events/event-bus.js').EventBus} eventBus
     * @param {import('../../../persistence/gateways/knowledge-gateway.js').KnowledgeGateway} knowledgeGateway
     */
    constructor(eventBus, knowledgeGateway) {
        this.eventBus = eventBus;
        this.gateway  = knowledgeGateway;

        /* ── Core state ── */
        this.notes = [];
        this.links = [];
        this.loading = false;
        this.error   = null;

        /* ── Derived cache (invalidated on every mutation) ── */
        this._categoryTree = null;
        this._allTags      = null;
    }

    /* ================================================================
       HYDRATION
       ================================================================ */

    /**
     * Load all notes and links from IndexedDB into memory.
     * Publishes: knowledge:loading, knowledge:hydrated (or knowledge:error)
     */
    async hydrate() {
        this.loading = true;
        this.eventBus.publish('knowledge:loading', true);

        try {
            var results = await Promise.all([
                this.gateway.getAllNotes(),
                this.gateway.getAllLinks(),
            ]);
            this.notes = results[0];
            this.links = results[1];
            this.error = null;
            this._invalidateCache();
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('knowledge:error', err.message);
        } finally {
            this.loading = false;
            this.eventBus.publish('knowledge:loading', false);
            this.eventBus.publish('knowledge:hydrated', this.getStateSnapshot());
        }
    }

    /* ================================================================
       DISPATCH
       ================================================================ */

    /**
     * The single entry point for all state mutations.
     * @param {{ type: string, payload?: any }} action
     * @returns {Promise<any>}
     */
    async dispatch(action) {
        switch (action.type) {
            /* ── Notes ── */
            case 'ADD_NOTE':              return this._addNote(action.payload);
            case 'UPDATE_NOTE':           return this._updateNote(action.payload);
            case 'DELETE_NOTE':           return this._deleteNote(action.payload);
            case 'TOGGLE_PIN_NOTE':       return this._toggleBoolean(action.payload, 'isPinned');
            case 'TOGGLE_FAVORITE_NOTE':  return this._toggleBoolean(action.payload, 'isFavorited');
            case 'ARCHIVE_NOTE':          return this._setArchive(action.payload, true);
            case 'RESTORE_NOTE':          return this._setArchive(action.payload, false);
            case 'DUPLICATE_NOTE':        return this._duplicateNote(action.payload);

            /* ── Links ── */
            case 'ADD_LINK':              return this._addLink(action.payload);
            case 'UPDATE_LINK':           return this._updateLink(action.payload);
            case 'DELETE_LINK':           return this._deleteLink(action.payload);

            /* ── Bulk ── */
            case 'IMPORT_NOTES':          return this._importNotes(action.payload);
            case 'IMPORT_LINKS':          return this._importLinks(action.payload);

            default:
                console.warn('[KnowledgeStore] Unknown action:', action.type);
                return null;
        }
    }

    /* ================================================================
       NOTE MUTATORS
       ================================================================ */

    async _addNote(raw) {
        var now = new Date().toISOString();
        var data = createNoteData(raw);
        data.tags = normalizeTags(data.tags);
        data.wordCount = countWords(data.content);
        data.charCount = countChars(data.content);
        data.createdAt = now;
        data.updatedAt = now;

        var validation = validateNote(data);
        if (!validation.valid) {
            this.eventBus.publish('knowledge:validation-error', validation.errors);
            return null;
        }

        try {
            var saved = await this.gateway.createNote(data);
            this.notes = this.notes.concat([saved]);
            this._invalidateCache();
            this.eventBus.publish('knowledge:note-added', saved);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('knowledge:error', err.message);
            return null;
        }
    }

    async _updateNote(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('knowledge:error', 'UPDATE_NOTE requires an id');
            return null;
        }

        var index = this._findNoteIndex(patch.id);
        if (index === -1) {
            this.eventBus.publish('knowledge:error', 'Note ' + patch.id + ' not found');
            return null;
        }

        /* Normalize tags and recompute word count if content changed */
        if (patch.tags) patch.tags = normalizeTags(patch.tags);
        var existing = this.notes[index];
        var mergedContent = patch.content !== undefined ? patch.content : existing.content;
        patch.wordCount = countWords(mergedContent);
        patch.charCount = countChars(mergedContent);
        patch.updatedAt = new Date().toISOString();

        var updated = Object.assign({}, existing, patch);

        /* Optimistic: replace in local array */
        var next = this.notes.slice();
        next[index] = updated;
        this.notes = next;
        this._invalidateCache();

        this.eventBus.publish('knowledge:note-updated', updated);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateNote(updated);
        } catch (err) {
            this._rollbackNote(index, existing);
            this.eventBus.publish('knowledge:error', err.message);
        }

        return updated;
    }

    async _deleteNote(id) {
        var index = this._findNoteIndex(id);
        if (index === -1) return;

        var removed = this.notes[index];
        var next = this.notes.slice();
        next.splice(index, 1);
        this.notes = next;
        this._invalidateCache();

        this.eventBus.publish('knowledge:note-deleted', removed);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteNote(id);
        } catch (err) {
            this.notes.splice(index, 0, removed);
            this._invalidateCache();
            this.eventBus.publish('knowledge:rollback', removed);
            this.eventBus.publish('knowledge:error', err.message);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        }
    }

    /**
     * Generic boolean toggle for note flags (isPinned, isFavorited).
     * @param {number} id
     * @param {string} field — 'isPinned' or 'isFavorited'
     */
    async _toggleBoolean(id, field) {
        var index = this._findNoteIndex(id);
        if (index === -1) return null;

        var existing = this.notes[index];
        var patch = {};
        patch[field] = !existing[field];
        patch.updatedAt = new Date().toISOString();

        var updated = Object.assign({}, existing, patch);
        var next = this.notes.slice();
        next[index] = updated;
        this.notes = next;
        this._invalidateCache();

        this.eventBus.publish('knowledge:note-updated', updated);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateNote(updated);
        } catch (err) {
            this._rollbackNote(index, existing);
            this.eventBus.publish('knowledge:error', err.message);
        }

        return updated;
    }

    /**
     * Set or clear the archive flag on a note.
     * @param {number} id
     * @param {boolean} archived
     */
    async _setArchive(id, archived) {
        var index = this._findNoteIndex(id);
        if (index === -1) return null;

        var existing = this.notes[index];
        if (existing.isArchived === archived) return existing;

        var updated = Object.assign({}, existing, {
            isArchived: archived,
            updatedAt: new Date().toISOString(),
        });

        var next = this.notes.slice();
        next[index] = updated;
        this.notes = next;
        this._invalidateCache();

        this.eventBus.publish('knowledge:note-updated', updated);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateNote(updated);
        } catch (err) {
            this._rollbackNote(index, existing);
            this.eventBus.publish('knowledge:error', err.message);
        }

        return updated;
    }

    /**
     * Deep-clone a note as a new record with fresh timestamps.
     * @param {number} id
     */
    async _duplicateNote(id) {
        var source = this.getNoteById(id);
        if (!source) return null;

        var now = new Date().toISOString();
        var clone = Object.assign({}, source);
        delete clone.id;
        clone.title = source.title + ' (copy)';
        clone.createdAt = now;
        clone.updatedAt = now;

        return this._addNote(clone);
    }

    /* ================================================================
       LINK MUTATORS
       ================================================================ */

    async _addLink(raw) {
        var now = new Date().toISOString();
        var data = createLinkData(raw);
        data.tags = normalizeTags(data.tags);
        data.createdAt = now;
        data.updatedAt = now;

        var validation = validateLink(data);
        if (!validation.valid) {
            this.eventBus.publish('knowledge:validation-error', validation.errors);
            return null;
        }

        try {
            var saved = await this.gateway.createLink(data);
            this.links = this.links.concat([saved]);
            this._invalidateCache();
            this.eventBus.publish('knowledge:link-added', saved);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('knowledge:error', err.message);
            return null;
        }
    }

    async _updateLink(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('knowledge:error', 'UPDATE_LINK requires an id');
            return null;
        }

        var index = this._findLinkIndex(patch.id);
        if (index === -1) {
            this.eventBus.publish('knowledge:error', 'Link ' + patch.id + ' not found');
            return null;
        }

        if (patch.tags) patch.tags = normalizeTags(patch.tags);
        patch.updatedAt = new Date().toISOString();

        var existing = this.links[index];
        var updated  = Object.assign({}, existing, patch);

        var next = this.links.slice();
        next[index] = updated;
        this.links = next;
        this._invalidateCache();

        this.eventBus.publish('knowledge:link-updated', updated);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateLink(updated);
        } catch (err) {
            this._rollbackLink(index, existing);
            this.eventBus.publish('knowledge:error', err.message);
        }

        return updated;
    }

    async _deleteLink(id) {
        var index = this._findLinkIndex(id);
        if (index === -1) return;

        var removed = this.links[index];
        var next = this.links.slice();
        next.splice(index, 1);
        this.links = next;
        this._invalidateCache();

        this.eventBus.publish('knowledge:link-deleted', removed);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteLink(id);
        } catch (err) {
            this.links.splice(index, 0, removed);
            this._invalidateCache();
            this.eventBus.publish('knowledge:rollback', removed);
            this.eventBus.publish('knowledge:error', err.message);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        }
    }

    /* ================================================================
       BULK MUTATORS
       ================================================================ */

    async _importNotes(notesArray) {
        if (!Array.isArray(notesArray)) return;
        try {
            await this.gateway.replaceAllNotes(notesArray);
            this.notes = await this.gateway.getAllNotes();
            this._invalidateCache();
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('knowledge:error', err.message);
        }
    }

    async _importLinks(linksArray) {
        if (!Array.isArray(linksArray)) return;
        try {
            await this.gateway.replaceAllLinks(linksArray);
            this.links = await this.gateway.getAllLinks();
            this._invalidateCache();
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('knowledge:error', err.message);
        }
    }

    /* ================================================================
       SELECTORS — Pure derivations of in-memory state
       ================================================================ */

    /**
     * Full state snapshot for the single re-render trigger.
     */
    getStateSnapshot() {
        return {
            notes:        this.notes,
            links:        this.links,
            loading:      this.loading,
            error:        this.error,
            activeNotes:  this.notes.filter(function (n) { return !n.isArchived; }),
            archivedNotes: this.notes.filter(function (n) { return !!n.isArchived; }),
            noteCount:    this.notes.length,
            linkCount:    this.links.length,
        };
    }

    /* ── Note selectors ── */

    /**
     * All notes: pinned first, then by creation date descending.
     * Excludes archived notes.
     */
    getActiveNotes() {
        var active = this.notes.filter(function (n) { return !n.isArchived; });
        return sortByPinnedThenCreated(active);
    }

    /**
     * All notes including archived, pinned first.
     */
    getAllNotes() {
        return sortByPinnedThenCreated(this.notes);
    }

    /**
     * Only archived notes.
     */
    getArchivedNotes() {
        var archived = this.notes.filter(function (n) { return !!n.isArchived; });
        return sortByUpdated(archived);
    }

    /**
     * Only favorited notes, pinned first.
     */
    getFavoritedNotes() {
        var favs = this.notes.filter(function (n) { return !!n.isFavorited && !n.isArchived; });
        return sortByPinnedThenCreated(favs);
    }

    /**
     * Only pinned notes (active only).
     */
    getPinnedNotes() {
        var pinned = this.notes.filter(function (n) { return !!n.isPinned && !n.isArchived; });
        return sortByCreated(pinned);
    }

    /**
     * Notes filtered by exact category path.
     */
    getNotesByCategory(category) {
        var filtered = this.notes.filter(function (n) {
            return !n.isArchived && n.category === category;
        });
        return sortByPinnedThenCreated(filtered);
    }

    /**
     * Notes whose category STARTS with the given prefix.
     * This enables hierarchical category subtree queries.
     * e.g. getNotesByCategoryPrefix('programming') returns
     *      notes in "programming", "programming/javascript", etc.
     */
    getNotesByCategoryPrefix(prefix) {
        if (!prefix) return this.getActiveNotes();
        var lowerPrefix = prefix.toLowerCase();
        var filtered = this.notes.filter(function (n) {
            if (n.isArchived) return false;
            if (!n.category) return false;
            var cat = n.category.toLowerCase();
            return cat === lowerPrefix || cat.indexOf(lowerPrefix + '/') === 0;
        });
        return sortByPinnedThenCreated(filtered);
    }

    /**
     * Notes matching a specific tag.
     */
    getNotesByTag(tag) {
        var filtered = this.notes.filter(function (n) {
            return !n.isArchived && Array.isArray(n.tags) && n.tags.indexOf(tag.toLowerCase().trim()) !== -1;
        });
        return sortByPinnedThenCreated(filtered);
    }

    /**
     * Notes matching ANY of the given tags.
     */
    getNotesByAnyTag(tags) {
        if (!tags || tags.length === 0) return this.getActiveNotes();
        var lowerTags = tags.map(function (t) { return t.toLowerCase().trim(); });
        var filtered = this.notes.filter(function (n) {
            if (n.isArchived) return false;
            if (!Array.isArray(n.tags)) return false;
            for (var i = 0; i < lowerTags.length; i++) {
                if (n.tags.indexOf(lowerTags[i]) !== -1) return true;
            }
            return false;
        });
        return sortByPinnedThenCreated(filtered);
    }

    /**
     * Full-text search across title, content, category, and tags.
     * Case-insensitive substring match.
     */
    getNotesBySearch(term) {
        if (!term || term.trim().length === 0) return this.getActiveNotes();
        var lower = term.toLowerCase().trim();
        var filtered = this.notes.filter(function (n) {
            if (n.isArchived) return false;
            if (n.title && n.title.toLowerCase().indexOf(lower) !== -1) return true;
            if (n.content && n.content.toLowerCase().indexOf(lower) !== -1) return true;
            if (n.category && n.category.toLowerCase().indexOf(lower) !== -1) return true;
            if (Array.isArray(n.tags)) {
                for (var i = 0; i < n.tags.length; i++) {
                    if (n.tags[i].indexOf(lower) !== -1) return true;
                }
            }
            return false;
        });
        return sortByPinnedThenCreated(filtered);
    }

    /**
     * Most recently updated N notes (active only).
     */
    getRecentlyUpdated(count) {
        count = count || 5;
        return sortByUpdated(this.getActiveNotes()).slice(0, count);
    }

    /**
     * Most recently created N notes (active only).
     */
    getRecentNotes(count) {
        count = count || 5;
        return sortByCreated(this.getActiveNotes()).slice(0, count);
    }

    /**
     * Single note by id.
     */
    getNoteById(id) {
        for (var i = 0; i < this.notes.length; i++) {
            if (this.notes[i].id === id) return this.notes[i];
        }
        return null;
    }

    /* ── Link selectors ── */

    /**
     * All links sorted by creation date descending.
     */
    getAllLinks() {
        return sortByCreated(this.links);
    }

    /**
     * Links matching a full-text search across url, title, description, tags.
     */
    getLinksBySearch(term) {
        if (!term || term.trim().length === 0) return this.getAllLinks();
        var lower = term.toLowerCase().trim();
        var filtered = this.links.filter(function (l) {
            if (l.url && l.url.toLowerCase().indexOf(lower) !== -1) return true;
            if (l.title && l.title.toLowerCase().indexOf(lower) !== -1) return true;
            if (l.description && l.description.toLowerCase().indexOf(lower) !== -1) return true;
            if (Array.isArray(l.tags)) {
                for (var i = 0; i < l.tags.length; i++) {
                    if (l.tags[i].indexOf(lower) !== -1) return true;
                }
            }
            return false;
        });
        return sortByCreated(filtered);
    }

    /**
     * Links matching a specific tag.
     */
    getLinksByTag(tag) {
        var lower = tag.toLowerCase().trim();
        var filtered = this.links.filter(function (l) {
            return Array.isArray(l.tags) && l.tags.indexOf(lower) !== -1;
        });
        return sortByCreated(filtered);
    }

    /**
     * Single link by id.
     */
    getLinkById(id) {
        for (var i = 0; i < this.links.length; i++) {
            if (this.links[i].id === id) return this.links[i];
        }
        return null;
    }

    /**
     * Most recent N links.
     */
    getRecentLinks(count) {
        count = count || 5;
        return sortByCreated(this.links).slice(0, count);
    }

    /* ================================================================
       AGGREGATIONS — Pure derivations for summary/stats
       ================================================================ */

    /**
     * Count notes per category (active notes only).
     * Returns { categoryName: count }
     */
    getNotesByCategorySummary() {
        var active = this.notes.filter(function (n) { return !n.isArchived; });
        return summarizeByCategory(active);
    }

    /**
     * Build the full category tree with counts.
     * Returns sorted array of { path, label, count, children[] }.
     */
    getCategoryTree() {
        if (this._categoryTree) return this._categoryTree;

        var active = this.notes.filter(function (n) { return !n.isArchived; });
        var counts = {};
        var i, cat;

        for (i = 0; i < active.length; i++) {
            cat = active[i].category || 'uncategorized';
            if (!counts[cat]) counts[cat] = 0;
            counts[cat]++;
        }

        var paths = Object.keys(counts).sort();
        var tree = [];

        for (i = 0; i < paths.length; i++) {
            var parts = paths[i].split('/');
            var node = tree;
            var builtPath = '';

            for (var p = 0; p < parts.length; p++) {
                builtPath = builtPath ? builtPath + '/' + parts[p] : parts[p];

                var existing = null;
                for (var n = 0; n < node.length; n++) {
                    if (node[n].path === builtPath) { existing = node[n]; break; }
                }

                if (existing) {
                    if (p === parts.length - 1) {
                        existing.count = counts[builtPath] || 0;
                    }
                    node = existing.children;
                } else {
                    var newNode = {
                        path:     builtPath,
                        label:    parts[p],
                        count:    (p === parts.length - 1) ? (counts[builtPath] || 0) : 0,
                        children: [],
                    };
                    node.push(newNode);
                    node = newNode.children;
                }
            }
        }

        this._categoryTree = tree;
        return tree;
    }

    /**
     * Count all unique tags across active notes.
     * Returns { tag: count }.
     */
    getNoteTagsSummary() {
        var active = this.notes.filter(function (n) { return !n.isArchived; });
        return summarizeTags(active);
    }

    /**
     * Count all unique tags across links.
     * Returns { tag: count }.
     */
    getLinkTagsSummary() {
        return summarizeTags(this.links);
    }

    /**
     * Merged tag cloud from notes + links.
     * Returns { tag: count }.
     */
    getAllTags() {
        if (this._allTags) return this._allTags;

        var noteTags = this.getNoteTagsSummary();
        var linkTags = this.getLinkTagsSummary();
        var merged = {};
        var key;
        for (key in noteTags) { merged[key] = noteTags[key]; }
        for (key in linkTags) { merged[key] = (merged[key] || 0) + linkTags[key]; }

        this._allTags = merged;
        return merged;
    }

    /**
     * Overall stats for the summary dashboard.
     */
    getStats() {
        var active = this.notes.filter(function (n) { return !n.isArchived; });
        var totalWords = 0;
        var totalChars = 0;
        for (var i = 0; i < active.length; i++) {
            totalWords += active[i].wordCount || 0;
            totalChars += active[i].charCount || 0;
        }
        return {
            totalNotes:    active.length,
            archivedNotes: this.notes.length - active.length,
            totalLinks:    this.links.length,
            totalWords:    totalWords,
            totalChars:    totalChars,
            pinnedCount:   active.filter(function (n) { return !!n.isPinned; }).length,
            favoriteCount: active.filter(function (n) { return !!n.isFavorited; }).length,
        };
    }

    /**
     * Flatten the category tree into a sorted list of path strings.
     * Useful for dropdowns / category pickers.
     * @returns {string[]}
     */
    getAllCategoryPaths() {
        var tree = this.getCategoryTree();
        var paths = [];
        function walk(nodes) {
            for (var i = 0; i < nodes.length; i++) {
                paths.push(nodes[i].path);
                if (nodes[i].children.length > 0) walk(nodes[i].children);
            }
        }
        walk(tree);
        return paths;
    }

    /* ================================================================
       INTERNAL HELPERS
       ================================================================ */

    _findNoteIndex(id) {
        for (var i = 0; i < this.notes.length; i++) {
            if (this.notes[i].id === id) return i;
        }
        return -1;
    }

    _findLinkIndex(id) {
        for (var i = 0; i < this.links.length; i++) {
            if (this.links[i].id === id) return i;
        }
        return -1;
    }

    _rollbackNote(index, original) {
        var rollback = this.notes.slice();
        rollback[index] = original;
        this.notes = rollback;
        this._invalidateCache();
        this.eventBus.publish('knowledge:rollback', original);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
    }

    _rollbackLink(index, original) {
        var rollback = this.links.slice();
        rollback[index] = original;
        this.links = rollback;
        this._invalidateCache();
        this.eventBus.publish('knowledge:rollback', original);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
    }

    _invalidateCache() {
        this._categoryTree = null;
        this._allTags      = null;
    }
}
