/**
 * Life OS — Dashboard View
 *
 * The convergence point: read-only projection hub aggregating
 * live data from all five domain stores. This is NOT a pillar —
 * it is a synthesis space.
 *
 * Lifecycle:
 *   render()  → builds the outer shell (gradient, header, grid skeleton)
 *   mount()   → instantiates all 5 gateways + stores, hydrates in
 *               parallel, subscribes to all ':changed' events
 *   unmount() → tears down subscriptions, nullifies stores
 *
 * Data flow:
 *   Each domain store publishes '<domain>:changed' → EventBus
 *   Dashboard receives 5 independent update streams → targeted
 *   widget rebuilds (NOT full re-render — each widget owns its
 *   own slot in the grid and only its own DOM subtree).
 *
 * Design constraints:
 *   - Neutral accent palette — no single pillar hue dominates
 *   - CSS Grid layout with Tailwind utility classes
 *   - Skeleton loaders during hydration
 *   - Elegant empty states per widget
 *   - Zero visual clutter — micro-spacing, restrained typography
 *   - Read-only — no dispatch calls, no interactive forms
 */

'use strict';

/* ── Domain Imports ──────────────────────────────────────── */

import { TaskStore }    from '../../tasks/state/task-store.js';
import { TaskGateway }  from '../../../persistence/gateways/task-gateway.js';

import { FinanceStore }   from '../../finance/state/finance-store.js';
import { FinanceGateway } from '../../../persistence/gateways/finance-gateway.js';

import { KnowledgeStore }   from '../../knowledge/state/knowledge-store.js';
import { KnowledgeGateway } from '../../../persistence/gateways/knowledge-gateway.js';

import { HabitStore }   from '../../habits/state/habit-store.js';
import { HabitGateway } from '../../../persistence/gateways/habit-gateway.js';

import { GoalsStore }   from '../../goals/state/goals-store.js';
import { GoalsGateway } from '../../../persistence/gateways/goals-gateway.js';

/* ── Constants ───────────────────────────────────────────── */

var WIDGET_IDS = {
    tasks:    'dash-tasks',
    finance:  'dash-finance',
    habits:   'dash-habits',
    goals:    'dash-goals',
    knowledge:'dash-knowledge',
};

/* ================================================================
   DASHBOARD VIEW — Class
   ================================================================ */

