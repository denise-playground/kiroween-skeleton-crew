import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { redirectConsoleToStderr } from './stdio.js';

describe('redirectConsoleToStderr', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends console.log, info and debug to stderr and can be undone', () => {
    const original = { log: console.log, info: console.info, debug: console.debug };
    const restore = redirectConsoleToStderr();
    expect(console.log).toBe(console.error);
    expect(console.info).toBe(console.error);
    expect(console.debug).toBe(console.error);
    restore();
    expect(console.log).toBe(original.log);
    expect(console.info).toBe(original.info);
    expect(console.debug).toBe(original.debug);
  });
});

describe('serving over stdio (Requirement 3.7)', () => {
  const fixture = fileURLToPath(new URL('./stdio-fixture.ts', import.meta.url));
  const packageDir = fileURLToPath(new URL('../../../', import.meta.url));

  it('keeps stdout to protocol messages only, even when code calls console.log', { timeout: 30_000 }, async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', fixture], { cwd: packageDir, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

    const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`);
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'say_hello', arguments: { name: 'Denise' } } });

    // Wait until all three responses have arrived.
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && stdout.split('\n').filter((l) => l.trim()).length < 3) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    child.kill();

    const lines = stdout.split('\n').filter((line) => line.trim() !== '');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      // Every stdout line must be a JSON-RPC message. A stray console.log would break this.
      const message = JSON.parse(line) as { jsonrpc?: string };
      expect(message.jsonrpc).toBe('2.0');
    }
    expect(stdout).not.toContain('STRAY STDOUT');
    expect(stdout).toContain('hello Denise');
    expect(stdout).toContain('detect_objects');
    expect(stderr).toContain('fixture MCP server running on stdio');
    expect(stderr).toContain('STRAY STDOUT FROM A HANDLER');
  });
});
