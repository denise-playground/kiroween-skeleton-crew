import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { filterByConfidence } from './filter-by-confidence.js';
import type { Detection } from './types.js';

const detectionArb = fc.record({
  label: fc.string({ minLength: 1 }),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
}) satisfies fc.Arbitrary<Detection>;

describe('filterByConfidence', () => {
  it('keeps only detections at or above the threshold (Requirement 10.2)', () => {
    fc.assert(
      fc.property(
        fc.array(detectionArb),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (detections, minConfidence) => {
          const result = filterByConfidence(detections, minConfidence);
          return result.every((d) => d.confidence >= minConfidence);
        },
      ),
    );
  });

  it('never grows the input', () => {
    fc.assert(
      fc.property(
        fc.array(detectionArb),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (detections, minConfidence) => filterByConfidence(detections, minConfidence).length <= detections.length,
      ),
    );
  });

  it('does not mutate the input array', () => {
    const detections: Detection[] = [
      { label: 'cat', confidence: 0.9 },
      { label: 'dog', confidence: 0.2 },
    ];
    const copy = detections.map((d) => ({ ...d }));
    filterByConfidence(detections, 0.5);
    expect(detections).toEqual(copy);
  });
});
