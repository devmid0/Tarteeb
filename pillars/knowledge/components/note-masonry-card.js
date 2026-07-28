/**
 * Tarteeb — Note Masonry Card
 *
 * Premium, tactile sticky-note card for the masonry grid layout.
 * Features category-colored accent, line-clamped content preview,
 * fade effect at bottom, hover scale + shadow lift, and
 * hover-reveal action buttons.
 *
 * Factory signature:
 *   createNoteMasonryCard(note, callbacks) → HTMLElement
 *
 * opts:
 *   note         {Object}        — note document
 *   callbacks    {Object}        — { onClick, onTogglePin, onDelete }
 */

'use strict';

import { CATEGORY_META, relativeDate } from '../domain/knowledge-rules.js';

/* ── Category Color Map (card backgrounds) ───────────────── */

var CARD_BG = {
    programming: 'rgba(96, 165, 250, 0.04)',
    design:      'rgba(244, 114, 182, 0.04)',
    business:    'rgba(250, 204, 21, 0.04)',
    health:      'rgba(74, 222, 128, 0.04)',
    learning:    'rgba(192, 132, 252, 0.04)',
    personal:    'rgba(45, 212, 191, 0.04)',
    other:       'rgba(161, 161, 170, 0.03)',
};

var CARD_BORDER_HOVER = {
    programming: 'rgba(96, 165, 250, 0.12)',
    design:      'rgba(244, 114, 182, 0.12)',
    business:    'rgba(250, 204, 21, 0.12)',
    health:      'rgba(74, 222, 128, 0.12)',
    learning:    'rgba(192, 132, 252, 0.12)',
    personal:    'rgba(45, 212, 191, 0.12)',
    other:       'rgba(161, 161, 170, 0.08)',
};

/* ── Factory ─────────────────────────────────────────────── */

