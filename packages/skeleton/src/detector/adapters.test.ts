import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cocoPredictionToDetection } from './coco-ssd-adapter.js';
import { filterToAllowedLabels } from './mobilenet-food-adapter.js';

describe('cocoPredictionToDetection', () => {
  it('maps bbox [x, y, width, height] to a named box and keeps label and score', () => {
    expect(cocoPredictionToDetection({ bbox: [10, 20, 30, 40], class: 'banana', score: 0.87 })).toEqual({
      label: 'banana',
      confidence: 0.87,
      box: { x: 10, y: 20, width: 30, height: 40 },
    });
  });
});

describe('filterToAllowedLabels', () => {
  const allowed = new Set(['cucumber', 'broccoli', 'bell pepper']);

  it('drops non-food and non-allowlisted predictions', () => {
    const result = filterToAllowedLabels(
      [
        { className: 'plate', probability: 0.4 },
        { className: 'broccoli', probability: 0.3 },
        { className: 'tray', probability: 0.2 },
      ],
      allowed,
    );
    expect(result).toEqual([{ label: 'broccoli', confidence: 0.3 }]);
  });

  it('matches any comma-separated synonym and uses it as the label', () => {
    const result = filterToAllowedLabels([{ className: 'cucumber, cuke', probability: 0.6 }], allowed);
    expect(result).toEqual([{ label: 'cucumber', confidence: 0.6 }]);
  });

  it('ignores case and surrounding spaces', () => {
    const result = filterToAllowedLabels([{ className: '  Bell Pepper ', probability: 0.5 }], allowed);
    expect(result).toEqual([{ label: 'bell pepper', confidence: 0.5 }]);
  });

  it('returns whole-image Detections without a bounding box', () => {
    const [detection] = filterToAllowedLabels([{ className: 'broccoli', probability: 0.9 }], allowed);
    expect(detection).not.toHaveProperty('box');
  });

  it('every returned label is in the allowlist, for any predictions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            className: fc.oneof(
              fc.constantFrom('plate', 'broccoli', 'cucumber, cuke', 'Bell Pepper', 'maraca'),
              fc.string(),
            ),
            probability: fc.float({ min: 0, max: 1, noNaN: true }),
          }),
        ),
        (predictions) => filterToAllowedLabels(predictions, allowed).every((d) => allowed.has(d.label)),
      ),
    );
  });
});