export class DashboardView {
    constructor() {
        this.container = null;
        this.stores    = {};
        this._unsubs   = [];
        this._booted   = false;
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    render() {
        var fragment = document.createDocumentFragment();

        /* Ambient gradient */
        var gradient = document.createElement('div');
        gradient.className = 'absolute inset-0 pointer-events-none';
        gradient.style.background =
            'radial-gradient(ellipse at 20% 10%, rgba(96,165,250,0.03) 0%, transparent 50%),' +
            'radial-gradient(ellipse at 80% 80%, rgba(244,114,182,0.03) 0%, transparent 50%)';

        /* Main wrapper */
        var main = document.createElement('div');
        main.className = 'relative h-full p-6 md:p-8 max-w-6xl mx-auto';

        /* ── Header ── */
        var header = document.createElement('header');
        header.className = 'mb-8';
        header.innerHTML =
            '<div class="flex items-end justify-between mb-1">' +
                '<h1 id="dash-greeting" class="text-[28px] font-heading font-semibold text-text-primary tracking-tight leading-none">' +
                    _greetingText() +
                '</h1>' +
                '<span class="text-[12px] font-medium text-text-disabled uppercase tracking-widest pb-1">' +
                    _dateString() +
                '</span>' +
            '</div>' +
            '<p class="text-[13px] text-text-tertiary mt-1">' + _subtitleText() + '</p>';
        main.appendChild(header);

        /* ── Pillar Summary Bar ── */
        var summaryBar = document.createElement('div');
        summaryBar.id = 'dash-summary-bar';
        summaryBar.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8';
        summaryBar.appendChild(_skeletonSummaryCard());
        summaryBar.appendChild(_skeletonSummaryCard());
        summaryBar.appendChild(_skeletonSummaryCard());
        summaryBar.appendChild(_skeletonSummaryCard());
        summaryBar.appendChild(_skeletonSummaryCard());
        main.appendChild(summaryBar);

        /* ── Widget Grid ── */
        var grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 lg:grid-cols-12 gap-4';

        /* Tasks widget — spans 5 cols */
        var tasksSlot = _widgetShell('Today\'s Focus', 'Tasks', WIDGET_IDS.tasks, 'lg:col-span-5');
        grid.appendChild(tasksSlot);

        /* Habits widget — spans 4 cols */
        var habitsSlot = _widgetShell('Daily Consistency', 'Habits', WIDGET_IDS.habits, 'lg:col-span-4');
        grid.appendChild(habitsSlot);

        /* Goals widget — spans 3 cols */
        var goalsSlot = _widgetShell('Goal Progress', 'Goals', WIDGET_IDS.goals, 'lg:col-span-3');
        grid.appendChild(goalsSlot);

        /* Finance widget — spans 6 cols */
        var financeSlot = _widgetShell('Monthly Overview', 'Finance', WIDGET_IDS.finance, 'lg:col-span-6');
        grid.appendChild(financeSlot);

        /* Knowledge widget — spans 6 cols */
        var knowledgeSlot = _widgetShell('Knowledge Base', 'Knowledge', WIDGET_IDS.knowledge, 'lg:col-span-6');
        grid.appendChild(knowledgeSlot);

        main.appendChild(grid);

        fragment.appendChild(gradient);
        fragment.appendChild(main);
        return fragment;
    }

    async mount(container) {
        this.container = container;
        var db = window.__lifeOS && window.__lifeOS.database;
        var bus = window.__lifeOS && window.__lifeOS.eventBus;
        if (!db || !bus) return;

        /* Instantiate all 5 gateways + stores */
        this.stores.tasks     = new TaskStore(bus, new TaskGateway(db));
        this.stores.finance   = new FinanceStore(bus, new FinanceGateway(db));
        this.stores.knowledge = new KnowledgeStore(bus, new KnowledgeGateway(db));
        this.stores.habits    = new HabitStore(bus, new HabitGateway(db));
        this.stores.goals     = new GoalsStore(bus, new GoalsGateway(db));

        /* Subscribe to all 5 change streams */
        var self = this;
        this._unsubs.push(
            bus.subscribe('tasks:changed',     function () { self._refreshWidget('tasks'); }),
            bus.subscribe('finance:changed',   function () { self._refreshWidget('finance'); }),
            bus.subscribe('knowledge:changed', function () { self._refreshWidget('knowledge'); }),
            bus.subscribe('habits:changed',    function () { self._refreshWidget('habits'); }),
            bus.subscribe('goals:changed',     function () { self._refreshWidget('goals'); }),
        );

        /* Hydrate all 5 stores in parallel */
        await Promise.all([
            this.stores.tasks.hydrate(),
            this.stores.finance.hydrate(),
            this.stores.knowledge.hydrate(),
            this.stores.habits.hydrate(),
            this.stores.goals.hydrate(),
        ]);

        this._booted = true;
        this._refreshAll();
    }

    unmount() {
        for (var i = 0; i < this._unsubs.length; i++) {
            this._unsubs[i]();
        }
        this._unsubs   = [];
        this.stores    = {};
        this.container = null;
        this._booted   = false;
    }

    /* ── Rendering ────────────────────────────────────────── */

    _refreshAll() {
        this._refreshSummaryBar();
        this._refreshWidget('tasks');
        this._refreshWidget('finance');
        this._refreshWidget('habits');
        this._refreshWidget('goals');
        this._refreshWidget('knowledge');
    }

    _refreshWidget(domain) {
        var slot = this._slot(WIDGET_IDS[domain]);
        if (!slot) return;
        slot.innerHTML = '';

        switch (domain) {
            case 'tasks':     _renderTasksWidget(slot, this.stores.tasks); break;
            case 'finance':   _renderFinanceWidget(slot, this.stores.finance); break;
            case 'habits':    _renderHabitsWidget(slot, this.stores.habits); break;
            case 'goals':     _renderGoalsWidget(slot, this.stores.goals); break;
            case 'knowledge': _renderKnowledgeWidget(slot, this.stores.knowledge); break;
        }
    }

    _refreshSummaryBar() {
        var bar = this.container && this.container.querySelector('#dash-summary-bar');
        if (!bar) return;
        bar.innerHTML = '';

        var s = this.stores;

        /* Tasks */
        bar.appendChild(_summaryCard(
            '\u2713', 'Tasks', 'accent-tasks',
            s.tasks ? s.tasks.getTodayTasks().length : 0,
            'due today',
            '/tasks'
        ));

        /* Finance */
        var monthTotals = s.finance ? s.finance.getMonthTotals() : { expense: 0, income: 0 };
        bar.appendChild(_summaryCard(
            '\u00A5', 'Finance', 'accent-finance',
            _formatCurrency(monthTotals.expense),
            'spent this month',
            '/finance'
        ));

        /* Knowledge */
        var kStats = s.knowledge ? s.knowledge.getStats() : { totalNotes: 0, totalLinks: 0 };
        bar.appendChild(_summaryCard(
            '\u2261', 'Knowledge', 'accent-knowledge',
            kStats.totalNotes + kStats.totalLinks,
            'notes & links',
            '/knowledge'
        ));

        /* Habits */
        var hToday = s.habits ? s.habits.getTodaySummary() : { completed: 0, totalDue: 0 };
        bar.appendChild(_summaryCard(
            '\u26A1', 'Habits', 'accent-habits',
            hToday.completed + '/' + hToday.totalDue,
            'done today',
            '/habits'
        ));

        /* Goals */
        var gStats = s.goals ? s.goals.getStats() : { activeGoals: 0 };
        bar.appendChild(_summaryCard(
            '\u2B50', 'Goals', 'accent-goals',
            gStats.activeGoals,
            'in progress',
            '/goals'
        ));
    }

    _slot(id) {
        return this.container && this.container.querySelector('#' + id);
    }
}

/* ================================================================
   WIDGET BUILDERS — Pure functions
   ================================================================ */

/* ── Tasks Widget ─────────────────────────────────────────── */

function _renderTasksWidget(slot, store) {
    if (!store) { slot.innerHTML = _skeletonLines(4); return; }

    var todayTasks = store.getTodayTasks();
    var overdue    = store.getOverdueTasks();
    var active     = store.getActiveTasks();

    /* Overdue banner */
    if (overdue.length > 0) {
        var banner = document.createElement('div');
        banner.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-status-error/8 border border-status-error/10 mb-3';
        banner.innerHTML =
            '<span class="text-status-error text-[12px] font-semibold">' + overdue.length + ' overdue task' + (overdue.length !== 1 ? 's' : '') + '</span>';
        slot.appendChild(banner);
    }

    /* Today's tasks */
    var tasksToShow = todayTasks.length > 0 ? todayTasks : active.slice(0, 5);

    if (tasksToShow.length === 0) {
        slot.appendChild(_emptyState('\uD83C\uDF1F', 'No tasks for today', 'All clear — enjoy your focus time.'));
        return;
    }

    var list = document.createElement('div');
    list.className = 'space-y-1.5';

    for (var i = 0; i < tasksToShow.length; i++) {
        var t = tasksToShow[i];
        var row = document.createElement('div');
        row.className = [
            'flex items-center gap-3 px-3 py-2 rounded-lg',
            'bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-100',
        ].join(' ');

        /* Status dot */
        var dot = document.createElement('span');
        var isOverdue = t.dueDate && t.dueDate < _todayISO() && t.status !== 'completed';
        dot.className = [
            'flex-shrink-0 w-2 h-2 rounded-full',
            isOverdue ? 'bg-status-error' :
            t.priority === 'high' ? 'bg-status-error/60' :
            t.priority === 'medium' ? 'bg-status-warning/60' :
            'bg-text-disabled/40',
        ].join(' ');
        row.appendChild(dot);

        /* Title */
        var title = document.createElement('span');
        var isDone = t.status === 'completed';
        title.className = [
            'flex-1 text-[13px] truncate',
            isDone ? 'text-text-disabled line-through' : 'text-text-secondary',
        ].join(' ');
        title.textContent = t.name || t.title || 'Untitled';
        row.appendChild(title);

        /* Due badge */
        if (t.dueDate && !isDone) {
            var dueBadge = document.createElement('span');
            var daysLeft = _daysDiff(t.dueDate);
            dueBadge.className = [
                'flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums',
                daysLeft < 0 ? 'text-status-error bg-status-error/10' :
                daysLeft <= 2 ? 'text-status-warning bg-status-warning/10' :
                'text-text-disabled bg-white/[0.04]',
            ].join(' ');
            dueBadge.textContent = daysLeft < 0 ? Math.abs(daysLeft) + 'd late' : daysLeft + 'd';
            row.appendChild(dueBadge);
        }

        list.appendChild(row);
    }

    slot.appendChild(list);

    /* Footer: total active count */
    if (active.length > 5) {
        var footer = document.createElement('div');
        footer.className = 'mt-3 text-[11px] text-text-disabled';
        footer.textContent = '+' + (active.length - tasksToShow.length) + ' more active tasks';
        slot.appendChild(footer);
    }
}

/* ── Finance Widget ───────────────────────────────────────── */

function _renderFinanceWidget(slot, store) {
    if (!store) { slot.innerHTML = _skeletonLines(4); return; }

    var monthTotals = store.getMonthTotals();
    var weekTotals  = store.getWeekTotals();
    var budgets     = store.getBudgetStatuses();

    /* Hero row: income / expense / net */
    var heroRow = document.createElement('div');
    heroRow.className = 'grid grid-cols-3 gap-3 mb-4';

    heroRow.appendChild(_financeStatCell('Income', monthTotals.income, 'text-status-success'));
    heroRow.appendChild(_financeStatCell('Expenses', monthTotals.expense, 'text-status-error'));
    heroRow.appendChild(_financeStatCell('Net', monthTotals.net, monthTotals.net >= 0 ? 'text-status-success' : 'text-status-error'));

    slot.appendChild(heroRow);

    /* This week label */
    var weekLabel = document.createElement('div');
    weekLabel.className = 'text-[11px] text-text-disabled uppercase tracking-wider mb-2';
    weekLabel.textContent = 'This Week';
    slot.appendChild(weekLabel);

    var weekRow = document.createElement('div');
    weekRow.className = 'flex items-center gap-4 mb-4';
    weekRow.innerHTML =
        '<span class="text-[12px] text-text-secondary">\u2191 ' + _formatCurrency(weekTotals.income) + ' <span class="text-text-disabled">in</span></span>' +
        '<span class="text-[12px] text-text-secondary">\u2193 ' + _formatCurrency(weekTotals.expense) + ' <span class="text-text-disabled">out</span></span>';
    slot.appendChild(weekRow);

    /* Budget bars (max 3) */
    if (budgets.length > 0) {
        var budgetLabel = document.createElement('div');
        budgetLabel.className = 'text-[11px] text-text-disabled uppercase tracking-wider mb-2 mt-1';
        budgetLabel.textContent = 'Budgets';
        slot.appendChild(budgetLabel);

        var budgetList = document.createElement('div');
        budgetList.className = 'space-y-2.5';

        var shown = budgets.length > 3 ? 3 : budgets.length;
        for (var i = 0; i < shown; i++) {
            var bs = budgets[i];
            budgetList.appendChild(_budgetBar(bs));
        }

        slot.appendChild(budgetList);
    }
}

function _financeStatCell(label, value, colorClass) {
    var cell = document.createElement('div');
    cell.className = 'text-center';
    cell.innerHTML =
        '<div class="text-[10px] text-text-disabled uppercase tracking-wider mb-1">' + label + '</div>' +
        '<div class="text-[16px] font-heading font-bold leading-none tabular-nums ' + colorClass + '">' + _formatCurrency(value) + '</div>';
    return cell;
}

function _budgetBar(bs) {
    var row = document.createElement('div');

    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-1';

    var name = document.createElement('span');
    name.className = 'text-[12px] text-text-secondary font-medium';
    name.textContent = bs.budget.category || bs.budget.name || 'Budget';
    header.appendChild(name);

    var pct = document.createElement('span');
    pct.className = 'text-[11px] tabular-nums font-medium ' + (bs.overBudget ? 'text-status-error' : 'text-text-disabled');
    pct.textContent = bs.percentage + '%';
    header.appendChild(pct);

    row.appendChild(header);

    var barWrap = document.createElement('div');
    barWrap.className = 'relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden';

    var bar = document.createElement('div');
    bar.className = [
        'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
        bs.overBudget ? 'bg-status-error' : 'bg-accent-finance',
    ].join(' ');
    bar.style.width = Math.min(bs.percentage, 100) + '%';
    barWrap.appendChild(bar);

    row.appendChild(barWrap);
    return row;
}

/* ── Habits Widget ────────────────────────────────────────── */

function _renderHabitsWidget(slot, store) {
    if (!store) { slot.innerHTML = _skeletonLines(4); return; }

    var today = store.getTodaySummary();
    var stats = store.getStats();

    /* Circular progress ring */
    var ringWrap = document.createElement('div');
    ringWrap.className = 'flex items-center gap-5 mb-4';

    ringWrap.appendChild(_progressRing(today.percentage, 64));

    var ringInfo = document.createElement('div');
    ringInfo.innerHTML =
        '<div class="text-[22px] font-heading font-bold text-text-primary leading-none tabular-nums">' +
            today.completed + '<span class="text-[14px] text-text-disabled font-normal">/' + today.totalDue + '</span>' +
        '</div>' +
        '<div class="text-[12px] text-text-tertiary mt-1">completed today</div>';
    ringWrap.appendChild(ringInfo);

    slot.appendChild(ringWrap);

    /* Top streaks (max 4) */
    var streaks = store.getAllStreaks();
    streaks.sort(function (a, b) { return b.streak - a.streak; });

    if (streaks.length > 0) {
        var streakLabel = document.createElement('div');
        streakLabel.className = 'text-[11px] text-text-disabled uppercase tracking-wider mb-2';
        streakLabel.textContent = 'Active Streaks';
        slot.appendChild(streakLabel);

        var streakList = document.createElement('div');
        streakList.className = 'space-y-1.5';

        var shown = streaks.length > 4 ? 4 : streaks.length;
        for (var i = 0; i < shown; i++) {
            var st = streaks[i];
            var row = document.createElement('div');
            row.className = 'flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.02]';

            var left = document.createElement('span');
            left.className = 'text-[12px] text-text-secondary truncate';
            left.textContent = (st.habit.icon || '\u26A1') + ' ' + (st.habit.name || 'Habit');
            row.appendChild(left);

            var right = document.createElement('span');
            right.className = 'text-[12px] font-semibold tabular-nums ' +
                (st.streak > 0 ? 'text-accent-habits' : 'text-text-disabled');
            right.textContent = st.streak + 'd';
            row.appendChild(right);

            streakList.appendChild(row);
        }

        slot.appendChild(streakList);
    } else if (today.totalDue === 0) {
        slot.appendChild(_emptyState('\u26A1', 'No habits due today', 'Rest day or no habits defined.'));
    }
}

/* ── Goals Widget ─────────────────────────────────────────── */

function _renderGoalsWidget(slot, store) {
    if (!store) { slot.innerHTML = _skeletonLines(4); return; }

    var stats    = store.getStats();
    var active   = store.getActiveGoals();
    var progress = store.getAllProgress();

    if (active.length === 0) {
        slot.appendChild(_emptyState('\uD83C\uDFAF', 'No active goals', 'Set a goal to start tracking progress.'));
        return;
    }

    /* Top 5 goals with progress bars */
    var shown = active.length > 5 ? 5 : active.length;
    for (var i = 0; i < shown; i++) {
        var g = active[i];
        var p = progress[g.id] || { completed: 0, total: 0, percentage: 0 };
        slot.appendChild(_goalProgressRow(g, p));
    }

    /* Footer stat */
    if (stats.overdueGoals > 0) {
        var warn = document.createElement('div');
        warn.className = 'mt-3 flex items-center gap-1.5 text-[11px] text-status-error font-medium';
        warn.innerHTML = '<span>\u26A0</span> ' + stats.overdueGoals + ' overdue';
        slot.appendChild(warn);
    }
}

function _goalProgressRow(goal, prog) {
    var row = document.createElement('div');
    row.className = 'mb-3 last:mb-0';

    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-1';

    var name = document.createElement('span');
    name.className = 'text-[12px] text-text-secondary font-medium truncate max-w-[70%]';
    name.textContent = (goal.emoji || '\uD83C\uDFAF') + ' ' + (goal.title || 'Goal');
    header.appendChild(name);

    var pct = document.createElement('span');
    pct.className = 'text-[11px] text-text-disabled tabular-nums font-medium';
    pct.textContent = prog.percentage + '%';
    header.appendChild(pct);

    row.appendChild(header);

    var barWrap = document.createElement('div');
    barWrap.className = 'relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden';

    var bar = document.createElement('div');
    bar.className = 'absolute inset-y-0 left-0 rounded-full bg-accent-goals transition-all duration-700 ease-out';
    bar.style.width = '0%';
    barWrap.appendChild(bar);

    row.appendChild(barWrap);

    /* Animate after paint */
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            bar.style.width = prog.percentage + '%';
        });
    });

    return row;
}

