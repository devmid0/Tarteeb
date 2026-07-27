/**
 * Life OS — Note List (Sidebar)
 *
 * Premium sidebar component for the PKM pillar.
 * Displays a structured, searchable list of notes grouped by
 * category with inline search, category tree navigation, and
 * hover-reveal micro-interactions.
 *
 * Factory signature:
 *   createNoteList(opts) → HTMLElement
 *
 * opts:
 *   notes       {Object[]}      — filtered note array
 *   categories  {Object[]}      — category tree from store.getCategoryTree()
 *   activeNoteId {number|null}  — currently selected note
 *   activeCategory {string}     — active category filter (null = all)
 *   search      {string}        — current search term
 *   onSelect    {Function(id)}  — note row click
 *   onSearch    {Function(term)}— search input change
 *   onCategoryClick {Function(path|null)} — category click (null = show all)
 *   onNewNote   {Function()}    — new note button click
 */

'use strict';

import { CATEGORY_META, relativeDate } from '../domain/knowledge-rules.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_SEARCH = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">' +
    '<path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.44.856a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>';

var SVG_PLUS = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3.5 h-3.5">' +
    '<path d="M7 3v8M3 7h8"/></svg>';

var SVG_PIN = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.12-.152.23-.152.33v5.37l1.78 2.027a.5.5 0 01-.11.687l-.55.448.18.645a.75.75 0 01-1.179.94L9.5 11.5l-2.34 2.34A.75.75 0 016 13.46l.18-.645-.55-.448a.5.5 0 01-.11-.687L7.21 9.75V4.38c0-.1-.026-.21-.152-.33C6.842 3.774 6.5 3.28 6.5 2.6v-.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v.5c0 .28-.158.574-.454.82-.074.064-.1.117-.1.17v5.63l-1.585-1.79a.5.5 0 01-.11-.687l.55-.448-.18-.645a.75.75 0 011.179-.94L10 4.5l2.34-2.34a.75.75 0 011.06 0l.5.5"/></svg>';

var SVG_HEART = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/></svg>';

var SVG_CHEVRON = '<svg viewBox="0 0 12 12" fill="currentColor" class="w-2.5 h-2.5 transition-transform duration-200"><path d="M4.5 3l4 3-4 3"/></svg>';

/* ── Factory ─────────────────────────────────────────────── */

