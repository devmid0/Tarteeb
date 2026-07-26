/**
 * Life OS — Task Domain Rules
 *
 * Pure business logic for task management.
 * Zero DOM dependency. Every function is testable in isolation.
 *
 * Invariants enforced here:
 *   - A task must have a non-empty title (1-200 chars)
 *   - Priority is one of: 'critical', 'high', 'medium', 'low'
 *   - Status is one of: 'pending', 'in_progress', 'completed', 'archived'
 *   - Due date, if provided, must be a valid ISO date string
 *   - A task may belong to at most one project
 *   - Timestamps are ISO-8601 strings set at creation
 */

export const PRIORITY = Object.freeze({
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
});

export const STATUS = Object.freeze({
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    ARCHIVED: 'archived',
});

export const PRIORITY_ORDER = {
    [PRIORITY.CRITICAL]: 0,
    [PRIORITY.HIGH]: 1,
    [PRIORITY.MEDIUM]: 2,
    [PRIORITY.LOW]: 3,
};

/* ── Validation ──────────────────────────────────────────── */

/**
 * Validate a task data object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateTask(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Task data must be an object'] };
    }

    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push('Title is required');
    } else if (data.title.trim().length > 200) {
        errors.push('Title must be 200 characters or fewer');
    }

    if (data.priority && !Object.values(PRIORITY).includes(data.priority)) {
        errors.push(`Priority must be one of: ${Object.values(PRIORITY).join(', ')}`);
    }

    if (data.status && !Object.values(STATUS).includes(data.status)) {
        errors.push(`Status must be one of: ${Object.values(STATUS).join(', ')}`);
    }

    if (data.dueDate !== undefined && data.dueDate !== null && data.dueDate !== '') {
        const parsed = new Date(data.dueDate);
        if (isNaN(parsed.getTime())) {
            errors.push('Due date must be a valid date');
        }
    }

    if (data.projectId !== undefined && data.projectId !== null) {
        if (typeof data.projectId !== 'number' && typeof data.projectId !== 'string') {
            errors.push('Project ID must be a number or string');
        }
    }

    if (data.timeEstimate !== undefined && data.timeEstimate !== null) {
        if (typeof data.timeEstimate !== 'number' || data.timeEstimate < 0) {
            errors.push('Time estimate must be a non-negative number (minutes)');
        }
    }

    if (data.timeSpent !== undefined && data.timeSpent !== null) {
        if (typeof data.timeSpent !== 'number' || data.timeSpent < 0) {
            errors.push('Time spent must be a non-negative number (minutes)');
        }
    }

    return { valid: errors.length === 0, errors };
}

/* ── Factory ─────────────────────────────────────────────── */

/**
 * Create a new task object with defaults.
 * Does NOT persist — call gateway separately.
 */
export function createTaskData(overrides = {}) {
    const now = new Date().toISOString();
    return {
        title: '',
        description: '',
        priority: PRIORITY.MEDIUM,
        status: STATUS.PENDING,
        dueDate: null,
        projectId: null,
        tags: [],
        timeEstimate: null,
        timeSpent: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

/* ── State Transitions ───────────────────────────────────── */

/**
 * Compute the next status when a user toggles completion.
 * Returns the new status string.
 */
export function toggleCompletion(currentStatus) {
    if (currentStatus === STATUS.COMPLETED) return STATUS.PENDING;
    return STATUS.COMPLETED;
}

/**
 * Transition a task to a new status with timestamp update.
 * Returns a new object (does not mutate input).
 */
export function transitionStatus(task, newStatus) {
    if (!Object.values(STATUS).includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
    }
    return {
        ...task,
        status: newStatus,
        completedAt: newStatus === STATUS.COMPLETED ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
    };
}

/* ── Selectors (pure derivations) ────────────────────────── */

/**
 * Filter tasks that are due today.
 * "Today" = tasks whose dueDate calendar day matches today.
 */
export function selectTodayTasks(tasks) {
    const today = new Date().toISOString().slice(0, 10);
    return tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === today);
}

/**
 * Filter active (non-archived, non-completed) tasks.
 */
export function selectActiveTasks(tasks) {
    return tasks.filter(t => t.status !== STATUS.ARCHIVED && t.status !== STATUS.COMPLETED);
}

/**
 * Filter completed tasks.
 */
export function selectCompletedTasks(tasks) {
    return tasks.filter(t => t.status === STATUS.COMPLETED);
}

/**
 * Overdue tasks: active tasks with a due date before today.
 */
export function selectOverdueTasks(tasks) {
    const today = new Date().toISOString().slice(0, 10);
    return selectActiveTasks(tasks).filter(
        t => t.dueDate && t.dueDate.slice(0, 10) < today
    );
}

/**
 * Sort by priority (critical first), then by due date (earliest first),
 * then by creation date (newest first).
 */
export function sortByPriority(tasks) {
    return [...tasks].sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 99;
        const pb = PRIORITY_ORDER[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;

        const da = a.dueDate || '9999-12-31';
        const db = b.dueDate || '9999-12-31';
        if (da !== db) return da.localeCompare(db);

        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
}

/**
 * Group tasks by project. Tasks with no project go under null key.
 */
export function groupByProject(tasks) {
    const groups = {};
    for (const task of tasks) {
        const key = task.projectId ?? null;
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
    }
    return groups;
}

/**
 * Count tasks by status for summary stats.
 */
export function summarizeByStatus(tasks) {
    const summary = { pending: 0, in_progress: 0, completed: 0, archived: 0 };
    for (const t of tasks) {
        if (summary[t.status] !== undefined) summary[t.status]++;
    }
    return summary;
}

/**
 * Compute total time estimate and time spent across all tasks.
 * Returns { totalEstimate, totalSpent, remaining }
 */
export function summarizeTime(tasks) {
    var totalEstimate = 0;
    var totalSpent = 0;
    for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].timeEstimate) totalEstimate += tasks[i].timeEstimate;
        if (tasks[i].timeSpent) totalSpent += tasks[i].timeSpent;
    }
    return {
        totalEstimate: totalEstimate,
        totalSpent: totalSpent,
        remaining: Math.max(0, totalEstimate - totalSpent),
    };
}

/**
 * Format minutes into a human-readable string.
 * e.g., 90 → "1h 30m", 45 → "45m", 0 → "0m"
 */
export function formatMinutes(mins) {
    if (!mins || mins <= 0) return '0m';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h === 0) return m + 'm';
    if (m === 0) return h + 'h';
    return h + 'h ' + m + 'm';
}
