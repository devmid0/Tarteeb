/**
 * Tarteeb — Note Canvas Editor
 *
 * Notion-style, distraction-free, borderless note editor.
 * Replaces the traditional modal with a full-page canvas experience.
 *
 * Features:
 *   - Massive, borderless contenteditable title
 *   - Borderless contenteditable body
 *   - Subtle metadata bar (category, tags, pin, archive, delete)
 *   - Invisible debounced auto-save (500ms)
 *   - Back navigation to masonry grid
 *   - Word/char count footer
 *
 * Factory signature:
 *   createNoteCanvas(opts) → HTMLElement
 *
 * opts:
 *   note        {Object}       — note document
 *   categories  {string[]}     — available category paths
 *   categoryMeta {Object}      — CATEGORY_META map
 *   onSave      {Function(patch)} — called with patch on every debounced change
 *   onDelete    {Function(id)}    — delete note
 *   onBack      {Function()}      — navigate back to grid
 *   onTogglePin {Function(id)}    — toggle pin
 *   onToggleFav {Function(id)}    — toggle favorite
 *   onArchive   {Function(id)}    — archive note
 *   onRestore   {Function(id)}    — restore note
 */

'use strict';

import { CATEGORY_META, relativeDate, formatDate } from '../domain/knowledge-rules.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_BACK = '<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/></svg>';

var SVG_PIN = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.12-.152.23-.152.33v5.37l1.78 2.027a.5.5 0 01-.11.687l-.55.448.18.645a.75.75 0 01-1.179.94L9.5 11.5l-2.34 2.34A.75.75 0 016 13.46l.18-.645-.55-.448a.5.5 0 01-.11-.687L7.21 9.75V4.38c0-.1-.026-.21-.152-.33C6.842 3.774 6.5 3.28 6.5 2.6v-.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v.5c0 .28-.158.574-.454.82-.074.064-.1.117-.1.17v5.63l-1.585-1.79a.5.5 0 01-.11-.687l.55-.448-.18-.645a.75.75 0 011.179-.94L10 4.5l2.34-2.34a.75.75 0 011.06 0l.5.5"/></svg>';

var SVG_HEART = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/></svg>';

var SVG_ARCHIVE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v1H0V2zm0 2h16v9a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm4 3a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z"/></svg>';

var SVG_RESTORE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path fill-rule="evenodd" d="M8 3a5 5 0 11-4.546 2.914.5.5 0 00-.908-.417A6 6 0 108 2v1z"/><path d="M8 4.466V.534a.25.25 0 00-.41-.192L5.23 2.308a.25.25 0 000 .384l2.36 1.966A.25.25 0 008 4.466z"/></svg>';

var SVG_DELETE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';

/* ── Factory ─────────────────────────────────────────────── */

