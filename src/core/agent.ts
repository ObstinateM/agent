import OpenAI from 'openai';
import {
  AgentConfig,
  Message,
} from '../types/agent.js';
import { Tool, toolToOpenAIFunction } from '../types/plugin.js';
import { PluginLoader } from './plugin-loader.js';
import { executeTool } from './tool-executor.js';
import { logger } from '../utils/logger.js';

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
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    const tools = this._pluginLoader.getTools();
    const functions = tools.map(toolToOpenAIFunction);

    while (true) {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: this.conversationHistory as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        functions: functions.length > 0 ? functions : undefined,
        function_call: functions.length > 0 ? 'auto' : undefined,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens,
      });

      const choice = response.choices[0];
      const message = choice.message;

      if (message.function_call) {
        const functionName = message.function_call.name;
        const parsedArgs = this.parseFunctionArgs(message.function_call.arguments);

        logger.debug(`Executing tool: ${functionName}`);
        logger.debug(`Arguments:`, parsedArgs.ok ? parsedArgs.value : message.function_call.arguments);

        const result = parsedArgs.ok
          ? await executeTool(this._pluginLoader, functionName, parsedArgs.value)
          : { success: false, error: parsedArgs.error };

        this.conversationHistory.push({
          role: 'assistant',
          content: message.content ?? '',
          function_call: {
            name: functionName,
            arguments: message.function_call.arguments,
          },
        });

        this.conversationHistory.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(result),
        });
        continue;
      } else {
        this.conversationHistory.push({
          role: 'assistant',
          content: message.content ?? '',
        });
        return message.content ?? '';
      }
    }
  }

  private parseFunctionArgs(
    rawArgs: string
  ): { ok: true; value: unknown } | { ok: false; error: string } {
    try {
      return { ok: true, value: JSON.parse(rawArgs) };
    } catch (error) {
      return {
        ok: false,
        error: `Invalid JSON arguments: ${error instanceof Error ? error.message : String(error)}`,
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
