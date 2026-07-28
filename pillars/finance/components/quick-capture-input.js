/**
 * Tarteeb — Quick Capture Input
 *
 * Fintech-style massive number input with one-tap category pills.
 * Replaces traditional transaction form with a frictionless flow:
 *   1. User types a number (huge, centered, borderless)
 *   2. User taps a category pill
 *   3. Transaction saved instantly, input clears
 */

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_META, TX_TYPE } from '../domain/finance-rules.js';

export function createQuickCaptureInput(opts) {
    var onSubmit = opts && opts.onSubmit;
    var currentType = opts && opts.initialType || TX_TYPE.EXPENSE;

    var root = document.createElement('div');
    root.className = 'qc-input-root';

    /* ── Type Toggle (Expense / Income) ── */
    var typeToggle = document.createElement('div');
    typeToggle.className = 'qc-type-toggle';
    typeToggle.innerHTML =
        '<button type="button" class="qc-type-btn is-active" data-type="expense">' +
            '<span class="qc-type-dot qc-type-dot--expense"></span>' +
            '<span>Expense</span>' +
        '</button>' +
        '<button type="button" class="qc-type-btn" data-type="income">' +
            '<span class="qc-type-dot qc-type-dot--income"></span>' +
            '<span>Income</span>' +
        '</button>';

    /* ── Massive Number Input ── */
    var inputWrap = document.createElement('div');
    inputWrap.className = 'qc-amount-wrap';

    inputWrap.innerHTML =
        '<span class="qc-currency-symbol">$</span>' +
        '<input type="number"' +
               ' class="qc-amount-input"' +
               ' placeholder="0"' +
               ' min="0" step="0.01"' +
               ' inputmode="decimal"' +
               ' autocomplete="off"' +
               ' aria-label="Amount">';

    /* ── Live Preview ── */
    var preview = document.createElement('div');
    preview.className = 'qc-preview';
    preview.textContent = '';

    /* ── Divider ── */
    var divider = document.createElement('div');
    divider.className = 'qc-divider';

    /* ── Category Pills Container ── */
    var pillsWrap = document.createElement('div');
    pillsWrap.className = 'qc-pills-wrap';

    var pillsContainer = document.createElement('div');
    pillsContainer.className = 'qc-pills-scroll';
    pillsWrap.appendChild(pillsContainer);

    /* ── Internal State ── */
    var selectedType = currentType;
    var selectedCategory = null;

    function getCategories() {
        return selectedType === TX_TYPE.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    }

    /* ── Render Category Pills ── */
    function renderPills() {
        pillsContainer.innerHTML = '';
        var cats = getCategories();

        for (var i = 0; i < cats.length; i++) {
            (function (catKey) {
                var meta = CATEGORY_META[catKey] || CATEGORY_META.other;
                var pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'qc-pill';
                pill.dataset.category = catKey;
                pill.innerHTML =
                    '<span class="qc-pill-icon">' + meta.icon + '</span>' +
                    '<span class="qc-pill-label">' + meta.label.split(' ')[0] + '</span>';

                pill.addEventListener('click', function () {
                    handlePillClick(catKey, pill);
                });

                pillsContainer.appendChild(pill);
            })(cats[i]);
        }

        selectedCategory = null;
    }

    /* ── Handle Pill Click ── */
    function handlePillClick(category, pillElement) {
        var amount = parseFloat(inputWrap.querySelector('.qc-amount-input').value);

        if (!amount || amount <= 0) {
            /* Shake the input to indicate error */
            var input = inputWrap.querySelector('.qc-amount-input');
            input.classList.add('qc-shake');
            setTimeout(function () { input.classList.remove('qc-shake'); }, 400);
            input.focus();
            return;
        }

        /* Bounce animation on pill */
        pillElement.classList.add('qc-pill--clicked');
        setTimeout(function () {
            pillElement.classList.remove('qc-pill--clicked');
        }, 200);

        /* Flash success on the amount */
        var amountEl = inputWrap.querySelector('.qc-amount-input');
        amountEl.classList.add('qc-success-flash');
        setTimeout(function () { amountEl.classList.remove('qc-success-flash'); }, 300);

        /* Submit the transaction */
        var data = {
            amount: amount,
            type: selectedType,
            category: category,
            date: new Date().toISOString().slice(0, 10),
            description: '',
        };

        if (onSubmit) onSubmit(data);

        /* Clear input */
        amountEl.value = '';
        preview.textContent = '';
        selectedCategory = null;

        /* Re-focus input for rapid entry */
        requestAnimationFrame(function () { amountEl.focus(); });
    }

    /* ── Wire Type Toggle ── */
    var typeBtns = typeToggle.querySelectorAll('.qc-type-btn');
    for (var t = 0; t < typeBtns.length; t++) {
        (function (btn) {
            btn.addEventListener('click', function () {
                selectedType = btn.dataset.type;
                var allBtns = typeToggle.querySelectorAll('.qc-type-btn');
                for (var j = 0; j < allBtns.length; j++) {
                    allBtns[j].classList.toggle('is-active', allBtns[j].dataset.type === selectedType);
                }
                renderPills();
            });
        })(typeBtns[t]);
    }

    /* ── Wire Amount Input ── */
    var amountInput = inputWrap.querySelector('.qc-amount-input');
    amountInput.addEventListener('input', function () {
        var v = parseFloat(amountInput.value);
        if (!isNaN(v) && v > 0) {
            preview.textContent = '= $' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            preview.textContent = '';
        }
    });

    amountInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            /* If there's a selected pill, use it; otherwise focus first pill */
            if (selectedCategory) {
                var catBtn = pillsContainer.querySelector('[data-category="' + selectedCategory + '"]');
                if (catBtn) handlePillClick(selectedCategory, catBtn);
            } else {
                var firstPill = pillsContainer.querySelector('.qc-pill');
                if (firstPill) firstPill.click();
            }
        }
    });

    /* ── Assemble ── */
    root.appendChild(typeToggle);
    root.appendChild(inputWrap);
    root.appendChild(preview);
    root.appendChild(divider);
    root.appendChild(pillsWrap);

    renderPills();

    /* Auto-focus on mount */
    requestAnimationFrame(function () { amountInput.focus(); });

    /* Expose focus method */
    root.focus = function () { amountInput.focus(); };

    return root;
}