export function createNoteMasonryCard(note, callbacks) {
    var cbs = callbacks || {};
    var cat = note.category || 'other';
    var catMeta = CATEGORY_META[cat] || CATEGORY_META.other;

    var el = document.createElement('div');
    el.className = 'masonry-card';
    el.dataset.noteId = note.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', (note.title || 'Untitled note') + ', ' + catMeta.label);

    /* ── Accent Strip ── */
    var strip = document.createElement('div');
    strip.className = 'masonry-card-strip';
    strip.style.backgroundColor = catMeta.color;
    el.appendChild(strip);

    /* ── Card Body ── */
    var body = document.createElement('div');
    body.className = 'masonry-card-body';
    body.style.backgroundColor = CARD_BG[cat] || CARD_BG.other;

    /* ── Header: Category chip + Pin badge ── */
    var header = document.createElement('div');
    header.className = 'masonry-card-header';

    var catChip = document.createElement('span');
    catChip.className = 'masonry-card-category';
    catChip.style.color = catMeta.color;
    catChip.innerHTML = '<span class="masonry-card-category-icon">' + catMeta.icon + '</span> ' + catMeta.label;
    header.appendChild(catChip);

    if (note.isPinned) {
        var pinBadge = document.createElement('span');
        pinBadge.className = 'masonry-card-pin';
        pinBadge.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3"><path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.12-.152.23-.152.33v5.37l1.78 2.027a.5.5 0 01-.11.687l-.55.448.18.645a.75.75 0 01-1.179.94L9.5 11.5l-2.34 2.34A.75.75 0 016 13.46l.18-.645-.55-.448a.5.5 0 01-.11-.687L7.21 9.75V4.38c0-.1-.026-.21-.152-.33C6.842 3.774 6.5 3.28 6.5 2.6v-.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v.5c0 .28-.158.574-.454.82-.074.064-.1.117-.1.17v5.63l-1.585-1.79a.5.5 0 01-.11-.687l.55-.448-.18-.645a.75.75 0 011.179-.94L10 4.5l2.34-2.34a.75.75 0 011.06 0l.5.5"/></svg>';
        header.appendChild(pinBadge);
    }

    body.appendChild(header);

    /* ── Title ── */
    if (note.title) {
        var title = document.createElement('h3');
        title.className = 'masonry-card-title';
        title.textContent = note.title;
        body.appendChild(title);
    }

    /* ── Content Preview (line-clamped) ── */
    if (note.content) {
        var contentWrap = document.createElement('div');
        contentWrap.className = 'masonry-card-content-wrap';

        var content = document.createElement('p');
        content.className = 'masonry-card-content';
        content.textContent = note.content;
        contentWrap.appendChild(content);

        /* Fade overlay at bottom */
        var fade = document.createElement('div');
        fade.className = 'masonry-card-fade';
        contentWrap.appendChild(fade);

        body.appendChild(contentWrap);
    }

    /* ── Footer: Tags + Date ── */
    var footer = document.createElement('div');
    footer.className = 'masonry-card-footer';

    /* Tags */
    var tagsWrap = document.createElement('div');
    tagsWrap.className = 'masonry-card-tags';
    if (Array.isArray(note.tags)) {
        for (var i = 0; i < Math.min(note.tags.length, 3); i++) {
            var tag = document.createElement('span');
            tag.className = 'masonry-card-tag';
            tag.textContent = note.tags[i];
            tagsWrap.appendChild(tag);
        }
        if (note.tags.length > 3) {
            var more = document.createElement('span');
            more.className = 'masonry-card-tag masonry-card-tag-more';
            more.textContent = '+' + (note.tags.length - 3);
            tagsWrap.appendChild(more);
        }
    }
    footer.appendChild(tagsWrap);

    /* Date */
    if (note.createdAt) {
        var date = document.createElement('span');
        date.className = 'masonry-card-date';
        date.textContent = relativeDate(note.createdAt);
        footer.appendChild(date);
    }
    body.appendChild(footer);

    /* ── Hover Actions ── */
    var actions = document.createElement('div');
    actions.className = 'masonry-card-actions';

    actions.appendChild(_iconBtn(
        note.isPinned ? 'Unpin' : 'Pin',
        note.isPinned
            ? '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.12-.152.23-.152.33v5.37l1.78 2.027a.5.5 0 01-.11.687l-.55.448.18.645a.75.75 0 01-1.179.94L9.5 11.5l-2.34 2.34A.75.75 0 016 13.46l.18-.645-.55-.448a.5.5 0 01-.11-.687L7.21 9.75V4.38c0-.1-.026-.21-.152-.33C6.842 3.774 6.5 3.28 6.5 2.6v-.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v.5c0 .28-.158.574-.454.82-.074.064-.1.117-.1.17v5.63l-1.585-1.79a.5.5 0 01-.11-.687l.55-.448-.18-.645a.75.75 0 011.179-.94L10 4.5l2.34-2.34a.75.75 0 011.06 0l.5.5"/></svg>'
            : '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 01-.707.708l-.8-.8-3.37 3.37a.5.5 0 01-.708 0L7.146 6.418l-.8.8a.5.5 0 01-.707-.708l3.37-3.37-1.464-1.464a.5.5 0 01.146-.354l4.95-4.95a.5.5 0 01.707 0zM2.146 3.354a.5.5 0 010-.708l4-4a.5.5 0 01.708 0l4 4a.5.5 0 01-.708.708L7 1.207 2.854 5.354a.5.5 0 01-.708 0z"/></svg>',
        note.isPinned ? 'masonry-card-action-pin-active' : '',
        function (e) {
            e.stopPropagation();
            if (cbs.onTogglePin) cbs.onTogglePin(note.id);
        }
    ));

    actions.appendChild(_iconBtn(
        'Delete',
        '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h3a1 1 0 011-1h2a1 1 0 011 1h3a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z" clip-rule="evenodd"/></svg>',
        'masonry-card-action-delete',
        function (e) {
            e.stopPropagation();
            if (cbs.onDelete) cbs.onDelete(note.id);
        }
    ));

    body.appendChild(actions);
    el.appendChild(body);

    /* ── Hover border glow ── */
    var hoverBorder = CARD_BORDER_HOVER[cat] || CARD_BORDER_HOVER.other;
    el.addEventListener('mouseenter', function () {
        body.style.borderColor = hoverBorder;
    });
    el.addEventListener('mouseleave', function () {
        body.style.borderColor = '';
    });

    /* ── Click handler ── */
    el.addEventListener('click', function () {
        if (cbs.onClick) cbs.onClick(note.id);
    });
    el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (cbs.onClick) cbs.onClick(note.id);
        }
    });

    return el;
}

/* ── Helpers ─────────────────────────────────────────────── */

function _iconBtn(title, svg, extraClass, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = 'masonry-card-action-btn' + (extraClass ? ' ' + extraClass : '');
    btn.innerHTML = svg;
    btn.addEventListener('click', onClick);
    return btn;
}
