import { createInterface } from 'readline';
import { Agent } from '../core/agent.js';
import { WorkflowEngine } from '../core/workflow-engine.js';
import { PluginLoader } from '../core/plugin-loader.js';

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

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();

      if (!input) {
        rl.prompt();
        return;
      }

      if (input === '/exit') {
        console.log('Goodbye!');
        await this.pluginLoader.cleanup();
        process.exit(0);
      }

      if (input === '/clear') {
        this.agent.clearHistory();
        console.log('Conversation history cleared');
        rl.prompt();
        return;
      }

      if (input === '/tools') {
        console.log('\n📦 Available Tools:');
        this.pluginLoader.getTools().forEach((tool) => {
          console.log(`  - ${tool.definition.name}: ${tool.definition.description}`);
        });
        console.log();
        rl.prompt();
        return;
      }

      if (input === '/workflows') {
        console.log('\n🔄 Available Workflows:');
        this.pluginLoader.getWorkflows().forEach((workflow) => {
          console.log(`  - ${workflow.name}: ${workflow.description}`);
        });
        console.log();
        rl.prompt();
        return;
      }

      if (input.startsWith('/workflow ')) {
        const parts = input.slice(10).split(' ');
        const workflowName = parts[0];

        let params = {};
        if (parts.length > 1) {
          try {
            params = JSON.parse(parts.slice(1).join(' '));
          } catch {
            console.error('Invalid JSON parameters');
            rl.prompt();
            return;
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
          console.error('\n❌ Error executing workflow:', error);
        }
        console.log();
        rl.prompt();
        return;
      }

      try {
        const response = await this.agent.chat(input);
        console.log(`\n🤖 ${response}\n`);
      } catch (error) {
        console.error('\n❌ Error:', error);
        console.log();
      }

      rl.prompt();
    });

    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      await this.pluginLoader.cleanup();
      process.exit(0);
    });
  }
}
