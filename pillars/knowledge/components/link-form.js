/**
 * Tarteeb — Link Form
 *
 * Premium inline expandable form for saving links.
 * Collapses into a single-row prompt; expands into a polished
 * form with URL input, title, description, tag input, and keyboard-first submission.
 */

export function createLinkForm(opts) {
    var onSubmit = opts && opts.onSubmit;

    var wrapper = document.createElement('div');
    wrapper.className = 'mb-3';

    var expanded    = false;
    var currentTags = [];

    /* ── Collapsed Trigger ───────────────────────────────── */

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = [
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl',
        'bg-surface-raised/30 border border-dashed border-white/[0.06]',
        'hover:border-accent-finance/25 hover:bg-surface-raised/50',
        'focus:outline-none focus:border-accent-finance/40 focus:bg-surface-raised/50',
        'transition-all duration-200 group',
    ].join(' ');

    trigger.innerHTML =
        '<span class="flex-shrink-0 w-7 h-7 rounded-lg bg-accent-finance/10 flex items-center justify-center' +
                ' text-accent-finance text-[15px] font-medium leading-none' +
                ' group-hover:bg-accent-finance/15 transition-colors duration-200">+</span>' +
        '<span class="text-[13px] text-text-tertiary group-hover:text-text-secondary transition-colors duration-200 select-none">' +
            'Save a link\u2026' +
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
        panel.classList.add('max-h-[500px]', 'opacity-100');
        var urlInput = panel.querySelector('.l-url');
        if (urlInput) requestAnimationFrame(function () { urlInput.focus(); });
    }

    function collapse() {
        expanded = false;
        panel.classList.add('max-h-0', 'opacity-0');
        panel.classList.remove('max-h-[500px]', 'opacity-100');
        trigger.classList.remove('hidden');
        _resetForm();
    }

    /* ── Tag Input ───────────────────────────────────────── */

    function _renderTags() {
        var container = panel.querySelector('.l-tags-display');
        if (!container) return;
        container.innerHTML = '';
        for (var i = 0; i < currentTags.length; i++) {
            (function (idx) {
                var tagEl = document.createElement('span');
                tagEl.className = [
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded',
                    'bg-accent-finance/10 text-accent-finance text-[11px] font-medium',
                ].join(' ');
                tagEl.innerHTML =
                    currentTags[idx] +
                    '<button type="button" class="ml-0.5 hover:text-white transition-colors" aria-label="Remove tag">&times;</button>';
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
        var input = panel.querySelector('.l-tag-input');
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
        var urlEl   = panel.querySelector('.l-url');
        var titleEl = panel.querySelector('.l-title');
        var descEl  = panel.querySelector('.l-desc');
        if (urlEl)   urlEl.value = '';
        if (titleEl) titleEl.value = '';
        if (descEl)  descEl.value = '';
        currentTags = [];
        _renderTags();
    }

    function _gather() {
        var urlEl   = panel.querySelector('.l-url');
        var titleEl = panel.querySelector('.l-title');
        var descEl  = panel.querySelector('.l-desc');
        return {
            url:         urlEl ? urlEl.value.trim() : '',
            title:       titleEl ? titleEl.value.trim() : '',
            description: descEl ? descEl.value.trim() : '',
            tags:        currentTags.slice(),
        };
    }

    function _submit() {
        var data = _gather();
        if (!data.url) {
            var u = panel.querySelector('.l-url');
            if (u) { u.focus(); u.classList.add('ring-2', 'ring-status-error/40'); setTimeout(function () { u.classList.remove('ring-2', 'ring-status-error/40'); }, 600); }
            return;
        }
        if (!data.title) {
            var t = panel.querySelector('.l-title');
            if (t) { t.focus(); t.classList.add('ring-2', 'ring-status-error/40'); setTimeout(function () { t.classList.remove('ring-2', 'ring-status-error/40'); }, 600); }
            return;
        }
        if (onSubmit) onSubmit(data);
        collapse();
    }

    /* ── Wire Events ─────────────────────────────────────── */

    var urlInput = panel.querySelector('.l-url');
    if (urlInput) {
        urlInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var titleInput = panel.querySelector('.l-title');
                if (titleInput) titleInput.focus();
            }
            if (e.key === 'Escape') collapse();
        });
    }

    var titleInput = panel.querySelector('.l-title');
    if (titleInput) {
        titleInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); _submit(); }
            if (e.key === 'Escape') collapse();
        });
    }

    var descInput = panel.querySelector('.l-desc');
    if (descInput) {
        descInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') collapse();
        });
    }

    /* Tag input */
    var tagInput = panel.querySelector('.l-tag-input');
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
    var submitBtn = panel.querySelector('.l-submit');
    var cancelBtn = panel.querySelector('.l-cancel');
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

            /* ── URL ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">URL</label>' +
                '<input type="url"' +
                       ' class="l-url w-full bg-surface-elevated text-[13px] text-text-secondary' +
                              ' px-3 py-2.5 rounded-lg border border-white/[0.06]' +
                              ' hover:border-white/[0.1] focus:outline-none' +
                              ' focus:border-accent-finance/40 transition-colors duration-150' +
                              ' placeholder:text-text-disabled/50"' +
                       ' placeholder="https://example.com"' +
                       ' autocomplete="off" spellcheck="false">' +
            '</div>' +

            /* ── Title ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Title</label>' +
                '<input type="text"' +
                       ' class="l-title w-full bg-surface-elevated text-[14px] font-medium text-text-primary' +
                              ' px-3 py-2.5 rounded-lg border border-white/[0.06]' +
                              ' hover:border-white/[0.1] focus:outline-none' +
                              ' focus:border-accent-finance/40 transition-colors duration-150' +
                              ' placeholder:text-text-disabled/50"' +
                       ' placeholder="Link title"' +
                       ' maxlength="200">' +
            '</div>' +

            /* ── Description ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Description</label>' +
                '<textarea rows="2"' +
                    ' class="l-desc w-full bg-surface-elevated text-[13px] text-text-secondary' +
                           ' px-3 py-2.5 rounded-lg border border-white/[0.06]' +
                           ' hover:border-white/[0.1] focus:outline-none' +
                           ' focus:border-accent-finance/40 transition-colors duration-150' +
                           ' resize-none placeholder:text-text-disabled/50"' +
                    ' placeholder="Optional description"' +
                    ' maxlength="500"></textarea>' +
            '</div>' +

            /* ── Tags ── */
            '<div>' +
                '<label class="block text-[10px] font-semibold text-text-disabled uppercase tracking-widest mb-1.5">Tags</label>' +
                '<div class="l-tags-display flex flex-wrap gap-1 mb-1.5"></div>' +
                '<input type="text"' +
                       ' class="l-tag-input w-full bg-surface-elevated text-[12px] text-text-secondary' +
                              ' px-3 py-2 rounded-lg border border-white/[0.06]' +
                              ' hover:border-white/[0.1] focus:outline-none' +
                              ' focus:border-accent-finance/40 transition-colors duration-150' +
                              ' placeholder:text-text-disabled/50"' +
                       ' placeholder="Add tag and press Enter">' +
            '</div>' +

            /* ── Actions ── */
            '<div class="flex items-center gap-2 pt-1">' +
                '<div class="flex-1"></div>' +
                '<button type="button"' +
                        ' class="l-cancel px-3.5 py-2 rounded-lg text-[12px] font-medium text-text-tertiary' +
                               ' hover:text-text-secondary hover:bg-white/[0.04] transition-colors duration-150">' +
                    'Cancel' +
                '</button>' +
                '<button type="button"' +
                        ' class="l-submit inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-semibold' +
                               ' bg-accent-finance text-white' +
                               ' hover:brightness-110 active:scale-[0.97]' +
                               ' transition-all duration-200' +
                               ' shadow-[0_0_20px_-4px_rgba(96,165,250,0.35)]' +
                               ' hover:shadow-[0_0_24px_-2px_rgba(96,165,250,0.45)]">' +
                    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3.5 h-3.5">' +
                        '<path d="M7 3v8M3 7h8"/>' +
                    '</svg>' +
                    'Save Link' +
                '</button>' +
            '</div>' +

        '</div>'
    );
}
