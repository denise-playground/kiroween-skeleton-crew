// Node-only. Helpers that build the results a Tool handler returns.

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

/** A JSON value as pretty-printed text, which both people and models can read. */
export function jsonResult(value: unknown): ToolResult {
  return textResult(JSON.stringify(value, null, 2));
}

/** An error the caller can read. The server keeps running (Requirement 3.5). */
export function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return { content: [{ type: 'text', text: message }], isError: true };
}
