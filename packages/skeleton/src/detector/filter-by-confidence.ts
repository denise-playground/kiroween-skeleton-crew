import type { Detection } from './types.js';

/**
 * Keeps only Detections at or above minConfidence (Requirement 2.3).
 * Pure function: does not mutate the input array.
 */
export function filterByConfidence(detections: readonly Detection[], minConfidence: number): Detection[] {
  return detections.filter((d) => d.confidence >= minConfidence);
}
