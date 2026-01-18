import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { Plugin, Tool, Workflow } from '../../src/types/plugin.js';

const execAsync = promisify(exec);

/**
 * Script Runner Plugin - Execute shell scripts and commands
 */
class ScriptRunnerPlugin implements Plugin {
  metadata = {
    name: 'script-runner',
    version: '1.0.0',
    description: 'Execute shell scripts and commands',
    author: 'AI Agent System',
  };

  async initialize(): Promise<void> {
    console.log('Script Runner plugin initialized');
  }

  getTools(): Tool[] {
    return [
      {
        definition: {
          name: 'run_shell_command',
          description: 'Execute a shell command',
          parameters: z.object({
            command: z.string().describe('Shell command to execute'),
            cwd: z
              .string()
              .optional()
              .describe('Working directory for the command'),
          }),
        },
        execute: async (params) => {
          const { command, cwd } = params;
          const options = cwd ? { cwd } : {};
          const { stdout, stderr } = await execAsync(command, options);
          return { stdout: stdout.trim(), stderr: stderr.trim() };
        },
      },
      {
        definition: {
          name: 'run_bash_script',
          description: 'Execute a bash script from a string',
          parameters: z.object({
            script: z.string().describe('Bash script content'),
            cwd: z
              .string()
              .optional()
              .describe('Working directory for the script'),
          }),
        },
        execute: async (params) => {
          const { script, cwd } = params;
          const options = cwd ? { cwd } : {};
          const { stdout, stderr } = await execAsync(script, {
            ...options,
            shell: '/bin/bash',
          });
          return { stdout: stdout.trim(), stderr: stderr.trim() };
        },
      },
      {
        definition: {
          name: 'check_process',
          description: 'Check if a process is running',
          parameters: z.object({
            processName: z.string().describe('Process name to search for'),
          }),
        },
        execute: async (params) => {
          const { processName } = params;
          try {
            const { stdout } = await execAsync(`pgrep -f "${processName}"`);
            const pids = stdout.trim().split('\n').filter(Boolean);
            return {
              running: pids.length > 0,
              pids,
              count: pids.length,
            };
          } catch (error) {
            return { running: false, pids: [], count: 0 };
          }
        },
      },
      {
        definition: {
          name: 'get_system_info',
          description: 'Get system information (OS, uptime, memory, etc.)',
          parameters: z.object({}),
        },
        execute: async () => {
          const { stdout: uptime } = await execAsync('uptime');
          const { stdout: memory } = await execAsync(
            'free -h 2>/dev/null || vm_stat'
          );
          const { stdout: disk } = await execAsync('df -h /');

          return {
            uptime: uptime.trim(),
            memory: memory.trim(),
            disk: disk.trim(),
            platform: process.platform,
            arch: process.arch,
          };
        },
      },
    ];
  }

  getWorkflows(): Workflow[] {
    return [
      {
        name: 'system_health_check',
        description: 'Perform a comprehensive system health check',
        steps: [
          {
            toolName: 'get_system_info',
            params: {},
            description: 'Get system information',
          },
          {
            toolName: 'run_shell_command',
            params: { command: 'docker ps 2>/dev/null || echo "Docker not running"' },
            description: 'Check Docker status',
          },
        ],
      },
    ];
  }

  async cleanup(): Promise<void> {
    console.log('Script Runner plugin cleaned up');
  }
}

export default new ScriptRunnerPlugin();
