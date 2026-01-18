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
  result?: any;
  error?: string;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  workflowName: string;
  stepIndex: number;
  variables: Record<string, any>;
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
