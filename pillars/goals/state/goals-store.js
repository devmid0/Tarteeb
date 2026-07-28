/**
 * Tarteeb — Goals & Projects State Store
 *
 * Unidirectional data flow within the Goals pillar:
 *
 *   View ──dispatch(action)──▶ GoalsStore ──publish──▶ EventBus
 *              │                                       │
 *              ▼                                       ▼
 *        gateway.create()                    View re-renders
 *        gateway.update()
 *        gateway.delete()
 *
 * Invariants:
 *   - State mutations ONLY via dispatch() — never direct assignment.
 *   - Every mutation publishes 'goals:changed' with a full state
 *     snapshot.  This is the SINGLE re-render trigger for views.
 *   - Gateway writes are optimistic: local state mutates immediately,
 *     then the gateway write fires async.  On failure the store
 *     rolls back to the previous snapshot and publishes
 *     'goals:rollback'.
 *   - Selectors are pure derivations of the in-memory arrays.
 *     They never mutate state.
 *
 * Goal shape:
 *   { id, title, description, emoji, category, priority, status,
 *     deadline, createdAt, completedAt, updatedAt }
 *
 * Milestone (sub-project) shape:
 *   { id, goalId, title, description, isCompleted, completedAt,
 *     sortOrder, createdAt, updatedAt }
 */

'use strict';

import {
    PRIORITY, PRIORITY_LABELS, STATUS,
    validateGoal, validateMilestone,
    computeProgress, sortByDeadline, sortMilestones,
} from '../domain/goal-rules.js';

/* ── Store ────────────────────────────────────────────────── */

export class GoalsStore {
    /**
     * @param {import('../../../core/events/event-bus.js').EventBus} eventBus
     * @param {import('../../../persistence/gateways/goals-gateway.js').GoalsGateway} goalsGateway
     */
    constructor(eventBus, goalsGateway) {
        this.eventBus = eventBus;
        this.gateway  = goalsGateway;

        /* ── Core state ── */
        this.goals      = [];
        this.milestones = [];
        this.loading    = false;
        this.error      = null;
    }

    /* ================================================================
       HYDRATION
       ================================================================ */

    /**
     * Load all goals and milestones from IndexedDB.
     * Publishes: goals:loading, goals:hydrated (or goals:error)
     */
    async hydrate() {
        this.loading = true;
        this.eventBus.publish('goals:loading', true);

        try {
            var results = await Promise.all([
                this.gateway.getAllGoals(),
                this.gateway.getAllMilestones(),
            ]);
            this.goals      = results[0];
            this.milestones = results[1];
            this.error      = null;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('goals:error', err.message);
        } finally {
            this.loading = false;
            this.eventBus.publish('goals:loading', false);
            this.eventBus.publish('goals:hydrated', this.getStateSnapshot());
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
            /* ── Goal CRUD ── */
            case 'ADD_GOAL':        return this._addGoal(action.payload);
            case 'UPDATE_GOAL':     return this._updateGoal(action.payload);
            case 'DELETE_GOAL':     return this._deleteGoal(action.payload);

            /* ── Goal Status ── */
            case 'COMPLETE_GOAL':   return this._setGoalStatus(action.payload, 'completed');
            case 'ABANDON_GOAL':    return this._setGoalStatus(action.payload, 'abandoned');
            case 'RESTORE_GOAL':    return this._setGoalStatus(action.payload, 'active');

            /* ── Milestone (Sub-Project) CRUD ── */
            case 'ADD_MILESTONE':      return this._addMilestone(action.payload);
            case 'UPDATE_MILESTONE':   return this._updateMilestone(action.payload);
            case 'DELETE_MILESTONE':   return this._deleteMilestone(action.payload);
            case 'TOGGLE_MILESTONE':   return this._toggleMilestone(action.payload);
            case 'REORDER_MILESTONES': return this._reorderMilestones(action.payload);

            /* ── Bulk ── */
            case 'IMPORT_GOALS':       return this._importGoals(action.payload);
            case 'IMPORT_MILESTONES':  return this._importMilestones(action.payload);

            default:
                console.warn('[GoalsStore] Unknown action:', action.type);
                return null;
        }
    }

