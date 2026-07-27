/**
 * Tarteeb — Note Editor (Distraction-Free)
 *
 * Premium editor component for the PKM pillar.
 * Clean, focused editing experience with title, category,
 * tag chips, content textarea, metadata footer, and
 * action bar with pin / favorite / archive / delete.
 *
 * Factory signature:
 *   createNoteEditor(opts) → HTMLElement
 *
 * opts:
 *   note          {Object|null}  — note data (null = empty new note)
 *   categories    {string[]}     — available category paths
 *   categoryMeta  {Object}       — CATEGORY_META map
 *   onSave        {Function(patch)} — called on every meaningful change
 *   onPin         {Function(id)}    — toggle pin
 *   onFavorite    {Function(id)}    — toggle favorite
 *   onArchive     {Function(id)}    — archive note
 *   onRestore     {Function(id)}    — restore archived note
 *   onDelete      {Function(id)}    — delete note
 */

'use strict';

import { CATEGORY_META, formatDate, relativeDate } from '../domain/knowledge-rules.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_PIN = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.12-.152.23-.152.33v5.37l1.78 2.027a.5.5 0 01-.11.687l-.55.448.18.645a.75.75 0 01-1.179.94L9.5 11.5l-2.34 2.34A.75.75 0 016 13.46l.18-.645-.55-.448a.5.5 0 01-.11-.687L7.21 9.75V4.38c0-.1-.026-.21-.152-.33C6.842 3.774 6.5 3.28 6.5 2.6v-.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v.5c0 .28-.158.574-.454.82-.074.064-.1.117-.1.17v5.63l-1.585-1.79a.5.5 0 01-.11-.687l.55-.448-.18-.645a.75.75 0 011.179-.94L10 4.5l2.34-2.34a.75.75 0 011.06 0l.5.5"/></svg>';

var SVG_HEART = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/></svg>';

var SVG_ARCHIVE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v1H0V2zm0 2h16v9a2 2 0 01-2 2H2a2 2 0 01-2-2V4zm4 3a1 1 0 011-1h6a1 1 0 110 2H5a1 1 0 01-1-1z"/></svg>';

var SVG_RESTORE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path fill-rule="evenodd" d="M8 3a5 5 0 11-4.546 2.914.5.5 0 00-.908-.417A6 6 0 108 2v1z"/><path d="M8 4.466V.534a.25.25 0 00-.41-.192L5.23 2.308a.25.25 0 000 .384l2.36 1.966A.25.25 0 008 4.466z"/></svg>';

var SVG_DELETE = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>';

var SVG_TAG = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 opacity-40"><path d="M1 3.5a1.5 1.5 0 011.5-1.5h4a.5.5 0 00.354-.146l4 4a.5.5 0 000 .708l-4 4a.5.5 0 00-.354.146h-4a1.5 1.5 0 01-1.5-1.5v-7z"/></svg>';

var SVG_CHEVRON_DOWN = '<svg viewBox="0 0 12 12" fill="currentColor" class="w-2.5 h-2.5"><path d="M2.5 4.5l4 3-4 3"/></svg>';

/* ── Factory ─────────────────────────────────────────────── */

