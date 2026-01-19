import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { mkdirSync } from 'fs';
import path from 'path';
import type { WorkflowEngine } from './workflow-engine.js';
import { logger } from '../utils/logger.js';

export interface ScheduledTask {
  id: string;
  name: string;
  workflowName: string;
  parameters: string;
  scheduleType: 'once' | 'periodic';
  executeAt: string | null;
  intervalMinutes: number | null;
  lastExecutedAt: string | null;
  nextExecuteAt: string | null;
  createdAt: string;
  enabled: number;
  executionCount: number;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  executedAt: string;
  success: number;
  error: string | null;
  result: string | null;
}

export interface CreateTaskInput {
  name: string;
  workflowName: string;
  parameters: string;
  scheduleType: 'once' | 'periodic';
  executeAt: string | null;
  intervalMinutes: number | null;
}

/**
 * SchedulerEngine manages scheduled task execution.
 * Stores tasks in SQLite and executes workflows at specified times.
 */
export class SchedulerEngine {
  private db: Database.Database;
  private workflowEngine: WorkflowEngine | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs: number = 60000;
  private runningTasks: Set<string> = new Set();

  constructor(dbPath: string = path.join(process.cwd(), 'data', 'scheduler.db')) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
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
        nextExecuteAt TEXT,
        createdAt TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        executionCount INTEGER NOT NULL DEFAULT 0
      )
    `);

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

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_enabled_tasks
      ON scheduled_tasks(enabled, scheduleType)
    `);

    // Run migration before creating index on nextExecuteAt
    this.migrateAddNextExecuteAt();

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_next_execute
      ON scheduled_tasks(enabled, nextExecuteAt)
    `);
  }

  private migrateAddNextExecuteAt(): void {
    const tableInfo = this.db.prepare('PRAGMA table_info(scheduled_tasks)').all() as { name: string }[];
    const hasNextExecuteAt = tableInfo.some((col) => col.name === 'nextExecuteAt');
    if (!hasNextExecuteAt) {
      this.db.exec('ALTER TABLE scheduled_tasks ADD COLUMN nextExecuteAt TEXT');
    }
  }

  /**
   * Set the workflow engine used to execute scheduled workflows.
   */
  setWorkflowEngine(engine: WorkflowEngine): void {
    this.workflowEngine = engine;
  }

  /**
   * Start the scheduler background loop.
   * Should be called AFTER setWorkflowEngine.
   */
  start(): void {
    if (this.intervalId) {
      return;
    }

    logger.info('Starting scheduler engine...');
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler background loop.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Scheduler engine stopped');
    }
  }

  /**
   * Stop the scheduler and close the database connection.
   */
  close(): void {
    this.stop();
    this.db.close();
  }

  /**
   * Create a new scheduled task and return its ID.
   */
  createTask(input: CreateTaskInput): string {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    let nextExecuteAt: string | null = null;
    if (input.scheduleType === 'once' && input.executeAt) {
      nextExecuteAt = input.executeAt;
    } else if (input.scheduleType === 'periodic' && input.intervalMinutes) {
      const next = new Date(Date.now() + input.intervalMinutes * 60 * 1000);
      nextExecuteAt = next.toISOString();
    }

    const stmt = this.db.prepare(`
      INSERT INTO scheduled_tasks
      (id, name, workflowName, parameters, scheduleType, executeAt, intervalMinutes, createdAt, enabled, executionCount, lastExecutedAt, nextExecuteAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.workflowName,
      input.parameters,
      input.scheduleType,
      input.executeAt || null,
      input.intervalMinutes || null,
      createdAt,
      nextExecuteAt
    );

    return id;
  }

  /**
   * Retrieve a task by its ID.
   */
  getTask(id: string): ScheduledTask | undefined {
    const stmt = this.db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?');
    return stmt.get(id) as ScheduledTask | undefined;
  }

  /**
   * Get all scheduled tasks, optionally including disabled ones.
   */
  getAllTasks(includeDisabled: boolean = false): ScheduledTask[] {
    const query = includeDisabled
      ? 'SELECT * FROM scheduled_tasks ORDER BY createdAt DESC'
      : 'SELECT * FROM scheduled_tasks WHERE enabled = 1 ORDER BY createdAt DESC';

    const stmt = this.db.prepare(query);
    return stmt.all() as ScheduledTask[];
  }

  /**
   * Get tasks filtered by schedule type.
   */
  getTasksByType(type: 'once' | 'periodic', includeDisabled: boolean = false): ScheduledTask[] {
    const query = includeDisabled
      ? 'SELECT * FROM scheduled_tasks WHERE scheduleType = ? ORDER BY createdAt DESC'
      : 'SELECT * FROM scheduled_tasks WHERE scheduleType = ? AND enabled = 1 ORDER BY createdAt DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(type) as ScheduledTask[];
  }

  /**
   * Get all tasks that are due for execution.
   */
  getDueTasks(): ScheduledTask[] {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_tasks
      WHERE enabled = 1
        AND nextExecuteAt IS NOT NULL
        AND nextExecuteAt <= ?
    `);

    return stmt.all(now) as ScheduledTask[];
  }

  private updateTaskAfterExecution(taskId: string, task: ScheduledTask): void {
    const now = new Date();
    const nowIso = now.toISOString();

    let nextExecuteAt: string | null = null;
    if (task.scheduleType === 'periodic' && task.intervalMinutes) {
      const next = new Date(now.getTime() + task.intervalMinutes * 60 * 1000);
      nextExecuteAt = next.toISOString();
    }

    const stmt = this.db.prepare(`
      UPDATE scheduled_tasks
      SET lastExecutedAt = ?, executionCount = executionCount + 1, nextExecuteAt = ?
      WHERE id = ?
    `);
    stmt.run(nowIso, nextExecuteAt, taskId);

    if (task.scheduleType === 'once') {
      this.disableTask(taskId);
    }
  }

  /**
   * Delete a task by its ID.
   */
  deleteTask(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM scheduled_tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Enable a paused task.
   */
  enableTask(id: string): boolean {
    const task = this.getTask(id);
    if (!task) return false;

    let nextExecuteAt: string | null = null;
    if (task.scheduleType === 'once' && task.executeAt) {
      nextExecuteAt = task.executeAt;
    } else if (task.scheduleType === 'periodic' && task.intervalMinutes) {
      const next = new Date(Date.now() + task.intervalMinutes * 60 * 1000);
      nextExecuteAt = next.toISOString();
    }

    const stmt = this.db.prepare('UPDATE scheduled_tasks SET enabled = 1, nextExecuteAt = ? WHERE id = ?');
    const result = stmt.run(nextExecuteAt, id);
    return result.changes > 0;
  }

  /**
   * Disable a task without deleting it.
   */
  disableTask(id: string): boolean {
    const stmt = this.db.prepare('UPDATE scheduled_tasks SET enabled = 0, nextExecuteAt = NULL WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Log a task execution result.
   */
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

  /**
   * Get execution history for a task.
   */
  getExecutionHistory(taskId: string, limit: number = 10): TaskExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM task_executions
      WHERE taskId = ?
      ORDER BY executedAt DESC
      LIMIT ?
    `);
    return stmt.all(taskId, limit) as TaskExecution[];
  }

  private async checkAndExecuteTasks(): Promise<void> {
    if (!this.workflowEngine) {
      logger.warn('WorkflowEngine not set, skipping task execution');
      return;
    }

    try {
      const dueTasks = this.getDueTasks();

      for (const task of dueTasks) {
        if (this.runningTasks.has(task.id)) {
          continue;
        }

        this.executeTask(task).catch((error) => {
          logger.error(`Error executing task ${task.name}:`, error);
        });
      }
    } catch (error) {
      logger.error('Error checking for due tasks:', error);
    }
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    this.runningTasks.add(task.id);

    const executedAt = new Date().toISOString();
    let success = false;
    let error: string | null = null;
    let result: unknown = null;

    try {
      logger.info(`Executing scheduled task: ${task.name} (workflow: ${task.workflowName})`);

      const parameters = JSON.parse(task.parameters);

      const workflowResult = await this.workflowEngine!.executeWorkflow(
        task.workflowName,
        parameters
      );

      success = workflowResult.success;
      result = workflowResult;

      if (!success) {
        error = workflowResult.error || 'Workflow execution failed';
      }

      logger.info(`Task ${task.name} completed with success=${success}`);
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      logger.error(`Task ${task.name} failed:`, error);
    } finally {
      this.updateTaskAfterExecution(task.id, task);

      this.logExecution({
        taskId: task.id,
        executedAt,
        success: success ? 1 : 0,
        error,
        result: result ? JSON.stringify(result) : null,
      });

      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Check if the scheduler background loop is running.
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
