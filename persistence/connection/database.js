/**
 * Life OS — Database Connection
 * 
 * IndexedDB connection manager for local-first persistence.
 * 
 * Responsibilities:
 * - Open and maintain database connection
 * - Handle schema versioning and migrations
 * - Provide transaction helpers
 * - Export/import functionality
 * 
 * Schema:
 * - app-preferences: User settings
 * - finance-transactions: Financial records
 * - finance-budgets: Budget definitions
 * - tasks-items: Task entries
 * - tasks-projects: Project groupings
 * - knowledge-notes: Written notes
 * - knowledge-links: Resource bookmarks
 * - habits-records: Daily habit logs
 * - habits-definitions: Habit templates
 * - goals-items: Goal definitions
 * - goals-milestones: Milestone markers
 */

const DB_NAME = 'life-os';
const DB_VERSION = 1;

export class Database {
    constructor() {
        /** @type {IDBDatabase|null} */
        this.db = null;
        
        /** @type {boolean} */
        this.connected = false;
    }

    /**
     * Open database connection and create schema
     * @returns {Promise<void>}
     */
    async connect() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => {
                console.error('[Database] Failed to open:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.connected = true;
                console.log('[Database] Connected successfully');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createSchema(db);
            };
        });
    }

    /**
     * Create or upgrade database schema
     * @param {IDBDatabase} db 
     */
    createSchema(db) {
        // App preferences (single record store)
        if (!db.objectStoreNames.contains('app-preferences')) {
            db.createObjectStore('app-preferences', { keyPath: 'id' });
        }
        
        // Finance pillar stores
        if (!db.objectStoreNames.contains('finance-transactions')) {
            const store = db.createObjectStore('finance-transactions', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            store.createIndex('by-date', 'date');
            store.createIndex('by-category', 'category');
            store.createIndex('by-type', 'type');
        }
        
        if (!db.objectStoreNames.contains('finance-budgets')) {
            const store = db.createObjectStore('finance-budgets', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            store.createIndex('by-category', 'category');
        }
        
        // Tasks pillar stores
        if (!db.objectStoreNames.contains('tasks-items')) {
            const store = db.createObjectStore('tasks-items', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            store.createIndex('by-status', 'status');
            store.createIndex('by-priority', 'priority');
            store.createIndex('by-due-date', 'dueDate');
        }
        
        if (!db.objectStoreNames.contains('tasks-projects')) {
            const store = db.createObjectStore('tasks-projects', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            store.createIndex('by-name', 'name');
        }
        
        // Knowledge pillar stores (PKM)
        if (!db.objectStoreNames.contains('knowledge-notes')) {
            const store = db.createObjectStore('knowledge-notes', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('by-tags', 'tags', { multiEntry: true });
            store.createIndex('by-created', 'createdAt');
            store.createIndex('by-updated', 'updatedAt');
            store.createIndex('by-category', 'category');
            store.createIndex('by-archived', 'isArchived');
            store.createIndex('by-favorited', 'isFavorited');
        }
        
        if (!db.objectStoreNames.contains('knowledge-links')) {
            const store = db.createObjectStore('knowledge-links', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            store.createIndex('by-url', 'url');
        }
        
        // Habits pillar stores
        if (!db.objectStoreNames.contains('habits-definitions')) {
            const store = db.createObjectStore('habits-definitions', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('by-frequency', 'frequency');
            store.createIndex('by-category', 'category');
            store.createIndex('by-archived', 'isArchived');
            store.createIndex('by-sort-order', 'sortOrder');
        }

        if (!db.objectStoreNames.contains('habits-records')) {
            const store = db.createObjectStore('habits-records', {
                keyPath: 'id',
                autoIncrement: true
            });
            store.createIndex('by-habit-id', 'habitId');
            store.createIndex('by-date', 'date');
        }
        
        // Goals pillar stores
        if (!db.objectStoreNames.contains('goals-items')) {
            const store = db.createObjectStore('goals-items', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            store.createIndex('by-status', 'status');
            store.createIndex('by-deadline', 'deadline');
        }
        
        if (!db.objectStoreNames.contains('goals-milestones')) {
            const store = db.createObjectStore('goals-milestones', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            store.createIndex('by-goal-id', 'goalId');
        }
        
        console.log('[Database] Schema created/upgraded');
    }

    /**
     * Save a record to a store
     * @param {string} storeName - Object store name
     * @param {Object} data - Record to save
     * @returns {Promise<number>} Generated ID
     */
    async save(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update an existing record
     * @param {string} storeName - Object store name
     * @param {Object} data - Record with ID
     * @returns {Promise<void>}
     */
    async update(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a record by ID
     * @param {string} storeName - Object store name
     * @param {number|string} id - Record ID
     * @returns {Promise<Object|null>}
     */
    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all records from a store
     * @param {string} storeName - Object store name
     * @returns {Promise<Array>}
     */
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a record by ID
     * @param {string} storeName - Object store name
     * @param {number|string} id - Record ID
     * @returns {Promise<void>}
     */
    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Query records by index
     * @param {string} storeName - Object store name
     * @param {string} indexName - Index name
     * @param {*} value - Value to match
     * @returns {Promise<Array>}
     */
    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Export all data from a store
     * @param {string} storeName - Object store name
     * @returns {Promise<Array>}
     */
    async exportStore(storeName) {
        return this.getAll(storeName);
    }

    /**
     * Import data into a store (replaces existing)
     * @param {string} storeName - Object store name
     * @param {Array} records - Records to import
     * @returns {Promise<void>}
     */
    async importStore(storeName, records) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Clear existing data
            store.clear();
            
            // Add all records
            records.forEach(record => store.add(record));
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Export all pillar data
     * @returns {Promise<Object>}
     */
    async exportAll() {
        const stores = [
            'finance-transactions',
            'finance-budgets',
            'tasks-items',
            'tasks-projects',
            'knowledge-notes',
            'knowledge-links',
            'habits-definitions',
            'habits-records',
            'goals-items',
            'goals-milestones',
        ];
        
        const data = {};
        for (const store of stores) {
            data[store] = await this.exportStore(store);
        }
        
        return data;
    }

    /**
     * Import all pillar data
     * @param {Object} data - Store data keyed by store name
     * @returns {Promise<void>}
     */
    async importAll(data) {
        for (const [storeName, records] of Object.entries(data)) {
            await this.importStore(storeName, records);
        }
    }

    /**
     * Close database connection
     */
    disconnect() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.connected = false;
            console.log('[Database] Disconnected');
        }
    }
}
