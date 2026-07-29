/**
 * Tarteeb — Note Form
 *
 * Premium inline expandable form for creating notes.
 * Collapses into a single-row prompt; expands into a polished
 * form with category selector, tag input, and keyboard-first submission.
 */

import { NOTE_CATEGORIES, CATEGORY_META } from '../domain/knowledge-rules.js';

export function createNoteForm(opts) {
    var onSubmit = opts && opts.onSubmit;

    var wrapper = document.createElement('div');
    wrapper.className = 'mb-3';

    var expanded    = false;
    var currentCat  = 'other';
    var currentTags = [];

    /* ── Collapsed Trigger ───────────────────────────────── */

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = [
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl',
        'bg-surface-raised/30 border border-dashed border-white/[0.06]',
        'hover:border-accent-knowledge/25 hover:bg-surface-raised/50',
        'focus:outline-none focus:border-accent-knowledge/40 focus:bg-surface-raised/50',
        'transition-all duration-200 group',
    ].join(' ');

    trigger.innerHTML =
        '<span class="flex-shrink-0 w-7 h-7 rounded-lg bg-accent-knowledge/10 flex items-center justify-center' +
                ' text-accent-knowledge text-[15px] font-medium leading-none' +
                ' group-hover:bg-accent-knowledge/15 transition-colors duration-200">+</span>' +
        '<span class="text-[13px] text-text-tertiary group-hover:text-text-secondary transition-colors duration-200 select-none">' +
            'Add a note\u2026' +
        '</span>';

    trigger.addEventListener('click', function () { expand(); });

    /* ── Expanded Panel ──────────────────────────────────── */

    var panel = document.createElement('div');
    panel.className = [
        'rounded-xl bg-surface-raised border border-white/[0.06]',
        'overflow-hidden max-h-0 opacity-0',
        'transition-all duration-[300ms] ease-[cubic-bezier(0.45,0,0.55,1)]',
    ].join(' ');

    panel.innerHTML = _buildFormHTML();

    /* ── Expand / Collapse ───────────────────────────────── */

    function expand() {
        if (expanded) return;
        expanded = true;
        trigger.classList.add('hidden');
        panel.classList.remove('max-h-0', 'opacity-0');
        panel.classList.add('max-h-[600px]', 'opacity-100');
        _populateCategories();
        var titleInput = panel.querySelector('.n-title');
        if (titleInput) requestAnimationFrame(function () { titleInput.focus(); });
    }

    function collapse() {
        expanded = false;
        panel.classList.add('max-h-0', 'opacity-0');
        panel.classList.remove('max-h-[600px]', 'opacity-100');
        trigger.classList.remove('hidden');
        _resetForm();
    }

    /* ── Category Selector ───────────────────────────────── */

    function _populateCategories() {
        var grid = panel.querySelector('.n-cat-grid');
        if (!grid) return;
        grid.innerHTML = '';

        for (var i = 0; i < NOTE_CATEGORIES.length; i++) {
            (function (catKey) {
                var meta = CATEGORY_META[catKey] || CATEGORY_META.other;
                var isActive = catKey === currentCat;

                var chip = document.createElement('button');
                chip.type = 'button';
                chip.dataset.cat = catKey;
                chip.className = [
                    'n-cat-chip flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium',
                    'border transition-all duration-150',
                    isActive
                        ? 'bg-accent-knowledge/10 border-accent-knowledge/20 text-accent-knowledge'
                        : 'bg-white/[0.02] border-white/[0.04] text-text-tertiary hover:bg-white/[0.04] hover:text-text-secondary hover:border-white/[0.08]',
                ].join(' ');

                chip.innerHTML =
                    '<span class="text-[13px] leading-none">' + meta.icon + '</span>' +
                    '<span>' + meta.label + '</span>';

                chip.addEventListener('click', function (e) {
                    e.stopPropagation();
                    currentCat = catKey;
                    _highlightCategory();
                });

                grid.appendChild(chip);
            })(NOTE_CATEGORIES[i]);
        }
    }

    function _highlightCategory() {
        var chips = panel.querySelectorAll('.n-cat-chip');
        for (var i = 0; i < chips.length; i++) {
            var isActive = chips[i].dataset.cat === currentCat;
            chips[i].className = [
                'n-cat-chip flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium',
                'border transition-all duration-150',
                isActive
                    ? 'bg-accent-knowledge/10 border-accent-knowledge/20 text-accent-knowledge'
                    : 'bg-white/[0.02] border-white/[0.04] text-text-tertiary hover:bg-white/[0.04] hover:text-text-secondary hover:border-white/[0.08]',
            ].join(' ');
        }
    }

    /* ── Tag Input ───────────────────────────────────────── */

    function _renderTags() {
        var container = panel.querySelector('.n-tags-display');
        if (!container) return;
        container.innerHTML = '';
        for (var i = 0; i < currentTags.length; i++) {
            (function (idx) {
                var tagEl = document.createElement('span');
                tagEl.className = [
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded',
                    'bg-accent-knowledge/10 text-accent-knowledge text-[11px] font-medium',
                ].join(' ');
                tagEl.innerHTML =
                    currentTags[idx] +
                    '<button type="button" class="ml-0.5 hover:text-text-primary transition-colors" aria-label="Remove tag">&times;</button>';
                tagEl.querySelector('button').addEventListener('click', function (e) {
                    e.stopPropagation();
                    currentTags.splice(idx, 1);
                    _renderTags();
                });
                container.appendChild(tagEl);
            })(i);
        }
    }

    function _addTagFromInput() {
        var input = panel.querySelector('.n-tag-input');
        if (!input) return;
        var raw = input.value.trim().toLowerCase();
        if (raw.length === 0) return;
        if (currentTags.indexOf(raw) !== -1) { input.value = ''; return; }
        currentTags.push(raw);
        input.value = '';
        _renderTags();
    }

    /* ── Helpers ─────────────────────────────────────────── */

    function _resetForm() {
        var title   = panel.querySelector('.n-title');
        var content = panel.querySelector('.n-content');
        if (title)   title.value = '';
        if (content) content.value = '';
        currentCat  = 'other';
        currentTags = [];
        _populateCategories();
        _renderTags();
    }

    function _gather() {
        var titleEl   = panel.querySelector('.n-title');
        var contentEl = panel.querySelector('.n-content');
        return {
            title:    titleEl ? titleEl.value.trim() : '',
            content:  contentEl ? contentEl.value.trim() : '',
            category: currentCat,
            tags:     currentTags.slice(),
        };
    }

    function _submit() {
        var data = _gather();
        if (!data.title) {
            var t = panel.querySelector('.n-title');
            if (t) { t.focus(); t.classList.add('ring-2', 'ring-status-error/40'); setTimeout(function () { t.classList.remove('ring-2', 'ring-status-error/40'); }, 600); }
            return;
        }
        if (onSubmit) onSubmit(data);
        collapse();
    }

    /* ── Wire Events ─────────────────────────────────────── */

    var titleInput = panel.querySelector('.n-title');
    if (titleInput) {
        titleInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _submit(); }
            if (e.key === 'Escape') collapse();
        });
    }

    var contentInput = panel.querySelector('.n-content');
    if (contentInput) {
        contentInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') collapse();
        });
    }

    /* Tag input */
    var tagInput = panel.querySelector('.n-tag-input');
    if (tagInput) {
        tagInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                _addTagFromInput();
            }
            if (e.key === 'Escape') {
                if (tagInput.value.length > 0) {
                    tagInput.value = '';
                } else {
                    collapse();
                }
            }
        });
        tagInput.addEventListener('blur', function () {
            _addTagFromInput();
        });
    }

    /* Submit + Cancel */
    var submitBtn = panel.querySelector('.n-submit');
    var cancelBtn = panel.querySelector('.n-cancel');
    if (submitBtn) submitBtn.addEventListener('click', _submit);
    if (cancelBtn) cancelBtn.addEventListener('click', collapse);

    /* ── Assemble ────────────────────────────────────────── */

    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);

    return wrapper;
}

