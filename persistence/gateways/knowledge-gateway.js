/**
 * Tarteeb — PKM Gateway
 *
 * The SINGLE code path that touches the knowledge-notes and
 * knowledge-links IndexedDB object stores. Every other module
 * must call through this gateway — no direct DB access elsewhere.
 *
 * IndexedDB Schema (knowledge-notes):
 *   keyPath:  id (auto-increment)
 *   indexes:  by-tags      (multiEntry)  — tag-based queries
 *             by-created   (ISO string)  — chronological sort
 *             by-updated   (ISO string)  — last-modified sort
 *             by-category  (string)      — hierarchical category path
 *             by-archived  (boolean)     — soft-delete / archive filter
 *             by-favorited (boolean)     — favorites filter
 *
 * IndexedDB Schema (knowledge-links):
 *   keyPath:  id (auto-increment)
 *   indexes:  by-url       (string)      — dedup / lookup
 *
 * Design invariants:
 *   - Gateway is stateless — no internal caches, no side-effects.
 *   - Every method returns a Promise that resolves to plain data.
 *   - Gateway never validates — that is the store's responsibility.
 *   - Gateway never publishes events — that is the store's job.
 *   - Tags are stored as an array of lowercase trimmed strings,
 *     enabling IndexedDB multiEntry index for O(1) tag lookups.
 *   - Category is a slash-delimited hierarchical path, e.g.
 *     "programming/javascript/async".  The gateway supports
 *     prefix matching for subtree queries.
 */

'use strict';

/* ── Store Names ──────────────────────────────────────────── */

var NOTE_STORE = 'knowledge-notes';
var LINK_STORE = 'knowledge-links';

/* ── Gateway ──────────────────────────────────────────────── */

export class KnowledgeGateway {
    /**
     * @param {import('../../persistence/connection/database.js').Database} database
     */
    constructor(database) {
        if (!database) {
            throw new Error('KnowledgeGateway requires a Database instance');
        }
        this.db = database;
    }

    /* ================================================================
       NOTES — Create
       ================================================================ */

