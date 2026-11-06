import { McpServer } from '@modelcontextprotocol/server';
import fc from 'fast-check';
import * as z from 'zod/v4';
import { describe, expect, it } from 'vitest';
import { SkeletonMcpError } from './errors.js';
import { registerTool } from './register-tool.js';
import { textResult } from './results.js';
import { connectClient, textOf } from './test-helpers.js';

const newServer = () => new McpServer({ name: 'test', version: '0.0.0' });
const noop = async () => textResult('ok');

const validName = fc.stringMatching(/^[a-z][a-z0-9_]{0,30}$/).filter((name) => name !== 'constructor');

describe('registerTool: names', () => {
  it.each(['', 'Sort Photos', 'sortPhotos', '1tool', '_tool', 'valueOf', 'toString', '__proto__', 'constructor', 'a-b'])(
    'rejects the invalid name %j with SkeletonMcpError',
    (name) => {
      const definition = { name, description: 'd', inputSchema: z.object({}), handler: noop };
      expect(() => registerTool(newServer(), definition)).toThrow(SkeletonMcpError);
    },
  );

  it('accepts snake_case names', () => {
    fc.assert(
      fc.property(validName, (name) => {
        const definition = { name, description: 'd', inputSchema: z.object({}), handler: noop };
        expect(() => registerTool(newServer(), definition)).not.toThrow();
      }),
    );
  });
});

describe('registerTool: duplicate names (Requirement 3.6)', () => {
  it('registering any name twice on one server is always rejected (Requirement 10.3)', () => {
    fc.assert(
      fc.property(validName, (name) => {
        const server = newServer();
        const definition = { name, description: 'd', inputSchema: z.object({}), handler: noop };
        registerTool(server, definition);
        expect(() => registerTool(server, definition)).toThrow(SkeletonMcpError);
      }),
    );
  });

  it('allows the same name on different servers', () => {
    const definition = { name: 'same_name', description: 'd', inputSchema: z.object({}), handler: noop };
    expect(() => {
      registerTool(newServer(), definition);
      registerTool(newServer(), definition);
    }).not.toThrow();
  });

  it('names the duplicate in the error message', () => {
    const server = newServer();
    const definition = { name: 'my_tool', description: 'd', inputSchema: z.object({}), handler: noop };
    registerTool(server, definition);
    expect(() => registerTool(server, definition)).toThrow(/my_tool/);
  });
});

describe('registerTool: validation and errors', () => {
  const schema = z.object({ name: z.string().min(1), count: z.number().int().min(0) });

  it('input that fails the schema returns an error and never calls the handler (Requirement 10.4)', async () => {
    const server = newServer();
    let calls = 0;
    registerTool(server, {
      name: 'strict_tool',
      description: 'd',
      inputSchema: schema,
      handler: async () => {
        calls += 1;
        return textResult('ran');
      },
    });
    const client = await connectClient(server);

    const invalidInput = fc
      .record({ name: fc.jsonValue(), count: fc.jsonValue() }, { requiredKeys: [] })
      .filter((value) => !schema.safeParse(value).success);

    await fc.assert(
      fc.asyncProperty(invalidInput, async (args) => {
        const result = await client.callTool({ name: 'strict_tool', arguments: args as Record<string, unknown> });
        expect(result.isError).toBe(true);
      }),
      { numRuns: 100 },
    );
    expect(calls).toBe(0);
  });

  it('describes the invalid field in the error (Requirement 3.4)', async () => {
    const server = newServer();
    registerTool(server, { name: 'strict_tool', description: 'd', inputSchema: schema, handler: noop });
    const client = await connectClient(server);
    const result = await client.callTool({ name: 'strict_tool', arguments: { count: -1 } });
    expect(result.isError).toBe(true);
    expect(textOf(result as { content: unknown[] })).toMatch(/name|count/);
  });

  it('calls the handler with valid input and returns its result', async () => {
    const server = newServer();
    registerTool(server, {
      name: 'strict_tool',
      description: 'd',
      inputSchema: schema,
      handler: async (input) => textResult(`${input.name}:${input.count}`),
    });
    const client = await connectClient(server);
    const result = await client.callTool({ name: 'strict_tool', arguments: { name: 'a', count: 2 } });
    expect(result.isError).toBeFalsy();
    expect(textOf(result as { content: unknown[] })).toBe('a:2');
  });

  it('turns a thrown error into an error result and keeps serving (Requirement 3.5)', async () => {
    const server = newServer();
    registerTool(server, {
      name: 'explodes',
      description: 'd',
      inputSchema: z.object({}),
      handler: async () => {
        throw new Error('boom');
      },
    });
    registerTool(server, { name: 'fine', description: 'd', inputSchema: z.object({}), handler: noop });
    const client = await connectClient(server);

    const failed = await client.callTool({ name: 'explodes', arguments: {} });
    expect(failed.isError).toBe(true);
    expect(textOf(failed as { content: unknown[] })).toContain('boom');

    const after = await client.callTool({ name: 'fine', arguments: {} });
    expect(after.isError).toBeFalsy();
  });
});