/* ── Knowledge Widget ─────────────────────────────────────── */

function _renderKnowledgeWidget(slot, store) {
    if (!store) { slot.innerHTML = _skeletonLines(4); return; }

    var stats  = store.getStats();
    var recent = store.getRecentNotes(4);

    /* Stat pills row */
    var pills = document.createElement('div');
    pills.className = 'flex flex-wrap gap-2 mb-4';

    pills.appendChild(_statPill(stats.totalNotes + ' notes', 'bg-accent-knowledge/10 text-accent-knowledge'));
    pills.appendChild(_statPill(stats.totalLinks + ' links', 'bg-accent-finance/10 text-accent-finance'));
    pills.appendChild(_statPill(_formatWordCount(stats.totalWords) + ' words', 'bg-white/[0.04] text-text-tertiary'));

    if (stats.pinnedCount > 0) {
        pills.appendChild(_statPill(stats.pinnedCount + ' pinned', 'bg-status-warning/10 text-status-warning'));
    }

    slot.appendChild(pills);

    /* Recent notes */
    if (recent.length > 0) {
        var label = document.createElement('div');
        label.className = 'text-[11px] text-text-disabled uppercase tracking-wider mb-2';
        label.textContent = 'Recently Added';
        slot.appendChild(label);

        var list = document.createElement('div');
        list.className = 'space-y-1.5';

        for (var i = 0; i < recent.length; i++) {
            var n = recent[i];
            var row = document.createElement('div');
            row.className = [
                'flex items-center gap-3 px-3 py-2 rounded-lg',
                'bg-white/[0.02] hover:bg-white/[0.04] transition-colors duration-100',
            ].join(' ');

            var icon = document.createElement('span');
            icon.className = 'text-[11px] text-text-disabled flex-shrink-0';
            icon.textContent = n.category ? _categoryIcon(n.category) : '\u2261';
            row.appendChild(icon);

            var title = document.createElement('span');
            title.className = 'flex-1 text-[12px] text-text-secondary truncate';
            title.textContent = n.title || 'Untitled note';
            row.appendChild(title);

            if (n.isPinned) {
                var pin = document.createElement('span');
                pin.className = 'text-[10px] text-status-warning';
                pin.textContent = '\uD83D\uDCCB';
                row.appendChild(pin);
            }

            list.appendChild(row);
        }

        slot.appendChild(list);
    } else if (stats.totalNotes === 0 && stats.totalLinks === 0) {
        slot.appendChild(_emptyState('\uD83D\uDCD6', 'No knowledge yet', 'Start capturing notes and links.'));
    }
}