    /**
     * Persist a new note record.
     * @param {Object} data — note object (id omitted; DB assigns it)
     * @returns {Promise<Object>} the saved note with its new `id`
     */
    async createNote(data) {
        var id = await this.db.save(NOTE_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    /* ================================================================
       NOTES — Read
       ================================================================ */

    /**
     * Retrieve a single note by primary key.
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getNote(id) {
        return this.db.get(NOTE_STORE, id);
    }

    /**
     * Retrieve every note in the store (unsorted).
     * @returns {Promise<Object[]>}
     */
    async getAllNotes() {
        return this.db.getAll(NOTE_STORE);
    }

    /**
     * Retrieve all notes whose `tags` array contains `tag`.
     * Uses the multiEntry index for efficient lookups.
     * @param {string} tag — a single lowercase tag
     * @returns {Promise<Object[]>}
     */
    async getNotesByTag(tag) {
        return this.db.getByIndex(NOTE_STORE, 'by-tags', tag);
    }

    /**
     * Retrieve all notes matching an exact `createdAt` value.
     * Primarily useful for day-level grouping.
     * @param {string} createdAt — ISO date string
     * @returns {Promise<Object[]>}
     */
    async getNotesByCreated(createdAt) {
        return this.db.getByIndex(NOTE_STORE, 'by-created', createdAt);
    }

    /**
     * Retrieve all notes matching an exact `updatedAt` value.
     * @param {string} updatedAt — ISO date string
     * @returns {Promise<Object[]>}
     */
    async getNotesByUpdated(updatedAt) {
        return this.db.getByIndex(NOTE_STORE, 'by-updated', updatedAt);
    }

    /**
     * Retrieve all notes under a specific category path.
     * Performs exact match on the `category` index.
     * For subtree queries, the store layer should call this
     * and then filter with prefix matching.
     * @param {string} category — e.g. "programming" or "programming/javascript"
     * @returns {Promise<Object[]>}
     */
    async getNotesByCategory(category) {
        return this.db.getByIndex(NOTE_STORE, 'by-category', category);
    }

    /**
     * Retrieve all notes whose `isArchived` flag matches.
     * @param {boolean} archived
     * @returns {Promise<Object[]>}
     */
    async getNotesByArchived(archived) {
        return this.db.getByIndex(NOTE_STORE, 'by-archived', archived);
    }

    /**
     * Retrieve all notes whose `isFavorited` flag matches.
     * @param {boolean} favorited
     * @returns {Promise<Object[]>}
     */
    async getNotesByFavorited(favorited) {
        return this.db.getByIndex(NOTE_STORE, 'by-favorited', favorited);
    }

    /* ================================================================
       NOTES — Update
       ================================================================ */

    /**
     * Merge-patch an existing note.  The caller must supply `id`.
     * All other fields are optional — only provided keys are overwritten.
     * @param {Object} data — must include `id`
     * @returns {Promise<Object>} the fully merged record
     */
    async updateNote(data) {
        if (!data || !data.id) {
            throw new Error('updateNote requires a note with an id');
        }
        await this.db.update(NOTE_STORE, data);
        return data;
    }

    /* ================================================================
       NOTES — Delete
       ================================================================ */

    /**
     * Permanently remove a note by id.
     * @param {number} id
     * @returns {Promise<void>}
     */
    async deleteNote(id) {
        return this.db.delete(NOTE_STORE, id);
    }

    /* ================================================================
       NOTES — Bulk / Utility
       ================================================================ */

    /**
     * Replace the entire notes store with the supplied array.
     * Used for import/restore operations.
     * @param {Object[]} notes
     * @returns {Promise<void>}
     */
    async replaceAllNotes(notes) {
        return this.db.importStore(NOTE_STORE, notes || []);
    }

    /**
     * Count all notes in the store.
     * @returns {Promise<number>}
     */
    async countNotes() {
        var all = await this.db.getAll(NOTE_STORE);
        return all.length;
    }

    /* ================================================================
       LINKS — Create
       ================================================================ */

    /**
     * Persist a new link record.
     * @param {Object} data — link object
     * @returns {Promise<Object>} the saved link with its new `id`
     */
    async createLink(data) {
        var id = await this.db.save(LINK_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    /* ================================================================
       LINKS — Read
       ================================================================ */

    /**
     * Retrieve a single link by primary key.
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getLink(id) {
        return this.db.get(LINK_STORE, id);
    }

    /**
     * Retrieve every link in the store (unsorted).
     * @returns {Promise<Object[]>}
     */
    async getAllLinks() {
        return this.db.getAll(LINK_STORE);
    }

    /**
     * Retrieve links whose URL matches exactly.
     * Useful for deduplication checks.
     * @param {string} url
     * @returns {Promise<Object[]>}
     */
    async getLinksByUrl(url) {
        return this.db.getByIndex(LINK_STORE, 'by-url', url);
    }

    /* ================================================================
       LINKS — Update
       ================================================================ */

    /**
     * Merge-patch an existing link.  The caller must supply `id`.
     * @param {Object} data — must include `id`
     * @returns {Promise<Object>} the fully merged record
     */
    async updateLink(data) {
        if (!data || !data.id) {
            throw new Error('updateLink requires a link with an id');
        }
        await this.db.update(LINK_STORE, data);
        return data;
    }

    /* ================================================================
       LINKS — Delete
       ================================================================ */

    /**
     * Permanently remove a link by id.
     * @param {number} id
     * @returns {Promise<void>}
     */
    async deleteLink(id) {
        return this.db.delete(LINK_STORE, id);
    }

    /* ================================================================
       LINKS — Bulk / Utility
       ================================================================ */

    /**
     * Replace the entire links store with the supplied array.
     * @param {Object[]} links
     * @returns {Promise<void>}
     */
    async replaceAllLinks(links) {
        return this.db.importStore(LINK_STORE, links || []);
    }

    /**
     * Count all links in the store.
     * @returns {Promise<number>}
     */
    async countLinks() {
        var all = await this.db.getAll(LINK_STORE);
        return all.length;
    }

    /* ================================================================
       EXPORT / IMPORT
       ================================================================ */

    /**
     * Export all knowledge data (notes + links) as a single object.
     * @returns {Promise<{notes: Object[], links: Object[]}>}
     */
    async exportAll() {
        var notes = await this.getAllNotes();
        var links = await this.getAllLinks();
        return { notes: notes, links: links };
    }

    /**
     * Import all knowledge data, replacing existing records.
     * @param {{ notes?: Object[], links?: Object[] }} data
     * @returns {Promise<void>}
     */
    async importAll(data) {
        if (data && data.notes) {
            await this.replaceAllNotes(data.notes);
        }
        if (data && data.links) {
            await this.replaceAllLinks(data.links);
        }
    }
}
