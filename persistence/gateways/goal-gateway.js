/**
 * Life OS — Goals Gateway
 *
 * The SINGLE code path that touches the goals-items and
 * goals-milestones IndexedDB object stores. Every other module
 * must call through this gateway — no direct DB access elsewhere.
 *
 * IndexedDB Schema (goals-items):
 *   keyPath:  id (auto-increment)
 *   indexes:  by-status  (string)  — "active" | "completed" | "abandoned"
 *   indexes:  by-deadline (string) — "YYYY-MM-DD" or null
 *
 * IndexedDB Schema (goals-milestones):
 *   keyPath:  id (auto-increment)
 *   indexes:  by-goal-id (number)  — all milestones for a goal
 *
 * Design invariants:
 *   - Gateway is stateless — no internal caches, no side-effects.
 *   - Every method returns a Promise that resolves to plain data.
 *   - Gateway never validates — that is the store's responsibility.
 *   - Gateway never publishes events — that is the store's job.
 */

'use strict';

/* ── Store Names ──────────────────────────────────────────── */

var GOAL_STORE     = 'goals-items';
var MILESTONE_STORE = 'goals-milestones';

/* ── Gateway ──────────────────────────────────────────────── */

export class GoalGateway {
    /**
     * @param {import('../../persistence/connection/database.js').Database} database
     */
    constructor(database) {
        if (!database) {
            throw new Error('GoalGateway requires a Database instance');
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
       MILESTONES — Create
       ================================================================ */

    /**
     * Persist a new milestone.
     * @param {Object} data — milestone object (id omitted; DB assigns it)
     * @returns {Promise<Object>} the saved milestone with its new `id`
     */
    async createMilestone(data) {
        var id = await this.db.save(MILESTONE_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    /* ================================================================
       MILESTONES — Read
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

    /* ================================================================
       MILESTONES — Update
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
       MILESTONES — Delete
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
       MILESTONES — Bulk / Utility
       ================================================================ */

    /**
     * Replace the entire goals-milestones store with the supplied array.
     * @param {Object[]} milestones
     * @returns {Promise<void>}
     */
    async replaceAllMilestones(milestones) {
        return this.db.importStore(MILESTONE_STORE, milestones || []);
    }

    /* ================================================================
       EXPORT / IMPORT
       ================================================================ */

    /**
     * Export all goals data (goals + milestones) as a single object.
     * @returns {Promise<{goals: Object[], milestones: Object[]}>}
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
