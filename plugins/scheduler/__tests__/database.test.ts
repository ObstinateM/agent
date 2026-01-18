import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SchedulerDatabase } from '../database.js';
import { unlinkSync, mkdtempSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SchedulerDatabase', () => {
  let db: SchedulerDatabase;
  let testDbPath: string;
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = mkdtempSync(join(tmpdir(), 'scheduler-test-'));
    testDbPath = join(tempDir, 'test.db');
    db = new SchedulerDatabase(testDbPath);
  });

  afterEach(() => {
    db.close();
    try {
      unlinkSync(testDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('createTask', () => {
    it('should create a one-time task', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'test_workflow',
        parameters: JSON.stringify({ param: 'value' }),
        scheduleType: 'once',
        executeAt: new Date('2025-12-31T23:59:59Z').toISOString(),
        intervalMinutes: null,
      });

      expect(taskId).toBeTruthy();
      expect(typeof taskId).toBe('string');
    });

    it('should create a periodic task', () => {
      const taskId = db.createTask({
        name: 'Periodic Task',
        workflowName: 'test_workflow',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      expect(taskId).toBeTruthy();
      const task = db.getTask(taskId);
      expect(task?.intervalMinutes).toBe(60);
    });
  });

  describe('getTask', () => {
    it('should retrieve a task by ID', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'test_workflow',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date().toISOString(),
        intervalMinutes: null,
      });

      const task = db.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId);
      expect(task?.name).toBe('Test Task');
    });

    it('should return undefined for non-existent task', () => {
      const task = db.getTask('non-existent-id');
      expect(task).toBeUndefined();
    });
  });

  describe('getAllTasks', () => {
    it('should return all enabled tasks', () => {
      db.createTask({
        name: 'Task 1',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date().toISOString(),
        intervalMinutes: null,
      });

      db.createTask({
        name: 'Task 2',
        workflowName: 'workflow2',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      const tasks = db.getAllTasks(false);
      expect(tasks.length).toBe(2);
    });

    it('should include disabled tasks when requested', () => {
      const taskId = db.createTask({
        name: 'Task to disable',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date().toISOString(),
        intervalMinutes: null,
      });

      db.disableTask(taskId);

      const enabledTasks = db.getAllTasks(false);
      const allTasks = db.getAllTasks(true);

      expect(enabledTasks.length).toBe(0);
      expect(allTasks.length).toBe(1);
    });
  });

  describe('getDueTasks', () => {
    it('should return one-time tasks that are due', () => {
      // Create a task that's due now
      db.createTask({
        name: 'Due Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
        intervalMinutes: null,
      });

      // Create a task that's not due yet
      db.createTask({
        name: 'Future Task',
        workflowName: 'workflow2',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() + 1000000).toISOString(), // Future
        intervalMinutes: null,
      });

      const dueTasks = db.getDueTasks();
      expect(dueTasks.length).toBe(1);
      expect(dueTasks[0].name).toBe('Due Task');
    });

    it('should return periodic tasks that need to run', () => {
      db.createTask({
        name: 'Periodic Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      const dueTasks = db.getDueTasks();
      expect(dueTasks.length).toBeGreaterThan(0);
    });
  });

  describe('updateTaskExecution', () => {
    it('should update lastExecutedAt and executionCount', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      const taskBefore = db.getTask(taskId)!;
      expect(taskBefore.executionCount).toBe(0);
      expect(taskBefore.lastExecutedAt).toBeNull();

      db.updateTaskExecution(taskId);

      const taskAfter = db.getTask(taskId)!;
      expect(taskAfter.executionCount).toBe(1);
      expect(taskAfter.lastExecutedAt).toBeTruthy();
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', () => {
      const taskId = db.createTask({
        name: 'Task to delete',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date().toISOString(),
        intervalMinutes: null,
      });

      const deleted = db.deleteTask(taskId);
      expect(deleted).toBe(true);

      const task = db.getTask(taskId);
      expect(task).toBeUndefined();
    });

    it('should return false for non-existent task', () => {
      const deleted = db.deleteTask('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('enableTask and disableTask', () => {
    it('should disable a task', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date().toISOString(),
        intervalMinutes: null,
      });

      const disabled = db.disableTask(taskId);
      expect(disabled).toBe(true);

      const task = db.getTask(taskId)!;
      expect(task.enabled).toBe(0);
    });

    it('should enable a task', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date().toISOString(),
        intervalMinutes: null,
      });

      db.disableTask(taskId);
      const enabled = db.enableTask(taskId);
      expect(enabled).toBe(true);

      const task = db.getTask(taskId)!;
      expect(task.enabled).toBe(1);
    });
  });

  describe('logExecution', () => {
    it('should log a successful execution', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date().toISOString(),
        intervalMinutes: null,
      });

      const executionId = db.logExecution({
        taskId,
        executedAt: new Date().toISOString(),
        success: 1,
        error: null,
        result: JSON.stringify({ status: 'ok' }),
      });

      expect(executionId).toBeTruthy();
    });

    it('should log a failed execution', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date().toISOString(),
        intervalMinutes: null,
      });

      const executionId = db.logExecution({
        taskId,
        executedAt: new Date().toISOString(),
        success: 0,
        error: 'Test error',
        result: null,
      });

      expect(executionId).toBeTruthy();
    });
  });

  describe('getExecutionHistory', () => {
    it('should return execution history', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      db.logExecution({
        taskId,
        executedAt: new Date().toISOString(),
        success: 1,
        error: null,
        result: null,
      });

      db.logExecution({
        taskId,
        executedAt: new Date().toISOString(),
        success: 0,
        error: 'Error',
        result: null,
      });

      const history = db.getExecutionHistory(taskId, 10);
      expect(history.length).toBe(2);
    });

    it('should respect limit parameter', () => {
      const taskId = db.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      for (let i = 0; i < 5; i++) {
        db.logExecution({
          taskId,
          executedAt: new Date().toISOString(),
          success: 1,
          error: null,
          result: null,
        });
      }

      const history = db.getExecutionHistory(taskId, 3);
      expect(history.length).toBe(3);
    });
  });
});
