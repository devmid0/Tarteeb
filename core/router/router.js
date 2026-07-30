/**
 * Tarteeb — Core Router
 * 
 * Hash-based single-page router for pillar navigation.
 * 
 * Responsibilities:
 * - Map URL fragments to pillar view modules
 * - Handle route transitions with animations
 * - Manage view lifecycle (mount/unmount)
 * - Support lazy loading of pillar modules
 * 
 * Route format: #/pillar/section
 * Example: #/finance/transactions
 */

export class Router {
    constructor(store, eventBus) {
        /** @type {import('./store/store.js').Store} */
        this.store = store;
        
        /** @type {import('./events/event-bus.js').EventBus} */
        this.eventBus = eventBus;
        
        /** @type {Map<string, Function>} */
        this.routes = new Map();
        
        /** @type {Object|null} */
        this.currentView = null;
        
        /** @type {HTMLElement} */
        this.viewport = document.getElementById('viewport');
        
        /** @type {HTMLElement} */
        this.modalPortal = document.getElementById('modal-portal');
        
        // Bind hash change handler
        this.handleHashChange = this.handleHashChange.bind(this);
    }

    /**
     * Register a route with its view module
     * @param {string} path - Route path (e.g., '/finance')
     * @param {Function} viewModule - Async function returning view module
     */
    register(path, viewModule) {
        this.routes.set(path, viewModule);
    }

    /**
     * Start listening for route changes
     */
    mount() {
        window.addEventListener('hashchange', this.handleHashChange);
    }

    /**
     * Navigate to a route.
     * Sets the hash and lets hashchange drive resolution.
     * If the hash is already identical (same-page edge case),
     * resolve manually since hashchange will not fire.
     *
     * @param {string} path - Route path
     */
    navigate(path) {
        var current = window.location.hash.slice(1) || '/dashboard';
        if (current === path) {
            this.resolveRoute(path);
        } else {
            window.location.hash = path;
        }
    }

    /**
     * Handle hash change events
     */
    handleHashChange() {
        const path = window.location.hash.slice(1) || '/dashboard';
        this.resolveRoute(path);
    }

    /**
     * Check if the hash contains Supabase auth fragments
     * @param {string} hash
     * @returns {boolean}
     */
    _isSupabaseAuthHash(hash) {
        return hash.includes('access_token=') || hash.includes('error=') || hash.includes('type=');
    }

    /**
     * Resolve and render a route
     * @param {string} path - Route path
     */
    async resolveRoute(path) {
        // ── Intercept Supabase auth fragments ─────────────────
        if (this._isSupabaseAuthHash(path)) {
            window.history.replaceState(null, null, window.location.pathname + '#/dashboard');
            path = '/dashboard';
        }

        // Parse route segments
        const segments = path.split('/').filter(Boolean);
        const pillar = segments[0] || 'dashboard';
        const section = segments[1] || null;
        
        // Update store
        this.store.set('activePillar', pillar);
        this.store.set('activeSection', section);
        
        // Get view module (lazy load if needed)
        const viewLoader = this.routes.get(`/${pillar}`);
        if (!viewLoader) {
            this.renderNotFound(pillar);
            return;
        }
        
        try {
            // Dynamically import the view module
            const viewModule = await viewLoader();
            
            // Fluid exit transition
            this.viewport.classList.add('vp-exiting');
            await new Promise(function (r) { setTimeout(r, 220); });
            
            // Defer DOM swaps to next frame so the browser composites before painting
            await new Promise(requestAnimationFrame);
            
            // Unmount current view
            if (this.currentView && this.currentView.unmount) {
                this.currentView.unmount();
            }
            
            // Create new view instance
            const view = viewModule.default || viewModule;
            this.currentView = typeof view === 'function' ? new view() : view;
            
            // Render and mount
            const fragment = this.currentView.render(section);
            this.viewport.innerHTML = '';
            this.viewport.appendChild(fragment);
            
            // Enter transition
            this.viewport.classList.remove('vp-exiting');
            this.viewport.classList.add('vp-entering');
            this.viewport.offsetHeight; // force reflow
            this.viewport.classList.remove('vp-entering');
            
            if (this.currentView.mount) {
                await this.currentView.mount(this.viewport);
            }
            
            // Publish navigation event
            this.eventBus.publish('router:navigated', {
                path,
                pillar,
                section,
            });
            
        } catch (error) {
            this.viewport.classList.remove('vp-exiting', 'vp-entering');
            console.error(`[Router] Failed to load view for "${pillar}":`, error);
            this.renderError(pillar, error);
        }
    }

    /**
     * Render 404 not found view
     * @param {string} path - Invalid path
     */
    renderNotFound(path) {
        this.viewport.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="text-center space-y-4">
                    <div class="text-6xl mb-4">🔍</div>
                    <h1 class="text-2xl font-heading font-semibold text-text-primary">
                        Page Not Found
                    </h1>
                    <p class="text-text-secondary">
                        The path "/${path}" does not exist in Tarteeb.
                    </p>
                    <button onclick="window.location.hash='/dashboard'" 
                            class="px-6 py-3 bg-accent-finance text-white rounded-lg hover:bg-opacity-90 transition-all">
                        Go to Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render error view
     * @param {string} path - Path that failed
     * @param {Error} error - Error details
     */
    renderError(path, error) {
        this.viewport.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="text-center space-y-4 max-w-md">
                    <div class="text-6xl mb-4">⚠️</div>
                    <h1 class="text-2xl font-heading font-semibold text-text-primary">
                        Something Went Wrong
                    </h1>
                    <p class="text-text-secondary">
                        Failed to load the "${path}" view. Please try again.
                    </p>
                    <p class="text-text-tertiary text-sm">
                        ${error.message}
                    </p>
                    <button onclick="window.location.hash='/dashboard'" 
                            class="px-6 py-3 bg-accent-finance text-white rounded-lg hover:bg-opacity-90 transition-all">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        window.removeEventListener('hashchange', this.handleHashChange);
    }
}
