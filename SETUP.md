# Life OS — Command-Line Setup

## Directory Structure Scaffolding

Run these commands in your project root to create the complete directory structure:

```bash
# Core modules
mkdir -p core/router core/shell core/events core/store core/i18n core/a11y

# Persistence layer
mkdir -p persistence/connection persistence/schema persistence/gateways persistence/transaction persistence/backup

# UI toolkit
mkdir -p ui/atoms ui/composites ui/layout ui/feedback

# Orchestration
mkdir -p orchestration/workflows orchestration/projections

# Assets
mkdir -p assets/icons assets/fonts

# Pillars - Finance
mkdir -p pillars/finance/domain pillars/finance/state pillars/finance/views pillars/finance/components pillars/finance/router

# Pillars - Tasks
mkdir -p pillars/tasks/domain pillars/tasks/state pillars/tasks/views pillars/tasks/components pillars/tasks/router

# Pillars - Knowledge
mkdir -p pillars/knowledge/domain pillars/knowledge/state pillars/knowledge/views pillars/knowledge/components pillars/knowledge/router

# Pillars - Habits
mkdir -p pillars/habits/domain pillars/habits/state pillars/habits/views pillars/habits/components pillars/habits/router

# Pillars - Goals
mkdir -p pillars/goals/domain pillars/goals/state pillars/goals/views pillars/goals/components pillars/goals/router

# Dashboard
mkdir -p pillars/dashboard/views
```

## Quick Start

1. Open `index.html` in a local development server (e.g., VS Code Live Server)
2. The application will bootstrap automatically
3. Navigate using the sidebar or URL hash

## Project Structure

```
life-os/
├── index.html                    # Entry point
├── core/                         # Layer 0: Core infrastructure
│   ├── main.js                   # Application bootstrap
│   ├── router/                   # Hash-based SPA router
│   ├── shell/                    # App chrome (sidebar, nav)
│   ├── events/                   # Event bus for cross-pillar communication
│   ├── store/                    # Global state management
│   ├── i18n/                     # Localization (future)
│   └── a11y/                     # Accessibility utilities (future)
├── persistence/                  # Layer 1: Data persistence
│   ├── connection/               # IndexedDB connection manager
│   ├── schema/                   # Database schema definitions
│   ├── gateways/                 # Pillar-specific data access
│   ├── transaction/              # Cross-pillar transactions
│   └── backup/                   # Export/import utilities
├── pillars/                      # Layer 2: Domain modules
│   ├── dashboard/                # Overview (projection space)
│   ├── finance/                  # Personal finance
│   ├── tasks/                    # Task management
│   ├── knowledge/                # Knowledge management
│   ├── habits/                   # Habit tracking
│   └── goals/                    # Goal setting
├── ui/                           # Layer 3: Shared UI toolkit
│   ├── atoms/                    # Basic components
│   ├── composites/               # Complex components
│   ├── layout/                   # Layout utilities
│   └── feedback/                 # Loading, error, empty states
├── orchestration/                # Layer 4: Cross-pillar workflows
│   ├── workflows/                # Named compound actions
│   └── projections/              # Derived cross-pillar views
└── assets/                       # Static assets
    ├── icons/                    # Pillar icons
    └── fonts/                    # Custom fonts
```

## Architecture Rules

1. **Domain Isolation**: Pillars never import from each other
2. **Event Bus Only**: Cross-pillar communication via core/events
3. **Gateway Pattern**: All DB access through persistence/gateways
4. **Lazy Loading**: Pillar modules loaded on-demand via router
5. **Zero Build**: No bundler, no transpiler, native ES6 modules

## Development Commands

```bash
# Start local server (if using Python)
python -m http.server 8000

# Or using Node.js
npx serve .

# Or using PHP
php -S localhost:8000
```

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

Requires native ES6 module support and IndexedDB.
