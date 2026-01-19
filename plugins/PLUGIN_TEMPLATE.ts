/**
 * Plugin Template
 *
 * To create a new plugin:
 * 1. Create folder: plugins/your-plugin/
 * 2. Create files:
 *    - plugins/your-plugin/index.ts    (main plugin, copy from this template)
 *    - plugins/your-plugin/tools.ts    (tool definitions)
 *    - plugins/your-plugin/workflows.ts (workflow definitions)
 * 3. Build and restart the agent
 *
 * Plugin Structure:
 * plugins/
 * └── your-plugin/
 *     ├── index.ts      # Main plugin file
 *     ├── tools.ts      # Tool definitions
 *     └── workflows.ts  # Workflow definitions
 */

import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';
import { createTools } from './tools.js';
import { createWorkflows } from './workflows.js';

/**
 * YOUR PLUGIN NAME - Brief description
 */
class YourPlugin implements Plugin {
  metadata = {
    name: 'your-plugin',
    version: '1.0.0',
    description: 'What your plugin does',
    author: 'Your Name',
    // Optional: List plugin names this plugin depends on
    // dependencies: ['memory', 'other-plugin'],
  };

  /**
   * Initialize plugin (called once at startup).
   * Dependencies are guaranteed to be loaded before this is called.
   */
  async initialize(): Promise<void> {
    console.log(`${this.metadata.name} plugin initialized`);
  }

  getTools(): Tool[] {
    return createTools();
  }

  getWorkflows(): Workflow[] {
    return createWorkflows();
  }

  async cleanup(): Promise<void> {
    console.log(`${this.metadata.name} plugin cleaned up`);
  }
}

export default new YourPlugin();


// =============================================================================
// tools.ts - Create this file in your plugin folder
// =============================================================================
/*
import { z } from 'zod';
import { Tool } from '../../src/types/plugin.js';

export function createTools(): Tool[] {
  return [
    {
      definition: {
        name: 'your_tool_name',
        description: 'Clear description for the LLM',
        parameters: z.object({
          input: z.string().describe('What this parameter is for'),
          count: z.number().optional().describe('Optional parameter'),
        }),
      },
      execute: async (params) => {
        const { input, count } = params;
        // Your implementation here
        return { success: true, result: 'Your result' };
      },
    },
  ];
}
*/


// =============================================================================
// workflows.ts - Create this file in your plugin folder
// =============================================================================
/*
import { Workflow } from '../../src/types/plugin.js';

export function createWorkflows(): Workflow[] {
  return [
    {
      name: 'your_workflow_name',
      description: 'What this workflow accomplishes',
      steps: [
        {
          toolName: 'your_tool_name',
          params: { input: 'static value' },
          description: 'What this step does',
        },
        {
          toolName: 'another_tool',
          params: { id: '${resourceId}' }, // Use workflow input variable
          description: 'Second step',
        },
        {
          toolName: 'your_tool_name',
          params: { input: '${step1_result}' }, // Use previous step result
          description: 'Third step',
        },
      ],
    },
  ];
}
*/
