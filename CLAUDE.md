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

### Development
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in development mode with hot reload
npm run dev:watch

# Build the project
npm run build

# Type checking without building
npm run type-check

# Run the built application
npm start
```

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with UI
npm test:ui
```

### Code Quality
```bash
# Lint the code
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Environment Setup
```bash
# Copy example environment file
cp .env.example .env

# Edit .env and configure:
# - OPENAI_API_KEY (required)
# - INTERFACE_MODE (cli or telegram)
# - TELEGRAM_BOT_TOKEN (if using telegram)
# - TELEGRAM_ALLOWED_USERS (comma-separated user IDs)
```

### Docker
```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Build Docker image manually
docker build -t ai-agent .

# Run with Docker
docker run --env-file .env ai-agent
```

## Architecture Overview

### Core Components

1. **Plugin System** (`src/core/plugin-loader.ts`)
   - Auto-discovers plugins from the `plugins/` directory
   - Each plugin folder must contain an `index.ts` that exports a Plugin instance
   - Plugins are loaded at startup and registered with the agent
   - Supports hot-loading: drop a new plugin folder and restart

2. **Agent** (`src/core/agent.ts`)
   - Manages conversation with OpenAI GPT models
   - Automatically exposes all registered tools to the LLM as functions
   - Handles function calling: when LLM selects a tool, agent validates params and executes
   - Maintains conversation history

3. **Workflow Engine** (`src/core/workflow-engine.ts`)
   - Executes predefined sequences of tool calls
   - Supports parameter passing between steps using `${variableName}` syntax
   - Stores step results in context as `step0_result`, `step1_result`, etc.

4. **Scheduler Engine** (`src/core/scheduler-engine.ts`)
   - Core component for scheduling workflow executions
   - Stores scheduled tasks in SQLite database (`data/scheduler.db`)
   - Background execution loop checks for due tasks every 60 seconds
   - Tools are registered via `PluginLoader.registerCoreTools()`
   - Properly handles timing: periodic tasks don't run immediately on creation

5. **Interfaces** (`src/interfaces/`)
   - **CLI** (`cli.ts`): Interactive command-line interface with prompt
   - **Telegram Bot** (`telegram-bot.ts`): Telegram bot interface for remote access
   - Configurable via `INTERFACE_MODE` environment variable

### Interface Modes

The agent supports two interface modes:

**CLI Mode** (default):
- Interactive terminal interface
- Real-time chat with the agent
- Commands: `/tools`, `/workflows`, `/workflow <name>`, `/clear`, `/exit`
- Best for local development and testing

**Telegram Bot Mode**:
- Telegram bot interface for remote access
- Chat with agent from any Telegram client
- User access control via `TELEGRAM_ALLOWED_USERS`
- Commands: `/start`, `/tools`, `/workflows`, `/workflow <name>`, `/clear`, `/help`
- Best for production and remote usage

To switch modes, set `INTERFACE_MODE=telegram` in `.env` and provide `TELEGRAM_BOT_TOKEN`.

### Type System

All core interfaces are in `src/types/`:

- **`plugin.ts`**: Plugin, Tool, Workflow, ToolDefinition interfaces
- **`agent.ts`**: Agent configuration, messages, execution results

### Key Design Patterns

1. **Plugin Interface**: All plugins implement the `Plugin` interface with:
   - `metadata`: Name, version, description, author
   - `initialize()`: Setup logic called once at load
   - `getTools()`: Returns array of Tool objects
   - `getWorkflows()`: Returns array of Workflow objects
   - `cleanup()`: Optional teardown logic

2. **Tool Definition**: Tools are defined with:
   - `definition`: Name, description, and Zod schema for parameters
   - `execute()`: Async function that performs the actual work
   - Parameters are validated using Zod before execution

3. **Zod Schemas**: All tool parameters use Zod for:
   - Runtime validation
   - Type safety
   - Automatic conversion to OpenAI function calling schema

4. **OpenAI Function Calling**:
   - Tools are automatically converted to OpenAI function schemas
   - LLM selects appropriate tools based on conversation context
   - Agent handles the call loop: function call → execution → result → next message

## Plugin Development

### Plugin Structure

```
plugins/
└── your-plugin/
    └── index.ts          # Main plugin file (required)
