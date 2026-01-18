import { describe, it, expect } from 'vitest';
import scriptRunnerPlugin from '../index.js';

describe('Script Runner Plugin', () => {
  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(scriptRunnerPlugin.metadata.name).toBe('script-runner');
      expect(scriptRunnerPlugin.metadata.version).toBe('1.0.0');
      expect(scriptRunnerPlugin.metadata.description).toContain('script');
    });
  });

  describe('getTools', () => {
    it('should return array of tools', () => {
      const tools = scriptRunnerPlugin.getTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should have run_shell_command tool', () => {
      const tools = scriptRunnerPlugin.getTools();
      const shellTool = tools.find((t) => t.definition.name === 'run_shell_command');

      expect(shellTool).toBeDefined();
      expect(shellTool?.definition.description).toContain('shell');
    });

    it('should have get_system_info tool', () => {
      const tools = scriptRunnerPlugin.getTools();
      const infoTool = tools.find((t) => t.definition.name === 'get_system_info');

      expect(infoTool).toBeDefined();
      expect(infoTool?.definition.description).toContain('system');
    });

    it('all tools should have valid schemas', () => {
      const tools = scriptRunnerPlugin.getTools();

      tools.forEach((tool) => {
        expect(tool.definition.name).toBeTruthy();
        expect(tool.definition.description).toBeTruthy();
        expect(tool.definition.parameters).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      });
    });
  });

  describe('getWorkflows', () => {
    it('should return array of workflows', () => {
      const workflows = scriptRunnerPlugin.getWorkflows();

      expect(Array.isArray(workflows)).toBe(true);
    });

    it('all workflows should have valid structure', () => {
      const workflows = scriptRunnerPlugin.getWorkflows();

      workflows.forEach((workflow) => {
        expect(workflow.name).toBeTruthy();
        expect(workflow.description).toBeTruthy();
        expect(Array.isArray(workflow.steps)).toBe(true);

        workflow.steps.forEach((step) => {
          expect(step.toolName).toBeTruthy();
          expect(step.params).toBeDefined();
        });
      });
    });
  });
});
