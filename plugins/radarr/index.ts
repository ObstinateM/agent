import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';
import { RadarrApiClient } from './api-client.js';
import { createTools } from './tools.js';
import { createWorkflows } from './workflows.js';
import { logger } from '../../src/utils/logger.js';

/**
 * Radarr Plugin provides movie management via Radarr API.
 * Allows searching, adding movies, and monitoring download status.
 */
class RadarrPlugin implements Plugin {
  metadata = {
    name: 'radarr',
    version: '1.0.0',
    description: 'Radarr integration for movie management',
    author: 'AI Agent System',
  };

  private client: RadarrApiClient | null = null;

  async initialize(): Promise<void> {
    const baseUrl = process.env.RADARR_URL;
    const apiKey = process.env.RADARR_API_KEY;
    const basicAuthUser = process.env.RADARR_BASIC_AUTH_USER;
    const basicAuthPass = process.env.RADARR_BASIC_AUTH_PASS;

    if (!baseUrl || !apiKey) {
      logger.warn('Radarr plugin: RADARR_URL or RADARR_API_KEY not set. Plugin will not function.');
      return;
    }

    const basicAuth = basicAuthUser && basicAuthPass
      ? { username: basicAuthUser, password: basicAuthPass }
      : undefined;

    this.client = new RadarrApiClient({ baseUrl, apiKey, basicAuth });
    logger.info('Radarr plugin initialized' + (basicAuth ? ' (with basic auth)' : ''));
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
    logger.info('Radarr plugin cleaned up');
  }
}

export default new RadarrPlugin();
