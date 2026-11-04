// Node-only. MCP server kit.

/** Thrown for kit misuse, such as registering a Tool name twice (Requirement 3.6). */
export class SkeletonMcpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkeletonMcpError';
  }
}