/* ================================================================
   SHARED UI BUILDERS — Pure functions
   ================================================================ */

function _widgetShell(title, domain, id, spanClass) {
    var wrapper = document.createElement('div');
    wrapper.className = [
        'rounded-2xl bg-surface-raised/60 border border-white/[0.04]',
        'p-4',
        spanClass || '',
    ].join(' ');

    var header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-3';

    var heading = document.createElement('h3');
    heading.className = 'text-[13px] font-semibold text-text-primary';
    heading.textContent = title;
    header.appendChild(heading);

    var link = document.createElement('a');
    link.href = '#/' + domain.toLowerCase();
    link.className = 'text-[11px] text-text-disabled hover:text-text-tertiary transition-colors duration-150';
    link.textContent = 'View all';
    header.appendChild(link);

    var body = document.createElement('div');
    body.id = id;
    body.innerHTML = _skeletonLines(3);

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    return wrapper;
}

function _summaryCard(icon, label, color, value, sub, href) {
    var card = document.createElement('a');
    card.href = '#' + href;
    card.className = [
        'group relative rounded-2xl border border-white/[0.04]',
        'bg-surface-raised/40 hover:bg-surface-elevated/40',
        'hover:border-white/[0.08]',
        'p-4 transition-all duration-200',
        'flex flex-col',
    ].join(' ');

    var iconEl = document.createElement('div');
    iconEl.className = 'text-xl mb-2 opacity-60 group-hover:opacity-100 transition-opacity duration-200';
    iconEl.textContent = icon;
    card.appendChild(iconEl);

    var valueEl = document.createElement('div');
    valueEl.className = 'text-[20px] font-heading font-bold text-text-primary leading-none tabular-nums mb-1';
    valueEl.textContent = value;
    card.appendChild(valueEl);

    var subEl = document.createElement('div');
    subEl.className = 'text-[11px] text-text-tertiary';
    subEl.textContent = sub;
    card.appendChild(subEl);

    return card;
}

