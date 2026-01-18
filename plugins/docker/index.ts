import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';

const execAsync = promisify(exec);

/**
 * Docker Plugin - Provides Docker container management tools
 */
class DockerPlugin implements Plugin {
  metadata = {
    name: 'docker',
    version: '1.0.0',
    description: 'Docker container management plugin',
    author: 'AI Agent System',
  };

  async initialize(): Promise<void> {
    console.log('Docker plugin initialized');
    // Check if Docker is available
    try {
      await execAsync('docker --version');
    } catch (error) {
      console.warn('Docker is not available on this system');
    }
  }

  getTools(): Tool[] {
    return [
      {
        definition: {
          name: 'docker_list_containers',
          description: 'List all Docker containers (running and stopped)',
          parameters: z.object({
            all: z
              .boolean()
              .optional()
              .describe('Show all containers (default shows just running)'),
          }),
        },
        execute: async (params) => {
          const { all = true } = params;
          const command = `docker ps ${all ? '-a' : ''} --format "{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}"`;
          const { stdout } = await execAsync(command);
          return stdout.trim();
        },
      },
      {
        definition: {
          name: 'docker_start_container',
          description: 'Start a Docker container by name or ID',
          parameters: z.object({
            container: z.string().describe('Container name or ID'),
          }),
        },
        execute: async (params) => {
          const { container } = params;
          const { stdout } = await execAsync(`docker start ${container}`);
          return `Container ${container} started: ${stdout.trim()}`;
        },
      },
      {
        definition: {
          name: 'docker_stop_container',
          description: 'Stop a Docker container by name or ID',
          parameters: z.object({
            container: z.string().describe('Container name or ID'),
          }),
        },
        execute: async (params) => {
          const { container } = params;
          const { stdout } = await execAsync(`docker stop ${container}`);
          return `Container ${container} stopped: ${stdout.trim()}`;
        },
      },
      {
        definition: {
          name: 'docker_container_logs',
          description: 'Get logs from a Docker container',
          parameters: z.object({
            container: z.string().describe('Container name or ID'),
            lines: z
              .number()
              .optional()
              .describe('Number of lines to return (default: 100)'),
          }),
        },
        execute: async (params) => {
          const { container, lines = 100 } = params;
          const { stdout } = await execAsync(
            `docker logs --tail ${lines} ${container}`
          );
          return stdout;
        },
      },
      {
        definition: {
          name: 'docker_exec_command',
          description: 'Execute a command inside a running Docker container',
          parameters: z.object({
            container: z.string().describe('Container name or ID'),
            command: z.string().describe('Command to execute'),
          }),
        },
        execute: async (params) => {
          const { container, command } = params;
          const { stdout } = await execAsync(`docker exec ${container} ${command}`);
          return stdout;
        },
      },
    ];
  }

  getWorkflows(): Workflow[] {
    return [
      {
        name: 'restart_container',
        description: 'Stop and start a Docker container',
        steps: [
          {
            toolName: 'docker_stop_container',
            params: { container: '${container}' },
            description: 'Stop the container',
          },
          {
            toolName: 'docker_start_container',
            params: { container: '${container}' },
            description: 'Start the container',
          },
        ],
      },
      {
        name: 'check_container_health',
        description: 'Check container status and recent logs',
        steps: [
          {
            toolName: 'docker_list_containers',
            params: { all: true },
            description: 'List all containers',
          },
          {
            toolName: 'docker_container_logs',
            params: { container: '${container}', lines: 50 },
            description: 'Get recent logs',
          },
        ],
      },
    ];
  }

  async cleanup(): Promise<void> {
    console.log('Docker plugin cleaned up');
  }
}

export default new DockerPlugin();
