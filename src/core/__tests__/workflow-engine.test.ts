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
        execute: async (params) => {
          const { input } = params as { input: string };
          return input;
        },
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

    it('should resolve variables in arrays and inline strings', async () => {
      const mockTool: Tool = {
        definition: {
          name: 'echo_params',
          description: 'Echo params for testing',
          parameters: z.object({
            message: z.string(),
            items: z.array(z.string()),
          }),
        },
        execute: async (params) => params,
      };

      const mockWorkflow: Workflow = {
        name: 'array_params_workflow',
        description: 'Workflow with arrays and inline template strings',
        steps: [
          {
            toolName: 'echo_params',
            params: {
              message: 'Hello ${name}',
              items: ['${first}', 'value ${second}'],
            },
          },
        ],
      };

      vi.spyOn(pluginLoader, 'getWorkflow').mockReturnValue(mockWorkflow);
      vi.spyOn(pluginLoader, 'getTool').mockReturnValue(mockTool);

      const result = await workflowEngine.executeWorkflow('array_params_workflow', {
        name: 'Sam',
        first: 'one',
        second: 'two',
      });

      expect(result.success).toBe(true);
      expect(result.steps[0].result.result).toEqual({
        message: 'Hello Sam',
        items: ['one', 'value two'],
      });
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

  describe('workflowExists', () => {
    it('should return true when workflow exists', () => {
      const mockWorkflow: Workflow = {
        name: 'existing_workflow',
        description: 'Exists',
        steps: [],
      };

      vi.spyOn(pluginLoader, 'getWorkflow').mockReturnValue(mockWorkflow);

      expect(workflowEngine.workflowExists('existing_workflow')).toBe(true);
    });

    it('should return false when workflow does not exist', () => {
      vi.spyOn(pluginLoader, 'getWorkflow').mockReturnValue(undefined);

      expect(workflowEngine.workflowExists('non_existent')).toBe(false);
    });
  });

  describe('interpretMessage', () => {
    it('should throw error when OpenAI is not configured', async () => {
      await expect(workflowEngine.interpretMessage('restart the server')).rejects.toThrow(
        'OpenAI not configured'
      );
    });

    it('should interpret message with mocked OpenAI response', async () => {
      const mockWorkflows: Workflow[] = [
        {
          name: 'restart_container',
          description: 'Restart a Docker container',
          steps: [],
        },
      ];

      vi.spyOn(pluginLoader, 'getWorkflows').mockReturnValue(mockWorkflows);
      vi.spyOn(pluginLoader, 'getWorkflow').mockImplementation((name) =>
        mockWorkflows.find((w) => w.name === name)
      );

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                isWorkflowRequest: true,
                workflowName: 'restart_container',
                parameters: { container: 'nginx' },
                timing: { type: 'immediate' },
                interpretation: 'User wants to restart the nginx container',
                confidence: 0.95,
              }),
            },
          },
        ],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockOpenAIResponse);
      workflowEngine.setOpenAIConfig('test-api-key');
      // @ts-expect-error - accessing private property for testing
      workflowEngine.openai = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as unknown;

      const result = await workflowEngine.interpretMessage('restart nginx container');

      expect(result.isWorkflowRequest).toBe(true);
      expect(result.workflowName).toBe('restart_container');
      expect(result.parameters).toEqual({ container: 'nginx' });
      expect(result.timing).toEqual({ type: 'immediate' });
      expect(result.confidence).toBe(0.95);
      expect(result.error).toBeUndefined();
    });

    it('should return error when workflow does not exist', async () => {
      const mockWorkflows: Workflow[] = [
        {
          name: 'existing_workflow',
          description: 'An existing workflow',
          steps: [],
        },
      ];

      vi.spyOn(pluginLoader, 'getWorkflows').mockReturnValue(mockWorkflows);
      vi.spyOn(pluginLoader, 'getWorkflow').mockReturnValue(undefined);

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                isWorkflowRequest: true,
                workflowName: 'non_existent_workflow',
                parameters: {},
                timing: { type: 'immediate' },
                interpretation: 'User wants a workflow that does not exist',
                confidence: 0.8,
              }),
            },
          },
        ],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockOpenAIResponse);
      workflowEngine.setOpenAIConfig('test-api-key');
      // @ts-expect-error - accessing private property for testing
      workflowEngine.openai = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as unknown;

      const result = await workflowEngine.interpretMessage('do something');

      expect(result.isWorkflowRequest).toBe(true);
      expect(result.error).toContain('not found');
      expect(result.error).toContain('existing_workflow');
    });

    it('should handle invalid JSON from OpenAI', async () => {
      vi.spyOn(pluginLoader, 'getWorkflows').mockReturnValue([]);

      const mockOpenAIResponse = {
        choices: [
          {
            message: {
              content: 'not valid json',
            },
          },
        ],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockOpenAIResponse);
      workflowEngine.setOpenAIConfig('test-api-key');
      // @ts-expect-error - accessing private property for testing
      workflowEngine.openai = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as unknown;

      const result = await workflowEngine.interpretMessage('test');

      expect(result.isWorkflowRequest).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });
});
