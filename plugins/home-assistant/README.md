# Home Assistant Plugin

Integrates Home Assistant with the AI agent, enabling control of smart home devices, automations, scripts, and more through natural language.

## Configuration

Set the following environment variables:

```bash
# Required
HOME_ASSISTANT_URL=http://homeassistant.local:8123
HOME_ASSISTANT_TOKEN=your_long_lived_access_token
```

### Getting a Long-Lived Access Token

1. Open Home Assistant
2. Click your profile (bottom left)
3. Scroll to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Copy the token (it won't be shown again)

## Available Tools

### Entity Control

| Tool | Description |
|------|-------------|
| `home_assistant_get_state` | Get the current state of an entity |
| `home_assistant_list_entities` | List entities, optionally filtered by domain or search term |
| `home_assistant_turn_on` | Turn on a device (supports brightness, color for lights) |
| `home_assistant_turn_off` | Turn off a device |
| `home_assistant_toggle` | Toggle a device on/off |

### Climate Control

| Tool | Description |
|------|-------------|
| `home_assistant_set_temperature` | Set target temperature |
| `home_assistant_set_hvac_mode` | Set HVAC mode (heat, cool, auto, off, etc.) |

### Media Player

| Tool | Description |
|------|-------------|
| `home_assistant_media_control` | Play, pause, stop, next, previous, volume up/down |
| `home_assistant_set_volume` | Set volume level (0.0 to 1.0) |
| `home_assistant_play_media` | Play specific media content |

### Automations & Scripts

| Tool | Description |
|------|-------------|
| `home_assistant_trigger_automation` | Manually trigger an automation |
| `home_assistant_set_automation` | Enable or disable an automation |
| `home_assistant_run_script` | Execute a script with optional variables |
| `home_assistant_activate_scene` | Activate a scene |

### Input Helpers

| Tool | Description |
|------|-------------|
| `home_assistant_set_input_boolean` | Set input_boolean on/off |
| `home_assistant_set_input_number` | Set input_number value |
| `home_assistant_set_input_text` | Set input_text value |
| `home_assistant_set_input_select` | Set input_select option |

### Security & Covers

| Tool | Description |
|------|-------------|
| `home_assistant_set_lock` | Lock or unlock a lock entity |
| `home_assistant_control_cover` | Open, close, or stop a cover |
| `home_assistant_set_cover_position` | Set cover position (0-100) |

### Notifications & Events

| Tool | Description |
|------|-------------|
| `home_assistant_notify` | Send a notification |
| `home_assistant_fire_event` | Fire a custom event |

### Advanced

| Tool | Description |
|------|-------------|
| `home_assistant_call_service` | Call any Home Assistant service |
| `home_assistant_get_history` | Get state history for entities |
| `home_assistant_list_services` | List available services |
| `home_assistant_reload` | Reload configuration for a domain |

## Workflows

Pre-defined workflows for common scenarios:

| Workflow | Description |
|----------|-------------|
| `home_assistant_all_lights_off` | Turn off all lights |
| `home_assistant_movie_mode` | Dim lights for movie watching |
| `home_assistant_goodnight` | Turn off lights and lock doors |
| `home_assistant_away_mode` | Set house to away mode |
| `home_assistant_home_status` | Get summary of home status |

## Using in Home Assistant Automations

You can trigger the agent from Home Assistant automations by firing events:

```yaml
automation:
  - alias: "AI Agent - Morning Briefing"
    trigger:
      - platform: time
        at: "07:00:00"
    action:
      - service: rest_command.ai_agent
        data:
          message: "Give me a morning briefing with weather and today's calendar"
```

To receive messages from the agent, use the `home_assistant_notify` tool or `home_assistant_fire_event` tool to send data back to Home Assistant.

## Example Usage

### Natural Language Commands

- "Turn on the living room lights at 50% brightness"
- "What's the temperature in the bedroom?"
- "Lock all doors"
- "Set the thermostat to 72 degrees"
- "Play music in the kitchen"
- "Run the goodnight routine"
- "Show me all the lights that are on"
- "Trigger the morning automation"

### Programmatic Integration

The agent can respond to Home Assistant events and take actions based on sensor data, making it useful for complex automations that benefit from AI reasoning.

## Supported Domains

- `light` - Lights and dimmable devices
- `switch` - Switches and smart plugs
- `climate` - Thermostats and HVAC
- `media_player` - Speakers, TVs, media devices
- `lock` - Smart locks
- `cover` - Garage doors, blinds, curtains
- `sensor` - All sensor types
- `binary_sensor` - Motion, door/window sensors
- `automation` - Automations
- `script` - Scripts
- `scene` - Scenes
- `input_boolean`, `input_number`, `input_text`, `input_select` - Input helpers
- And any other domain via `home_assistant_call_service`
