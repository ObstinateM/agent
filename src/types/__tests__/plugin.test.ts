import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toolToOpenAIFunction, Tool } from '../plugin.js';

describe('toolToOpenAIFunction', () => {
  it('should convert a simple tool to OpenAI function format', () => {
    const tool: Tool = {
      definition: {
        name: 'test_tool',
        description: 'A test tool',
        parameters: z.object({
          name: z.string().describe('User name'),
          age: z.number().describe('User age'),
        }),
      },
      execute: async () => 'result',
    };

    const openAIFunction = toolToOpenAIFunction(tool);

    expect(openAIFunction.name).toBe('test_tool');
    expect(openAIFunction.description).toBe('A test tool');
    expect(openAIFunction.parameters.type).toBe('object');
    expect(openAIFunction.parameters.properties.name).toEqual({
      type: 'string',
      description: 'User name',
    });
    expect(openAIFunction.parameters.properties.age).toEqual({
      type: 'number',
      description: 'User age',
    });
    expect(openAIFunction.parameters.required).toEqual(['name', 'age']);
  });

  it('should handle optional parameters', () => {
    const tool: Tool = {
      definition: {
        name: 'test_tool',
        description: 'A test tool',
        parameters: z.object({
          required: z.string(),
          optional: z.string().optional(),
        }),
      },
      execute: async () => 'result',
    };

    const openAIFunction = toolToOpenAIFunction(tool);

    expect(openAIFunction.parameters.required).toEqual(['required']);
  });
});
