import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(fileURLToPath(new URL('../agent-template/app-agent.template.json', import.meta.url)), 'utf8');

const values: Record<string, string> = {
  APP_NAME: 'demo-app',
  APP_DESCRIPTION: 'A demo agent.',
  PERSONA: 'a friendly demo bot',
  APP_TOOL_NAME: 'demo_tool',
  MCP_ENTRY: 'apps/demo-app/src/mcp-server.ts',
  WELCOME_MESSAGE: 'Hello from the demo app.',
};

/** Fills every {{PLACEHOLDER}}. JSON-escapes values so a quote in a value cannot break the file. */
function fill(template: string): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Template uses an unknown placeholder: ${key}`);
    return JSON.stringify(value).slice(1, -1);
  });
}

describe('App_Agent template (Requirement 4.5)', () => {
  it('only uses placeholders that this test knows how to fill', () => {
    expect(() => fill(raw)).not.toThrow();
  });

  it('becomes valid JSON with the agent format confirmed in Spike A', () => {
    const agent = JSON.parse(fill(raw)) as Record<string, unknown>;
    expect(agent['name']).toBe('demo-app');
    expect(agent['includeMcpJson']).toBe(false);
    expect(agent['tools']).toEqual(['@demo-app/detect_objects', '@demo-app/count_objects', '@demo-app/demo_tool']);
    expect(Object.keys(agent['mcpServers'] as object)).toEqual(['demo-app']);
  });

  it('gives access only to this app tools and uses no legacy fields (Requirement 4.3)', () => {
    const agent = JSON.parse(fill(raw)) as Record<string, unknown>;
    expect(agent).not.toHaveProperty('allowedTools');
    expect(agent).not.toHaveProperty('toolsSettings');
    for (const tool of agent['tools'] as string[]) {
      expect(tool.startsWith('@demo-app/')).toBe(true);
    }
    expect(agent['tools']).not.toContain('*');
  });
});
