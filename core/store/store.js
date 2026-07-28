// YAGNI: Removed modal/loading state, persist(), get() dot-notation was kept (used by shell/router)

export class Store {
    constructor(eventBus, database) {
        this.eventBus = eventBus;
        this.database = database;

        this.state = {
            theme: 'dark',
            sidebar: {
                collapsed: false,
                expanded: false,
                width: 64,
                expandedWidth: 240,
            },
            activePillar: null,
            activeSection: null,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                isMobile: window.innerWidth < 768,
                isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
                isDesktop: window.innerWidth >= 1024,
            },
        };

        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.debounce(this.handleResize, 150));
    }

    getState() {
        return { ...this.state };
    }

    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => obj[key], this.state);

        if (target && lastKey in target) {
            const oldValue = target[lastKey];
            target[lastKey] = value;
            this.eventBus.publish('store:state-changed', { path, oldValue, newValue: value });
        }
    }

    toggle(path) {
        const current = this.get(path);
        if (typeof current === 'boolean') {
            this.set(path, !current);
        }
    }

    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.state.viewport = {
            width,
            height,
            isMobile: width < 768,
            isTablet: width >= 768 && width < 1024,
            isDesktop: width >= 1024,
        };

        if (width < 768) {
            this.state.sidebar.collapsed = true;
        }

        this.eventBus.publish('store:viewport-changed', this.state.viewport);
    }

    debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    async hydrate() {
        const preferences = await this.database.get('app-preferences', 'user');
        if (preferences) {
            this.state.theme = preferences.theme || 'dark';
            this.state.sidebar = { ...this.state.sidebar, ...preferences.sidebar };
        }
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize);
    }
}
