/**
 * Life OS — Goals Domain Rules
 *
 * Pure business logic for the Goals pillar. Zero DOM dependency.
 * All constants, validation, and derivations live here.
 *
 * Goal shape:
 *   { id, title, description, emoji, category, priority, status,
 *     deadline, createdAt, completedAt, updatedAt }
 *
 * Milestone shape:
 *   { id, goalId, title, isCompleted, completedAt, sortOrder, createdAt }
 *
 * Status enum:
 *   "active"    — in progress
 *   "completed" — achieved
 *   "abandoned" — no longer pursuing
 *
 * Priority enum:
 *   "high"   — important / urgent
 *   "medium" — standard
 *   "low"    — nice-to-have
 */

'use strict';

/* ── Enums ──────────────────────────────────────────────── */

export var PRIORITY = Object.freeze({
    HIGH:   'high',
    MEDIUM: 'medium',
    LOW:    'low',
});

export var PRIORITY_LABELS = {
    high:   'High',
    medium: 'Medium',
    low:    'Low',
};

export var PRIORITY_COLORS = {
    high:   'text-status-error',
    medium: 'text-status-warning',
    low:    'text-status-success',
};

export var STATUS = Object.freeze({
    ACTIVE:    'active',
    COMPLETED: 'completed',
    ABANDONED: 'abandoned',
});

export var STATUS_LABELS = {
    active:    'Active',
    completed: 'Completed',
    abandoned: 'Abandoned',
};

/* ── Emoji Pool ─────────────────────────────────────────── */

export var EMOJI_POOL = [
    '🎯', '🏆', '💪', '📚', '💼', '🎨', '🏃', '💰',
    '🌟', '🎓', '🚀', '💡', '🔑', '🎵', '🏠', '❤️',
    '🧠', '⏰', '📱', '🌍', '✍️', '🧘', '🔥', '⭐',
];

/* ── Validation ─────────────────────────────────────────── */

/**
 * Validate goal data. Returns array of error strings (empty = valid).
 * @param {Object} data
 * @returns {string[]}
 */
export function validateGoal(data) {
    var errors = [];
    if (!data || !data.title || !data.title.trim()) {
        errors.push('Goal title is required');
    }
    if (data && data.title && data.title.length > 200) {
        errors.push('Title must be under 200 characters');
    }
    if (data && data.description && data.description.length > 1000) {
        errors.push('Description must be under 1000 characters');
    }
    if (data && data.deadline) {
        var d = new Date(data.deadline);
        if (isNaN(d.getTime())) {
            errors.push('Invalid deadline date');
        }
    }
    if (data && data.priority && !PRIORITY_LABELS[data.priority]) {
        errors.push('Invalid priority: ' + data.priority);
    }
    return errors;
}

/**
 * Validate milestone data.
 * @param {Object} data
 * @returns {string[]}
 */
export function validateMilestone(data) {
    var errors = [];
    if (!data || !data.title || !data.title.trim()) {
        errors.push('Milestone title is required');
    }
    if (data && data.title && data.title.length > 200) {
        errors.push('Title must be under 200 characters');
    }
    return errors;
}

/* ── Date Helpers ───────────────────────────────────────── */

/**
 * Compute days remaining until deadline.
 * Returns negative if overdue. Returns null if no deadline.
 * @param {string|null} deadline — "YYYY-MM-DD"
 * @returns {number|null}
 */
export function daysRemaining(deadline) {
    if (!deadline) return null;
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var parts = deadline.split('-');
    var target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return Math.ceil((target - now) / 86400000);
}

/**
 * Check if a deadline is overdue.
 * @param {string|null} deadline
 * @returns {boolean}
 */
export function isOverdue(deadline) {
    if (!deadline) return false;
    var days = daysRemaining(deadline);
    return days !== null && days < 0;
}

/**
 * Format deadline for display.
 * @param {string|null} deadline
 * @returns {string}
 */
export function formatDeadline(deadline) {
    if (!deadline) return 'No deadline';
    var days = daysRemaining(deadline);
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days === -1) return 'Overdue by 1 day';
    if (days < -1) return 'Overdue by ' + Math.abs(days) + ' days';
    if (days > 0) return days + ' days remaining';
    return deadline;
}

/* ── Progress ───────────────────────────────────────────── */

/**
 * Compute progress from milestones array.
 * @param {Object[]} milestones
 * @returns {{ completed: number, total: number, percentage: number }}
 */
export function computeProgress(milestones) {
    if (!milestones || milestones.length === 0) {
        return { completed: 0, total: 0, percentage: 0 };
    }
    var completed = 0;
    for (var i = 0; i < milestones.length; i++) {
        if (milestones[i].isCompleted) completed++;
    }
    return {
        completed: completed,
        total:     milestones.length,
        percentage: Math.round((completed / milestones.length) * 100),
    };
}

/* ── Sorting ────────────────────────────────────────────── */

/**
 * Sort goals by deadline (closest first), null deadlines last.
 * @param {Object[]} goals
 * @returns {Object[]}
 */
export function sortByDeadline(goals) {
    return goals.slice().sort(function (a, b) {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
    });
}

/**
 * Sort goals by priority (high > medium > low).
 * @param {Object[]} goals
 * @returns {Object[]}
 */
export function sortByPriority(goals) {
    var order = { high: 0, medium: 1, low: 2 };
    return goals.slice().sort(function (a, b) {
        return (order[a.priority] || 1) - (order[b.priority] || 1);
    });
}

/**
 * Sort milestones by sortOrder.
 * @param {Object[]} milestones
 * @returns {Object[]}
 */
export function sortMilestones(milestones) {
    return milestones.slice().sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
}
