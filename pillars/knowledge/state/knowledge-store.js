/**
 * Life OS — Knowledge State Store
 *
 * Unidirectional data flow within the Knowledge pillar:
 *
 *   View ──dispatch(action)──▶ KnowledgeStore ──publish──▶ EventBus
 *              │                                          │
 *              ▼                                          ▼
 *        gateway.create()                       View re-renders
 *        gateway.update()
 *        gateway.delete()
 *
 * Constraints:
 *   - State mutations ONLY via dispatch()
 *   - Selectors are pure functions of the state
 *   - Gateway writes are optimistic — rollback on failure
 *   - Every mutation publishes 'knowledge:changed' as the single re-render trigger
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
    selectByCategory,
    selectByTag,
    selectBySearch,
    selectRecent,
    summarizeByCategory,
    summarizeTags,
} from '../domain/knowledge-rules.js';

export class KnowledgeStore {
    constructor(eventBus, knowledgeGateway) {
        this.eventBus = eventBus;
        this.gateway  = knowledgeGateway;

        this.notes = [];
        this.links = [];
        this.loading = false;
        this.error   = null;
    }

    /* ── Hydration ─────────────────────────────────────────── */

    async hydrate() {
        this.loading = true;
        this.eventBus.publish('knowledge:loading', true);

        try {
            this.notes = await this.gateway.getAllNotes();
            this.links = await this.gateway.getAllLinks();
            this.error = null;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('knowledge:error', err.message);
        } finally {
            this.loading = false;
            this.eventBus.publish('knowledge:loading', false);
            this.eventBus.publish('knowledge:hydrated', this.getStateSnapshot());
        }
    }

    /* ── Dispatch ──────────────────────────────────────────── */

    async dispatch(action) {
        switch (action.type) {
            case 'ADD_NOTE':        return this._addNote(action.payload);
            case 'UPDATE_NOTE':     return this._updateNote(action.payload);
            case 'DELETE_NOTE':     return this._deleteNote(action.payload);
            case 'TOGGLE_PIN_NOTE': return this._togglePinNote(action.payload);
            case 'ADD_LINK':        return this._addLink(action.payload);
            case 'UPDATE_LINK':     return this._updateLink(action.payload);
            case 'DELETE_LINK':     return this._deleteLink(action.payload);
            default:
                console.warn('[KnowledgeStore] Unknown action:', action.type);
        }
    }

    /* ── Internal Mutators: Notes ────────────────────────── */

    async _addNote(raw) {
        var data = createNoteData(raw);
        data.tags = normalizeTags(data.tags);
        var validation = validateNote(data);
        if (!validation.valid) {
            this.eventBus.publish('knowledge:validation-error', validation.errors);
            return null;
        }

        try {
            var saved = await this.gateway.createNote(data);
            this.notes = this.notes.concat([saved]);
            this.eventBus.publish('knowledge:note-added', saved);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.eventBus.publish('knowledge:error', err.message);
            return null;
        }
    }

    async _updateNote(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('knowledge:error', 'UPDATE_NOTE requires an id');
            return null;
        }

        var index = -1;
        for (var i = 0; i < this.notes.length; i++) {
            if (this.notes[i].id === patch.id) { index = i; break; }
        }
        if (index === -1) {
            this.eventBus.publish('knowledge:error', 'Note ' + patch.id + ' not found');
            return null;
        }

        if (patch.tags) patch.tags = normalizeTags(patch.tags);

        var existing = this.notes[index];
        var updated  = Object.assign({}, existing, patch, { updatedAt: new Date().toISOString() });

        /* Optimistic: replace in local array */
        var next = this.notes.slice();
        next[index] = updated;
        this.notes = next;

        this.eventBus.publish('knowledge:note-updated', updated);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateNote(updated);
        } catch (err) {
            /* Rollback */
            var rollback = this.notes.slice();
            rollback[index] = existing;
            this.notes = rollback;
            this.eventBus.publish('knowledge:rollback', existing);
            this.eventBus.publish('knowledge:error', err.message);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        }

        return updated;
    }

    async _deleteNote(id) {
        var index = -1;
        for (var i = 0; i < this.notes.length; i++) {
            if (this.notes[i].id === id) { index = i; break; }
        }
        if (index === -1) return;

        var removed = this.notes[index];
        this.notes = this.notes.filter(function (n) { return n.id !== id; });
        this.eventBus.publish('knowledge:note-deleted', removed);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteNote(id);
        } catch (err) {
            var rollback = this.notes.slice();
            rollback.splice(index, 0, removed);
            this.notes = rollback;
            this.eventBus.publish('knowledge:rollback', removed);
            this.eventBus.publish('knowledge:error', err.message);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        }
    }

    async _togglePinNote(id) {
        var index = -1;
        for (var i = 0; i < this.notes.length; i++) {
            if (this.notes[i].id === id) { index = i; break; }
        }
        if (index === -1) return null;

        var existing = this.notes[index];
        var updated = Object.assign({}, existing, {
            isPinned: !existing.isPinned,
            updatedAt: new Date().toISOString(),
        });

        var next = this.notes.slice();
        next[index] = updated;
        this.notes = next;

        this.eventBus.publish('knowledge:note-updated', updated);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateNote(updated);
        } catch (err) {
            var rollback = this.notes.slice();
            rollback[index] = existing;
            this.notes = rollback;
            this.eventBus.publish('knowledge:rollback', existing);
            this.eventBus.publish('knowledge:error', err.message);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        }

        return updated;
    }

    /* ── Internal Mutators: Links ────────────────────────── */

    async _addLink(raw) {
        var data = createLinkData(raw);
        data.tags = normalizeTags(data.tags);
        var validation = validateLink(data);
        if (!validation.valid) {
            this.eventBus.publish('knowledge:validation-error', validation.errors);
            return null;
        }

        try {
            var saved = await this.gateway.createLink(data);
            this.links = this.links.concat([saved]);
            this.eventBus.publish('knowledge:link-added', saved);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.eventBus.publish('knowledge:error', err.message);
            return null;
        }
    }

    async _updateLink(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('knowledge:error', 'UPDATE_LINK requires an id');
            return null;
        }

        var index = -1;
        for (var i = 0; i < this.links.length; i++) {
            if (this.links[i].id === patch.id) { index = i; break; }
        }
        if (index === -1) {
            this.eventBus.publish('knowledge:error', 'Link ' + patch.id + ' not found');
            return null;
        }

        if (patch.tags) patch.tags = normalizeTags(patch.tags);

        var existing = this.links[index];
        var updated  = Object.assign({}, existing, patch, { updatedAt: new Date().toISOString() });

        var next = this.links.slice();
        next[index] = updated;
        this.links = next;

        this.eventBus.publish('knowledge:link-updated', updated);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateLink(updated);
        } catch (err) {
            var rollback = this.links.slice();
            rollback[index] = existing;
            this.links = rollback;
            this.eventBus.publish('knowledge:rollback', existing);
            this.eventBus.publish('knowledge:error', err.message);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        }

        return updated;
    }

    async _deleteLink(id) {
        var index = -1;
        for (var i = 0; i < this.links.length; i++) {
            if (this.links[i].id === id) { index = i; break; }
        }
        if (index === -1) return;

        var removed = this.links[index];
        this.links = this.links.filter(function (l) { return l.id !== id; });
        this.eventBus.publish('knowledge:link-deleted', removed);
        this.eventBus.publish('knowledge:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteLink(id);
        } catch (err) {
            var rollback = this.links.slice();
            rollback.splice(index, 0, removed);
            this.links = rollback;
            this.eventBus.publish('knowledge:rollback', removed);
            this.eventBus.publish('knowledge:error', err.message);
            this.eventBus.publish('knowledge:changed', this.getStateSnapshot());
        }
    }

    /* ── Selectors ─────────────────────────────────────────── */

    getStateSnapshot() {
        return {
            notes:   this.notes,
            links:   this.links,
            loading: this.loading,
            error:   this.error,
        };
    }

    getAllNotes()     { return sortByPinnedThenCreated(this.notes); }
    getAllLinks()     { return sortByCreated(this.links); }

    getNotesByCategory(cat)  { return sortByPinnedThenCreated(selectByCategory(this.notes, cat)); }
    getLinksBySearch(term)   { return sortByCreated(selectBySearch(this.links, term)); }
    getNotesBySearch(term)   { return sortByPinnedThenCreated(selectBySearch(this.notes, term)); }
    getNotesByTag(tag)       { return sortByPinnedThenCreated(selectByTag(this.notes, tag)); }
    getLinksByTag(tag)       { return sortByCreated(selectByTag(this.links, tag)); }

    getRecentNotes(count) { return selectRecent(this.notes, count); }
    getRecentLinks(count) { return selectRecent(this.links, count); }

    getNoteById(id) {
        for (var i = 0; i < this.notes.length; i++) {
            if (this.notes[i].id === id) return this.notes[i];
        }
        return null;
    }

    getLinkById(id) {
        for (var i = 0; i < this.links.length; i++) {
            if (this.links[i].id === id) return this.links[i];
        }
        return null;
    }

    /* ── Derived Aggregations ──────────────────────────────── */

    getNotesByCategorySummary() { return summarizeByCategory(this.notes); }
    getNoteTagsSummary()        { return summarizeTags(this.notes); }
    getLinkTagsSummary()        { return summarizeTags(this.links); }

    getAllTags() {
        var noteTags = summarizeTags(this.notes);
        var linkTags = summarizeTags(this.links);
        var merged = {};
        var key;
        for (key in noteTags) { merged[key] = noteTags[key]; }
        for (key in linkTags) { merged[key] = (merged[key] || 0) + linkTags[key]; }
        return merged;
    }
}
