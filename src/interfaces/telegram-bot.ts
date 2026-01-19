import { Telegraf, Context } from 'telegraf';
import { Message } from 'telegraf/types';
import { Agent } from '../core/agent.js';
import { WorkflowEngine } from '../core/workflow-engine.js';
import { PluginLoader } from '../core/plugin-loader.js';
import { logger } from '../utils/logger.js';

interface TelegramBotConfig {
  token: string;
  allowedUsers?: number[];
}

/**
 * Telegram bot interface for the AI Agent.
 * Allows users to interact with the agent through Telegram messages.
 */
export class TelegramBot {
  private bot: Telegraf;
  private agent: Agent;
  private workflowEngine: WorkflowEngine;
  private pluginLoader: PluginLoader;
  private allowedUsers: Set<number>;

  constructor(
    config: TelegramBotConfig,
    agent: Agent,
    workflowEngine: WorkflowEngine,
    pluginLoader: PluginLoader
  ) {
    this.bot = new Telegraf(config.token);
    this.agent = agent;
    this.workflowEngine = workflowEngine;
    this.pluginLoader = pluginLoader;
    this.allowedUsers = new Set(config.allowedUsers || []);

    this.setupHandlers();
  }

  private setupHandlers(): void {
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

  /**
   * Start the Telegram bot
   */
  async start(): Promise<void> {
    logger.info('Starting Telegram bot...');
    await this.bot.launch();
    logger.info('Telegram bot is running!');

    process.once('SIGINT', () => this.stop());
    process.once('SIGTERM', () => this.stop());
  }

  /**
   * Stop the Telegram bot gracefully
   */
  async stop(): Promise<void> {
    logger.info('Stopping Telegram bot...');
    this.bot.stop();
  }
}
