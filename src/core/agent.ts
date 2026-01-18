import OpenAI from 'openai';
import {
  AgentConfig,
  Message,
  ToolExecutionResult,
} from '../types/agent.js';
import { Tool, toolToOpenAIFunction } from '../types/plugin.js';
import { PluginLoader } from './plugin-loader.js';

/**
 * Main AI Agent that orchestrates LLM interactions and tool execution
 */
export class Agent {
  private openai: OpenAI;
  private config: AgentConfig;
  private conversationHistory: Message[] = [];

  constructor(
    config: AgentConfig,
    private _pluginLoader: PluginLoader
  ) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    // Initialize conversation with system prompt
    if (config.systemPrompt) {
      this.conversationHistory.push({
        role: 'system',
        content: config.systemPrompt,
      });
    }
  }

  /**
   * Process a user message and return the agent's response
   */
  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Get all available tools
    const tools = this._pluginLoader.getTools();
    const functions = tools.map(toolToOpenAIFunction);

    let response: OpenAI.Chat.Completions.ChatCompletion;
    let continueLoop = true;

    while (continueLoop) {
      // Call OpenAI with function calling
      response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: this.conversationHistory as any,
        functions: functions.length > 0 ? functions : undefined,
        function_call: functions.length > 0 ? 'auto' : undefined,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // If the model wants to call a function
      if (message.function_call) {
        const functionName = message.function_call.name;
        const functionArgs = JSON.parse(message.function_call.arguments);

        console.log(`\nExecuting tool: ${functionName}`);
        console.log(`Arguments:`, functionArgs);

        // Execute the tool
        const result = await this.executeTool(functionName, functionArgs);

        // Add assistant's function call to history
        this.conversationHistory.push({
          role: 'assistant',
          content: message.content ?? '',
          function_call: {
            name: functionName,
            arguments: message.function_call.arguments,
          },
        });

        // Add function result to history
        this.conversationHistory.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(result),
        });

        // Continue the loop to let the model process the result
        continueLoop = true;
      } else {
        // Model returned a regular response
        this.conversationHistory.push({
          role: 'assistant',
          content: message.content ?? '',
        });
        continueLoop = false;
      }
    }

    return response!.choices[0].message.content ?? '';
  }

  /**
   * Execute a tool by name with given parameters
   */
  private async executeTool(
    toolName: string,
    params: any
  ): Promise<ToolExecutionResult> {
    const tool = this._pluginLoader.getTool(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found`,
      };
    }

    try {
      // Validate parameters using Zod schema
      const validatedParams = tool.definition.parameters.parse(params);

      // Execute the tool
      const result = await tool.execute(validatedParams);

      return {
        success: true,
        result,
      };
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get the conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear the conversation history (except system prompt)
   */
  clearHistory(): void {
    const systemPrompt = this.conversationHistory.find(
      (msg) => msg.role === 'system'
    );
    this.conversationHistory = systemPrompt ? [systemPrompt] : [];
  }

  /**
   * Get available tools
   */
  getAvailableTools(): Tool[] {
    return this._pluginLoader.getTools();
  }
}
