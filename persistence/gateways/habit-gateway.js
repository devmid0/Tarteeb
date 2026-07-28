// YAGNI: Removed getHabitsByFrequency, getHabitsByCategory, getHabitsByArchived,
// getHabitsBySortOrder, countHabits, countRecords, getRecord (single by pk)
// (none called from store — all computed in-memory)

'use strict';

var DEF_STORE  = 'habits-definitions';
var REC_STORE  = 'habits-records';

export class HabitGateway {
    constructor(database) {
        if (!database) {
            throw new Error('HabitGateway requires a Database instance');
        }
        this.db = database;
    }

    async createHabit(data) {
        var id = await this.db.save(DEF_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async getHabit(id) {
        return this.db.get(DEF_STORE, id);
    }

    async getAllHabits() {
        return this.db.getAll(DEF_STORE);
    }

    async updateHabit(data) {
        if (!data || !data.id) {
            throw new Error('updateHabit requires a habit with an id');
        }
        await this.db.update(DEF_STORE, data);
        return data;
    }

    async deleteHabit(id) {
        return this.db.delete(DEF_STORE, id);
    }

    async replaceAllHabits(habits) {
        return this.db.importStore(DEF_STORE, habits || []);
    }

    async createRecord(data) {
        var id = await this.db.save(REC_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async getAllRecords() {
        return this.db.getAll(REC_STORE);
    }

    async getRecordsByHabitId(habitId) {
        return this.db.getByIndex(REC_STORE, 'by-habit-id', habitId);
    }

    async getRecordByHabitAndDate(habitId, date) {
        var records = await this.db.getByIndex(REC_STORE, 'by-habit-id', habitId);
        for (var i = 0; i < records.length; i++) {
            if (records[i].date === date) return records[i];
        }
        return null;
    }

    async updateRecord(data) {
        if (!data || !data.id) {
            throw new Error('updateRecord requires a record with an id');
        }
        await this.db.update(REC_STORE, data);
        return data;
    }

    async deleteRecord(id) {
        return this.db.delete(REC_STORE, id);
    }

    async deleteRecordByHabitAndDate(habitId, date) {
        var record = await this.getRecordByHabitAndDate(habitId, date);
        if (record) {
            await this.db.delete(REC_STORE, record.id);
        }
    }

    async deleteAllRecordsForHabit(habitId) {
        var records = await this.getRecordsByHabitId(habitId);
        for (var i = 0; i < records.length; i++) {
            await this.db.delete(REC_STORE, records[i].id);
        }
    }

    async replaceAllRecords(records) {
        return this.db.importStore(REC_STORE, records || []);
    }

    async exportAll() {
        var habits  = await this.getAllHabits();
        var records = await this.getAllRecords();
        return { habits: habits, records: records };
    }

    async importAll(data) {
        if (data && data.habits) {
            await this.replaceAllHabits(data.habits);
        }
        if (data && data.records) {
            await this.replaceAllRecords(data.records);
        }
    }
}
