import { logger } from '../../src/utils/logger.js';
import type {
  HomeAssistantConfig,
  EntityState,
  ServiceDomain,
  HistoryEntry,
  ServiceCallResponse,
  Area,
  Device,
} from './types.js';

/**
 * Home Assistant REST API client.
 * Handles authentication and communication with Home Assistant instance.
 */
export class HomeAssistantClient {
  private baseUrl: string;
  private token: string;

  constructor(config: HomeAssistantConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Home Assistant API error: ${response.status}`, errorText);
      throw new Error(
        `Home Assistant API error: ${response.status} - ${errorText}`
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return response.text() as unknown as T;
  }

  /**
   * Check if the Home Assistant instance is reachable and the token is valid.
   */
  async checkConnection(): Promise<{ message: string }> {
    return this.request('/');
  }

  /**
   * Get the state of all entities.
   */
  async getStates(): Promise<EntityState[]> {
    return this.request('/states');
  }

  /**
   * Get the state of a specific entity.
   */
  async getState(entityId: string): Promise<EntityState> {
    return this.request(`/states/${entityId}`);
  }

  /**
   * Get states filtered by domain (e.g., 'light', 'switch', 'sensor').
   */
  async getStatesByDomain(domain: string): Promise<EntityState[]> {
    const states = await this.getStates();
    return states.filter((state) => state.entity_id.startsWith(`${domain}.`));
  }

  /**
   * Get all available services grouped by domain.
   */
  async getServices(): Promise<ServiceDomain[]> {
    const services = await this.request<Record<string, unknown>>('/services');
    return Object.entries(services).map(([domain, data]) => ({
      domain,
      services: data as Record<string, unknown>,
    })) as ServiceDomain[];
  }

  /**
   * Call a service on Home Assistant.
   */
  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<ServiceCallResponse[]> {
    return this.request(`/services/${domain}/${service}`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Turn on an entity (light, switch, etc.).
   */
  async turnOn(
    entityId: string,
    attributes?: Record<string, unknown>
  ): Promise<ServiceCallResponse[]> {
    const domain = entityId.split('.')[0];
    return this.callService(domain, 'turn_on', {
      entity_id: entityId,
      ...attributes,
    });
  }

  /**
   * Turn off an entity (light, switch, etc.).
   */
  async turnOff(entityId: string): Promise<ServiceCallResponse[]> {
    const domain = entityId.split('.')[0];
    return this.callService(domain, 'turn_off', { entity_id: entityId });
  }

  /**
   * Toggle an entity (light, switch, etc.).
   */
  async toggle(entityId: string): Promise<ServiceCallResponse[]> {
    const domain = entityId.split('.')[0];
    return this.callService(domain, 'toggle', { entity_id: entityId });
  }

  /**
   * Get history of state changes for entities.
   */
  async getHistory(
    startTime: Date,
    endTime?: Date,
    entityIds?: string[],
    minimalResponse?: boolean
  ): Promise<HistoryEntry[][]> {
    const params = new URLSearchParams();
    if (endTime) {
      params.set('end_time', endTime.toISOString());
    }
    if (entityIds?.length) {
      params.set('filter_entity_id', entityIds.join(','));
    }
    if (minimalResponse) {
      params.set('minimal_response', 'true');
    }

    const queryString = params.toString();
    const endpoint = `/history/period/${startTime.toISOString()}${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Fire an event on the Home Assistant event bus.
   */
  async fireEvent(
    eventType: string,
    eventData?: Record<string, unknown>
  ): Promise<{ message: string }> {
    return this.request(`/events/${eventType}`, {
      method: 'POST',
      body: eventData ? JSON.stringify(eventData) : undefined,
    });
  }

  /**
   * Trigger an automation by entity_id.
   */
  async triggerAutomation(
    automationEntityId: string
  ): Promise<ServiceCallResponse[]> {
    return this.callService('automation', 'trigger', {
      entity_id: automationEntityId,
    });
  }

  /**
   * Enable or disable an automation.
   */
  async setAutomationState(
    automationEntityId: string,
    enabled: boolean
  ): Promise<ServiceCallResponse[]> {
    const service = enabled ? 'turn_on' : 'turn_off';
    return this.callService('automation', service, {
      entity_id: automationEntityId,
    });
  }

  /**
   * Execute a script.
   */
  async executeScript(
    scriptEntityId: string,
    variables?: Record<string, unknown>
  ): Promise<ServiceCallResponse[]> {
    return this.callService('script', 'turn_on', {
      entity_id: scriptEntityId,
      variables,
    });
  }

  /**
   * Get all areas.
   */
  async getAreas(): Promise<Area[]> {
    return this.request('/config/area_registry/list', {
      method: 'GET',
    }).catch(() => {
      // Fallback for older versions - use websocket template
      return [];
    });
  }

  /**
   * Get all devices.
   */
  async getDevices(): Promise<Device[]> {
    return this.request('/config/device_registry/list', {
      method: 'GET',
    }).catch(() => {
      // Fallback for older versions
      return [];
    });
  }

  /**
   * Set the state of an input_boolean.
   */
  async setInputBoolean(
    entityId: string,
    value: boolean
  ): Promise<ServiceCallResponse[]> {
    const service = value ? 'turn_on' : 'turn_off';
    return this.callService('input_boolean', service, { entity_id: entityId });
  }

  /**
   * Set the value of an input_number.
   */
  async setInputNumber(
    entityId: string,
    value: number
  ): Promise<ServiceCallResponse[]> {
    return this.callService('input_number', 'set_value', {
      entity_id: entityId,
      value,
    });
  }

  /**
   * Set the value of an input_text.
   */
  async setInputText(
    entityId: string,
    value: string
  ): Promise<ServiceCallResponse[]> {
    return this.callService('input_text', 'set_value', {
      entity_id: entityId,
      value,
    });
  }

  /**
   * Set the option of an input_select.
   */
  async setInputSelect(
    entityId: string,
    option: string
  ): Promise<ServiceCallResponse[]> {
    return this.callService('input_select', 'select_option', {
      entity_id: entityId,
      option,
    });
  }

  /**
   * Set the datetime of an input_datetime.
   */
  async setInputDatetime(
    entityId: string,
    datetime?: string,
    date?: string,
    time?: string
  ): Promise<ServiceCallResponse[]> {
    const data: Record<string, unknown> = { entity_id: entityId };
    if (datetime) data.datetime = datetime;
    if (date) data.date = date;
    if (time) data.time = time;
    return this.callService('input_datetime', 'set_datetime', data);
  }

  /**
   * Send a notification.
   */
  async notify(
    message: string,
    title?: string,
    target?: string,
    data?: Record<string, unknown>
  ): Promise<ServiceCallResponse[]> {
    const serviceData: Record<string, unknown> = { message };
    if (title) serviceData.title = title;
    if (data) serviceData.data = data;

    const service = target ? `notify.${target}` : 'notify.notify';
    const [domain, serviceName] = service.split('.');
    return this.callService(domain, serviceName, serviceData);
  }

  /**
   * Set climate temperature.
   */
  async setClimateTemperature(
    entityId: string,
    temperature: number,
    hvacMode?: string
  ): Promise<ServiceCallResponse[]> {
    const data: Record<string, unknown> = {
      entity_id: entityId,
      temperature,
    };
    if (hvacMode) data.hvac_mode = hvacMode;
    return this.callService('climate', 'set_temperature', data);
  }

  /**
   * Set climate HVAC mode.
   */
  async setClimateHvacMode(
    entityId: string,
    hvacMode: string
  ): Promise<ServiceCallResponse[]> {
    return this.callService('climate', 'set_hvac_mode', {
      entity_id: entityId,
      hvac_mode: hvacMode,
    });
  }

  /**
   * Control media player.
   */
  async mediaPlayerControl(
    entityId: string,
    action: 'play' | 'pause' | 'stop' | 'next' | 'previous' | 'volume_up' | 'volume_down'
  ): Promise<ServiceCallResponse[]> {
    const serviceMap: Record<string, string> = {
      play: 'media_play',
      pause: 'media_pause',
      stop: 'media_stop',
      next: 'media_next_track',
      previous: 'media_previous_track',
      volume_up: 'volume_up',
      volume_down: 'volume_down',
    };
    return this.callService('media_player', serviceMap[action], {
      entity_id: entityId,
    });
  }

  /**
   * Set media player volume.
   */
  async setMediaPlayerVolume(
    entityId: string,
    volumeLevel: number
  ): Promise<ServiceCallResponse[]> {
    return this.callService('media_player', 'volume_set', {
      entity_id: entityId,
      volume_level: volumeLevel,
    });
  }

  /**
   * Play media on a media player.
   */
  async playMedia(
    entityId: string,
    mediaContentId: string,
    mediaContentType: string
  ): Promise<ServiceCallResponse[]> {
    return this.callService('media_player', 'play_media', {
      entity_id: entityId,
      media_content_id: mediaContentId,
      media_content_type: mediaContentType,
    });
  }

  /**
   * Lock or unlock a lock entity.
   */
  async setLock(
    entityId: string,
    locked: boolean
  ): Promise<ServiceCallResponse[]> {
    const service = locked ? 'lock' : 'unlock';
    return this.callService('lock', service, { entity_id: entityId });
  }

  /**
   * Open or close a cover (garage door, blinds, etc.).
   */
  async setCover(
    entityId: string,
    action: 'open' | 'close' | 'stop'
  ): Promise<ServiceCallResponse[]> {
    const serviceMap: Record<string, string> = {
      open: 'open_cover',
      close: 'close_cover',
      stop: 'stop_cover',
    };
    return this.callService('cover', serviceMap[action], {
      entity_id: entityId,
    });
  }

  /**
   * Set cover position.
   */
  async setCoverPosition(
    entityId: string,
    position: number
  ): Promise<ServiceCallResponse[]> {
    return this.callService('cover', 'set_cover_position', {
      entity_id: entityId,
      position,
    });
  }

  /**
   * Reload configuration for a domain.
   */
  async reloadConfig(domain: string): Promise<ServiceCallResponse[]> {
    return this.callService(domain, 'reload', {});
  }

  /**
   * Get the current configuration.
   */
  async getConfig(): Promise<Record<string, unknown>> {
    return this.request('/config');
  }

  /**
   * Get error log.
   */
  async getErrorLog(): Promise<string> {
    return this.request('/error_log');
  }

  /**
   * Set a scene.
   */
  async activateScene(sceneEntityId: string): Promise<ServiceCallResponse[]> {
    return this.callService('scene', 'turn_on', { entity_id: sceneEntityId });
  }
}
