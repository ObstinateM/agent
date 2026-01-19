import { readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { Plugin, Tool, Workflow } from '../types/plugin.js';
import type { WorkflowEngine } from './workflow-engine.js';
import type { Agent } from './agent.js';
import { logger } from '../utils/logger.js';

interface PendingPlugin {
  path: string;
  plugin: Plugin;
}

/**
 * PluginLoader handles auto-discovery and loading of plugins.
 * Supports plugin dependencies and core tool registration.
 */
export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private tools: Map<string, { source: string; tool: Tool }> = new Map();
  private workflows: Map<string, { plugin: string; workflow: Workflow }> = new Map();

  constructor(private _pluginsDir: string) {}

  /**
   * Discover and load all plugins from the plugins directory.
   * Plugins are loaded in dependency order.
   */
  async loadPlugins(): Promise<void> {
    const pluginsPath = resolve(this._pluginsDir);
    logger.info(`Loading plugins from: ${pluginsPath}`);

    try {
      const entries = await readdir(pluginsPath, { withFileTypes: true });
      const pluginDirs = entries.filter((entry) => entry.isDirectory());

      const pendingPlugins = await this.discoverPlugins(pluginDirs, pluginsPath);
      const sortedPlugins = this.sortByDependencies(pendingPlugins);

      for (const pending of sortedPlugins) {
        await this.initializePlugin(pending);
      }

      logger.info(`Loaded ${this.plugins.size} plugins`);
      logger.info(`Registered ${this.tools.size} tools`);
      logger.info(`Registered ${this.workflows.size} workflows`);
    } catch (error) {
      if ((error as {code?: string}).code === 'ENOENT') {
        logger.warn(`Plugins directory not found: ${pluginsPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Discover all plugins without initializing them.
   */
  private async discoverPlugins(
    pluginDirs: { name: string }[],
    pluginsPath: string
  ): Promise<PendingPlugin[]> {
    const pending: PendingPlugin[] = [];

    for (const dir of pluginDirs) {
      const pluginPath = join(pluginsPath, dir.name);
      try {
        const indexPath = join(pluginPath, 'index.js');
        const pluginModule = await import(indexPath);

        const plugin: Plugin =
          typeof pluginModule.default === 'function'
            ? await pluginModule.default()
            : pluginModule.default;

        if (!this.validatePlugin(plugin)) {
          logger.error(`Invalid plugin at ${pluginPath}`);
          continue;
        }

        pending.push({ path: pluginPath, plugin });
      } catch (error) {
        logger.error(`Failed to load plugin from ${pluginPath}:`, error);
      }
    }

    return pending;
  }

  /**
   * Sort plugins by dependencies using topological sort.
   * Throws if a required dependency is missing.
   */
  private sortByDependencies(pending: PendingPlugin[]): PendingPlugin[] {
    const pluginMap = new Map<string, PendingPlugin>();
    for (const p of pending) {
      pluginMap.set(p.plugin.metadata.name, p);
    }

    const visited = new Set<string>();
    const sorted: PendingPlugin[] = [];

    const visit = (name: string, chain: string[] = []): void => {
      if (visited.has(name)) return;

      const pending = pluginMap.get(name);
      if (!pending) {
        throw new Error(
          `Missing dependency: "${name}" required by "${chain[chain.length - 1] || 'unknown'}"`
        );
      }

      if (chain.includes(name)) {
        throw new Error(`Circular dependency detected: ${[...chain, name].join(' -> ')}`);
      }

      const deps = pending.plugin.metadata.dependencies || [];
      for (const dep of deps) {
        visit(dep, [...chain, name]);
      }

      visited.add(name);
      sorted.push(pending);
    };

    for (const p of pending) {
      visit(p.plugin.metadata.name);
    }

    return sorted;
  }

  /**
   * Initialize a plugin and register its tools and workflows.
   */
  private async initializePlugin(pending: PendingPlugin): Promise<void> {
    const { plugin } = pending;

    try {
      await plugin.initialize();

      this.plugins.set(plugin.metadata.name, plugin);
      logger.info(
        `Loaded plugin: ${plugin.metadata.name} v${plugin.metadata.version}`
      );

      const tools = plugin.getTools();
      for (const tool of tools) {
        if (this.tools.has(tool.definition.name)) {
          logger.warn(
            `Tool ${tool.definition.name} already registered, skipping`
          );
          continue;
        }
        this.tools.set(tool.definition.name, {
          source: plugin.metadata.name,
          tool,
        });
        logger.debug(`  - Registered tool: ${tool.definition.name}`);
      }

      const workflows = plugin.getWorkflows();
      for (const workflow of workflows) {
        if (this.workflows.has(workflow.name)) {
          logger.warn(
            `Workflow ${workflow.name} already registered, skipping`
          );
          continue;
        }
        this.workflows.set(workflow.name, {
          plugin: plugin.metadata.name,
          workflow,
        });
        logger.debug(`  - Registered workflow: ${workflow.name}`);
      }
    } catch (error) {
      logger.error(`Failed to initialize plugin ${plugin.metadata.name}:`, error);
    }
  }

  /**
   * Validate that an object implements the Plugin interface.
   */
  private validatePlugin(plugin: unknown): plugin is Plugin {
    if (!plugin || typeof plugin !== 'object') {
      return false;
    }

    const candidate = plugin as Partial<Plugin>;
    return (
      !!candidate.metadata &&
      typeof candidate.metadata.name === 'string' &&
      typeof candidate.metadata.version === 'string' &&
      typeof candidate.initialize === 'function' &&
      typeof candidate.getTools === 'function' &&
      typeof candidate.getWorkflows === 'function'
    );
  }

  /**
   * Register tools from a core component (not a plugin).
   */
  registerCoreTools(source: string, tools: Tool[]): void {
    for (const tool of tools) {
      if (this.tools.has(tool.definition.name)) {
        logger.warn(`Tool ${tool.definition.name} already registered, skipping`);
        continue;
      }
      this.tools.set(tool.definition.name, { source, tool });
      logger.debug(`Registered core tool: ${tool.definition.name} (from ${source})`);
    }
  }

  /**
   * Get all loaded plugins.
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a plugin by name.
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered tools.
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values()).map((entry) => entry.tool);
  }

  /**
   * Get a tool by name.
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name)?.tool;
  }

  /**
   * Get all registered workflows.
   */
  getWorkflows(): Workflow[] {
    return Array.from(this.workflows.values()).map((entry) => entry.workflow);
  }

  /**
   * Get a workflow by name.
   */
  getWorkflow(name: string): Workflow | undefined {
    return this.workflows.get(name)?.workflow;
  }

  /**
   * Set WorkflowEngine for plugins that need it.
   */
  setWorkflowEngine(workflowEngine: WorkflowEngine): void {
    for (const plugin of this.plugins.values()) {
      if ('setWorkflowEngine' in plugin && typeof plugin.setWorkflowEngine === 'function') {
        plugin.setWorkflowEngine(workflowEngine);
        logger.debug(`Injected WorkflowEngine into plugin: ${plugin.metadata.name}`);
      }
    }
  }

  /**
   * Set Agent for plugins that need it.
   */
  setAgent(agent: Agent): void {
    for (const plugin of this.plugins.values()) {
      if ('setAgent' in plugin && typeof plugin.setAgent === 'function') {
        plugin.setAgent(agent);
        logger.debug(`Injected Agent into plugin: ${plugin.metadata.name}`);
      }
    }
  }

  /**
   * Set PluginLoader reference for plugins that need it.
   */
  setPluginLoaderReference(): void {
    for (const plugin of this.plugins.values()) {
      if ('setPluginLoader' in plugin && typeof plugin.setPluginLoader === 'function') {
        plugin.setPluginLoader(this);
        logger.debug(`Injected PluginLoader into plugin: ${plugin.metadata.name}`);
      }
    }
  }

  /**
   * Cleanup all plugins.
   */
  async cleanup(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        try {
          await plugin.cleanup();
        } catch (error) {
          logger.error(
            `Error cleaning up plugin ${plugin.metadata.name}:`,
            error
          );
        }
      }
    }
  }
}
