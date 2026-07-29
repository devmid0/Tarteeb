/**
 * Tarteeb — Advanced Analytics Dashboard
 *
 * Two charts powered by Chart.js (dynamically loaded via CDN):
 *   - Line Chart: Tasks Completed (Last 7 Days)
 *   - Doughnut Chart: Habits Completion Rate
 *
 * Data is served from a localStorage mock generator that seeds
 * realistic fake data on first visit. This keeps the view fully
 * self-contained without IndexedDB coupling.
 *
 * Lifecycle:
 *   render()  → builds the DOM shell (header + 2 chart cards)
 *   mount()   → ensures Chart.js is loaded, seeds mock data if empty,
 *               aggregates + renders both charts
 *   unmount() → destroys Chart.js instances
 */

'use strict';

/* ─────────────────────────────────~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Chart.js CDN Injection
   ───────────────────────────────────────────────────────────── */

/**
 * Dynamically inject the Chart.js UMD bundle if window.Chart
 * is not already defined.  Returns a Promise that resolves once
 * the script is loaded (or immediately if already present).
 */
function _ensureChartJS() {
    return new Promise(function (resolve, reject) {
        if (typeof window.Chart !== 'undefined') { resolve(); return; }

        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
        script.integrity = 'sha256-+Z4Fn/0cJ3M07iitS8n3yR3EF7H1VjFcGnPzMXOvDc=';  /* optional pin */
        script.crossOrigin = 'anonymous';
        script.onload  = function () { resolve(); };
        script.onerror = function () { reject(new Error('Failed to load Chart.js from CDN')); };
        document.head.appendChild(script);
    });
}

/* ─────────────────────────────────~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Mock Data Generator
   ───────────────────────────────────────────────────────────── */

/**
 * Generate and persist realistic fake analytics data into
 * localStorage under the key 'tarteeb_analytics_mock'.
 *
 * Structure:
 *   {
 *     tasks:   Array<{ id, title, status, completedAt, … }>,
 *     habits:  Array<{ id, title, frequency, … }>,
 *     records: Array<{ id, habitId, date, completed }>
 *   }
 *
 * Only writes when the key is empty/missing — safe to call
 * on every mount.
 */
function generateAnalyticsMockData() {
    if (localStorage.getItem('tarteeb_analytics_mock')) return;

    /* ── Realistic task titles ── */
    var taskTitles = [
        'Design landing page hero section',
        'Write unit tests for auth flow',
        'Refactor database migration script',
        'Optimize image loading strategy',
        'Add dark mode toggle persistence',
        'Fix navigation active-state bug',
        'Implement search debounce',
        'Create onboarding tooltip component',
        'Update API rate-limit documentation',
        'Build weekly report export',
        'Add keyboard shortcut cheat-sheet',
        'Fix memory leak in chart re-render',
        'Integrate push notification service',
        'Set up error boundary component',
        'Design empty-state illustrations',
        'Add pagination to transaction list',
        'Refactor habit-streak calculation',
        'Implement goal progress snapshots',
        'Fix timezone offset in date picker',
        'Add CSV import for transactions',
    ];

    /* ── Habit definitions ── */
    var habitDefs = [
        { title: 'Morning meditation', category: 'mindfulness' },
        { title: 'Read for 30 minutes', category: 'learning'   },
        { title: 'Exercise',            category: 'fitness'    },
        { title: 'Drink 8 glasses of water', category: 'health' },
        { title: 'Write in journal',    category: 'mindfulness' },
        { title: 'Practice coding',     category: 'learning'   },
        { title: 'Evening stretch',     category: 'fitness'    },
    ];

    var today   = new Date();

    var tasks   = [];
    var habits  = [];
    var records = [];
    var taskId  = 1;
    var habitId = 1;
    var recordId = 1;

    /* Seed habits */
    for (var hi = 0; hi < habitDefs.length; hi++) {
        habits.push({
            id:            habitId++,
            title:         habitDefs[hi].title,
            frequency:     'daily',
            frequencyDays: null,
            frequencyDay:  null,
            category:      habitDefs[hi].category,
            archived:      false,
            sortOrder:     hi,
            createdAt:     new Date(today.getTime() - 14 * 86400000).toISOString(),
        });
    }

    /* Walk backwards through the last 7 days */
    for (var dayOffset = 6; dayOffset >= 0; dayOffset--) {
        var d = new Date(today);
        d.setDate(d.getDate() - dayOffset);
        var dateStr = d.toISOString().slice(0, 10);
        var dayOfWeek = d.getDay(); /* 0=Sun, 6=Sat */

        /* ── Tasks: 2–5 per day, ~72% completion, weighted toward weekdays ── */
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            /* Weekend: slightly fewer tasks */
            var numTasks = 1 + Math.floor(Math.random() * 3);
        } else {
            var numTasks = 3 + Math.floor(Math.random() * 3);
        }

        var shuffled = taskTitles.slice().sort(function () { return Math.random() - 0.5; });

        for (var ti = 0; ti < Math.min(numTasks, shuffled.length); ti++) {
            var isCompleted  = Math.random() < 0.72;
            var createdAt    = new Date(d.getTime() + Math.random() * 43200000).toISOString();
            var completedAt  = isCompleted
                ? new Date(d.getTime() + 3600000 * (2 + Math.floor(Math.random() * 10))).toISOString()
                : null;

            tasks.push({
                id:          taskId++,
                title:       shuffled[ti],
                status:      isCompleted ? 'completed' : 'pending',
                priority:    ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                projectId:   null,
                dueDate:     dateStr,
                completedAt: completedAt,
                createdAt:   createdAt,
                updatedAt:   completedAt || createdAt,
            });
        }

        /* ── Habit records: ~68% completion per habit per day ── */
        for (var hi2 = 0; hi2 < habits.length; hi2++) {
            var completed = Math.random() < 0.68;
            records.push({
                id:        recordId++,
                habitId:   habits[hi2].id,
                date:      dateStr,
                completed: completed,
                value:     completed ? 1 : 0,
                createdAt: new Date(d.getTime() + 3600000 * (8 + hi2)).toISOString(),
            });
        }
    }

    var mockData = { tasks: tasks, habits: habits, records: records };
    localStorage.setItem('tarteeb_analytics_mock', JSON.stringify(mockData));
}

