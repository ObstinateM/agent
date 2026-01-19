# AI Agent System

A modular TypeScript AI Agent system powered by OpenAI GPT with a plugin-based architecture for integrating custom tools and workflows.

## Features

- 🔌 **Plugin System**: Drop-in plugin architecture for easy extensibility
- 🤖 **OpenAI Integration**: Automatic tool selection using GPT function calling
- 🔄 **Workflow Engine**: Execute predefined sequences of tool calls
- ⏰ **Task Scheduler**: Schedule workflows to run once or periodically with SQLite persistence
- 🛠️ **Type-Safe**: Full TypeScript with Zod schema validation
- 🔍 **Auto-Discovery**: Plugins are automatically loaded at startup
- 💬 **Multiple Interfaces**: CLI and Telegram bot support
- 🐳 **Docker Ready**: Containerized with Docker and Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment file and add your OpenAI API key
cp .env.example .env
# Edit .env and set OPENAI_API_KEY
```

### Running

**Option 1: Local Development**
```bash
# Development mode
npm run dev

# Development mode (with hot reload)
npm run dev:watch

# Build and run
npm run build
npm start
```

**Option 2: Docker (Recommended for Production)**
```bash
# Using Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### Interface Modes

**CLI Mode (default):**
```bash
# In .env
INTERFACE_MODE=cli

# Then run
npm run dev
```

**Telegram Bot Mode:**
```bash
# Get bot token from @BotFather on Telegram
# In .env
INTERFACE_MODE=telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ALLOWED_USERS=your_telegram_user_id

# Then run
npm run dev
# or
docker-compose up -d
```

## Project Structure

```
├── src/
│   ├── core/           # Core agent, plugin loader, workflow engine
│   ├── types/          # TypeScript interfaces and types
│   ├── interfaces/     # CLI and Telegram bot interfaces
│   └── index.ts        # Main entry point
├── plugins/            # Plugin directory
│   ├── docker/         # Docker management plugin
│   ├── scheduler/      # Task scheduler plugin (with SQLite)
│   ├── script-runner/  # Shell script execution plugin
│   └── telegram/       # Telegram bot interface plugin
├── data/               # Data directory (SQLite databases)
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose configuration
└── CLAUDE.md           # Detailed documentation for Claude Code
```

## Creating a Plugin

1. Create a folder in `plugins/`:
```bash
mkdir plugins/my-plugin
```

2. Create `index.ts` that implements the `Plugin` interface:

```typescript
import { z } from 'zod';
import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';

class MyPlugin implements Plugin {
  metadata = {
    name: 'my-plugin',
    version: '1.0.0',
    description: 'My custom plugin',
  };

  async initialize(): Promise<void> {
    // Setup code
  }

  getTools(): Tool[] {
    return [{
      definition: {
        name: 'my_tool',
        description: 'What my tool does',
        parameters: z.object({
          input: z.string().describe('Input parameter'),
        }),
      },
      execute: async (params) => {
        return `Processed: ${params.input}`;
      },
    }];
  }

  getWorkflows(): Workflow[] {
    return [];
  }
}

export default new MyPlugin();
```

3. Restart the agent - your plugin will be automatically loaded!

## Usage

### Interactive CLI

```bash
npm run dev
```

Available commands:
- `/tools` - List all available tools
- `/workflows` - List all available workflows
- `/workflow <name> {"param": "value"}` - Execute a workflow
- `/clear` - Clear conversation history
- `/exit` - Exit

### Chat Examples

```
> List all my Docker containers
🤖 [Agent uses docker_list_containers tool and shows results]

> Start the container named web-app
🤖 [Agent uses docker_start_container tool]

> Check system health
🤖 [Agent uses get_system_info and other tools]
```

### Workflow Execution

```
> /workflow restart_container {"container": "my-container"}
```

## Included Plugins

### Docker Plugin
Manage Docker containers with tools like:
- `docker_list_containers`
- `docker_start_container`
- `docker_stop_container`
- `docker_container_logs`
- `docker_exec_command`

### Script Runner Plugin
Execute shell commands and scripts:
- `run_shell_command`
- `run_bash_script`
- `check_process`
- `get_system_info`

### Scheduler Plugin
Schedule workflows to run at specific times or periodically:
- `schedule_task_once` - Run a workflow once at a specific datetime
- `schedule_task_periodic` - Run a workflow every X minutes/hours/days
- `list_scheduled_tasks` - List all scheduled tasks
- `cancel_scheduled_task` - Cancel a scheduled task
- `pause_scheduled_task` / `resume_scheduled_task` - Pause/resume tasks
- `get_task_history` - View execution history for a task

**Features:**
- SQLite database for persistent storage
- Automatic background execution
- Execution history tracking
- One-time and periodic scheduling

### Telegram Plugin
Telegram bot interface for remote agent access:
- Provides complete bot interface when `INTERFACE_MODE=telegram`
- User access control via whitelist
- All agent features accessible through Telegram
- Commands: `/start`, `/tools`, `/workflows`, `/workflow`, `/clear`, `/help`

**Features:**
- Modular plugin-based interface (can be removed if not needed)
- Automatic dependency injection (Agent, WorkflowEngine, PluginLoader)
- Natural language chat with the agent
- Remote access from any Telegram client

## Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Testing
npm test
npm test:watch
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with UI
npm test:ui

# Type checking
npm run type-check
```

**Test Status:** ✅ 85 passing tests across all modules

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Complete developer guide for Claude Code and contributors
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture diagrams and design decisions
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes

## Environment Variables

All configuration is done via `.env`:

```bash
# Required
OPENAI_API_KEY=your_api_key_here

# OpenAI Settings (optional)
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000

# Interface Mode
INTERFACE_MODE=cli  # or 'telegram'

# Telegram Settings (required if INTERFACE_MODE=telegram)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_USERS=123456789,987654321  # comma-separated user IDs

# System Settings (optional)
SYSTEM_PROMPT=You are a helpful AI assistant
PLUGINS_DIR=./plugins
LOG_LEVEL=info
```

### Telegram Bot Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) on Telegram
2. Get your user ID from [@userinfobot](https://t.me/userinfobot)
3. Set `INTERFACE_MODE=telegram` in `.env`
4. Add your bot token and user ID to `.env`
5. Run with `npm run dev` or `docker-compose up -d`

## Production Deployment

**Docker Compose (Recommended):**
```bash
cp .env.example .env
# Configure .env with your settings
docker-compose up -d
docker-compose logs -f
```

**Systemd Service:**
```ini
[Unit]
Description=AI Agent System
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/agent
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## License

MIT
