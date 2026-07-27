/**
 * Tarteeb — Note Edit Modal
 *
 * Full note editor rendered into the #modal-portal.
 * Handles title, category, content, tags, and pinned state.
 *
 * Lifecycle:
 *   openNoteEditModal(note, onSave, onDelete) — renders + shows
 *   closeNoteEditModal()                      — tears down + removes
 *
 * Design: glassmorphic overlay, centered card, entrance animation.
 */

'use strict';

import { NOTE_CATEGORIES, CATEGORY_META } from '../domain/knowledge-rules.js';

var _activeModal = null;

/**
 * Show the note edit modal.
 *
 * @param {Object}   note    — full note object
 * @param {Function} onSave  — called with patch { id, ...fields }
 * @param {Function} onDelete — called with note id
 */
export function openNoteEditModal(note, onSave, onDelete) {
    closeNoteEditModal();

    var portal = document.getElementById('modal-portal');
    if (!portal) return;

    var currentCategory = note.category || 'other';
    var currentTags = Array.isArray(note.tags) ? note.tags.slice() : [];

    /* ── Overlay ── */
    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    overlay.style.pointerEvents = 'auto';

    /* ── Backdrop ── */
    var backdrop = document.createElement('div');
    backdrop.className = 'absolute inset-0 bg-black/60 backdrop-blur-sm animate-entrance';

    /* ── Card ── */
    var card = document.createElement('div');
    card.className = [
        'relative bg-surface-raised rounded-2xl shadow-modal w-full max-w-lg',
        'border border-white/[0.06]',
        'animate-entrance',
    ].join(' ');

    card.innerHTML =
        '<div class="p-6">' +

            /* Header */
            '<div class="flex items-center justify-between mb-5">' +
                '<h2 class="text-lg font-heading font-semibold text-text-primary">Edit Note</h2>' +
                '<button class="modal-close-btn p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-colors">' +
                    '<svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>' +
                '</button>' +
            '</div>' +

            /* Form fields */
            '<div class="space-y-4">' +

                /* Title */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Title</label>' +
                    '<input type="text" class="edit-title w-full bg-surface-elevated text-[14px] font-medium text-text-primary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-knowledge/50 transition-colors placeholder:text-text-disabled" maxlength="200">' +
                '</div>' +

                /* Category */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Category</label>' +
                    '<div class="edit-cat-grid flex flex-wrap gap-1.5"></div>' +
                '</div>' +

                /* Content */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Content</label>' +
                    '<textarea rows="5" class="edit-content w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-knowledge/50 transition-colors resize-none placeholder:text-text-disabled" maxlength="10000"></textarea>' +
                '</div>' +

                /* Tags */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Tags</label>' +
                    '<div class="edit-tags-display flex flex-wrap gap-1 mb-1.5"></div>' +
                    '<input type="text" class="edit-tag-input w-full bg-surface-elevated text-[12px] text-text-secondary px-3 py-2 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-knowledge/50 transition-colors placeholder:text-text-disabled" placeholder="Add tag and press Enter">' +
                '</div>' +

                /* Pinned toggle */
                '<div class="flex items-center gap-2">' +
                    '<button type="button" class="edit-pin-toggle flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium border border-white/[0.06] hover:bg-white/[0.04] transition-colors">' +
                        '<svg viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5"><path d="M4.146.146A.5.5 0 014.5 0h7a.5.5 0 01.5.5c0 .68-.342 1.174-.646 1.479-.126.12-.152.23-.152.33v5.37l1.78 2.027a.5.5 0 01-.11.687l-.55.448.18.645a.75.75 0 01-1.179.94L9.5 11.5l-2.34 2.34A.75.75 0 016 13.46l.18-.645-.55-.448a.5.5 0 01-.11-.687L7.21 9.75V4.38c0-.1-.026-.21-.152-.33C6.842 3.774 6.5 3.28 6.5 2.6v-.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v.5c0 .28-.158.574-.454.82-.074.064-.1.117-.1.17v5.63l-1.585-1.79a.5.5 0 01-.11-.687l.55-.448-.18-.645a.75.75 0 011.179-.94L10 4.5l2.34-2.34a.75.75 0 011.06 0l.5.5"/></svg>' +
                        '<span class="pin-label">Pin to top</span>' +
                    '</button>' +
                '</div>' +

                /* Timestamps */
                '<div class="flex items-center gap-4 text-[11px] text-text-disabled pt-1">' +
                    '<span>Created: ' + _formatDate(note.createdAt) + '</span>' +
                    '<span>Updated: ' + _formatDate(note.updatedAt) + '</span>' +
                '</div>' +

            '</div>' +

            /* Footer actions */
            '<div class="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">' +
                '<button class="edit-delete-btn px-3 py-2 rounded-lg text-[12px] font-medium text-status-error/70 hover:text-status-error hover:bg-status-error/10 transition-colors">' +
                    'Delete Note' +
                '</button>' +
                '<div class="flex items-center gap-2">' +
                    '<button class="edit-cancel-btn px-4 py-2 rounded-lg text-[13px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-colors">' +
                        'Cancel' +
                    '</button>' +
                    '<button class="edit-save-btn px-5 py-2 rounded-lg text-[13px] font-medium bg-accent-knowledge text-white hover:brightness-110 transition-all shadow-[0_0_16px_rgba(192,132,252,0.15)]">' +
                        'Save Changes' +
                    '</button>' +
                '</div>' +
            '</div>';

    overlay.appendChild(backdrop);
    overlay.appendChild(card);
    portal.appendChild(overlay);
    portal.style.pointerEvents = 'auto';

    _activeModal = overlay;

    /* ── Populate fields ── */

    var titleInput   = card.querySelector('.edit-title');
    var contentInput = card.querySelector('.edit-content');
    var catGrid      = card.querySelector('.edit-cat-grid');
    var tagsDisplay  = card.querySelector('.edit-tags-display');
    var tagInput     = card.querySelector('.edit-tag-input');
    var pinToggle    = card.querySelector('.edit-pin-toggle');
    var pinLabel     = card.querySelector('.pin-label');

    titleInput.value   = note.title || '';
    contentInput.value = note.content || '';

    /* ── Pin state ── */
    var isPinned = !!note.isPinned;
    function updatePinUI() {
        if (isPinned) {
            pinToggle.className = 'edit-pin-toggle flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium border border-accent-knowledge/30 bg-accent-knowledge/10 text-accent-knowledge transition-colors';
            pinLabel.textContent = 'Pinned';
        } else {
            pinToggle.className = 'edit-pin-toggle flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium border border-white/[0.06] hover:bg-white/[0.04] text-text-tertiary transition-colors';
            pinLabel.textContent = 'Pin to top';
        }
    }
    updatePinUI();

    pinToggle.addEventListener('click', function () {
        isPinned = !isPinned;
        updatePinUI();
    });

    /* ── Category grid ── */
    function renderCatGrid() {
        catGrid.innerHTML = '';
        for (var i = 0; i < NOTE_CATEGORIES.length; i++) {
            (function (catKey) {
                var meta = CATEGORY_META[catKey] || CATEGORY_META.other;
                var isActive = catKey === currentCategory;

                var chip = document.createElement('button');
                chip.type = 'button';
                chip.dataset.cat = catKey;
                chip.className = [
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium',
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
                    currentCategory = catKey;
                    renderCatGrid();
                });

                catGrid.appendChild(chip);
            })(NOTE_CATEGORIES[i]);
        }
    }
    renderCatGrid();

    /* ── Tags ── */
    function renderTags() {
        tagsDisplay.innerHTML = '';
        for (var i = 0; i < currentTags.length; i++) {
            (function (idx) {
                var tagEl = document.createElement('span');
                tagEl.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-knowledge/10 text-accent-knowledge text-[11px] font-medium';
                tagEl.innerHTML = currentTags[idx] + '<button type="button" class="ml-0.5 hover:text-white transition-colors">&times;</button>';
                tagEl.querySelector('button').addEventListener('click', function (e) {
                    e.stopPropagation();
                    currentTags.splice(idx, 1);
                    renderTags();
                });
                tagsDisplay.appendChild(tagEl);
            })(i);
        }
    }
    renderTags();

    tagInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            var raw = tagInput.value.trim().toLowerCase();
            if (raw.length > 0 && currentTags.indexOf(raw) === -1) {
                currentTags.push(raw);
                renderTags();
            }
            tagInput.value = '';
        }
    });
    tagInput.addEventListener('blur', function () {
        var raw = tagInput.value.trim().toLowerCase();
        if (raw.length > 0 && currentTags.indexOf(raw) === -1) {
            currentTags.push(raw);
            renderTags();
        }
        tagInput.value = '';
    });

    /* ── Close handlers ── */

    function close() { closeNoteEditModal(); }

    card.querySelector('.modal-close-btn').addEventListener('click', close);
    card.querySelector('.edit-cancel-btn').addEventListener('click', close);
    backdrop.addEventListener('click', close);

    document.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', handler);
        }
    });

    /* ── Save ── */

    card.querySelector('.edit-save-btn').addEventListener('click', function () {
        var titleVal = titleInput.value.trim();
        if (!titleVal) {
            titleInput.focus();
            return;
        }

        var patch = {
            id:        note.id,
            title:     titleVal,
            content:   contentInput.value,
            category:  currentCategory,
            tags:      currentTags.slice(),
            isPinned:  isPinned,
        };

        if (onSave) onSave(patch);
        closeNoteEditModal();
    });

    /* ── Delete ── */

    card.querySelector('.edit-delete-btn').addEventListener('click', function () {
        if (onDelete) onDelete(note.id);
        closeNoteEditModal();
    });

    /* Focus title on open */
    requestAnimationFrame(function () { titleInput.focus(); titleInput.select(); });
}

/**
 * Close and tear down the active modal.
 */
export function closeNoteEditModal() {
    if (_activeModal) {
        _activeModal.remove();
        _activeModal = null;
    }
    var portal = document.getElementById('modal-portal');
    if (portal) {
        portal.style.pointerEvents = 'none';
    }
}

/* ── Helpers ── */

function _formatDate(iso) {
    if (!iso) return '\u2014';
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    } catch (e) {
        return '\u2014';
    }
}