    /* ================================================================
       GOAL MUTATORS
       ================================================================ */

    async _addGoal(raw) {
        var now = new Date().toISOString();
        var data = {
            title:       (raw.title || '').trim(),
            description: (raw.description || '').trim(),
            emoji:       raw.emoji || '\uD83C\uDFAF',
            category:    (raw.category || 'general').trim(),
            priority:    raw.priority || 'medium',
            status:      'active',
            deadline:    raw.deadline || null,
            createdAt:   now,
            completedAt: null,
            updatedAt:   now,
        };

        var errors = validateGoal(data);
        if (errors.length > 0) {
            this.eventBus.publish('goals:validation-error', errors);
            return null;
        }

        try {
            var saved = await this.gateway.createGoal(data);
            this.goals = this.goals.concat([saved]);
            this.eventBus.publish('goals:goal-added', saved);
            this.eventBus.publish('goals:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('goals:error', err.message);
            return null;
        }
    }

    async _updateGoal(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('goals:error', 'UPDATE_GOAL requires an id');
            return null;
        }

        var index = this._findGoalIndex(patch.id);
        if (index === -1) {
            this.eventBus.publish('goals:error', 'Goal ' + patch.id + ' not found');
            return null;
        }

        var existing = this.goals[index];

        /* Normalize mutable fields */
        if (patch.title !== undefined)       patch.title = String(patch.title).trim();
        if (patch.description !== undefined) patch.description = String(patch.description).trim();
        if (patch.category !== undefined)    patch.category = String(patch.category).trim();

        patch.updatedAt = new Date().toISOString();
        var updated = Object.assign({}, existing, patch);

        /* Optimistic: replace in local array */
        var next = this.goals.slice();
        next[index] = updated;
        this.goals = next;

        this.eventBus.publish('goals:goal-updated', updated);
        this.eventBus.publish('goals:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateGoal(updated);
        } catch (err) {
            this._rollbackGoal(index, existing);
            this.eventBus.publish('goals:error', err.message);
        }

        return updated;
    }

    async _deleteGoal(id) {
        var index = this._findGoalIndex(id);
        if (index === -1) return;

        var removed = this.goals[index];
        var next = this.goals.slice();
        next.splice(index, 1);
        this.goals = next;

        /* Also remove all milestones for this goal from memory */
        var removedMilestones = this.milestones.filter(function (m) { return m.goalId === id; });
        this.milestones = this.milestones.filter(function (m) { return m.goalId !== id; });

        this.eventBus.publish('goals:goal-deleted', removed);
        this.eventBus.publish('goals:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteGoal(id);
            await this.gateway.deleteAllMilestonesForGoal(id);
        } catch (err) {
            /* Rollback goal */
            var rollback = this.goals.slice();
            rollback.splice(index, 0, removed);
            this.goals = rollback;
            /* Rollback milestones */
            this.milestones = this.milestones.concat(removedMilestones);
            this.eventBus.publish('goals:rollback', removed);
            this.eventBus.publish('goals:error', err.message);
            this.eventBus.publish('goals:changed', this.getStateSnapshot());
        }
    }

    /**
     * Set or change a goal's status.
     * @param {number} id — goal id
     * @param {string} status — 'active' | 'completed' | 'abandoned'
     */
    async _setGoalStatus(id, status) {
        var index = this._findGoalIndex(id);
        if (index === -1) return null;

        var existing = this.goals[index];
        if (existing.status === status) return existing;

        var now = new Date().toISOString();
        var patch = {
            status:      status,
            updatedAt:   now,
            completedAt: status === 'completed' ? now : null,
        };

        var updated = Object.assign({}, existing, patch);

        var next = this.goals.slice();
        next[index] = updated;
        this.goals = next;

        this.eventBus.publish('goals:goal-updated', updated);
        this.eventBus.publish('goals:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateGoal(updated);
        } catch (err) {
            this._rollbackGoal(index, existing);
            this.eventBus.publish('goals:error', err.message);
        }

        return updated;
    }

