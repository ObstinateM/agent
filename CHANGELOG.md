# Changelog

## [1.3.0] - 2026-01-18

### Changed - Telegram as Plugin

#### Architectural Improvement
- **Telegram interface moved to plugin system**
  - Telegram bot is now a modular plugin (`plugins/telegram/`)
  - Can be easily removed if not needed
  - More consistent with plugin architecture
  - Automatic dependency injection

#### Plugin System Enhancements
- **Extended PluginLoader with new injection methods:**
  - `setAgent()` - Inject Agent into plugins
  - `setPluginLoaderReference()` - Inject PluginLoader into plugins
  - `setWorkflowEngine()` - Inject WorkflowEngine (existing, enhanced)

- **Interface plugins support**
  - Plugins can now act as interfaces (not just tools/workflows)
  - Receive full system dependencies (Agent, WorkflowEngine, PluginLoader)
  - Can start background services (like Telegram bot)

#### Code Cleanup
- Removed `src/interfaces/telegram-bot.ts` (moved to plugin)
- Removed direct TelegramBot import from `src/index.ts`
- Simplified main entry point

#### Testing
- 11 new tests for Telegram plugin
- **Total: 85 passing tests** (up from 78)
- All tests pass with no errors

#### Benefits
✅ More modular architecture
✅ Easier to disable Telegram if not needed
✅ Consistent plugin pattern across the system
✅ Better dependency management
✅ Cleaner separation of concerns

### Migration from v1.2.0
No breaking changes for users. The system works exactly the same way:
- Set `INTERFACE_MODE=telegram` in `.env`
- Telegram plugin auto-loads and starts
- All functionality preserved

---

## [1.2.0] - 2026-01-18

### Added - Task Scheduler Plugin

#### New Plugin: Scheduler
- **Full-featured task scheduling system**
  - Schedule workflows to run once at specific times
  - Schedule workflows to run periodically (every X minutes/hours/days)
  - SQLite database for persistent storage across restarts
  - Automatic background execution
  - Execution history tracking

- **7 New Tools:**
  - `schedule_task_once` - Schedule one-time workflow execution
  - `schedule_task_periodic` - Schedule periodic workflow execution
  - `list_scheduled_tasks` - List all scheduled tasks
  - `cancel_scheduled_task` - Cancel a scheduled task
  - `pause_scheduled_task` - Pause a scheduled task
  - `resume_scheduled_task` - Resume a paused task
  - `get_task_history` - View execution history

- **Database System:**
  - SQLite database for persistence
  - Two tables: `scheduled_tasks` and `task_executions`
  - Automatic schema creation and initialization
  - Execution history with success/failure tracking

- **Plugin Integration:**
  - WorkflowEngine injection system
  - Plugins can now receive WorkflowEngine reference
  - PluginLoader enhanced with `setWorkflowEngine()` method

#### Dependencies
- Added `better-sqlite3@^9.2.2` for SQLite database
- Added `uuid@^9.0.1` for unique task IDs
- Added `@types/better-sqlite3` for TypeScript support

#### Testing
- 33 new tests for scheduler plugin
- Database tests for CRUD operations
- Plugin structure and tool validation tests
- **Total: 78 passing tests** (up from 45)

#### Documentation
- Updated README.md with scheduler plugin information
- Updated .gitignore to exclude database files
- Added data/ directory for SQLite databases

### Changed
- PluginLoader now supports WorkflowEngine injection
- Main index.ts calls `setWorkflowEngine()` after initialization

---

## [1.1.0] - 2025-01-18

### Added - Telegram Bot Integration

#### New Features
- **Telegram Bot Interface** (`src/interfaces/telegram-bot.ts`)
  - Full Telegram bot implementation using Telegraf library
  - Natural language chat with AI agent through Telegram
  - Automatic tool selection and execution
  - User access control via whitelist
  - All bot commands: `/start`, `/tools`, `/workflows`, `/workflow`, `/clear`, `/help`

- **Multi-Interface Support**
  - Refactored architecture to support multiple interfaces
  - New CLI interface module (`src/interfaces/cli.ts`)
  - Main entry point (`src/index.ts`) now supports both CLI and Telegram modes
  - Switch between interfaces via `INTERFACE_MODE` environment variable

