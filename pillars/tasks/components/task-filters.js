/**
 * Tarteeb — Task Filter Bar
 *
 * Horizontal filter/sort strip above the task list.
 * Provides pill-based quick filters and a sort toggle.
 *
 * Active filter is communicated via filled background pill;
 * inactive filters are ghost buttons.
 */

/**
 * Create the filter bar element.
 *
 * @param {Object} opts
 * @param {string}  opts.activeFilter   — current filter key
 * @param {string}  opts.activeSort     — current sort key
 * @param {Function} opts.onFilterChange — called with filter key
 * @param {Function} opts.onSortChange   — called with sort key
 * @returns {HTMLElement}
 */
export function createFilterBar({ activeFilter = 'all', activeSort = 'priority', onFilterChange, onSortChange } = {}) {
    const bar = document.createElement('div');
    bar.className = 'flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none';

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'pending', label: 'To Do' },
        { key: 'in_progress', label: 'In Progress' },
        { key: 'completed', label: 'Done' },
        { key: 'overdue', label: 'Overdue' },
    ];

    const sorts = [
        { key: 'priority', label: 'Priority' },
        { key: 'dueDate', label: 'Due Date' },
        { key: 'created', label: 'Newest' },
    ];

    /* ── Filter pills ── */
    const filterGroup = document.createElement('div');
    filterGroup.className = 'flex items-center gap-1';

    for (const f of filters) {
        const btn = document.createElement('button');
        const isActive = activeFilter === f.key;

        btn.className = [
            'px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap',
            'transition-all duration-200',
            isActive
                ? 'bg-accent-tasks/15 text-accent-tasks ring-1 ring-accent-tasks/20'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04]',
        ].join(' ');
        btn.textContent = f.label;
        btn.addEventListener('click', () => onFilterChange?.(f.key));
        filterGroup.appendChild(btn);
    }

    /* ── Separator ── */
    const sep = document.createElement('div');
    sep.className = 'w-px h-4 bg-white/[0.06] mx-2 flex-shrink-0';

    /* ── Sort pills ── */
    const sortGroup = document.createElement('div');
    sortGroup.className = 'flex items-center gap-1';

    for (const s of sorts) {
        const btn = document.createElement('button');
        const isActive = activeSort === s.key;

        btn.className = [
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap',
            'transition-all duration-200',
            isActive
                ? 'bg-white/[0.06] text-text-secondary'
                : 'text-text-disabled hover:text-text-tertiary hover:bg-white/[0.03]',
        ].join(' ');

        const arrow = isActive ? '↓' : '';
        btn.innerHTML = `${arrow} ${s.label}`;
        btn.addEventListener('click', () => onSortChange?.(s.key));
        sortGroup.appendChild(btn);
    }

    bar.appendChild(filterGroup);
    bar.appendChild(sep);
    bar.appendChild(sortGroup);

    return bar;
}
