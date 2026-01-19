import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SchedulerEngine } from '../scheduler-engine.js';
import { unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SchedulerEngine', () => {
  let engine: SchedulerEngine;
  let testDbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'scheduler-test-'));
    testDbPath = join(tempDir, 'test.db');
    engine = new SchedulerEngine(testDbPath);
  });

  afterEach(() => {
    engine.close();
    try {
      unlinkSync(testDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('createTask', () => {
    it('should create a one-time task with nextExecuteAt set', () => {
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const taskId = engine.createTask({
        name: 'Test Task',
        workflowName: 'test_workflow',
        parameters: JSON.stringify({ param: 'value' }),
        scheduleType: 'once',
        executeAt: futureDate,
        intervalMinutes: null,
      });

      expect(taskId).toBeTruthy();
      const task = engine.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.nextExecuteAt).toBe(futureDate);
    });

    it('should create a periodic task with nextExecuteAt in the future', () => {
      const now = Date.now();
      const taskId = engine.createTask({
        name: 'Periodic Task',
        workflowName: 'test_workflow',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      expect(taskId).toBeTruthy();
      const task = engine.getTask(taskId);
      expect(task?.intervalMinutes).toBe(60);

      const nextExecuteAt = new Date(task!.nextExecuteAt!).getTime();
      expect(nextExecuteAt).toBeGreaterThanOrEqual(now + 59 * 60 * 1000);
      expect(nextExecuteAt).toBeLessThanOrEqual(now + 61 * 60 * 1000);
    });

    it('should NOT make periodic task immediately due (bug fix)', () => {
      engine.createTask({
        name: 'Periodic Task',
        workflowName: 'test_workflow',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      const dueTasks = engine.getDueTasks();
      expect(dueTasks.length).toBe(0);
    });
  });

  describe('getTask', () => {
    it('should retrieve a task by ID', () => {
      const taskId = engine.createTask({
        name: 'Test Task',
        workflowName: 'test_workflow',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() + 60000).toISOString(),
        intervalMinutes: null,
      });

      const task = engine.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.id).toBe(taskId);
      expect(task?.name).toBe('Test Task');
    });

    it('should return undefined for non-existent task', () => {
      const task = engine.getTask('non-existent-id');
      expect(task).toBeUndefined();
    });
  });

  describe('getAllTasks', () => {
    it('should return all enabled tasks', () => {
      engine.createTask({
        name: 'Task 1',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() + 60000).toISOString(),
        intervalMinutes: null,
      });

      engine.createTask({
        name: 'Task 2',
        workflowName: 'workflow2',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      const tasks = engine.getAllTasks(false);
      expect(tasks.length).toBe(2);
    });

    it('should include disabled tasks when requested', () => {
      const taskId = engine.createTask({
        name: 'Task to disable',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() + 60000).toISOString(),
        intervalMinutes: null,
      });

      engine.disableTask(taskId);

      const enabledTasks = engine.getAllTasks(false);
      const allTasks = engine.getAllTasks(true);

      expect(enabledTasks.length).toBe(0);
      expect(allTasks.length).toBe(1);
    });
  });

  describe('getDueTasks', () => {
    it('should return one-time tasks that are due', () => {
      engine.createTask({
        name: 'Due Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() - 1000).toISOString(),
        intervalMinutes: null,
      });

      engine.createTask({
        name: 'Future Task',
        workflowName: 'workflow2',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() + 1000000).toISOString(),
        intervalMinutes: null,
      });

      const dueTasks = engine.getDueTasks();
      expect(dueTasks.length).toBe(1);
      expect(dueTasks[0].name).toBe('Due Task');
    });

    it('should NOT return newly created periodic tasks as due', () => {
      engine.createTask({
        name: 'Periodic Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      const dueTasks = engine.getDueTasks();
      expect(dueTasks.length).toBe(0);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', () => {
      const taskId = engine.createTask({
        name: 'Task to delete',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() + 60000).toISOString(),
        intervalMinutes: null,
      });

      const deleted = engine.deleteTask(taskId);
      expect(deleted).toBe(true);

      const task = engine.getTask(taskId);
      expect(task).toBeUndefined();
    });

    it('should return false for non-existent task', () => {
      const deleted = engine.deleteTask('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('enableTask and disableTask', () => {
    it('should disable a task and clear nextExecuteAt', () => {
      const taskId = engine.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      const disabled = engine.disableTask(taskId);
      expect(disabled).toBe(true);

      const task = engine.getTask(taskId)!;
      expect(task.enabled).toBe(0);
      expect(task.nextExecuteAt).toBeNull();
    });

    it('should enable a task and set nextExecuteAt', () => {
      const taskId = engine.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      engine.disableTask(taskId);
      const enabled = engine.enableTask(taskId);
      expect(enabled).toBe(true);

      const task = engine.getTask(taskId)!;
      expect(task.enabled).toBe(1);
      expect(task.nextExecuteAt).toBeTruthy();
    });
  });

  describe('logExecution', () => {
    it('should log a successful execution', () => {
      const taskId = engine.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() + 60000).toISOString(),
        intervalMinutes: null,
      });

      const executionId = engine.logExecution({
        taskId,
        executedAt: new Date().toISOString(),
        success: 1,
        error: null,
        result: JSON.stringify({ status: 'ok' }),
      });

      expect(executionId).toBeTruthy();
    });

    it('should log a failed execution', () => {
      const taskId = engine.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'once',
        executeAt: new Date(Date.now() + 60000).toISOString(),
        intervalMinutes: null,
      });

      const executionId = engine.logExecution({
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
      const taskId = engine.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      engine.logExecution({
        taskId,
        executedAt: new Date().toISOString(),
        success: 1,
        error: null,
        result: null,
      });

      engine.logExecution({
        taskId,
        executedAt: new Date().toISOString(),
        success: 0,
        error: 'Error',
        result: null,
      });

      const history = engine.getExecutionHistory(taskId, 10);
      expect(history.length).toBe(2);
    });

    it('should respect limit parameter', () => {
      const taskId = engine.createTask({
        name: 'Test Task',
        workflowName: 'workflow1',
        parameters: JSON.stringify({}),
        scheduleType: 'periodic',
        executeAt: null,
        intervalMinutes: 60,
      });

      for (let i = 0; i < 5; i++) {
        engine.logExecution({
          taskId,
          executedAt: new Date().toISOString(),
          success: 1,
          error: null,
          result: null,
        });
      }

      const history = engine.getExecutionHistory(taskId, 3);
      expect(history.length).toBe(3);
    });
  });

  describe('scheduler lifecycle', () => {
    it('should start and stop without errors', () => {
      expect(engine.isRunning()).toBe(false);
      engine.start();
      expect(engine.isRunning()).toBe(true);
      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });
  });
});
