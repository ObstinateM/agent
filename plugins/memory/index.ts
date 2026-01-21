import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { mkdirSync } from 'fs';
import path from 'path';
import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';
import { createTools } from './tools.js';
import { createWorkflows } from './workflows.js';
import { logger } from '../../src/utils/logger.js';

interface Memory {
  id: string;
  key: string;
  value: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Memory Plugin provides persistent storage for information the agent should remember.
 * The LLM can store facts, preferences, and context that persists across conversations.
 */
class MemoryPlugin implements Plugin {
  metadata = {
    name: 'memory',
    version: '1.0.0',
    description: 'Long-term memory storage for the AI agent',
    author: 'AI Agent System',
  };

  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'memory.db');
  }

  async initialize(): Promise<void> {
    mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.initializeTables();
    logger.info('Memory plugin initialized');
  }

  private initializeTables(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        category TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_key ON memories(key)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_category ON memories(category)
    `);
  }

  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Memory plugin not initialized');
    }
    return this.db;
  }

  /**
   * Store or update a memory entry.
   */
  storeMemory(key: string, value: string, category?: string): Memory {
    const db = this.getDb();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM memories WHERE key = ?').get(key) as
      | { id: string }
      | undefined;

    if (existing) {
      db.prepare('UPDATE memories SET value = ?, category = ?, updatedAt = ? WHERE key = ?').run(
        value,
        category || null,
        now,
        key
      );
      return this.getMemory(key)!;
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO memories (id, key, value, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, key, value, category || null, now, now);

    return { id, key, value, category: category || null, createdAt: now, updatedAt: now };
  }

  /**
   * Retrieve a memory by its key.
   */
  getMemory(key: string): Memory | undefined {
    const db = this.getDb();
    return db.prepare('SELECT * FROM memories WHERE key = ?').get(key) as Memory | undefined;
  }

  /**
   * Search memories by keyword in keys and values.
   */
  searchMemories(query: string, category?: string): Memory[] {
    const db = this.getDb();
    const searchPattern = `%${query}%`;

    if (category) {
      return db
        .prepare(
          'SELECT * FROM memories WHERE category = ? AND (key LIKE ? OR value LIKE ?) ORDER BY updatedAt DESC'
        )
        .all(category, searchPattern, searchPattern) as Memory[];
    }

    return db
      .prepare(
        'SELECT * FROM memories WHERE key LIKE ? OR value LIKE ? ORDER BY updatedAt DESC'
      )
      .all(searchPattern, searchPattern) as Memory[];
  }

  /**
   * List all memories, optionally filtered by category.
   */
  listMemories(category?: string, limit: number = 50): Memory[] {
    const db = this.getDb();

    if (category) {
      return db
        .prepare('SELECT * FROM memories WHERE category = ? ORDER BY updatedAt DESC LIMIT ?')
        .all(category, limit) as Memory[];
    }

    return db
      .prepare('SELECT * FROM memories ORDER BY updatedAt DESC LIMIT ?')
      .all(limit) as Memory[];
  }

  /**
   * Delete a memory by its key.
   */
  deleteMemory(key: string): boolean {
    const db = this.getDb();
    const result = db.prepare('DELETE FROM memories WHERE key = ?').run(key);
    return result.changes > 0;
  }

  getTools(): Tool[] {
    return createTools(this);
  }

  getWorkflows(): Workflow[] {
    return createWorkflows();
  }

  async cleanup(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    logger.info('Memory plugin cleaned up');
  }
}

export default new MemoryPlugin();