function _progressRing(percentage, size) {
    var wrap = document.createElement('div');
    wrap.className = 'relative flex-shrink-0';
    wrap.style.width = size + 'px';
    wrap.style.height = size + 'px';

    var r = (size - 8) / 2;
    var c = 2 * Math.PI * r;
    var offset = c - (percentage / 100) * c;

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);

    /* Background circle */
    var bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('cx', String(size / 2));
    bgCircle.setAttribute('cy', String(size / 2));
    bgCircle.setAttribute('r', String(r));
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    bgCircle.setAttribute('stroke-width', '4');
    svg.appendChild(bgCircle);

    /* Progress arc */
    var progCircle = document.createElementNS(svgNS, 'circle');
    progCircle.setAttribute('cx', String(size / 2));
    progCircle.setAttribute('cy', String(size / 2));
    progCircle.setAttribute('r', String(r));
    progCircle.setAttribute('fill', 'none');
    progCircle.setAttribute('stroke', 'var(--color-accent-habits, #a78bfa)');
    progCircle.setAttribute('stroke-width', '4');
    progCircle.setAttribute('stroke-linecap', 'round');
    progCircle.setAttribute('stroke-dasharray', String(c));
    progCircle.setAttribute('stroke-dashoffset', String(c));
    progCircle.setAttribute('transform', 'rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')');
    progCircle.style.transition = 'stroke-dashoffset 800ms cubic-bezier(0.45,0,0.55,1)';
    svg.appendChild(progCircle);

    wrap.appendChild(svg);

    /* Center text */
    var center = document.createElement('div');
    center.className = 'absolute inset-0 flex items-center justify-center text-[13px] font-bold text-text-primary tabular-nums';
    center.textContent = percentage + '%';
    wrap.appendChild(center);

    /* Animate after paint */
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            progCircle.setAttribute('stroke-dashoffset', String(offset));
        });
    });

    return wrap;
}