export function createNoteList(opts) {
    var o = opts || {};

    var el = document.createElement('div');
    el.className = [
        'flex flex-col h-full',
        'bg-surface-base/50',
        'border-r border-white/[0.04]',
    ].join(' ');

    /* ── Search Header ── */
    var searchSection = document.createElement('div');
    searchSection.className = 'px-3 pt-4 pb-2';

    var searchWrap = document.createElement('div');
    searchWrap.className = 'relative';
    searchWrap.innerHTML =
        '<div class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-disabled pointer-events-none">' +
            SVG_SEARCH +
        '</div>' +
        '<input type="text"' +
               ' class="pkm-search w-full bg-surface-raised/60 text-[12px] text-text-secondary' +
                      ' pl-8 pr-3 py-2 rounded-lg' +
                      ' border border-white/[0.04] hover:border-white/[0.08]' +
                      ' focus:outline-none focus:border-accent-knowledge/30 focus:bg-surface-raised' +
                      ' transition-all duration-200' +
                      ' placeholder:text-text-disabled/60"' +
               ' placeholder="Search notes\u2026"' +
               ' value="' + _escapeAttr(o.search || '') + '">';
    searchSection.appendChild(searchWrap);
    el.appendChild(searchSection);

    /* ── New Note Button ── */
    var newBtnSection = document.createElement('div');
    newBtnSection.className = 'px-3 pb-2';

    var newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = [
        'w-full flex items-center justify-center gap-1.5',
        'px-3 py-2 rounded-lg text-[12px] font-medium',
        'bg-accent-knowledge/10 text-accent-knowledge',
        'hover:bg-accent-knowledge/15 hover:brightness-110',
        'active:scale-[0.98]',
        'transition-all duration-200',
    ].join(' ');
    newBtn.innerHTML = SVG_PLUS + '<span>New Note</span>';
    newBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (o.onNewNote) o.onNewNote();
    });
    newBtnSection.appendChild(newBtn);
    el.appendChild(newBtnSection);

    /* ── Category Tree ── */
    var categorySection = document.createElement('div');
    categorySection.className = 'px-3 pb-2';

    var catContainer = document.createElement('div');
    catContainer.className = [
        'rounded-lg bg-surface-raised/30 border border-white/[0.03]',
        'overflow-hidden',
    ].join(' ');

    /* "All Notes" row */
    var allRow = document.createElement('button');
    allRow.type = 'button';
    var isAllActive = !o.activeCategory;
    allRow.className = _catRowClass(isAllActive);
    allRow.innerHTML =
        '<span class="text-[13px]">\uD83D\uDCCB</span>' +
        '<span class="flex-1 text-left text-[12px]">All Notes</span>' +
        '<span class="text-[11px] text-text-disabled tabular-nums">' + (o.notes ? o.notes.length : 0) + '</span>';
    allRow.addEventListener('click', function () {
        if (o.onCategoryClick) o.onCategoryClick(null);
    });
    catContainer.appendChild(allRow);

    /* Category tree rows */
    var tree = o.categories || [];
    _renderCategoryNodes(catContainer, tree, 0, o.activeCategory, o.onCategoryClick);

    categorySection.appendChild(catContainer);
    el.appendChild(categorySection);

    /* ── Note List ── */
    var listSection = document.createElement('div');
    listSection.className = 'flex-1 overflow-y-auto px-3 pb-3 scrollbar-none';

    var notes = o.notes || [];
    if (notes.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'text-center py-10';
        empty.innerHTML =
            '<div class="text-3xl mb-2 opacity-15">\uD83D\uDCDD</div>' +
            '<p class="text-[12px] text-text-disabled">' +
                (o.search ? 'No notes match your search' : 'No notes yet') +
            '</p>';
        listSection.appendChild(empty);
    } else {
        for (var i = 0; i < notes.length; i++) {
            listSection.appendChild(_createNoteRow(notes[i], o));
        }
    }

    el.appendChild(listSection);

    /* ── Wire Search ── */
    var searchInput = el.querySelector('.pkm-search');
    var debounceTimer = null;
    searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        var val = searchInput.value;
        debounceTimer = setTimeout(function () {
            if (o.onSearch) o.onSearch(val);
        }, 150);
    });

    return el;
}

/* ── Note Row Builder ────────────────────────────────────── */

function _createNoteRow(note, o) {
    var isActive = note.id === o.activeNoteId;

    var row = document.createElement('button');
    row.type = 'button';
    row.dataset.noteId = note.id;
    row.className = [
        'w-full text-left px-3 py-2.5 rounded-lg mb-0.5',
        'transition-all duration-150 group',
        'cursor-pointer',
        isActive
            ? 'bg-accent-knowledge/12 border border-accent-knowledge/15 shadow-[0_1px_8px_-2px_rgba(192,132,252,0.15)]'
            : 'border border-transparent hover:bg-surface-raised/60 hover:border-white/[0.04]',
    ].join(' ');

    /* Row 1: Title + badges */
    var line1 = document.createElement('div');
    line1.className = 'flex items-center gap-1.5 min-w-0';

    if (note.isPinned) {
        var pin = document.createElement('span');
        pin.className = 'flex-shrink-0 text-accent-knowledge/70';
        pin.innerHTML = SVG_PIN;
        line1.appendChild(pin);
    }

    if (note.isFavorited) {
        var fav = document.createElement('span');
        fav.className = 'flex-shrink-0 text-status-error/60';
        fav.innerHTML = SVG_HEART;
        line1.appendChild(fav);
    }

    var title = document.createElement('span');
    title.className = [
        'text-[12px] font-medium truncate',
        isActive ? 'text-text-primary' : 'text-text-secondary',
    ].join(' ');
    title.textContent = note.title || 'Untitled';
    line1.appendChild(title);

    /* Row 2: Category dot + preview + date */
    var line2 = document.createElement('div');
    line2.className = 'flex items-center gap-1.5 mt-0.5 min-w-0';

    var catMeta = CATEGORY_META[note.category] || CATEGORY_META.other;

    var catDot = document.createElement('span');
    catDot.className = 'flex-shrink-0 w-1.5 h-1.5 rounded-full';
    catDot.style.backgroundColor = catMeta.color;
    line2.appendChild(catDot);

    if (note.content) {
        var preview = document.createElement('span');
        preview.className = 'text-[11px] text-text-disabled truncate flex-1';
        preview.textContent = note.content.slice(0, 40);
        line2.appendChild(preview);
    }

    var date = document.createElement('span');
    date.className = 'flex-shrink-0 text-[10px] text-text-disabled tabular-nums';
    date.textContent = relativeDate(note.createdAt);
    line2.appendChild(date);

    row.appendChild(line1);
    row.appendChild(line2);

    /* ── Hover-reveal actions ── */
    var actions = document.createElement('div');
    actions.className = [
        'absolute right-2 top-1/2 -translate-y-1/2',
        'flex items-center gap-0.5',
        'opacity-0 group-hover:opacity-100',
        'transition-opacity duration-150',
    ].join(' ');

    if (note.isPinned) {
        actions.appendChild(_miniBtn('Unpin', SVG_PIN, function (e) {
            e.stopPropagation();
            if (o.onTogglePin) o.onTogglePin(note.id);
        }, 'text-accent-knowledge'));
    }

    row.appendChild(actions);
    row.style.position = 'relative';

    /* ── Click handler ── */
    row.addEventListener('click', function () {
        if (o.onSelect) o.onSelect(note.id);
    });

    return row;
}

