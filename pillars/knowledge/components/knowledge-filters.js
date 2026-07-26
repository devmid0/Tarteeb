/**
 * Life OS — Knowledge Filter Bar
 *
 * Horizontal filter/sort strip above the content list.
 * Provides pill-based quick filters and a sort toggle.
 *
 * Active filter is communicated via filled background pill;
 * inactive filters are ghost buttons.
 */

import { NOTE_CATEGORIES, CATEGORY_META } from '../domain/knowledge-rules.js';

/**
 * Create the filter bar element.
 *
 * @param {Object} opts
 * @param {string}  opts.activeFilter    — current filter key
 * @param {string}  opts.activeSort      — current sort key
 * @param {Function} opts.onFilterChange — called with filter key
 * @param {Function} opts.onSortChange   — called with sort key
 * @param {string[]} opts.allTags        — all available tags
 * @returns {HTMLElement}
 */
export function createKnowledgeFilterBar(opts) {
    var activeFilter = (opts && opts.activeFilter) || 'all';
    var activeSort = (opts && opts.activeSort) || 'recent';
    var onFilterChange = opts && opts.onFilterChange;
    var onSortChange = opts && opts.onSortChange;
    var allTags = (opts && opts.allTags) || [];

    var bar = document.createElement('div');
    bar.className = 'flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none';

    var filters = [
        { key: 'all',       label: 'All' },
    ];

    /* Add category filters */
    for (var c = 0; c < NOTE_CATEGORIES.length; c++) {
        var cat = NOTE_CATEGORIES[c];
        var meta = CATEGORY_META[cat];
        filters.push({ key: cat, label: (meta ? meta.icon + ' ' : '') + (meta ? meta.label : cat) });
    }

    var sorts = [
        { key: 'recent',   label: 'Recent' },
        { key: 'alpha',    label: 'A \u2192 Z' },
    ];

    /* ── Filter pills ── */
    var filterGroup = document.createElement('div');
    filterGroup.className = 'flex items-center gap-1';

    for (var i = 0; i < filters.length; i++) {
        (function (f) {
            var btn = document.createElement('button');
            var isActive = activeFilter === f.key;

            btn.className = [
                'px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap',
                'transition-all duration-200',
                isActive
                    ? 'bg-accent-knowledge/15 text-accent-knowledge ring-1 ring-accent-knowledge/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04]',
            ].join(' ');
            btn.textContent = f.label;
            btn.addEventListener('click', function () {
                if (onFilterChange) onFilterChange(f.key);
            });
            filterGroup.appendChild(btn);
        })(filters[i]);
    }

    /* ── Separator ── */
    var sep = document.createElement('div');
    sep.className = 'w-px h-4 bg-white/[0.06] mx-2 flex-shrink-0';

    /* ── Sort pills ── */
    var sortGroup = document.createElement('div');
    sortGroup.className = 'flex items-center gap-1';

    for (var j = 0; j < sorts.length; j++) {
        (function (s) {
            var btn = document.createElement('button');
            var isActive = activeSort === s.key;

            btn.className = [
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap',
                'transition-all duration-200',
                isActive
                    ? 'bg-white/[0.06] text-text-secondary'
                    : 'text-text-disabled hover:text-text-tertiary hover:bg-white/[0.03]',
            ].join(' ');

            btn.textContent = s.label;
            btn.addEventListener('click', function () {
                if (onSortChange) onSortChange(s.key);
            });
            sortGroup.appendChild(btn);
        })(sorts[j]);
    }

    bar.appendChild(filterGroup);
    bar.appendChild(sep);
    bar.appendChild(sortGroup);

    return bar;
}
