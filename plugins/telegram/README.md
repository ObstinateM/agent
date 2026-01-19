# Telegram Plugin

Telegram bot interface for the AI Agent. Allows remote access to the agent via Telegram.

## Configuration

Add these to your `.env` file:

```bash
# Required: Set interface mode to telegram
INTERFACE_MODE=telegram

# Required: Bot token from @BotFather
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Optional: Restrict access to specific user IDs (comma-separated)
# Leave empty to allow all users (not recommended for production)
TELEGRAM_ALLOWED_USERS=123456789,987654321
```

### Getting Your Bot Token

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the instructions
3. Copy the token provided

### Getting Your User ID

1. Open Telegram and search for `@userinfobot`
2. Start a conversation - it will reply with your user ID

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message |
| `/tools` | List all available tools |
| `/workflows` | List all available workflows |
| `/workflow <name> [params]` | Execute a workflow with optional JSON params |
| `/clear` | Clear conversation history |
| `/help` | Show help message |

## Usage

Once configured, simply send messages to your bot:

```
You: What's the weather like?
Bot: 🤔 Thinking...
Bot: [Agent response using available tools]
```

### Executing Workflows

```
You: /workflow system_health_check
Bot: ⏳ Executing workflow: system_health_check...
Bot: ✅ Workflow completed successfully!
```

With parameters:
```
You: /workflow restart_container {"containerName": "my-app"}
```

## How It Works

1. **Initialization**: Plugin creates a Telegraf bot instance when `INTERFACE_MODE=telegram`
2. **Authentication**: Each message is checked against `TELEGRAM_ALLOWED_USERS`
3. **Message Handling**: Text messages are forwarded to the AI Agent
4. **Tool Execution**: Agent can use all registered tools to respond
5. **Response**: Bot sends the agent's response back to the user

## Security

- Always set `TELEGRAM_ALLOWED_USERS` in production
- Keep your bot token secret
- The bot only responds to authorized users
- Unauthorized users receive "You are not authorized to use this bot."

## Architecture

```
plugins/telegram/
├── index.ts      # Main plugin, bot setup and handlers
├── tools.ts      # Tool definitions (none currently)
├── workflows.ts  # Workflow definitions (none currently)
└── __tests__/
    └── index.test.ts
```

## Limitations

- Single conversation history shared across all users
- No inline keyboard support (text commands only)
- No file/media handling