```

### Creating a Plugin

1. Create a new folder in `plugins/`
2. Create `index.ts` that exports a Plugin instance:

```typescript
import { z } from 'zod';
import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';

class YourPlugin implements Plugin {
  metadata = {
    name: 'your-plugin',
    version: '1.0.0',
    description: 'Description of what your plugin does',
  };

  async initialize(): Promise<void> {
    // Setup code (check dependencies, load config, etc.)
  }

  getTools(): Tool[] {
    return [
      {
        definition: {
          name: 'your_tool_name',
          description: 'Clear description for the LLM',
          parameters: z.object({
            param1: z.string().describe('Parameter description'),
            param2: z.number().optional().describe('Optional parameter'),
          }),
        },
        execute: async (params) => {
          // Params are already validated by Zod
          const { param1, param2 } = params;
          // Your implementation
          return result;
        },
      },
    ];
  }

  getWorkflows(): Workflow[] {
    return [
      {
        name: 'your_workflow',
        description: 'What this workflow does',
        steps: [
          {
            toolName: 'your_tool_name',
            params: { param1: 'value', param2: 123 },
            description: 'Step description',
          },
          {
            toolName: 'another_tool',
            params: { input: '${step0_result}' }, // Use previous step result
          },
        ],
      },
    ];
  }

  async cleanup(): Promise<void> {
    // Optional cleanup
  }
}

export default new YourPlugin();
```

### Plugin Best Practices

- **Tool Naming**: Use lowercase with underscores (e.g., `docker_list_containers`)
- **Descriptions**: Write clear descriptions - the LLM uses these to select tools
- **Parameter Descriptions**: Be specific about what each parameter does and its format
- **Error Handling**: Throw descriptive errors - they're caught and shown to the LLM
- **Validation**: Rely on Zod schemas for validation, don't duplicate in execute()
- **Async Operations**: All execute() functions are async, use await freely
- **Side Effects**: Be clear in descriptions about side effects (starts/stops services, etc.)

### Plugin Development Rules

**When creating or modifying plugins:**

1. **Write Tests**
   - Create `__tests__` directory in your plugin folder
   - Test tool execution with valid and invalid inputs
   - Test workflow execution end-to-end
   - Mock external dependencies (Docker, APIs, etc.)

   Example structure:
   ```
   plugins/
   └── your-plugin/
       ├── index.ts
       └── __tests__/
           └── index.test.ts
   ```

2. **Self-Documenting Code**
   - Use clear function and variable names
   - Avoid obvious comments like "// Execute the tool"
   - Only comment complex logic or non-obvious decisions

   ```typescript
   // ❌ BAD
   // Stop the container
   await execAsync(`docker stop ${container}`);

   // ✅ GOOD (no comment needed)
   await execAsync(`docker stop ${container}`);

   // ✅ GOOD (comment explains why)
   // Use --force to avoid waiting for graceful shutdown
   await execAsync(`docker stop --force ${container}`);
   ```

3. **Document Public APIs Only**
   - Add JSDoc to tool definitions
   - Describe what the tool does and how to use it
   - Skip comments for internal helper functions if names are clear

   ```typescript
   // ✅ GOOD: Document the tool for developers
   {
     definition: {
       name: 'docker_list_containers',
       description: 'List all Docker containers (running and stopped)',
       parameters: z.object({
         all: z.boolean().optional()
           .describe('Show all containers (default shows just running)'),
       }),
     },
     execute: async (params) => {
       const { all = true } = params;
       const command = `docker ps ${all ? '-a' : ''}`;
       const { stdout } = await execAsync(command);
       return stdout.trim();
     },
   }
   ```

### Workflow Variables

Workflows support variable substitution:
- Initial variables: Pass when calling `executeWorkflow(name, { var1: 'value' })`
- Step results: Automatically available as `${step0_result}`, `${step1_result}`, etc.
- Nested object params: Variables work in nested objects too

## Example Plugins

### Docker Plugin (`plugins/docker/`)
Provides tools for Docker container management:
- `docker_list_containers`: List all containers
- `docker_start_container`: Start a container
- `docker_stop_container`: Stop a container
- `docker_container_logs`: Get container logs
- `docker_exec_command`: Execute command in container

Workflows:
- `restart_container`: Stop then start a container
- `check_container_health`: List containers and get logs

### Script Runner Plugin (`plugins/script-runner/`)
Executes shell scripts and commands:
- `run_shell_command`: Execute any shell command
- `run_bash_script`: Execute a bash script string
- `check_process`: Check if a process is running
- `get_system_info`: Get system information

Workflows:
- `system_health_check`: Comprehensive system check

### Scheduler Engine (Core Component)

The scheduler is a core engine (`src/core/scheduler-engine.ts`), not a plugin. It provides tools to schedule workflows:
- `schedule_task_once`: Schedule a workflow to run once at a specific datetime
- `schedule_task_periodic`: Schedule a workflow to run periodically (every X minutes)
- `list_scheduled_tasks`: List all scheduled tasks with their status
- `cancel_scheduled_task`: Cancel and delete a scheduled task
- `pause_scheduled_task`: Pause a task without deleting it
- `resume_scheduled_task`: Resume a paused task
- `get_task_history`: View execution history for a task

**Features:**
- SQLite database for persistent storage (`data/scheduler.db`)
- Automatic background execution every minute
- Execution history tracking with success/failure status
- One-time tasks are automatically disabled after execution
- Periodic tasks use `nextExecuteAt` to track when to run next (first execution is after the interval, not immediately)

**Usage Examples:**
```
> Schedule a container restart every 6 hours
Agent: [Uses schedule_task_periodic]
       Task "Container Restart" scheduled. First execution in 6 hours.

