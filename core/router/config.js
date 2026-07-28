/**
 * Tarteeb — Route Configuration
 * 
 * Maps URL paths to pillar view modules.
 * This is the single source of truth for navigation.
 * 
 * Route format: #/pillar/section
 * 
 * Pillars:
 * - /dashboard - Overview (no sub-sections)
 * - /finance - Personal finance (transactions, budgets, reports)
 * - /tasks - Task management (today, all, projects)
 * - /knowledge - Knowledge management (notes, links)
 * - /habits - Habit tracking (today, habits, stats)
 * - /goals - Goal setting (active, completed, new)
 * - /analytics - Advanced analytics (premium, charts)
 */

import { Router } from './router.js';
import { Store } from '../store/store.js';
import { EventBus } from '../events/event-bus.js';

/**
 * Initialize and configure the router
 * @param {Store} store 
 * @param {EventBus} eventBus 
 * @returns {Router}
 */
export function createRouter(store, eventBus) {
    const router = new Router(store, eventBus);
    
    // Dashboard (no lazy loading - always available)
    router.register('/dashboard', () => 
        import('../../pillars/dashboard/views/dashboard-view.js')
    );
    
    // Finance pillar
    router.register('/finance', () => 
        import('../../pillars/finance/views/finance-view.js')
    );
    
    // Tasks pillar
    router.register('/tasks', () => 
        import('../../pillars/tasks/views/tasks-view.js')
    );
    
    // Knowledge pillar
    router.register('/knowledge', () =>
        import('../../pillars/knowledge/views/pkm-view.js')
    );
    
    // Habits pillar
    router.register('/habits', () => 
        import('../../pillars/habits/views/habits-view.js')
    );
    
    // Goals pillar
    router.register('/goals', () => 
        import('../../pillars/goals/views/goals-view.js')
    );

    // Analytics (premium)
    router.register('/analytics', () =>
        import('../../pillars/analytics/views/analytics-view.js')
    );
    
    return router;
}

export default createRouter;
