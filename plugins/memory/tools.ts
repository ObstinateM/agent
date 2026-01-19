import { z } from 'zod';
import { Tool } from '../../src/types/plugin.js';

interface Memory {
  id: string;
  key: string;
  value: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemoryStore {
  storeMemory(key: string, value: string, category?: string): Memory;
  getMemory(key: string): Memory | undefined;
  searchMemories(query: string, category?: string): Memory[];
  listMemories(category?: string, limit?: number): Memory[];
  deleteMemory(key: string): boolean;
}

/**
 * Create memory plugin tools.
 */
export function createTools(store: MemoryStore): Tool[] {
  return [
    {
      definition: {
        name: 'memory_store',
        description:
          'Store information in long-term memory. Use this to remember facts, preferences, identifiers, or any information the user wants to save for later. The key should be descriptive and searchable (e.g., "lol_nickname", "favorite_color", "home_address").',
        parameters: z.object({
          key: z
            .string()
            .describe(
              'A unique, descriptive identifier for this memory (e.g., "lol_nickname", "birthday")'
            ),
          value: z.string().describe('The information to remember'),
          category: z
            .string()
            .optional()
            .describe(
              'Optional category to organize memories (e.g., "gaming", "personal", "work")'
            ),
        }),
      },
      execute: async (params) => {
        const { key, value, category } = params as {
          key: string;
          value: string;
          category?: string;
        };
        store.storeMemory(key, value, category);
        return `Stored: "${key}" = "${value}"${category ? ` (category: ${category})` : ''}`;
      },
    },
    {
      definition: {
        name: 'memory_recall',
        description:
          'Retrieve a specific memory by its key. Use this when you need to recall exact information that was previously stored.',
        parameters: z.object({
          key: z.string().describe('The key of the memory to retrieve'),
        }),
      },
      execute: async (params) => {
        const { key } = params as { key: string };
        const memory = store.getMemory(key);
        if (!memory) {
          return `No memory found with key "${key}"`;
        }
        return `${memory.key}: ${memory.value}${memory.category ? ` (category: ${memory.category})` : ''}`;
      },
    },
    {
      definition: {
        name: 'memory_search',
        description:
          'Search through stored memories by keyword. IMPORTANT: Use this proactively when the user mentions something that might have related stored information (nicknames, usernames, preferences, etc.). For example, if user asks about their OP.GG stats, search for gaming-related memories first.',
        parameters: z.object({
          query: z
            .string()
            .describe('Search term to find in memory keys and values'),
          category: z
            .string()
            .optional()
            .describe('Optional category to filter results'),
        }),
      },
      execute: async (params) => {
        const { query, category } = params as { query: string; category?: string };
        const memories = store.searchMemories(query, category);
        if (memories.length === 0) {
          return `No memories found matching "${query}"${category ? ` in category "${category}"` : ''}`;
        }
        const results = memories
          .map((m) => `- ${m.key}: ${m.value}${m.category ? ` [${m.category}]` : ''}`)
          .join('\n');
        return `Found ${memories.length} memory(ies):\n${results}`;
      },
    },
    {
      definition: {
        name: 'memory_list',
        description: 'List all stored memories, optionally filtered by category.',
        parameters: z.object({
          category: z.string().optional().describe('Optional category to filter by'),
          limit: z
            .number()
            .optional()
            .describe('Maximum number of memories to return (default: 50)'),
        }),
      },
      execute: async (params) => {
        const { category, limit } = params as { category?: string; limit?: number };
        const memories = store.listMemories(category, limit);
        if (memories.length === 0) {
          return category
            ? `No memories found in category "${category}"`
            : 'No memories stored yet';
        }
        const results = memories
          .map((m) => `- ${m.key}: ${m.value}${m.category ? ` [${m.category}]` : ''}`)
          .join('\n');
        return `Stored memories (${memories.length}):\n${results}`;
      },
    },
    {
      definition: {
        name: 'memory_delete',
        description: 'Delete a memory by its key.',
        parameters: z.object({
          key: z.string().describe('The key of the memory to delete'),
        }),
      },
      execute: async (params) => {
        const { key } = params as { key: string };
        const deleted = store.deleteMemory(key);
        return deleted ? `Deleted memory: "${key}"` : `No memory found with key "${key}"`;
      },
    },
  ];
}