export function createNoteCanvas(opts) {
    var o = opts || {};
    var note = o.note;
    var meta = o.categoryMeta || CATEGORY_META;
    var isArchived = !!(note && note.isArchived);

    var el = document.createElement('div');
    el.className = 'canvas-editor';

    /* ── Top Bar (back + actions) ── */
    var topBar = document.createElement('div');
    topBar.className = 'canvas-topbar';

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'canvas-topbar-btn';
    backBtn.innerHTML = SVG_BACK + '<span>Back</span>';
    backBtn.addEventListener('click', function () {
        _flush();
        if (o.onBack) o.onBack();
    });
    topBar.appendChild(backBtn);

    var actionGroup = document.createElement('div');
    actionGroup.className = 'canvas-topbar-actions';

    if (isArchived) {
        actionGroup.appendChild(_topBtn('Restore', SVG_RESTORE, function () {
            if (o.onRestore) o.onRestore(note.id);
        }, 'canvas-action-active'));
    } else {
        actionGroup.appendChild(_topBtn('Pin', SVG_PIN, function () {
            if (o.onTogglePin) o.onTogglePin(note.id);
        }, note.isPinned ? 'canvas-action-active' : ''));

        actionGroup.appendChild(_topBtn('Favorite', SVG_HEART, function () {
            if (o.onToggleFav) o.onToggleFav(note.id);
        }, note.isFavorited ? 'canvas-action-active-red' : ''));

        actionGroup.appendChild(_topBtn('Archive', SVG_ARCHIVE, function () {
            if (o.onArchive) o.onArchive(note.id);
        }, ''));
    }

    actionGroup.appendChild(_topBtn('Delete', SVG_DELETE, function () {
        if (o.onDelete) o.onDelete(note.id);
    }, 'canvas-action-danger'));

    topBar.appendChild(actionGroup);
    el.appendChild(topBar);

    /* ── Metadata Bar (subtle, above title) ── */
    var metaBar = document.createElement('div');
    metaBar.className = 'canvas-meta-bar';

    /* Category Selector */
    var catSelect = document.createElement('select');
    catSelect.className = 'canvas-cat-select';
    catSelect.disabled = isArchived;
    var allCats = Object.keys(meta);
    for (var ci = 0; ci < allCats.length; ci++) {
        var catKey = allCats[ci];
        var cm = meta[catKey];
        var opt = document.createElement('option');
        opt.value = catKey;
        opt.textContent = cm.icon + ' ' + cm.label;
        if (catKey === (note ? note.category : 'other')) opt.selected = true;
        catSelect.appendChild(opt);
    }
    metaBar.appendChild(catSelect);

    /* Tags */
    var tagsWrap = document.createElement('div');
    tagsWrap.className = 'canvas-tags-wrap';
    var existingTags = (note && Array.isArray(note.tags)) ? note.tags.slice() : [];

    function _renderCanvasTags() {
        tagsWrap.innerHTML = '';
        for (var t = 0; t < existingTags.length; t++) {
            (function (idx) {
                var chip = document.createElement('span');
                chip.className = 'canvas-tag-chip';
                chip.textContent = existingTags[idx];
                if (!isArchived) {
                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'canvas-tag-remove';
                    removeBtn.innerHTML = '&times;';
                    removeBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        existingTags.splice(idx, 1);
                        _renderCanvasTags();
                        _emitSave();
                    });
                    chip.appendChild(removeBtn);
                }
                tagsWrap.appendChild(chip);
            })(t);
        }

        if (!isArchived) {
            var tagInput = document.createElement('input');
            tagInput.type = 'text';
            tagInput.className = 'canvas-tag-input';
            tagInput.placeholder = existingTags.length ? '' : 'Add tag\u2026';
            tagsWrap.appendChild(tagInput);

            tagInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    var val = tagInput.value.trim().toLowerCase().replace(/,/g, '');
                    if (val && existingTags.indexOf(val) === -1) {
                        existingTags.push(val);
                        _renderCanvasTags();
                        _emitSave();
                    }
                    tagInput.value = '';
                }
                if (e.key === 'Backspace' && tagInput.value === '' && existingTags.length > 0) {
                    existingTags.pop();
                    _renderCanvasTags();
                    _emitSave();
                }
            });
        }
    }
    _renderCanvasTags();
    metaBar.appendChild(tagsWrap);

    /* Pin / Favorite badges */
    if (note && note.isPinned) {
        var pinBadge = document.createElement('span');
        pinBadge.className = 'canvas-badge canvas-badge-pin';
        pinBadge.innerHTML = SVG_PIN + ' Pinned';
        metaBar.appendChild(pinBadge);
    }
    if (note && note.isFavorited) {
        var favBadge = document.createElement('span');
        favBadge.className = 'canvas-badge canvas-badge-fav';
        favBadge.innerHTML = SVG_HEART + ' Favorited';
        metaBar.appendChild(favBadge);
    }
    if (isArchived) {
        var archBadge = document.createElement('span');
        archBadge.className = 'canvas-badge canvas-badge-arch';
        archBadge.innerHTML = SVG_ARCHIVE + ' Archived';
        metaBar.appendChild(archBadge);
    }

    el.appendChild(metaBar);

    /* ── Canvas Body ── */
    var body = document.createElement('div');
    body.className = 'canvas-body';

    /* Title (contenteditable) */
    var titleEl = document.createElement('div');
    titleEl.className = 'canvas-title';
    titleEl.setAttribute('contenteditable', isArchived ? 'false' : 'true');
    titleEl.setAttribute('data-placeholder', 'Untitled');
    titleEl.setAttribute('role', 'textbox');
    titleEl.setAttribute('aria-label', 'Note title');
    titleEl.textContent = (note && note.title) || '';
    body.appendChild(titleEl);

    /* Content (contenteditable) */
    var contentEl = document.createElement('div');
    contentEl.className = 'canvas-content';
    contentEl.setAttribute('contenteditable', isArchived ? 'false' : 'true');
    contentEl.setAttribute('data-placeholder', 'Start writing\u2026');
    contentEl.setAttribute('role', 'textbox');
    contentEl.setAttribute('aria-label', 'Note content');
    contentEl.textContent = (note && note.content) || '';
    body.appendChild(contentEl);

    el.appendChild(body);

    /* ── Footer (subtle metadata) ── */
    var footer = document.createElement('div');
    footer.className = 'canvas-footer';

    var stats = document.createElement('span');
    stats.className = 'canvas-footer-stats';
    var wc = (note && note.wordCount) || 0;
    var cc = (note && note.charCount) || 0;
    stats.textContent = wc + ' words \u00B7 ' + cc + ' chars';
    footer.appendChild(stats);

    var edited = document.createElement('span');
    edited.className = 'canvas-footer-date';
    edited.textContent = note && note.updatedAt ? 'Edited ' + relativeDate(note.updatedAt) : '';
    footer.appendChild(edited);

    var created = document.createElement('span');
    created.className = 'canvas-footer-date';
    created.textContent = note && note.createdAt ? 'Created ' + formatDate(note.createdAt) : '';
    footer.appendChild(created);

    el.appendChild(footer);

    /* ── Auto-Save Logic ── */
    var saveTimer = null;

    function _emitSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            if (!note || !o.onSave) return;
            var newTitle   = titleEl.textContent.trim();
            var newContent = contentEl.textContent;
            o.onSave({
                id:       note.id,
                title:    newTitle,
                content:  newContent,
                category: catSelect.value,
                tags:     existingTags.slice(),
            });
        }, 500);
    }

    function _flush() {
        clearTimeout(saveTimer);
        if (!note || !o.onSave) return;
        var newTitle   = titleEl.textContent.trim();
        var newContent = contentEl.textContent;
        o.onSave({
            id:       note.id,
            title:    newTitle,
            content:  newContent,
            category: catSelect.value,
            tags:     existingTags.slice(),
        });
    }

    titleEl.addEventListener('input', _emitSave);
    contentEl.addEventListener('input', _emitSave);
    catSelect.addEventListener('change', _emitSave);

    /* Prevent Enter in title — move focus to content */
    titleEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            contentEl.focus();
            /* Place cursor at start */
            var range = document.createRange();
            var sel = window.getSelection();
            if (contentEl.childNodes.length > 0) {
                range.setStart(contentEl, 0);
            } else {
                range.setStart(contentEl, 0);
            }
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });

    /* Placeholder behavior for contenteditable */
    function _checkPlaceholder(el) {
        if (el.textContent.trim() === '') {
            el.classList.add('is-empty');
        } else {
            el.classList.remove('is-empty');
        }
    }
    _checkPlaceholder(titleEl);
    _checkPlaceholder(contentEl);
    titleEl.addEventListener('input', function () { _checkPlaceholder(titleEl); });
    contentEl.addEventListener('input', function () { _checkPlaceholder(contentEl); });

    /* Focus title on mount if empty */
    if (!note || !note.title) {
        setTimeout(function () { titleEl.focus(); }, 100);
    }

    /* Expose flush for external cleanup */
    el._canvasFlush = _flush;

    return el;
}

/* ── Helpers ─────────────────────────────────────────────── */

function _topBtn(title, svg, onClick, extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = 'canvas-topbar-action' + (extraClass ? ' ' + extraClass : '');
    btn.innerHTML = svg;
    btn.addEventListener('click', onClick);
    return btn;
}
