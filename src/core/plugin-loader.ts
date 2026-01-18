import { readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { Plugin, Tool, Workflow } from '../types/plugin.js';
import type { WorkflowEngine } from './workflow-engine.js';

/**
 * PluginLoader handles auto-discovery and loading of plugins
 */
export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private tools: Map<string, { plugin: string; tool: Tool }> = new Map();
  private workflows: Map<string, { plugin: string; workflow: Workflow }> = new Map();

  constructor(private _pluginsDir: string) {}

  /**
   * Discover and load all plugins from the plugins directory
   */
  async loadPlugins(): Promise<void> {
    const pluginsPath = resolve(this._pluginsDir);
    console.log(`Loading plugins from: ${pluginsPath}`);

    try {
      const entries = await readdir(pluginsPath, { withFileTypes: true });
      const pluginDirs = entries.filter((entry) => entry.isDirectory());

      for (const dir of pluginDirs) {
        await this.loadPlugin(join(pluginsPath, dir.name));
      }

      console.log(`Loaded ${this.plugins.size} plugins`);
      console.log(`Registered ${this.tools.size} tools`);
      console.log(`Registered ${this.workflows.size} workflows`);
    } catch (error) {
      if ((error as {code?: string}).code === 'ENOENT') {
        console.warn(`Plugins directory not found: ${pluginsPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load a single plugin from a directory
   */
  private async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Look for index.ts or index.js as the plugin entry point
      const indexPath = join(pluginPath, 'index.js');
      const pluginModule = await import(indexPath);

      // The module should export a default Plugin instance or a factory function
      const plugin: Plugin =
        typeof pluginModule.default === 'function'
          ? await pluginModule.default()
          : pluginModule.default;

      if (!this.validatePlugin(plugin)) {
        console.error(`Invalid plugin at ${pluginPath}`);
        return;
      }

      // Initialize the plugin
      await plugin.initialize();

      // Register plugin
      this.plugins.set(plugin.metadata.name, plugin);
      console.log(
        `Loaded plugin: ${plugin.metadata.name} v${plugin.metadata.version}`
      );

      // Register tools
      const tools = plugin.getTools();
      for (const tool of tools) {
        if (this.tools.has(tool.definition.name)) {
          console.warn(
            `Tool ${tool.definition.name} already registered, skipping`
          );
          continue;
        }
        this.tools.set(tool.definition.name, {
          plugin: plugin.metadata.name,
          tool,
        });
        console.log(`  - Registered tool: ${tool.definition.name}`);
      }

      // Register workflows
      const workflows = plugin.getWorkflows();
      for (const workflow of workflows) {
        if (this.workflows.has(workflow.name)) {
          console.warn(
            `Workflow ${workflow.name} already registered, skipping`
          );
          continue;
        }
        this.workflows.set(workflow.name, {
          plugin: plugin.metadata.name,
          workflow,
        });
        console.log(`  - Registered workflow: ${workflow.name}`);
      }
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
    }
  }

  /**
   * Validate that an object implements the Plugin interface
   */
  private validatePlugin(plugin: any): plugin is Plugin {
    return (
      plugin &&
      typeof plugin === 'object' &&
      plugin.metadata &&
      typeof plugin.metadata.name === 'string' &&
      typeof plugin.metadata.version === 'string' &&
      typeof plugin.initialize === 'function' &&
      typeof plugin.getTools === 'function' &&
      typeof plugin.getWorkflows === 'function'
    );
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered tools
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name)?.tool;
  }

  /**
   * Get all registered workflows
   */
  getWorkflows(): Workflow[] {
    return Array.from(this.workflows.values()).map((entry) => entry.workflow);
  }

  /**
   * Get a workflow by name
   */
  getWorkflow(name: string): Workflow | undefined {
    return this.workflows.get(name)?.workflow;
  }

  /**
   * Set WorkflowEngine for plugins that need it (e.g., scheduler plugin)
   */
  setWorkflowEngine(workflowEngine: WorkflowEngine): void {
    for (const plugin of this.plugins.values()) {
      // Check if plugin has a setWorkflowEngine method
      if ('setWorkflowEngine' in plugin && typeof plugin.setWorkflowEngine === 'function') {
        plugin.setWorkflowEngine(workflowEngine);
        console.log(`Injected WorkflowEngine into plugin: ${plugin.metadata.name}`);
      }
    }
  }

  /**
   * Set Agent for plugins that need it (e.g., telegram plugin)
   */
  setAgent(agent: any): void {
    for (const plugin of this.plugins.values()) {
      if ('setAgent' in plugin && typeof plugin.setAgent === 'function') {
        plugin.setAgent(agent);
        console.log(`Injected Agent into plugin: ${plugin.metadata.name}`);
      }
    }
  }

  /**
   * Set PluginLoader reference for plugins that need it (e.g., telegram plugin)
   */
  setPluginLoaderReference(): void {
    for (const plugin of this.plugins.values()) {
      if ('setPluginLoader' in plugin && typeof plugin.setPluginLoader === 'function') {
        plugin.setPluginLoader(this);
        console.log(`Injected PluginLoader into plugin: ${plugin.metadata.name}`);
      }
    }
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup();
        } catch (error) {
          console.error(
            `Error cleaning up plugin ${plugin.metadata.name}:`,
            error
          );
        }
      }
    }
  }
}
