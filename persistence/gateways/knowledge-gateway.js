/**
 * Life OS — Knowledge Gateway
 *
 * The ONLY code path that touches the knowledge-notes and
 * knowledge-links IndexedDB object stores. All other modules
 * call through this gateway.
 *
 * Responsibilities:
 *   - CRUD for notes and links
 *   - Query by index (tags, created, url)
 */

const NOTE_STORE = 'knowledge-notes';
const LINK_STORE = 'knowledge-links';

export class KnowledgeGateway {
    constructor(database) {
        this.db = database;
    }

    /* ── Notes ──────────────────────────────────────────── */

    async createNote(data) {
        var id = await this.db.save(NOTE_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async updateNote(data) {
        if (!data.id) throw new Error('Note must have an id to update');
        await this.db.update(NOTE_STORE, data);
        return data;
    }

    async getNote(id) {
        return this.db.get(NOTE_STORE, id);
    }

    async getAllNotes() {
        return this.db.getAll(NOTE_STORE);
    }

    async deleteNote(id) {
        return this.db.delete(NOTE_STORE, id);
    }

    async getNotesByTag(tag) {
        return this.db.getByIndex(NOTE_STORE, 'by-tags', tag);
    }

    async getNotesByCreated(createdAt) {
        return this.db.getByIndex(NOTE_STORE, 'by-created', createdAt);
    }

    /* ── Links ──────────────────────────────────────────── */

    async createLink(data) {
        var id = await this.db.save(LINK_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async updateLink(data) {
        if (!data.id) throw new Error('Link must have an id to update');
        await this.db.update(LINK_STORE, data);
        return data;
    }

    async getLink(id) {
        return this.db.get(LINK_STORE, id);
    }

    async getAllLinks() {
        return this.db.getAll(LINK_STORE);
    }

    async deleteLink(id) {
        return this.db.delete(LINK_STORE, id);
    }

    async getLinksByUrl(url) {
        return this.db.getByIndex(LINK_STORE, 'by-url', url);
    }
}
