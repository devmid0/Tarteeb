/**
 * Tarteeb — Goals & Projects Gateway
 *
 * The SINGLE code path that touches the goals-items and
 * goals-milestones IndexedDB object stores. Every other module
 * must call through this gateway — no direct DB access elsewhere.
 *
 * IndexedDB Schema (goals-items):
 *   keyPath:  id (auto-increment)
 *   indexes:  by-status   (string)  — "active" | "completed" | "abandoned"
 *   indexes:  by-deadline (string)  — "YYYY-MM-DD" or null
 *   indexes:  by-category (string)  — user-defined category label
 *
 * IndexedDB Schema (goals-milestones):
 *   keyPath:  id (auto-increment)
 *   indexes:  by-goal-id   (number)  — all sub-projects for a goal
 *   indexes:  by-completed (number)  — 0 | 1 for filtered queries
 *
 * Goal shape:
 *   { id, title, description, emoji, category, priority, status,
 *     deadline, createdAt, completedAt, updatedAt }
 *
 * Milestone (sub-project) shape:
 *   { id, goalId, title, description, isCompleted, completedAt,
 *     sortOrder, createdAt, updatedAt }
 *
 * Design invariants:
 *   - Gateway is stateless — no internal caches, no side-effects.
 *   - Every method returns a Promise that resolves to plain data.
 *   - Gateway never validates — that is the store's responsibility.
 *   - Gateway never publishes events — that is the store's job.
 */

'use strict';

/* ── Store Names ──────────────────────────────────────────── */

var GOAL_STORE      = 'goals-items';
var MILESTONE_STORE = 'goals-milestones';

/* ── Gateway ──────────────────────────────────────────────── */

export class GoalsGateway {
    /**
     * @param {import('../../persistence/connection/database.js').Database} database
     */
    constructor(database) {
        if (!database) {
            throw new Error('GoalsGateway requires a Database instance');
        }
        this.db = database;
    }

    /* ================================================================
       GOALS — Create
       ================================================================ */

