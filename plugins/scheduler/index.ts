import { z } from 'zod';
import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';
import { SchedulerDatabase } from './database.js';
import { TaskScheduler } from './scheduler.js';
import type { WorkflowEngine } from '../../src/core/workflow-engine.js';

class SchedulerPlugin implements Plugin {
  metadata = {
    name: 'scheduler',
    version: '1.0.0',
    description: 'Schedule workflows to run at specific times or periodically',
    author: 'AI Agent System',
  };

  private db!: SchedulerDatabase;
  private scheduler!: TaskScheduler;

  async initialize(): Promise<void> {
    console.log('Initializing scheduler plugin...');
    this.db = new SchedulerDatabase();
    this.scheduler = new TaskScheduler(this.db);
    this.scheduler.start();
    console.log('Scheduler plugin initialized');
  }

  setWorkflowEngine(engine: WorkflowEngine): void {
    this.scheduler.setWorkflowEngine(engine);
  }

  getTools(): Tool[] {
    return [
      {
        definition: {
          name: 'schedule_task_once',
          description: 'Schedule a workflow to run once at a specific date and time',
          parameters: z.object({
            name: z.string().describe('A descriptive name for this scheduled task'),
            workflowName: z.string().describe('Name of the workflow to execute'),
            parameters: z.record(z.any()).optional().describe('Parameters to pass to the workflow'),
            executeAt: z.string().describe('ISO 8601 datetime when to execute (e.g., "2025-01-19T14:00:00Z")'),
          }),
        },
        execute: async (params) => {
          const { name, workflowName, parameters = {}, executeAt } = params;

          // Validate datetime
          const executeDate = new Date(executeAt);
          if (isNaN(executeDate.getTime())) {
            throw new Error(`Invalid datetime format: ${executeAt}. Use ISO 8601 format (e.g., "2025-01-19T14:00:00Z")`);
          }

          // Check if datetime is in the future
          if (executeDate <= new Date()) {
            throw new Error('Execution time must be in the future');
          }

          const taskId = this.db.createTask({
            name,
            workflowName,
            parameters: JSON.stringify(parameters),
            scheduleType: 'once',
            executeAt: executeDate.toISOString(),
            intervalMinutes: null,
          });

          return {
            success: true,
            taskId,
            message: `✅ Scheduled one-time task "${name}" to execute at ${executeDate.toISOString()}`,
            details: {
              id: taskId,
              name,
              workflowName,
              executeAt: executeDate.toISOString(),
            },
          };
        },
      },
      {
        definition: {
          name: 'schedule_task_periodic',
          description: 'Schedule a workflow to run periodically at a specified interval',
          parameters: z.object({
            name: z.string().describe('A descriptive name for this scheduled task'),
            workflowName: z.string().describe('Name of the workflow to execute'),
            parameters: z.record(z.any()).optional().describe('Parameters to pass to the workflow'),
            intervalMinutes: z.number().min(1).describe('How often to run the task in minutes (e.g., 60 for hourly, 1440 for daily)'),
          }),
        },
        execute: async (params) => {
          const { name, workflowName, parameters = {}, intervalMinutes } = params;

          const taskId = this.db.createTask({
            name,
            workflowName,
            parameters: JSON.stringify(parameters),
            scheduleType: 'periodic',
            executeAt: null,
            intervalMinutes,
          });

          // Calculate human-readable interval
          let intervalText = `${intervalMinutes} minutes`;
          if (intervalMinutes === 60) intervalText = '1 hour';
          else if (intervalMinutes % 60 === 0) intervalText = `${intervalMinutes / 60} hours`;
          else if (intervalMinutes === 1440) intervalText = '1 day';
          else if (intervalMinutes % 1440 === 0) intervalText = `${intervalMinutes / 1440} days`;

          return {
            success: true,
            taskId,
            message: `✅ Scheduled periodic task "${name}" to run every ${intervalText}`,
            details: {
              id: taskId,
              name,
              workflowName,
              intervalMinutes,
              intervalText,
            },
          };
        },
      },
      {
        definition: {
          name: 'list_scheduled_tasks',
          description: 'List all scheduled tasks with their details',
          parameters: z.object({
            includeDisabled: z.boolean().optional().describe('Include disabled/completed tasks'),
            type: z.enum(['once', 'periodic']).optional().describe('Filter by task type'),
          }),
        },
        execute: async (params) => {
          const { includeDisabled = false, type } = params;

          const tasks = type
            ? this.db.getTasksByType(type, includeDisabled)
            : this.db.getAllTasks(includeDisabled);

          if (tasks.length === 0) {
            return {
              success: true,
              message: '📋 No scheduled tasks found',
              tasks: [],
            };
          }

          const formattedTasks = tasks.map((task) => {
            const parameters = JSON.parse(task.parameters);
            const enabled = task.enabled === 1;
            const now = new Date();

            let scheduleInfo = '';
            if (task.scheduleType === 'once') {
              const executeAt = new Date(task.executeAt!);
              const diff = executeAt.getTime() - now.getTime();
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const days = Math.floor(hours / 24);

              if (diff < 0) {
                scheduleInfo = `Scheduled for: ${executeAt.toISOString()} (passed)`;
              } else if (days > 0) {
                scheduleInfo = `In ${days} day(s)`;
              } else if (hours > 0) {
                scheduleInfo = `In ${hours} hour(s)`;
              } else {
                scheduleInfo = 'Soon';
              }
            } else {
              const intervalMinutes = task.intervalMinutes!;
              let intervalText = `${intervalMinutes} min`;
              if (intervalMinutes === 60) intervalText = '1 hour';
              else if (intervalMinutes % 60 === 0) intervalText = `${intervalMinutes / 60} hours`;
              else if (intervalMinutes === 1440) intervalText = '1 day';

              const lastRun = task.lastExecutedAt
                ? new Date(task.lastExecutedAt).toLocaleString()
                : 'Never';
              scheduleInfo = `Every ${intervalText}, Last run: ${lastRun}`;
            }

            return {
              id: task.id,
              name: task.name,
              workflow: task.workflowName,
              type: task.scheduleType,
              schedule: scheduleInfo,
              enabled,
              executionCount: task.executionCount,
              parameters,
            };
          });

          return {
            success: true,
            message: `📋 Found ${tasks.length} scheduled task(s)`,
            tasks: formattedTasks,
          };
        },
      },
      {
        definition: {
          name: 'cancel_scheduled_task',
          description: 'Cancel and delete a scheduled task',
          parameters: z.object({
            taskId: z.string().describe('ID of the task to cancel'),
          }),
        },
        execute: async (params) => {
          const { taskId } = params;

          const task = this.db.getTask(taskId);
          if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
          }

          const deleted = this.db.deleteTask(taskId);
          if (!deleted) {
            throw new Error(`Failed to delete task ${taskId}`);
          }

          return {
            success: true,
            message: `✅ Cancelled and deleted task "${task.name}"`,
            taskId,
          };
        },
      },
      {
        definition: {
          name: 'pause_scheduled_task',
          description: 'Pause a scheduled task without deleting it',
          parameters: z.object({
            taskId: z.string().describe('ID of the task to pause'),
          }),
        },
        execute: async (params) => {
          const { taskId } = params;

          const task = this.db.getTask(taskId);
          if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
          }

          const disabled = this.db.disableTask(taskId);
          if (!disabled) {
            throw new Error(`Failed to pause task ${taskId}`);
          }

          return {
            success: true,
            message: `⏸️ Paused task "${task.name}"`,
            taskId,
          };
        },
      },
      {
        definition: {
          name: 'resume_scheduled_task',
          description: 'Resume a paused scheduled task',
          parameters: z.object({
            taskId: z.string().describe('ID of the task to resume'),
          }),
        },
        execute: async (params) => {
          const { taskId } = params;

          const task = this.db.getTask(taskId);
          if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
          }

          const enabled = this.db.enableTask(taskId);
          if (!enabled) {
            throw new Error(`Failed to resume task ${taskId}`);
          }

          return {
            success: true,
            message: `▶️ Resumed task "${task.name}"`,
            taskId,
          };
        },
      },
      {
        definition: {
          name: 'get_task_history',
          description: 'Get execution history for a scheduled task',
          parameters: z.object({
            taskId: z.string().describe('ID of the task'),
            limit: z.number().min(1).max(100).optional().describe('Maximum number of executions to return (default: 10)'),
          }),
        },
        execute: async (params) => {
          const { taskId, limit = 10 } = params;

          const task = this.db.getTask(taskId);
          if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
          }

          const history = this.db.getExecutionHistory(taskId, limit);

          const formattedHistory = history.map((execution) => ({
            executedAt: new Date(execution.executedAt).toLocaleString(),
            success: execution.success === 1,
            error: execution.error || undefined,
            result: execution.result ? JSON.parse(execution.result) : undefined,
          }));

          return {
            success: true,
            taskName: task.name,
            totalExecutions: task.executionCount,
            history: formattedHistory,
          };
        },
      },
    ];
  }

  getWorkflows(): Workflow[] {
    return [];
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up scheduler plugin...');
    this.scheduler.stop();
    this.db.close();
    console.log('Scheduler plugin cleaned up');
  }
}

export default new SchedulerPlugin();
