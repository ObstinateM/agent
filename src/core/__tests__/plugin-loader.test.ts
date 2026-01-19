import { describe, it, expect, vi } from 'vitest';
import { PluginLoader } from '../plugin-loader.js';
import { Plugin } from '../../types/plugin.js';

function createMockPlugin(name: string, dependencies?: string[]): Plugin {
  return {
    metadata: {
      name,
      version: '1.0.0',
      description: `Mock plugin ${name}`,
      dependencies,
    },
    initialize: vi.fn().mockResolvedValue(undefined),
    getTools: () => [],
    getWorkflows: () => [],
  };
}

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

  describe('sortByDependencies', () => {
    it('should sort plugins with no dependencies', () => {
      const loader = new PluginLoader('./test-plugins');
      const pluginA = createMockPlugin('plugin-a');
      const pluginB = createMockPlugin('plugin-b');

      // Access private method via any cast for testing
      const pending = [
        { path: '/a', plugin: pluginA },
        { path: '/b', plugin: pluginB },
      ];

      const sorted = (loader as any).sortByDependencies(pending);
      expect(sorted).toHaveLength(2);
    });

    it('should sort plugins respecting dependencies', () => {
      const loader = new PluginLoader('./test-plugins');
      const pluginA = createMockPlugin('plugin-a', ['plugin-b']);
      const pluginB = createMockPlugin('plugin-b');

      const pending = [
        { path: '/a', plugin: pluginA },
        { path: '/b', plugin: pluginB },
      ];

      const sorted = (loader as any).sortByDependencies(pending);
      const names = sorted.map((p: any) => p.plugin.metadata.name);

      expect(names.indexOf('plugin-b')).toBeLessThan(names.indexOf('plugin-a'));
    });

    it('should throw on missing dependency', () => {
      const loader = new PluginLoader('./test-plugins');
      const pluginA = createMockPlugin('plugin-a', ['non-existent']);

      const pending = [{ path: '/a', plugin: pluginA }];

      expect(() => (loader as any).sortByDependencies(pending)).toThrow(
        'Missing dependency: "non-existent" required by "plugin-a"'
      );
    });

    it('should throw on circular dependency', () => {
      const loader = new PluginLoader('./test-plugins');
      const pluginA = createMockPlugin('plugin-a', ['plugin-b']);
      const pluginB = createMockPlugin('plugin-b', ['plugin-a']);

      const pending = [
        { path: '/a', plugin: pluginA },
        { path: '/b', plugin: pluginB },
      ];

      expect(() => (loader as any).sortByDependencies(pending)).toThrow(
        'Circular dependency detected'
      );
    });

    it('should handle complex dependency chains', () => {
      const loader = new PluginLoader('./test-plugins');
      const pluginA = createMockPlugin('plugin-a', ['plugin-b', 'plugin-c']);
      const pluginB = createMockPlugin('plugin-b', ['plugin-c']);
      const pluginC = createMockPlugin('plugin-c');

      const pending = [
        { path: '/a', plugin: pluginA },
        { path: '/b', plugin: pluginB },
        { path: '/c', plugin: pluginC },
      ];

      const sorted = (loader as any).sortByDependencies(pending);
      const names = sorted.map((p: any) => p.plugin.metadata.name);

      expect(names.indexOf('plugin-c')).toBeLessThan(names.indexOf('plugin-b'));
      expect(names.indexOf('plugin-b')).toBeLessThan(names.indexOf('plugin-a'));
      expect(names.indexOf('plugin-c')).toBeLessThan(names.indexOf('plugin-a'));
    });
  });
});
