import { describe, it, expect } from 'vitest';
import schedulerPlugin from '../index.js';

describe('Scheduler Plugin', () => {

  describe('Metadata', () => {
    it('should have valid metadata', () => {
      expect(schedulerPlugin.metadata.name).toBe('scheduler');
      expect(schedulerPlugin.metadata.version).toBe('1.0.0');
      expect(schedulerPlugin.metadata.description).toBeTruthy();
    });
  });

  describe('Tools', () => {
    it('should provide tools', () => {
      const tools = schedulerPlugin.getTools();
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should have schedule_task_once tool', () => {
      const tools = schedulerPlugin.getTools();
      const tool = tools.find((t) => t.definition.name === 'schedule_task_once');
      expect(tool).toBeDefined();
      expect(tool?.definition.description).toBeTruthy();
    });

    it('should have schedule_task_periodic tool', () => {
      const tools = schedulerPlugin.getTools();
      const tool = tools.find((t) => t.definition.name === 'schedule_task_periodic');
      expect(tool).toBeDefined();
      expect(tool?.definition.description).toBeTruthy();
    });

    it('should have list_scheduled_tasks tool', () => {
      const tools = schedulerPlugin.getTools();
      const tool = tools.find((t) => t.definition.name === 'list_scheduled_tasks');
      expect(tool).toBeDefined();
    });

    it('should have cancel_scheduled_task tool', () => {
      const tools = schedulerPlugin.getTools();
      const tool = tools.find((t) => t.definition.name === 'cancel_scheduled_task');
      expect(tool).toBeDefined();
    });

    it('should have pause_scheduled_task tool', () => {
      const tools = schedulerPlugin.getTools();
      const tool = tools.find((t) => t.definition.name === 'pause_scheduled_task');
      expect(tool).toBeDefined();
    });

    it('should have resume_scheduled_task tool', () => {
      const tools = schedulerPlugin.getTools();
      const tool = tools.find((t) => t.definition.name === 'resume_scheduled_task');
      expect(tool).toBeDefined();
    });

    it('should have get_task_history tool', () => {
      const tools = schedulerPlugin.getTools();
      const tool = tools.find((t) => t.definition.name === 'get_task_history');
      expect(tool).toBeDefined();
    });

    it('should have valid Zod schemas for all tools', () => {
      const tools = schedulerPlugin.getTools();
      tools.forEach((tool) => {
        expect(tool.definition.parameters).toBeDefined();
        expect(typeof tool.definition.parameters.parse).toBe('function');
      });
    });
  });

  describe('Workflows', () => {
    it('should provide workflows', () => {
      const workflows = schedulerPlugin.getWorkflows();
      expect(Array.isArray(workflows)).toBe(true);
    });
  });

  describe('Methods', () => {
    it('should have initialize method', () => {
      expect(typeof schedulerPlugin.initialize).toBe('function');
    });

    it('should have getTools method', () => {
      expect(typeof schedulerPlugin.getTools).toBe('function');
    });

    it('should have getWorkflows method', () => {
      expect(typeof schedulerPlugin.getWorkflows).toBe('function');
    });

    it('should have cleanup method', () => {
      expect(typeof schedulerPlugin.cleanup).toBe('function');
    });

    it('should have setWorkflowEngine method', () => {
      expect(typeof schedulerPlugin.setWorkflowEngine).toBe('function');
    });
  });
});
