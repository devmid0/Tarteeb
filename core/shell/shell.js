/**
 * Tarteeb — Application Shell
 *
 * Premium chrome persisting across all navigation.
 * Sidebar collapses to icon-rail on desktop, converts to bottom
 * tab-bar on mobile via viewport-responsive rendering.
 *
 * Design tokens applied here — no raw hex values downstream.
 */

'use strict';

const PILLARS = [
    {
        id: 'dashboard',
        label: 'Overview',
        color: '',
        svg: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px]"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>`,
    },
    {
        id: 'finance',
        label: 'Finance',
        color: 'accent-finance',
        svg: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px]"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>`,
    },
    {
        id: 'tasks',
        label: 'Tasks',
        color: 'accent-tasks',
        svg: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px]"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>`,
    },
    {
        id: 'knowledge',
        label: 'Knowledge',
        color: 'accent-knowledge',
        svg: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px]"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V14a.5.5 0 01-1 0V4.804z"/></svg>`,
    },
    {
        id: 'habits',
        label: 'Habits',
        color: 'accent-habits',
        svg: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px]"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>`,
    },
    {
        id: 'goals',
        label: 'Goals',
        color: 'accent-goals',
        svg: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px]"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`,
    },
];

const COLLAPSED_W = 64;
const EXPANDED_W  = 220;
const HOVER_REVERT_MS = 350;
const MOBILE_BP = 768;

import { QuickCapture } from '../../ui/composites/quick-capture.js';
import { CommandPalette } from '../../ui/composites/command-palette.js';

export class Shell {
    constructor(store, eventBus) {
        this.store     = store;
        this.eventBus  = eventBus;

        this.el        = document.getElementById('app');
        this.sidebarEl = document.getElementById('sidebar');
        this.mainEl    = document.getElementById('main-content');
        this.viewportEl= document.getElementById('viewport');

        this._hoverTimer      = null;
        this._expandedByHover = false;
        this._quickCapture    = null;
        this._commandPalette  = null;

        this._onResize = this._onResize.bind(this);
        this._onHash   = this._onHash.bind(this);
    }

    /* ── Lifecycle ────────────────────────────────────────── */

    mount() {
        this._renderSidebar();
        window.addEventListener('resize', this._onResize);
        window.addEventListener('hashchange', this._onHash);
        this.eventBus.subscribe('router:navigated', () => this._syncActive());

        /* Global Quick Capture — lives for the entire app lifetime */
        var db = window.__tarteeb && window.__tarteeb.database;
        if (db) {
            this._quickCapture = new QuickCapture();
            this._quickCapture.init(db, this.eventBus);
            window.__tarteeb.quickCapture = this._quickCapture;

            /* Command Palette — Ctrl+K global omni-search */
            this._commandPalette = new CommandPalette();
            this._commandPalette.init(db, this.eventBus);
            window.__tarteeb.commandPalette = this._commandPalette;
        }

        /* Expose shell ref for sidebar toggle from command palette */
        window.__tarteeb.shell = this;
    }

    destroy() {
        if (this._commandPalette) {
            this._commandPalette.destroy();
            this._commandPalette = null;
        }
        if (this._quickCapture) {
            this._quickCapture.destroy();
            this._quickCapture = null;
        }
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('hashchange', this._onHash);
        clearTimeout(this._hoverTimer);
    }

    /* ── Sidebar Rendering ────────────────────────────────── */

