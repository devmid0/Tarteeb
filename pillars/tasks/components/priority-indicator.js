/**
 * Tarteeb — Priority Indicator
 *
 * Tiny visual element communicating task urgency through
 * color, icon, and a subtle pulse for critical items.
 *
 * Rendered inline within TaskCards and task forms.
 */

import { PRIORITY } from '../domain/task-rules.js';

const PRIORITY_META = {
    [PRIORITY.CRITICAL]: {
        label: 'Critical',
        dot: 'bg-red-500',
        text: 'text-red-400',
        ring: 'ring-red-500/30',
        glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]',
        icon: 'M12 9v2m0 4h.01M5.07 19H18.93c1.08 0 1.81-1.15 1.3-2.12L13.3 3.88c-.52-1.02-2.08-1.02-2.6 0L3.77 16.88c-.51.97.22 2.12 1.3 2.12z',
    },
    [PRIORITY.HIGH]: {
        label: 'High',
        dot: 'bg-orange-500',
        text: 'text-orange-400',
        ring: 'ring-orange-500/20',
        glow: '',
        icon: 'M5 10l7-7m0 0l7 7m-7-7v18',
    },
    [PRIORITY.MEDIUM]: {
        label: 'Medium',
        dot: 'bg-yellow-500',
        text: 'text-yellow-400',
        ring: 'ring-yellow-500/20',
        glow: '',
        icon: 'M5 12h14',
    },
    [PRIORITY.LOW]: {
        label: 'Low',
        dot: 'bg-sky-500',
        text: 'text-sky-400',
        ring: 'ring-sky-500/20',
        glow: '',
        icon: 'M19 14l-7 7m0 0l-7-7m7 7V3',
    },
};

/**
 * Create a priority indicator dot element.
 * @param {string} priority - One of PRIORITY values
 * @param {'dot'|'badge'|'full'} mode - Display mode
 * @returns {HTMLElement}
 */
export function createPriorityIndicator(priority, mode = 'dot') {
    const meta = PRIORITY_META[priority] || PRIORITY_META[PRIORITY.MEDIUM];

    const el = document.createElement('span');
    el.className = 'inline-flex items-center';
    el.setAttribute('aria-label', `Priority: ${meta.label}`);

    if (mode === 'dot') {
        el.innerHTML = `<span class="w-2 h-2 rounded-full ${meta.dot} ${meta.glow}"></span>`;
    }

    if (mode === 'badge') {
        el.innerHTML = `
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium
                         ${meta.text} bg-white/[0.04] ring-1 ${meta.ring}">
                <span class="w-1.5 h-1.5 rounded-full ${meta.dot}"></span>
                ${meta.label}
            </span>`;
    }

    if (mode === 'full') {
        el.innerHTML = `
            <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                         ${meta.text} bg-white/[0.03] ring-1 ${meta.ring}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                    <path d="${meta.icon}"/>
                </svg>
                ${meta.label}
            </span>`;
    }

    return el;
}
