import type { ToolExecutionResult } from '../types/agent.js';
import type { PluginLoader } from './plugin-loader.js';

/**
 * Execute a tool by name with the given parameters.
 * Validates parameters using the tool's Zod schema before execution.
 */
export async function executeTool(
  pluginLoader: PluginLoader,
  toolName: string,
  params: unknown
): Promise<ToolExecutionResult> {
  const tool = pluginLoader.getTool(toolName);

  if (!tool) {
    return {
      success: false,
      error: `Tool ${toolName} not found`,
    };
  }

  try {
    const validatedParams = tool.definition.parameters.parse(params);
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