    _renderSidebar() {
        const mobile = this._isMobile();
        const collapsed = this.store.get('sidebar.collapsed');
        const activePillar = this.store.get('activePillar') || 'dashboard';

        if (mobile) {
            this._renderBottomBar(activePillar);
            return;
        }

        const w = collapsed && !this._expandedByHover ? COLLAPSED_W : EXPANDED_W;
        const showLabel = w > COLLAPSED_W;

        this.sidebarEl.className =
            'flex-shrink-0 h-full z-40 flex flex-col bg-surface-raised border-r border-white/[0.04] ' +
            'transition-[width] duration-[350ms] ease-[cubic-bezier(0.45,0,0.55,1)]';
        this.sidebarEl.style.width = w + 'px';

        let html = '';

        /* ── Brand ── */
        html +=
            '<div class="flex items-center h-14 px-4 flex-shrink-0">' +
                '<div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' +
                            'bg-gradient-to-br from-accent-finance via-accent-knowledge to-accent-goals ' +
                            'shadow-[0_0_20px_rgba(96,165,250,0.15)]">' +
                    '<span class="text-white font-heading font-bold text-[13px] select-none">L</span>' +
                '</div>' +
                (showLabel
                    ? '<span class="ml-3 text-[15px] font-heading font-semibold text-text-primary tracking-tight whitespace-nowrap">Tarteeb</span>'
                    : '') +
            '</div>';

        /* ── Pillar Links ── */
        html += '<nav class="flex-1 px-2 pt-2 space-y-0.5 overflow-y-auto" aria-label="Pillar navigation">';

        for (let i = 0; i < PILLARS.length; i++) {
            var p = PILLARS[i];
            var active = activePillar === p.id;
            var colorClass = p.color ? 'text-' + p.color : 'text-text-secondary';
            var activeBg   = active ? 'bg-white/[0.06]' : '';
            var activeText = active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary';

            html +=
                '<a href="#/' + p.id + '"' +
                   ' class="group relative flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-200 ' +
                          activeBg + ' ' + activeText + ' hover:bg-white/[0.04]"' +
                   ' data-pillar="' + p.id + '"' +
                   ' aria-current="' + (active ? 'page' : 'false') + '"' +
                   ' title="' + (!showLabel ? p.label : '') + '">' +

                    (active
                        ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full ' +
                                  (p.color ? 'bg-' + p.color : 'bg-text-secondary') + '"></span>'
                        : '') +

                    '<span class="flex-shrink-0 ' + (active ? colorClass : '') + ' transition-colors duration-200">' +
                        p.svg +
                    '</span>' +

                    (showLabel
                        ? '<span class="text-[13px] font-medium whitespace-nowrap">' + p.label + '</span>'
                        : '') +
                '</a>';
        }

        html += '</nav>';

        /* ── Footer ── */
        html +=
            '<div class="px-2 pb-3 flex-shrink-0 space-y-1">';

        /* Sync button */
        html +=
                '<button id="sync-btn"' +
                        ' class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 ' +
                               'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-all duration-200">' +
                    '<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px] flex-shrink-0">' +
                        '<path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V3.25a.75.75 0 00-1.5 0V5.326l-.312-.311A7 7 0 002.25 11.19a.75.75 0 001.449.39 5.5 5.5 0 0112.568-4.824l.312.311h-2.433a.75.75 0 000 1.5h3.634a.75.75 0 00.53-.219z" clip-rule="evenodd"/>' +
                    '</svg>' +
                    (showLabel
                        ? '<span class="text-[13px] font-medium whitespace-nowrap">Sync Now</span>'
                        : '') +
                '</button>';

        /* Export button */
        html +=
                '<button id="export-btn"' +
                        ' class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 ' +
                               'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-all duration-200" title="Export Data">' +
                    '<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px] flex-shrink-0">' +
                        '<path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/>' +
                        '<path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/>' +
                    '</svg>' +
                    (showLabel
                        ? '<span class="text-[13px] font-medium whitespace-nowrap">Export Data</span>'
                        : '') +
                '</button>';

        /* Import button */
        html +=
                '<button id="import-btn"' +
                        ' class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 ' +
                               'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-all duration-200" title="Import Backup">' +
                    '<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px] flex-shrink-0">' +
                        '<path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 101.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636V13.25z"/>' +
                        '<path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/>' +
                    '</svg>' +
                    (showLabel
                        ? '<span class="text-[13px] font-medium whitespace-nowrap">Import Backup</span>'
                        : '') +
                '</button>';

        /* Hidden file input for import */
        html += '<input type="file" accept=".json" id="import-file-input" style="display:none">';

        /* ── Theme Selector ── */
        var currentTheme = localStorage.getItem('tarteeb_theme') || 'default';
        function _themeBtnCls(id) {
            var active = id === currentTheme;
            return 'theme-btn flex-1 h-6 rounded-md text-[10px] font-medium border transition-all duration-150 ' +
                   (active
                       ? 'bg-accent-tasks/15 border-accent-tasks/30 text-accent-tasks'
                       : 'bg-surface-raised border-white/[0.06] text-text-tertiary hover:text-text-primary hover:bg-white/[0.04]');
        }
        html +=
            '<div class="px-2 pt-2 pb-0.5">' +
                (showLabel
                    ? '<span class="text-[10px] font-medium text-text-disabled uppercase tracking-wider">Theme</span>'
                    : '') +
            '</div>' +
            '<div class="flex gap-1 px-2 pb-1">' +
                '<button id="theme-default"' +
                        ' class="' + _themeBtnCls('default') + '"' +
                        ' title="' + (showLabel ? '' : 'Default (Dark)') + '">' +
                    (showLabel ? 'Default' : '\u25CF') +
                '</button>' +
                '<button id="theme-light"' +
                        ' class="' + _themeBtnCls('light') + '"' +
                        ' title="' + (showLabel ? '' : 'Light') + '">' +
                    (showLabel ? 'Light' : '\u25CB') +
                '</button>' +
                '<button id="theme-ocean"' +
                        ' class="' + _themeBtnCls('ocean') + '"' +
                        ' title="' + (showLabel ? '' : 'Ocean (Premium)') + '">' +
                    (showLabel ? 'Ocean \uD83D\uDD12' : '\uD83D\uDD12') +
                '</button>' +
            '</div>';

        /* Logout button */
        html +=
                '<button id="logout-btn"' +
                        ' class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 ' +
                               'text-text-tertiary hover:text-status-error hover:bg-status-error/5 transition-all duration-200" title="Logout">' +
                    '<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px] flex-shrink-0">' +
                        '<path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h5a1 1 0 100-2H4V5h4a1 1 0 100-2H3zm11.707 3.293a1 1 0 010 1.414L12.414 10l2.293 2.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clip-rule="evenodd"/>' +
                        '<path d="M10 9h7a1 1 0 110 2h-7V9z"/>' +
                    '</svg>' +
                    (showLabel
                        ? '<span class="text-[13px] font-medium whitespace-nowrap">Logout</span>'
                        : '') +
                '</button>';

        /* Collapse toggle */
        html +=
                '<button id="sidebar-toggle"' +
                        ' class="w-full flex items-center justify-center gap-2 rounded-lg px-2 py-2 ' +
                               'text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-all duration-200"' +
                        ' aria-label="' + (collapsed ? 'Expand sidebar' : 'Collapse sidebar') + '">' +
                    '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 transition-transform duration-300 ' +
                        (collapsed ? 'rotate-180' : '') + '">' +
                        '<path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>' +
                    '</svg>' +
                    (showLabel
                        ? '<span class="text-xs">Collapse</span>'
                        : '') +
                '</button>' +
            '</div>';

        this.sidebarEl.innerHTML = html;
        this._bindSidebarEvents();
    }

