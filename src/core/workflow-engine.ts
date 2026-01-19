import OpenAI from 'openai';
import { z } from 'zod';
import {
  WorkflowExecutionResult,
  WorkflowInterpretation,
} from '../types/agent.js';
import { Workflow } from '../types/plugin.js';
import { PluginLoader } from './plugin-loader.js';
import { executeTool } from './tool-executor.js';

/**
 * Configuration for WorkflowEngine
 */
export interface WorkflowEngineConfig {
  openaiApiKey?: string;
  openaiModel?: string;
}

const WorkflowInterpretationSchema = z.object({
  isWorkflowRequest: z.boolean(),
  workflowName: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
  timing: z.discriminatedUnion('type', [
    z.object({ type: z.literal('immediate') }),
    z.object({ type: z.literal('scheduled_once'), executeAt: z.string() }),
    z.object({ type: z.literal('scheduled_periodic'), intervalMinutes: z.number() }),
  ]).optional(),
  interpretation: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * WorkflowEngine executes predefined workflows and can interpret natural language requests
 */
export class WorkflowEngine {
  private openai?: OpenAI;
  private openaiModel: string = 'gpt-4-turbo-preview';

  constructor(
    private _pluginLoader: PluginLoader,
    config?: WorkflowEngineConfig
  ) {
    if (config?.openaiApiKey) {
      this.setOpenAIConfig(config.openaiApiKey, config.openaiModel);
    }
  }

  /**
   * Configure OpenAI for natural language interpretation
   */
  setOpenAIConfig(apiKey: string, model?: string): void {
    this.openai = new OpenAI({ apiKey });
    if (model) {
      this.openaiModel = model;
    }
  }

  /**
   * Check if a workflow exists
   */
  workflowExists(name: string): boolean {
    return this._pluginLoader.getWorkflow(name) !== undefined;
  }

  /**
   * Interpret a natural language message to determine workflow intent.
   * Requires OpenAI to be configured via constructor or setOpenAIConfig.
   */
  async interpretMessage(message: string): Promise<WorkflowInterpretation> {
    if (!this.openai) {
      throw new Error('OpenAI not configured. Call setOpenAIConfig first.');
    }

    const workflows = this.getAvailableWorkflows();
    const workflowList = workflows
      .map((w) => `- ${w.name}: ${w.description}`)
      .join('\n');

    const systemPrompt = `You are a workflow interpreter. Analyze user messages to determine if they want to execute a workflow.

Available workflows:
${workflowList || '(No workflows available)'}

Respond with JSON matching this schema:
{
  "isWorkflowRequest": boolean,  // true if the message is asking to run a workflow
  "workflowName": string | null,  // name of the matched workflow, or null if none
  "parameters": object | null,  // extracted parameters for the workflow
  "timing": {
    "type": "immediate" | "scheduled_once" | "scheduled_periodic",
    "executeAt": string (ISO 8601, only for scheduled_once),
    "intervalMinutes": number (only for scheduled_periodic)
  } | null,
  "interpretation": string,  // brief explanation of your interpretation
  "confidence": number  // 0-1 confidence score
}

Rules:
- Match workflow names exactly as listed
- Extract timing from phrases like "every hour", "tomorrow at 3pm", "in 30 minutes"
- For periodic tasks, convert to intervalMinutes (e.g., "every hour" = 60)
- For one-time scheduled tasks, provide executeAt as ISO 8601 datetime
- If no timing specified, assume immediate execution
- Set isWorkflowRequest to false for general questions or unrelated messages`;

    const response = await this.openai.chat.completions.create({
      model: this.openaiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        isWorkflowRequest: false,
        interpretation: 'Failed to get response from LLM',
        confidence: 0,
        error: 'Empty response from OpenAI',
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        isWorkflowRequest: false,
        interpretation: 'Failed to parse LLM response',
        confidence: 0,
        error: `Invalid JSON response: ${content}`,
      };
    }

    const validated = WorkflowInterpretationSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        isWorkflowRequest: false,
        interpretation: 'LLM response did not match expected schema',
        confidence: 0,
        error: validated.error.message,
      };
    }

    const result = validated.data as WorkflowInterpretation;

    if (result.isWorkflowRequest && result.workflowName) {
      if (!this.workflowExists(result.workflowName)) {
        const availableNames = workflows.map((w) => w.name).join(', ');
        return {
          ...result,
          error: `Workflow "${result.workflowName}" not found. Available workflows: ${availableNames || 'none'}`,
        };
      }
    }

    return result;
  }

  /**
   * Execute a workflow by name
   */
  async executeWorkflow(
    workflowName: string,
    initialVariables: Record<string, unknown> = {}
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
    variables: Record<string, unknown>
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
      const result = await executeTool(this._pluginLoader, step.toolName, resolvedParams);

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
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): Record<string, unknown> {
    return this.resolveValue(params, context) as Record<string, unknown>;
  }

  private resolveValue(value: unknown, context: Record<string, unknown>): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, context));
    }

    if (value && typeof value === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        resolved[key] = this.resolveValue(nestedValue, context);
      }
      return resolved;
    }

    if (typeof value === 'string') {
      const exactMatch = value.match(/^\$\{([^}]+)\}$/);
      if (exactMatch) {
        return context[exactMatch[1]];
      }

      return value.replace(/\$\{([^}]+)\}/g, (match, key) => {
        const replacement = context[key];
        return replacement === undefined ? match : String(replacement);
      });
    }

    return value;
  }

  /**
   * Get all available workflows
   */
  getAvailableWorkflows(): Workflow[] {
    return this._pluginLoader.getWorkflows();
  }
}
