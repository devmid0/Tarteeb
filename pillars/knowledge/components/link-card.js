/**
 * Life OS — Link Card
 *
 * Premium single-link row with domain favicon, URL domain badge,
 * tag chips, relative date, description preview, and hover-reveal
 * action buttons with micro-interactions.
 */

import { relativeDate, extractDomain } from '../domain/knowledge-rules.js';

export function createLinkCard(link, callbacks) {
    var cbs = callbacks || {};
    var el = document.createElement('div');
    el.dataset.linkId = link.id;

    var domain = extractDomain(link.url);

    el.className = [
        'group relative',
        'pl-1 pr-2 py-0 rounded-xl',
        'bg-surface-raised/40 hover:bg-surface-elevated/60',
        'border border-transparent hover:border-white/[0.04]',
        'border-l-[3px] border-l-accent-finance/40',
        'transition-all duration-200',
        'hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.3)]',
        'cursor-pointer',
    ].join(' ');

    /* ── Favicon / Domain Icon ── */

    var iconWrap = document.createElement('div');
    iconWrap.className = [
        'flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
        'bg-accent-finance/8 transition-transform duration-200 group-hover:scale-105',
    ].join(' ');

    if (link.favicon) {
        var img = document.createElement('img');
        img.src = link.favicon;
        img.alt = '';
        img.className = 'w-5 h-5 rounded';
        img.onerror = function () {
            img.remove();
            iconWrap.textContent = '\uD83C\uDF10';
            iconWrap.style.fontSize = '15px';
        };
        iconWrap.appendChild(img);
    } else {
        iconWrap.textContent = '\uD83C\uDF10';
        iconWrap.style.fontSize = '15px';
        iconWrap.style.color = 'var(--accent-finance)';
    }

    /* ── Content ── */

    var content = document.createElement('div');
    content.className = 'flex-1 min-w-0 py-2.5';

    /* Line 1: Title */
    var line1 = document.createElement('div');
    line1.className = 'flex items-center gap-2 min-w-0';

    var titleEl = document.createElement('span');
    titleEl.className = 'text-[13px] font-medium text-text-primary truncate';
    titleEl.textContent = link.title;
    line1.appendChild(titleEl);

    /* Line 2: Domain + Date */
    var line2 = document.createElement('div');
    line2.className = 'flex items-center gap-2 mt-0.5';

    if (domain) {
        var domainBadge = document.createElement('span');
        domainBadge.className = 'text-[10px] px-1.5 py-[1px] rounded bg-accent-finance/8 text-accent-finance/70 font-medium';
        domainBadge.textContent = domain;
        line2.appendChild(domainBadge);
    }

    if (link.description) {
        var sep = document.createElement('span');
        sep.className = 'text-text-disabled text-[10px]';
        sep.textContent = '\u00b7';
        line2.appendChild(sep);

        var desc = document.createElement('span');
        desc.className = 'text-[12px] text-text-tertiary truncate flex-1';
        desc.textContent = link.description.slice(0, 60);
        line2.appendChild(desc);
    }

    if (link.createdAt) {
        var dateEl = document.createElement('span');
        dateEl.className = 'text-[11px] text-text-disabled flex-shrink-0';
        dateEl.textContent = relativeDate(link.createdAt);
        line2.appendChild(dateEl);
    }

    /* Line 3: Tags */
    var line3 = document.createElement('div');
    line3.className = 'flex items-center gap-1 mt-1 flex-wrap';

    if (Array.isArray(link.tags)) {
        for (var i = 0; i < Math.min(link.tags.length, 4); i++) {
            var tag = document.createElement('span');
            tag.className = 'text-[10px] px-1.5 py-[1px] rounded bg-white/[0.04] text-text-disabled font-medium';
            tag.textContent = link.tags[i];
            line3.appendChild(tag);
        }
        if (link.tags.length > 4) {
            var more = document.createElement('span');
            more.className = 'text-[10px] text-text-disabled';
            more.textContent = '+' + (link.tags.length - 4);
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

    /* Open in new tab */
    actions.appendChild(_actionBtn('Open', _svgExternalLink(), function (e) {
        e.stopPropagation();
        window.open(link.url, '_blank', 'noopener,noreferrer');
    }));

    actions.appendChild(_actionBtn('Edit', _svgEdit(), function (e) {
        e.stopPropagation();
        if (cbs.onEdit) cbs.onEdit(link.id);
    }));

    actions.appendChild(_actionBtn('Delete', _svgTrash(), function (e) {
        e.stopPropagation();
        if (cbs.onDelete) cbs.onDelete(link.id);
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

function _svgExternalLink() {
    return '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">' +
        '<path d="M8.086 2.207a2 2 0 012.828 0l3.879 3.879a2 2 0 010 2.828l-4.5 4.5A2 2 0 0110.929 10H10V6.071a1 1 0 00-1.707-.707L4.293 9.586a2 2 0 010-2.828l4.5-4.5z"/>' +
        '<path d="M9.5 4.5V6H12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h2.5v-1.5a.5.5 0 01.854-.354l4.5 4.5a.5.5 0 010 .708l-4.5 4.5A.5.5 0 019.5 14.5v-2H4a.5.5 0 01-.5-.5V8a.5.5 0 01.5-.5h2.5V6a.5.5 0 01.5-.5h3z"/>' +
    '</svg>';
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