/* ─────────────────────────────────~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Data Aggregation — Pure functions
   ───────────────────────────────────────────────────────────── */

/**
 * Aggregate tasks into completed-per-day for the last 7 days.
 * @param {Object[]} tasks
 * @returns {{ labels: string[], values: number[] }}
 */
function _aggregateTasks(tasks) {
    var today = new Date();
    var labels = [];
    var values = [];

    for (var i = 6; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        values.push(0);
    }

    if (!tasks || tasks.length === 0) return { labels: labels, values: values };

    var firstDay = new Date(today);
    firstDay.setDate(firstDay.getDate() - 6);
    var firstKey = firstDay.toISOString().slice(0, 10);

    for (var t = 0; t < tasks.length; t++) {
        var task = tasks[t];
        if (task.status !== 'completed') continue;
        var compDate = (task.completedAt || '').slice(0, 10);
        if (!compDate) continue;
        if (compDate < firstKey || compDate > today.toISOString().slice(0, 10)) continue;

        var diffMs  = new Date(compDate + 'T00:00:00') - new Date(firstKey + 'T00:00:00');
        var idx     = Math.round(diffMs / 86400000);
        if (idx >= 0 && idx < 7) values[idx]++;
    }

    return { labels: labels, values: values };
}

/**
 * Aggregate habit records into a completed-vs-missed breakdown
 * over the last 7 days.
 * @param {Object[]} habits
 * @param {Object[]} records
 * @returns {{ labels: string[], values: number[], colors: string[] }}
 */
function _aggregateHabits(habits, records) {
    var activeHabits = (habits || []).filter(function (h) { return !h.archived; });

    if (activeHabits.length === 0 || !records || records.length === 0) {
        return {
            labels: ['No data'],
            values: [1],
            colors: ['rgba(255, 255, 255, 0.06)'],
        };
    }

    var completed = 0;
    var missed    = 0;

    var today = new Date();
    var lookback = 7;
    var sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - lookback);
    var cutoff = sevenDaysAgo.toISOString().slice(0, 10);

    for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        if (!rec.date || rec.date < cutoff) continue;
        if (rec.completed) completed++; else missed++;
    }

    var total = completed + missed;
    if (total === 0) {
        return {
            labels: ['No data'],
            values: [1],
            colors: ['rgba(255, 255, 255, 0.06)'],
        };
    }

    return {
        labels: ['Completed', 'Missed'],
        values: [completed, missed],
        colors: ['#34d399', 'rgba(239, 68, 68, 0.6)'],
    };
}

/* ─────────────────────────────────~~~~~~~~~~~~~~~~~~~~~~~~────
   CSS Variable Resolver for Chart.js
   ──────────────────────────────────────────────────────────── */

