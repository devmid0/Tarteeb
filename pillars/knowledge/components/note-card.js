/**
 * Tarteeb — Note Card
 *
 * Premium single-note row with category icon, pinned indicator,
 * tag chips, relative date, content preview, and hover-reveal
 * action buttons with micro-interactions.
 */

import { CATEGORY_META, relativeDate } from '../domain/knowledge-rules.js';

export function createNoteCard(note, callbacks) {
    var cbs = callbacks || {};
    var el = document.createElement('div');
    el.dataset.noteId = note.id;

    var catMeta = CATEGORY_META[note.category] || CATEGORY_META.other;

    el.className = [
        'group relative',
        'pl-1 pr-2 py-0 rounded-xl',
        'bg-surface-raised/40 hover:bg-surface-elevated/60',
        'border border-transparent hover:border-white/[0.04]',
        'border-l-[3px] ' + (note.isPinned ? 'border-l-accent-knowledge' : 'border-l-transparent'),
        'transition-all duration-200',
        'hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.3)]',
        'cursor-pointer',
    ].join(' ');

    /* ── Category Icon ── */

    var iconWrap = document.createElement('div');
    iconWrap.className = [
        'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[15px]',
        'transition-transform duration-200 group-hover:scale-105',
    ].join(' ');
    iconWrap.style.backgroundColor = catMeta.color + '12';
    iconWrap.textContent = catMeta.icon;

    /* ── Content ── */

    var content = document.createElement('div');
    content.className = 'flex-1 min-w-0 py-2.5';

    /* Line 1: Title + Pin */
    var line1 = document.createElement('div');
    line1.className = 'flex items-center gap-2 min-w-0';

    if (note.isPinned) {
        var pinBadge = document.createElement('span');
        pinBadge.className = 'text-[10px] text-accent-knowledge flex-shrink-0';
        pinBadge.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.12-.152.23-.152.33v5.37l1.78 2.027a.5.5 0 01-.11.687l-.55.448.18.645a.75.75 0 01-1.179.94L9.5 11.5l-2.34 2.34A.75.75 0 016 13.46l.18-.645-.55-.448a.5.5 0 01-.11-.687L7.21 9.75V4.38c0-.1-.026-.21-.152-.33C6.842 3.774 6.5 3.28 6.5 2.6v-.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v.5c0 .28-.158.574-.454.82-.074.064-.1.117-.1.17v5.63l-1.585-1.79a.5.5 0 01-.11-.687l.55-.448-.18-.645a.75.75 0 011.179-.94L10 4.5l2.34-2.34a.75.75 0 011.06 0l.5.5"/></svg>';
        line1.appendChild(pinBadge);
    }

    var titleEl = document.createElement('span');
    titleEl.className = 'text-[13px] font-medium text-text-primary truncate';
    titleEl.textContent = note.title;
    line1.appendChild(titleEl);

    /* Category label */
    var catLabel = document.createElement('span');
    catLabel.className = 'text-[11px] text-text-disabled flex-shrink-0';
    catLabel.textContent = '· ' + catMeta.label;
    line1.appendChild(catLabel);

    /* Line 2: Content preview + Date */
    var line2 = document.createElement('div');
    line2.className = 'flex items-center gap-2 mt-0.5';

    if (note.content) {
        var preview = document.createElement('span');
        preview.className = 'text-[12px] text-text-tertiary truncate flex-1';
        preview.textContent = note.content.slice(0, 80);
        line2.appendChild(preview);
    }

    if (note.createdAt) {
        var dateEl = document.createElement('span');
        dateEl.className = 'text-[11px] text-text-disabled flex-shrink-0';
        dateEl.textContent = relativeDate(note.createdAt);
        line2.appendChild(dateEl);
    }

    /* Line 3: Tags */
    var line3 = document.createElement('div');
    line3.className = 'flex items-center gap-1 mt-1 flex-wrap';

    if (Array.isArray(note.tags)) {
        for (var i = 0; i < Math.min(note.tags.length, 4); i++) {
            var tag = document.createElement('span');
            tag.className = 'text-[10px] px-1.5 py-[1px] rounded bg-white/[0.04] text-text-disabled font-medium';
            tag.textContent = note.tags[i];
            line3.appendChild(tag);
        }
        if (note.tags.length > 4) {
            var more = document.createElement('span');
            more.className = 'text-[10px] text-text-disabled';
            more.textContent = '+' + (note.tags.length - 4);
            line3.appendChild(more);
        }
    }

    content.appendChild(line1);
    content.appendChild(line2);
    if (line3.childNodes.length > 0) content.appendChild(line3);

    /* ── Actions (hover-reveal) ── */

    var actions = document.createElement('div');
    actions.className = [
        'flex-shrink-0 flex items-center gap-0.5 pl-1',
        'opacity-0 group-hover:opacity-100',
        'transition-opacity duration-150',
    ].join(' ');

    /* Pin toggle */
    actions.appendChild(_actionBtn(
        note.isPinned ? 'Unpin' : 'Pin',
        _svgPin(note.isPinned),
        function (e) {
            e.stopPropagation();
            if (cbs.onTogglePin) cbs.onTogglePin(note.id);
        },
        note.isPinned ? 'text-accent-knowledge hover:text-accent-knowledge hover:bg-accent-knowledge/10' : ''
    ));

    actions.appendChild(_actionBtn('Edit', _svgEdit(), function (e) {
        e.stopPropagation();
        if (cbs.onEdit) cbs.onEdit(note.id);
    }));

    actions.appendChild(_actionBtn('Delete', _svgTrash(), function (e) {
        e.stopPropagation();
        if (cbs.onDelete) cbs.onDelete(note.id);
    }, 'hover:text-status-error hover:bg-status-error/10'));

    /* ── Assemble ── */

    el.appendChild(iconWrap);
    el.appendChild(content);
    el.appendChild(actions);

    return el;
}