    /* ================================================================
       MILESTONE (SUB-PROJECT) MUTATORS
       ================================================================ */

    async _addMilestone(raw) {
        if (!raw || !raw.goalId) {
            this.eventBus.publish('goals:error', 'ADD_MILESTONE requires a goalId');
            return null;
        }

        var goalIndex = this._findGoalIndex(raw.goalId);
        if (goalIndex === -1) {
            this.eventBus.publish('goals:error', 'Goal ' + raw.goalId + ' not found');
            return null;
        }

        /* Count existing milestones for sortOrder */
        var existingCount = this.milestones.filter(function (m) {
            return m.goalId === raw.goalId;
        }).length;

        var now = new Date().toISOString();
        var data = {
            goalId:      raw.goalId,
            title:       (raw.title || '').trim(),
            description: (raw.description || '').trim(),
            isCompleted: false,
            completedAt: null,
            sortOrder:   raw.sortOrder != null ? raw.sortOrder : existingCount,
            createdAt:   now,
            updatedAt:   now,
        };

        var errors = validateMilestone(data);
        if (errors.length > 0) {
            this.eventBus.publish('goals:validation-error', errors);
            return null;
        }

        try {
            var saved = await this.gateway.createMilestone(data);
            this.milestones = this.milestones.concat([saved]);
            this.eventBus.publish('goals:milestone-added', saved);
            this.eventBus.publish('goals:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('goals:error', err.message);
            return null;
        }
    }

    async _updateMilestone(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('goals:error', 'UPDATE_MILESTONE requires an id');
            return null;
        }

        var index = this._findMilestoneIndex(patch.id);
        if (index === -1) {
            this.eventBus.publish('goals:error', 'Milestone ' + patch.id + ' not found');
            return null;
        }

        var existing = this.milestones[index];

        if (patch.title !== undefined)       patch.title = String(patch.title).trim();
        if (patch.description !== undefined) patch.description = String(patch.description).trim();

        patch.updatedAt = new Date().toISOString();
        var updated = Object.assign({}, existing, patch);

        var next = this.milestones.slice();
        next[index] = updated;
        this.milestones = next;

        this.eventBus.publish('goals:milestone-updated', updated);
        this.eventBus.publish('goals:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateMilestone(updated);
        } catch (err) {
            this._rollbackMilestone(index, existing);
            this.eventBus.publish('goals:error', err.message);
        }

        return updated;
    }

    async _deleteMilestone(id) {
        var index = this._findMilestoneIndex(id);
        if (index === -1) return;

        var removed = this.milestones[index];
        var next = this.milestones.slice();
        next.splice(index, 1);
        this.milestones = next;

        this.eventBus.publish('goals:milestone-deleted', removed);
        this.eventBus.publish('goals:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteMilestone(id);
        } catch (err) {
            var rollback = this.milestones.slice();
            rollback.splice(index, 0, removed);
            this.milestones = rollback;
            this.eventBus.publish('goals:rollback', removed);
            this.eventBus.publish('goals:error', err.message);
            this.eventBus.publish('goals:changed', this.getStateSnapshot());
        }
    }

    /**
     * Toggle a milestone's completion status.
     * @param {number} id — milestone id
     */
    async _toggleMilestone(id) {
        var index = this._findMilestoneIndex(id);
        if (index === -1) return null;

        var existing = this.milestones[index];
        var now = new Date().toISOString();
        var isCompleted = !existing.isCompleted;

        var updated = Object.assign({}, existing, {
            isCompleted: isCompleted,
            completedAt: isCompleted ? now : null,
            updatedAt:   now,
        });

        var next = this.milestones.slice();
        next[index] = updated;
        this.milestones = next;

        this.eventBus.publish('goals:milestone-updated', updated);
        this.eventBus.publish('goals:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateMilestone(updated);
        } catch (err) {
            this._rollbackMilestone(index, existing);
            this.eventBus.publish('goals:error', err.message);
        }

        return updated;
    }

