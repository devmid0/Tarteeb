/**
 * Tarteeb — UI Atoms
 * 
 * Foundational presentational components.
 * These are pillar-agnostic and provide the building blocks for all views.
 * 
 * Components:
 * - Button (primary, secondary, tertiary)
 * - Input (with floating label)
 * - Card
 * - Badge
 * - Modal
 * - Toast
 */

/**
 * Create a button element
 * @param {Object} options
 * @param {string} options.text - Button label
 * @param {'primary'|'secondary'|'tertiary'} options.variant - Button style
 * @param {string} options.color - Pillar accent color class
 * @param {Function} options.onClick - Click handler
 * @param {boolean} options.disabled - Disabled state
 * @returns {HTMLElement}
 */
export function createButton({ 
    text, 
    variant = 'primary', 
    color = 'accent-finance',
    onClick, 
    disabled = false 
}) {
    const button = document.createElement('button');
    
    const baseClasses = 'px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-canvas';
    
    const variantClasses = {
        primary: `bg-${color} text-white hover:opacity-90 focus:ring-${color}`,
        secondary: `bg-transparent border border-text-tertiary text-text-secondary hover:border-text-secondary hover:text-text-primary focus:ring-text-tertiary`,
        tertiary: `bg-transparent text-${color} hover:underline focus:ring-${color}`,
    };
    
    button.className = `${baseClasses} ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;
    button.textContent = text;
    button.disabled = disabled;
    
    if (onClick && !disabled) {
        button.addEventListener('click', onClick);
    }
    
    return button;
}

/**
 * Create an input element with floating label
 * @param {Object} options
 * @param {string} options.label - Input label
 * @param {string} options.type - Input type
 * @param {string} options.value - Initial value
 * @param {Function} options.onChange - Change handler
 * @param {string} options.error - Error message
 * @returns {HTMLElement}
 */
export function createInput({ 
    label, 
    type = 'text', 
    value = '', 
    onChange,
    error = null 
}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.className = `w-full px-0 py-2 bg-transparent border-0 border-b-2 border-text-tertiary text-text-primary text-sm focus:outline-none focus:border-accent-finance transition-colors duration-200 peer`;
    input.placeholder = ' ';
    
    const labelEl = document.createElement('label');
    labelEl.className = 'absolute left-0 top-2 text-text-tertiary text-sm transition-all duration-200 pointer-events-none peer-focus:-translate-y-4 peer-focus:text-xs peer-focus:text-accent-finance peer-[:not(:placeholder-shown)]:-translate-y-4 peer-[:not(:placeholder-shown)]:text-xs';
    labelEl.textContent = label;
    
    const errorEl = document.createElement('p');
    errorEl.className = 'mt-1 text-xs text-status-error';
    errorEl.textContent = error || '';
    errorEl.style.display = error ? 'block' : 'none';
    
    wrapper.appendChild(input);
    wrapper.appendChild(labelEl);
    wrapper.appendChild(errorEl);
    
    if (onChange) {
        input.addEventListener('input', onChange);
    }
    
    return wrapper;
}

/**
 * Create a card container
 * @param {Object} options
 * @param {HTMLElement} options.content - Card content
 * @param {boolean} options.interactive - Add hover effects
 * @param {string} options.onClick - Click handler
 * @returns {HTMLElement}
 */
export function createCard({ 
    content, 
    interactive = false,
    onClick = null 
}) {
    const card = document.createElement('div');
    
    let classes = 'bg-surface-raised rounded-lg p-4 transition-all duration-200';
    
    if (interactive) {
        classes += ' hover:bg-surface-elevated cursor-pointer';
    }
    
    card.className = classes;
    
    if (typeof content === 'string') {
        card.innerHTML = content;
    } else {
        card.appendChild(content);
    }
    
    if (onClick) {
        card.addEventListener('click', onClick);
    }
    
    return card;
}

/**
 * Create a badge element
 * @param {Object} options
 * @param {string} options.text - Badge text
 * @param {'default'|'success'|'warning'|'error'|'info'} options.variant
 * @returns {HTMLElement}
 */
export function createBadge({ 
    text, 
    variant = 'default' 
}) {
    const badge = document.createElement('span');
    
    const variantClasses = {
        default: 'bg-surface-elevated text-text-secondary',
        success: 'bg-status-success/20 text-status-success',
        warning: 'bg-status-warning/20 text-status-warning',
        error: 'bg-status-error/20 text-status-error',
        info: 'bg-status-info/20 text-status-info',
    };
    
    badge.className = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`;
    badge.textContent = text;
    
    return badge;
}

/**
 * Create a modal overlay
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {HTMLElement} options.content - Modal body
 * @param {Array} options.actions - Action buttons
 * @param {Function} options.onClose - Close handler
 * @returns {HTMLElement}
 */
export function createModal({ 
    title, 
    content, 
    actions = [], 
    onClose 
}) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto';
    overlay.innerHTML = `
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="modal-backdrop"></div>
        <div class="relative bg-surface-raised rounded-xl shadow-modal max-w-md w-full animate-entrance">
            <div class="p-6">
                <h2 class="text-xl font-heading font-semibold text-text-primary mb-4">${title}</h2>
                <div class="modal-content"></div>
            </div>
            <div class="px-6 pb-6 flex justify-end gap-3" id="modal-actions"></div>
        </div>
    `;
    
    const modalContent = overlay.querySelector('.modal-content');
    if (typeof content === 'string') {
        modalContent.innerHTML = content;
    } else {
        modalContent.appendChild(content);
    }
    
    const actionsContainer = overlay.querySelector('#modal-actions');
    actions.forEach(action => {
        actionsContainer.appendChild(action);
    });
    
    const backdrop = overlay.querySelector('#modal-backdrop');
    backdrop.addEventListener('click', onClose);
    
    return overlay;
}

/**
 * Create a toast notification
 * @param {Object} options
 * @param {string} options.message - Toast message
 * @param {'success'|'error'|'warning'|'info'} options.type
 * @param {number} options.duration - Auto-dismiss time in ms
 * @returns {HTMLElement}
 */
export function createToast({ 
    message, 
    type = 'info', 
    duration = 3000 
}) {
    const toast = document.createElement('div');
    
    const typeClasses = {
        success: 'border-status-success',
        error: 'border-status-error',
        warning: 'border-status-warning',
        info: 'border-status-info',
    };
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ',
    };
    
    toast.className = `pointer-events-auto bg-surface-elevated border-l-4 ${typeClasses[type]} rounded-lg shadow-floating p-4 max-w-sm animate-entrance`;
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-${type === 'success' ? 'status-success' : type === 'error' ? 'status-error' : type === 'warning' ? 'status-warning' : 'status-info'}">${icons[type]}</span>
            <p class="text-sm text-text-primary flex-1">${message}</p>
        </div>
    `;
    
    // Auto-dismiss
    setTimeout(() => {
        toast.classList.add('animate-exit');
        setTimeout(() => toast.remove(), 200);
    }, duration);
    
    return toast;
}

/**
 * Show a toast in the toast container
 * @param {Object} options - Toast options
 */
export function showToast(options) {
    const container = document.getElementById('toast-container');
    const toast = createToast(options);
    container.appendChild(toast);
}
