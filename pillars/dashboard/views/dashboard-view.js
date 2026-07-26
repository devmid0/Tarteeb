/**
 * Life OS — Dashboard View
 * 
 * The convergence point that aggregates read-only data from all five pillars.
 * This is NOT a pillar - it is a projection space.
 * 
 * Design constraints:
 * - Uses neutral accent (no pillar-specific hue)
 * - Layout is asymmetric and editorial
 * - Communicates overview and synthesis
 */

import { createCard, createBadge } from '../../../ui/atoms/index.js';

export class DashboardView {
    constructor() {
        this.container = null;
    }

    /**
     * Render the dashboard view
     * @returns {HTMLElement}
     */
    render() {
        const fragment = document.createDocumentFragment();
        
        // Main container
        const main = document.createElement('div');
        main.className = 'h-full p-6 md:p-8';
        
        // Header
        const header = document.createElement('header');
        header.className = 'mb-8';
        header.innerHTML = `
            <h1 class="text-3xl font-heading font-semibold text-text-primary mb-2">Overview</h1>
            <p class="text-text-secondary">Your life at a glance</p>
        `;
        
        // Stats grid
        const statsGrid = document.createElement('div');
        statsGrid.className = 'grid grid-cols-2 md:grid-cols-5 gap-4 mb-8';
        
        const pillars = [
            { id: 'finance', label: 'Finance', color: 'accent-finance', icon: '💰', stat: '$0.00', sub: 'Net Worth' },
            { id: 'tasks', label: 'Tasks', color: 'accent-tasks', icon: '✓', stat: '0', sub: 'Pending' },
            { id: 'knowledge', label: 'Knowledge', color: 'accent-knowledge', icon: '📖', stat: '0', sub: 'Notes' },
            { id: 'habits', label: 'Habits', color: 'accent-habits', icon: '⚡', stat: '0/0', sub: 'Today' },
            { id: 'goals', label: 'Goals', color: 'accent-goals', icon: '⭐', stat: '0', sub: 'Active' },
        ];
        
        pillars.forEach(pillar => {
            const card = createCard({
                content: `
                    <div class="flex items-center gap-3 mb-3">
                        <span class="text-2xl">${pillar.icon}</span>
                        <span class="text-sm font-medium text-text-secondary">${pillar.label}</span>
                    </div>
                    <div class="text-2xl font-heading font-semibold text-text-primary mb-1">${pillar.stat}</div>
                    <div class="text-xs text-text-tertiary">${pillar.sub}</div>
                `,
                interactive: true,
                onClick: () => window.location.hash = `/${pillar.id}`,
            });
            statsGrid.appendChild(card);
        });
        
        // Recent activity section
        const recentSection = document.createElement('section');
        recentSection.className = 'mb-8';
        recentSection.innerHTML = `
            <h2 class="text-lg font-heading font-semibold text-text-primary mb-4">Recent Activity</h2>
            <div class="bg-surface-raised rounded-lg p-6 text-center">
                <p class="text-text-tertiary">No recent activity</p>
                <p class="text-sm text-text-tertiary mt-2">Start using Life OS to see your activity here</p>
            </div>
        `;
        
        // Assemble
        main.appendChild(header);
        main.appendChild(statsGrid);
        main.appendChild(recentSection);
        fragment.appendChild(main);
        
        return fragment;
    }

    /**
     * Mount lifecycle hook
     * @param {HTMLElement} container 
     */
    mount(container) {
        this.container = container;
    }

    /**
     * Unmount lifecycle hook
     */
    unmount() {
        this.container = null;
    }
}

export default DashboardView;
