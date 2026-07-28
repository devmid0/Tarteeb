/**
 * Tarteeb — Habits State Store
 *
 * Unidirectional data flow within the Habits pillar:
 *
 *   View ──dispatch(action)──▶ HabitStore ──publish──▶ EventBus
 *              │                                       │
 *              ▼                                       ▼
 *        gateway.create()                    View re-renders
 *        gateway.update()
 *        gateway.delete()
 *
 * Invariants:
 *   - State mutations ONLY via dispatch() — never direct assignment.
 *   - Every mutation publishes 'habits:changed' with a full state
 *     snapshot.  This is the SINGLE re-render trigger for views.
 *   - Gateway writes are optimistic: local state mutates immediately,
 *     then the gateway write fires async.  On failure the store
 *     rolls back to the previous snapshot and publishes
 *     'habits:rollback'.
 *   - Selectors are pure derivations of the in-memory arrays.
 *     They never mutate state.
 *   - Streak computation is derived on demand (not cached) because
 *     records change frequently with each daily toggle.
 *
 * Habit definition shape:
 *   { id, name, icon, category, color, frequency, frequencyDays,
 *     frequencyDay, targetCount, currentCount, archived,
 *     sortOrder, createdAt, updatedAt }
 *
 * Completion record shape:
 *   { id, habitId, date, completed, note, createdAt }
 *
 * Frequency enum:
 *   "daily"   — every calendar day
 *   "weekly"  — specific days of the week (frequencyDays: [0-6])
 *   "monthly" — a specific day of the month (frequencyDay: 1-31)
 */

'use strict';

/* ── Helpers ──────────────────────────────────────────────── */

/**
 * Return today as "YYYY-MM-DD" in the local timezone.
 * @returns {string}
 */
function _today() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

/**
 * Return the "YYYY-MM-DD" string for a Date object.
 * @param {Date} d
 * @returns {string}
 */