    _renderBottomBar(activePillar) {
        this.sidebarEl.className = '';
        this.sidebarEl.style.width = '';
        this.mainEl.style.paddingBottom = '';

        var html =
            '<nav class="fixed bottom-0 inset-x-0 z-50 glass border-t border-white/[0.06] ' +
                    'flex items-stretch h-14 px-1 safe-area-bottom"' +
                 ' aria-label="Pillar navigation">';

        for (var i = 0; i < PILLARS.length; i++) {
            var p = PILLARS[i];
            var active = activePillar === p.id;
            var colorClass = p.color ? 'text-' + p.color : 'text-text-tertiary';
            var activeColor = active ? colorClass : 'text-text-tertiary';
            var activeIndicator = active
                ? ' relative before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 ' +
                  'before:w-5 before:h-0.5 before:rounded-b-full ' +
                  (p.color ? 'before:bg-' + p.color : 'before:bg-text-tertiary')
                : '';

            html +=
                '<a href="#/' + p.id + '"' +
                   ' class="flex items-center justify-center flex-1 transition-colors duration-200 ' + activeColor + activeIndicator + '"' +
                   ' aria-current="' + (active ? 'page' : 'false') + '">' +
                    p.svg +
                '</a>';
        }

        html += '</nav>';
        this.sidebarEl.innerHTML = html;
        this.mainEl.style.paddingBottom = '56px';
    }

    /* ── Theme ────────────────────────────────────────────── */

    _applyTheme(theme) {
        var el = document.documentElement;
        el.setAttribute('data-theme', theme);
        el.classList.toggle('dark', theme !== 'light');
        localStorage.setItem('tarteeb_theme', theme);
        this._renderSidebar();
    }

    /* ── Event Binding ────────────────────────────────────── */

    _bindSidebarEvents() {
        var self = this;

        var toggle = document.getElementById('sidebar-toggle');
        if (toggle) {
            toggle.addEventListener('click', function () {
                self._expandedByHover = false;
                self.store.toggle('sidebar.collapsed');
                self._renderSidebar();
            });
        }

        var syncBtn = document.getElementById('sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', function () {
                self._handleSync(syncBtn);
            });
        }

