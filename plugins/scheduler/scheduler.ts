import { SchedulerDatabase, ScheduledTask } from './database.js';
import type { WorkflowEngine } from '../../src/core/workflow-engine.js';

export class TaskScheduler {
  private db: SchedulerDatabase;
  private workflowEngine: WorkflowEngine | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 60000; // Check every minute
  private runningTasks: Set<string> = new Set();

  constructor(db: SchedulerDatabase) {
    this.db = db;
  }

  setWorkflowEngine(engine: WorkflowEngine): void {
    this.workflowEngine = engine;
  }

  start(): void {
    if (this.intervalId) {
      console.log('Scheduler already running');
      return;
    }

    console.log('Starting task scheduler...');
    // Run immediately on start
    this.checkAndExecuteTasks();

    // Then check periodically
    this.intervalId = setInterval(() => {
      this.checkAndExecuteTasks();
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Task scheduler stopped');
    }
  }

  private async checkAndExecuteTasks(): Promise<void> {
    if (!this.workflowEngine) {
      console.warn('WorkflowEngine not set, skipping task execution');
      return;
    }

    try {
      const dueTasks = this.db.getDueTasks();

      for (const task of dueTasks) {
        // Skip if task is already running
        if (this.runningTasks.has(task.id)) {
          console.log(`Task ${task.name} is already running, skipping`);
          continue;
        }

        // Execute task in background
        this.executeTask(task).catch((error) => {
          console.error(`Error executing task ${task.name}:`, error);
        });
      }
    } catch (error) {
      console.error('Error checking for due tasks:', error);
    }
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    this.runningTasks.add(task.id);

    const executedAt = new Date().toISOString();
    let success = false;
    let error: string | null = null;
    let result: any = null;

    try {
      console.log(`Executing scheduled task: ${task.name} (workflow: ${task.workflowName})`);

      // Parse parameters
      const parameters = JSON.parse(task.parameters);

      // Execute workflow
      const workflowResult = await this.workflowEngine!.executeWorkflow(
        task.workflowName,
        parameters
      );

      success = workflowResult.success;
      result = workflowResult;

      if (!success) {
        error = workflowResult.error || 'Workflow execution failed';
      }

      console.log(`Task ${task.name} executed successfully`);
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      console.error(`Task ${task.name} failed:`, error);
    } finally {
      // Update task execution time
      this.db.updateTaskExecution(task.id);

      // Log execution history
      this.db.logExecution({
        taskId: task.id,
        executedAt,
        success: success ? 1 : 0,
        error,
        result: result ? JSON.stringify(result) : null,
      });

      // Disable one-time tasks after execution
      if (task.scheduleType === 'once') {
        this.db.disableTask(task.id);
        console.log(`One-time task ${task.name} completed and disabled`);
      }

      this.runningTasks.delete(task.id);
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
