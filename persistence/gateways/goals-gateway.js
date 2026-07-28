// YAGNI: Removed getCompletedMilestones, getIncompleteMilestones, countMilestones,
// countGoals, countCompletedMilestonesForGoal, getGoalProgress, getAllGoalProgress
// (none called from store — all computed in-memory)

'use strict';

var GOAL_STORE      = 'goals-items';
var MILESTONE_STORE = 'goals-milestones';

export class GoalsGateway {
    constructor(database) {
        if (!database) {
            throw new Error('GoalsGateway requires a Database instance');
        }
        this.db = database;
    }

    async createGoal(data) {
        var id = await this.db.save(GOAL_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async getGoal(id) {
        return this.db.get(GOAL_STORE, id);
    }

    async getAllGoals() {
        return this.db.getAll(GOAL_STORE);
    }

    async updateGoal(data) {
        if (!data || !data.id) {
            throw new Error('updateGoal requires a goal with an id');
        }
        await this.db.update(GOAL_STORE, data);
        return data;
    }

    async deleteGoal(id) {
        return this.db.delete(GOAL_STORE, id);
    }

    async replaceAllGoals(goals) {
        return this.db.importStore(GOAL_STORE, goals || []);
    }

    async createMilestone(data) {
        var id = await this.db.save(MILESTONE_STORE, data);
        return Object.assign({}, data, { id: id });
    }

    async getMilestone(id) {
        return this.db.get(MILESTONE_STORE, id);
    }

    async getAllMilestones() {
        return this.db.getAll(MILESTONE_STORE);
    }

    async getMilestonesByGoalId(goalId) {
        return this.db.getByIndex(MILESTONE_STORE, 'by-goal-id', goalId);
    }

    async updateMilestone(data) {
        if (!data || !data.id) {
            throw new Error('updateMilestone requires a milestone with an id');
        }
        await this.db.update(MILESTONE_STORE, data);
        return data;
    }

    async deleteMilestone(id) {
        return this.db.delete(MILESTONE_STORE, id);
    }

    async deleteAllMilestonesForGoal(goalId) {
        var milestones = await this.getMilestonesByGoalId(goalId);
        for (var i = 0; i < milestones.length; i++) {
            await this.db.delete(MILESTONE_STORE, milestones[i].id);
        }
    }

    async replaceAllMilestones(milestones) {
        return this.db.importStore(MILESTONE_STORE, milestones || []);
    }

    async exportAll() {
        var goals      = await this.getAllGoals();
        var milestones = await this.getAllMilestones();
        return { goals: goals, milestones: milestones };
    }

    async importAll(data) {
        if (data && data.goals) {
            await this.replaceAllGoals(data.goals);
        }
        if (data && data.milestones) {
            await this.replaceAllMilestones(data.milestones);
        }
    }
}
