import { describe, it, expect, vi } from 'vitest';
import { PluginLoader } from '../plugin-loader.js';

describe('PluginLoader', () => {
  describe('constructor', () => {
    it('should create instance with plugins directory', () => {
      const loader = new PluginLoader('./test-plugins');
      expect(loader).toBeInstanceOf(PluginLoader);
    });
  });

  describe('getPlugins', () => {
    it('should return empty array when no plugins loaded', () => {
      const loader = new PluginLoader('./test-plugins');
      expect(loader.getPlugins()).toEqual([]);
    });
  });

  describe('getTools', () => {
    it('should return empty array when no plugins loaded', () => {
      const loader = new PluginLoader('./test-plugins');
      expect(loader.getTools()).toEqual([]);
    });
  });

  describe('getWorkflows', () => {
    it('should return empty array when no plugins loaded', () => {
      const loader = new PluginLoader('./test-plugins');
      expect(loader.getWorkflows()).toEqual([]);
    });
  });

  describe('getTool', () => {
    it('should return undefined for non-existent tool', () => {
      const loader = new PluginLoader('./test-plugins');
      expect(loader.getTool('non_existent')).toBeUndefined();
    });
  });

  describe('getWorkflow', () => {
    it('should return undefined for non-existent workflow', () => {
      const loader = new PluginLoader('./test-plugins');
      expect(loader.getWorkflow('non_existent')).toBeUndefined();
    });
  });

  describe('getPlugin', () => {
    it('should return undefined for non-existent plugin', () => {
      const loader = new PluginLoader('./test-plugins');
      expect(loader.getPlugin('non_existent')).toBeUndefined();
    });
  });

  describe('loadPlugins', () => {
    it('should handle non-existent directory gracefully', async () => {
      const loader = new PluginLoader('./non-existent-directory');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(loader.loadPlugins()).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