function _cssVar(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/* ─────────────────────────────────~~~~~~~~~~~~~~~~────────────
   Chart.js Shared Options
   ───────────────────────────────────────────────────────────── */

function _chartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                align: 'end',
                labels: {
                    color: _cssVar('--text-tertiary', '#71717a'),
                    font: { family: "'Inter', system-ui, sans-serif", size: 11, weight: '500' },
                    boxWidth: 8,
                    boxHeight: 8,
                    boxPadding: 4,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 12,
                },
            },
            tooltip: {
                backgroundColor: _cssVar('--chart-tooltip-bg', 'rgba(28, 28, 32, 0.95)'),
                titleColor: _cssVar('--text-primary', '#f4f4f5'),
                bodyColor: _cssVar('--text-secondary', '#a1a1aa'),
                titleFont: { family: "'Inter', system-ui, sans-serif", size: 12, weight: '600' },
                bodyFont: { family: "'Inter', system-ui, sans-serif", size: 11, weight: '400' },
                padding: { x: 12, y: 8 },
                cornerRadius: 10,
                borderColor: _cssVar('--chart-grid-color', 'rgba(255, 255, 255, 0.06)'),
                borderWidth: 1,
                displayColors: true,
                boxWidth: 8,
                boxHeight: 8,
                boxPadding: 4,
                usePointStyle: true,
                callbacks: {
                    label: function (ctx) {
                        var val = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
                        return ' ' + ctx.dataset.label + ': ' + val;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                    color: _cssVar('--text-disabled', '#52525b'),
                    font: { family: "'Inter', system-ui, sans-serif", size: 10, weight: '500' },
                    maxRotation: 0,
                    autoSkipPadding: 12,
                },
            },
            y: {
                grid: {
                    display: true,
                    color: _cssVar('--chart-grid-color', 'rgba(0, 0, 0, 0.06)'),
                    lineWidth: 1,
                },
                border: { display: false },
                ticks: {
                    color: _cssVar('--text-disabled', '#52525b'),
                    font: { family: "'Inter', system-ui, sans-serif", size: 10, weight: '500' },
                    padding: 8,
                    stepSize: 1,
                },
                beginAtZero: true,
            },
        },
        animation: {
            duration: 600,
            easing: 'easeOutQuart',
        },
    };
}

/* ─────────────────────────────────~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   DOM Builders
   ───────────────────────────────────────────────────────────── */

function _chartCard(title, accentClass, canvasId, hexColor) {
    var card = document.createElement('div');
    card.className = [
        'analytics-chart-card',
        'rounded-2xl',
        'bg-surface-raised',
        'border',
        'border-white/[0.06]',
        'shadow-surface',
        'overflow-hidden',
        'flex',
        'flex-col',
    ].join(' ');

    /* ── Header ── */
    var header = document.createElement('div');
    header.className = 'flex items-center gap-3 px-5 pt-5 pb-3';

    var dot = document.createElement('span');
    dot.className = 'w-2.5 h-2.5 rounded-full flex-shrink-0';
    dot.style.background = hexColor;
    dot.style.boxShadow = '0 0 8px ' + hexColor + '40';
    header.appendChild(dot);

    var label = document.createElement('span');
    label.className = 'text-[13px] font-heading font-semibold text-text-primary tracking-tight';
    label.textContent = title;
    header.appendChild(label);

    card.appendChild(header);

    /* ── Canvas Wrap ── */
    var wrap = document.createElement('div');
    wrap.className = 'flex-1 px-4 pb-4';
    wrap.style.minHeight = '260px';

    var canvas = document.createElement('canvas');
    canvas.id = canvasId;
    wrap.appendChild(canvas);
    card.appendChild(wrap);

    return card;
}

/* ─────────────────────────────────~~~~~~~~~~~~~~~~~~~~~~~~────
   Helpers
   ──────────────────────────────────────────────────────────── */