function _toISO(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

/**
 * Parse a "YYYY-MM-DD" string into a Date at midnight local.
 * @param {string} s
 * @returns {Date}
 */
function _parseDate(s) {
    var parts = s.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

/**
 * Add N days to a "YYYY-MM-DD" string, return a new "YYYY-MM-DD".
 * @param {string} dateStr
 * @param {number} days
 * @returns {string}
 */
function _addDays(dateStr, days) {
    var d = _parseDate(dateStr);
    d.setDate(d.getDate() + days);
    return _toISO(d);
}

/**
 * Subtract N days from a "YYYY-MM-DD" string.
 * @param {string} dateStr
 * @param {number} days
 * @returns {string}
 */
function _subDays(dateStr, days) {
    return _addDays(dateStr, -days);
}

/**
 * Get the day-of-week (0=Sun, 6=Sat) for a "YYYY-MM-DD" string.
 * @param {string} dateStr
 * @returns {number}
 */
function _dayOfWeek(dateStr) {
    return _parseDate(dateStr).getDay();
}

/**
 * Get the day-of-month (1-31) for a "YYYY-MM-DD" string.
 * @param {string} dateStr
 * @returns {number}
 */
function _dayOfMonth(dateStr) {
    return _parseDate(dateStr).getDate();
}

/**
 * Difference in calendar days between two "YYYY-MM-DD" strings.
 * @param {string} a
 * @param {string} b
 * @returns {number} a - b (positive if a is after b)
 */
function _diffDays(a, b) {
    var da = _parseDate(a);
    var db = _parseDate(b);
    return Math.round((da - db) / 86400000);
}

/**
 * Create a lookup set from an array of record date strings.
 * @param {Object[]} records
 * @returns {Object} { "YYYY-MM-DD": true }
 */
function _recordDateSet(records) {
    var set = {};
    for (var i = 0; i < records.length; i++) {
        if (records[i].completed !== false) {
            set[records[i].date] = true;
        }
    }
    return set;
}

/**
 * Check whether a habit is "due" on a given date string.
 * @param {Object} habit
 * @param {string} dateStr — "YYYY-MM-DD"
 * @returns {boolean}
 */
function _isHabitDueOnDay(habit, dateStr) {
    var freq = habit.frequency || 'daily';
    if (freq === 'daily') return true;
    if (freq === 'weekly') {
        var dow = _dayOfWeek(dateStr);
        var days = habit.frequencyDays || [];
        return days.indexOf(dow) !== -1;
    }
    if (freq === 'monthly') {
        var target = habit.frequencyDay || 1;
        return _dayOfMonth(dateStr) === target;
    }
    return true;
}

/* ── Sort Helpers ─────────────────────────────────────────── */

function _sortBySortOrder(habits) {
    return habits.slice().sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
}

function _sortByCreated(habits) {
    return habits.slice().sort(function (a, b) {
        var da = a.createdAt || '';
        var db = b.createdAt || '';
        if (db !== da) return db.localeCompare(da);
        return (b.id || 0) - (a.id || 0);
    });
}

/* ── Frequency Helpers ────────────────────────────────────── */

var FREQ_LABELS = {
    daily:   'Daily',
    weekly:  'Weekly',
    monthly: 'Monthly',
};

var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── Store ────────────────────────────────────────────────── */

export class HabitStore {
    /**
     * @param {import('../../../core/events/event-bus.js').EventBus} eventBus
     * @param {import('../../../persistence/gateways/habit-gateway.js').HabitGateway} habitGateway
     */
    constructor(eventBus, habitGateway) {
        this.eventBus = eventBus;
        this.gateway  = habitGateway;

        /* ── Core state ── */
        this.habits  = [];
        this.records = [];
        this.loading = false;
        this.error   = null;
    }

    /* ================================================================
       HYDRATION
       ================================================================ */

    /**
     * Load all habit definitions and completion records from IndexedDB.
     * Publishes: habits:loading, habits:hydrated (or habits:error)
     */
    async hydrate() {
        this.loading = true;
        this.eventBus.publish('habits:loading', true);

        try {
            var results = await Promise.all([
                this.gateway.getAllHabits(),
                this.gateway.getAllRecords(),
            ]);
            this.habits  = results[0];
            this.records = results[1];
            this.error   = null;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('habits:error', err.message);
        } finally {
            this.loading = false;
            this.eventBus.publish('habits:loading', false);
            this.eventBus.publish('habits:hydrated', this.getStateSnapshot());
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
            /* ── Habit Definitions ── */
            case 'ADD_HABIT':         return this._addHabit(action.payload);
            case 'UPDATE_HABIT':      return this._updateHabit(action.payload);
            case 'DELETE_HABIT':      return this._deleteHabit(action.payload);
            case 'ARCHIVE_HABIT':     return this._setArchive(action.payload, true);
            case 'RESTORE_HABIT':     return this._setArchive(action.payload, false);
            case 'REORDER_HABITS':    return this._reorderHabits(action.payload);

            /* ── Completion Records ── */
            case 'TOGGLE_COMPLETE':   return this._toggleComplete(action.payload);
            case 'MARK_COMPLETE':     return this._markComplete(action.payload);
            case 'UNMARK_COMPLETE':   return this._unmarkComplete(action.payload);
            case 'UPDATE_RECORD':     return this._updateRecord(action.payload);
            case 'DELETE_RECORD':     return this._deleteRecord(action.payload);

            /* ── Bulk ── */
            case 'IMPORT_HABITS':     return this._importHabits(action.payload);
            case 'IMPORT_RECORDS':    return this._importRecords(action.payload);

            default:
                console.warn('[HabitStore] Unknown action:', action.type);
                return null;
        }
    }

    /* ================================================================
       HABIT DEFINITION MUTATORS
       ================================================================ */

    async _addHabit(raw) {
        var now = new Date().toISOString();
        var data = {
            name:           (raw.name || '').trim(),
            icon:           raw.icon || '✅',
            category:       (raw.category || 'other').trim(),
            color:          raw.color || 'accent-habits',
            frequency:      raw.frequency || 'daily',
            frequencyDays:  Array.isArray(raw.frequencyDays) ? raw.frequencyDays.slice() : [],
            frequencyDay:   raw.frequencyDay || null,
            targetCount:    raw.targetCount || 1,
            currentCount:   0,
            archived:       false,
            sortOrder:      raw.sortOrder != null ? raw.sortOrder : this.habits.length,
            createdAt:      now,
            updatedAt:      now,
        };

        if (!data.name) {
            this.eventBus.publish('habits:validation-error', ['Habit name is required']);
            return null;
        }

        try {
            var saved = await this.gateway.createHabit(data);
            this.habits = this.habits.concat([saved]);
            this.eventBus.publish('habits:habit-added', saved);
            this.eventBus.publish('habits:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('habits:error', err.message);
            return null;
        }
    }

    async _updateHabit(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('habits:error', 'UPDATE_HABIT requires an id');
            return null;
        }

        var index = this._findHabitIndex(patch.id);
        if (index === -1) {
            this.eventBus.publish('habits:error', 'Habit ' + patch.id + ' not found');
            return null;
        }

        var existing = this.habits[index];

        /* Normalize mutable fields */
        if (patch.name !== undefined) patch.name = String(patch.name).trim();
        if (patch.frequencyDays !== undefined && !Array.isArray(patch.frequencyDays)) {
            patch.frequencyDays = [];
        }

        patch.updatedAt = new Date().toISOString();
        var updated = Object.assign({}, existing, patch);

        /* Optimistic: replace in local array */
        var next = this.habits.slice();
        next[index] = updated;
        this.habits = next;

        this.eventBus.publish('habits:habit-updated', updated);
        this.eventBus.publish('habits:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateHabit(updated);
        } catch (err) {
            this._rollbackHabit(index, existing);
            this.eventBus.publish('habits:error', err.message);
        }

        return updated;
    }

    async _deleteHabit(id) {
        var index = this._findHabitIndex(id);
        if (index === -1) return;

        var removed = this.habits[index];
        var next = this.habits.slice();
        next.splice(index, 1);
        this.habits = next;

        /* Also remove all completion records for this habit from memory */
        var removedRecords = this.records.filter(function (r) { return r.habitId === id; });
        this.records = this.records.filter(function (r) { return r.habitId !== id; });

        this.eventBus.publish('habits:habit-deleted', removed);
        this.eventBus.publish('habits:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteHabit(id);
            await this.gateway.deleteAllRecordsForHabit(id);
        } catch (err) {
            /* Rollback habit */
            var rollback = this.habits.slice();
            rollback.splice(index, 0, removed);
            this.habits = rollback;
            /* Rollback records */
            this.records = this.records.concat(removedRecords);
            this.eventBus.publish('habits:rollback', removed);
            this.eventBus.publish('habits:error', err.message);
            this.eventBus.publish('habits:changed', this.getStateSnapshot());
        }
    }

    /**
     * Set or clear the archive flag on a habit.
     * @param {number} id
     * @param {boolean} archived
     */
    async _setArchive(id, archived) {
        var index = this._findHabitIndex(id);
        if (index === -1) return null;

        var existing = this.habits[index];
        if (existing.archived === archived) return existing;

        var updated = Object.assign({}, existing, {
            archived:  archived,
            updatedAt: new Date().toISOString(),
        });

        var next = this.habits.slice();
        next[index] = updated;
        this.habits = next;

        this.eventBus.publish('habits:habit-updated', updated);
        this.eventBus.publish('habits:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateHabit(updated);
        } catch (err) {
            this._rollbackHabit(index, existing);
            this.eventBus.publish('habits:error', err.message);
        }

        return updated;
    }

    /**
     * Batch-reassign sortOrder for all habits.
     * @param {number[]} orderedIds — habit IDs in desired display order
     */
    async _reorderHabits(orderedIds) {
        if (!Array.isArray(orderedIds)) return;

        var prevOrders = {};
        for (var i = 0; i < this.habits.length; i++) {
            prevOrders[this.habits[i].id] = this.habits[i].sortOrder;
        }

        var next = this.habits.slice();
        for (var j = 0; j < orderedIds.length; j++) {
            for (var k = 0; k < next.length; k++) {
                if (next[k].id === orderedIds[j]) {
                    next[k] = Object.assign({}, next[k], {
                        sortOrder: j,
                        updatedAt: new Date().toISOString(),
                    });
                    break;
                }
            }
        }
        this.habits = next;

        this.eventBus.publish('habits:changed', this.getStateSnapshot());

        try {
            for (var m = 0; m < orderedIds.length; m++) {
                var habit = this.getHabitById(orderedIds[m]);
                if (habit) await this.gateway.updateHabit(habit);
            }
        } catch (err) {
            /* Rollback all sort orders */
            var rb = this.habits.slice();
            for (var p = 0; p < rb.length; p++) {
                if (prevOrders[rb[p].id] !== undefined) {
                    rb[p] = Object.assign({}, rb[p], { sortOrder: prevOrders[rb[p].id] });
                }
            }
            this.habits = rb;
            this.eventBus.publish('habits:error', err.message);
            this.eventBus.publish('habits:changed', this.getStateSnapshot());
        }
    }

    /* ================================================================
       COMPLETION RECORD MUTATORS
       ================================================================ */

    /**
     * Toggle completion for a habit on a given date.
     * If no record exists → create one (mark complete).
     * If a record exists → delete it (unmark).
     * @param {{ habitId: number, date?: string }} payload
     */
    async _toggleComplete(payload) {
        if (!payload || !payload.habitId) {
            this.eventBus.publish('habits:error', 'TOGGLE_COMPLETE requires a habitId');
            return null;
        }

        var habitId = payload.habitId;
        var date    = payload.date || _today();

        var existing = this._findRecord(habitId, date);

        if (existing) {
            /* Unmark: remove the record */
            var idx = this._findRecordIndex(existing.id);
            var removedRec = this.records[idx];
            var next = this.records.slice();
            next.splice(idx, 1);
            this.records = next;

            /* Decrement currentCount on the habit */
            var hIdx = this._findHabitIndex(habitId);
            if (hIdx !== -1) {
                var h = this.habits[hIdx];
                var newCount = Math.max(0, (h.currentCount || 0) - 1);
                var hNext = this.habits.slice();
                hNext[hIdx] = Object.assign({}, h, {
                    currentCount: newCount,
                    updatedAt: new Date().toISOString(),
                });
                this.habits = hNext;
            }

            this.eventBus.publish('habits:record-deleted', removedRec);
            this.eventBus.publish('habits:changed', this.getStateSnapshot());

            try {
                await this.gateway.deleteRecord(existing.id);
                if (hIdx !== -1) {
                    await this.gateway.updateHabit(this.habits[hIdx]);
                }
            } catch (err) {
                /* Rollback record */
                var rbRec = this.records.slice();
                rbRec.splice(idx, 0, removedRec);
                this.records = rbRec;
                if (hIdx !== -1) {
                    var rbHabits = this.habits.slice();
                    rbHabits[hIdx] = h;
                    this.habits = rbHabits;
                }
                this.eventBus.publish('habits:rollback', removedRec);
                this.eventBus.publish('habits:error', err.message);
                this.eventBus.publish('habits:changed', this.getStateSnapshot());
            }

            return null;
        } else {
            /* Mark complete: create the record */
            var now = new Date().toISOString();
            var record = {
                habitId:   habitId,
                date:      date,
                completed: true,
                note:      '',
                createdAt: now,
            };

            /* Optimistic: add to local array */
            this.records = this.records.concat([record]);

            /* Increment currentCount on the habit */
            var hIdx2 = this._findHabitIndex(habitId);
            if (hIdx2 !== -1) {
                var h2 = this.habits[hIdx2];
                var h2Next = this.habits.slice();
                h2Next[hIdx2] = Object.assign({}, h2, {
                    currentCount: (h2.currentCount || 0) + 1,
                    updatedAt: new Date().toISOString(),
                });
                this.habits = h2Next;
            }

            this.eventBus.publish('habits:record-added', record);
            this.eventBus.publish('habits:changed', this.getStateSnapshot());

            try {
                var saved = await this.gateway.createRecord(record);
                /* Replace the temp record (no id) with the saved one (has id) */
                var tempIdx = this.records.length - 1;
                var savedRec = Object.assign({}, record, { id: saved.id });
                var recNext = this.records.slice();
                recNext[tempIdx] = savedRec;
                this.records = recNext;

                if (hIdx2 !== -1) {
                    await this.gateway.updateHabit(this.habits[hIdx2]);
                }

                return savedRec;
            } catch (err) {
                /* Rollback record */
                this.records = this.records.filter(function (r) {
                    return !(r.habitId === habitId && r.date === date && !r.id);
                });
                if (hIdx2 !== -1) {
                    var rbHabits2 = this.habits.slice();
                    rbHabits2[hIdx2] = h2;
                    this.habits = rbHabits2;
                }
                this.eventBus.publish('habits:error', err.message);
                this.eventBus.publish('habits:changed', this.getStateSnapshot());
                return null;
            }
        }
    }

    /**
     * Explicitly mark a habit complete on a date (no toggle).
     * @param {{ habitId: number, date?: string, note?: string }} payload
     */
    async _markComplete(payload) {
        if (!payload || !payload.habitId) {
            this.eventBus.publish('habits:error', 'MARK_COMPLETE requires a habitId');
            return null;
        }

        var habitId = payload.habitId;
        var date    = payload.date || _today();
        var existing = this._findRecord(habitId, date);

        if (existing) return existing; /* Already complete */

        return this._toggleComplete({ habitId: habitId, date: date });
    }

    /**
     * Explicitly unmark a habit on a date (no toggle).
     * @param {{ habitId: number, date?: string }} payload
     */
    async _unmarkComplete(payload) {
        if (!payload || !payload.habitId) return null;

        var habitId = payload.habitId;
        var date    = payload.date || _today();
        var existing = this._findRecord(habitId, date);

        if (!existing) return null; /* Already unmarked */

        return this._toggleComplete({ habitId: habitId, date: date });
    }

    /**
     * Update a completion record's note.
     * @param {{ id: number, note?: string }} payload
     */
    async _updateRecord(payload) {
        if (!payload || !payload.id) {
            this.eventBus.publish('habits:error', 'UPDATE_RECORD requires an id');
            return null;
        }

        var index = this._findRecordIndexById(payload.id);
        if (index === -1) {
            this.eventBus.publish('habits:error', 'Record ' + payload.id + ' not found');
            return null;
        }

        var existing = this.records[index];
        var updated = Object.assign({}, existing, payload);
        var next = this.records.slice();
        next[index] = updated;
        this.records = next;

        this.eventBus.publish('habits:record-updated', updated);
        this.eventBus.publish('habits:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateRecord(updated);
        } catch (err) {
            this._rollbackRecord(index, existing);
            this.eventBus.publish('habits:error', err.message);
        }

        return updated;
    }

    /**
     * Delete a completion record by its id.
     * @param {number} recordId
     */
    async _deleteRecord(recordId) {
        var index = this._findRecordIndexById(recordId);
        if (index === -1) return;

        var removed = this.records[index];
        var next = this.records.slice();
        next.splice(index, 1);
        this.records = next;

        /* Decrement currentCount */
        var hIdx = this._findHabitIndex(removed.habitId);
        if (hIdx !== -1) {
            var h = this.habits[hIdx];
            var hNext = this.habits.slice();
            hNext[hIdx] = Object.assign({}, h, {
                currentCount: Math.max(0, (h.currentCount || 0) - 1),
                updatedAt: new Date().toISOString(),
            });
            this.habits = hNext;
        }

        this.eventBus.publish('habits:record-deleted', removed);
        this.eventBus.publish('habits:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteRecord(recordId);
            if (hIdx !== -1) {
                await this.gateway.updateHabit(this.habits[hIdx]);
            }
        } catch (err) {
            var rbRec = this.records.slice();
            rbRec.splice(index, 0, removed);
            this.records = rbRec;
            if (hIdx !== -1) {
                var rbHabits = this.habits.slice();
                rbHabits[hIdx] = h;
                this.habits = rbHabits;
            }
            this.eventBus.publish('habits:rollback', removed);
            this.eventBus.publish('habits:error', err.message);
            this.eventBus.publish('habits:changed', this.getStateSnapshot());
        }
    }

    /* ================================================================
       BULK MUTATORS
       ================================================================ */

    async _importHabits(habitsArray) {
        if (!Array.isArray(habitsArray)) return;
        try {
            await this.gateway.replaceAllHabits(habitsArray);
            this.habits = await this.gateway.getAllHabits();
            this.eventBus.publish('habits:changed', this.getStateSnapshot());
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('habits:error', err.message);
        }
    }

    async _importRecords(recordsArray) {
        if (!Array.isArray(recordsArray)) return;
        try {
            await this.gateway.replaceAllRecords(recordsArray);
            this.records = await this.gateway.getAllRecords();
            this.eventBus.publish('habits:changed', this.getStateSnapshot());
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('habits:error', err.message);
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
            habits:         this.habits,
            records:        this.records,
            loading:        this.loading,
            error:          this.error,
            activeHabits:   this.habits.filter(function (h) { return !h.archived; }),
            archivedHabits: this.habits.filter(function (h) { return !!h.archived; }),
            habitCount:     this.habits.length,
            recordCount:    this.records.length,
        };
    }

    /* ── Habit Selectors ── */

    /**
     * All active (non-archived) habits, sorted by sortOrder.
     */
    getActiveHabits() {
        var active = this.habits.filter(function (h) { return !h.archived; });
        return _sortBySortOrder(active);
    }

    /**
     * All habits including archived, sorted by sortOrder.
     */
    getAllHabits() {
        return _sortBySortOrder(this.habits);
    }

    /**
     * Only archived habits.
     */
    getArchivedHabits() {
        var archived = this.habits.filter(function (h) { return !!h.archived; });
        return _sortByCreated(archived);
    }

    // YAGNI: Removed getHabitsByFrequency, getHabitsByCategory (never called)
    /**
     * Habits that are due on a specific date.
     * @param {string} dateStr — "YYYY-MM-DD" (defaults to today)
     */
    getHabitsDueOnDate(dateStr) {
        dateStr = dateStr || _today();
        return this.getActiveHabits().filter(function (h) {
            return _isHabitDueOnDay(h, dateStr);
        });
    }

    /**
     * Single habit by id.
     * @param {number} id
     * @returns {Object|null}
     */
    getHabitById(id) {
        for (var i = 0; i < this.habits.length; i++) {
            if (this.habits[i].id === id) return this.habits[i];
        }
        return null;
    }

    /* ── Record Selectors ── */

    /**
     * All completion records for a specific habit, sorted by date descending.
     * @param {number} habitId
     */
    getRecordsByHabitId(habitId) {
        var filtered = this.records.filter(function (r) { return r.habitId === habitId; });
        return filtered.sort(function (a, b) { return b.date.localeCompare(a.date); });
    }

    /**
     * All completion records for a specific date.
     * @param {string} dateStr — "YYYY-MM-DD" (defaults to today)
     */
    getRecordsByDate(dateStr) {
        dateStr = dateStr || _today();
        return this.records.filter(function (r) { return r.date === dateStr; });
    }

    /**
     * All records within a date range [from, to] inclusive.
     * @param {string} from — "YYYY-MM-DD"
     * @param {string} to   — "YYYY-MM-DD"
     */
    getRecordsByDateRange(from, to) {
        return this.records.filter(function (r) {
            return r.date >= from && r.date <= to;
        });
    }

    /**
     * Check if a specific habit is completed on a date.
     * @param {number} habitId
     * @param {string} dateStr — "YYYY-MM-DD" (defaults to today)
     * @returns {boolean}
     */
    isHabitCompletedOnDate(habitId, dateStr) {
        dateStr = dateStr || _today();
        for (var i = 0; i < this.records.length; i++) {
            if (this.records[i].habitId === habitId && this.records[i].date === dateStr) {
                return true;
            }
        }
        return false;
    }

    /* ================================================================
       STREAK COMPUTATION — Derived on demand
       ================================================================ */

    /**
     * Compute the current streak for a habit.
     *
     * A streak is the number of CONSECUTIVE due-days (ending today
     * or yesterday) on which the habit was completed.
     *
     * - Daily: streak counts consecutive calendar days.
     * - Weekly: streak counts consecutive scheduled weekdays
     *   (skipping non-scheduled days — they don't break the streak).
     * - Monthly: streak counts consecutive target-days-of-month.
     *
     * If the habit is due today and not yet completed, the streak
     * is counted up to yesterday (grace period for today).
     *
     * @param {number} habitId
     * @returns {number} current streak length
     */
    getStreak(habitId) {
        var habit = this.getHabitById(habitId);
        if (!habit) return 0;

        var habitRecords = this.getRecordsByHabitId(habitId);
        var completed = _recordDateSet(habitRecords);
        var today = _today();
        var freq = habit.frequency || 'daily';

        if (freq === 'daily') {
            return _computeDailyStreak(completed, today);
        }

        if (freq === 'weekly') {
            return _computeWeeklyStreak(habit, completed, today);
        }

        if (freq === 'monthly') {
            return _computeMonthlyStreak(habit, completed, today);
        }

        return 0;
    }

    /**
     * Compute the best (longest ever) streak for a habit.
     * Walks the full history — more expensive than getStreak().
     * @param {number} habitId
     * @returns {number}
     */
    getBestStreak(habitId) {
        var habit = this.getHabitById(habitId);
        if (!habit) return 0;

        var habitRecords = this.getRecordsByHabitId(habitId);
        if (habitRecords.length === 0) return 0;

        var completed = _recordDateSet(habitRecords);
        var freq = habit.frequency || 'daily';

        if (freq === 'daily') {
            return _computeBestDailyStreak(completed, habitRecords);
        }

        if (freq === 'weekly') {
            return _computeBestWeeklyStreak(habit, completed, habitRecords);
        }

        if (freq === 'monthly') {
            return _computeBestMonthlyStreak(habit, completed, habitRecords);
        }

        return 0;
    }

    /**
     * Compute the completion rate for a habit over the last N days.
     * @param {number} habitId
     * @param {number} days — lookback window (default 30)
     * @returns {number} 0-100 percentage
     */
    getCompletionRate(habitId, days) {
        days = days || 30;
        var habit = this.getHabitById(habitId);
        if (!habit) return 0;

        var today = _today();
        var from  = _subDays(today, days - 1);
        var completedCount = 0;
        var dueCount = 0;

        var d = from;
        for (var i = 0; i < days; i++) {
            if (_isHabitDueOnDay(habit, d)) {
                dueCount++;
                if (this.isHabitCompletedOnDate(habitId, d)) {
                    completedCount++;
                }
            }
            d = _addDays(d, 1);
        }

        return dueCount > 0 ? Math.round((completedCount / dueCount) * 100) : 0;
    }

    /* ================================================================
       AGGREGATIONS — Pure derivations for summary/stats
       ================================================================ */

    /**
     * Today's overview: how many due, how many completed.
     */
    getTodaySummary() {
        var today = _today();
        var dueHabits  = this.getHabitsDueOnDate(today);
        var completedCount = 0;

        for (var i = 0; i < dueHabits.length; i++) {
            if (this.isHabitCompletedOnDate(dueHabits[i].id, today)) {
                completedCount++;
            }
        }

        return {
            date:         today,
            totalDue:     dueHabits.length,
            completed:    completedCount,
            remaining:    dueHabits.length - completedCount,
            percentage:   dueHabits.length > 0
                ? Math.round((completedCount / dueHabits.length) * 100)
                : 0,
        };
    }

    /**
     * Compute streaks for all active habits.
     * Returns array of { habit, streak, bestStreak, completionRate }.
     */
    getAllStreaks() {
        var active = this.getActiveHabits();
        var result = [];
        for (var i = 0; i < active.length; i++) {
            result.push({
                habit:           active[i],
                streak:          this.getStreak(active[i].id),
                bestStreak:      this.getBestStreak(active[i].id),
                completionRate:  this.getCompletionRate(active[i].id),
            });
        }
        return result;
    }

    /**
     * Monthly completion data for a specific habit.
     * Returns array of objects: { date, completed, due } for the
     * last 30 days.
     * @param {number} habitId
     */
    getMonthlyData(habitId) {
        var habit = this.getHabitById(habitId);
        if (!habit) return [];

        var today = _today();
        var result = [];
        for (var i = 29; i >= 0; i--) {
            var d = _subDays(today, i);
            result.push({
                date:      d,
                completed: this.isHabitCompletedOnDate(habitId, d),
                due:       _isHabitDueOnDay(habit, d),
            });
        }
        return result;
    }

    /**
     * Overall stats for the summary dashboard.
     */
    getStats() {
        var active   = this.getActiveHabits();
        var archived = this.getArchivedHabits();
        var today    = _today();

        var totalCompleted = 0;
        var totalDue       = 0;
        var streaks        = [];

        for (var i = 0; i < active.length; i++) {
            var habit = active[i];
            var dueToday = _isHabitDueOnDay(habit, today);
            if (dueToday) {
                totalDue++;
                if (this.isHabitCompletedOnDate(habit.id, today)) {
                    totalCompleted++;
                }
            }
            streaks.push(this.getStreak(habit.id));
        }

        var longestCurrent = 0;
        var totalStreak = 0;
        for (var j = 0; j < streaks.length; j++) {
            totalStreak += streaks[j];
            if (streaks[j] > longestCurrent) longestCurrent = streaks[j];
        }

        var avgStreak = streaks.length > 0 ? Math.round(totalStreak / streaks.length) : 0;

        return {
            totalHabits:    active.length,
            archivedHabits: archived.length,
            totalRecords:   this.records.length,
            todayDue:       totalDue,
            todayCompleted: totalCompleted,
            todayRemaining: totalDue - totalCompleted,
            longestStreak:  longestCurrent,
            averageStreak:  avgStreak,
        };
    }

    /**
     * Flatten unique categories from active habits.
     * @returns {string[]}
     */
    getAllCategories() {
        var seen = {};
        var result = [];
        var active = this.getActiveHabits();
        for (var i = 0; i < active.length; i++) {
            var cat = active[i].category || 'other';
            if (!seen[cat]) {
                seen[cat] = true;
                result.push(cat);
            }
        }
        return result.sort();
    }

    /* ================================================================
       EXPORT / IMPORT — Convenience wrappers
       ================================================================ */

    /**
     * Export all habit data as a single object.
     * @returns {Promise<{habits: Object[], records: Object[]}>}
     */
    async exportAll() {
        return this.gateway.exportAll();
    }

    /**
     * Import all habit data, replacing existing.
     * @param {{ habits?: Object[], records?: Object[] }} data
     */
    async importAll(data) {
        await this.gateway.importAll(data);
        this.habits  = await this.gateway.getAllHabits();
        this.records = await this.gateway.getAllRecords();
        this.eventBus.publish('habits:changed', this.getStateSnapshot());
    }

    /* ================================================================
       INTERNAL HELPERS
       ================================================================ */

    _findHabitIndex(id) {
        for (var i = 0; i < this.habits.length; i++) {
            if (this.habits[i].id === id) return i;
        }
        return -1;
    }

    _findRecordIndex(id) {
        for (var i = 0; i < this.records.length; i++) {
            if (this.records[i].id === id) return i;
        }
        return -1;
    }

    _findRecordIndexById(id) {
        for (var i = 0; i < this.records.length; i++) {
            if (this.records[i].id === id) return i;
        }
        return -1;
    }

    _findRecord(habitId, date) {
        for (var i = 0; i < this.records.length; i++) {
            if (this.records[i].habitId === habitId && this.records[i].date === date) {
                return this.records[i];
            }
        }
        return null;
    }

    _rollbackHabit(index, original) {
        var rollback = this.habits.slice();
        rollback[index] = original;
        this.habits = rollback;
        this.eventBus.publish('habits:rollback', original);
        this.eventBus.publish('habits:changed', this.getStateSnapshot());
    }

    _rollbackRecord(index, original) {
        var rollback = this.records.slice();
        rollback[index] = original;
        this.records = rollback;
        this.eventBus.publish('habits:rollback', original);
        this.eventBus.publish('habits:changed', this.getStateSnapshot());
    }
}

/* ================================================================
   STREAK COMPUTATION — Pure functions (no store dependency)
   ================================================================ */

/**
 * Daily streak: count consecutive calendar days backward from today
 * (or yesterday if today is not yet completed).
 * @param {Object} completedSet — { "YYYY-MM-DD": true }
 * @param {string} today
 * @returns {number}
 */
function _computeDailyStreak(completedSet, today) {
    var streak = 0;
    var d = today;

    /* If today is not completed, start from yesterday (grace period) */
    if (!completedSet[d]) {
        d = _subDays(d, 1);
    }

    /* Walk backward while consecutive days are completed */
    while (completedSet[d]) {
        streak++;
        d = _subDays(d, 1);
    }

    return streak;
}

/**
 * Weekly streak: count consecutive scheduled weekdays backward.
 * Non-scheduled days are skipped (they don't break the streak).
 * @param {Object} habit
 * @param {Object} completedSet
 * @param {string} today
 * @returns {number}
 */
function _computeWeeklyStreak(habit, completedSet, today) {
    var scheduledDays = habit.frequencyDays || [];
    if (scheduledDays.length === 0) return 0;

    /* Walk backward up to 365 days (1 year max) looking for scheduled days */
    var streak = 0;
    var d = today;
    var maxLookback = 365;

    /* If today is a scheduled day and not completed, start from previous scheduled day */
    if (_isHabitDueOnDay(habit, d) && !completedSet[d]) {
        d = _subDays(d, 1);
    }

    /* Find the most recent scheduled day at or before d */
    while (maxLookback > 0) {
        if (_isHabitDueOnDay(habit, d)) {
            if (completedSet[d]) {
                streak++;
            } else {
                break; /* Missed a scheduled day → streak ends */
            }
        }
        d = _subDays(d, 1);
        maxLookback--;
    }

    return streak;
}

/**
 * Monthly streak: count consecutive target-days-of-month backward.
 * @param {Object} habit
 * @param {Object} completedSet
 * @param {string} today
 * @returns {number}
 */
function _computeMonthlyStreak(habit, completedSet, today) {
    var targetDay = habit.frequencyDay || 1;
    var streak = 0;
    var d = today;
    var maxMonths = 120; /* 10 years max */

    /* If today is the target day and not completed, start from last month's target */
    if (_dayOfMonth(d) === targetDay && !completedSet[d]) {
        d = _subDays(d, 31); /* Rough jump to previous month */
        /* Snap to the target day of that month */
        d = _snapToTargetDay(d, targetDay);
    } else if (_dayOfMonth(d) !== targetDay) {
        /* Today is not the target day — check if we're past this month's target day */
        if (_dayOfMonth(d) > targetDay) {
            /* This month's target day has passed — check it */
            var thisMonthTarget = _snapToTargetDay(d, targetDay);
            if (completedSet[thisMonthTarget]) {
                streak++;
            } else {
                return 0;
            }
        }
        /* Move to previous month's target day */
        d = _subDays(d, 31);
        d = _snapToTargetDay(d, targetDay);
    }

    while (maxMonths > 0) {
        var checkDate = _snapToTargetDay(d, targetDay);
        if (completedSet[checkDate]) {
            streak++;
        } else {
            break;
        }
        /* Move to previous month */
        d = _subDays(checkDate, 1);
        d = _snapToTargetDay(d, targetDay);
        maxMonths--;
    }

    return streak;
}

/**
 * Snap a date to a target day-of-month.
 * If the target day doesn't exist in the month (e.g. Feb 31),
 * snaps to the last day of that month.
 * @param {string} dateStr
 * @param {number} targetDay — 1-31
 * @returns {string} "YYYY-MM-DD"
 */
function _snapToTargetDay(dateStr, targetDay) {
    var parts = dateStr.split('-');
    var year  = parseInt(parts[0]);
    var month = parseInt(parts[1]) - 1; /* 0-indexed */
    var maxDay = new Date(year, month + 1, 0).getDate();
    var day = Math.min(targetDay, maxDay);
    return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/**
 * Best daily streak: walk the entire history to find the longest
 * unbroken run of consecutive completed days.
 * @param {Object} completedSet
 * @param {Object[]} records
 * @returns {number}
 */
function _computeBestDailyStreak(completedSet, records) {
    if (records.length === 0) return 0;

    /* Collect all completed dates, sorted */
    var dates = [];
    for (var k in completedSet) {
        if (completedSet.hasOwnProperty(k)) dates.push(k);
    }
    dates.sort();

    var best = 0;
    var current = 1;

    for (var i = 1; i < dates.length; i++) {
        if (_diffDays(dates[i], dates[i - 1]) === 1) {
            current++;
        } else {
            if (current > best) best = current;
            current = 1;
        }
    }
    if (current > best) best = current;

    return best;
}

/**
 * Best weekly streak: find the longest run of consecutive
 * completed scheduled weekdays.
 * @param {Object} habit
 * @param {Object} completedSet
 * @param {Object[]} records
 * @returns {number}
 */
function _computeBestWeeklyStreak(habit, completedSet, records) {
    if (records.length === 0) return 0;

    /* Collect all scheduled days from first record to today */
    var dates = [];
    for (var k in completedSet) {
        if (completedSet.hasOwnProperty(k)) dates.push(k);
    }
    dates.sort();

    var firstDate = dates[0];
    var lastDate  = dates[dates.length - 1];
    var scheduledDays = [];

    var d = firstDate;
    while (d <= lastDate) {
        if (_isHabitDueOnDay(habit, d)) {
            scheduledDays.push(d);
        }
        d = _addDays(d, 1);
    }

    var best = 0;
    var current = 0;

    for (var i = 0; i < scheduledDays.length; i++) {
        if (completedSet[scheduledDays[i]]) {
            current++;
        } else {
            if (current > best) best = current;
            current = 0;
        }
    }
    if (current > best) best = current;

    return best;
}

/**
 * Best monthly streak: find the longest run of consecutive
 * completed target-days-of-month.
 * @param {Object} habit
 * @param {Object} completedSet
 * @param {Object[]} records
 * @returns {number}
 */
function _computeBestMonthlyStreak(habit, completedSet, records) {
    if (records.length === 0) return 0;

    var dates = [];
    for (var k in completedSet) {
        if (completedSet.hasOwnProperty(k)) dates.push(k);
    }
    dates.sort();

    var targetDay = habit.frequencyDay || 1;
    var best = 0;
    var current = 0;

    /* Walk month-by-month from the first record's month to the last */
    var firstParts = dates[0].split('-');
    var lastParts  = dates[dates.length - 1].split('-');
    var y = parseInt(firstParts[0]);
    var m = parseInt(firstParts[1]) - 1;

    var endY = parseInt(lastParts[0]);
    var endM = parseInt(lastParts[1]) - 1;

    while (y < endY || (y === endY && m <= endM)) {
        var maxDay = new Date(y, m + 1, 0).getDate();
        var day = Math.min(targetDay, maxDay);
        var checkDate = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');

        if (completedSet[checkDate]) {
            current++;
        } else {
            if (current > best) best = current;
            current = 0;
        }

        m++;
        if (m > 11) { m = 0; y++; }
    }
    if (current > best) best = current;

    return best;
}

/* ── Exports for reference ───────────────────────────────── */

export var FREQUENCY = Object.freeze({
    DAILY:   'daily',
    WEEKLY:  'weekly',
    MONTHLY: 'monthly',
});

export var FREQUENCY_LABELS = FREQ_LABELS;
export var DAY_LABELS = DAY_NAMES;

export { _today as today, _parseDate as parseDate, _toISO as toISO, _addDays as addDays };
