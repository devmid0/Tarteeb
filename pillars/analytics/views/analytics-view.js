/**
 * Tarteeb — Advanced Analytics Dashboard
 *
 * Premium-only view that visualizes IndexedDB data using Chart.js.
 * Three charts: Finance (Line), Habits (Doughnut), Tasks (Bar).
 *
 * Lifecycle:
 *   render()  → builds the outer shell (header, grid, canvas elements, paywall)
 *   mount()   → fetches data, aggregates, renders charts if premium
 *   unmount() → destroys chart instances, tears down
 *
 * Paywall: If !user.isPremium, the entire dashboard container gets
 * a backdrop-filter: blur(8px) overlay with a CTA to upgrade.
 */

'use strict';

/* ── Domain Imports ──────────────────────────────────────── */

import { FinanceGateway } from '../../../persistence/gateways/finance-gateway.js';
import { HabitGateway }   from '../../../persistence/gateways/habit-gateway.js';
import { TaskGateway }     from '../../../persistence/gateways/task-gateway.js';

/* ── Constants ───────────────────────────────────────────── */

var CANVAS_IDS = {
    finance: 'analytics-finance-chart',
    habits:  'analytics-habits-chart',
    tasks:   'analytics-tasks-chart',
};

/* ================================================================
   ANALYTICS VIEW — Class
   ================================================================ */

