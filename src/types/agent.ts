/**
 * Message role in conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * Chat message
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  openaiApiKey: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowName: string;
  stepIndex: number;
  variables: Record<string, unknown>;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  success: boolean;
  steps: {
    stepIndex: number;
    toolName: string;
    result: ToolExecutionResult;
  }[];
  error?: string;
}

/**
 * Timing intent for workflow execution
 */
export type TimingIntent =
  | { type: 'immediate' }
  | { type: 'scheduled_once'; executeAt: string }
  | { type: 'scheduled_periodic'; intervalMinutes: number };

/**
 * Result of interpreting a natural language message for workflow execution
 */
export interface WorkflowInterpretation {
  isWorkflowRequest: boolean;
  workflowName?: string;
  parameters?: Record<string, unknown>;
  timing?: TimingIntent;
  interpretation: string;
  confidence: number;
  error?: string;
}
