# Plugins Directory

This directory contains all plugins for the AI Agent system. Plugins are automatically discovered and loaded at startup.

## Plugin Structure

Each plugin should have the following structure:

```
plugins/
└── your-plugin/
    ├── index.ts       # Main plugin file (required)
    ├── tools.ts       # Tool definitions (recommended)
    ├── workflows.ts   # Workflow definitions (recommended)
    ├── README.md      # Plugin documentation (required)
    └── __tests__/     # Tests (recommended)
```

## Available Plugins

- `memory/` - Long-term memory storage for the agent
- `telegram/` - Telegram bot interface for remote access
- `idfm/` - Île-de-France Mobilités transit data

See each plugin's README.md for documentation.

## Creating a Plugin

Your plugin must implement the `Plugin` interface from `src/types/plugin.ts`.

## Plugin Requirements

1. Export a default Plugin instance or factory function
2. Implement all required methods: `initialize()`, `getTools()`, `getWorkflows()`
3. Provide metadata (name, version, description)
4. Use Zod schemas for tool parameter validation
5. Include a README.md with usage, configuration, and examples

## Plugin Dependencies

Plugins can declare dependencies on other plugins via the `dependencies` array in metadata:

```typescript
metadata = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My plugin',
  dependencies: ['memory', 'telegram'], // Will load after these plugins
};
```

The plugin loader will ensure dependencies are loaded first and detect circular dependencies.

## Loading Plugins

Plugins are automatically loaded when the agent starts. Simply:
1. Create your plugin folder in this directory
2. Build the project (`npm run build`)
3. Restart the agent

No manual registration required!