function _dateRangeLabel() {
    var now  = new Date();
    var past = new Date();
    past.setDate(past.getDate() - 6);
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        + ' \u2014 '
        + now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─────────────────────────────────~~~~~~~~~~~~~~~~~~~~~~~~────
   Analytics View — Class
   ──────────────────────────────────────────────────────────── */

export class AnalyticsView {
    constructor() {
        this.container = null;
        this._charts   = {};
        this._data     = null;
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render() {
        var fragment = document.createDocumentFragment();

        /* Ambient gradient background */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background =
            'radial-gradient(ellipse at 25% 10%, rgba(52,211,153,0.04) 0%, transparent 55%),' +
            'radial-gradient(ellipse at 75% 90%, rgba(251,146,60,0.03) 0%, transparent 55%)';

        /* Main scrollable container */
        var main = document.createElement('div');
        main.className = 'relative h-full px-6 py-8 md:px-10 md:py-10 lg:px-12 max-w-5xl mx-auto';

        /* ── Header ── */
        var header = document.createElement('header');
        header.className = 'mb-8';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
              '<h1 class="text-[28px] font-heading font-bold text-text-primary tracking-tight leading-none">' +
                'Advanced Analytics' +
              '</h1>' +
              '<span class="text-[11px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                _dateRangeLabel() +
              '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-2">' +
              'Task completion trends and habit adherence over the last 7 days.' +
            '</p>';

        main.appendChild(header);

        /* ── Chart Grid ── */
        var grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-5';

        grid.appendChild(_chartCard(
            'Tasks Completed (Last 7 Days)',
            'accent-tasks',
            'analytics-tasks-chart',
            '#34d399'
        ));

        grid.appendChild(_chartCard(
            'Habits Completion Rate',
            'accent-habits',
            'analytics-habits-chart',
            '#fb923c'
        ));

        main.appendChild(grid);

        fragment.appendChild(gradient);
        fragment.appendChild(main);
        return fragment;
    }

    async mount(container) {
        this.container = container;

        /* 1. Ensure Chart.js is on the page */
        try {
            await _ensureChartJS();
        } catch (err) {
            console.error('[Analytics] Failed to load Chart.js:', err);
            this._renderError('Could not load Chart.js. Please check your internet connection.');
            return;
        }

        /* 2. Seed mock data if storage is empty */
        try {
            generateAnalyticsMockData();
        } catch (err) {
            console.error('[Analytics] Failed to generate mock data:', err);
        }

        /* 3. Read data from localStorage */
        try {
            var raw = localStorage.getItem('tarteeb_analytics_mock');
            this._data = raw ? JSON.parse(raw) : { tasks: [], habits: [], records: [] };
        } catch (err) {
            console.error('[Analytics] Failed to parse stored data:', err);
            this._data = { tasks: [], habits: [], records: [] };
        }

        /* 4. Render charts on next frame so the DOM is settled */
        var self = this;
        requestAnimationFrame(function () {
            self._renderTasksChart();
            self._renderHabitsChart();
        });
    }

    unmount() {
        var keys = Object.keys(this._charts);
        for (var i = 0; i < keys.length; i++) {
            if (this._charts[keys[i]]) {
                this._charts[keys[i]].destroy();
                this._charts[keys[i]] = null;
            }
        }
        this._charts   = {};
        this._data     = null;
        this.container = null;
    }

    /* ── Chart Renderers ──────────────────────────────────── */

    _renderTasksChart() {
        var canvas = this._getCanvas('analytics-tasks-chart');
        if (!canvas) return;

        var aggregated = _aggregateTasks(this._data.tasks);

        this._charts.tasks = new Chart(canvas, {
            type: 'line',
            data: {
                labels: aggregated.labels,
                datasets: [{
                    label: 'Completed',
                    data: aggregated.values,
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.10)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointRadius: 3,
                    pointBackgroundColor: '#34d399',
                    pointBorderColor: _cssVar('--surface-canvas', '#0f0f11'),
                    pointBorderWidth: 2,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#34d399',
                    pointHoverBorderColor: _cssVar('--surface-canvas', '#0f0f11'),
                    pointHoverBorderWidth: 2.5,
                }],
            },
            options: _chartOptions(),
        });
    }

    _renderHabitsChart() {
        var canvas = this._getCanvas('analytics-habits-chart');
        if (!canvas) return;

        var aggregated = _aggregateHabits(this._data.habits, this._data.records);

        this._charts.habits = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: aggregated.labels,
                datasets: [{
                    data: aggregated.values,
                    backgroundColor: aggregated.colors,
                    borderColor: _cssVar('--surface-raised', '#161619'),
                    borderWidth: 3,
                    hoverBorderColor: _cssVar('--surface-elevated', '#1c1c20'),
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: _cssVar('--chart-tooltip-bg', 'rgba(28, 28, 32, 0.95)'),
                        titleColor: _cssVar('--text-primary', '#f4f4f5'),
                        bodyColor: _cssVar('--text-secondary', '#a1a1aa'),
                        titleFont: { family: "'Inter', system-ui, sans-serif", size: 12, weight: '600' },
                        bodyFont: { family: "'Inter', system-ui, sans-serif", size: 11, weight: '400' },
                        padding: { x: 12, y: 8 },
                        cornerRadius: 10,
                        borderColor: _cssVar('--chart-grid-color', 'rgba(255, 255, 255, 0.06)'),
                        borderWidth: 1,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        boxPadding: 4,
                        usePointStyle: true,
                        callbacks: {
                            label: function (ctx) {
                                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                var pct   = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                                return ' ' + ctx.label + ': ' + pct + '%';
                            },
                        },
                    },
                },
                animation: {
                    duration: 600,
                    easing: 'easeOutQuart',
                },
            },
        });
    }

    /* ── Internal Helpers ─────────────────────────────────── */

    _getCanvas(id) {
        if (!this.container) return null;
        return this.container.querySelector('#' + id);
    }

    _renderError(message) {
        if (!this.container) return;
        var el = document.createElement('div');
        el.className = 'flex items-center justify-center h-full text-text-tertiary text-[13px] px-6 text-center';
        el.textContent = message;
        this.container.innerHTML = '';
        this.container.appendChild(el);
    }
}

export default AnalyticsView;
