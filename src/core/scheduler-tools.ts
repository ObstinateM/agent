import { z } from 'zod';
import { Tool } from '../types/plugin.js';
import { SchedulerEngine } from './scheduler-engine.js';
import { PluginLoader } from './plugin-loader.js';

const jsonObjectSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  },
  z.record(z.any()).optional()
);

function validateWorkflowExists(pluginLoader: PluginLoader, workflowName: string): void {
  const workflow = pluginLoader.getWorkflow(workflowName);
  if (!workflow) {
    const availableWorkflows = pluginLoader.getWorkflows();
    const availableNames = availableWorkflows.map((w) => w.name);
    throw new Error(
      `Workflow "${workflowName}" not found. Available workflows: ${availableNames.length > 0 ? availableNames.join(', ') : 'none'}`
    );
  }
}

/**
 * Create scheduler tools bound to a SchedulerEngine instance.
 */
export function createSchedulerTools(scheduler: SchedulerEngine, pluginLoader: PluginLoader): Tool[] {
  return [
    {
      definition: {
        name: 'get_current_time',
        description: 'Get the current date and time. Use this before scheduling tasks to calculate the correct future datetime.',
        parameters: z.object({}),
      },
      execute: async () => {
        const now = new Date();
        return {
          iso: now.toISOString(),
          unix: Math.floor(now.getTime() / 1000),
          formatted: now.toLocaleString(),
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: now.getHours(),
          minute: now.getMinutes(),
        };
      },
    },
    {
      definition: {
        name: 'schedule_task_once',
        description: 'Schedule a workflow to run once at a specific date and time. IMPORTANT: Call get_current_time first to know the current datetime, then calculate a future time.',
        parameters: z.object({
          name: z.string().describe('A descriptive name for this scheduled task'),
          workflowName: z.string().describe('Name of the workflow to execute'),
          parameters: jsonObjectSchema.describe('Parameters to pass to the workflow (as object or JSON string)'),
          executeAt: z.string().describe('ISO 8601 datetime when to execute. Must be in the future. Example for tomorrow at 2pm UTC: "2026-01-19T14:00:00Z"'),
        }),
      },
      execute: async (params) => {
        const { name, workflowName, parameters = {}, executeAt } = params as {
          name: string;
          workflowName: string;
          parameters?: Record<string, unknown>;
          executeAt: string;
        };

        validateWorkflowExists(pluginLoader, workflowName);

        const executeDate = new Date(executeAt);
        if (isNaN(executeDate.getTime())) {
          throw new Error(`Invalid datetime format: ${executeAt}. Use ISO 8601 format.`);
        }

        const now = new Date();
        if (executeDate <= now) {
          throw new Error(`Execution time must be in the future. Provided: ${executeDate.toISOString()}, Current time: ${now.toISOString()}`);
        }

        const taskId = scheduler.createTask({
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
          message: `Scheduled one-time task "${name}" to execute at ${executeDate.toISOString()}`,
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
        description: 'Schedule a workflow to run periodically at a specified interval. The first execution will occur after the interval passes (not immediately).',
        parameters: z.object({
          name: z.string().describe('A descriptive name for this scheduled task'),
          workflowName: z.string().describe('Name of the workflow to execute'),
          parameters: jsonObjectSchema.describe('Parameters to pass to the workflow (as object or JSON string)'),
          intervalMinutes: z.number().min(1).describe('How often to run the task in minutes (e.g., 60 for hourly, 1440 for daily)'),
        }),
      },
      execute: async (params) => {
        const { name, workflowName, parameters = {}, intervalMinutes } = params as {
          name: string;
          workflowName: string;
          parameters?: Record<string, unknown>;
          intervalMinutes: number;
        };

        validateWorkflowExists(pluginLoader, workflowName);

        const taskId = scheduler.createTask({
          name,
          workflowName,
          parameters: JSON.stringify(parameters),
          scheduleType: 'periodic',
          executeAt: null,
          intervalMinutes,
        });

        let intervalText = `${intervalMinutes} minutes`;
        if (intervalMinutes === 60) intervalText = '1 hour';
        else if (intervalMinutes % 60 === 0) intervalText = `${intervalMinutes / 60} hours`;
        else if (intervalMinutes === 1440) intervalText = '1 day';
        else if (intervalMinutes % 1440 === 0) intervalText = `${intervalMinutes / 1440} days`;

        const firstRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000);

        return {
          success: true,
          taskId,
          message: `Scheduled periodic task "${name}" to run every ${intervalText}. First execution at ${firstRunAt.toISOString()}`,
          details: {
            id: taskId,
            name,
            workflowName,
            intervalMinutes,
            intervalText,
            firstExecutionAt: firstRunAt.toISOString(),
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
        const { includeDisabled = false, type } = params as {
          includeDisabled?: boolean;
          type?: 'once' | 'periodic';
        };

        const tasks = type
          ? scheduler.getTasksByType(type, includeDisabled)
          : scheduler.getAllTasks(includeDisabled);

        if (tasks.length === 0) {
          return {
            success: true,
            message: 'No scheduled tasks found',
            tasks: [],
          };
        }

        const formattedTasks = tasks.map((task) => {
          const parameters = JSON.parse(task.parameters);
          const enabled = task.enabled === 1;
          const now = new Date();

          let scheduleInfo = '';
          let nextRunInfo = '';

          if (task.nextExecuteAt) {
            const nextRun = new Date(task.nextExecuteAt);
            const diff = nextRun.getTime() - now.getTime();
            const minutes = Math.floor(diff / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (diff < 0) {
              nextRunInfo = 'Overdue';
            } else if (days > 0) {
              nextRunInfo = `In ${days} day(s)`;
            } else if (hours > 0) {
              nextRunInfo = `In ${hours} hour(s)`;
            } else if (minutes > 0) {
              nextRunInfo = `In ${minutes} minute(s)`;
            } else {
              nextRunInfo = 'Soon';
            }
          }

          if (task.scheduleType === 'once') {
            scheduleInfo = `One-time: ${task.executeAt}`;
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
            nextRun: nextRunInfo || (enabled ? 'Not scheduled' : 'Disabled'),
            enabled,
            executionCount: task.executionCount,
            parameters,
          };
        });

        return {
          success: true,
          message: `Found ${tasks.length} scheduled task(s)`,
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
        const { taskId } = params as { taskId: string };

        const task = scheduler.getTask(taskId);
        if (!task) {
          throw new Error(`Task with ID ${taskId} not found`);
        }

        const deleted = scheduler.deleteTask(taskId);
        if (!deleted) {
          throw new Error(`Failed to delete task ${taskId}`);
        }

        return {
          success: true,
          message: `Cancelled and deleted task "${task.name}"`,
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
        const { taskId } = params as { taskId: string };

        const task = scheduler.getTask(taskId);
        if (!task) {
          throw new Error(`Task with ID ${taskId} not found`);
        }

        const disabled = scheduler.disableTask(taskId);
        if (!disabled) {
          throw new Error(`Failed to pause task ${taskId}`);
        }

        return {
          success: true,
          message: `Paused task "${task.name}"`,
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
        const { taskId } = params as { taskId: string };

        const task = scheduler.getTask(taskId);
        if (!task) {
          throw new Error(`Task with ID ${taskId} not found`);
        }

        const enabled = scheduler.enableTask(taskId);
        if (!enabled) {
          throw new Error(`Failed to resume task ${taskId}`);
        }

        return {
          success: true,
          message: `Resumed task "${task.name}"`,
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
        const { taskId, limit = 10 } = params as { taskId: string; limit?: number };

        const task = scheduler.getTask(taskId);
        if (!task) {
          throw new Error(`Task with ID ${taskId} not found`);
        }

        const history = scheduler.getExecutionHistory(taskId, limit);

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
