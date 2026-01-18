import { describe, it, expect } from 'vitest';
import { CLI } from '../cli.js';
import { Agent } from '../../core/agent.js';
import { WorkflowEngine } from '../../core/workflow-engine.js';
import { PluginLoader } from '../../core/plugin-loader.js';

describe('CLI', () => {
  describe('constructor', () => {
    it('should create CLI instance', () => {
      const pluginLoader = new PluginLoader('./test-plugins');
      const agent = new Agent(
        {
          openaiApiKey: 'test',
          model: 'gpt-4',
        },
        pluginLoader
      );
      const workflowEngine = new WorkflowEngine(pluginLoader);

      const cli = new CLI(agent, workflowEngine, pluginLoader);

      expect(cli).toBeInstanceOf(CLI);
    });
  });

  describe('start', () => {
    it('should be a function', () => {
      const pluginLoader = new PluginLoader('./test-plugins');
      const agent = new Agent(
        {
          openaiApiKey: 'test',
          model: 'gpt-4',
        },
        pluginLoader
      );
      const workflowEngine = new WorkflowEngine(pluginLoader);

      const cli = new CLI(agent, workflowEngine, pluginLoader);

      expect(typeof cli.start).toBe('function');
    });
  });
});
