import 'dotenv/config';
import { Agent } from './core/agent.js';
import { PluginLoader } from './core/plugin-loader.js';
import { WorkflowEngine } from './core/workflow-engine.js';
import { SchedulerEngine } from './core/scheduler-engine.js';
import { createSchedulerTools } from './core/scheduler-tools.js';
import { CLI } from './interfaces/cli.js';

/**
 * Main entry point for the AI Agent system.
 * Supports both CLI and Telegram bot interfaces based on environment configuration.
 */
async function main() {
  console.log('🤖 AI Agent System Starting...\n');

  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  const systemPrompt = process.env.SYSTEM_PROMPT || `You are a helpful AI assistant with access to various tools and workflows.
You can help manage Docker containers, run shell scripts, and execute predefined workflows.
Always be clear about what actions you're taking and ask for confirmation when performing potentially destructive operations.`;

  if (!openaiApiKey) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is not set');
    console.log('Please set it in your .env file or environment');
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

  // Initialize scheduler engine and register its tools
  const schedulerEngine = new SchedulerEngine();
  schedulerEngine.setWorkflowEngine(workflowEngine);
  pluginLoader.registerCoreTools('scheduler', createSchedulerTools(schedulerEngine, pluginLoader));
  schedulerEngine.start();

  // Inject dependencies into plugins that need them
  pluginLoader.setWorkflowEngine(workflowEngine);
  pluginLoader.setAgent(agent);
  pluginLoader.setPluginLoaderReference();

  // Setup cleanup handlers
  const cleanup = async () => {
    console.log('\nShutting down...');
    schedulerEngine.close();
    await pluginLoader.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const interfaceMode = process.env.INTERFACE_MODE || 'cli';

  if (interfaceMode === 'telegram') {
    // Telegram interface is now handled by the telegram plugin
    const telegramPlugin = pluginLoader.getPlugin('telegram');

    if (!telegramPlugin) {
      console.error('❌ Error: Telegram plugin not found');
      console.log('The telegram plugin should be in plugins/telegram/');
      process.exit(1);
    }

    // Start the bot via the plugin
    if ('startBot' in telegramPlugin && typeof telegramPlugin.startBot === 'function') {
      await telegramPlugin.startBot();
    } else {
      console.error('❌ Error: Telegram plugin does not have a startBot method');
      process.exit(1);
    }
  } else {
    console.log('Starting CLI interface...\n');
    const cli = new CLI(agent, workflowEngine, pluginLoader);
    await cli.start();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
