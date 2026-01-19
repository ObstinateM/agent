# Memory Plugin

Long-term memory storage for the AI agent. Allows the LLM to store and recall facts, preferences, and context that persists across conversations.

## Configuration

No additional configuration required. The plugin automatically creates a SQLite database at `data/memory.db`.

## Tools

### `memory_store`
Store information in long-term memory.

**Parameters:**
- `key` (string, required): Unique identifier for the memory (e.g., "user_nickname", "favorite_color")
- `value` (string, required): The information to remember
- `category` (string, optional): Category for organization (e.g., "gaming", "personal", "work")

**Example:**
```
User: Remember that my League of Legends nickname is "ProGamer123"
Agent: [uses memory_store with key="lol_nickname", value="ProGamer123", category="gaming"]
```

### `memory_recall`
Retrieve a specific memory by its key.

**Parameters:**
- `key` (string, required): The key of the memory to retrieve

**Example:**
```
User: What's my LoL nickname?
Agent: [uses memory_recall with key="lol_nickname"]
```

### `memory_search`
Search through stored memories by keyword.

**Parameters:**
- `query` (string, required): Search term to find in memory keys and values
- `category` (string, optional): Filter results by category

**Example:**
```
User: What gaming info do you have about me?
Agent: [uses memory_search with query="game", category="gaming"]
```

### `memory_list`
List all stored memories.

**Parameters:**
- `category` (string, optional): Filter by category
- `limit` (number, optional): Maximum results (default: 50)

**Example:**
```
User: Show me everything you remember about me
Agent: [uses memory_list]
```

### `memory_delete`
Delete a memory by its key.

**Parameters:**
- `key` (string, required): The key of the memory to delete

**Example:**
```
User: Forget my nickname
Agent: [uses memory_delete with key="lol_nickname"]
```

## How It Works

1. **Storage**: Memories are stored in a SQLite database (`data/memory.db`) with unique keys
2. **Updates**: Storing with an existing key updates the value
3. **Search**: Full-text search on both keys and values
4. **Persistence**: Data persists across agent restarts

## Database Schema

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
)
```

## Best Practices

- Use descriptive, searchable keys (e.g., "user_birthday" not "bd")
- Organize with categories for easier filtering
- The agent should proactively search memories when relevant topics come up
