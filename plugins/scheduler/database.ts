import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export interface ScheduledTask {
  id: string;
  name: string;
  workflowName: string;
  parameters: string; // JSON string
  scheduleType: 'once' | 'periodic';
  executeAt: string | null; // ISO datetime for one-time tasks
  intervalMinutes: number | null; // For periodic tasks
  lastExecutedAt: string | null; // ISO datetime
  createdAt: string; // ISO datetime
  enabled: number; // SQLite boolean (0 or 1)
  executionCount: number;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  executedAt: string; // ISO datetime
  success: number; // SQLite boolean (0 or 1)
  error: string | null;
  result: string | null; // JSON string
}

export class SchedulerDatabase {
  private db: Database.Database;

  constructor(dbPath: string = path.join(process.cwd(), 'data', 'scheduler.db')) {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    // Create scheduled_tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        workflowName TEXT NOT NULL,
        parameters TEXT NOT NULL,
        scheduleType TEXT NOT NULL CHECK(scheduleType IN ('once', 'periodic')),
        executeAt TEXT,
        intervalMinutes INTEGER,
        lastExecutedAt TEXT,
        createdAt TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        executionCount INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create task_executions table for history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_executions (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        executedAt TEXT NOT NULL,
        success INTEGER NOT NULL,
        error TEXT,
        result TEXT,
        FOREIGN KEY (taskId) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
      )
    `);

    // Create index for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_enabled_tasks
      ON scheduled_tasks(enabled, scheduleType)
    `);
  }

  createTask(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'executionCount' | 'lastExecutedAt' | 'enabled'>): string {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO scheduled_tasks
      (id, name, workflowName, parameters, scheduleType, executeAt, intervalMinutes, createdAt, enabled, executionCount, lastExecutedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL)
    `);

    stmt.run(
      id,
      task.name,
      task.workflowName,
      task.parameters,
      task.scheduleType,
      task.executeAt || null,
      task.intervalMinutes || null,
      createdAt
    );

    return id;
  }

  getTask(id: string): ScheduledTask | undefined {
    const stmt = this.db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?');
    return stmt.get(id) as ScheduledTask | undefined;
  }

  getAllTasks(includeDisabled: boolean = false): ScheduledTask[] {
    const query = includeDisabled
      ? 'SELECT * FROM scheduled_tasks ORDER BY createdAt DESC'
      : 'SELECT * FROM scheduled_tasks WHERE enabled = 1 ORDER BY createdAt DESC';

    const stmt = this.db.prepare(query);
    return stmt.all() as ScheduledTask[];
  }

  getTasksByType(type: 'once' | 'periodic', includeDisabled: boolean = false): ScheduledTask[] {
    const query = includeDisabled
      ? 'SELECT * FROM scheduled_tasks WHERE scheduleType = ? ORDER BY createdAt DESC'
      : 'SELECT * FROM scheduled_tasks WHERE scheduleType = ? AND enabled = 1 ORDER BY createdAt DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(type) as ScheduledTask[];
  }

  getDueTasks(): ScheduledTask[] {
    const now = new Date().toISOString();

    // Get one-time tasks that are due
    const onceStmt = this.db.prepare(`
      SELECT * FROM scheduled_tasks
      WHERE enabled = 1
        AND scheduleType = 'once'
        AND executeAt <= ?
    `);
    const onceTasks = onceStmt.all(now) as ScheduledTask[];

    // Get periodic tasks that need to run
    const periodicStmt = this.db.prepare(`
      SELECT * FROM scheduled_tasks
      WHERE enabled = 1
        AND scheduleType = 'periodic'
        AND (
          lastExecutedAt IS NULL
          OR datetime(lastExecutedAt, '+' || intervalMinutes || ' minutes') <= datetime(?)
        )
    `);
    const periodicTasks = periodicStmt.all(now) as ScheduledTask[];

    return [...onceTasks, ...periodicTasks];
  }

  updateTaskExecution(taskId: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE scheduled_tasks
      SET lastExecutedAt = ?, executionCount = executionCount + 1
      WHERE id = ?
    `);
    stmt.run(now, taskId);
  }

  deleteTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM scheduled_tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  enableTask(id: string): boolean {
    const stmt = this.db.prepare('UPDATE scheduled_tasks SET enabled = 1 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  disableTask(id: string): boolean {
    const stmt = this.db.prepare('UPDATE scheduled_tasks SET enabled = 0 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Execution history methods
  logExecution(execution: Omit<TaskExecution, 'id'>): string {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO task_executions (id, taskId, executedAt, success, error, result)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      execution.taskId,
      execution.executedAt,
      execution.success,
      execution.error || null,
      execution.result || null
    );

    return id;
  }

  getExecutionHistory(taskId: string, limit: number = 10): TaskExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM task_executions
      WHERE taskId = ?
      ORDER BY executedAt DESC
      LIMIT ?
    `);
    return stmt.all(taskId, limit) as TaskExecution[];
  }

  close(): void {
    this.db.close();
  }
}
