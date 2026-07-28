/**
 * Tarteeb — Task State Store
 *
 * Unidirectional data flow within the Tasks pillar:
 *
 *   View ──dispatch(action)──▶ TaskStore ──publish──▶ EventBus
 *              │                                       │
 *              ▼                                       ▼
 *        gateway.create()                    View re-renders
 *        gateway.update()
 *        gateway.delete()
 *
 * Constraints:
 *   - State mutations ONLY via dispatch()
 *   - Selectors are pure functions of the state
 *   - Gateway writes are fire-and-forget async (optimistic UI)
 *   - Rollback on gateway failure publishes error events
 *   - UPDATE_TASK accepts a patch { id, ...fields } — merges with existing
 */

'use strict';

import {
    createTaskData,
    validateTask,
    transitionStatus,
    toggleCompletion,
    selectTodayTasks,
    selectActiveTasks,
    selectCompletedTasks,
    selectOverdueTasks,
    sortByPriority,
    summarizeByStatus,
    summarizeTime,
    STATUS,
} from '../domain/task-rules.js';

export class TaskStore {
    constructor(eventBus, taskGateway) {
        this.eventBus = eventBus;
        this.gateway  = taskGateway;

        this.tasks    = [];
        this.projects = [];
        this.loading  = false;
        this.error    = null;
    }

    /* ── Hydration ─────────────────────────────────────────── */

    async hydrate() {
        this.loading = true;
        this.eventBus.publish('tasks:loading', true);

        try {
            this.tasks    = await this.gateway.getAllTasks();
            this.projects = await this.gateway.getAllProjects();
            this.error    = null;
        } catch (err) {
            this.error = err.message;
            this.eventBus.publish('tasks:error', err.message);
        } finally {
            this.loading = false;
            this.eventBus.publish('tasks:loading', false);
            this.eventBus.publish('tasks:hydrated', this.getStateSnapshot());
        }
    }

    /* ── Dispatch ──────────────────────────────────────────── */

    async dispatch(action) {
        switch (action.type) {
            case 'ADD_TASK':       return this._addTask(action.payload);
            case 'UPDATE_TASK':    return this._updateTask(action.payload);
            case 'DELETE_TASK':    return this._deleteTask(action.payload);
            case 'TOGGLE_COMPLETE':return this._toggleComplete(action.payload);
            case 'CHANGE_STATUS':  return this._changeStatus(action.payload);
            case 'ADD_PROJECT':    return this._addProject(action.payload);
            case 'DELETE_PROJECT': return this._deleteProject(action.payload);
            default:
                console.warn('[TaskStore] Unknown action:', action.type);
        }
    }

    /* ── Internal Mutators ─────────────────────────────────── */

