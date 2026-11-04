import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { countByLabel } from './count-by-label.js';
import type { Detection } from './types.js';

const detectionArb = fc.record({
  label: fc.constantFrom('cat', 'dog', 'banana', 'cucumber'),
  confidence: fc.float({ min: 0, max: 1, noNaN: true }),
}) satisfies fc.Arbitrary<Detection>;

describe('countByLabel', () => {
  it('the sum of counts equals the number of detections (Requirement 10.1)', () => {
    fc.assert(
      fc.property(fc.array(detectionArb), (detections) => {
        const counts = countByLabel(detections);
        const sum = Object.values(counts).reduce((a, b) => a + b, 0);
        return sum === detections.length;
      }),
    );
  });

  it('counts each label correctly', () => {
    const detections: Detection[] = [
      { label: 'cat', confidence: 0.9 },
      { label: 'cat', confidence: 0.4 },
      { label: 'dog', confidence: 0.8 },
    ];
    expect(countByLabel(detections)).toEqual({ cat: 2, dog: 1 });
  });

  it('returns an empty object for no detections', () => {
    expect(countByLabel([])).toEqual({});
  });
});
