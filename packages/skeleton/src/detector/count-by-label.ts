import type { Detection } from './types.js';

/**
 * Groups Detections by label and counts them (backs the count_objects MCP tool,
 * Requirement 3.2). Pure function.
 */
export function countByLabel(detections: readonly Detection[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of detections) {
    counts[d.label] = (counts[d.label] ?? 0) + 1;
  }
  return counts;
}