/* ── Category Tree Renderer ──────────────────────────────── */

function _renderCategoryNodes(container, nodes, depth, activeCategory, onCategoryClick) {
    for (var i = 0; i < nodes.length; i++) {
        (function (node) {
            var isActive = activeCategory === node.path;

            var row = document.createElement('button');
            row.type = 'button';
            row.className = _catRowClass(isActive);
            row.style.paddingLeft = (12 + depth * 14) + 'px';

            var meta = CATEGORY_META[node.label] || CATEGORY_META.other;

            /* Chevron for nodes with children */
            if (node.children.length > 0) {
                var chevron = document.createElement('span');
                chevron.className = 'flex-shrink-0 text-text-disabled mr-0.5';
                chevron.innerHTML = SVG_CHEVRON;
                row.appendChild(chevron);
            } else {
                var spacer = document.createElement('span');
                spacer.className = 'w-2.5 mr-0.5 flex-shrink-0';
                row.appendChild(spacer);
            }

            var icon = document.createElement('span');
            icon.className = 'text-[11px] mr-1.5';
            icon.textContent = meta.icon || '\uD83D\uDCC1';
            row.appendChild(icon);

            var label = document.createElement('span');
            label.className = 'flex-1 text-left text-[11px] truncate ' + (isActive ? 'text-accent-knowledge font-medium' : 'text-text-tertiary');
            label.textContent = node.label;
            row.appendChild(label);

            if (node.count > 0) {
                var count = document.createElement('span');
                count.className = 'text-[10px] text-text-disabled tabular-nums';
                count.textContent = node.count;
                row.appendChild(count);
            }

            row.addEventListener('click', function () {
                if (onCategoryClick) onCategoryClick(node.path);
            });

            container.appendChild(row);

            /* Render children */
            if (node.children.length > 0) {
                _renderCategoryNodes(container, node.children, depth + 1, activeCategory, onCategoryClick);
            }
        })(nodes[i]);
    }
}

/* ── Internal Helpers ────────────────────────────────────── */

function _catRowClass(isActive) {
    return [
        'w-full flex items-center py-1.5 pr-2 rounded-md',
        'transition-all duration-150 cursor-pointer',
        isActive
            ? 'bg-accent-knowledge/8 text-accent-knowledge'
            : 'text-text-tertiary hover:bg-white/[0.03] hover:text-text-secondary',
    ].join(' ');
}

function _miniBtn(title, icon, onClick, colorClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = [
        'p-1 rounded text-text-disabled',
        colorClass || '',
        'hover:text-text-secondary hover:bg-white/[0.06]',
        'transition-colors duration-150',
    ].join(' ');
    btn.innerHTML = icon;
    btn.addEventListener('click', onClick);
    return btn;
}

function _escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
