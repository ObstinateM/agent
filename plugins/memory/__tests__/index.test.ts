import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import path from 'path';
import MemoryPlugin from '../index.js';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-memory.db');

class TestableMemoryPlugin {
  private plugin: typeof MemoryPlugin;

  constructor() {
    // Create a new instance with test database
    const PluginClass = (MemoryPlugin as any).constructor;
    this.plugin = new PluginClass(TEST_DB_PATH);
  }

  async initialize() {
    await this.plugin.initialize();
  }

  async cleanup() {
    await this.plugin.cleanup?.();
  }

  getTools() {
    return this.plugin.getTools();
  }

  storeMemory(key: string, value: string, category?: string) {
    return (this.plugin as any).storeMemory(key, value, category);
  }

  getMemory(key: string) {
    return (this.plugin as any).getMemory(key);
  }

  searchMemories(query: string, category?: string) {
    return (this.plugin as any).searchMemories(query, category);
  }

  listMemories(category?: string, limit?: number) {
    return (this.plugin as any).listMemories(category, limit);
  }

  deleteMemory(key: string) {
    return (this.plugin as any).deleteMemory(key);
  }
}

describe('MemoryPlugin', () => {
  let plugin: TestableMemoryPlugin;

  beforeEach(async () => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    plugin = new TestableMemoryPlugin();
    await plugin.initialize();
  });

  afterEach(async () => {
    await plugin.cleanup();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe('storeMemory', () => {
    it('should store a new memory', () => {
      const memory = plugin.storeMemory('lol_nickname', 'Obstinate');

      expect(memory.key).toBe('lol_nickname');
      expect(memory.value).toBe('Obstinate');
      expect(memory.id).toBeDefined();
      expect(memory.createdAt).toBeDefined();
    });

    it('should store memory with category', () => {
      const memory = plugin.storeMemory('lol_nickname', 'Obstinate', 'gaming');

      expect(memory.category).toBe('gaming');
    });

    it('should update existing memory', () => {
      plugin.storeMemory('lol_nickname', 'OldNick');
      const updated = plugin.storeMemory('lol_nickname', 'Obstinate');

      expect(updated.value).toBe('Obstinate');

      const retrieved = plugin.getMemory('lol_nickname');
      expect(retrieved?.value).toBe('Obstinate');
    });
  });

  describe('getMemory', () => {
    it('should retrieve stored memory', () => {
      plugin.storeMemory('favorite_color', 'blue');

      const memory = plugin.getMemory('favorite_color');

      expect(memory?.value).toBe('blue');
    });

    it('should return undefined for non-existent key', () => {
      const memory = plugin.getMemory('non_existent');

      expect(memory).toBeUndefined();
    });
  });

  describe('searchMemories', () => {
    beforeEach(() => {
      plugin.storeMemory('lol_nickname', 'Obstinate', 'gaming');
      plugin.storeMemory('valorant_rank', 'Diamond', 'gaming');
      plugin.storeMemory('favorite_food', 'Pizza', 'personal');
    });

    it('should find memories by key match', () => {
      const results = plugin.searchMemories('lol');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('lol_nickname');
    });

    it('should find memories by value match', () => {
      const results = plugin.searchMemories('Diamond');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('valorant_rank');
    });

    it('should filter by category', () => {
      const results = plugin.searchMemories('a', 'gaming');

      expect(results).toHaveLength(2);
      expect(results.every((m) => m.category === 'gaming')).toBe(true);
    });

    it('should return empty array when no matches', () => {
      const results = plugin.searchMemories('xyz123');

      expect(results).toHaveLength(0);
    });
  });

  describe('listMemories', () => {
    beforeEach(() => {
      plugin.storeMemory('key1', 'value1', 'cat1');
      plugin.storeMemory('key2', 'value2', 'cat1');
      plugin.storeMemory('key3', 'value3', 'cat2');
    });

    it('should list all memories', () => {
      const memories = plugin.listMemories();

      expect(memories).toHaveLength(3);
    });

    it('should filter by category', () => {
      const memories = plugin.listMemories('cat1');

      expect(memories).toHaveLength(2);
    });

    it('should respect limit', () => {
      const memories = plugin.listMemories(undefined, 2);

      expect(memories).toHaveLength(2);
    });
  });

  describe('deleteMemory', () => {
    it('should delete existing memory', () => {
      plugin.storeMemory('to_delete', 'value');

      const deleted = plugin.deleteMemory('to_delete');

      expect(deleted).toBe(true);
      expect(plugin.getMemory('to_delete')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      const deleted = plugin.deleteMemory('non_existent');

      expect(deleted).toBe(false);
    });
  });

  describe('tools', () => {
    it('should expose five tools', () => {
      const tools = plugin.getTools();

      expect(tools).toHaveLength(5);
      expect(tools.map((t) => t.definition.name)).toEqual([
        'memory_store',
        'memory_recall',
        'memory_search',
        'memory_list',
        'memory_delete',
      ]);
    });

    describe('memory_store tool', () => {
      it('should store and return confirmation', async () => {
        const tools = plugin.getTools();
        const storeTool = tools.find((t) => t.definition.name === 'memory_store')!;

        const result = await storeTool.execute({
          key: 'test_key',
          value: 'test_value',
          category: 'test',
        });

        expect(result).toBe('Stored: "test_key" = "test_value" (category: test)');
      });
    });

    describe('memory_recall tool', () => {
      it('should recall stored memory', async () => {
        plugin.storeMemory('recall_test', 'my_value', 'test');

        const tools = plugin.getTools();
        const recallTool = tools.find((t) => t.definition.name === 'memory_recall')!;

        const result = await recallTool.execute({ key: 'recall_test' });

        expect(result).toBe('recall_test: my_value (category: test)');
      });

      it('should return message for non-existent key', async () => {
        const tools = plugin.getTools();
        const recallTool = tools.find((t) => t.definition.name === 'memory_recall')!;

        const result = await recallTool.execute({ key: 'missing' });

        expect(result).toBe('No memory found with key "missing"');
      });
    });

    describe('memory_search tool', () => {
      it('should search and format results', async () => {
        plugin.storeMemory('lol_nickname', 'Obstinate', 'gaming');

        const tools = plugin.getTools();
        const searchTool = tools.find((t) => t.definition.name === 'memory_search')!;

        const result = await searchTool.execute({ query: 'lol' });

        expect(result).toContain('Found 1 memory');
        expect(result).toContain('lol_nickname: Obstinate');
      });
    });

    describe('memory_list tool', () => {
      it('should list all memories', async () => {
        plugin.storeMemory('key1', 'value1');
        plugin.storeMemory('key2', 'value2');

        const tools = plugin.getTools();
        const listTool = tools.find((t) => t.definition.name === 'memory_list')!;

        const result = await listTool.execute({});

        expect(result).toContain('Stored memories (2)');
      });
    });

    describe('memory_delete tool', () => {
      it('should delete and confirm', async () => {
        plugin.storeMemory('to_delete', 'value');

        const tools = plugin.getTools();
        const deleteTool = tools.find((t) => t.definition.name === 'memory_delete')!;

        const result = await deleteTool.execute({ key: 'to_delete' });

        expect(result).toBe('Deleted memory: "to_delete"');
      });
    });
  });
});
