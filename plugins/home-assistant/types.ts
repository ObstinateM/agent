/**
 * Home Assistant API type definitions
 */

export interface HomeAssistantConfig {
  baseUrl: string;
  token: string;
}

export interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface ServiceDomain {
  domain: string;
  services: Record<string, ServiceDefinition>;
}

export interface ServiceDefinition {
  name?: string;
  description?: string;
  fields?: Record<string, ServiceField>;
  target?: {
    entity?: EntitySelector[];
    device?: DeviceSelector[];
    area?: AreaSelector[];
  };
}

export interface ServiceField {
  name?: string;
  description?: string;
  required?: boolean;
  example?: unknown;
  selector?: Record<string, unknown>;
}

export interface EntitySelector {
  domain?: string | string[];
  integration?: string;
  device_class?: string;
}

export interface DeviceSelector {
  integration?: string;
  manufacturer?: string;
  model?: string;
}

export interface AreaSelector {
  // Empty for now, can be extended
}

export interface HistoryEntry {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface Event {
  event_type: string;
  data: Record<string, unknown>;
  origin: string;
  time_fired: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface Automation {
  id: string;
  alias?: string;
  description?: string;
  trigger: unknown[];
  condition?: unknown[];
  action: unknown[];
  mode?: 'single' | 'restart' | 'queued' | 'parallel';
}

export interface Script {
  alias?: string;
  description?: string;
  sequence: unknown[];
  mode?: 'single' | 'restart' | 'queued' | 'parallel';
  fields?: Record<string, ServiceField>;
}

export interface Area {
  area_id: string;
  name: string;
  picture?: string;
}

export interface Device {
  id: string;
  name: string;
  name_by_user?: string;
  manufacturer?: string;
  model?: string;
  area_id?: string;
  disabled_by?: string;
  entry_type?: string;
}

export interface ConfigEntry {
  entry_id: string;
  domain: string;
  title: string;
  source: string;
  state: string;
  supports_options: boolean;
  supports_remove_device: boolean;
  supports_unload: boolean;
}

export interface ServiceCallResponse {
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface WebhookData {
  webhook_id: string;
  data: Record<string, unknown>;
}
