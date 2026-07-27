/**
 * Tarteeb — Task Summary Stats
 *
 * Horizontal row of compact stat cards above the task list.
 * Each card shows a count + label, with subtle color coding
 * matching the pillar's accent.
 */

/**
 * Create the summary stats element.
 *
 * @param {Object} stats — { pending, in_progress, completed, overdue }
 * @returns {HTMLElement}
 */
export function createTaskSummary(stats = {}) {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6';

    const cards = [
        {
            label: 'To Do',
            value: stats.pending || 0,
            color: 'text-text-primary',
            bg: 'bg-white/[0.02]',
            ring: 'ring-white/[0.04]',
        },
        {
            label: 'In Progress',
            value: stats.in_progress || 0,
            color: 'text-accent-tasks',
            bg: 'bg-accent-tasks/[0.04]',
            ring: 'ring-accent-tasks/[0.08]',
        },
        {
            label: 'Completed',
            value: stats.completed || 0,
            color: 'text-status-success',
            bg: 'bg-status-success/[0.04]',
            ring: 'ring-status-success/[0.08]',
        },
        {
            label: 'Overdue',
            value: stats.overdue || 0,
            color: stats.overdue > 0 ? 'text-status-error' : 'text-text-tertiary',
            bg: stats.overdue > 0 ? 'bg-status-error/[0.05]' : 'bg-white/[0.02]',
            ring: stats.overdue > 0 ? 'ring-status-error/[0.1]' : 'ring-white/[0.04]',
        },
    ];

    for (const c of cards) {
        const card = document.createElement('div');
        card.className = `${c.bg} ${c.ring} ring-1 rounded-xl px-4 py-3 transition-all duration-200`;

        card.innerHTML = `
            <div class="text-[22px] font-heading font-semibold ${c.color} leading-none mb-1 tabular-nums">${c.value}</div>
            <div class="text-[11px] text-text-tertiary font-medium uppercase tracking-wider">${c.label}</div>
        `;

        row.appendChild(card);
    }

    return row;
}