    async _addTask(raw) {
        var data = createTaskData(raw);
        var validation = validateTask(data);
        if (!validation.valid) {
            this.eventBus.publish('tasks:validation-error', validation.errors);
            return null;
        }

        try {
            var saved = await this.gateway.createTask(data);
            this.tasks = this.tasks.concat([saved]);
            this.eventBus.publish('tasks:task-added', saved);
            this.eventBus.publish('tasks:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.eventBus.publish('tasks:error', err.message);
            return null;
        }
    }

    /**
     * Patch-based update.  Accepts { id, ...fields }.
     * Merges onto the existing task, writes to gateway,
     * publishes change event.
     */
    async _updateTask(patch) {
        if (!patch || !patch.id) {
            this.eventBus.publish('tasks:error', 'UPDATE_TASK requires an id');
            return null;
        }

        var index = -1;
        for (var i = 0; i < this.tasks.length; i++) {
            if (this.tasks[i].id === patch.id) { index = i; break; }
        }
        if (index === -1) {
            this.eventBus.publish('tasks:error', 'Task ' + patch.id + ' not found');
            return null;
        }

        var existing = this.tasks[index];
        var updated = Object.assign({}, existing, patch, { updatedAt: new Date().toISOString() });

        /* Optimistic: replace in local array */
        var next = this.tasks.slice();
        next[index] = updated;
        this.tasks = next;

        this.eventBus.publish('tasks:task-updated', updated);
        this.eventBus.publish('tasks:changed', this.getStateSnapshot());

        try {
            await this.gateway.updateTask(updated);
        } catch (err) {
            /* Rollback */
            var rollback = this.tasks.slice();
            rollback[index] = existing;
            this.tasks = rollback;
            this.eventBus.publish('tasks:rollback', existing);
            this.eventBus.publish('tasks:error', err.message);
            this.eventBus.publish('tasks:changed', this.getStateSnapshot());
        }

        return updated;
    }

    async _deleteTask(id) {
        var index = -1;
        for (var i = 0; i < this.tasks.length; i++) {
            if (this.tasks[i].id === id) { index = i; break; }
        }
        if (index === -1) return;

        var removed = this.tasks[index];
        this.tasks = this.tasks.filter(function (t) { return t.id !== id; });
        this.eventBus.publish('tasks:task-deleted', removed);
        this.eventBus.publish('tasks:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteTask(id);
        } catch (err) {
            var rollback = this.tasks.slice();
            rollback.splice(index, 0, removed);
            this.tasks = rollback;
            this.eventBus.publish('tasks:rollback', removed);
            this.eventBus.publish('tasks:error', err.message);
            this.eventBus.publish('tasks:changed', this.getStateSnapshot());
        }
    }

    async _toggleComplete(id) {
        var task = null;
        for (var i = 0; i < this.tasks.length; i++) {
            if (this.tasks[i].id === id) { task = this.tasks[i]; break; }
        }
        if (!task) return;

        var newStatus = toggleCompletion(task.status);
        return this.dispatch({ type: 'CHANGE_STATUS', payload: { id: id, status: newStatus } });
    }

    async _changeStatus(payload) {
        var task = null;
        for (var i = 0; i < this.tasks.length; i++) {
            if (this.tasks[i].id === payload.id) { task = this.tasks[i]; break; }
        }
        if (!task) return;

        var updated = transitionStatus(task, payload.status);
        return this.dispatch({ type: 'UPDATE_TASK', payload: updated });
    }

    async _addProject(raw) {
        var data = {
            name:      (raw.name || '').trim(),
            color:     raw.color || 'accent-tasks',
            createdAt: new Date().toISOString(),
        };

        if (!data.name) {
            this.eventBus.publish('tasks:validation-error', ['Project name is required']);
            return null;
        }

        var { canCreateEntity, showPaywall } = await import('../../core/freemium.js');
        if (!canCreateEntity('projects', this.projects.length)) {
            showPaywall();
            this.eventBus.publish('tasks:freemium-blocked', { entityType: 'projects', limit: 3 });
            return null;
        }

        try {
            var saved = await this.gateway.createProject(data);
            this.projects = this.projects.concat([saved]);
            this.eventBus.publish('tasks:project-added', saved);
            this.eventBus.publish('tasks:changed', this.getStateSnapshot());
            return saved;
        } catch (err) {
            this.eventBus.publish('tasks:error', err.message);
            return null;
        }
    }

    /**
     * Delete a project and un-assign all its tasks in a single batch.
     * Only fires ONE 'tasks:changed' event (not N).
     */
    async _deleteProject(id) {
        var removed = null;
        for (var i = 0; i < this.projects.length; i++) {
            if (this.projects[i].id === id) { removed = this.projects[i]; break; }
        }
        this.projects = this.projects.filter(function (p) { return p.id !== id; });

        /* Batch un-assign affected tasks, tracking which ones changed */
        var changedIds = [];
        var next = this.tasks.slice();
        for (var j = 0; j < next.length; j++) {
            if (next[j].projectId === id) {
                next[j] = Object.assign({}, next[j], {
                    projectId: null,
                    updatedAt: new Date().toISOString(),
                });
                changedIds.push(next[j].id);
            }
        }
        if (changedIds.length > 0) {
            this.tasks = next;
        }

        this.eventBus.publish('tasks:project-deleted', removed);
        this.eventBus.publish('tasks:changed', this.getStateSnapshot());

        try {
            await this.gateway.deleteProject(id);
            /* Persist only the tasks that were actually un-assigned */
            if (changedIds.length > 0) {
                var toPersist = this.tasks.filter(function (t) {
                    return changedIds.indexOf(t.id) !== -1;
                });
                await this.gateway.batchUpdateTasks(toPersist);
            }
        } catch (err) {
            this.eventBus.publish('tasks:error', err.message);
        }
    }

    /* ── Selectors ─────────────────────────────────────────── */

    getStateSnapshot() {
        return {
            tasks:    this.tasks,
            projects: this.projects,
            loading:  this.loading,
            error:    this.error,
        };
    }

    getActiveTasks()   { return sortByPriority(selectActiveTasks(this.tasks)); }
    getTodayTasks()    { return sortByPriority(selectTodayTasks(this.tasks)); }
    getCompletedTasks(){ return selectCompletedTasks(this.tasks); }
    getOverdueTasks()  { return sortByPriority(selectOverdueTasks(this.tasks)); }

    getTasksByProject(projectId) {
        return sortByPriority(this.tasks.filter(function (t) { return t.projectId === projectId; }));
    }

    getProjects()  { return this.projects; }
    getSummary()   { return summarizeByStatus(this.tasks); }
    getTimeSummary() { return summarizeTime(this.tasks); }

    getTaskById(id) {
        for (var i = 0; i < this.tasks.length; i++) {
            if (this.tasks[i].id === id) return this.tasks[i];
        }
        return null;
    }
}