    /**
     * Reorder milestones for a specific goal.
     * @param {{ goalId: number, milestoneIds: number[] }} payload
     */
    async _reorderMilestones(payload) {
        if (!payload || !payload.goalId || !Array.isArray(payload.milestoneIds)) {
            this.eventBus.publish('goals:error', 'REORDER_MILESTONES requires goalId and milestoneIds');
            return null;
        }

        var goalIndex = this._findGoalIndex(payload.goalId);
        if (goalIndex === -1) {
            this.eventBus.publish('goals:error', 'Goal ' + payload.goalId + ' not found');
            return null;
        }

        /* Snapshot existing milestones for rollback */
        var affectedIndices = [];
        var originals = [];
        for (var i = 0; i < payload.milestoneIds.length; i++) {
            var idx = this._findMilestoneIndex(payload.milestoneIds[i]);
            if (idx !== -1) {
                affectedIndices.push(idx);
                originals.push(this.milestones[idx]);
            }
        }

        /* Optimistic: update sortOrder in local array */
        var next = this.milestones.slice();
        for (var j = 0; j < payload.milestoneIds.length; j++) {
            var mIdx = this._findMilestoneIndexInArray(next, payload.milestoneIds[j]);
            if (mIdx !== -1) {
                var patch = Object.assign({}, next[mIdx], {
                    sortOrder: j,
                    updatedAt: new Date().toISOString(),
                });
                next[mIdx] = patch;
            }
        }
        this.milestones = next;

        this.eventBus.publish('goals:changed', this.getStateSnapshot());

        /* Gateway writes — persist each reordered milestone */
        try {
            for (var k = 0; k < payload.milestoneIds.length; k++) {
                var updated = this.milestones[this._findMilestoneIndex(payload.milestoneIds[k])];
                if (updated) {
                    await this.gateway.updateMilestone(updated);
                }
            }
        } catch (err) {
            /* Rollback all affected milestones */
            var rb = this.milestones.slice();
            for (var r = 0; r < affectedIndices.length; r++) {
                rb[affectedIndices[r]] = originals[r];
            }
            this.milestones = rb;
            this.eventBus.publish('goals:rollback', originals);
            this.eventBus.publish('goals:error', err.message);
            this.eventBus.publish('goals:changed', this.getStateSnapshot());
        }

        return true;
    }

    /* ================================================================
       BULK MUTATORS
       ================================================================ */

    async _importGoals(goalsArray) {
        if (!Array.isArray(goalsArray)) return;
        try {
            await this.gateway.replaceAllGoals(goalsArray);
            this.goals = await this.gateway.getAllGoals();
            this.eventBus.publish('goals:changed', this.getStateSnapshot());
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('goals:error', err.message);
        }
    }

    async _importMilestones(milestonesArray) {
        if (!Array.isArray(milestonesArray)) return;
        try {
            await this.gateway.replaceAllMilestones(milestonesArray);
            this.milestones = await this.gateway.getAllMilestones();
            this.eventBus.publish('goals:changed', this.getStateSnapshot());
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('goals:error', err.message);
        }
    }

    /* ================================================================
       SELECTORS — Pure derivations of in-memory state
       ================================================================ */

    /**
     * Full state snapshot for the single re-render trigger.
     */
    getStateSnapshot() {
        var active    = this.goals.filter(function (g) { return g.status === 'active'; });
        var completed = this.goals.filter(function (g) { return g.status === 'completed'; });
        var abandoned = this.goals.filter(function (g) { return g.status === 'abandoned'; });

        return {
            goals:           this.goals,
            milestones:      this.milestones,
            loading:         this.loading,
            error:           this.error,
            activeGoals:     active,
            completedGoals:  completed,
            abandonedGoals:  abandoned,
            goalCount:       this.goals.length,
            milestoneCount:  this.milestones.length,
            stats:           this._computeStats(active, completed, abandoned),
        };
    }

