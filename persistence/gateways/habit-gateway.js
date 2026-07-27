/**
 * Tarteeb — Habits Gateway
 *
 * The SINGLE code path that touches the habits-definitions and
 * habits-records IndexedDB object stores. Every other module
 * must call through this gateway — no direct DB access elsewhere.
 *
 * IndexedDB Schema (habits-definitions):
 *   keyPath:  id (auto-increment)
 *   indexes:  by-frequency  (string)  — "daily" | "weekly" | "monthly"
 *   indexes:  by-category   (string)  — habit grouping
 *   indexes:  by-archived   (boolean) — active vs archived filter
 *   indexes:  by-sort-order (number)  — manual sort position
 *
 * IndexedDB Schema (habits-records):
 *   keyPath:  id (auto-increment)
 *   indexes:  by-habit-id   (number)  — all records for a habit
 *   indexes:  by-date       (string)  — "YYYY-MM-DD" for day lookups
 *   indexes:  by-habit-date ([number, string]) — compound: unique record per habit+day
 *
 * Design invariants:
 *   - Gateway is stateless — no internal caches, no side-effects.
 *   - Every method returns a Promise that resolves to plain data.
 *   - Gateway never validates — that is the store's responsibility.
 *   - Gateway never publishes events — that is the store's job.
 *   - Records use "YYYY-MM-DD" string keys for date (no time component).
 *   - A record's `completed` boolean defaults to true; absent record = not done.
 */

'use strict';

/* ── Store Names ──────────────────────────────────────────── */

var DEF_STORE  = 'habits-definitions';
var REC_STORE  = 'habits-records';

/* ── Gateway ──────────────────────────────────────────────── */

export class HabitGateway {
    /**
     * @param {import('../../persistence/connection/database.js').Database} database
     */
    constructor(database) {
        if (!database) {
            throw new Error('HabitGateway requires a Database instance');
        }
        this.db = database;
    }

    /* ================================================================
       HABIT DEFINITIONS — Create
       ================================================================ */

