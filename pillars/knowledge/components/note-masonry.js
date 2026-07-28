/**
 * Tarteeb — Note Masonry Grid
 *
 * Fluid masonry grid container for the PKM pillar.
 * Uses CSS column-count for a Pinterest/Google Keep style layout.
 * Responsive: 1 col mobile, 2 col tablet, 3-4 col desktop.
 *
 * Factory signature:
 *   createNoteMasonryGrid(opts) → HTMLElement
 *
 * opts:
 *   notes           {Object[]}    — note array to render
 *   activeCategory  {string|null} — active category filter
 *   search          {string}      — current search term
 *   categories      {Object[]}    — category tree from store
 *   onSelect        {Function(id)} — note card click
 *   onTogglePin     {Function(id)} — pin toggle
 *   onDelete        {Function(id)} — delete note
 *   onNewNote       {Function()}   — new note button
 *   onCategoryClick {Function(path|null)} — category filter
 *   onSearch        {Function(term)} — search input
 */

'use strict';

import { createNoteMasonryCard } from './note-masonry-card.js';
import { CATEGORY_META } from '../domain/knowledge-rules.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_SEARCH = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">' +
    '<path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.44.856a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>';

var SVG_PLUS = '<svg viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">' +
    '<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>';

var SVG_FOLDER = '<svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">' +
    '<path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>';

/* ── Factory ─────────────────────────────────────────────── */

export function createNoteMasonryGrid(opts) {
    var o = opts || {};

    var el = document.createElement('div');
    el.className = 'pkm-masonry-root';

    /* ── Toolbar ── */
    var toolbar = document.createElement('div');
    toolbar.className = 'pkm-masonry-toolbar';

    /* Search */
    var searchWrap = document.createElement('div');
    searchWrap.className = 'pkm-masonry-search-wrap';
    searchWrap.innerHTML =
        '<span class="pkm-masonry-search-icon">' + SVG_SEARCH + '</span>' +
        '<input type="text"' +
               ' class="pkm-masonry-search pkm-search"' +
               ' placeholder="Search notes\u2026"' +
               ' value="' + _escapeAttr(o.search || '') + '">';
    toolbar.appendChild(searchWrap);

    /* Category Filter Chips */
    var catBar = document.createElement('div');
    catBar.className = 'pkm-masonry-categories';

    /* "All" chip */
    var allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'pkm-masonry-cat-chip' + (!o.activeCategory ? ' is-active' : '');
    allChip.innerHTML = '<span class="text-[13px]">\uD83D\uDCCB</span> All';
    allChip.addEventListener('click', function () {
        if (o.onCategoryClick) o.onCategoryClick(null);
    });
    catBar.appendChild(allChip);

    /* Category chips */
    var cats = CATEGORY_META;
    var keys = Object.keys(cats);
    for (var i = 0; i < keys.length; i++) {
        (function (catKey) {
            var meta = cats[catKey];
            var isActive = o.activeCategory === catKey;

            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'pkm-masonry-cat-chip' + (isActive ? ' is-active' : '');
            chip.innerHTML = '<span class="text-[13px]">' + meta.icon + '</span> ' + meta.label;

            chip.addEventListener('click', function () {
                if (o.onCategoryClick) o.onCategoryClick(catKey);
            });
            catBar.appendChild(chip);
        })(keys[i]);
    }
    toolbar.appendChild(catBar);

    /* New Note FAB */
    var newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'pkm-masonry-new-btn';
    newBtn.innerHTML = SVG_PLUS;
    newBtn.title = 'New Note';
    newBtn.setAttribute('aria-label', 'Create new note');
    newBtn.addEventListener('click', function () {
        if (o.onNewNote) o.onNewNote();
    });
    toolbar.appendChild(newBtn);

    el.appendChild(toolbar);

    /* ── Masonry Container ── */
    var grid = document.createElement('div');
    grid.className = 'masonry-grid';

    var notes = o.notes || [];

    if (notes.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'masonry-empty';
        empty.innerHTML =
            '<div class="masonry-empty-icon">\uD83D\uDCDD</div>' +
            '<p class="masonry-empty-title">' +
                (o.search ? 'No notes match your search' : 'No notes yet') +
            '</p>' +
            '<p class="masonry-empty-hint">' +
                (o.search ? 'Try a different search term' : 'Click the + button to create your first note') +
            '</p>';
        grid.appendChild(empty);
    } else {
        for (var n = 0; n < notes.length; n++) {
            grid.appendChild(createNoteMasonryCard(notes[n], {
                onClick:     o.onSelect,
                onTogglePin: o.onTogglePin,
                onDelete:    o.onDelete,
            }));
        }
    }

    el.appendChild(grid);

    /* ── Wire Search ── */
    var searchInput = el.querySelector('.pkm-masonry-search');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            if (o.onSearch) o.onSearch(searchInput.value);
        });
    }

    return el;
}

/* ── Helpers ─────────────────────────────────────────────── */

function _escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
