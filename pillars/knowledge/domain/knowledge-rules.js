/**
 * Tarteeb — Knowledge Domain Rules
 *
 * Pure business logic for knowledge management.
 * Zero DOM dependency. Every function is testable in isolation.
 *
 * Invariants enforced here:
 *   - Note title must be a non-empty string (max 200 chars)
 *   - Note content is a string (max 10 000 chars)
 *   - Note category is one of: programming, design, business, etc.
 *   - Tags are an array of lowercase trimmed strings
 *   - Link URL must be a non-empty valid string
 *   - Link title must be a non-empty string (max 200 chars)
 *   - Link description is optional (max 500 chars)
 *   - Timestamps are ISO-8601 strings set at creation
 */

/* ── Enums ───────────────────────────────────────────────── */

export const NOTE_CATEGORIES = Object.freeze([
    'programming',
    'design',
    'business',
    'health',
    'learning',
    'personal',
    'other',
]);

export const CATEGORY_META = Object.freeze({
    programming: { label: 'Programming', icon: '💻', color: '#60a5fa' },
    design:      { label: 'Design',      icon: '🎨', color: '#f472b6' },
    business:    { label: 'Business',    icon: '📊', color: '#facc15' },
    health:      { label: 'Health',      icon: '💪', color: '#4ade80' },
    learning:    { label: 'Learning',    icon: '📚', color: '#c084fc' },
    personal:    { label: 'Personal',    icon: '👤', color: '#2dd4bf' },
    other:       { label: 'Other',       icon: '📌', color: '#a1a1aa' },
});

/* ── Validation ──────────────────────────────────────────── */

/**
 * Validate a note data object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateNote(data) {
    var errors = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Note data must be an object'] };
    }

    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push('Title is required');
    } else if (data.title.length > 200) {
        errors.push('Title must be 200 characters or fewer');
    }

    if (data.content !== undefined && data.content !== null) {
        if (typeof data.content !== 'string') {
            errors.push('Content must be a string');
        } else if (data.content.length > 10000) {
            errors.push('Content must be 10 000 characters or fewer');
        }
    }

    if (data.category && NOTE_CATEGORIES.indexOf(data.category) === -1) {
        errors.push('Category must be one of: ' + NOTE_CATEGORIES.join(', '));
    }

    if (data.tags !== undefined) {
        if (!Array.isArray(data.tags)) {
            errors.push('Tags must be an array');
        } else {
            for (var i = 0; i < data.tags.length; i++) {
                if (typeof data.tags[i] !== 'string' || data.tags[i].trim().length === 0) {
                    errors.push('Each tag must be a non-empty string');
                    break;
                }
            }
        }
    }

    return { valid: errors.length === 0, errors: errors };
}

/**
 * Validate a link data object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateLink(data) {
    var errors = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Link data must be an object'] };
    }

    if (typeof data.url !== 'string' || data.url.trim().length === 0) {
        errors.push('URL is required');
    }

    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push('Title is required');
    } else if (data.title.length > 200) {
        errors.push('Title must be 200 characters or fewer');
    }

    if (data.description !== undefined && data.description !== null) {
        if (typeof data.description !== 'string') {
            errors.push('Description must be a string');
        } else if (data.description.length > 500) {
            errors.push('Description must be 500 characters or fewer');
        }
    }

    if (data.tags !== undefined) {
        if (!Array.isArray(data.tags)) {
            errors.push('Tags must be an array');
        } else {
            for (var i = 0; i < data.tags.length; i++) {
                if (typeof data.tags[i] !== 'string' || data.tags[i].trim().length === 0) {
                    errors.push('Each tag must be a non-empty string');
                    break;
                }
            }
        }
    }

    return { valid: errors.length === 0, errors: errors };
}

/* ── Factories ───────────────────────────────────────────── */

/**
 * Create a new note object with defaults.
 * Does NOT persist — call gateway separately.
 */
export function createNoteData(overrides) {
    var now = new Date().toISOString();
    var defaults = {
        title:     '',
        content:   '',
        category:  'other',
        tags:      [],
        isPinned:  false,
        createdAt: now,
        updatedAt: now,
    };
    return Object.assign({}, defaults, overrides || {});
}

/**
 * Create a new link object with defaults.
 * Does NOT persist — call gateway separately.
 */
export function createLinkData(overrides) {
    var now = new Date().toISOString();
    var defaults = {
        url:         '',
        title:       '',
        description: '',
        favicon:     '',
        tags:        [],
        createdAt:   now,
        updatedAt:   now,
    };
    return Object.assign({}, defaults, overrides || {});
}

/* ── Formatting ──────────────────────────────────────────── */

/**
 * Format an ISO timestamp for display.
 * @param {string} iso
 * @returns {string} e.g. "Jun 15, 2026"
 */
export function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    } catch (e) {
        return iso;
    }
}

/**
 * Return a human-friendly relative date string.
 * @param {string} iso
 * @returns {string} e.g. "Today", "3 days ago"
 */