/* ── Form Template ──────────────────────────────────────── */

function _buildFormHTML() {
    return (
        '<div class="p-4 space-y-4">' +

            /* ── Title ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Title</label>' +
                '<input type="text"' +
                       ' class="n-title w-full bg-surface-elevated text-[14px] font-medium text-text-primary' +
                              ' px-3 py-2.5 rounded-lg border border-white/[0.06]' +
                              ' hover:border-white/[0.1] focus:outline-none' +
                              ' focus:border-accent-knowledge/40 transition-colors duration-150' +
                              ' placeholder:text-text-disabled/50"' +
                       ' placeholder="Note title"' +
                       ' maxlength="200">' +
            '</div>' +

            /* ── Category Grid ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Category</label>' +
                '<div class="n-cat-grid flex flex-wrap gap-1.5"></div>' +
            '</div>' +

            /* ── Content ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Content</label>' +
                '<textarea rows="4"' +
                    ' class="n-content w-full bg-surface-elevated text-[13px] text-text-secondary' +
                           ' px-3 py-2.5 rounded-lg border border-white/[0.06]' +
                           ' hover:border-white/[0.1] focus:outline-none' +
                           ' focus:border-accent-knowledge/40 transition-colors duration-150' +
                           ' resize-none placeholder:text-text-disabled/50"' +
                    ' placeholder="Write your note here..."' +
                    ' maxlength="10000"></textarea>' +
            '</div>' +

            /* ── Tags ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Tags</label>' +
                '<div class="n-tags-display flex flex-wrap gap-1 mb-1.5"></div>' +
                '<input type="text"' +
                       ' class="n-tag-input w-full bg-surface-elevated text-[12px] text-text-secondary' +
                              ' px-3 py-2 rounded-lg border border-white/[0.06]' +
                              ' hover:border-white/[0.1] focus:outline-none' +
                              ' focus:border-accent-knowledge/40 transition-colors duration-150' +
                              ' placeholder:text-text-disabled/50"' +
                       ' placeholder="Add tag and press Enter">' +
            '</div>' +

            /* ── Actions ── */
            '<div class="flex items-center gap-2 pt-1">' +
                '<div class="flex-1"></div>' +
                '<button type="button"' +
                        ' class="n-cancel px-3.5 py-2 rounded-lg text-[12px] font-medium text-text-tertiary' +
                               ' hover:text-text-secondary hover:bg-white/[0.04] transition-colors duration-150">' +
                    'Cancel' +
                '</button>' +
                '<button type="button"' +
                        ' class="n-submit inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-semibold' +
                               ' bg-accent-knowledge text-white' +
                               ' hover:brightness-110 active:scale-[0.97]' +
                               ' transition-all duration-200' +
                               ' shadow-[0_0_20px_-4px_rgba(192,132,252,0.35)]' +
                               ' hover:shadow-[0_0_24px_-2px_rgba(192,132,252,0.45)]">' +
                    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3.5 h-3.5">' +
                        '<path d="M7 3v8M3 7h8"/>' +
                    '</svg>' +
                    'Add Note' +
                '</button>' +
            '</div>' +

        '</div>'
    );
}
