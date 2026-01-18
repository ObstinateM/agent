/**
 * Plugin Template
 *
 * Copy this file to create a new plugin:
 * 1. Create a new folder: plugins/your-plugin/
 * 2. Copy this file to: plugins/your-plugin/index.ts
 * 3. Customize the plugin implementation below
 * 4. Build and restart the agent
 */

import { z } from 'zod';
import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';

/**
 * YOUR PLUGIN NAME - Brief description
 */
class YourPlugin implements Plugin {
  // Plugin metadata (required)
  metadata = {
    name: 'your-plugin',           // Unique plugin name (lowercase, hyphens)
    version: '1.0.0',              // Semantic version
    description: 'What your plugin does', // Brief description
    author: 'Your Name',           // Optional
  };

  /**
   * Initialize plugin (called once at startup)
   * Use this to:
   * - Validate dependencies
   * - Load configuration
   * - Setup connections
   * - Validate environment
   */
  async initialize(): Promise<void> {
    console.log(`${this.metadata.name} plugin initialized`);

    // Example: Check if required tool is available
    // try {
    //   await execAsync('your-tool --version');
    // } catch (error) {
    //   console.warn('your-tool is not available');
    // }
  }

  /**
   * Get all tools provided by this plugin
   * Tools are exposed to the LLM for automatic selection
   */
  getTools(): Tool[] {
    return [
      // Example Tool 1: Simple operation
      {
        definition: {
          name: 'your_tool_name',    // Use lowercase with underscores
          description: 'Clear, concise description of what this tool does. The LLM uses this to decide when to call it.',
          parameters: z.object({
            // Define parameters with Zod schemas
            input: z.string().describe('What this parameter is for'),
            count: z.number().optional().describe('Optional parameter'),
            options: z.enum(['option1', 'option2']).optional(),
          }),
        },
        execute: async (params) => {
          // Parameters are already validated by Zod
          const { input, count, options } = params;

          // Your implementation here
          // - Can be async (use await)
          // - Throw errors for failures (they're caught and shown to LLM)
          // - Return any serializable data

          return {
            success: true,
            result: 'Your result here',
          };
        },
      },

      // Example Tool 2: With error handling
      {
        definition: {
          name: 'another_tool',
          description: 'Another example tool',
          parameters: z.object({
            id: z.string().describe('Resource ID'),
          }),
        },
        execute: async (params) => {
          const { id } = params;

          // Throw descriptive errors
          if (!id) {
            throw new Error('ID is required');
          }

          // Example: Execute system command
          // const { stdout } = await execAsync(`your-command ${id}`);
          // return stdout;

          return `Processed ${id}`;
        },
      },
    ];
  }

  /**
   * Get all workflows provided by this plugin
   * Workflows are predefined sequences of tool calls
   */
  getWorkflows(): Workflow[] {
    return [
      {
        name: 'your_workflow_name',
        description: 'What this workflow accomplishes',
        steps: [
          {
            toolName: 'your_tool_name',
            params: {
              input: 'static value',
              count: 5,
            },
            description: 'What this step does',
          },
          {
            toolName: 'another_tool',
            params: {
              // Use variables from workflow input
              id: '${resourceId}',
            },
            description: 'Second step using input variable',
          },
          {
            toolName: 'your_tool_name',
            params: {
              // Use result from previous step (0-indexed)
              input: '${step1_result}',
            },
            description: 'Third step using previous result',
          },
        ],
      },
    ];
  }

  /**
   * Cleanup resources (optional)
   * Called when agent shuts down
   */
  async cleanup(): Promise<void> {
    console.log(`${this.metadata.name} plugin cleaned up`);
    // Close connections, cleanup resources, etc.
  }
}

// Export plugin instance as default
export default new YourPlugin();
