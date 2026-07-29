/**
 * Tarteeb — Link Edit Modal
 *
 * Full link editor rendered into the #modal-portal.
 * Handles URL, title, description, and tags.
 *
 * Lifecycle:
 *   openLinkEditModal(link, onSave, onDelete) — renders + shows
 *   closeLinkEditModal()                      — tears down + removes
 *
 * Design: glassmorphic overlay, centered card, entrance animation.
 */

'use strict';

var _activeModal = null;

/**
 * Show the link edit modal.
 *
 * @param {Object}   link    — full link object
 * @param {Function} onSave  — called with patch { id, ...fields }
 * @param {Function} onDelete — called with link id
 */
export function openLinkEditModal(link, onSave, onDelete) {
    closeLinkEditModal();

    var portal = document.getElementById('modal-portal');
    if (!portal) return;

    var currentTags = Array.isArray(link.tags) ? link.tags.slice() : [];

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
                '<h2 class="text-lg font-heading font-semibold text-text-primary">Edit Link</h2>' +
                '<button class="modal-close-btn p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-white/[0.06] transition-colors">' +
                    '<svg viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>' +
                '</button>' +
            '</div>' +

            /* Form fields */
            '<div class="space-y-4">' +

                /* URL */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">URL</label>' +
                    '<input type="url" class="edit-url w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-finance/50 transition-colors placeholder:text-text-disabled" autocomplete="off" spellcheck="false">' +
                '</div>' +

                /* Title */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Title</label>' +
                    '<input type="text" class="edit-title w-full bg-surface-elevated text-[14px] font-medium text-text-primary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-finance/50 transition-colors placeholder:text-text-disabled" maxlength="200">' +
                '</div>' +

                /* Description */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Description</label>' +
                    '<textarea rows="2" class="edit-desc w-full bg-surface-elevated text-[13px] text-text-secondary px-3 py-2.5 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-finance/50 transition-colors resize-none placeholder:text-text-disabled" maxlength="500"></textarea>' +
                '</div>' +

                /* Tags */
                '<div>' +
                    '<label class="block text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">Tags</label>' +
                    '<div class="edit-tags-display flex flex-wrap gap-1 mb-1.5"></div>' +
                    '<input type="text" class="edit-tag-input w-full bg-surface-elevated text-[12px] text-text-secondary px-3 py-2 rounded-lg border border-white/[0.06] focus:outline-none focus:border-accent-finance/50 transition-colors placeholder:text-text-disabled" placeholder="Add tag and press Enter">' +
                '</div>' +

                /* Timestamps */
                '<div class="flex items-center gap-4 text-[11px] text-text-disabled pt-1">' +
                    '<span>Created: ' + _formatDate(link.createdAt) + '</span>' +
                    '<span>Updated: ' + _formatDate(link.updatedAt) + '</span>' +
                '</div>' +

            '</div>' +

            /* Footer actions */
            '<div class="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.04]">' +
                '<button class="edit-delete-btn px-3 py-2 rounded-lg text-[12px] font-medium text-status-error/70 hover:text-status-error hover:bg-status-error/10 transition-colors">' +
                    'Delete Link' +
                '</button>' +
                '<div class="flex items-center gap-2">' +
                    '<button class="edit-cancel-btn px-4 py-2 rounded-lg text-[13px] font-medium text-text-tertiary hover:text-text-secondary hover:bg-white/[0.04] transition-colors">' +
                        'Cancel' +
                    '</button>' +
                    '<button class="edit-save-btn px-5 py-2 rounded-lg text-[13px] font-medium bg-accent-finance text-white hover:brightness-110 transition-all shadow-[0_0_16px_rgba(96,165,250,0.15)]">' +
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

    var urlInput   = card.querySelector('.edit-url');
    var titleInput = card.querySelector('.edit-title');
    var descInput  = card.querySelector('.edit-desc');
    var tagsDisplay = card.querySelector('.edit-tags-display');
    var tagInput   = card.querySelector('.edit-tag-input');

    urlInput.value   = link.url || '';
    titleInput.value = link.title || '';
    descInput.value  = link.description || '';

    /* ── Tags ── */
    function renderTags() {
        tagsDisplay.innerHTML = '';
        for (var i = 0; i < currentTags.length; i++) {
            (function (idx) {
                var tagEl = document.createElement('span');
                tagEl.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-finance/10 text-accent-finance text-[11px] font-medium';
                tagEl.innerHTML = currentTags[idx] + '<button type="button" class="ml-0.5 hover:text-text-primary transition-colors">&times;</button>';
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

    function close() { closeLinkEditModal(); }

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
        var urlVal   = urlInput.value.trim();
        var titleVal = titleInput.value.trim();

        if (!urlVal) { urlInput.focus(); return; }
        if (!titleVal) { titleInput.focus(); return; }

        var patch = {
            id:          link.id,
            url:         urlVal,
            title:       titleVal,
            description: descInput.value.trim(),
            tags:        currentTags.slice(),
        };

        if (onSave) onSave(patch);
        closeLinkEditModal();
    });

    /* ── Delete ── */

    card.querySelector('.edit-delete-btn').addEventListener('click', function () {
        if (onDelete) onDelete(link.id);
        closeLinkEditModal();
    });

    /* Focus URL on open */
    requestAnimationFrame(function () { urlInput.focus(); urlInput.select(); });
}

/**
 * Close and tear down the active modal.
 */
export function closeLinkEditModal() {
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
