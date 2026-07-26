/**
 * Life OS — Habit Creation Form
 *
 * Inline expandable form that appears within the habit list.
 * It expands from a single-line trigger into a full form with
 * name, icon, category, and frequency settings.
 *
 * Visual behavior:
 *   1. Collapsed: dashed-border "Add a habit..." trigger
 *   2. Focused: expands downward with form fields
 *   3. Submitted: collapses, inputs clear, habit appears in list
 *   4. Escape: collapses without creating
 *
 * Factory signature:
 *   createHabitForm(opts) → HTMLElement
 *
 * opts:
 *   categories  {string[]}  — existing habit categories for autocomplete
 *   onSubmit    {Function(data)} — called with habit data object
 */

'use strict';

import { FREQUENCY, FREQUENCY_LABELS, DAY_LABELS } from '../state/habit-store.js';

/* ── SVG Icons ───────────────────────────────────────────── */

var SVG_PLUS = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-4 h-4">' +
    '<path d="M7 3v8M3 7h8"/></svg>';

var SVG_CHEVRON = '<svg viewBox="0 0 12 12" fill="currentColor" class="w-2.5 h-2.5"><path d="M3 5l3 3 3-3"/></svg>';

/* ── Default icon pool ───────────────────────────────────── */

var ICON_POOL = [
    '✅', '💪', '🏃', '📖', '🧘', '💧', '🥗', '😴',
    '🎨', '💻', '✍️', '🎵', '🧹', '💊', '🌅', '📝',
    '🧠', '🎯', '📞', '🙏', '🌿', '💰', '🚗', '🏋️',
];

/* ── Factory ─────────────────────────────────────────────── */

