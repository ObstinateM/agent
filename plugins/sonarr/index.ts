import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';
import { SonarrApiClient } from './api-client.js';
import { createTools } from './tools.js';
import { createWorkflows } from './workflows.js';
import { logger } from '../../src/utils/logger.js';

/**
 * Sonarr Plugin provides TV series management via Sonarr API.
 * Allows searching, adding series, and monitoring download status.
 */
class SonarrPlugin implements Plugin {
  metadata = {
    name: 'sonarr',
    version: '1.0.0',
    description: 'Sonarr integration for TV series management',
    author: 'AI Agent System',
  };

  private client: SonarrApiClient | null = null;

  async initialize(): Promise<void> {
    const baseUrl = process.env.SONARR_URL;
    const apiKey = process.env.SONARR_API_KEY;
    const basicAuthUser = process.env.SONARR_BASIC_AUTH_USER;
    const basicAuthPass = process.env.SONARR_BASIC_AUTH_PASS;

    if (!baseUrl || !apiKey) {
      logger.warn('Sonarr plugin: SONARR_URL or SONARR_API_KEY not set. Plugin will not function.');
      return;
    }

    const basicAuth = basicAuthUser && basicAuthPass
      ? { username: basicAuthUser, password: basicAuthPass }
      : undefined;

    this.client = new SonarrApiClient({ baseUrl, apiKey, basicAuth });
    logger.info('Sonarr plugin initialized' + (basicAuth ? ' (with basic auth)' : ''));
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
    logger.info('Sonarr plugin cleaned up');
  }
}

export default new SonarrPlugin();
