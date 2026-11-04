// Loads the real models, so it needs network access and takes a while.
// Skipped by default. Run it with:  RUN_MODEL_TESTS=1 pnpm test
// If the model download fails with UNABLE_TO_GET_ISSUER_CERT_LOCALLY (a custom CA or proxy),
// also set NODE_OPTIONS=--use-system-ca.

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CocoSsdAdapter } from '../detector/coco-ssd-adapter.js';
import { Detector } from '../detector/detector.js';
import { MobileNetFoodAdapter } from '../detector/mobilenet-food-adapter.js';
import { createNodeImageDecoder } from './image-decoder.js';

const samplesDir = fileURLToPath(new URL('../../../../samples', import.meta.url));
const decodeImage = createNodeImageDecoder({ allowedRoot: samplesDir });
const enabled = process.env['RUN_MODEL_TESTS'] === '1';
const TWO_MINUTES = 120_000;

describe.skipIf(!enabled)('real models (RUN_MODEL_TESTS=1)', () => {
  it('CocoSsdAdapter returns localized detections for a real photo', { timeout: TWO_MINUTES }, async () => {
    const detector = new Detector(new CocoSsdAdapter({ decodeImage }));
    const detections = await detector.detect({ kind: 'filePath', path: 'fridge-salad-drawer.jpg' }, { minConfidence: 0.2 });

    expect(Array.isArray(detections)).toBe(true);
    for (const d of detections) {
      expect(d.confidence).toBeGreaterThanOrEqual(0.2);
      expect(d.confidence).toBeLessThanOrEqual(1);
      expect(d.box).toBeDefined();
    }
  });

  it('MobileNetFoodAdapter returns only allowlisted whole-image labels', { timeout: TWO_MINUTES }, async () => {
    const allowedLabels = ['banana', 'broccoli', 'cucumber', 'mushroom', 'bell pepper', 'orange', 'lemon', 'zucchini'];
    const detector = new Detector(new MobileNetFoodAdapter({ decodeImage, allowedLabels, defaultMinConfidence: 0 }));
    const detections = await detector.detect({ kind: 'filePath', path: 'potatoes-in-pan.jpg' });

    for (const d of detections) {
      expect(allowedLabels).toContain(d.label);
      expect(d).not.toHaveProperty('box');
    }
  });

  it('loads each model once and reuses it', { timeout: TWO_MINUTES }, async () => {
    const detector = new Detector(new CocoSsdAdapter({ decodeImage }));
    const first = Date.now();
    await detector.detect({ kind: 'filePath', path: 'potatoes-in-pan.jpg' });
    const firstMs = Date.now() - first;
    const second = Date.now();
    await detector.detect({ kind: 'filePath', path: 'potatoes-in-pan.jpg' });
    const secondMs = Date.now() - second;
    // The second call skips the model download and load, so it must be clearly faster.
    expect(secondMs).toBeLessThan(firstMs);
  });
});
