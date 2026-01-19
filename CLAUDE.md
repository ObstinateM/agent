# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Principles

**CRITICAL: Follow these principles when working on this codebase:**

1. **Write Tests Whenever Possible**
   - Add unit tests for new utilities and functions
   - Add integration tests for plugins
   - Use `vitest` for all testing
   - Tests go in `__tests__` directories or alongside code as `*.test.ts`
   - Run `npm test` before committing

2. **Self-Documenting Code**
   - Code should be clear and self-explanatory
   - Use descriptive variable and function names
   - Avoid useless comments that restate what code does
   - Comments should explain "why", not "what"

3. **Comment Only When Needed**
   - Document class methods and functions with JSDoc (purpose and usage)
   - Explain complex algorithms or non-obvious logic
   - Document public APIs and interfaces
   - Skip comments for obvious operations

**Examples:**

```typescript
// ❌ BAD: Useless comment
// Increment counter by 1
counter++;

// ✅ GOOD: No comment needed, code is clear
counter++;

// ❌ BAD: Comment restates code
// Loop through all plugins
for (const plugin of plugins) {
  // ...
}

// ✅ GOOD: Comment explains why
// Process plugins in load order to respect dependencies
for (const plugin of plugins) {
  // ...
}

// ✅ GOOD: JSDoc for public API
/**
 * Execute a workflow by name with optional initial variables.
 * Variables are available to all steps via ${variableName} syntax.
 */
async executeWorkflow(name: string, variables?: Record<string, any>): Promise<WorkflowExecutionResult>
```

## Project Overview

This is a modular TypeScript AI Agent system that connects to OpenAI's GPT models and provides a plugin-based architecture for integrating custom tools and workflows. The agent automatically discovers plugins, exposes their tools to the LLM for automatic selection during conversations, and can execute predefined workflows.

## Essential Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Run in development mode
npm run dev:watch    # Run with hot reload
npm run build        # Build the project
npm run type-check   # Type checking without building
npm start            # Run the built application

# Testing
npm test             # Run tests
npm test:watch       # Run tests in watch mode

# Code Quality
npm run lint         # Lint the code
npm run lint:fix     # Auto-fix linting issues

# Docker
docker-compose up -d    # Build and run
docker-compose logs -f  # View logs
docker-compose down     # Stop
```

## Architecture Overview

### Core Components

1. **Plugin System** (`src/core/plugin-loader.ts`)
   - Auto-discovers plugins from the `plugins/` directory
   - Supports plugin dependencies (topological sort)
   - Each plugin folder must contain an `index.ts` that exports a Plugin instance

2. **Agent** (`src/core/agent.ts`)
   - Manages conversation with OpenAI GPT models
   - Automatically exposes all registered tools to the LLM as functions
   - Handles function calling loop

3. **Workflow Engine** (`src/core/workflow-engine.ts`)
   - Executes predefined sequences of tool calls
   - Supports parameter passing between steps using `${variableName}` syntax

4. **Scheduler Engine** (`src/core/scheduler-engine.ts`)
   - Schedules workflow executions (one-time or periodic)
   - SQLite database for persistence (`data/scheduler.db`)

5. **Interfaces** (`src/interfaces/`)
   - **CLI**: Interactive command-line interface
   - **Telegram**: Remote access via Telegram bot (see `plugins/telegram/README.md`)

### Type System

All core interfaces are in `src/types/`:
- **`plugin.ts`**: Plugin, Tool, Workflow, ToolDefinition interfaces
- **`agent.ts`**: Agent configuration, messages, execution results

## Plugin Development

### Plugin Structure

```
plugins/
└── your-plugin/
    ├── index.ts      # Main plugin file
    ├── tools.ts      # Tool definitions
    ├── workflows.ts  # Workflow definitions
    ├── README.md     # Plugin documentation
    └── __tests__/
        └── index.test.ts
```

### Creating a Plugin

1. Create a new folder in `plugins/`
2. Create required files (`index.ts`, `tools.ts`, `workflows.ts`)
3. Create a `README.md` with usage and configuration
4. Add any required env vars to `.env.example`
5. See `plugins/PLUGIN_TEMPLATE.ts` for examples

### Plugin Interface

```typescript
interface Plugin {
  metadata: {
    name: string;
    version: string;
    description: string;
    author?: string;
    dependencies?: string[];  // Other plugins this depends on
  };
  initialize(): Promise<void>;
  getTools(): Tool[];
  getWorkflows(): Workflow[];
  cleanup?(): Promise<void>;
}
```

### Best Practices

- **Tool Naming**: Use lowercase with underscores (e.g., `docker_list_containers`)
- **Descriptions**: Write clear descriptions - the LLM uses these to select tools
- **Validation**: Use Zod schemas for parameter validation
- **Documentation**: Each plugin must have its own README.md
- **Testing**: Create `__tests__` directory with mocked dependencies

## Configuration

All configuration is done via environment variables. See `.env.example` for the full list.

### Required
- `OPENAI_API_KEY` - Your OpenAI API key

### Plugin Configuration
Each plugin may have its own environment variables. Check the plugin's README.md for details.

## Project Structure

```
src/
├── core/
│   ├── agent.ts              # Main agent with OpenAI integration
│   ├── plugin-loader.ts      # Plugin auto-discovery and loading
│   ├── workflow-engine.ts    # Workflow execution engine
│   ├── scheduler-engine.ts   # Scheduled task execution engine
│   └── tool-executor.ts      # Tool execution utility
├── interfaces/
│   ├── cli.ts                # Command-line interface
│   └── telegram-bot.ts       # Telegram bot interface
├── types/
│   ├── plugin.ts             # Plugin, Tool, Workflow interfaces
│   └── agent.ts              # Agent types and configs
└── index.ts                  # Main entry point

plugins/                      # User plugins directory
├── memory/                   # Memory persistence plugin
├── telegram/                 # Telegram bot interface plugin
├── idfm/                     # Île-de-France Mobilités plugin
└── PLUGIN_TEMPLATE.ts        # Template for new plugins

data/                         # Runtime data
└── scheduler.db              # SQLite database for scheduled tasks
```

## Important Notes

- **Module System**: Uses ES modules (`"type": "module"` in package.json)
- **Import Extensions**: Always use `.js` extension in imports (even for `.ts` files)
- **Plugin Discovery**: Only looks for `index.js` in plugin folders (after build)
- **Tool Names**: Must be unique across all plugins
- **Plugin Docs**: Each plugin must have its own README.md - do not document plugins here
- After a change always run lint and test
