import { z } from 'zod';

/**
 * Tool parameter definition using Zod for runtime validation
 */
export type ToolParameter = z.ZodTypeAny;

/**
 * Tool definition that will be exposed to the LLM
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
}

/**
 * Tool implementation that executes the actual logic
 */
export interface Tool {
  definition: ToolDefinition;
  execute: (_params: unknown) => Promise<unknown>;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  toolName: string;
  params: Record<string, unknown>;
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
  dependencies?: string[];
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
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Convert a Tool to OpenAI function format
 */
export function toolToOpenAIFunction(tool: Tool): OpenAIFunction {
  const zodSchema = tool.definition.parameters;
  const shape = zodSchema.shape;

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
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
function zodToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
  const def = zodType._def as {
    typeName: string;
    shape?: () => z.ZodRawShape;
    type?: z.ZodTypeAny;
    values?: string[];
    innerType?: z.ZodTypeAny;
  };
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
        items: def.type ? zodToJsonSchema(def.type) : {},
        description: zodType.description,
      };
    case 'ZodObject':
      const shape = def.shape ? def.shape() : {};
      const properties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      }
      return { type: 'object', properties, description: zodType.description };
    case 'ZodEnum':
      return { type: 'string', enum: def.values, description: zodType.description };
    case 'ZodOptional':
      return def.innerType ? zodToJsonSchema(def.innerType) : { type: 'string' };
    default:
      return { type: 'string' };
  }
}
