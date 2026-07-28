// YAGNI: Removed getNotesByCreated, getNotesByUpdated, getNotesByArchived, getNotesByFavorited,
// countNotes, countLinks, getLinksByUrl (none called — store filters in-memory)

'use strict';

var NOTE_STORE = 'knowledge-notes';
var LINK_STORE = 'knowledge-links';

export class KnowledgeGateway {
    constructor(database) {
        if (!database) {
            throw new Error('KnowledgeGateway requires a Database instance');
        }
        this.db = database;
    }

    async createNote(data) {
        var id = await this.db.save(NOTE_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async getNote(id) {
        return this.db.get(NOTE_STORE, id);
    }

    async getAllNotes() {
        return this.db.getAll(NOTE_STORE);
    }

    async getNotesByTag(tag) {
        return this.db.getByIndex(NOTE_STORE, 'by-tags', tag);
    }

    async getNotesByCategory(category) {
        return this.db.getByIndex(NOTE_STORE, 'by-category', category);
    }

    async updateNote(data) {
        if (!data || !data.id) {
            throw new Error('updateNote requires a note with an id');
        }
        await this.db.update(NOTE_STORE, data);
        return data;
    }

    async deleteNote(id) {
        return this.db.delete(NOTE_STORE, id);
    }

    async replaceAllNotes(notes) {
        return this.db.importStore(NOTE_STORE, notes || []);
    }

    async createLink(data) {
        var id = await this.db.save(LINK_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async getLink(id) {
        return this.db.get(LINK_STORE, id);
    }

    async getAllLinks() {
        return this.db.getAll(LINK_STORE);
    }

    async updateLink(data) {
        if (!data || !data.id) {
            throw new Error('updateLink requires a link with an id');
        }
        await this.db.update(LINK_STORE, data);
        return data;
    }

    async deleteLink(id) {
        return this.db.delete(LINK_STORE, id);
    }

    async replaceAllLinks(links) {
        return this.db.importStore(LINK_STORE, links || []);
    }

    async exportAll() {
        var notes = await this.getAllNotes();
        var links = await this.getAllLinks();
        return { notes: notes, links: links };
    }

    async importAll(data) {
        if (data && data.notes) {
            await this.replaceAllNotes(data.notes);
        }
        if (data && data.links) {
            await this.replaceAllLinks(data.links);
        }
    }
}
