// Node-only. Helpers for running a server over stdio (Requirement 3.7).

import type { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

/**
 * Sends console.log, console.info and console.debug to stderr. On a stdio server, stdout belongs
 * to the protocol, so one stray console.log from our code or a dependency corrupts the stream.
 * Returns a function that undoes the change.
 */
export function redirectConsoleToStderr(): () => void {
  const original = { log: console.log, info: console.info, debug: console.debug };
  console.log = console.error;
  console.info = console.error;
  console.debug = console.error;
  return () => {
    console.log = original.log;
    console.info = original.info;
    console.debug = original.debug;
  };
}

/** What serveOverStdio returns. The process stays alive while it reads stdin, until close() is called. */
export interface StdioServerHandle {
  close(): Promise<void>;
}

/**
 * Serves an MCP server over stdio. Redirects console output to stderr first, then prints a startup
 * line to stderr. `createServer` is called to build the server for the connection.
 */
export function serveOverStdio(name: string, createServer: () => McpServer): StdioServerHandle {
  redirectConsoleToStderr();
  const handle = serveStdio(createServer);
  console.error(`${name} MCP server running on stdio`);
  return handle;
}