/* ── Internal Helpers ───────────────────────────────────── */

function _actionBtn(title, icon, onClick, extraHover) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = [
        'p-2 rounded-lg text-text-disabled',
        'transition-colors duration-150',
        extraHover || 'hover:text-text-secondary hover:bg-white/[0.06]',
    ].join(' ');
    btn.innerHTML = icon;
    btn.addEventListener('click', onClick);
    return btn;
}

function _svgPin(isPinned) {
    if (isPinned) {
        return '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.12-.152.23-.152.33v5.37l1.78 2.027a.5.5 0 01-.11.687l-.55.448.18.645a.75.75 0 01-1.179.94L9.5 11.5l-2.34 2.34A.75.75 0 016 13.46l.18-.645-.55-.448a.5.5 0 01-.11-.687L7.21 9.75V4.38c0-.1-.026-.21-.152-.33C6.842 3.774 6.5 3.28 6.5 2.6v-.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v.5c0 .28-.158.574-.454.82-.074.064-.1.117-.1.17v5.63l-1.585-1.79a.5.5 0 01-.11-.687l.55-.448-.18-.645a.75.75 0 011.179-.94L10 4.5l2.34-2.34a.75.75 0 011.06 0l.5.5"/></svg>';
    }
    return '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 01-.707.708l-.8-.8-3.37 3.37a.5.5 0 01-.708 0L7.146 6.418l-.8.8a.5.5 0 01-.707-.708l3.37-3.37-1.464-1.464a.5.5 0 01.146-.354l4.95-4.95a.5.5 0 01.707 0zM2.146 3.354a.5.5 0 010-.708l4-4a.5.5 0 01.708 0l4 4a.5.5 0 01-.708.708L7 1.207 2.854 5.354a.5.5 0 01-.708 0z"/></svg>';
}

function _svgEdit() {
    return '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">' +
        '<path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 015 12.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.468-.325z"/>' +
    '</svg>';
}

function _svgTrash() {
    return '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">' +
        '<path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>' +
        '<path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/>' +
    '</svg>';
}
