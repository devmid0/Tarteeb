/**
 * Life OS — Goals Pillar
 * 
 * Goal setting and tracking module.
 * 
 * Sections:
 * - Active: Current goals in progress
 * - Completed: Achieved goals archive
 * - New: Create new goal
 * 
 * Design constraints:
 * - Uses accent-goals color (#f472b6)
 * - Primary view has subtle pink-tinted ambient gradient
 * - Progress bars use pillar accent color
 * - Milestone completion celebrated with animation
 */

import { createCard, createBadge } from '../../../ui/atoms/index.js';

export class GoalsView {
    constructor() {
        this.container = null;
        this.currentSection = 'active';
    }

    /**
     * Render the goals view
     * @param {string} section - Current section
     * @returns {HTMLElement}
     */
    render(section = 'active') {
        this.currentSection = section;
        
        const fragment = document.createDocumentFragment();
        
        // Main container with ambient gradient
        const main = document.createElement('div');
        main.className = 'h-full p-6 md:p-8 relative';
        
        // Ambient gradient background
        const gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background = 'radial-gradient(ellipse at 70% 30%, rgba(244, 114, 182, 0.05) 0%, transparent 70%)';
        
        // Header
        const header = document.createElement('header');
        header.className = 'relative mb-6';
        header.innerHTML = `
            <h1 class="text-3xl font-heading font-semibold text-text-primary mb-2">Goals</h1>
            <p class="text-text-secondary">Set intentions, track progress</p>
        `;
        
        // Section tabs
        const tabs = document.createElement('div');
        tabs.className = 'relative flex gap-1 mb-6 bg-surface-raised rounded-lg p-1';
        
        const sections = [
            { id: 'active', label: 'Active' },
            { id: 'completed', label: 'Completed' },
            { id: 'new', label: 'New Goal' },
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
                window.location.hash = `/goals/${sec.id}`;
            });
            tabs.appendChild(tab);
        });
        
        // Content area
        const content = document.createElement('div');
        content.className = 'relative';
        
        switch (this.currentSection) {
            case 'active':
                content.appendChild(this.renderActive());
                break;
            case 'completed':
                content.appendChild(this.renderCompleted());
                break;
            case 'new':
                content.appendChild(this.renderNew());
                break;
            default:
                content.appendChild(this.renderActive());
        }
        
        main.appendChild(gradient);
        main.appendChild(header);
        main.appendChild(tabs);
        main.appendChild(content);
        fragment.appendChild(main);
        
        return fragment;
    }

    /**
     * Render active goals section
     * @returns {HTMLElement}
     */
    renderActive() {
        const container = document.createElement('div');
        
        const emptyState = document.createElement('div');
        emptyState.className = 'text-center py-16';
        emptyState.innerHTML = `
            <div class="text-6xl mb-4 opacity-20">⭐</div>
            <h3 class="text-lg font-heading font-medium text-text-primary mb-2">No active goals</h3>
            <p class="text-text-secondary mb-6">Set your first goal to start making progress</p>
            <button class="px-6 py-3 bg-accent-goals text-white rounded-lg hover:opacity-90 transition-all">
                Create Goal
            </button>
        `;
        
        container.appendChild(emptyState);
        return container;
    }

    /**
     * Render completed goals section
     * @returns {HTMLElement}
     */
    renderCompleted() {
        const container = document.createElement('div');
        
        const emptyState = document.createElement('div');
        emptyState.className = 'text-center py-16';
        emptyState.innerHTML = `
            <div class="text-6xl mb-4 opacity-20">🏆</div>
            <h3 class="text-lg font-heading font-medium text-text-primary mb-2">No completed goals yet</h3>
            <p class="text-text-secondary mb-6">Your achievements will appear here</p>
        `;
        
        container.appendChild(emptyState);
        return container;
    }

    /**
     * Render new goal section
     * @returns {HTMLElement}
     */
    renderNew() {
        const container = document.createElement('div');
        
        const form = document.createElement('div');
        form.className = 'max-w-md mx-auto py-8';
        form.innerHTML = `
            <h3 class="text-lg font-heading font-medium text-text-primary mb-6">Create New Goal</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm text-text-secondary mb-2">Goal Name</label>
                    <input type="text" 
                           class="w-full px-4 py-2.5 bg-surface-raised border border-text-tertiary rounded-lg text-text-primary focus:outline-none focus:border-accent-goals transition-colors"
                           placeholder="What do you want to achieve?">
                </div>
                <div>
                    <label class="block text-sm text-text-secondary mb-2">Description</label>
                    <textarea rows="3"
                              class="w-full px-4 py-2.5 bg-surface-raised border border-text-tertiary rounded-lg text-text-primary focus:outline-none focus:border-accent-goals transition-colors resize-none"
                              placeholder="Why is this important to you?"></textarea>
                </div>
                <div>
                    <label class="block text-sm text-text-secondary mb-2">Target Date</label>
                    <input type="date" 
                           class="w-full px-4 py-2.5 bg-surface-raised border border-text-tertiary rounded-lg text-text-primary focus:outline-none focus:border-accent-goals transition-colors">
                </div>
                <button class="w-full px-6 py-3 bg-accent-goals text-white rounded-lg hover:opacity-90 transition-all mt-4">
                    Create Goal
                </button>
            </div>
        `;
        
        container.appendChild(form);
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

export default GoalsView;
