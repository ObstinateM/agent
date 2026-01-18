import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent.js';
import { PluginLoader } from '../plugin-loader.js';
import type { AgentConfig } from '../../types/agent.js';
import type { Tool } from '../../types/plugin.js';
import { z } from 'zod';

describe('Agent', () => {
  let pluginLoader: PluginLoader;
  let config: AgentConfig;

  beforeEach(() => {
    pluginLoader = new PluginLoader('./test-plugins');
    config = {
      openaiApiKey: 'test-key',
      model: 'gpt-4',
      systemPrompt: 'Test system prompt',
    };
  });

  describe('constructor', () => {
    it('should create instance with config and plugin loader', () => {
      const agent = new Agent(config, pluginLoader);
      expect(agent).toBeInstanceOf(Agent);
    });

    it('should initialize with system prompt in history', () => {
      const agent = new Agent(config, pluginLoader);
      const history = agent.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('system');
      expect(history[0].content).toBe('Test system prompt');
    });

    it('should initialize without system prompt if not provided', () => {
      const configWithoutPrompt = { ...config, systemPrompt: undefined };
      const agent = new Agent(configWithoutPrompt, pluginLoader);
      const history = agent.getHistory();

      expect(history).toHaveLength(0);
    });
  });

  describe('getHistory', () => {
    it('should return conversation history', () => {
      const agent = new Agent(config, pluginLoader);
      const history = agent.getHistory();

      expect(Array.isArray(history)).toBe(true);
    });

    it('should return copy of history', () => {
      const agent = new Agent(config, pluginLoader);
      const history1 = agent.getHistory();
      const history2 = agent.getHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('clearHistory', () => {
    it('should clear conversation history except system prompt', () => {
      const agent = new Agent(config, pluginLoader);

      agent.clearHistory();
      const history = agent.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('system');
    });

    it('should clear all history if no system prompt', () => {
      const configWithoutPrompt = { ...config, systemPrompt: undefined };
      const agent = new Agent(configWithoutPrompt, pluginLoader);

      agent.clearHistory();
      const history = agent.getHistory();

      expect(history).toHaveLength(0);
    });
  });

  describe('getAvailableTools', () => {
    it('should return tools from plugin loader', () => {
      const mockTools: Tool[] = [
        {
          definition: {
            name: 'test_tool',
            description: 'Test tool',
            parameters: z.object({}),
          },
          execute: async () => 'result',
        },
      ];

      vi.spyOn(pluginLoader, 'getTools').mockReturnValue(mockTools);

      const agent = new Agent(config, pluginLoader);
      const tools = agent.getAvailableTools();

      expect(tools).toEqual(mockTools);
    });
  });
});