    /* ── Goal Selectors ── */

    /**
     * All active goals, sorted by deadline (closest first).
     */
    getActiveGoals() {
        var active = this.goals.filter(function (g) { return g.status === 'active'; });
        return sortByDeadline(active);
    }

    /**
     * All completed goals, sorted by completedAt descending.
     */
    getCompletedGoals() {
        var completed = this.goals.filter(function (g) { return g.status === 'completed'; });
        return completed.slice().sort(function (a, b) {
            return (b.completedAt || '').localeCompare(a.completedAt || '');
        });
    }

    /**
     * All abandoned goals.
     */
    getAbandonedGoals() {
        return this.goals.filter(function (g) { return g.status === 'abandoned'; });
    }

    /**
     * Single goal by id.
     * @param {number} id
     * @returns {Object|null}
     */
    getGoalById(id) {
        for (var i = 0; i < this.goals.length; i++) {
            if (this.goals[i].id === id) return this.goals[i];
        }
        return null;
    }

    /**
     * Goals filtered by category.
     * @param {string} category
     * @returns {Object[]}
     */
    getGoalsByCategory(category) {
        return this.goals.filter(function (g) {
            return (g.category || 'general') === category;
        });
    }

    /**
     * Goals filtered by priority level.
     * @param {string} priority — 'high' | 'medium' | 'low'
     * @returns {Object[]}
     */
    getGoalsByPriority(priority) {
        return this.goals.filter(function (g) { return g.priority === priority; });
    }

    // YAGNI: Removed getOverdueGoals (stats section computes this inline)
    /**
     * Goals with no milestones attached.
     * @returns {Object[]}
     */
    getGoalsWithoutMilestones() {
        var self = this;
        return this.goals.filter(function (g) {
            if (g.status !== 'active') return false;
            for (var i = 0; i < self.milestones.length; i++) {
                if (self.milestones[i].goalId === g.id) return false;
            }
            return true;
        });
    }

    /* ── Milestone (Sub-Project) Selectors ── */

    /**
     * All milestones for a specific goal, sorted by sortOrder.
     * @param {number} goalId
     */
    getMilestonesByGoalId(goalId) {
        var filtered = this.milestones.filter(function (m) { return m.goalId === goalId; });
        return sortMilestones(filtered);
    }

    // YAGNI: Removed getMilestoneById, getCompletedMilestonesByGoalId,
    // getIncompleteMilestonesByGoalId (never called from any view)
    /**
     * Compute progress for a goal from its in-memory milestones.
     * @param {number} goalId
     * @returns {{ completed: number, total: number, percentage: number }}
     */
    getProgress(goalId) {
        var milestones = this.milestones.filter(function (m) { return m.goalId === goalId; });
        return computeProgress(milestones);
    }

    /**
     * Compute progress for every active goal.
     * @returns {Object} — { [goalId]: { completed, total, percentage } }
     */
    getAllProgress() {
        var active = this.goals.filter(function (g) { return g.status === 'active'; });
        var result = {};
        for (var i = 0; i < active.length; i++) {
            result[active[i].id] = this.getProgress(active[i].id);
        }
        return result;
    }

    /* ================================================================
       AGGREGATIONS — Pure derivations for summary/stats
       ================================================================ */

    /**
     * Overall stats for the summary dashboard.
     * @returns {Object}
     */
    getStats() {
        var active    = this.goals.filter(function (g) { return g.status === 'active'; });
        var completed = this.goals.filter(function (g) { return g.status === 'completed'; });
        var abandoned = this.goals.filter(function (g) { return g.status === 'abandoned'; });
        return this._computeStats(active, completed, abandoned);
    }