function _statPill(text, colorClass) {
    var pill = document.createElement('span');
    pill.className = 'inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ' + colorClass;
    pill.textContent = text;
    return pill;
}

function _emptyState(emoji, title, desc) {
    var wrap = document.createElement('div');
    wrap.className = 'text-center py-8';
    wrap.innerHTML =
        '<div class="text-3xl mb-3 opacity-20">' + emoji + '</div>' +
        '<p class="text-[13px] text-text-secondary font-medium mb-0.5">' + title + '</p>' +
        '<p class="text-[11px] text-text-tertiary">' + desc + '</p>';
    return wrap;
}

function _skeletonLines(count) {
    var html = '<div class="space-y-3">';
    for (var i = 0; i < count; i++) {
        var w = 50 + Math.round(Math.random() * 40);
        html +=
            '<div class="flex items-center gap-3">' +
                '<div class="w-2 h-2 rounded-full bg-white/[0.04] animate-pulse"></div>' +
                '<div class="h-3 rounded bg-white/[0.04] animate-pulse" style="width:' + w + '%"></div>' +
            '</div>';
    }
    html += '</div>';
    return html;
}

function _skeletonSummaryCard() {
    var card = document.createElement('div');
    card.className = 'rounded-2xl bg-surface-raised/40 border border-white/[0.04] p-4';
    card.innerHTML =
        '<div class="w-6 h-6 rounded-lg bg-white/[0.04] animate-pulse mb-3"></div>' +
        '<div class="h-5 w-16 rounded bg-white/[0.06] animate-pulse mb-2"></div>' +
        '<div class="h-3 w-20 rounded bg-white/[0.04] animate-pulse"></div>';
    return card;
}

