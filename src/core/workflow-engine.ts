import {
  WorkflowExecutionResult,
  ToolExecutionResult,
} from '../types/agent.js';
import { Workflow } from '../types/plugin.js';
import { PluginLoader } from './plugin-loader.js';

/**
 * WorkflowEngine executes predefined workflows
 */
export class WorkflowEngine {
  constructor(private _pluginLoader: PluginLoader) {}

  /**
   * Execute a workflow by name
   */
  async executeWorkflow(
    workflowName: string,
    initialVariables: Record<string, any> = {}
  ): Promise<WorkflowExecutionResult> {
    const workflow = this._pluginLoader.getWorkflow(workflowName);

    if (!workflow) {
      return {
        success: false,
        steps: [],
        error: `Workflow ${workflowName} not found`,
      };
    }

    return this.executeWorkflowSteps(workflow, initialVariables);
  }

  /**
   * Execute workflow steps sequentially
   */
  private async executeWorkflowSteps(
    workflow: Workflow,
    variables: Record<string, any>
  ): Promise<WorkflowExecutionResult> {
    const results: WorkflowExecutionResult['steps'] = [];
    const context = { ...variables };

    console.log(`\nExecuting workflow: ${workflow.name}`);
    console.log(`Description: ${workflow.description}`);

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      console.log(
        `\nStep ${i + 1}/${workflow.steps.length}: ${step.description || step.toolName}`
      );

      // Resolve parameters with context variables
      const resolvedParams = this.resolveParams(step.params, context);

      // Execute the tool
      const result = await this.executeTool(step.toolName, resolvedParams);

      results.push({
        stepIndex: i,
        toolName: step.toolName,
        result,
      });

      if (!result.success) {
        console.error(`Step ${i + 1} failed:`, result.error);
        return {
          success: false,
          steps: results,
          error: `Workflow failed at step ${i + 1} (${step.toolName}): ${result.error}`,
        };
      }

      // Store result in context for subsequent steps
      context[`step${i}_result`] = result.result;
      console.log(`Step ${i + 1} completed successfully`);
    }

    console.log(`\nWorkflow ${workflow.name} completed successfully`);

    return {
      success: true,
      steps: results,
    };
  }

  /**
   * Resolve parameters by replacing variable references with actual values
   * Supports syntax: ${variableName}
   */
  private resolveParams(
    params: Record<string, any>,
    context: Record<string, any>
  ): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        // Extract variable name
        const varName = value.slice(2, -1);
        resolved[key] = context[varName];
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively resolve nested objects
        resolved[key] = this.resolveParams(value, context);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Execute a tool
   */
  private async executeTool(
    toolName: string,
    params: any
  ): Promise<ToolExecutionResult> {
    const tool = this._pluginLoader.getTool(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found`,
      };
    }

    try {
      // Validate parameters
      const validatedParams = tool.definition.parameters.parse(params);

      // Execute
      const result = await tool.execute(validatedParams);

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all available workflows
   */
  getAvailableWorkflows(): Workflow[] {
    return this._pluginLoader.getWorkflows();
  }
}
