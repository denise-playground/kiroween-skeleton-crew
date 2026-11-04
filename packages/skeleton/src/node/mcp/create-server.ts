// Node-only.

import { McpServer } from '@modelcontextprotocol/server';
import type { Detector } from '../../detector/types.js';
import { registerBuiltinTools } from './builtin-tools.js';

export interface SkeletonServerOptions {
  name: string;
  version: string;
  detector: Detector;
}

/**
 * Creates an McpServer that already has `detect_objects` and `count_objects`. Apps add their own
 * Tools with registerTool(). A duplicate name, including a clash with a built-in, throws.
 */
export function createSkeletonServer(options: SkeletonServerOptions): McpServer {
  const server = new McpServer({ name: options.name, version: options.version });
  registerBuiltinTools(server, options.detector);
  return server;
}
