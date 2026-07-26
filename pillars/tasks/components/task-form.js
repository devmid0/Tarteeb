/**
 * Life OS — Task Creation Form
 *
 * Inline expandable form that appears within the task list.
 * It expands from a single-line input into a full form with
 * priority selector, due date, and project assignment.
 *
 * Visual behavior:
 *   1. Collapsed: single "Add a task..." input
 *   2. Focused: expands downward with form fields
 *   3. Submitted: collapses, input clears, task appears in list
 *   4. Escape: collapses without creating
 */

import { PRIORITY } from '../domain/task-rules.js';

/**
 * Create an inline task creation form.
 *
 * @param {Object} opts
 * @param {Array}  opts.projects     — available projects for assignment
 * @param {Function} opts.onSubmit   — called with task data object
 * @returns {HTMLElement}
 */
export function createTaskForm({ projects = [], onSubmit } = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-2';

    let expanded = false;

    /* ── Collapsed state: single input ── */
    const collapsedRow = document.createElement('div');
    collapsedRow.className = [
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        'bg-surface-raised/40 border border-dashed border-white/[0.06]',
        'hover:border-accent-tasks/30 hover:bg-surface-raised/60',
        'transition-all duration-200 cursor-text',
    ].join(' ');

    const plusIcon = document.createElement('span');
    plusIcon.className = 'text-accent-tasks/60 text-lg leading-none select-none';
    plusIcon.textContent = '+';

    const placeholderText = document.createElement('span');
    placeholderText.className = 'text-[13px] text-text-tertiary select-none';
    placeholderText.textContent = 'Add a task…';

    collapsedRow.appendChild(plusIcon);
    collapsedRow.appendChild(placeholderText);

    collapsedRow.addEventListener('click', () => expand());

    /* ── Expanded state: full form ── */
    const expandedForm = document.createElement('div');
    expandedForm.className = [
        'rounded-xl bg-surface-raised border border-white/[0.06]',
        'overflow-hidden max-h-0 opacity-0',
        'transition-all duration-[300ms] ease-[cubic-bezier(0.45,0,0.55,1)]',
    ].join(' ');

    expandedForm.innerHTML = `
        <div class="p-4 space-y-3">
            <!-- Title input -->
            <input type="text"
                   class="task-title-input w-full bg-transparent text-[14px] text-text-primary font-medium
                          placeholder:text-text-disabled focus:outline-none"
                   placeholder="What needs to be done?"
                   maxlength="200"
                   aria-label="Task title">

            <!-- Description -->
            <textarea rows="2"
                      class="task-desc-input w-full bg-transparent text-[12px] text-text-secondary
                             placeholder:text-text-disabled/60 focus:outline-none resize-none"
                      placeholder="Add details (optional)"></textarea>

            <!-- Controls row -->
            <div class="flex items-center gap-2 pt-1 flex-wrap">
                <!-- Priority selector -->
                <div class="relative">
                    <button type="button"
                            class="task-priority-trigger flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                                   text-[11px] font-medium text-text-secondary bg-white/[0.03] hover:bg-white/[0.06]
                                   border border-white/[0.06] transition-colors duration-150"
                            aria-haspopup="listbox">
                        <span class="w-2 h-2 rounded-full bg-yellow-500 task-priority-dot"></span>
                        <span class="task-priority-label">Medium</span>
                        <svg viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3 opacity-50"><path d="M3 5l3 3 3-3"/></svg>
                    </button>
                    <div class="task-priority-dropdown hidden absolute left-0 top-full mt-1 z-10
                                bg-surface-floating rounded-lg shadow-floating border border-white/[0.06]
                                py-1 min-w-[120px]" role="listbox">
                        ${Object.entries(PRIORITY).map(([key, val]) => `
                            <button type="button" role="option" data-priority="${val}"
                                    class="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-secondary
                                           hover:bg-white/[0.06] hover:text-text-primary transition-colors duration-100">
                                <span class="w-2 h-2 rounded-full task-dd-dot" data-priority="${val}"></span>
                                ${key.charAt(0) + key.slice(1).toLowerCase()}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Due date -->
                <input type="date"
                       class="task-due-input bg-transparent text-[11px] text-text-tertiary px-2.5 py-1.5 rounded-lg
                              border border-white/[0.06] hover:border-white/[0.1] focus:outline-none focus:border-accent-tasks/40
                              transition-colors duration-150 [color-scheme:dark]"
                       aria-label="Due date">

                <!-- Time estimate (minutes) -->
                <div class="relative">
                    <input type="number"
                           class="task-time-input bg-transparent text-[11px] text-text-tertiary px-2.5 py-1.5 rounded-lg
                                  border border-white/[0.06] hover:border-white/[0.1] focus:outline-none focus:border-accent-tasks/40
                                  transition-colors duration-150 w-[72px] [color-scheme:dark]"
                           placeholder="min"
                           min="0"
                           step="15"
                           aria-label="Time estimate in minutes">
                </div>

                <!-- Project selector (if projects exist) -->
                ${projects.length > 0 ? `
                <select class="task-project-input bg-transparent text-[11px] text-text-tertiary px-2.5 py-1.5 rounded-lg
                               border border-white/[0.06] hover:border-white/[0.1] focus:outline-none focus:border-accent-tasks/40
                               transition-colors duration-150 [color-scheme:dark]">
                    <option value="">No project</option>
                    ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
                ` : ''}

                <div class="flex-1"></div>

                <!-- Cancel -->
                <button type="button"
                        class="task-cancel-btn px-3 py-1.5 rounded-lg text-[12px] font-medium text-text-tertiary
                               hover:text-text-secondary hover:bg-white/[0.04] transition-colors duration-150">
                    Cancel
                </button>

                <!-- Submit -->
                <button type="button"
                        class="task-submit-btn px-4 py-1.5 rounded-lg text-[12px] font-medium
                               bg-accent-tasks text-white hover:brightness-110
                               transition-all duration-200 shadow-[0_0_12px_rgba(52,211,153,0.15)]">
                    Add
                </button>
            </div>
        </div>
    `;

    /* ── Expand / Collapse Logic ── */

    function expand() {
        if (expanded) return;
        expanded = true;

        collapsedRow.classList.add('hidden');
        expandedForm.classList.remove('max-h-0', 'opacity-0');
        expandedForm.classList.add('max-h-[300px]', 'opacity-100');

        const input = expandedForm.querySelector('.task-title-input');
        requestAnimationFrame(() => input?.focus());
    }

    function collapse() {
        expanded = false;
        expandedForm.classList.add('max-h-0', 'opacity-0');
        expandedForm.classList.remove('max-h-[300px]', 'opacity-100');
        collapsedRow.classList.remove('hidden');

        /* Clear form */
        expandedForm.querySelector('.task-title-input').value = '';
        expandedForm.querySelector('.task-desc-input').value = '';
        expandedForm.querySelector('.task-due-input').value = '';
        expandedForm.querySelector('.task-time-input').value = '';
        setPriority(PRIORITY.MEDIUM);
    }

    /* ── Priority Dropdown Logic ── */

    const PRIORITY_COLORS = {
        [PRIORITY.CRITICAL]: 'bg-red-500',
        [PRIORITY.HIGH]: 'bg-orange-500',
        [PRIORITY.MEDIUM]: 'bg-yellow-500',
        [PRIORITY.LOW]: 'bg-sky-500',
    };

    const PRIORITY_LABELS = {
        [PRIORITY.CRITICAL]: 'Critical',
        [PRIORITY.HIGH]: 'High',
        [PRIORITY.MEDIUM]: 'Medium',
        [PRIORITY.LOW]: 'Low',
    };

    let currentPriority = PRIORITY.MEDIUM;

    function setPriority(p) {
        currentPriority = p;
        const dot = expandedForm.querySelector('.task-priority-dot');
        const label = expandedForm.querySelector('.task-priority-label');
        if (dot) {
            dot.className = `w-2 h-2 rounded-full ${PRIORITY_COLORS[p]} task-priority-dot`;
        }
        if (label) {
            label.textContent = PRIORITY_LABELS[p];
        }
    }

    const trigger = expandedForm.querySelector('.task-priority-trigger');
    const dropdown = expandedForm.querySelector('.task-priority-dropdown');

    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    dropdown?.querySelectorAll('[data-priority]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setPriority(btn.dataset.priority);
            dropdown.classList.add('hidden');
        });
    });

    /* Close dropdown on outside click — scoped to wrapper, not document */
    wrapper.addEventListener('click', function (e) {
        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    /* ── Form Submission ── */

    function gatherFormData() {
        var timeVal = expandedForm.querySelector('.task-time-input').value;
        return {
            title: expandedForm.querySelector('.task-title-input').value.trim(),
            description: expandedForm.querySelector('.task-desc-input').value.trim(),
            priority: currentPriority,
            dueDate: expandedForm.querySelector('.task-due-input').value || null,
            timeEstimate: timeVal ? Number(timeVal) : null,
            projectId: expandedForm.querySelector('.task-project-input')?.value
                ? Number(expandedForm.querySelector('.task-project-input').value)
                : null,
        };
    }

    expandedForm.querySelector('.task-submit-btn')?.addEventListener('click', () => {
        const data = gatherFormData();
        if (!data.title) {
            expandedForm.querySelector('.task-title-input').focus();
            return;
        }
        onSubmit?.(data);
        collapse();
    });

    expandedForm.querySelector('.task-cancel-btn')?.addEventListener('click', collapse);

    /* ── Keyboard shortcuts ── */
    expandedForm.querySelector('.task-title-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            expandedForm.querySelector('.task-submit-btn').click();
        }
        if (e.key === 'Escape') collapse();
    });

    /* ── Assemble ── */
    wrapper.appendChild(collapsedRow);
    wrapper.appendChild(expandedForm);

    return wrapper;
}
