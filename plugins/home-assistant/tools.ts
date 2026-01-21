import { z } from 'zod';
import { logger } from '../../src/utils/logger.js';
import type { Tool } from '../../src/types/plugin.js';
import type { HomeAssistantClient } from './api-client.js';
import type { EntityState } from './types.js';

function wrapExecute<T>(
  toolName: string,
  fn: (params: T) => Promise<string>
): (params: unknown) => Promise<string> {
  return async (params: unknown): Promise<string> => {
    try {
      return await fn(params as T);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Tool ${toolName} failed:`, error);
      return `Error: ${errorMessage}`;
    }
  };
}

function formatState(state: EntityState): string {
  const attrs = state.attributes;
  const parts = [`${state.entity_id}: ${state.state}`];

  if (attrs.friendly_name && attrs.friendly_name !== state.entity_id) {
    parts[0] = `${attrs.friendly_name} (${state.entity_id}): ${state.state}`;
  }

  const relevantAttrs: string[] = [];
  if (attrs.brightness !== undefined) {
    relevantAttrs.push(`brightness: ${Math.round((attrs.brightness as number / 255) * 100)}%`);
  }
  if (attrs.color_temp !== undefined) {
    relevantAttrs.push(`color_temp: ${attrs.color_temp}`);
  }
  if (attrs.temperature !== undefined) {
    relevantAttrs.push(`temp: ${attrs.temperature}°`);
  }
  if (attrs.current_temperature !== undefined) {
    relevantAttrs.push(`current: ${attrs.current_temperature}°`);
  }
  if (attrs.unit_of_measurement !== undefined) {
    parts[0] = parts[0].replace(`: ${state.state}`, `: ${state.state}${attrs.unit_of_measurement}`);
  }
  if (attrs.battery_level !== undefined) {
    relevantAttrs.push(`battery: ${attrs.battery_level}%`);
  }
  if (attrs.volume_level !== undefined) {
    relevantAttrs.push(`volume: ${Math.round((attrs.volume_level as number) * 100)}%`);
  }

  if (relevantAttrs.length > 0) {
    parts.push(`(${relevantAttrs.join(', ')})`);
  }

  return parts.join(' ');
}

export function createTools(client: HomeAssistantClient): Tool[] {
  return [
    // Entity state tools
    {
      definition: {
        name: 'home_assistant_get_state',
        description:
          'Get the current state of a specific entity in Home Assistant. Returns the state value and relevant attributes.',
        parameters: z.object({
          entity_id: z
            .string()
            .describe('The entity ID (e.g., "light.living_room", "sensor.temperature")'),
        }),
      },
      execute: wrapExecute('home_assistant_get_state', async (params: { entity_id: string }) => {
        const state = await client.getState(params.entity_id);
        return formatState(state);
      }),
    },

    {
      definition: {
        name: 'home_assistant_list_entities',
        description:
          'List all entities in Home Assistant, optionally filtered by domain (e.g., "light", "switch", "sensor", "climate", "media_player").',
        parameters: z.object({
          domain: z
            .string()
            .optional()
            .describe('Filter by domain (e.g., "light", "switch", "sensor", "climate")'),
          search: z
            .string()
            .optional()
            .describe('Filter entities by name or ID containing this text'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_list_entities',
        async (params: { domain?: string; search?: string }) => {
          let states = params.domain
            ? await client.getStatesByDomain(params.domain)
            : await client.getStates();

          if (params.search) {
            const searchLower = params.search.toLowerCase();
            states = states.filter(
              (s) =>
                s.entity_id.toLowerCase().includes(searchLower) ||
                (s.attributes.friendly_name as string | undefined)
                  ?.toLowerCase()
                  .includes(searchLower)
            );
          }

          if (states.length === 0) {
            return 'No entities found matching the criteria.';
          }

          // Group by domain for better readability
          const grouped: Record<string, EntityState[]> = {};
          for (const state of states) {
            const domain = state.entity_id.split('.')[0];
            if (!grouped[domain]) grouped[domain] = [];
            grouped[domain].push(state);
          }

          const lines: string[] = [];
          for (const [domain, domainStates] of Object.entries(grouped)) {
            lines.push(`\n## ${domain} (${domainStates.length})`);
            for (const state of domainStates) {
              lines.push(`- ${formatState(state)}`);
            }
          }

          return `Found ${states.length} entities:${lines.join('\n')}`;
        }
      ),
    },

    // Control tools
    {
      definition: {
        name: 'home_assistant_turn_on',
        description:
          'Turn on an entity in Home Assistant (light, switch, fan, etc.). Supports additional attributes like brightness for lights.',
        parameters: z.object({
          entity_id: z.string().describe('The entity ID to turn on'),
          brightness_pct: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe('Brightness percentage (0-100) for lights'),
          color_temp: z
            .number()
            .optional()
            .describe('Color temperature in mireds for lights'),
          rgb_color: z
            .array(z.number())
            .length(3)
            .optional()
            .describe('RGB color as [r, g, b] array for lights'),
          transition: z
            .number()
            .optional()
            .describe('Transition time in seconds'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_turn_on',
        async (params: {
          entity_id: string;
          brightness_pct?: number;
          color_temp?: number;
          rgb_color?: number[];
          transition?: number;
        }) => {
          const attributes: Record<string, unknown> = {};
          if (params.brightness_pct !== undefined) {
            attributes.brightness_pct = params.brightness_pct;
          }
          if (params.color_temp !== undefined) {
            attributes.color_temp = params.color_temp;
          }
          if (params.rgb_color !== undefined) {
            attributes.rgb_color = params.rgb_color;
          }
          if (params.transition !== undefined) {
            attributes.transition = params.transition;
          }

          await client.turnOn(params.entity_id, attributes);
          const state = await client.getState(params.entity_id);
          return `Turned on ${formatState(state)}`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_turn_off',
        description: 'Turn off an entity in Home Assistant (light, switch, fan, etc.).',
        parameters: z.object({
          entity_id: z.string().describe('The entity ID to turn off'),
        }),
      },
      execute: wrapExecute('home_assistant_turn_off', async (params: { entity_id: string }) => {
        await client.turnOff(params.entity_id);
        return `Turned off ${params.entity_id}`;
      }),
    },

    {
      definition: {
        name: 'home_assistant_toggle',
        description: 'Toggle an entity in Home Assistant (if on, turn off; if off, turn on).',
        parameters: z.object({
          entity_id: z.string().describe('The entity ID to toggle'),
        }),
      },
      execute: wrapExecute('home_assistant_toggle', async (params: { entity_id: string }) => {
        await client.toggle(params.entity_id);
        const state = await client.getState(params.entity_id);
        return `Toggled ${formatState(state)}`;
      }),
    },

    // Generic service call
    {
      definition: {
        name: 'home_assistant_call_service',
        description:
          'Call any Home Assistant service. Use this for advanced operations not covered by other tools.',
        parameters: z.object({
          domain: z.string().describe('The service domain (e.g., "light", "switch", "automation")'),
          service: z.string().describe('The service name (e.g., "turn_on", "toggle", "reload")'),
          data: z
            .record(z.unknown())
            .optional()
            .describe('Service data as key-value pairs (e.g., { "entity_id": "light.living_room" })'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_call_service',
        async (params: { domain: string; service: string; data?: Record<string, unknown> }) => {
          await client.callService(params.domain, params.service, params.data);
          return `Called service ${params.domain}.${params.service}`;
        }
      ),
    },

    // Climate tools
    {
      definition: {
        name: 'home_assistant_set_temperature',
        description: 'Set the target temperature for a climate entity (thermostat, AC, etc.).',
        parameters: z.object({
          entity_id: z.string().describe('The climate entity ID'),
          temperature: z.number().describe('Target temperature'),
          hvac_mode: z
            .enum(['heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only', 'off'])
            .optional()
            .describe('HVAC mode to set'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_temperature',
        async (params: { entity_id: string; temperature: number; hvac_mode?: string }) => {
          await client.setClimateTemperature(params.entity_id, params.temperature, params.hvac_mode);
          const state = await client.getState(params.entity_id);
          return `Set temperature: ${formatState(state)}`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_set_hvac_mode',
        description: 'Set the HVAC mode for a climate entity.',
        parameters: z.object({
          entity_id: z.string().describe('The climate entity ID'),
          hvac_mode: z
            .enum(['heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only', 'off'])
            .describe('HVAC mode'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_hvac_mode',
        async (params: { entity_id: string; hvac_mode: string }) => {
          await client.setClimateHvacMode(params.entity_id, params.hvac_mode);
          return `Set HVAC mode to ${params.hvac_mode} for ${params.entity_id}`;
        }
      ),
    },

    // Media player tools
    {
      definition: {
        name: 'home_assistant_media_control',
        description: 'Control a media player (play, pause, stop, next, previous, volume).',
        parameters: z.object({
          entity_id: z.string().describe('The media player entity ID'),
          action: z
            .enum(['play', 'pause', 'stop', 'next', 'previous', 'volume_up', 'volume_down'])
            .describe('The action to perform'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_media_control',
        async (params: { entity_id: string; action: 'play' | 'pause' | 'stop' | 'next' | 'previous' | 'volume_up' | 'volume_down' }) => {
          await client.mediaPlayerControl(params.entity_id, params.action);
          return `Performed ${params.action} on ${params.entity_id}`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_set_volume',
        description: 'Set the volume level of a media player.',
        parameters: z.object({
          entity_id: z.string().describe('The media player entity ID'),
          volume_level: z
            .number()
            .min(0)
            .max(1)
            .describe('Volume level from 0.0 to 1.0'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_volume',
        async (params: { entity_id: string; volume_level: number }) => {
          await client.setMediaPlayerVolume(params.entity_id, params.volume_level);
          return `Set volume to ${Math.round(params.volume_level * 100)}% for ${params.entity_id}`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_play_media',
        description: 'Play media on a media player.',
        parameters: z.object({
          entity_id: z.string().describe('The media player entity ID'),
          media_content_id: z.string().describe('The media content ID or URL'),
          media_content_type: z
            .string()
            .describe('The media content type (e.g., "music", "video", "playlist")'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_play_media',
        async (params: { entity_id: string; media_content_id: string; media_content_type: string }) => {
          await client.playMedia(params.entity_id, params.media_content_id, params.media_content_type);
          return `Playing ${params.media_content_type} on ${params.entity_id}`;
        }
      ),
    },

    // Automation tools
    {
      definition: {
        name: 'home_assistant_trigger_automation',
        description: 'Manually trigger an automation.',
        parameters: z.object({
          entity_id: z.string().describe('The automation entity ID (e.g., "automation.morning_routine")'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_trigger_automation',
        async (params: { entity_id: string }) => {
          await client.triggerAutomation(params.entity_id);
          return `Triggered automation ${params.entity_id}`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_set_automation',
        description: 'Enable or disable an automation.',
        parameters: z.object({
          entity_id: z.string().describe('The automation entity ID'),
          enabled: z.boolean().describe('True to enable, false to disable'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_automation',
        async (params: { entity_id: string; enabled: boolean }) => {
          await client.setAutomationState(params.entity_id, params.enabled);
          return `${params.enabled ? 'Enabled' : 'Disabled'} automation ${params.entity_id}`;
        }
      ),
    },

    // Script tools
    {
      definition: {
        name: 'home_assistant_run_script',
        description: 'Execute a Home Assistant script with optional variables.',
        parameters: z.object({
          entity_id: z.string().describe('The script entity ID (e.g., "script.welcome_home")'),
          variables: z
            .record(z.unknown())
            .optional()
            .describe('Variables to pass to the script'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_run_script',
        async (params: { entity_id: string; variables?: Record<string, unknown> }) => {
          await client.executeScript(params.entity_id, params.variables);
          return `Executed script ${params.entity_id}`;
        }
      ),
    },

    // Scene tools
    {
      definition: {
        name: 'home_assistant_activate_scene',
        description: 'Activate a scene in Home Assistant.',
        parameters: z.object({
          entity_id: z.string().describe('The scene entity ID (e.g., "scene.movie_night")'),
        }),
      },
      execute: wrapExecute('home_assistant_activate_scene', async (params: { entity_id: string }) => {
        await client.activateScene(params.entity_id);
        return `Activated scene ${params.entity_id}`;
      }),
    },

    // Input helpers
    {
      definition: {
        name: 'home_assistant_set_input_boolean',
        description: 'Set the state of an input_boolean helper.',
        parameters: z.object({
          entity_id: z.string().describe('The input_boolean entity ID'),
          value: z.boolean().describe('True for on, false for off'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_input_boolean',
        async (params: { entity_id: string; value: boolean }) => {
          await client.setInputBoolean(params.entity_id, params.value);
          return `Set ${params.entity_id} to ${params.value ? 'on' : 'off'}`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_set_input_number',
        description: 'Set the value of an input_number helper.',
        parameters: z.object({
          entity_id: z.string().describe('The input_number entity ID'),
          value: z.number().describe('The numeric value to set'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_input_number',
        async (params: { entity_id: string; value: number }) => {
          await client.setInputNumber(params.entity_id, params.value);
          return `Set ${params.entity_id} to ${params.value}`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_set_input_text',
        description: 'Set the value of an input_text helper.',
        parameters: z.object({
          entity_id: z.string().describe('The input_text entity ID'),
          value: z.string().describe('The text value to set'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_input_text',
        async (params: { entity_id: string; value: string }) => {
          await client.setInputText(params.entity_id, params.value);
          return `Set ${params.entity_id} to "${params.value}"`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_set_input_select',
        description: 'Set the selected option of an input_select helper.',
        parameters: z.object({
          entity_id: z.string().describe('The input_select entity ID'),
          option: z.string().describe('The option to select'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_input_select',
        async (params: { entity_id: string; option: string }) => {
          await client.setInputSelect(params.entity_id, params.option);
          return `Set ${params.entity_id} to "${params.option}"`;
        }
      ),
    },

    // Lock tools
    {
      definition: {
        name: 'home_assistant_set_lock',
        description: 'Lock or unlock a lock entity.',
        parameters: z.object({
          entity_id: z.string().describe('The lock entity ID'),
          locked: z.boolean().describe('True to lock, false to unlock'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_lock',
        async (params: { entity_id: string; locked: boolean }) => {
          await client.setLock(params.entity_id, params.locked);
          return `${params.locked ? 'Locked' : 'Unlocked'} ${params.entity_id}`;
        }
      ),
    },

    // Cover tools
    {
      definition: {
        name: 'home_assistant_control_cover',
        description: 'Control a cover entity (garage door, blinds, curtains, etc.).',
        parameters: z.object({
          entity_id: z.string().describe('The cover entity ID'),
          action: z.enum(['open', 'close', 'stop']).describe('The action to perform'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_control_cover',
        async (params: { entity_id: string; action: 'open' | 'close' | 'stop' }) => {
          await client.setCover(params.entity_id, params.action);
          return `${params.action === 'open' ? 'Opened' : params.action === 'close' ? 'Closed' : 'Stopped'} ${params.entity_id}`;
        }
      ),
    },

    {
      definition: {
        name: 'home_assistant_set_cover_position',
        description: 'Set the position of a cover (0 = closed, 100 = fully open).',
        parameters: z.object({
          entity_id: z.string().describe('The cover entity ID'),
          position: z.number().min(0).max(100).describe('Position from 0 (closed) to 100 (open)'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_set_cover_position',
        async (params: { entity_id: string; position: number }) => {
          await client.setCoverPosition(params.entity_id, params.position);
          return `Set ${params.entity_id} position to ${params.position}%`;
        }
      ),
    },

    // Notification tools
    {
      definition: {
        name: 'home_assistant_notify',
        description: 'Send a notification through Home Assistant.',
        parameters: z.object({
          message: z.string().describe('The notification message'),
          title: z.string().optional().describe('The notification title'),
          target: z
            .string()
            .optional()
            .describe('The notification service target (e.g., "mobile_app_phone")'),
          data: z
            .record(z.unknown())
            .optional()
            .describe('Additional notification data (e.g., for images, actions)'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_notify',
        async (params: { message: string; title?: string; target?: string; data?: Record<string, unknown> }) => {
          await client.notify(params.message, params.title, params.target, params.data);
          return `Notification sent: "${params.message}"`;
        }
      ),
    },

    // Event tools
    {
      definition: {
        name: 'home_assistant_fire_event',
        description:
          'Fire a custom event on the Home Assistant event bus. Useful for triggering automations.',
        parameters: z.object({
          event_type: z.string().describe('The event type to fire'),
          event_data: z.record(z.unknown()).optional().describe('Event data as key-value pairs'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_fire_event',
        async (params: { event_type: string; event_data?: Record<string, unknown> }) => {
          await client.fireEvent(params.event_type, params.event_data);
          return `Fired event ${params.event_type}`;
        }
      ),
    },

    // History tools
    {
      definition: {
        name: 'home_assistant_get_history',
        description: 'Get the state history of entities for a time period.',
        parameters: z.object({
          entity_ids: z
            .array(z.string())
            .optional()
            .describe('Entity IDs to get history for (leave empty for all)'),
          hours_ago: z
            .number()
            .default(24)
            .describe('How many hours of history to retrieve (default: 24)'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_get_history',
        async (params: { entity_ids?: string[]; hours_ago?: number }) => {
          const hoursAgo = params.hours_ago ?? 24;
          const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
          const history = await client.getHistory(startTime, new Date(), params.entity_ids, true);

          if (!history || history.length === 0) {
            return 'No history found for the specified criteria.';
          }

          const lines: string[] = [];
          for (const entityHistory of history) {
            if (entityHistory.length === 0) continue;
            const entityId = entityHistory[0].entity_id;
            lines.push(`\n## ${entityId}`);
            for (const entry of entityHistory.slice(-10)) {
              const time = new Date(entry.last_changed).toLocaleString();
              lines.push(`- ${time}: ${entry.state}`);
            }
          }

          return `History for the last ${hoursAgo} hours:${lines.join('\n')}`;
        }
      ),
    },

    // Service discovery
    {
      definition: {
        name: 'home_assistant_list_services',
        description: 'List available services in Home Assistant, optionally filtered by domain.',
        parameters: z.object({
          domain: z.string().optional().describe('Filter by domain (e.g., "light", "climate")'),
        }),
      },
      execute: wrapExecute(
        'home_assistant_list_services',
        async (params: { domain?: string }) => {
          const services = await client.getServices();
          const filtered = params.domain
            ? services.filter((s) => s.domain === params.domain)
            : services;

          if (filtered.length === 0) {
            return 'No services found.';
          }

          const lines: string[] = [];
          for (const domainServices of filtered) {
            lines.push(`\n## ${domainServices.domain}`);
            for (const [name, def] of Object.entries(domainServices.services)) {
              const description = def.description ? `: ${def.description}` : '';
              lines.push(`- ${name}${description}`);
            }
          }

          return `Available services:${lines.join('\n')}`;
        }
      ),
    },

    // Configuration reload
    {
      definition: {
        name: 'home_assistant_reload',
        description: 'Reload configuration for a specific domain (e.g., after editing YAML files).',
        parameters: z.object({
          domain: z
            .enum([
              'automation',
              'script',
              'scene',
              'group',
              'input_boolean',
              'input_number',
              'input_text',
              'input_select',
              'input_datetime',
              'template',
              'homeassistant',
            ])
            .describe('The domain to reload'),
        }),
      },
      execute: wrapExecute('home_assistant_reload', async (params: { domain: string }) => {
        await client.reloadConfig(params.domain);
        return `Reloaded ${params.domain} configuration`;
      }),
    },
  ];
}