    /**
     * Persist a new goal definition.
     * @param {Object} data — goal object (id omitted; DB assigns it)
     * @returns {Promise<Object>} the saved goal with its new `id`
     */
    async createGoal(data) {
        var id = await this.db.save(GOAL_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    /* ================================================================
       GOALS — Read
       ================================================================ */

    /**
     * Retrieve a single goal by primary key.
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getGoal(id) {
        return this.db.get(GOAL_STORE, id);
    }

    /**
     * Retrieve every goal definition (unsorted).
     * @returns {Promise<Object[]>}
     */
    async getAllGoals() {
        return this.db.getAll(GOAL_STORE);
    }

    /**
     * Retrieve all goals matching a status.
     * @param {string} status — "active" | "completed" | "abandoned"
     * @returns {Promise<Object[]>}
     */
    async getGoalsByStatus(status) {
        return this.db.getByIndex(GOAL_STORE, 'by-status', status);
    }

    /**
     * Retrieve all goals matching a deadline.
     * @param {string} deadline — "YYYY-MM-DD"
     * @returns {Promise<Object[]>}
     */
    async getGoalsByDeadline(deadline) {
        return this.db.getByIndex(GOAL_STORE, 'by-deadline', deadline);
    }

    /**
     * Retrieve all goals matching a category.
     * @param {string} category
     * @returns {Promise<Object[]>}
     */
    async getGoalsByCategory(category) {
        return this.db.getByIndex(GOAL_STORE, 'by-category', category);
    }

    /* ================================================================
       GOALS — Update
       ================================================================ */

    /**
     * Merge-patch an existing goal. Caller must supply `id`.
     * @param {Object} data — must include `id`
     * @returns {Promise<Object>} the fully merged record
     */
    async updateGoal(data) {
        if (!data || !data.id) {
            throw new Error('updateGoal requires a goal with an id');
        }
        await this.db.update(GOAL_STORE, data);
        return data;
    }

    /* ================================================================
       GOALS — Delete
       ================================================================ */

    /**
     * Permanently remove a goal by id.
     * Does NOT cascade-delete its milestones — caller must do that explicitly.
     * @param {number} id
     * @returns {Promise<void>}
     */
    async deleteGoal(id) {
        return this.db.delete(GOAL_STORE, id);
    }

    /* ================================================================
       GOALS — Bulk / Utility
       ================================================================ */

    /**
     * Replace the entire goals-items store with the supplied array.
     * @param {Object[]} goals
     * @returns {Promise<void>}
     */
    async replaceAllGoals(goals) {
        return this.db.importStore(GOAL_STORE, goals || []);
    }

    /**
     * Count all goals in the store.
     * @returns {Promise<number>}
     */
    async countGoals() {
        var all = await this.db.getAll(GOAL_STORE);
        return all.length;
    }

    /* ================================================================
       MILESTONES (Sub-Projects) — Create
       ================================================================ */

    /**
     * Persist a new milestone (sub-project).
     * @param {Object} data — milestone object (id omitted; DB assigns it)
     * @returns {Promise<Object>} the saved milestone with its new `id`
     */
    async createMilestone(data) {
        var id = await this.db.save(MILESTONE_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    /* ================================================================
       MILESTONES (Sub-Projects) — Read
       ================================================================ */

    /**
     * Retrieve a single milestone by primary key.
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getMilestone(id) {
        return this.db.get(MILESTONE_STORE, id);
    }

    /**
     * Retrieve every milestone (unsorted).
     * @returns {Promise<Object[]>}
     */
    async getAllMilestones() {
        return this.db.getAll(MILESTONE_STORE);
    }

    /**
     * Retrieve all milestones for a specific goal.
     * @param {number} goalId
     * @returns {Promise<Object[]>}
     */
    async getMilestonesByGoalId(goalId) {
        return this.db.getByIndex(MILESTONE_STORE, 'by-goal-id', goalId);
    }

    /**
     * Retrieve all completed milestones (isCompleted = 1).
     * @returns {Promise<Object[]>}
     */
    async getCompletedMilestones() {
        return this.db.getByIndex(MILESTONE_STORE, 'by-completed', 1);
    }

    /**
     * Retrieve all incomplete milestones (isCompleted = 0).
     * @returns {Promise<Object[]>}
     */
    async getIncompleteMilestones() {
        return this.db.getByIndex(MILESTONE_STORE, 'by-completed', 0);
    }

    /* ================================================================
       MILESTONES (Sub-Projects) — Update
       ================================================================ */

    /**
     * Merge-patch an existing milestone. Caller must supply `id`.
     * @param {Object} data — must include `id`
     * @returns {Promise<Object>} the fully merged record
     */
    async updateMilestone(data) {
        if (!data || !data.id) {
            throw new Error('updateMilestone requires a milestone with an id');
        }
        await this.db.update(MILESTONE_STORE, data);
        return data;
    }

    /* ================================================================
       MILESTONES (Sub-Projects) — Delete
       ================================================================ */

    /**
     * Permanently remove a milestone by id.
     * @param {number} id
     * @returns {Promise<void>}
     */
    async deleteMilestone(id) {
        return this.db.delete(MILESTONE_STORE, id);
    }

    /**
     * Delete ALL milestones for a specific goal.
     * Used when permanently deleting a goal.
     * @param {number} goalId
     * @returns {Promise<void>}
     */
    async deleteAllMilestonesForGoal(goalId) {
        var milestones = await this.getMilestonesByGoalId(goalId);
        for (var i = 0; i < milestones.length; i++) {
            await this.db.delete(MILESTONE_STORE, milestones[i].id);
        }
    }

    /* ================================================================
       MILESTONES (Sub-Projects) — Bulk / Utility
       ================================================================ */

    /**
     * Replace the entire goals-milestones store with the supplied array.
     * @param {Object[]} milestones
     * @returns {Promise<void>}
     */
    async replaceAllMilestones(milestones) {
        return this.db.importStore(MILESTONE_STORE, milestones || []);
    }

    /**
     * Count all milestones in the store.
     * @returns {Promise<number>}
     */
    async countMilestones() {
        var all = await this.db.getAll(MILESTONE_STORE);
        return all.length;
    }

    /**
     * Count completed milestones for a specific goal.
     * @param {number} goalId
     * @returns {Promise<number>}
     */
    async countCompletedMilestonesForGoal(goalId) {
        var milestones = await this.getMilestonesByGoalId(goalId);
        var count = 0;
        for (var i = 0; i < milestones.length; i++) {
            if (milestones[i].isCompleted) count++;
        }
        return count;
    }

    /* ================================================================
       PROGRESS TRACKING — Derived Queries
       ================================================================ */

    /**
     * Compute raw progress data for a goal from persisted milestones.
     * Returns the counts needed for progress percentage without
     * requiring the full in-memory state.
     * @param {number} goalId
     * @returns {Promise<{ completed: number, total: number, percentage: number }>}
     */
    async getGoalProgress(goalId) {
        var milestones = await this.getMilestonesByGoalId(goalId);
        var total = milestones.length;
        var completed = 0;
        for (var i = 0; i < milestones.length; i++) {
            if (milestones[i].isCompleted) completed++;
        }
        return {
            completed:  completed,
            total:      total,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
    }

    /**
     * Compute progress for every goal in a single pass.
     * Useful for hydration and summary dashboards.
     * @returns {Promise<Object>} — { [goalId]: { completed, total, percentage } }
     */
    async getAllGoalProgress() {
        var allMilestones = await this.getAllMilestones();
        var buckets = {};

        for (var i = 0; i < allMilestones.length; i++) {
            var gid = allMilestones[i].goalId;
            if (!buckets[gid]) {
                buckets[gid] = { completed: 0, total: 0 };
            }
            buckets[gid].total++;
            if (allMilestones[i].isCompleted) {
                buckets[gid].completed++;
            }
        }

        var result = {};
        var keys = Object.keys(buckets);
        for (var j = 0; j < keys.length; j++) {
            var b = buckets[keys[j]];
            result[keys[j]] = {
                completed:  b.completed,
                total:      b.total,
                percentage: b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0,
            };
        }

        return result;
    }

    /* ================================================================
       EXPORT / IMPORT
       ================================================================ */

    /**
     * Export all goals data (goals + milestones) as a single object.
     * @returns {Promise<{ goals: Object[], milestones: Object[] }>}
     */
    async exportAll() {
        var goals      = await this.getAllGoals();
        var milestones = await this.getAllMilestones();
        return { goals: goals, milestones: milestones };
    }

    /**
     * Import all goals data, replacing existing records.
     * @param {{ goals?: Object[], milestones?: Object[] }} data
     * @returns {Promise<void>}
     */
    async importAll(data) {
        if (data && data.goals) {
            await this.replaceAllGoals(data.goals);
        }
        if (data && data.milestones) {
            await this.replaceAllMilestones(data.milestones);
        }
    }
}
