import type { Workflow } from '../../src/types/plugin.js';

/**
 * Create Home Assistant workflows.
 * These are predefined sequences of tool calls that can be triggered by the agent.
 * Variables use ${variableName} syntax and can reference workflow inputs or previous step results.
 */
export function createWorkflows(): Workflow[] {
  return [
    {
      name: 'home_assistant_all_lights_off',
      description: 'Turn off all lights in the house',
      steps: [
        {
          toolName: 'home_assistant_call_service',
          params: {
            domain: 'light',
            service: 'turn_off',
            data: { entity_id: 'all' },
          },
          description: 'Turn off all lights',
        },
      ],
    },

    {
      name: 'home_assistant_movie_mode',
      description: 'Set up the living room for movie watching - dims lights and pauses music',
      steps: [
        {
          toolName: 'home_assistant_call_service',
          params: {
            domain: 'light',
            service: 'turn_on',
            data: {
              entity_id: 'light.living_room',
              brightness_pct: 20,
            },
          },
          description: 'Dim living room lights to 20%',
        },
      ],
    },

    {
      name: 'home_assistant_goodnight',
      description: 'Goodnight routine - turns off all lights and locks doors',
      steps: [
        {
          toolName: 'home_assistant_call_service',
          params: {
            domain: 'light',
            service: 'turn_off',
            data: { entity_id: 'all' },
          },
          description: 'Turn off all lights',
        },
        {
          toolName: 'home_assistant_call_service',
          params: {
            domain: 'lock',
            service: 'lock',
            data: { entity_id: 'all' },
          },
          description: 'Lock all doors',
        },
      ],
    },

    {
      name: 'home_assistant_away_mode',
      description: 'Set house to away mode - lock doors, turn off lights, adjust climate',
      steps: [
        {
          toolName: 'home_assistant_call_service',
          params: {
            domain: 'light',
            service: 'turn_off',
            data: { entity_id: 'all' },
          },
          description: 'Turn off all lights',
        },
        {
          toolName: 'home_assistant_call_service',
          params: {
            domain: 'lock',
            service: 'lock',
            data: { entity_id: 'all' },
          },
          description: 'Lock all doors',
        },
        {
          toolName: 'home_assistant_call_service',
          params: {
            domain: 'climate',
            service: 'set_preset_mode',
            data: { entity_id: 'all', preset_mode: 'away' },
          },
          description: 'Set climate to away mode',
        },
      ],
    },

    {
      name: 'home_assistant_home_status',
      description: 'Get a summary of the home status including lights, climate, and security',
      steps: [
        {
          toolName: 'home_assistant_list_entities',
          params: { domain: 'light' },
          description: 'Get status of all lights',
        },
        {
          toolName: 'home_assistant_list_entities',
          params: { domain: 'climate' },
          description: 'Get status of climate devices',
        },
        {
          toolName: 'home_assistant_list_entities',
          params: { domain: 'lock' },
          description: 'Get status of locks',
        },
        {
          toolName: 'home_assistant_list_entities',
          params: { domain: 'binary_sensor' },
          description: 'Get status of binary sensors (doors, windows, motion)',
        },
      ],
    },
  ];
}