export class AnalyticsView {
    constructor() {
        this.container = null;
        this._charts   = {};
        this._data     = {};
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render() {
        var fragment = document.createDocumentFragment();

        /* Ambient gradient */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background =
            'radial-gradient(ellipse at 25% 10%, rgba(251,146,60,0.03) 0%, transparent 55%),' +
            'radial-gradient(ellipse at 75% 90%, rgba(96,165,250,0.025) 0%, transparent 55%)';

        /* Main scrollable container */
        var main = document.createElement('div');
        main.className = 'relative h-full px-6 py-8 md:px-10 md:py-10 lg:px-12 max-w-6xl mx-auto';

        /* ── Header ── */
        var header = document.createElement('header');
        header.className = 'mb-8';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
                '<h1 class="text-[28px] font-heading font-bold text-text-primary tracking-tight leading-none">' +
                    'Analytics' +
                '</h1>' +
                '<span class="text-[11px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    _dateRangeLabel() +
                '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-2">Insights from your data.</p>';
        main.appendChild(header);

        /* ── Chart Grid ── */
        var grid = document.createElement('div');
        grid.className = 'analytics-grid';

        grid.appendChild(_chartCard('Finance Overview', 'accent-finance', CANVAS_IDS.finance, '#60a5fa'));
        grid.appendChild(_chartCard('Habit Completion', 'accent-habits', CANVAS_IDS.habits, '#fb923c'));
        grid.appendChild(_chartCard('Tasks This Week', 'accent-tasks', CANVAS_IDS.tasks, '#34d399'));

        main.appendChild(grid);

        fragment.appendChild(gradient);
        fragment.appendChild(main);
        return fragment;
    }

    async mount(container) {
        this.container = container;

        var user = window.__tarteeb && window.__tarteeb.user;
        var db   = window.__tarteeb && window.__tarteeb.database;
        if (!db) return;

        /* Check localStorage premium bypass before showing paywall */
        if ((!user || !user.isPremium) && localStorage.getItem('tarteeb_premium') === 'true') {
            if (user) user.isPremium = true;
        }

        /* If not premium, render paywall modal */
        if (!user || !user.isPremium) {
            this._applyPaywall(this.container);
            return;
        }

        /* Fetch all data in parallel */
        var financeGateway = new FinanceGateway(db);
        var habitGateway   = new HabitGateway(db);
        var taskGateway    = new TaskGateway(db);

        try {
            var results = await Promise.all([
                financeGateway.getAllTransactions(),
                habitGateway.getAllHabits(),
                habitGateway.getAllRecords(),
                taskGateway.getAllTasks(),
            ]);

            this._data.transactions = results[0];
            this._data.habits        = results[1];
            this._data.records       = results[2];
            this._data.tasks         = results[3];
        } catch (err) {
            console.error('[Analytics] Failed to load data:', err);
            return;
        }

        /* Render charts after DOM is ready */
        var self = this;
        requestAnimationFrame(function () {
            self._renderFinanceChart();
            self._renderHabitsChart();
            self._renderTasksChart();
        });
    }

    unmount() {
        /* Destroy Chart.js instances to free memory */
        var keys = Object.keys(this._charts);
        for (var i = 0; i < keys.length; i++) {
            if (this._charts[keys[i]]) {
                this._charts[keys[i]].destroy();
                this._charts[keys[i]] = null;
            }
        }
        this._charts   = {};
        this._data     = {};
        this.container = null;
    }

    /* ── Chart Rendering ──────────────────────────────────── */

    _renderFinanceChart() {
        var canvas = this._canvas(CANVAS_IDS.finance);
        if (!canvas) return;

        var processed = _processFinanceData(this._data.transactions || []);

        this._charts.finance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: processed.labels,
                datasets: [
                    {
                        label: 'Income',
                        data: processed.income,
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.08)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        pointHoverBackgroundColor: '#22c55e',
                        pointHoverBorderColor: '#0f0f11',
                        pointHoverBorderWidth: 2,
                    },
                    {
                        label: 'Expenses',
                        data: processed.expenses,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.06)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        pointHoverBackgroundColor: '#ef4444',
                        pointHoverBorderColor: '#0f0f11',
                        pointHoverBorderWidth: 2,
                    },
                ],
            },
            options: _chartOptions('$'),
        });
    }

    _renderHabitsChart() {
        var canvas = this._canvas(CANVAS_IDS.habits);
        if (!canvas) return;

        var processed = _processHabitsData(
            this._data.habits || [],
            this._data.records || []
        );

        this._charts.habits = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: processed.labels,
                datasets: [{
                    data: processed.values,
                    backgroundColor: processed.colors,
                    borderColor: '#161619',
                    borderWidth: 3,
                    hoverBorderColor: '#1c1c20',
                    hoverOffset: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(28, 28, 32, 0.95)',
                        titleColor: '#f4f4f5',
                        bodyColor: '#a1a1aa',
                        titleFont: { family: "'Inter', system-ui, sans-serif", size: 12, weight: '600' },
                        bodyFont: { family: "'Inter', system-ui, sans-serif", size: 11, weight: '400' },
                        padding: { x: 12, y: 8 },
                        cornerRadius: 10,
                        borderColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        boxPadding: 4,
                        usePointStyle: true,
                        callbacks: {
                            label: function (ctx) {
                                var total = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                                var pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                                return ' ' + ctx.label + ': ' + pct + '%';
                            },
                        },
                    },
                },
            },
        });
    }

    _renderTasksChart() {
        var canvas = this._canvas(CANVAS_IDS.tasks);
        if (!canvas) return;

        var processed = _processTasksData(this._data.tasks || []);

        this._charts.tasks = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: processed.labels,
                datasets: [{
                    label: 'Completed',
                    data: processed.values,
                    backgroundColor: 'rgba(52, 211, 153, 0.35)',
                    borderColor: '#34d399',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    borderSkipped: false,
                    hoverBackgroundColor: 'rgba(52, 211, 153, 0.55)',
                }],
            },
            options: _chartOptions(''),
        });
    }

    /* ── Helpers ──────────────────────────────────────────── */

    _canvas(id) {
        if (!this.container) return null;
        return this.container.querySelector('#' + id);
    }
}

/* ================================================================
   DATA AGGREGATION — Pure functions
   ================================================================ */

/**
 * Process finance transactions into Income vs Expenses per day (last 30 days).
 * @param {Object[]} transactions
 * @returns {{ labels: string[], income: number[], expenses: number[] }}
 */
