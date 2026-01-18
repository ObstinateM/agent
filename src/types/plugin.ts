import { z } from 'zod';

/**
 * Tool parameter definition using Zod for runtime validation
 */
export type ToolParameter = z.ZodType<any>;

/**
 * Tool definition that will be exposed to the LLM
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
}

/**
 * Tool implementation that executes the actual logic
 */
export interface Tool {
  definition: ToolDefinition;
  execute: (_params: any) => Promise<any>;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  toolName: string;
  params: Record<string, any>;
  description?: string;
}

/**
 * Workflow definition
 */
export interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
}

/**
 * Main plugin interface that all plugins must implement
 */
export interface Plugin {
  metadata: PluginMetadata;

  /**
   * Initialize the plugin (called once when loading)
   */
  initialize(): Promise<void>;

  /**
   * Get all tools provided by this plugin
   */
  getTools(): Tool[];

  /**
   * Get all workflows provided by this plugin
   */
  getWorkflows(): Workflow[];

  /**
   * Cleanup resources (called when shutting down)
   */
  cleanup?(): Promise<void>;
}

/**
 * OpenAI function calling schema
 */
export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Convert a Tool to OpenAI function format
 */
export function toolToOpenAIFunction(tool: Tool): OpenAIFunction {
  const zodSchema = tool.definition.parameters;
  const shape = zodSchema._def.shape();

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodType<any>;
    properties[key] = zodToJsonSchema(zodType);

    if (!zodType.isOptional()) {
      required.push(key);
    }
  }

  return {
    name: tool.definition.name,
    description: tool.definition.description,
    parameters: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * Simple Zod to JSON Schema converter
 */
function zodToJsonSchema(zodType: z.ZodType<any>): any {
  const def = zodType._def as any;
  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string', description: zodType.description };
    case 'ZodNumber':
      return { type: 'number', description: zodType.description };
    case 'ZodBoolean':
      return { type: 'boolean', description: zodType.description };
    case 'ZodArray':
      return {
        type: 'array',
        items: zodToJsonSchema(def.type),
        description: zodType.description,
      };
    case 'ZodObject':
      const shape = def.shape();
      const properties: Record<string, any> = {};
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodType<any>);
      }
      return { type: 'object', properties, description: zodType.description };
    case 'ZodEnum':
      return { type: 'string', enum: def.values, description: zodType.description };
    case 'ZodOptional':
      return zodToJsonSchema(def.innerType);
    default:
      return { type: 'string' };
  }
}