export function createNoteEditor(opts) {
    var o = opts || {};
    var note = o.note;
    var meta = o.categoryMeta || CATEGORY_META;
    var isArchived = !!(note && note.isArchived);

    /* ── Outer shell ── */
    var el = document.createElement('div');
    el.className = 'flex flex-col h-full bg-surface-base/40';

    if (!note) {
        _renderEmptyState(el);
        return el;
    }

    /* ── Action Bar ── */
    var actionBar = document.createElement('div');
    actionBar.className = [
        'flex items-center justify-between gap-2',
        'px-5 py-3 border-b border-white/[0.04]',
        'bg-surface-base/30',
    ].join(' ');

    var actionGroup = document.createElement('div');
    actionGroup.className = 'flex items-center gap-1';

    if (isArchived) {
        actionGroup.appendChild(_actionBtn('Restore', SVG_RESTORE, function () {
            if (o.onRestore) o.onRestore(note.id);
        }, 'text-accent-knowledge'));
    } else {
        actionGroup.appendChild(_actionBtn('Pin', SVG_PIN, function () {
            if (o.onPin) o.onPin(note.id);
        }, note.isPinned ? 'text-accent-knowledge' : ''));

        actionGroup.appendChild(_actionBtn('Favorite', SVG_HEART, function () {
            if (o.onFavorite) o.onFavorite(note.id);
        }, note.isFavorited ? 'text-status-error/70' : ''));

        actionGroup.appendChild(_actionBtn('Archive', SVG_ARCHIVE, function () {
            if (o.onArchive) o.onArchive(note.id);
        }, 'text-text-tertiary'));
    }

    var deleteBtn = _actionBtn('Delete', SVG_DELETE, function () {
        if (o.onDelete) o.onDelete(note.id);
    }, 'text-text-disabled hover:text-status-error');
    actionGroup.appendChild(deleteBtn);

    actionBar.appendChild(actionGroup);

    /* Badges row */
    var badgeRow = document.createElement('div');
    badgeRow.className = 'flex items-center gap-2';

    if (note.isPinned) {
        badgeRow.appendChild(_pill('Pinned', 'bg-accent-knowledge/15 text-accent-knowledge'));
    }
    if (note.isFavorited) {
        badgeRow.appendChild(_pill('Favorited', 'bg-status-error/10 text-status-error/70'));
    }
    if (isArchived) {
        badgeRow.appendChild(_pill('Archived', 'bg-status-warning/10 text-status-warning'));
    }

    actionBar.appendChild(badgeRow);
    el.appendChild(actionBar);

    /* ── Editor Body ── */
    var body = document.createElement('div');
    body.className = 'flex-1 overflow-y-auto';

    var inner = document.createElement('div');
    inner.className = 'max-w-2xl mx-auto px-6 py-6';

    /* ── Title ── */
    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = [
        'w-full bg-transparent border-none outline-none',
        'text-[22px] font-heading font-semibold text-text-primary',
        'placeholder:text-text-disabled/40',
        'mb-3 tracking-tight',
    ].join(' ');
    titleInput.placeholder = 'Untitled note\u2026';
    titleInput.value = note.title || '';
    titleInput.disabled = isArchived;
    inner.appendChild(titleInput);

    /* ── Meta Row: Category + Updated ── */
    var metaRow = document.createElement('div');
    metaRow.className = 'flex items-center gap-3 mb-4';

    /* Category select */
    var catMeta_ = meta[note.category] || meta.other;
    var catWrap = document.createElement('div');
    catWrap.className = 'relative';

    var catSelect = document.createElement('select');
    catSelect.className = [
        'appearance-none bg-surface-raised/40 text-[11px] text-text-secondary',
        'pl-2.5 pr-7 py-1.5 rounded-lg',
        'border border-white/[0.04] hover:border-white/[0.08]',
        'focus:outline-none focus:border-accent-knowledge/30',
        'transition-colors duration-150 cursor-pointer',
        ' [color-scheme:dark]',
    ].join(' ');
    catSelect.disabled = isArchived;

    var allCategories = Object.keys(meta);
    for (var ci = 0; ci < allCategories.length; ci++) {
        var catKey = allCategories[ci];
        var cm = meta[catKey];
        var opt = document.createElement('option');
        opt.value = catKey;
        opt.textContent = cm.icon + ' ' + cm.label;
        if (catKey === note.category) opt.selected = true;
        catSelect.appendChild(opt);
    }

    var chevronIcon = document.createElement('span');
    chevronIcon.className = 'absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-disabled';
    chevronIcon.innerHTML = SVG_CHEVRON_DOWN;

    catWrap.appendChild(catSelect);
    catWrap.appendChild(chevronIcon);
    metaRow.appendChild(catWrap);

    /* Updated label */
    var updatedLabel = document.createElement('span');
    updatedLabel.className = 'text-[11px] text-text-disabled';
    updatedLabel.textContent = 'Edited ' + relativeDate(note.updatedAt);
    metaRow.appendChild(updatedLabel);

    inner.appendChild(metaRow);

    /* ── Tags ── */
    var tagsSection = document.createElement('div');
    tagsSection.className = 'flex items-center gap-2 flex-wrap mb-5';

    var existingTags = (note.tags || []).slice();

    function _renderTagChips() {
        tagsSection.innerHTML = '';
        tagsSection.appendChild(SVG_TAG_NODE());

        for (var t = 0; t < existingTags.length; t++) {
            (function (tagVal, idx) {
                var chip = document.createElement('span');
                chip.className = [
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px]',
                    'bg-accent-knowledge/10 text-accent-knowledge/80',
                    'group/chip',
                ].join(' ');
                chip.innerHTML = '<span>' + _escapeHTML(tagVal) + '</span>';

                if (!isArchived) {
                    var removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = [
                        'ml-0.5 text-accent-knowledge/40 hover:text-accent-knowledge',
                        'transition-colors duration-150',
                        'opacity-0 group-hover/chip:opacity-100',
                    ].join(' ');
                    removeBtn.innerHTML = '<svg viewBox="0 0 10 10" fill="currentColor" class="w-2 h-2"><path d="M6.354 5.5H8a.5.5 0 010 1h-2.5a.5.5 0 01-.5-.5v-3a.5.5 0 011 0V5h1.146a.5.5 0 010 1H5.5v1.854a.5.5 0 01-1 0V5.5H3.354a.5.5 0 010-1H4V2.646a.5.5 0 011 0V5h1.146a.5.5 0 010 1H5.5v1.854a.5.5 0 01-1 0V5.5H3.354a.5.5 0 010-1H4V2.646a.5.5 0 011 0V5h1.146a.5.5 0 010 1H5.5v1.854"/></svg>';
                    removeBtn.addEventListener('click', function () {
                        existingTags.splice(idx, 1);
                        _renderTagChips();
                        _emitSave();
                    });
                    chip.appendChild(removeBtn);
                }

                tagsSection.appendChild(chip);
            })(existingTags[t], t);
        }

        if (!isArchived) {
            var tagInput = document.createElement('input');
            tagInput.type = 'text';
            tagInput.className = [
                'flex-1 min-w-[80px] bg-transparent border-none outline-none',
                'text-[12px] text-text-secondary',
                'placeholder:text-text-disabled/40',
            ].join(' ');
            tagInput.placeholder = existingTags.length ? 'Add tag\u2026' : 'Add tags\u2026';
            tagsSection.appendChild(tagInput);

            tagInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    var val = tagInput.value.trim().toLowerCase().replace(/,/g, '');
                    if (val && existingTags.indexOf(val) === -1) {
                        existingTags.push(val);
                        _renderTagChips();
                        _emitSave();
                    }
                    tagInput.value = '';
                }
                if (e.key === 'Backspace' && tagInput.value === '' && existingTags.length > 0) {
                    existingTags.pop();
                    _renderTagChips();
                    _emitSave();
                }
            });
        }
    }

    function SVG_TAG_NODE() {
        var span = document.createElement('span');
        span.className = 'text-text-disabled flex-shrink-0';
        span.innerHTML = SVG_TAG;
        return span;
    }

    _renderTagChips();
    inner.appendChild(tagsSection);

    /* ── Content Textarea ── */
    var contentArea = document.createElement('textarea');
    contentArea.className = [
        'w-full min-h-[300px] flex-1 resize-none',
        'bg-transparent border-none outline-none',
        'text-[14px] leading-relaxed text-text-secondary',
        'placeholder:text-text-disabled/30',
        'font-mono',
    ].join(' ');
    contentArea.placeholder = 'Start writing\u2026';
    contentArea.value = note.content || '';
    contentArea.disabled = isArchived;
    inner.appendChild(contentArea);

    /* ── Auto-resize content area ── */
    function _autoResize() {
        contentArea.style.height = 'auto';
        var newH = Math.max(300, contentArea.scrollHeight);
        contentArea.style.height = newH + 'px';
    }
    _autoResize();

    body.appendChild(inner);
    el.appendChild(body);

    /* ── Metadata Footer ── */
    var footer = document.createElement('div');
    footer.className = [
        'flex items-center justify-between gap-4',
        'px-5 py-2.5 border-t border-white/[0.04]',
        'bg-surface-base/30',
    ].join(' ');

    var stats = document.createElement('div');
    stats.className = 'flex items-center gap-4 text-[11px] text-text-disabled';

    var wordCount = note.wordCount || 0;
    var charCount = note.charCount || 0;

    stats.innerHTML =
        '<span class="tabular-nums">' + wordCount + ' words</span>' +
        '<span class="text-white/[0.08]">·</span>' +
        '<span class="tabular-nums">' + charCount + ' chars</span>';

    var dates = document.createElement('div');
    dates.className = 'text-[11px] text-text-disabled';
    dates.textContent = 'Created ' + formatDate(note.createdAt);

    footer.appendChild(stats);
    footer.appendChild(dates);
    el.appendChild(footer);

    /* ── Save Emitter ── */
    var saveTimer = null;

    function _emitSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            if (o.onSave) {
                o.onSave({
                    id:         note.id,
                    title:      titleInput.value.trim(),
                    content:    contentArea.value,
                    category:   catSelect.value,
                    tags:       existingTags.slice(),
                });
            }
        }, 500);
    }

    titleInput.addEventListener('input', function () {
        _emitSave();
    });

    contentArea.addEventListener('input', function () {
        _autoResize();
        _emitSave();
    });

    catSelect.addEventListener('change', function () {
        _emitSave();
    });

    return el;
}

/* ── Empty State ─────────────────────────────────────────── */

function _renderEmptyState(el) {
    el.className = 'flex flex-col items-center justify-center h-full text-center px-8';
    el.innerHTML =
        '<div class="text-5xl mb-4 opacity-15">\uD83D\uDCDD</div>' +
        '<p class="text-[14px] text-text-secondary font-medium mb-1">No note selected</p>' +
        '<p class="text-[12px] text-text-tertiary">Select a note from the sidebar or create a new one.</p>';
}

/* ── Helpers ─────────────────────────────────────────────── */

function _actionBtn(title, icon, onClick, extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = [
        'p-1.5 rounded-lg',
        'text-text-tertiary',
        'hover:bg-white/[0.06]',
        'transition-all duration-150',
        extraClass || '',
    ].join(' ');
    btn.innerHTML = icon;
    btn.addEventListener('click', onClick);
    return btn;
}

function _pill(text, colorClasses) {
    var span = document.createElement('span');
    span.className = [
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium',
        colorClasses,
    ].join(' ');
    span.textContent = text;
    return span;
}

function _escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
