import 'dotenv/config';
import { Agent } from './core/agent.js';
import { PluginLoader } from './core/plugin-loader.js';
import { WorkflowEngine } from './core/workflow-engine.js';
import { SchedulerEngine } from './core/scheduler-engine.js';
import { createSchedulerTools } from './core/scheduler-tools.js';
import { CLI } from './interfaces/cli.js';
import { logger } from './utils/logger.js';

/**
 * Parse INTERFACE_MODE environment variable into a set of enabled interfaces.
 */
function parseInterfaceModes(): Set<string> {
  const modeStr = process.env.INTERFACE_MODE || 'cli';
  const modes = modeStr.split(',').map((m) => m.trim().toLowerCase()).filter((m) => m);
  return new Set(modes.length > 0 ? modes : ['cli']);
}

/**
 * Main entry point for the AI Agent system.
 * Supports multiple interfaces (CLI, Telegram) running simultaneously.
 * Configure via INTERFACE_MODE env var (comma-separated, e.g., "cli,telegram").
 */
async function main() {
  logger.info('AI Agent System Starting...');

  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  const systemPrompt = process.env.SYSTEM_PROMPT || `You are a helpful AI assistant with access to various tools and workflows.
You can help manage Docker containers, run shell scripts, and execute predefined workflows.
Always be clear about what actions you're taking and ask for confirmation when performing potentially destructive operations.`;

  if (!openaiApiKey) {
    logger.error('OPENAI_API_KEY environment variable is not set');
    logger.info('Please set it in your .env file or environment');
    process.exit(1);
  }

  const agentConfig = {
    openaiApiKey,
    model: openaiModel,
    systemPrompt,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    maxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS) : undefined,
  };

  const pluginsDir = process.env.PLUGINS_DIR || './plugins';
  const pluginLoader = new PluginLoader(pluginsDir);
  await pluginLoader.loadPlugins();

  const agent = new Agent(agentConfig, pluginLoader);
  const workflowEngine = new WorkflowEngine(pluginLoader, {
    openaiApiKey,
    openaiModel,
  });

  const schedulerEngine = new SchedulerEngine();
  schedulerEngine.setWorkflowEngine(workflowEngine);
  pluginLoader.registerCoreTools('scheduler', createSchedulerTools(schedulerEngine, pluginLoader));
  schedulerEngine.start();

  pluginLoader.setWorkflowEngine(workflowEngine);
  pluginLoader.setAgent(agent);
  pluginLoader.setPluginLoaderReference();

  const cleanup = async () => {
    logger.info('Shutting down...');
    schedulerEngine.close();
    await pluginLoader.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const enabledInterfaces = parseInterfaceModes();
  logger.info(`Enabled interfaces: ${Array.from(enabledInterfaces).join(', ')}`);

  // Start Telegram if enabled
  if (enabledInterfaces.has('telegram')) {
    const telegramPlugin = pluginLoader.getPlugin('telegram');

    if (!telegramPlugin) {
      logger.error('Telegram plugin not found');
      logger.info('The telegram plugin should be in plugins/telegram/');
      if (!enabledInterfaces.has('cli')) {
        process.exit(1);
      }
    } else if ('startBot' in telegramPlugin && typeof telegramPlugin.startBot === 'function') {
      await telegramPlugin.startBot();
    } else {
      logger.error('Telegram plugin does not have a startBot method');
      if (!enabledInterfaces.has('cli')) {
        process.exit(1);
      }
    }
  }

  // Start CLI if enabled (this blocks, so it must be last)
  if (enabledInterfaces.has('cli')) {
    logger.info('Starting CLI interface...');
    const cli = new CLI(agent, workflowEngine, pluginLoader);
    await cli.start();
  } else {
    // If no CLI, keep the process alive for other interfaces
    logger.info('Running without CLI. Press Ctrl+C to stop.');
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