#### Docker Support
- **Dockerfile**
  - Multi-stage build for optimized image size
  - Node.js 18 Alpine base for minimal footprint
  - Non-root user for security
  - Production-ready configuration

- **Docker Compose** (`docker-compose.yml`)
  - Simple one-command deployment
  - Automatic restart on failure
  - Log rotation configured
  - Volume mounting for plugins
  - Easy access to Docker socket (optional, commented)

- **.dockerignore**
  - Optimized build context
  - Excludes unnecessary files from image

#### Configuration
- **Enhanced .env.example**
  - All OpenAI settings (API key, model, temperature, max tokens)
  - System prompt customization
  - Interface mode selection (`cli` or `telegram`)
  - Telegram bot token
  - Telegram allowed users (comma-separated IDs)
  - Plugins directory path
  - Log level configuration

#### Documentation
- **Updated CLAUDE.md**
  - Docker commands section
  - Interface modes explanation
  - Configuration reference with all environment variables
  - Telegram setup instructions
  - Docker deployment guide
  - Updated project structure

- **Updated README.md**
  - Docker feature highlighted
  - Multiple interfaces feature
  - Docker quick start
  - Interface mode examples
  - Updated project structure

- **New TELEGRAM_SETUP.md**
  - Complete step-by-step Telegram bot setup
  - How to create bot with BotFather
  - How to get Telegram user ID
  - Security configuration
  - Troubleshooting guide
  - Production deployment options
  - Example configurations

- **Updated CHANGELOG.md** (this file)
  - Complete changelog of new features

### Changed
- Refactored `src/index.ts` to support multiple interfaces
- Moved CLI logic from `index.ts` to dedicated `src/interfaces/cli.ts`
- Enhanced error handling for missing environment variables
- Improved startup logging with interface mode detection

### Dependencies
- Added `telegraf@^4.16.3` for Telegram bot functionality

### Technical Details

#### Architecture Changes
```
Before:
src/index.ts (monolithic CLI)

After:
src/
├── index.ts (interface selector)
└── interfaces/
    ├── cli.ts (CLI implementation)
    └── telegram-bot.ts (Telegram implementation)
```

#### Environment Variables
```bash
# New in 1.1.0
INTERFACE_MODE=cli|telegram
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_ALLOWED_USERS=<user_id>,<user_id>
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=<number>
SYSTEM_PROMPT=<custom prompt>
```

#### Docker Images
- Base image: `node:18-alpine`
- Multi-stage build reduces final image size
- Non-root user (uid 1001) for security
- Production dependencies only in final stage

### Migration Guide

#### From 1.0.0 to 1.1.0

**If using CLI (no changes needed):**
```bash
# Just update .env to include new optional variables
cp .env.example .env.new
# Copy your API key to .env.new
# Rename .env.new to .env
```

**To enable Telegram bot:**
```bash
# 1. Get bot token from @BotFather on Telegram
# 2. Get your user ID from @userinfobot
# 3. Update .env:
INTERFACE_MODE=telegram
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_ALLOWED_USERS=your_user_id

# 4. Run with Docker (recommended)
docker-compose up -d

# Or run locally
npm run dev
```

### Security Notes

- **Telegram User Whitelist**: Always set `TELEGRAM_ALLOWED_USERS` in production
- **Bot Token**: Never commit `.env` file with real tokens
- **Docker Socket**: Only mount `/var/run/docker.sock` in trusted environments
- **Non-root User**: Docker container runs as non-root user (nodejs:1001)

### Known Issues

None at this time.

### Upgrade Instructions

```bash
# 1. Pull latest code
git pull

# 2. Install new dependencies
npm install

# 3. Update .env from .env.example
cp .env.example .env
# Add your configuration

# 4. Build if using Docker
docker-compose build

# 5. Restart
docker-compose up -d
# or
npm run dev
```

---

## [1.0.0] - Initial Release

### Features
- Plugin-based architecture
- OpenAI GPT integration with function calling
- Workflow engine
- CLI interface
- Auto-plugin discovery
- Docker and Script Runner example plugins
- Comprehensive documentation
