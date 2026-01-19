import { Telegraf, Context } from 'telegraf';
import { Message } from 'telegraf/types';
import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';
import type { Agent } from '../../src/core/agent.js';
import type { WorkflowEngine } from '../../src/core/workflow-engine.js';
import type { PluginLoader } from '../../src/core/plugin-loader.js';
import { createTools } from './tools.js';
import { createWorkflows } from './workflows.js';
import { logger } from '../../src/utils/logger.js';

/**
 * Telegram plugin provides a Telegram bot interface for the AI Agent.
 * Handles user authentication and message routing.
 */
class TelegramPlugin implements Plugin {
  metadata = {
    name: 'telegram',
    version: '1.0.0',
    description: 'Telegram bot interface for the AI Agent',
    author: 'AI Agent System',
  };

  private bot: Telegraf | null = null;
  private agent: Agent | null = null;
  private workflowEngine: WorkflowEngine | null = null;
  private pluginLoader: PluginLoader | null = null;
  private allowedUsers: Set<number> = new Set();

  async initialize(): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const interfaceMode = process.env.INTERFACE_MODE || 'cli';

    // Parse comma-separated interface modes
    const enabledInterfaces = interfaceMode.split(',').map((m) => m.trim().toLowerCase());

    // Only initialize if telegram is in the enabled interfaces
    if (!enabledInterfaces.includes('telegram')) {
      logger.debug('Telegram plugin loaded but not active (telegram not in INTERFACE_MODE)');
      return;
    }

    if (!token) {
      logger.warn('TELEGRAM_BOT_TOKEN not set, Telegram plugin will not start');
      return;
    }

    const allowedUsersStr = process.env.TELEGRAM_ALLOWED_USERS || '';
    if (allowedUsersStr) {
      allowedUsersStr.split(',').forEach(id => {
        const userId = parseInt(id.trim());
        if (!isNaN(userId)) {
          this.allowedUsers.add(userId);
        }
      });
    }

    this.bot = new Telegraf(token);
    this.setupHandlers();