> Schedule a backup tomorrow at 2am
Agent: [Uses schedule_task_once with executeAt="2026-01-19T02:00:00Z"]
       Task "Backup" scheduled for 2026-01-19 at 02:00:00

> What tasks are scheduled?
Agent: [Uses list_scheduled_tasks]
       Found 2 scheduled tasks:
       1. Container Restart (periodic, every 6 hours, next run in 6 hours)
       2. Backup (once, in 8 hours)
```

**Implementation Notes:**
- Initialized in `src/index.ts` with WorkflowEngine dependency
- Tools registered via `pluginLoader.registerCoreTools('scheduler', ...)`
- Uses `better-sqlite3` for database operations
- Background scheduler checks for due tasks every 60 seconds
- Tasks are executed in background, preventing overlap

## Configuration

All configuration is done via environment variables in `.env`:

### Required
- `OPENAI_API_KEY` - Your OpenAI API key

### OpenAI Settings
- `OPENAI_MODEL` - Model to use (default: `gpt-4-turbo-preview`)
- `OPENAI_TEMPERATURE` - Temperature for responses (default: `0.7`)
- `OPENAI_MAX_TOKENS` - Max tokens per response (optional)

### System Settings
- `SYSTEM_PROMPT` - Custom system prompt for the agent
- `INTERFACE_MODE` - Interface to use: `cli` or `telegram` (default: `cli`)
- `PLUGINS_DIR` - Directory containing plugins (default: `./plugins`)
- `LOG_LEVEL` - Logging level: `debug`, `info`, `warn`, `error` (default: `info`)

### Telegram Bot Settings (only if INTERFACE_MODE=telegram)
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather (required for telegram mode)
- `TELEGRAM_ALLOWED_USERS` - Comma-separated list of Telegram user IDs allowed to use bot

**Example for Telegram mode:**
```bash
INTERFACE_MODE=telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_ALLOWED_USERS=123456789,987654321
```

To get your Telegram user ID, message @userinfobot on Telegram.

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Build and run:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop:**
   ```bash
   docker-compose down
   ```

### Manual Docker Build

```bash
# Build image
docker build -t ai-agent .

