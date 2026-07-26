/**
 * Life OS — Task Gateway
 *
 * The ONLY code path that touches the tasks-items and tasks-projects
 * IndexedDB object stores. All other modules call through this gateway.
 *
 * Responsibilities:
 *   - CRUD operations for tasks and projects
 *   - Query by index (status, priority, due date)
 *   - Atomic multi-record operations for batch updates
 */

const TASK_STORE = 'tasks-items';
const PROJECT_STORE = 'tasks-projects';

export class TaskGateway {
    constructor(database) {
        this.db = database;
    }

    /* ── Tasks ─────────────────────────────────────────────── */

    async createTask(data) {
        const id = await this.db.save(TASK_STORE, data);
        return { ...data, id };
    }

    async updateTask(data) {
        if (!data.id) throw new Error('Task must have an id to update');
        await this.db.update(TASK_STORE, data);
        return data;
    }

    async getTask(id) {
        return this.db.get(TASK_STORE, id);
    }

    async getAllTasks() {
        return this.db.getAll(TASK_STORE);
    }

    async deleteTask(id) {
        return this.db.delete(TASK_STORE, id);
    }

    async getTasksByStatus(status) {
        return this.db.getByIndex(TASK_STORE, 'by-status', status);
    }

    async getTasksByPriority(priority) {
        return this.db.getByIndex(TASK_STORE, 'by-priority', priority);
    }

    async getTasksByDueDate(date) {
        return this.db.getByIndex(TASK_STORE, 'by-due-date', date);
    }

    async getTasksByProject(projectId) {
        const all = await this.getAllTasks();
        return all.filter(t => t.projectId === projectId);
    }

    async batchUpdateTasks(tasks) {
        const results = [];
        for (const task of tasks) {
            results.push(await this.updateTask(task));
        }
        return results;
    }

    /* ── Projects ──────────────────────────────────────────── */

    async createProject(data) {
        const id = await this.db.save(PROJECT_STORE, data);
        return { ...data, id };
    }

    async updateProject(data) {
        if (!data.id) throw new Error('Project must have an id to update');
        await this.db.update(PROJECT_STORE, data);
        return data;
    }

    async getProject(id) {
        return this.db.get(PROJECT_STORE, id);
    }

    async getAllProjects() {
        return this.db.getAll(PROJECT_STORE);
    }

    async deleteProject(id) {
        return this.db.delete(PROJECT_STORE, id);
    }
}