    logger.info('Telegram plugin initialized');
  }

  /**
   * Inject the Agent instance for handling chat messages.
   */
  setAgent(agent: Agent): void {
    this.agent = agent;
  }

  /**
   * Inject the WorkflowEngine for executing workflows.
   */
  setWorkflowEngine(engine: WorkflowEngine): void {
    this.workflowEngine = engine;
  }

  /**
   * Inject the PluginLoader for listing available tools and workflows.
   */
  setPluginLoader(loader: PluginLoader): void {
    this.pluginLoader = loader;
  }

  /**
   * Launch the Telegram bot and start listening for messages.
   */
  async startBot(): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    logger.info('Starting Telegram bot...');
    await this.bot.launch();
    logger.info('Telegram bot is ready!');

    if (this.allowedUsers.size > 0) {
      logger.info(`Allowed users: ${Array.from(this.allowedUsers).join(', ')}`);
    } else {
      logger.warn('No user restrictions set. Anyone can use the bot!');
    }

    process.once('SIGINT', () => this.stopBot());
    process.once('SIGTERM', () => this.stopBot());
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    this.bot.start((ctx) => this.handleStart(ctx));
    this.bot.command('tools', (ctx) => this.handleTools(ctx));
    this.bot.command('workflows', (ctx) => this.handleWorkflows(ctx));
    this.bot.command('workflow', (ctx) => this.handleWorkflowExecution(ctx));
    this.bot.command('clear', (ctx) => this.handleClear(ctx));
    this.bot.command('help', (ctx) => this.handleHelp(ctx));
    this.bot.on('text', (ctx) => this.handleMessage(ctx));

    this.bot.catch((err, ctx) => {
      logger.error('Telegram bot error:', err);
      ctx.reply('An error occurred. Please try again.');
    });
  }

  private isUserAllowed(userId: number): boolean {
    if (this.allowedUsers.size === 0) return true;
    return this.allowedUsers.has(userId);
  }

  private async handleStart(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !this.isUserAllowed(userId)) {
      await ctx.reply('You are not authorized to use this bot.');
      return;
    }

    await ctx.reply(
      '🤖 Welcome to AI Agent System!\n\n' +
      'I can help you with various tasks using connected tools.\n\n' +
      'Available commands:\n' +
      '/tools - List all available tools\n' +
      '/workflows - List all available workflows\n' +
      '/workflow <name> - Execute a workflow\n' +
      '/clear - Clear conversation history\n' +
      '/help - Show this help message\n\n' +
      'Just send me a message and I\'ll use the appropriate tools to help you!'
    );
  }

  private async handleTools(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !this.isUserAllowed(userId)) {
      await ctx.reply('You are not authorized to use this bot.');
      return;
    }

    if (!this.pluginLoader) {
      await ctx.reply('Plugin loader not available');
      return;
    }

    const tools = this.pluginLoader.getTools();
    const toolsList = tools
      .map((tool) => `• ${tool.definition.name}: ${tool.definition.description}`)
      .join('\n');

    await ctx.reply(`📦 Available Tools (${tools.length}):\n\n${toolsList}`);
  }

  private async handleWorkflows(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !this.isUserAllowed(userId)) {
      await ctx.reply('You are not authorized to use this bot.');
      return;
    }

    if (!this.pluginLoader) {
      await ctx.reply('Plugin loader not available');
      return;
    }

    const workflows = this.pluginLoader.getWorkflows();
    const workflowsList = workflows
      .map((wf) => `• ${wf.name}: ${wf.description}`)
      .join('\n');

    await ctx.reply(`🔄 Available Workflows (${workflows.length}):\n\n${workflowsList}`);
  }

  private async handleWorkflowExecution(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !this.isUserAllowed(userId)) {
      await ctx.reply('You are not authorized to use this bot.');
      return;
    }

    if (!this.workflowEngine) {
      await ctx.reply('Workflow engine not available');
      return;
    }

    const text = (ctx.message as Message.TextMessage).text;
    const parts = text.split(' ').slice(1);

    if (parts.length === 0) {
      await ctx.reply('Usage: /workflow <name> [params as JSON]');
      return;
    }

    const workflowName = parts[0];
    let params = {};

    if (parts.length > 1) {
      try {
        params = JSON.parse(parts.slice(1).join(' '));
      } catch {
        await ctx.reply('Invalid JSON parameters');
        return;
      }
    }

    await ctx.reply(`⏳ Executing workflow: ${workflowName}...`);

    try {
      const result = await this.workflowEngine.executeWorkflow(workflowName, params);

      if (result.success) {
        await ctx.reply('✅ Workflow completed successfully!');
      } else {
        await ctx.reply(`❌ Workflow failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('Workflow execution error:', error);
      await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleClear(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !this.isUserAllowed(userId)) {
      await ctx.reply('You are not authorized to use this bot.');
      return;
    }

    if (!this.agent) {
      await ctx.reply('Agent not available');
      return;
    }

    this.agent.clearHistory();
    await ctx.reply('✨ Conversation history cleared!');
  }

  private async handleHelp(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !this.isUserAllowed(userId)) {
      await ctx.reply('You are not authorized to use this bot.');
      return;
    }

    await ctx.reply(
      '🤖 AI Agent System Help\n\n' +
      'Commands:\n' +
      '/start - Start the bot\n' +
      '/tools - List all available tools\n' +
      '/workflows - List all available workflows\n' +
      '/workflow <name> [params] - Execute a workflow\n' +
      '/clear - Clear conversation history\n' +
      '/help - Show this help\n\n' +
      'You can also just send me a message and I\'ll automatically use the right tools to help you!'
    );
  }

  private async handleMessage(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId || !this.isUserAllowed(userId)) {
      await ctx.reply('You are not authorized to use this bot.');
      return;
    }

    if (!this.agent) {
      await ctx.reply('Agent not available');
      return;
    }

    const message = (ctx.message as Message.TextMessage).text;

    await ctx.reply('🤔 Thinking...');

    try {
      const response = await this.agent.chat(message);
      await ctx.reply(response);
    } catch (error) {
      logger.error('Chat error:', error);
      await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private stopBot(): void {
    if (this.bot) {
      logger.info('Stopping Telegram bot...');
      this.bot.stop();
    }
  }

  getTools(): Tool[] {
    return createTools();
  }

  getWorkflows(): Workflow[] {
    return createWorkflows();
  }

  async cleanup(): Promise<void> {
    this.stopBot();
    logger.info('Telegram plugin cleaned up');
  }
}

export default new TelegramPlugin();
