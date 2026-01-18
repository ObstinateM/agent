import { describe, it, expect } from 'vitest';
import dockerPlugin from '../index.js';

describe('Docker Plugin', () => {
  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(dockerPlugin.metadata.name).toBe('docker');
      expect(dockerPlugin.metadata.version).toBe('1.0.0');
      expect(dockerPlugin.metadata.description).toContain('Docker');
    });
  });

  describe('getTools', () => {
    it('should return array of tools', () => {
      const tools = dockerPlugin.getTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should have docker_list_containers tool', () => {
      const tools = dockerPlugin.getTools();
      const listTool = tools.find((t) => t.definition.name === 'docker_list_containers');

      expect(listTool).toBeDefined();
      expect(listTool?.definition.description).toContain('List');
    });

    it('should have docker_start_container tool', () => {
      const tools = dockerPlugin.getTools();
      const startTool = tools.find((t) => t.definition.name === 'docker_start_container');

      expect(startTool).toBeDefined();
      expect(startTool?.definition.description).toContain('Start');
    });

    it('should have docker_stop_container tool', () => {
      const tools = dockerPlugin.getTools();
      const stopTool = tools.find((t) => t.definition.name === 'docker_stop_container');

      expect(stopTool).toBeDefined();
      expect(stopTool?.definition.description).toContain('Stop');
    });

    it('all tools should have valid schemas', () => {
      const tools = dockerPlugin.getTools();

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
      const workflows = dockerPlugin.getWorkflows();

      expect(Array.isArray(workflows)).toBe(true);
      expect(workflows.length).toBeGreaterThan(0);
    });

    it('should have restart_container workflow', () => {
      const workflows = dockerPlugin.getWorkflows();
      const restartWorkflow = workflows.find((w) => w.name === 'restart_container');

      expect(restartWorkflow).toBeDefined();
      expect(restartWorkflow?.steps.length).toBeGreaterThan(0);
    });

    it('all workflows should have valid structure', () => {
      const workflows = dockerPlugin.getWorkflows();

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