function _processFinanceData(transactions) {
    var today = new Date();
    var labels  = [];
    var income  = [];
    var expenses = [];

    for (var i = 29; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var key = d.toISOString().slice(0, 10);
        var short = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        labels.push(short);
        income.push(0);
        expenses.push(0);
    }

    for (var t = 0; t < transactions.length; t++) {
        var tx = transactions[t];
        if (!tx.date) continue;
        var txDate = tx.date.slice(0, 10);
        /* Find index in our 30-day window */
        var firstDay = new Date(today);
        firstDay.setDate(firstDay.getDate() - 29);
        var firstKey = firstDay.toISOString().slice(0, 10);
        if (txDate < firstKey || txDate > today.toISOString().slice(0, 10)) continue;

        var diffMs = new Date(txDate + 'T00:00:00') - new Date(firstKey + 'T00:00:00');
        var idx = Math.round(diffMs / 86400000);
        if (idx < 0 || idx >= 30) continue;

        if (tx.type === 'income') {
            income[idx] += tx.amount || 0;
        } else if (tx.type === 'expense') {
            expenses[idx] += tx.amount || 0;
        }
    }

    return { labels: labels, income: income, expenses: expenses };
}

/**
 * Process habits into completion rate doughnut data.
 * Shows: Completed, Missed, No Data segments.
 * @param {Object[]} habits   — habit definitions
 * @param {Object[]} records  — completion records
 * @returns {{ labels: string[], values: number[], colors: string[] }}
 */
function _processHabitsData(habits, records) {
    var active = habits.filter(function (h) { return !h.archived; });
    if (active.length === 0) {
        return {
            labels: ['No habits yet'],
            values: [1],
            colors: ['rgba(255,255,255,0.06)'],
        };
    }

    var today = new Date();
    var lookback = 30;
    var completedDays = 0;
    var missedDays    = 0;

    /* Build a lookup set of completed dates per habit */
    var recordSet = {};
    for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        if (rec.completed !== false) {
            var key = rec.habitId + '|' + rec.date;
            recordSet[key] = true;
        }
    }

    for (var i = 0; i < active.length; i++) {
        var habit = active[i];
        for (var day = 0; day < lookback; day++) {
            var d = new Date(today);
            d.setDate(d.getDate() - day);
            var dateStr = d.toISOString().slice(0, 10);
            if (_isHabitDueOnDay(habit, d)) {
                if (recordSet[habit.id + '|' + dateStr]) {
                    completedDays++;
                } else {
                    missedDays++;
                }
            }
        }
    }

    var total = completedDays + missedDays;

    /* If no data at all, show empty state */
    if (total === 0) {
        return {
            labels: ['No data yet'],
            values: [1],
            colors: ['rgba(255,255,255,0.06)'],
        };
    }

    return {
        labels: ['Completed', 'Missed'],
        values: [completedDays, missedDays],
        colors: ['#34d399', 'rgba(239, 68, 68, 0.6)'],
    };
}

/**
 * Process tasks into completed-per-day over the last 7 days.
 * @param {Object[]} tasks
 * @returns {{ labels: string[], values: number[] }}
 */
function _processTasksData(tasks) {
    var today = new Date();
    var labels = [];
    var values = [];

    for (var i = 6; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var key = d.toISOString().slice(0, 10);
        var dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(dayLabel);
        values.push(0);
    }

    for (var t = 0; t < tasks.length; t++) {
        var task = tasks[t];
        if (task.status !== 'completed') continue;
        /* Use completedAt if available, otherwise fall back to updatedAt */
        var completedDate = (task.completedAt || task.updatedAt || '').slice(0, 10);
        if (!completedDate) continue;

        var firstDay = new Date(today);
        firstDay.setDate(firstDay.getDate() - 6);
        var firstKey = firstDay.toISOString().slice(0, 10);
        if (completedDate < firstKey || completedDate > today.toISOString().slice(0, 10)) continue;

        var diffMs = new Date(completedDate + 'T00:00:00') - new Date(firstKey + 'T00:00:00');
        var idx = Math.round(diffMs / 86400000);
        if (idx >= 0 && idx < 7) {
            values[idx]++;
        }
    }

    return { labels: labels, values: values };
}

