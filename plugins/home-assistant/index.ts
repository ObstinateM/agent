import type { Plugin, Tool, Workflow } from '../../src/types/plugin.js';
import { logger } from '../../src/utils/logger.js';
import { HomeAssistantClient } from './api-client.js';
import { createTools } from './tools.js';
import { createWorkflows } from './workflows.js';

class HomeAssistantPlugin implements Plugin {
  metadata = {
    name: 'home-assistant',
    version: '1.0.0',
    description:
      'Home Assistant integration for controlling smart home devices, automations, and more',
    author: 'Agent',
  };

  private client: HomeAssistantClient | null = null;

  async initialize(): Promise<void> {
    const baseUrl = process.env.HOME_ASSISTANT_URL;
    const token = process.env.HOME_ASSISTANT_TOKEN;

    if (!baseUrl || !token) {
      logger.warn(
        'Home Assistant plugin: HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN must be set'
      );
      return;
    }

    this.client = new HomeAssistantClient({ baseUrl, token });

    try {
      await this.client.checkConnection();
      logger.info('Home Assistant plugin initialized successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const cause = (error as { cause?: { code?: string } })?.cause?.code;

      if (cause === 'ECONNREFUSED' || cause === 'EHOSTUNREACH' || cause === 'ENOTFOUND') {
        logger.warn(
          `Home Assistant plugin: Cannot reach ${baseUrl} - plugin disabled`
        );
      } else {
        logger.warn(`Home Assistant plugin: Connection failed (${message}) - plugin disabled`);
      }
      this.client = null;
    }
  }

  getTools(): Tool[] {
    if (!this.client) {
      return [];
    }
    return createTools(this.client);
  }

  getWorkflows(): Workflow[] {
    if (!this.client) {
      return [];
    }
    return createWorkflows();
  }

  async cleanup(): Promise<void> {
    this.client = null;
    logger.info('Home Assistant plugin cleaned up');
  }
}

export default new HomeAssistantPlugin();
