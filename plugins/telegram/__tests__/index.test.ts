import { describe, it, expect, beforeEach } from 'vitest';
import telegramPlugin from '../index.js';

describe('Telegram Plugin', () => {
  describe('Metadata', () => {
    it('should have valid metadata', () => {
      expect(telegramPlugin.metadata.name).toBe('telegram');
      expect(telegramPlugin.metadata.version).toBe('1.0.0');
      expect(telegramPlugin.metadata.description).toBeTruthy();
    });
  });

  describe('Tools', () => {
    it('should provide no tools (interface plugin)', () => {
      const tools = telegramPlugin.getTools();
      expect(tools.length).toBe(0);
    });
  });

  describe('Workflows', () => {
    it('should provide no workflows (interface plugin)', () => {
      const workflows = telegramPlugin.getWorkflows();
      expect(workflows.length).toBe(0);
    });
  });

  describe('Methods', () => {
    it('should have initialize method', () => {
      expect(typeof telegramPlugin.initialize).toBe('function');
    });

    it('should have getTools method', () => {
      expect(typeof telegramPlugin.getTools).toBe('function');
    });

    it('should have getWorkflows method', () => {
      expect(typeof telegramPlugin.getWorkflows).toBe('function');
    });

    it('should have cleanup method', () => {
      expect(typeof telegramPlugin.cleanup).toBe('function');
    });

    it('should have setAgent method', () => {
      expect(typeof telegramPlugin.setAgent).toBe('function');
    });

    it('should have setWorkflowEngine method', () => {
      expect(typeof telegramPlugin.setWorkflowEngine).toBe('function');
    });

    it('should have setPluginLoader method', () => {
      expect(typeof telegramPlugin.setPluginLoader).toBe('function');
    });

    it('should have startBot method', () => {
      expect(typeof telegramPlugin.startBot).toBe('function');
    });
  });
});