/* ================================================================
   CHART.JS SHARED CONFIG — Premium dark-mode styling
   ================================================================ */

/**
 * Shared chart options for line and bar charts.
 * Removes grid lines, applies brand colors, sleek tooltips.
 * @param {string} prefix — currency prefix (e.g. '$') or ''
 * @returns {Object} Chart.js options
 */
function _chartOptions(prefix) {
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
                    color: '#71717a',
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
                backgroundColor: 'rgba(28, 28, 32, 0.95)',
                titleColor: '#f4f4f5',
                bodyColor: '#a1a1aa',
                titleFont: { family: "'Inter', system-ui, sans-serif", size: 12, weight: '600' },
                bodyFont: { family: "'Inter', system-ui, sans-serif", size: 11, weight: '400' },
                padding: { x: 12, y: 8 },
                cornerRadius: 10,
                borderColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                displayColors: true,
                boxWidth: 8,
                boxHeight: 8,
                boxPadding: 4,
                usePointStyle: true,
                callbacks: {
                    label: function (ctx) {
                        var val = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
                        var formatted = prefix
                            ? prefix + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : val.toString();
                        return ' ' + ctx.dataset.label + ': ' + formatted;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                    color: '#52525b',
                    font: { family: "'Inter', system-ui, sans-serif", size: 10, weight: '500' },
                    maxRotation: 0,
                    autoSkipPadding: 12,
                },
            },
            y: {
                grid: {
                    display: true,
                    color: 'rgba(255,255,255,0.03)',
                    lineWidth: 1,
                },
                border: { display: false },
                ticks: {
                    color: '#52525b',
                    font: { family: "'Inter', system-ui, sans-serif", size: 10, weight: '500' },
                    padding: 8,
                    callback: function (value) {
                        if (prefix) {
                            if (value >= 1000) return prefix + (value / 1000).toFixed(0) + 'k';
                            return prefix + value;
                        }
                        return value;
                    },
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

/* ================================================================
   HABIT DAY CHECK (mirrors habit-store logic inline)
   ================================================================ */

function _isHabitDueOnDay(habit, date) {
    var freq = habit.frequency || 'daily';
    if (freq === 'daily') return true;
    if (freq === 'weekly') {
        var dow = date.getDay();
        var days = habit.frequencyDays || [];
        return days.indexOf(dow) !== -1;
    }
    if (freq === 'monthly') {
        var target = habit.frequencyDay || 1;
        return date.getDate() === target;
    }
    return true;
}

/* ================================================================
   DOM BUILDERS — Pure functions
   ================================================================ */

function _chartCard(title, colorVar, canvasId, hexColor) {
    var card = document.createElement('div');
    card.className = 'analytics-chart-card';

    /* Header */
    var header = document.createElement('div');
    header.className = 'analytics-chart-card-header';

    var titleGroup = document.createElement('div');
    titleGroup.className = 'analytics-chart-card-title-group';

    var dot = document.createElement('span');
    dot.className = 'analytics-chart-card-dot';
    dot.style.background = hexColor;
    dot.style.boxShadow = '0 0 8px ' + hexColor + '40';
    titleGroup.appendChild(dot);

    var label = document.createElement('span');
    label.className = 'analytics-chart-card-label';
    label.textContent = title;
    titleGroup.appendChild(label);

    header.appendChild(titleGroup);

    card.appendChild(header);

    /* Chart wrap */
    var wrap = document.createElement('div');
    wrap.className = 'analytics-chart-wrap';

    var canvas = document.createElement('canvas');
    canvas.id = canvasId;
    wrap.appendChild(canvas);
    card.appendChild(wrap);

    return card;
}

/**
 * Apply the premium paywall modal over the analytics container.
 * Uses a single centered modal with backdrop blur.
 * @param {Element} container
 */
function _applyPaywall(container) {
    if (localStorage.getItem('tarteeb_premium') === 'true') return;

    /* Apply backdrop blur to the dashboard container */
    container.style.backdropFilter = 'blur(8px)';

    /* Bail if paywall is already rendered */
    if (container.querySelector('.analytics-paywall-modal')) return;

    /* ── Modal Overlay ── */
    var overlay = document.createElement('div');
    overlay.className = 'analytics-paywall-modal';

    /* ── Centered Card ── */
    var card = document.createElement('div');
    card.className = 'analytics-paywall-card';

    /* Icon */
    var icon = document.createElement('div');
    icon.className = 'analytics-paywall-icon';
    icon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>' +
        '</svg>';
    card.appendChild(icon);

    /* Title */
    var title = document.createElement('div');
    title.className = 'analytics-paywall-title';
    title.textContent = 'Unlock Advanced Insights';
    card.appendChild(title);

    /* Description */
    var desc = document.createElement('div');
    desc.className = 'analytics-paywall-desc';
    desc.textContent = 'Upgrade to Premium to visualize your finance, habits, and task data with interactive charts.';
    card.appendChild(desc);

    /* "Upgrade to Pro" button */
    var btn = document.createElement('button');
    btn.className = 'analytics-paywall-btn';
    btn.innerHTML =
        '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">' +
            '<path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102 1.106 4.637c.12.513-.456.913-.886.637L8.246 17.2l3.896-2.414c.463-.29 1.023-.048 1.163.442l1.413 4.874c.126.442.615.624 1.022.38l3.784-2.272a.866.866 0 00.17-1.182l-2.934-3.227 1.076-4.523c.09-.385-.156-.774-.562-.884l-4.753-.381-1.83-4.401z" clip-rule="evenodd"/>' +
        '</svg> Upgrade to Pro';
    card.appendChild(btn);

    /* "Maybe Later" text */
    var later = document.createElement('span');
    later.className = 'analytics-paywall-later';
    later.textContent = 'Maybe later';
    card.appendChild(later);

    overlay.appendChild(card);
    container.appendChild(overlay);

    /* ── Dismiss Logic ("Maybe Later") ── */
    later.addEventListener('click', function () {
        overlay.remove();
        container.style.backdropFilter = '';
    });

    /* ── Checkout Logic ("Upgrade to Pro") ── */
    var CHECKOUT_URL = 'https://buy.stripe.com/test_placeholder';

    btn.addEventListener('click', function (e) {
        if (e.altKey) {
            /* Developer cheat — Alt+click bypasses the real checkout */
            localStorage.setItem('tarteeb_premium', 'true');
            overlay.remove();
            container.style.backdropFilter = '';
            _showToast('Welcome to Tarteeb Pro!');
            return;
        }
        window.open(CHECKOUT_URL, '_blank');
    });
}

/**
 * Display a brief toast notification at the top of the toast container.
 * Mirrors the pattern used by QuickCapture / CommandPalette.
 * @param {string} message
 */
function _showToast(message) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = [
        'px-4 py-3 rounded-xl text-[13px] font-medium shadow-elevated',
        'animate-enter-slide-up',
        'bg-surface-elevated border border-white/[0.06] text-text-primary',
    ].filter(Boolean).join(' ');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
        toast.style.animation = 'exit 200ms cubic-bezier(0.55,0,1,0.45) forwards';
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 200);
    }, 2500);
}

/* ================================================================
   HELPERS
   ================================================================ */

function _dateRangeLabel() {
    var now = new Date();
    var past = new Date();
    past.setDate(past.getDate() - 29);
    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' \u2014 ' +
        now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