# Run (CLI mode)
docker run -it --env-file .env ai-agent

# Run (Telegram mode)
docker run -d --env-file .env ai-agent
```

### Docker Access to Host Docker

If you need the Docker plugin to manage containers on the host:

```yaml
# In docker-compose.yml, uncomment:
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

**Security Note:** This gives the container access to the host's Docker daemon. Only use in trusted environments.

## Adding New Plugins

1. Create plugin folder: `mkdir plugins/my-plugin`
2. Copy structure from example plugins
3. Implement the Plugin interface
4. Export plugin instance as default
5. Restart agent - it will auto-discover and load

The plugin system uses dynamic imports, so plugins are loaded at runtime from the compiled JavaScript in `plugins/*/index.js`.

## OpenAI Integration

The agent uses OpenAI's function calling:
1. User sends message
2. Agent includes all tools as available functions
3. OpenAI decides which tools to call (if any)
4. Agent executes selected tools
5. Results are sent back to OpenAI
6. Loop continues until OpenAI returns a text response

This means:
- Tools are automatically selected based on conversation context
- No manual tool routing needed
- LLM decides when and how to use tools
- Multiple tools can be called in sequence

## CLI Commands

When running the agent in CLI mode:
- `/workflow <name> [params]` - Execute a workflow (params as JSON)
- `/tools` - List all available tools
- `/workflows` - List all available workflows
- `/clear` - Clear conversation history
- `/exit` - Exit the agent

When running as Telegram bot:
- `/start` - Show welcome message
- `/tools` - List all available tools
- `/workflows` - List all available workflows
- `/workflow <name> [params]` - Execute a workflow
- `/clear` - Clear conversation history
- `/help` - Show help message

## Project Structure Reference

```
src/
├── core/
│   ├── agent.ts              # Main agent with OpenAI integration
│   ├── plugin-loader.ts      # Plugin auto-discovery and loading
│   ├── workflow-engine.ts    # Workflow execution engine
│   ├── scheduler-engine.ts   # Scheduled task execution engine
│   ├── scheduler-tools.ts    # Scheduler tool definitions
│   └── tool-executor.ts      # Tool execution utility
├── interfaces/
│   ├── cli.ts                # Command-line interface
│   └── telegram-bot.ts       # Telegram bot interface
├── types/
│   ├── plugin.ts             # Plugin, Tool, Workflow interfaces
│   └── agent.ts              # Agent types and configs
├── utils/                    # Utility functions
└── index.ts                  # Main entry point (CLI or Telegram)

plugins/                      # User plugins directory
├── docker/                   # Docker management plugin (example)
│   └── index.ts
└── your-plugin/              # Add your plugins here
    └── index.ts

data/
└── scheduler.db              # SQLite database for scheduled tasks

Dockerfile                    # Docker container configuration
docker-compose.yml            # Docker Compose orchestration
.env.example                  # Environment variables template
```

## Important Notes

- **Module System**: Uses ES modules (`"type": "module"` in package.json)
- **Import Extensions**: Always use `.js` extension in imports (even for `.ts` files)
- **Compilation**: TypeScript compiles to `dist/`, plugins must be built too
- **Plugin Discovery**: Only looks for `index.js` in plugin folders (after build)
- **Tool Names**: Must be unique across all plugins
- **Workflow Names**: Must be unique across all plugins
- **Parameter Validation**: Happens automatically via Zod before execute()
- **Error Handling**: Errors in tools are caught and returned to LLM with context
- do not write new .MD for results and docs, add everything to readme, claude, architecture, changelog
- After a change always run lint and test (at least test files that has changed)