    /**
     * Flatten unique categories from all goals.
     * @returns {string[]}
     */
    getAllCategories() {
        var seen = {};
        var result = [];
        for (var i = 0; i < this.goals.length; i++) {
            var cat = this.goals[i].category || 'general';
            if (!seen[cat]) {
                seen[cat] = true;
                result.push(cat);
            }
        }
        return result.sort();
    }

    // YAGNI: Removed getGoalsByCategoryGrouped, getGoalsByPriorityGrouped (never called)

    /**
     * Next N upcoming deadlines from active goals.
     * @param {number} count — how many to return (default 5)
     * @returns {Object[]}
     */
    getUpcomingDeadlines(count) {
        var limit = count || 5;
        var now = new Date();
        now.setHours(0, 0, 0, 0);
        var upcoming = [];
        for (var i = 0; i < this.goals.length; i++) {
            var g = this.goals[i];
            if (g.status !== 'active' || !g.deadline) continue;
            var parts = g.deadline.split('-');
            var target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (target >= now) {
                upcoming.push(g);
            }
        }
        return sortByDeadline(upcoming).slice(0, limit);
    }

    /* ================================================================
       EXPORT / IMPORT — Convenience wrappers
       ================================================================ */

    /**
     * Export all goal data as a single object.
     * @returns {Promise<{goals: Object[], milestones: Object[]}>}
     */
    async exportAll() {
        return this.gateway.exportAll();
    }

    /**
     * Import all goal data, replacing existing.
     * @param {{ goals?: Object[], milestones?: Object[] }} data
     */
    async importAll(data) {
        await this.gateway.importAll(data);
        this.goals      = await this.gateway.getAllGoals();
        this.milestones = await this.gateway.getAllMilestones();
        this.eventBus.publish('goals:changed', this.getStateSnapshot());
    }

    /* ================================================================
       INTERNAL HELPERS
       ================================================================ */

    _findGoalIndex(id) {
        for (var i = 0; i < this.goals.length; i++) {
            if (this.goals[i].id === id) return i;
        }
        return -1;
    }

    _findMilestoneIndex(id) {
        for (var i = 0; i < this.milestones.length; i++) {
            if (this.milestones[i].id === id) return i;
        }
        return -1;
    }

    _findMilestoneIndexInArray(arr, id) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id === id) return i;
        }
        return -1;
    }

    _rollbackGoal(index, original) {
        var rollback = this.goals.slice();
        rollback[index] = original;
        this.goals = rollback;
        this.eventBus.publish('goals:rollback', original);
        this.eventBus.publish('goals:changed', this.getStateSnapshot());
    }

    _rollbackMilestone(index, original) {
        var rollback = this.milestones.slice();
        rollback[index] = original;
        this.milestones = rollback;
        this.eventBus.publish('goals:rollback', original);
        this.eventBus.publish('goals:changed', this.getStateSnapshot());
    }

    /**
     * Compute stats from pre-filtered arrays.
     * @param {Object[]} active
     * @param {Object[]} completed
     * @param {Object[]} abandoned
     * @returns {Object}
     */
    _computeStats(active, completed, abandoned) {
        var now = new Date();
        now.setHours(0, 0, 0, 0);

        /* Count overdue active goals */
        var overdue = 0;
        for (var i = 0; i < active.length; i++) {
            if (active[i].deadline) {
                var parts = active[i].deadline.split('-');
                var target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                if (target < now) overdue++;
            }
        }

        /* Average progress across active goals */
        var totalProgress = 0;
        for (var j = 0; j < active.length; j++) {
            var prog = this.getProgress(active[j].id);
            totalProgress += prog.percentage;
        }
        var avgProgress = active.length > 0 ? Math.round(totalProgress / active.length) : 0;

        return {
            totalGoals:     this.goals.length,
            activeGoals:    active.length,
            completedGoals: completed.length,
            abandonedGoals: abandoned.length,
            overdueGoals:   overdue,
            avgProgress:    avgProgress,
            totalMilestones: this.milestones.length,
        };
    }
}
