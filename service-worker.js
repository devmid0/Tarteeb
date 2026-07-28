const CACHE_NAME = 'tarteeb-v1';

const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './core/main.js',
  './core/events/event-bus.js',
  './core/events/optimistic-dispatcher.js',
  './core/store/store.js',
  './core/router/router.js',
  './core/router/config.js',
  './core/shell/shell.js',
  './persistence/connection/database.js',
  './persistence/gateways/finance-gateway.js',
  './persistence/gateways/goals-gateway.js',
  './persistence/gateways/habit-gateway.js',
  './persistence/gateways/knowledge-gateway.js',
  './persistence/gateways/task-gateway.js',
  './pillars/dashboard/views/dashboard-view.js',
  './pillars/finance/views/finance-view.js',
  './pillars/finance/state/finance-store.js',
  './pillars/finance/domain/finance-rules.js',
  './pillars/finance/components/budget-card.js',
  './pillars/finance/components/finance-filters.js',
  './pillars/finance/components/finance-summary.js',
  './pillars/finance/components/quick-capture-input.js',
  './pillars/finance/components/transaction-feed.js',
  './pillars/goals/views/goals-view.js',
  './pillars/goals/state/goals-store.js',
  './pillars/goals/domain/goal-rules.js',
  './pillars/goals/components/goal-board.js',
  './pillars/goals/components/goal-form.js',
  './pillars/habits/views/habits-view.js',
  './pillars/habits/state/habit-store.js',
  './pillars/habits/components/habit-card.js',
  './pillars/habits/components/habit-form.js',
  './pillars/knowledge/views/pkm-view.js',
  './pillars/knowledge/views/knowledge-view.js',
  './pillars/knowledge/state/knowledge-store.js',
  './pillars/knowledge/domain/knowledge-rules.js',
  './pillars/knowledge/components/link-card.js',
  './pillars/knowledge/components/link-edit-modal.js',
  './pillars/knowledge/components/link-form.js',
  './pillars/knowledge/components/knowledge-filters.js',
  './pillars/knowledge/components/knowledge-summary.js',
  './pillars/knowledge/components/note-canvas.js',
  './pillars/knowledge/components/note-card.js',
  './pillars/knowledge/components/note-edit-modal.js',
  './pillars/knowledge/components/note-form.js',
  './pillars/knowledge/components/note-masonry.js',
  './pillars/knowledge/components/note-masonry-card.js',
  './pillars/tasks/views/tasks-view.js',
  './pillars/tasks/state/task-store.js',
  './pillars/tasks/domain/task-rules.js',
  './pillars/tasks/components/kanban-board.js',
  './pillars/tasks/components/task-edit-modal.js',
  './pillars/tasks/components/task-form.js',
  './ui/composites/command-palette.js',
  './ui/composites/quick-capture.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Local assets — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // External (CDN, fonts) — stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetched = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fetched;
      })
    )
  );
});