        var exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                self._showExportModal();
            });
        }

        var importBtn = document.getElementById('import-btn');
        var importFile = document.getElementById('import-file-input');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', function () {
                importFile.click();
            });
            importFile.addEventListener('change', function (e) {
                self.importLocalData(e);
            });
        }

        /* ── Theme buttons ── */
        var themeDefault = document.getElementById('theme-default');
        var themeLight   = document.getElementById('theme-light');
        var themeOcean   = document.getElementById('theme-ocean');

        function _setTheme(t) { self._applyTheme(t); }

        if (themeDefault) {
            themeDefault.addEventListener('click', function () { _setTheme('default'); });
        }
        if (themeLight) {
            themeLight.addEventListener('click', function () { _setTheme('light'); });
        }
        if (themeOcean) {
            themeOcean.addEventListener('click', async function () {
                var auth = await import('../../ui/composites/auth.js');
                var session = await auth.getCurrentSession();
                if (!session) {
                    auth.showAuthModal();
                    return;
                }
                var p = await auth.verifyPremiumStatus();
                if (p) {
                    _setTheme('ocean');
                } else {
                    var mod = await import('../composites/cloud-sync.js');
                    mod.showPaywall('ocean_theme');
                }
            });
        }

        /* ── Logout ── */
        var logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                import('../../ui/composites/auth.js').then(function (mod) {
                    mod.logout();
                });
            });
        }

        if (!this._isMobile()) {
            this.sidebarEl.addEventListener('mouseenter', function () {
                clearTimeout(self._hoverTimer);
                if (self.store.get('sidebar.collapsed')) {
                    self._expandedByHover = true;
                    self._renderSidebar();
                }
            });

            this.sidebarEl.addEventListener('mouseleave', function () {
                if (self._expandedByHover) {
                    self._hoverTimer = setTimeout(function () {
                        self._expandedByHover = false;
                        self._renderSidebar();
                    }, HOVER_REVERT_MS);
                }
            });
        }
    }

    /* ── Active Sync ──────────────────────────────────────── */

    _syncActive() {
        this._renderSidebar();
    }

    /* ── Cloud Sync ──────────────────────────────────────── */

    async _handleSync(btn) {
        if (btn.classList.contains('syncing')) return;

        btn.classList.add('syncing');
        btn.disabled = true;
        btn.innerHTML =
            '<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px] flex-shrink-0 sync-spin">' +
                '<path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V3.25a.75.75 0 00-1.5 0V5.326l-.312-.311A7 7 0 002.25 11.19a.75.75 0 001.449.39 5.5 5.5 0 0112.568-4.824l.312.311h-2.433a.75.75 0 000 1.5h3.634a.75.75 0 00.53-.219z" clip-rule="evenodd"/>' +
            '</svg>' +
            '<span class="text-[13px] font-medium whitespace-nowrap">Syncing…</span>';

        try {
            var mod = await import('../composites/cloud-sync.js');
            await mod.syncCloudData();
        } finally {
            btn.classList.remove('syncing');
            btn.disabled = false;
            var showLabel = !this.store.get('sidebar.collapsed') && !this._isMobile();
            btn.innerHTML =
                '<svg viewBox="0 0 20 20" fill="currentColor" class="w-[18px] h-[18px] flex-shrink-0">' +
                    '<path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V3.25a.75.75 0 00-1.5 0V5.326l-.312-.311A7 7 0 002.25 11.19a.75.75 0 001.449.39 5.5 5.5 0 0112.568-4.824l.312.311h-2.433a.75.75 0 000 1.5h3.634a.75.75 0 00.53-.219z" clip-rule="evenodd"/>' +
                '</svg>' +
                (showLabel
                    ? '<span class="text-[13px] font-medium whitespace-nowrap">Sync Now</span>'
                    : '');
        }
    }

    /* ── Data Export / Import ─────────────────────────────── */

    /**
     * Export all IndexedDB pillar data plus relevant localStorage
     * keys as a single JSON file download.
     */
    async exportLocalData() {
        try {
            var db = window.__tarteeb && window.__tarteeb.database;
            if (!db) {
                alert('Database not available. Nothing to export.');
                return;
            }

            /* Gather IndexedDB stores */
            var storeData = await db.exportAll();

            /* Gather tarteeb-prefixed localStorage keys */
            var lsData = {};
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf('tarteeb_') === 0) {
                    lsData[key] = localStorage.getItem(key);
                }
            }

            /* Build the backup payload */
            var payload = JSON.stringify({
                _exportedAt: new Date().toISOString(),
                _version: 1,
                stores: storeData,
                localStorage: lsData,
            }, null, 2);

            /* Trigger download */
            var blob = new Blob([payload], { type: 'application/json' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href   = url;
            a.download = 'tarteeb_backup.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[Export] Backup saved — ' + (payload.length / 1024).toFixed(1) + ' KB');
        } catch (err) {
            console.error('[Export] Failed:', err);
            alert('Export failed. See console for details.');
        }
    }

    /**
     * Import a previously exported backup file. Parses the JSON,
     * overwrites IndexedDB stores and localStorage keys,
     * then reloads the page.
     */
    async importLocalData(event) {
        var file = event.target && event.target.files && event.target.files[0];
        if (!file) return;

        /* Reset the input so the same file can be re-selected */
        event.target.value = '';

        try {
            var text = await new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload  = function () { resolve(reader.result); };
                reader.onerror = function () { reject(new Error('Failed to read file')); };
                reader.readAsText(file);
            });

            var data = JSON.parse(text);

            if (!data || typeof data !== 'object') {
                throw new Error('Invalid backup file: root is not an object');
            }

            /* Restore IndexedDB stores */
            if (data.stores) {
                var db = window.__tarteeb && window.__tarteeb.database;
                if (db) {
                    await db.importAll(data.stores);
                } else {
                    console.warn('[Import] Database not available — skipping store restore');
                }
            }

            /* Restore localStorage keys */
            if (data.localStorage && typeof data.localStorage === 'object') {
                var lsKeys = Object.keys(data.localStorage);
                for (var i = 0; i < lsKeys.length; i++) {
                    localStorage.setItem(lsKeys[i], data.localStorage[lsKeys[i]]);
                }
            }

            console.log('[Import] Restore complete — reloading app');
            location.reload();
        } catch (err) {
            console.error('[Import] Failed:', err);
            alert('Import failed: ' + err.message + '\n\nThe file may be corrupted or not a valid Tarteeb backup.');
        }
    }

    /* ── Export Modal ──────────────────────────────────────── */

    _showExportModal() {
        var self = this;
        var portal = document.getElementById('modal-portal');
        if (!portal) return;

        /* Close existing modal if any */
        self._closeExportModal();

        var html =
            '<div class="fixed inset-0 z-50 flex items-center justify-center" id="export-modal-backdrop">' +
                '<div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>' +
                '<div class="relative w-full max-w-md mx-4 bg-surface-raised border border-white/[0.06] rounded-2xl shadow-2xl p-6 pointer-events-auto"' +
                     ' id="export-modal" role="dialog" aria-modal="true" aria-label="Export Data">' +
                    '<div class="flex items-center justify-between mb-5">' +
                        '<h2 class="text-[17px] font-heading font-semibold text-text-primary">Export Data</h2>' +
                        '<button id="export-modal-close" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150" aria-label="Close">' +
                            '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>' +
                        '</button>' +
                    '</div>' +
                    '<p class="text-[13px] text-text-secondary mb-5">Choose an export format for your data.</p>' +
                    '<div class="space-y-3">' +
                        /* JSON — Free */
                        '<button id="export-json-btn" class="w-full flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-200 p-4 text-left group">' +
                            '<div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent-tasks/10 text-accent-tasks">' +
                                '<svg viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/></svg>' +
                            '</div>' +
                            '<div class="flex-1 min-w-0">' +
                                '<div class="flex items-center gap-2">' +
                                    '<span class="text-[14px] font-medium text-text-primary">Export Backup (JSON)</span>' +
                                    '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-accent-tasks/15 text-accent-tasks border border-accent-tasks/20">Free</span>' +
                                '</div>' +
                                '<span class="text-[12px] text-text-tertiary block mt-0.5">Complete backup of all app data</span>' +
                            '</div>' +
                        '</button>' +
                        /* CSV — Premium */
                        '<button id="export-csv-btn" class="w-full flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-200 p-4 text-left group">' +
                            '<div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent-finance/10 text-accent-finance">' +
                                '<svg viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>' +
                            '</div>' +
                            '<div class="flex-1 min-w-0">' +
                                '<div class="flex items-center gap-2">' +
                                    '<span class="text-[14px] font-medium text-text-primary">Export Reports (CSV)</span>' +
                                    '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-accent-finance/15 text-accent-finance border border-accent-finance/20">\uD83D\uDD12 Premium</span>' +
                                '</div>' +
                                '<span class="text-[12px] text-text-tertiary block mt-0.5">Tasks &amp; Finance data as spreadsheets</span>' +
                            '</div>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        /* Enable pointer events on portal for modal interaction */
        portal.style.pointerEvents = 'auto';
        portal.innerHTML = html;

        /* ── Wire events ── */

        /* Close button */
        var closeBtn = document.getElementById('export-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                self._closeExportModal();
            });
        }

        /* Backdrop click */
        var backdrop = document.getElementById('export-modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', function (e) {
                if (e.target === backdrop) {
                    self._closeExportModal();
                }
            });
        }

        /* JSON export */
        var jsonBtn = document.getElementById('export-json-btn');
        if (jsonBtn) {
            jsonBtn.addEventListener('click', function () {
                self._closeExportModal();
                self.exportLocalData();
            });
        }

        /* CSV export (premium-gated) */
        var csvBtn = document.getElementById('export-csv-btn');
        if (csvBtn) {
            csvBtn.addEventListener('click', async function () {
                var auth = await import('../../ui/composites/auth.js');
                var session = await auth.getCurrentSession();
                if (!session) {
                    auth.showAuthModal();
                    return;
                }
                var p = await auth.verifyPremiumStatus(true);
                if (p) {
                    self._closeExportModal();
                    self._exportCSV();
                } else {
                    self._closeExportModal();
                    var mod = await import('../composites/cloud-sync.js');
                    mod.showPaywall('csv_export');
                }
            });
        }

        /* Escape key */
        self._exportModalEscapeHandler = function (e) {
            if (e.key === 'Escape') {
                self._closeExportModal();
            }
        };
        document.addEventListener('keydown', self._exportModalEscapeHandler);
    }

    _closeExportModal() {
        var portal = document.getElementById('modal-portal');
        if (portal) {
            portal.innerHTML = '';
            portal.style.pointerEvents = 'none';
        }
        if (this._exportModalEscapeHandler) {
            document.removeEventListener('keydown', this._exportModalEscapeHandler);
            this._exportModalEscapeHandler = null;
        }
    }

    /**
     * Export Tasks and Finance data as CSV files (premium feature).
     * Downloads two CSV files: tasks and transactions.
     */
    async _exportCSV() {
        try {
            var db = window.__tarteeb && window.__tarteeb.database;
            if (!db) {
                alert('Database not available.');
                return;
            }

            var data = await db.exportAll();
            var tasks = data['tasks-items'] || [];
            var transactions = data['finance-transactions'] || [];
            var dateStr = new Date().toISOString().slice(0, 10);

            function csvEscape(val) {
                if (val === null || val === undefined) return '';
                var s = String(val);
                if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }

            function arrayToCSV(rows, headers) {
                var lines = [];
                lines.push(headers.map(csvEscape).join(','));
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    var vals = headers.map(function (h) { return csvEscape(row[h]); });
                    lines.push(vals.join(','));
                }
                return lines.join('\n');
            }

            var taskHeaders = ['id', 'title', 'description', 'status', 'priority', 'dueDate', 'tags', 'createdAt', 'updatedAt'];
            var txHeaders  = ['id', 'type', 'amount', 'category', 'description', 'date', 'tags', 'createdAt', 'updatedAt'];

            var taskCSV = arrayToCSV(tasks, taskHeaders);
            var txCSV   = arrayToCSV(transactions, txHeaders);

            var combinedCSV =
                '# Tarteeb Tasks Export — ' + dateStr + '\n' +
                taskCSV + '\n\n' +
                '# Tarteeb Finance Transactions Export — ' + dateStr + '\n' +
                txCSV;

            var blob = new Blob([combinedCSV], { type: 'text/csv;charset=utf-8;' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href   = url;
            a.download = 'tarteeb_reports_' + dateStr + '.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[Export] CSV saved — ' + (combinedCSV.length / 1024).toFixed(1) + ' KB');
        } catch (err) {
            console.error('[Export CSV] Failed:', err);
            alert('CSV export failed. See console for details.');
        }
    }

    /* ── Viewport Helpers ─────────────────────────────────── */

    _isMobile() {
        return window.innerWidth < MOBILE_BP;
    }

    _onResize() {
        this._renderSidebar();
    }

    _onHash() {
        this._syncActive();
    }
}