    /**
     * Persist a new habit definition.
     * @param {Object} data — habit object (id omitted; DB assigns it)
     * @returns {Promise<Object>} the saved habit with its new `id`
     */
    async createHabit(data) {
        var id = await this.db.save(DEF_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    /* ================================================================
       HABIT DEFINITIONS — Read
       ================================================================ */

    /**
     * Retrieve a single habit definition by primary key.
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getHabit(id) {
        return this.db.get(DEF_STORE, id);
    }

    /**
     * Retrieve every habit definition (unsorted).
     * @returns {Promise<Object[]>}
     */
    async getAllHabits() {
        return this.db.getAll(DEF_STORE);
    }

    /**
     * Retrieve all habits matching a frequency type.
     * @param {string} frequency — "daily" | "weekly" | "monthly"
     * @returns {Promise<Object[]>}
     */
    async getHabitsByFrequency(frequency) {
        return this.db.getByIndex(DEF_STORE, 'by-frequency', frequency);
    }

    /**
     * Retrieve all habits matching a category.
     * @param {string} category
     * @returns {Promise<Object[]>}
     */
    async getHabitsByCategory(category) {
        return this.db.getByIndex(DEF_STORE, 'by-category', category);
    }

    /**
     * Retrieve all habits matching an archived flag.
     * @param {boolean} archived
     * @returns {Promise<Object[]>}
     */
    async getHabitsByArchived(archived) {
        return this.db.getByIndex(DEF_STORE, 'by-archived', archived);
    }

    /**
     * Retrieve all habits matching a sort order value.
     * @param {number} order
     * @returns {Promise<Object[]>}
     */
    async getHabitsBySortOrder(order) {
        return this.db.getByIndex(DEF_STORE, 'by-sort-order', order);
    }

    /* ================================================================
       HABIT DEFINITIONS — Update
       ================================================================ */

    /**
     * Merge-patch an existing habit definition. Caller must supply `id`.
     * @param {Object} data — must include `id`
     * @returns {Promise<Object>} the fully merged record
     */
    async updateHabit(data) {
        if (!data || !data.id) {
            throw new Error('updateHabit requires a habit with an id');
        }
        await this.db.update(DEF_STORE, data);
        return data;
    }

    /* ================================================================
       HABIT DEFINITIONS — Delete
       ================================================================ */

    /**
     * Permanently remove a habit definition by id.
     * Does NOT cascade-delete its records — caller must do that explicitly.
     * @param {number} id
     * @returns {Promise<void>}
     */
    async deleteHabit(id) {
        return this.db.delete(DEF_STORE, id);
    }

    /* ================================================================
       HABIT DEFINITIONS — Bulk / Utility
       ================================================================ */

    /**
     * Replace the entire habits-definitions store with the supplied array.
     * @param {Object[]} habits
     * @returns {Promise<void>}
     */
    async replaceAllHabits(habits) {
        return this.db.importStore(DEF_STORE, habits || []);
    }

    /**
     * Count all habit definitions in the store.
     * @returns {Promise<number>}
     */
    async countHabits() {
        var all = await this.db.getAll(DEF_STORE);
        return all.length;
    }

    /* ================================================================
       COMPLETION RECORDS — Create
       ================================================================ */

    /**
     * Persist a new completion record.
     * @param {Object} data — record object (id omitted; DB assigns it)
     * @returns {Promise<Object>} the saved record with its new `id`
     */
    async createRecord(data) {
        var id = await this.db.save(REC_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    /* ================================================================
       COMPLETION RECORDS — Read
       ================================================================ */

    /**
     * Retrieve a single completion record by primary key.
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getRecord(id) {
        return this.db.get(REC_STORE, id);
    }

    /**
     * Retrieve every completion record (unsorted).
     * @returns {Promise<Object[]>}
     */
    async getAllRecords() {
        return this.db.getAll(REC_STORE);
    }

    /**
     * Retrieve all records for a specific habit.
     * @param {number} habitId
     * @returns {Promise<Object[]>}
     */
    async getRecordsByHabitId(habitId) {
        return this.db.getByIndex(REC_STORE, 'by-habit-id', habitId);
    }

    /**
     * Retrieve all records for a specific date (YYYY-MM-DD).
     * @param {string} date — "YYYY-MM-DD"
     * @returns {Promise<Object[]>}
     */
    async getRecordsByDate(date) {
        return this.db.getByIndex(REC_STORE, 'by-date', date);
    }

    /**
     * Retrieve the record for a specific habit on a specific date.
     * Returns null if no record exists (habit not completed that day).
     * @param {number} habitId
     * @param {string} date — "YYYY-MM-DD"
     * @returns {Promise<Object|null>}
     */
    async getRecordByHabitAndDate(habitId, date) {
        var records = await this.db.getByIndex(REC_STORE, 'by-habit-id', habitId);
        for (var i = 0; i < records.length; i++) {
            if (records[i].date === date) return records[i];
        }
        return null;
    }

    /**
     * Retrieve all records within a date range [from, to] inclusive.
     * Fetches all records and filters client-side since IndexedDB
     * does not support compound range queries on a single string index.
     * @param {string} from — "YYYY-MM-DD"
     * @param {string} to   — "YYYY-MM-DD"
     * @returns {Promise<Object[]>}
     */
    async getRecordsByDateRange(from, to) {
        var all = await this.db.getAll(REC_STORE);
        return all.filter(function (r) {
            return r.date >= from && r.date <= to;
        });
    }

    /**
     * Retrieve all records for a habit within a date range.
     * @param {number} habitId
     * @param {string} from — "YYYY-MM-DD"
     * @param {string} to   — "YYYY-MM-DD"
     * @returns {Promise<Object[]>}
     */
    async getRecordsByHabitAndDateRange(habitId, from, to) {
        var records = await this.getRecordsByHabitId(habitId);
        return records.filter(function (r) {
            return r.date >= from && r.date <= to;
        });
    }

    /* ================================================================
       COMPLETION RECORDS — Update
       ================================================================ */

    /**
     * Merge-patch an existing record. Caller must supply `id`.
     * @param {Object} data — must include `id`
     * @returns {Promise<Object>} the fully merged record
     */
    async updateRecord(data) {
        if (!data || !data.id) {
            throw new Error('updateRecord requires a record with an id');
        }
        await this.db.update(REC_STORE, data);
        return data;
    }

    /* ================================================================
       COMPLETION RECORDS — Delete
       ================================================================ */

    /**
     * Permanently remove a completion record by id.
     * @param {number} id
     * @returns {Promise<void>}
     */
    async deleteRecord(id) {
        return this.db.delete(REC_STORE, id);
    }

    /**
     * Delete a specific habit+day record (idempotent toggle off).
     * Finds the record by habitId + date and deletes it.
     * @param {number} habitId
     * @param {string} date — "YYYY-MM-DD"
     * @returns {Promise<void>}
     */
    async deleteRecordByHabitAndDate(habitId, date) {
        var record = await this.getRecordByHabitAndDate(habitId, date);
        if (record) {
            await this.db.delete(REC_STORE, record.id);
        }
    }

    /**
     * Delete ALL records for a specific habit.
     * Used when permanently deleting a habit definition.
     * @param {number} habitId
     * @returns {Promise<void>}
     */
    async deleteAllRecordsForHabit(habitId) {
        var records = await this.getRecordsByHabitId(habitId);
        for (var i = 0; i < records.length; i++) {
            await this.db.delete(REC_STORE, records[i].id);
        }
    }

    /* ================================================================
       COMPLETION RECORDS — Bulk / Utility
       ================================================================ */

    /**
     * Replace the entire habits-records store with the supplied array.
     * @param {Object[]} records
     * @returns {Promise<void>}
     */
    async replaceAllRecords(records) {
        return this.db.importStore(REC_STORE, records || []);
    }

    /**
     * Count all completion records in the store.
     * @returns {Promise<number>}
     */
    async countRecords() {
        var all = await this.db.getAll(REC_STORE);
        return all.length;
    }

    /* ================================================================
       EXPORT / IMPORT
       ================================================================ */

    /**
     * Export all habits data (definitions + records) as a single object.
     * @returns {Promise<{habits: Object[], records: Object[]}>}
     */
    async exportAll() {
        var habits  = await this.getAllHabits();
        var records = await this.getAllRecords();
        return { habits: habits, records: records };
    }

    /**
     * Import all habits data, replacing existing records.
     * @param {{ habits?: Object[], records?: Object[] }} data
     * @returns {Promise<void>}
     */
    async importAll(data) {
        if (data && data.habits) {
            await this.replaceAllHabits(data.habits);
        }
        if (data && data.records) {
            await this.replaceAllRecords(data.records);
        }
    }
}
