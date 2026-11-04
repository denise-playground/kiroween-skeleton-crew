// Placeholder test from task 1.6. It proves that Vitest and fast-check run in this workspace.
// Delete it once real tests exist (task 9).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SKELETON_NAME } from './index.js';

describe('workspace scaffold', () => {
  it('exports the skeleton name', () => {
    expect(SKELETON_NAME).toBe('skeleton-crew');
  });

  it('runs property-based tests with fast-check', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        expect(sorted).toHaveLength(values.length);
      }),
    );
  });
});
