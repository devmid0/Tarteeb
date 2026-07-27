/**
 * Tarteeb — Core Store
 * 
 * Global state management for pillar-agnostic concerns.
 * 
 * Responsibilities:
 * - User preferences (theme, sidebar state, language)
 * - Active view metadata
 * - Application-level UI state
 * 
 * Constraints:
 * - Does NOT hold domain data (that lives in pillar-specific stores)
 * - State changes publish to EventBus for reactivity
 * - Persists preferences to IndexedDB via database connection
 */

export class Store {
    constructor(eventBus, database) {
        /** @type {import('./events/event-bus.js').EventBus} */
        this.eventBus = eventBus;
        
        /** @type {import('../persistence/connection/database.js').Database} */
        this.database = database;
        
        /** @type {Object} */
        this.state = {
            // Theme preferences
            theme: 'dark', // 'dark' | 'light' | 'system'
            
            // Sidebar state
            sidebar: {
                collapsed: false,
                expanded: false, // Hover-expanded on desktop
                width: 64, // Collapsed width in px
                expandedWidth: 240, // Expanded width in px
            },
            
            // Active navigation
            activePillar: null, // 'finance' | 'tasks' | 'knowledge' | 'habits' | 'goals' | 'dashboard'
            activeSection: null, // Section within the pillar
            
            // Viewport metadata
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                isMobile: window.innerWidth < 768,
                isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
                isDesktop: window.innerWidth >= 1024,
            },
            
            // Modal state
            modal: {
                open: false,
                component: null,
                props: null,
            },
            
            // Loading states
            loading: {
                global: false,
                pillars: {},
            },
        };
        
        // Bind resize handler
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.debounce(this.handleResize, 150));
    }

    /**
     * Get current state (read-only snapshot)
     * @returns {Object}
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Get a specific state slice
     * @param {string} path - Dot-notation path (e.g., 'sidebar.collapsed')
     * @returns {any}
     */
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    /**
     * Update state and publish change event
     * @param {string} path - Dot-notation path
     * @param {any} value - New value
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => obj[key], this.state);
        
        if (target && lastKey in target) {
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // Publish state change
            this.eventBus.publish('store:state-changed', {
                path,
                oldValue,
                newValue: value,
            });
        }
    }

    /**
     * Toggle a boolean state value
     * @param {string} path - Dot-notation path to boolean
     */
    toggle(path) {
        const current = this.get(path);
        if (typeof current === 'boolean') {
            this.set(path, !current);
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.state.viewport = {
            width,
            height,
            isMobile: width < 768,
            isTablet: width >= 768 && width < 1024,
            isDesktop: width >= 1024,
        };
        
        // Auto-collapse sidebar on mobile
        if (width < 768) {
            this.state.sidebar.collapsed = true;
        }
        
        this.eventBus.publish('store:viewport-changed', this.state.viewport);
    }

    /**
     * Debounce utility
     * @param {Function} fn 
     * @param {number} delay 
     * @returns {Function}
     */
    debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Persist current preferences to IndexedDB
     */
    async persist() {
        const preferences = {
            id: 'user',
            theme: this.state.theme,
            sidebar: this.state.sidebar,
        };
        
        await this.database.update('app-preferences', preferences);
    }

    /**
     * Load persisted preferences from IndexedDB
     */
    async hydrate() {
        const preferences = await this.database.get('app-preferences', 'user');
        if (preferences) {
            this.state.theme = preferences.theme || 'dark';
            this.state.sidebar = { ...this.state.sidebar, ...preferences.sidebar };
        }
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        window.removeEventListener('resize', this.handleResize);
    }
}
