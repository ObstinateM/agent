import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';
import { IdfmPrimApiClient } from './api-client.js';
import { createTools } from './tools.js';
import { createWorkflows } from './workflows.js';
import { logger } from '../../src/utils/logger.js';

/**
 * IDFM PRIM Plugin provides access to Île-de-France Mobilités public transport data.
 * Uses the PRIM Navitia API for places, departures, journeys, and disruptions.
 */
class IdfmPrimPlugin implements Plugin {
  metadata = {
    name: 'idfm-prim',
    version: '1.0.0',
    description: 'Île-de-France Mobilités PRIM API integration for public transport data',
    author: 'AI Agent System',
  };

  private client: IdfmPrimApiClient | null = null;

  async initialize(): Promise<void> {
    const apiKey = process.env.IDFM_PRIM_API_KEY;

    if (!apiKey) {
      logger.warn('IDFM PRIM plugin: IDFM_PRIM_API_KEY not set. Plugin will not function.');
      return;
    }

    this.client = new IdfmPrimApiClient(apiKey);
    logger.info('IDFM PRIM plugin initialized');
  }

  getTools(): Tool[] {
    if (!this.client) {
      return [];
    }
    return createTools(this.client);
  }

  getWorkflows(): Workflow[] {
    return createWorkflows();
  }

  async cleanup(): Promise<void> {
    this.client = null;
    logger.info('IDFM PRIM plugin cleaned up');
  }

  /**
   * Get the API client instance (for testing purposes).
   */
  getClient(): IdfmPrimApiClient | null {
    return this.client;
  }
}

export default new IdfmPrimPlugin();
