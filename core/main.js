/**
 * Tarteeb — Core Application Bootstrap
 *
 * Root module responsible for:
 * 1. Initializing the persistence layer
 * 2. Hydrating the global store
 * 3. Mounting the application shell
 * 4. Activating the router
 * 5. Handling initial route resolution
 *
 * Exposes `window.__tarteeb` for pillar modules that need
 * database/eventBus access without circular core imports.
 */

import { EventBus } from './events/event-bus.js';
import { Store } from './store/store.js';
import { createRouter } from './router/config.js';
import { Shell } from './shell/shell.js';
import { Database } from '../persistence/connection/database.js';
import { initCloudSync } from './composites/cloud-sync.js';
import { initAuth } from '../ui/composites/auth.js';

class Application {
    constructor() {
        this.eventBus = null;
        this.store = null;
        this.router = null;
        this.shell = null;
        this.database = null;
    }

    async init() {
        /* ── Stripe payment success handler ─────────────────── */
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
            localStorage.setItem('tarteeb_premium', 'true');
            history.replaceState(null, '', window.location.pathname + window.location.hash);

            var toastCtr = document.getElementById('toast-container');
            if (toastCtr) {
                var toast = document.createElement('div');
                toast.className = [
                    'px-4 py-3 rounded-xl text-[13px] font-medium shadow-elevated',
                    'animate-enter-slide-up',
                    'bg-surface-elevated border border-white/[0.06] text-text-primary',
                ].filter(Boolean).join(' ');
                toast.textContent = 'Welcome to Tarteeb Pro!';
                toastCtr.appendChild(toast);
                setTimeout(function () {
                    toast.style.animation = 'exit 200ms cubic-bezier(0.55,0,1,0.45) forwards';
                    setTimeout(function () {
                        if (toast.parentNode) toast.parentNode.removeChild(toast);
                    }, 200);
                }, 3000);
            }
        }

        /* ── Theme initialization ──────────────────────────── */
        var savedTheme = localStorage.getItem('tarteeb_theme') || 'default';
        if (savedTheme === 'ocean' && localStorage.getItem('tarteeb_premium') !== 'true') {
            savedTheme = 'default';
        }
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme !== 'light');

        try {
            this.database = new Database();
            await this.database.connect();

            this.eventBus = new EventBus();
            this.store = new Store(this.eventBus, this.database);
            await this.store.hydrate();

            /* Expose for pillar lazy-load access */
            window.__tarteeb = {
                database: this.database,
                eventBus: this.eventBus,
                store: this.store,
                user: null,
            };

            initCloudSync(this.database, this.eventBus);

            /* Gate behind authentication — shows modal + blurs app if no session */
            var session = await initAuth(this.eventBus);
            if (session) {
                localStorage.setItem('tarteeb_session_active', 'true');
            }

            this.shell = new Shell(this.store, this.eventBus);
            this.shell.mount();

            this.router = createRouter(this.store, this.eventBus);
            this.router.mount();

            const initialRoute = window.location.hash.slice(1) || '/dashboard';
            this.router.navigate(initialRoute);

            console.log('[Tarteeb] Ready');
        } catch (error) {
            console.error('[Tarteeb] Initialization failed:', error);
            this.handleFatalError(error);
        }
    }

    handleFatalError(error) {
        const viewport = document.getElementById('viewport');
        if (viewport) {
            viewport.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center space-y-4 max-w-md">
                        <div class="w-16 h-16 mx-auto rounded-2xl bg-status-error/10 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-8 h-8 text-status-error">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                            </svg>
                        </div>
                        <h1 class="text-xl font-heading font-semibold text-text-primary">Failed to Initialize</h1>
                        <p class="text-[13px] text-text-secondary leading-relaxed">Tarteeb could not start. Check the console for details.</p>
                        <button onclick="location.reload()"
                                class="px-5 py-2.5 bg-accent-finance text-white text-[13px] font-medium rounded-lg hover:brightness-110 transition-all">
                            Reload
                        </button>
                    </div>
                </div>`;
        }
    }

    async destroy() {
        if (this.router) this.router.destroy();
        if (this.shell) this.shell.destroy();
        if (this.store) this.store.destroy();
        if (this.database) this.database.disconnect();
    }
}

const app = new Application();
document.addEventListener('DOMContentLoaded', () => {
    app.init();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    }
});
window.addEventListener('beforeunload', () => app.destroy());

export default app;
