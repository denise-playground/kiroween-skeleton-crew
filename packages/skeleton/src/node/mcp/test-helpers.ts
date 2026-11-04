// Test-only helper: connects a real MCP client to a server over the SDK's in-memory transport.

import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import type { McpServer } from '@modelcontextprotocol/server';

export async function connectClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** The text of a tool result's first content block. */
export function textOf(result: { content: unknown[] }): string {
  const first = result.content[0] as { type: string; text?: string } | undefined;
  return first?.text ?? '';
}
