// Node-only. The one function apps call to add a Tool to a server.

import type { McpServer, StandardSchemaWithJSON, ToolCallback } from '@modelcontextprotocol/server';
import { SkeletonMcpError } from './errors.js';
import { errorResult } from './results.js';
import type { ToolResult } from './results.js';

export interface ToolDefinition<Schema extends StandardSchemaWithJSON> {
  /** snake_case, for example "sort_photos". */
  name: string;
  description: string;
  /**
   * The SDK checks every call against this schema before the handler runs and turns a
   * mismatch into an error result (Requirement 3.4). Keep it free of `.transform()` and
   * `.default()` so the handler sees exactly what the caller sent.
   */
  inputSchema: Schema;
  handler: (input: StandardSchemaWithJSON.InferOutput<Schema>) => Promise<ToolResult>;
}

/**
 * Tool names are snake_case: a lower-case letter, then lower-case letters, digits and underscores.
 * This is the project convention, and it also avoids a quirk of the SDK: it keeps tools in a plain
 * object, so a name such as "valueOf" or "toString" is reported as "already registered" the first
 * time it is used. "constructor" is the one lower-case name that still collides, so it is reserved.
 */
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const RESERVED_TOOL_NAMES = new Set(['constructor']);

/** Names registered per server, so a duplicate fails with a clear error. */
const registeredNames = new WeakMap<McpServer, Set<string>>();

/**
 * Registers a Tool on the server.
 * - Throws SkeletonMcpError if the name is not snake_case.
 * - Throws SkeletonMcpError if the server already has a Tool with this name (Requirement 3.6).
 * - A handler that throws becomes an error result and the server keeps running (Requirement 3.5).
 */
export function registerTool<Schema extends StandardSchemaWithJSON>(
  server: McpServer,
  definition: ToolDefinition<Schema>,
): void {
  if (!TOOL_NAME_PATTERN.test(definition.name) || RESERVED_TOOL_NAMES.has(definition.name)) {
    throw new SkeletonMcpError(
      `Invalid Tool name "${definition.name}": use snake_case (a lower-case letter, then lower-case letters, digits and underscores), and not "constructor".`,
    );
  }
  let names = registeredNames.get(server);
  if (!names) {
    names = new Set();
    registeredNames.set(server, names);
  }
  if (names.has(definition.name)) {
    throw new SkeletonMcpError(`A Tool named "${definition.name}" is already registered on this server.`);
  }

  const callback = async (input: StandardSchemaWithJSON.InferOutput<Schema>): Promise<ToolResult> => {
    try {
      return await definition.handler(input);
    } catch (error) {
      return errorResult(error);
    }
  };

  server.registerTool<StandardSchemaWithJSON, Schema>(
    definition.name,
    { description: definition.description, inputSchema: definition.inputSchema },
    // The SDK's callback type is a conditional type that TypeScript cannot resolve for a generic
    // Schema. The runtime shape is exactly (args) => result, so a cast here is safe, and callers
    // of registerTool still get a fully typed handler through ToolDefinition.
    callback as unknown as ToolCallback<Schema>,
  );
  names.add(definition.name);
}
