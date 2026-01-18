# Plugins Directory

This directory contains all plugins for the AI Agent system. Plugins are automatically discovered and loaded at startup.

## Plugin Structure

Each plugin must be a directory containing an `index.ts` (or `index.js` after build) file that exports a Plugin instance:

```
plugins/
└── your-plugin/
    └── index.ts
```

## Creating a Plugin

See the example plugins in this directory:
- `docker/` - Docker container management
- `script-runner/` - Shell script execution

Your plugin must implement the `Plugin` interface from `src/types/plugin.ts`.

## Plugin Requirements

1. Export a default Plugin instance or factory function
2. Implement all required methods: `initialize()`, `getTools()`, `getWorkflows()`
3. Provide metadata (name, version, description)
4. Use Zod schemas for tool parameter validation

## Loading Plugins

Plugins are automatically loaded when the agent starts. Simply:
1. Create your plugin folder in this directory
2. Build the project (`npm run build`)
3. Restart the agent

No manual registration required!
