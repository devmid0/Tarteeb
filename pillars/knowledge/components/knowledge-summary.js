/**
 * Tarteeb — Knowledge Summary
 *
 * Premium stat dashboard: hero card + category breakdown.
 * Wire: pass { notes, links, noteTags, linkTags } from the store.
 */

import { CATEGORY_META, summarizeByCategory, summarizeTags, sortByCreated } from '../domain/knowledge-rules.js';

export function createKnowledgeSummary(stats) {
    var s = stats || {};
    var notes = s.notes || [];
    var links = s.links || [];

    var noteCount = notes.length;
    var linkCount = links.length;
    var totalCount = noteCount + linkCount;

    /* Tag aggregation */
    var allTags = {};
    var i, key;
    var noteTags = summarizeTags(notes);
    var linkTags = summarizeTags(links);
    for (key in noteTags) { allTags[key] = noteTags[key]; }
    for (key in linkTags) { allTags[key] = (allTags[key] || 0) + linkTags[key]; }
    var tagCount = Object.keys(allTags).length;

    var root = document.createElement('div');
    root.className = 'space-y-4 mb-6';

    /* ── Row 1: Hero Stats ───────────────────────────────── */

    var hero = document.createElement('div');
    hero.className = [
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br from-accent-knowledge/10 via-surface-raised/80 to-surface-raised/40',
        'border border-accent-knowledge/10',
        'px-6 py-5',
    ].join(' ');

    hero.innerHTML =
        '<div class="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-accent-knowledge/[0.06] blur-3xl pointer-events-none"></div>' +
        '<div class="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-accent-knowledge/[0.04] blur-2xl pointer-events-none"></div>' +
        '<div class="relative">' +
            '<div class="flex items-center gap-2 mb-1">' +
                '<svg viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5 text-accent-knowledge/60">' +
                    '<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V14a.5.5 0 01-1 0V4.804z"/>' +
                '</svg>' +
                '<span class="text-[11px] font-semibold text-accent-knowledge/70 uppercase tracking-widest">Knowledge Base</span>' +
            '</div>' +
            '<div class="text-[32px] font-heading font-bold text-text-primary leading-none tracking-tight tabular-nums mb-3">' +
                totalCount +
                '<span class="text-[14px] font-medium text-text-tertiary ml-1.5">' + (totalCount === 1 ? 'item' : 'items') + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-4">' +
                _statPill('Notes', noteCount, 'text-accent-knowledge', 'bg-accent-knowledge') +
                '<div class="w-px h-5 bg-white/[0.06]"></div>' +
                _statPill('Links', linkCount, 'text-accent-finance', 'bg-accent-finance') +
                '<div class="flex-1"></div>' +
                '<div class="text-[11px] text-text-disabled font-medium">' +
                    '<span class="text-text-tertiary">' + tagCount + ' tags</span>' +
                '</div>' +
            '</div>' +
        '</div>';

    root.appendChild(hero);

    /* ── Row 2: Category Breakdown ───────────────────────── */

    var noteCategories = summarizeByCategory(notes);
    var catKeys = Object.keys(noteCategories).sort(function (a, b) {
        return noteCategories[b] - noteCategories[a];
    });

    if (catKeys.length > 0) {
        var catRow = document.createElement('div');
        catRow.className = 'grid grid-cols-2 gap-3';

        /* Top categories as mini pills */
        for (var c = 0; c < Math.min(catKeys.length, 4); c++) {
            var catKey = catKeys[c];
            var meta = CATEGORY_META[catKey] || CATEGORY_META.other;
            var count = noteCategories[catKey];

            var pill = document.createElement('div');
            pill.className = [
                'flex items-center gap-2 px-3.5 py-2.5 rounded-xl',
                'bg-surface-raised/50 border border-white/[0.04]',
                'hover:bg-surface-elevated/40 hover:border-white/[0.06]',
                'transition-all duration-200',
            ].join(' ');

            pill.innerHTML =
                '<span class="w-8 h-8 rounded-lg flex items-center justify-center text-[14px]" ' +
                    'style="background:' + meta.color + '12">' + meta.icon + '</span>' +
                '<div class="flex-1 min-w-0">' +
                    '<div class="text-[12px] font-medium text-text-primary truncate">' + meta.label + '</div>' +
                    '<div class="text-[11px] text-text-tertiary">' + count + ' ' + (count === 1 ? 'note' : 'notes') + '</div>' +
                '</div>';

            catRow.appendChild(pill);
        }

        root.appendChild(catRow);
    }

    return root;
}

/* ── Internal Builders ──────────────────────────────────── */

function _statPill(label, count, textColor, dotBg) {
    return '<div class="flex items-center gap-1.5">' +
        '<span class="w-1.5 h-1.5 rounded-full ' + dotBg + '"></span>' +
        '<span class="text-[11px] text-text-tertiary">' + label + '</span>' +
        '<span class="text-[12px] font-semibold ' + textColor + ' tabular-nums">' + count + '</span>' +
    '</div>';
}
