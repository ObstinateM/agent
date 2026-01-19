import prompts from 'prompts';
import { Agent } from '../core/agent.js';
import { WorkflowEngine } from '../core/workflow-engine.js';
import { PluginLoader } from '../core/plugin-loader.js';
import { logger } from '../utils/logger.js';

/**
 * Command-line interface for the AI Agent.
 * Provides an interactive prompt for chatting with the agent.
 */
export class CLI {
  private agent: Agent;
  private workflowEngine: WorkflowEngine;
  private pluginLoader: PluginLoader;

  constructor(
    agent: Agent,
    workflowEngine: WorkflowEngine,
    pluginLoader: PluginLoader
  ) {
    this.agent = agent;
    this.workflowEngine = workflowEngine;
    this.pluginLoader = pluginLoader;
  }

  private async shutdown(message?: string): Promise<void> {
    if (message) {
      console.log(message);
    }
    await this.pluginLoader.cleanup();
  }

  /**
   * Start the interactive CLI session.
   */
  async start(): Promise<void> {
    console.log('\n📦 Available Tools:');
    this.pluginLoader.getTools().forEach((tool) => {
      console.log(`  - ${tool.definition.name}: ${tool.definition.description}`);
    });

    console.log('\n🔄 Available Workflows:');
    this.pluginLoader.getWorkflows().forEach((workflow) => {
      console.log(`  - ${workflow.name}: ${workflow.description}`);
    });

    console.log('\n✨ Agent ready! Type your message or special commands:');
    console.log('  - /workflow <name> [params] - Execute a workflow');
    console.log('  - /tools - List all available tools');
    console.log('  - /workflows - List all available workflows');
    console.log('  - /clear - Clear conversation history');
    console.log('  - /exit - Exit the agent\n');

    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await this.shutdown();
      process.exit(0);
    });

    while (true) {
      let rawInput = '';
      let cancelled = false;
      const response = await prompts(
        {
          type: 'text',
          name: 'command',
          message: '>',
        },
        {
          onCancel: () => {
            cancelled = true;
            return false;
          },
        }
      );
      rawInput = typeof response.command === 'string' ? response.command : '';

      if (cancelled) {
        await this.shutdown('\nGoodbye!');
        return;
      }

      const command = rawInput.trim();

      if (!command) {
        continue;
      }

      if (command === '/exit') {
        await this.shutdown('\nGoodbye!');
        return;
      }

      if (command === '/clear') {
        this.agent.clearHistory();
        console.log('Conversation history cleared');
        continue;
      }

      if (command === '/tools') {
        console.log('\n📦 Available Tools:');
        this.pluginLoader.getTools().forEach((tool) => {
          console.log(`  - ${tool.definition.name}: ${tool.definition.description}`);
        });
        console.log();
        continue;
      }

      if (command === '/workflows') {
        console.log('\n🔄 Available Workflows:');
        this.pluginLoader.getWorkflows().forEach((workflow) => {
          console.log(`  - ${workflow.name}: ${workflow.description}`);
        });
        console.log();
        continue;
      }

      if (command.startsWith('/workflow ')) {
        const parts = command.slice(10).split(' ');
        const workflowName = parts[0];

        let params = {};
        if (parts.length > 1) {
          try {
            params = JSON.parse(parts.slice(1).join(' '));
          } catch {
            logger.error('Invalid JSON parameters');
            console.log('Invalid JSON parameters');
            continue;
          }
        }

        try {
          const result = await this.workflowEngine.executeWorkflow(workflowName, params);
          if (result.success) {
            console.log('\n✅ Workflow completed successfully');
          } else {
            console.log(`\n❌ Workflow failed: ${result.error}`);
          }
        } catch (error) {
          logger.error('Error executing workflow:', error);
          console.log(`\n❌ Error executing workflow: ${error instanceof Error ? error.message : String(error)}`);
        }
        console.log();
        continue;
      }

      try {
        const response = await this.agent.chat(command);
        console.log(`\n🤖 ${response}\n`);
      } catch (error) {
        logger.error('Chat error:', error);
        console.log(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  }
}