export function relativeDate(iso) {
    if (!iso) return '';
    try {
        var itemDate = new Date(iso);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var itemDay = new Date(itemDate);
        itemDay.setHours(0, 0, 0, 0);
        var diffMs  = today - itemDay;
        var diffDay = Math.round(diffMs / 86400000);

        if (diffDay === 0) return 'Today';
        if (diffDay === 1) return 'Yesterday';
        if (diffDay === -1) return 'Tomorrow';
        if (diffDay > 1 && diffDay <= 6) return diffDay + ' days ago';
        if (diffDay < -1 && diffDay >= -6) return 'In ' + Math.abs(diffDay) + ' days';

        return itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
        return iso;
    }
}

/**
 * Extract the hostname from a URL string.
 * @param {string} url
 * @returns {string}
 */
export function extractDomain(url) {
    if (!url) return '';
    try {
        return new URL(url).hostname;
    } catch (e) {
        return url;
    }
}

/* ── Normalizers ─────────────────────────────────────────── */

/**
 * Normalize an array of tag strings: lowercase, trim, dedupe.
 * @param {string[]} tags
 * @returns {string[]}
 */
export function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    var seen = {};
    var result = [];
    for (var i = 0; i < tags.length; i++) {
        var t = String(tags[i]).toLowerCase().trim();
        if (t.length > 0 && !seen[t]) {
            seen[t] = true;
            result.push(t);
        }
    }
    return result;
}

/* ── Selectors (pure derivations) ────────────────────────── */

/**
 * Filter notes by category.
 */
export function selectByCategory(items, category) {
    return items.filter(function (n) { return n.category === category; });
}

/**
 * Filter notes/links by a specific tag (multiEntry match).
 */
export function selectByTag(items, tag) {
    var lower = tag.toLowerCase().trim();
    return items.filter(function (n) {
        return Array.isArray(n.tags) && n.tags.indexOf(lower) !== -1;
    });
}

/**
 * Filter items containing any of the given tags.
 */
export function selectByAnyTag(items, tags) {
    if (!tags || tags.length === 0) return items;
    var lowerTags = tags.map(function (t) { return t.toLowerCase().trim(); });
    return items.filter(function (n) {
        if (!Array.isArray(n.tags)) return false;
        for (var i = 0; i < lowerTags.length; i++) {
            if (n.tags.indexOf(lowerTags[i]) !== -1) return true;
        }
        return false;
    });
}

/**
 * Filter items whose title or content contains a search term.
 */
export function selectBySearch(items, term) {
    if (!term || term.trim().length === 0) return items;
    var lower = term.toLowerCase().trim();
    return items.filter(function (n) {
        var titleMatch = n.title && n.title.toLowerCase().indexOf(lower) !== -1;
        var contentMatch = n.content && n.content.toLowerCase().indexOf(lower) !== -1;
        var descMatch = n.description && n.description.toLowerCase().indexOf(lower) !== -1;
        var urlMatch = n.url && n.url.toLowerCase().indexOf(lower) !== -1;
        return titleMatch || contentMatch || descMatch || urlMatch;
    });
}

/**
 * Sort notes by creation date descending (newest first).
 */
export function sortByCreated(items) {
    return items.slice().sort(function (a, b) {
        var da = a.createdAt || '';
        var db = b.createdAt || '';
        if (db !== da) return db.localeCompare(da);
        return (b.id || 0) - (a.id || 0);
    });
}

/**
 * Sort items by updatedAt descending (most recently modified first),
 * then by id descending.
 */
export function sortByUpdated(items) {
    return items.slice().sort(function (a, b) {
        var da = a.updatedAt || a.createdAt || '';
        var db = b.updatedAt || b.createdAt || '';
        if (db !== da) return db.localeCompare(da);
        return (b.id || 0) - (a.id || 0);
    });
}

/**
 * Sort items alphabetically by title ascending.
 */
export function sortByTitle(items) {
    return items.slice().sort(function (a, b) {
        return (a.title || '').localeCompare(b.title || '');
    });
}

/* ── Aggregators (pure derivations) ──────────────────────── */

/**
 * Count items grouped by category.
 * Returns { categoryName: count }
 */
export function summarizeByCategory(items) {
    var groups = {};
    for (var i = 0; i < items.length; i++) {
        var cat = items[i].category || 'other';
        if (!groups[cat]) groups[cat] = 0;
        groups[cat]++;
    }
    return groups;
}

/**
 * Count all unique tags across a list of items.
 * Returns { tag: count } sorted by count descending.
 */
export function summarizeTags(items) {
    var counts = {};
    for (var i = 0; i < items.length; i++) {
        var tags = items[i].tags;
        if (!Array.isArray(tags)) continue;
        for (var j = 0; j < tags.length; j++) {
            var t = tags[j].toLowerCase().trim();
            if (t.length > 0) {
                if (!counts[t]) counts[t] = 0;
                counts[t]++;
            }
        }
    }
    return counts;
}

/**
 * Get the most recent N items.
 */
export function selectRecent(items, count) {
    count = count || 5;
    return sortByCreated(items).slice(0, count);
}

/**
 * Get pinned notes first, then by creation date.
 */
export function sortByPinnedThenCreated(notes) {
    return notes.slice().sort(function (a, b) {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        var da = a.createdAt || '';
        var db = b.createdAt || '';
        if (db !== da) return db.localeCompare(da);
        return (b.id || 0) - (a.id || 0);
    });
}