/* ================================================================
   HELPERS — Pure functions
   ================================================================ */

function _greetingText() {
    var h = new Date().getHours();
    if (h < 5)  return 'Good Night';
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}

function _subtitleText() {
    var h = new Date().getHours();
    if (h < 5)  return 'Rest well — tomorrow is a new opportunity.';
    if (h < 12) return 'Start the day with clarity and intention.';
    if (h < 17) return 'Stay focused. Progress is built in the afternoon.';
    return 'Reflect on what you accomplished today.';
}

function _dateString() {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
}

function _todayISO() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function _daysDiff(dateStr) {
    if (!dateStr) return 999;
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var parts = dateStr.split('-');
    var target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return Math.ceil((target - now) / 86400000);
}

function _formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '$0';
    var abs = Math.abs(amount);
    var formatted;
    if (abs >= 1000) {
        formatted = '$' + (abs / 1000).toFixed(1) + 'k';
    } else {
        formatted = '$' + abs.toFixed(abs % 1 === 0 ? 0 : 2);
    }
    return amount < 0 ? '-' + formatted : formatted;
}

function _formatWordCount(count) {
    if (!count) return '0';
    if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'k';
    }
    return String(count);
}

function _categoryIcon(category) {
    var icons = {
        'programming': '\u2328',
        'design': '\u2728',
        'work': '\uD83D\uDCBC',
        'personal': '\uD83C\uDFE0',
        'learning': '\uD83D\uDCD6',
        'health': '\u2764',
        'finance': '\uD83D\uDCB0',
    };
    var key = (category || '').toLowerCase();
    return icons[key] || '\u2261';
}

export default DashboardView;