export function createHabitForm(opts) {
    var o = opts || {};
    var existingCategories = o.categories || [];

    var wrapper = document.createElement('div');
    wrapper.className = 'mb-4';

    var expanded = false;

    /* ── Collapsed state: single trigger ── */
    var collapsedRow = document.createElement('div');
    collapsedRow.className = [
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        'bg-surface-raised/40 border border-dashed border-white/[0.06]',
        'hover:border-accent-habits/30 hover:bg-surface-raised/60',
        'transition-all duration-200 cursor-text',
    ].join(' ');

    var plusIcon = document.createElement('span');
    plusIcon.className = 'text-accent-habits/60';
    plusIcon.innerHTML = SVG_PLUS;

    var placeholderText = document.createElement('span');
    placeholderText.className = 'text-[13px] text-text-tertiary select-none';
    placeholderText.textContent = 'Add a habit\u2026';

    collapsedRow.appendChild(plusIcon);
    collapsedRow.appendChild(placeholderText);
    collapsedRow.addEventListener('click', function () { expand(); });

    /* ── Expanded state: full form ── */
    var expandedForm = document.createElement('div');
    expandedForm.className = [
        'rounded-xl bg-surface-raised border border-white/[0.06]',
        'overflow-hidden max-h-0 opacity-0',
        'transition-all duration-[300ms] ease-[cubic-bezier(0.45,0,0.55,1)]',
    ].join(' ');

    var formInner = document.createElement('div');
    formInner.className = 'p-4 space-y-3';

    /* Row 1: Name + Icon */
    var row1 = document.createElement('div');
    row1.className = 'flex items-center gap-3';

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = [
        'flex-1 bg-transparent text-[14px] text-text-primary font-medium',
        'placeholder:text-text-disabled focus:outline-none',
    ].join(' ');
    nameInput.placeholder = 'Habit name\u2026';
    nameInput.maxLength = 100;

    /* Icon trigger */
    var iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.className = [
        'w-9 h-9 rounded-lg flex items-center justify-center text-lg',
        'bg-white/[0.04] hover:bg-white/[0.08]',
        'border border-white/[0.06] transition-colors duration-150',
    ].join(' ');
    iconBtn.textContent = '✅';
    iconBtn.title = 'Pick an icon';

    /* Icon picker dropdown */
    var iconDropdown = document.createElement('div');
    iconDropdown.className = [
        'hidden absolute left-0 top-full mt-1 z-20',
        'bg-surface-floating rounded-xl shadow-floating border border-white/[0.08]',
        'p-2 grid grid-cols-8 gap-1',
    ].join(' ');

    var selectedIcon = '✅';

    for (var ic = 0; ic < ICON_POOL.length; ic++) {
        (function (emoji) {
            var ib = document.createElement('button');
            ib.type = 'button';
            ib.className = 'w-7 h-7 rounded flex items-center justify-center text-sm hover:bg-white/[0.08] transition-colors';
            ib.textContent = emoji;
            ib.addEventListener('click', function (e) {
                e.stopPropagation();
                selectedIcon = emoji;
                iconBtn.textContent = emoji;
                iconDropdown.classList.add('hidden');
            });
            iconDropdown.appendChild(ib);
        })(ICON_POOL[ic]);
    }

    var iconWrap = document.createElement('div');
    iconWrap.className = 'relative';
    iconWrap.appendChild(iconBtn);
    iconWrap.appendChild(iconDropdown);

    iconBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        iconDropdown.classList.toggle('hidden');
    });

    row1.appendChild(nameInput);
    row1.appendChild(iconWrap);

    /* Row 2: Category + Frequency */
    var row2 = document.createElement('div');
    row2.className = 'flex items-center gap-2 flex-wrap';

    var categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.className = [
        'flex-1 min-w-[100px] bg-transparent text-[12px] text-text-secondary',
        'px-2.5 py-1.5 rounded-lg',
        'border border-white/[0.06] hover:border-white/[0.1]',
        'focus:outline-none focus:border-accent-habits/40',
        'transition-colors duration-150',
        'placeholder:text-text-disabled/50',
    ].join(' ');
    categoryInput.placeholder = 'Category';
    categoryInput.maxLength = 50;

    /* Frequency selector */
    var freqWrap = document.createElement('div');
    freqWrap.className = 'relative';

    var freqBtn = document.createElement('button');
    freqBtn.type = 'button';
    freqBtn.className = [
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium',
        'text-text-secondary bg-white/[0.03] hover:bg-white/[0.06]',
        'border border-white/[0.06] transition-colors duration-150',
    ].join(' ');
    freqBtn.innerHTML = '<span class="freq-label">Daily</span>' + SVG_CHEVRON;

    var freqDropdown = document.createElement('div');
    freqDropdown.className = [
        'hidden absolute left-0 top-full mt-1 z-20',
        'bg-surface-floating rounded-lg shadow-floating border border-white/[0.06]',
        'py-1 min-w-[120px]',
    ].join(' ');

    var freqKeys = ['daily', 'weekly', 'monthly'];
    var currentFreq = 'daily';

    for (var fi = 0; fi < freqKeys.length; fi++) {
        (function (key) {
            var fItem = document.createElement('button');
            fItem.type = 'button';
            fItem.className = [
                'w-full text-left px-3 py-1.5 text-[12px]',
                'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary',
                'transition-colors duration-100',
            ].join(' ');
            fItem.textContent = FREQUENCY_LABELS[key];
            fItem.addEventListener('click', function (e) {
                e.stopPropagation();
                currentFreq = key;
                freqBtn.querySelector('.freq-label').textContent = FREQUENCY_LABELS[key];
                freqDropdown.classList.add('hidden');
                _renderFrequencyOptions();
            });
            freqDropdown.appendChild(fItem);
        })(freqKeys[fi]);
    }

    freqBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        freqDropdown.classList.toggle('hidden');
    });

    freqWrap.appendChild(freqBtn);
    freqWrap.appendChild(freqDropdown);

    row2.appendChild(categoryInput);
    row2.appendChild(freqWrap);

    /* Row 3: Frequency-specific options (dynamic) */
    var freqOptionsSlot = document.createElement('div');
    freqOptionsSlot.className = 'freq-options-slot';

    /* Weekly day toggles */
    var weeklyDays = [];

    function _renderFrequencyOptions() {
        freqOptionsSlot.innerHTML = '';

        if (currentFreq === 'weekly') {
            weeklyDays = [];
            var dayRow = document.createElement('div');
            dayRow.className = 'flex items-center gap-1.5';

            var dayLabel = document.createElement('span');
            dayLabel.className = 'text-[11px] text-text-disabled mr-1';
            dayLabel.textContent = 'On:';
            dayRow.appendChild(dayLabel);

            for (var di = 0; di < 7; di++) {
                (function (dayIdx) {
                    var dayBtn = document.createElement('button');
                    dayBtn.type = 'button';
                    dayBtn.className = [
                        'w-7 h-7 rounded-full text-[10px] font-medium',
                        'border border-white/[0.06]',
                        'text-text-tertiary hover:text-text-secondary hover:border-white/[0.12]',
                        'transition-all duration-150',
                    ].join(' ');
                    dayBtn.textContent = DAY_LABELS[dayIdx].charAt(0);
                    dayBtn.title = DAY_LABELS[dayIdx];

                    dayBtn.addEventListener('click', function () {
                        var idx = weeklyDays.indexOf(dayIdx);
                        if (idx !== -1) {
                            weeklyDays.splice(idx, 1);
                            dayBtn.classList.remove('bg-accent-habits/20', 'text-accent-habits', 'border-accent-habits/30');
                            dayBtn.classList.add('text-text-tertiary');
                        } else {
                            weeklyDays.push(dayIdx);
                            dayBtn.classList.add('bg-accent-habits/20', 'text-accent-habits', 'border-accent-habits/30');
                            dayBtn.classList.remove('text-text-tertiary');
                        }
                    });

                    dayRow.appendChild(dayBtn);
                })(di);
            }

            freqOptionsSlot.appendChild(dayRow);
        }

        if (currentFreq === 'monthly') {
            var monthRow = document.createElement('div');
            monthRow.className = 'flex items-center gap-2';

            var mLabel = document.createElement('span');
            mLabel.className = 'text-[11px] text-text-disabled';
            mLabel.textContent = 'Day of month:';
            monthRow.appendChild(mLabel);

            var monthInput = document.createElement('input');
            monthInput.type = 'number';
            monthInput.min = '1';
            monthInput.max = '31';
            monthInput.value = '1';
            monthInput.className = [
                'w-14 bg-transparent text-[12px] text-text-secondary text-center',
                'px-1 py-1 rounded-lg',
                'border border-white/[0.06] hover:border-white/[0.1]',
                'focus:outline-none focus:border-accent-habits/40',
                'transition-colors duration-150 [color-scheme:dark]',
                ' [appearance:textfield]',
                ' [&::-webkit-outer-spin-button]:appearance-none',
                ' [&::-webkit-inner-spin-button]:appearance-none',
            ].join(' ');
            monthInput.dataset.role = 'monthly-day';
            monthRow.appendChild(monthInput);

            freqOptionsSlot.appendChild(monthRow);
        }
    }

    _renderFrequencyOptions();

    /* Row 4: Actions */
    var row4 = document.createElement('div');
    row4.className = 'flex items-center justify-end gap-2 pt-1';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = [
        'px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-tertiary',
        'hover:text-text-secondary hover:bg-white/[0.04]',
        'transition-colors duration-150',
    ].join(' ');
    cancelBtn.textContent = 'Cancel';

    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = [
        'px-4 py-1.5 rounded-lg text-[12px] font-medium',
        'bg-accent-habits text-white hover:brightness-110',
        'transition-all duration-200 shadow-[0_0_12px_rgba(251,146,60,0.15)]',
    ].join(' ');
    submitBtn.textContent = 'Create';

    row4.appendChild(cancelBtn);
    row4.appendChild(submitBtn);

    /* Assemble form */
    formInner.appendChild(row1);
    formInner.appendChild(row2);
    formInner.appendChild(freqOptionsSlot);
    formInner.appendChild(row4);
    expandedForm.appendChild(formInner);

    /* ── Expand / Collapse ── */

    function expand() {
        if (expanded) return;
        expanded = true;
        collapsedRow.classList.add('hidden');
        expandedForm.classList.remove('max-h-0', 'opacity-0');
        expandedForm.classList.add('max-h-[350px]', 'opacity-100');
        requestAnimationFrame(function () { nameInput.focus(); });
    }

    function collapse() {
        expanded = false;
        expandedForm.classList.add('max-h-0', 'opacity-0');
        expandedForm.classList.remove('max-h-[350px]', 'opacity-100');
        collapsedRow.classList.remove('hidden');
        _resetForm();
    }

    function _resetForm() {
        nameInput.value = '';
        categoryInput.value = '';
        selectedIcon = '✅';
        iconBtn.textContent = '✅';
        currentFreq = 'daily';
        freqBtn.querySelector('.freq-label').textContent = 'Daily';
        weeklyDays = [];
        _renderFrequencyOptions();
    }

    /* ── Gather Form Data ── */

    function gatherData() {
        var data = {
            name:      nameInput.value.trim(),
            icon:      selectedIcon,
            category:  categoryInput.value.trim() || 'other',
            frequency: currentFreq,
        };

        if (currentFreq === 'weekly') {
            data.frequencyDays = weeklyDays.slice().sort();
        }

        if (currentFreq === 'monthly') {
            var mDay = expandedForm.querySelector('[data-role="monthly-day"]');
            data.frequencyDay = mDay ? parseInt(mDay.value) || 1 : 1;
        }

        return data;
    }

    /* ── Submit ── */

    submitBtn.addEventListener('click', function () {
        var data = gatherData();
        if (!data.name) {
            nameInput.focus();
            return;
        }
        if (currentFreq === 'weekly' && (!data.frequencyDays || data.frequencyDays.length === 0)) {
            return; /* Must select at least one day */
        }
        if (o.onSubmit) o.onSubmit(data);
        collapse();
    });

    cancelBtn.addEventListener('click', collapse);

    nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitBtn.click(); }
        if (e.key === 'Escape') collapse();
    });

    /* ── Close icon dropdown on outside click ── */
    wrapper.addEventListener('click', function (e) {
        if (!iconWrap.contains(e.target)) {
            iconDropdown.classList.add('hidden');
        }
        if (!freqWrap.contains(e.target)) {
            freqDropdown.classList.add('hidden');
        }
    });

    /* ── Assemble ── */
    wrapper.appendChild(collapsedRow);
    wrapper.appendChild(expandedForm);

    return wrapper;
}
