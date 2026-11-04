// Node-only MCP server kit.

export { registerBuiltinTools } from './builtin-tools.js';
export { createSkeletonServer } from './create-server.js';
export type { SkeletonServerOptions } from './create-server.js';
export { SkeletonMcpError } from './errors.js';
export { registerTool } from './register-tool.js';
export type { ToolDefinition } from './register-tool.js';
export { errorResult, jsonResult, textResult } from './results.js';
export type { ToolResult } from './results.js';
export { redirectConsoleToStderr, serveOverStdio } from './stdio.js';
export type { StdioServerHandle } from './stdio.js';
