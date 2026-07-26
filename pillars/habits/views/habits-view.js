/**
 * Life OS — Habits Pillar
 * 
 * Habit tracking module.
 * 
 * Sections:
 * - Today: Daily habit check-in
 * - Habits: Manage habit definitions
 * - Stats: Streak and completion statistics
 * 
 * Design constraints:
 * - Uses accent-habits color (#fb923c)
 * - Primary view has subtle orange-tinted ambient gradient
 * - Streak counts use bold weight for emphasis
 * - Completion shown with satisfying micro-animation
 */

import { createCard, createBadge } from '../../../ui/atoms/index.js';

export class HabitsView {
    constructor() {
        this.container = null;
        this.currentSection = 'today';
    }

    /**
     * Render the habits view
     * @param {string} section - Current section
     * @returns {HTMLElement}
     */
    render(section = 'today') {
        this.currentSection = section;
        
        const fragment = document.createDocumentFragment();
        
        // Main container with ambient gradient
        const main = document.createElement('div');
        main.className = 'h-full p-6 md:p-8 relative';
        
        // Ambient gradient background
        const gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background = 'radial-gradient(ellipse at 30% 50%, rgba(251, 146, 60, 0.05) 0%, transparent 70%)';
        
        // Header
        const header = document.createElement('header');
        header.className = 'relative mb-6';
        header.innerHTML = `
            <h1 class="text-3xl font-heading font-semibold text-text-primary mb-2">Habits</h1>
            <p class="text-text-secondary">Build consistency, one day at a time</p>
        `;
        
        // Section tabs
        const tabs = document.createElement('div');
        tabs.className = 'relative flex gap-1 mb-6 bg-surface-raised rounded-lg p-1';
        
        const sections = [
            { id: 'today', label: 'Today' },
            { id: 'habits', label: 'All Habits' },
            { id: 'stats', label: 'Statistics' },
        ];
        
        sections.forEach(sec => {
            const tab = document.createElement('button');
            tab.className = `px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                this.currentSection === sec.id 
                    ? 'bg-surface-elevated text-text-primary' 
                    : 'text-text-secondary hover:text-text-primary'
            }`;
            tab.textContent = sec.label;
            tab.addEventListener('click', () => {
                window.location.hash = `/habits/${sec.id}`;
            });
            tabs.appendChild(tab);
        });
        
        // Content area
        const content = document.createElement('div');
        content.className = 'relative';
        
        switch (this.currentSection) {
            case 'today':
                content.appendChild(this.renderToday());
                break;
            case 'habits':
                content.appendChild(this.renderHabits());
                break;
            case 'stats':
                content.appendChild(this.renderStats());
                break;
            default:
                content.appendChild(this.renderToday());
        }
        
        main.appendChild(gradient);
        main.appendChild(header);
        main.appendChild(tabs);
        main.appendChild(content);
        fragment.appendChild(main);
        
        return fragment;
    }

    /**
     * Render today section
     * @returns {HTMLElement}
     */
    renderToday() {
        const container = document.createElement('div');
        
        const emptyState = document.createElement('div');
        emptyState.className = 'text-center py-16';
        emptyState.innerHTML = `
            <div class="text-6xl mb-4 opacity-20">⚡</div>
            <h3 class="text-lg font-heading font-medium text-text-primary mb-2">No habits to track today</h3>
            <p class="text-text-secondary mb-6">Create habits to start building consistency</p>
            <button class="px-6 py-3 bg-accent-habits text-white rounded-lg hover:opacity-90 transition-all">
                Create Habit
            </button>
        `;
        
        container.appendChild(emptyState);
        return container;
    }

    /**
     * Render all habits section
     * @returns {HTMLElement}
     */
    renderHabits() {
        const container = document.createElement('div');
        
        const emptyState = document.createElement('div');
        emptyState.className = 'text-center py-16';
        emptyState.innerHTML = `
            <div class="text-6xl mb-4 opacity-20">🎯</div>
            <h3 class="text-lg font-heading font-medium text-text-primary mb-2">No habits defined</h3>
            <p class="text-text-secondary mb-6">Define the habits you want to build</p>
            <button class="px-6 py-3 bg-accent-habits text-white rounded-lg hover:opacity-90 transition-all">
                Add Habit
            </button>
        `;
        
        container.appendChild(emptyState);
        return container;
    }

    /**
     * Render statistics section
     * @returns {HTMLElement}
     */
    renderStats() {
        const container = document.createElement('div');
        
        const emptyState = document.createElement('div');
        emptyState.className = 'text-center py-16';
        emptyState.innerHTML = `
            <div class="text-6xl mb-4 opacity-20">📊</div>
            <h3 class="text-lg font-heading font-medium text-text-primary mb-2">No statistics yet</h3>
            <p class="text-text-secondary mb-6">Complete habits to see your progress</p>
        `;
        
        container.appendChild(emptyState);
        return container;
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

export default HabitsView;
