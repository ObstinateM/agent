import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowEngine } from '../workflow-engine.js';
import { PluginLoader } from '../plugin-loader.js';
import type { Workflow, Tool } from '../../types/plugin.js';
import { z } from 'zod';

describe('WorkflowEngine', () => {
  let pluginLoader: PluginLoader;
  let workflowEngine: WorkflowEngine;

  beforeEach(() => {
    pluginLoader = new PluginLoader('./test-plugins');
    workflowEngine = new WorkflowEngine(pluginLoader);
  });

  describe('executeWorkflow', () => {
    it('should return error for non-existent workflow', async () => {
      const result = await workflowEngine.executeWorkflow('non_existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should execute workflow with no steps', async () => {
      const mockWorkflow: Workflow = {
        name: 'empty_workflow',
        description: 'Empty workflow',
        steps: [],
      };

      vi.spyOn(pluginLoader, 'getWorkflow').mockReturnValue(mockWorkflow);

      const result = await workflowEngine.executeWorkflow('empty_workflow');

      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(0);
    });

    it('should pass initial variables to workflow', async () => {
      const mockTool: Tool = {
        definition: {
          name: 'test_tool',
          description: 'Test tool',
          parameters: z.object({
            input: z.string(),
          }),
        },
        execute: async (params) => params.input,
      };

      const mockWorkflow: Workflow = {
        name: 'test_workflow',
        description: 'Test workflow',
        steps: [
          {
            toolName: 'test_tool',
            params: { input: '${testVar}' },
          },
        ],
      };

      vi.spyOn(pluginLoader, 'getWorkflow').mockReturnValue(mockWorkflow);
      vi.spyOn(pluginLoader, 'getTool').mockReturnValue(mockTool);

      const result = await workflowEngine.executeWorkflow('test_workflow', {
        testVar: 'hello',
      });

      expect(result.success).toBe(true);
      expect(result.steps[0].result.result).toBe('hello');
    });

    it('should stop execution on step failure', async () => {
      const mockTool: Tool = {
        definition: {
          name: 'failing_tool',
          description: 'Failing tool',
          parameters: z.object({}),
        },
        execute: async () => {
          throw new Error('Tool failed');
        },
      };

      const mockWorkflow: Workflow = {
        name: 'failing_workflow',
        description: 'Workflow that fails',
        steps: [
          {
            toolName: 'failing_tool',
            params: {},
          },
          {
            toolName: 'should_not_execute',
            params: {},
          },
        ],
      };

      vi.spyOn(pluginLoader, 'getWorkflow').mockReturnValue(mockWorkflow);
      vi.spyOn(pluginLoader, 'getTool').mockReturnValue(mockTool);

      const result = await workflowEngine.executeWorkflow('failing_workflow');

      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(1);
      expect(result.error).toContain('failed at step 1');
    });
  });

  describe('getAvailableWorkflows', () => {
    it('should return workflows from plugin loader', () => {
      const mockWorkflows: Workflow[] = [
        {
          name: 'test1',
          description: 'Test 1',
          steps: [],
        },
      ];

      vi.spyOn(pluginLoader, 'getWorkflows').mockReturnValue(mockWorkflows);

      const workflows = workflowEngine.getAvailableWorkflows();

      expect(workflows).toEqual(mockWorkflows);
    });
  });
});
