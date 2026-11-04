import { describe, expect, it } from 'vitest';
import { Detector } from './detector.js';
import type { ModelAdapter } from './model-adapter.js';
import { UnsupportedImageError } from './types.js';
import type { Detection, DetectorImageInput } from './types.js';

const image: DetectorImageInput = { kind: 'base64', data: 'AAAA', mimeType: 'image/png' };

/** Fake adapter so tests run offline, with no model download. */
function fakeAdapter(raw: Detection[], overrides: Partial<ModelAdapter> = {}) {
  const calls = { load: 0, infer: 0 };
  const adapter: ModelAdapter = {
    name: 'fake',
    defaultMinConfidence: 0.5,
    async load() {
      calls.load += 1;
    },
    async infer() {
      calls.infer += 1;
      return raw;
    },
    ...overrides,
  };
  return { adapter, calls };
}

describe('Detector', () => {
  it('loads the model once and reuses it across calls (Requirement 2.5)', async () => {
    const { adapter, calls } = fakeAdapter([]);
    const detector = new Detector(adapter);
    await detector.detect(image);
    await detector.detect(image);
    await detector.detect(image);
    expect(calls.load).toBe(1);
    expect(calls.infer).toBe(3);
  });

  it('loads once even when calls overlap before the first load finishes', async () => {
    const { adapter, calls } = fakeAdapter([], {
      load: async () => {
        calls.load += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
      },
    });
    const detector = new Detector(adapter);
    await Promise.all([detector.detect(image), detector.detect(image), detector.detect(image)]);
    expect(calls.load).toBe(1);
  });

  it('applies the adapter default threshold when none is given (Requirement 2.3)', async () => {
    const { adapter } = fakeAdapter([
      { label: 'cat', confidence: 0.9 },
      { label: 'dog', confidence: 0.3 },
    ]);
    const result = await new Detector(adapter).detect(image);
    expect(result.map((d) => d.label)).toEqual(['cat']);
  });

  it('uses the caller threshold over the default', async () => {
    const { adapter } = fakeAdapter([
      { label: 'cat', confidence: 0.9 },
      { label: 'dog', confidence: 0.3 },
    ]);
    const result = await new Detector(adapter).detect(image, { minConfidence: 0.1 });
    expect(result.map((d) => d.label)).toEqual(['cat', 'dog']);
  });

  it('keeps a bounding box when the adapter provides one, and omits it otherwise', async () => {
    const box = { x: 1, y: 2, width: 3, height: 4 };
    const { adapter } = fakeAdapter([
      { label: 'banana', confidence: 0.9, box },
      { label: 'tray', confidence: 0.8 },
    ]);
    const [withBox, withoutBox] = await new Detector(adapter).detect(image);
    expect(withBox?.box).toEqual(box);
    expect(withoutBox).not.toHaveProperty('box');
  });

  it('passes UnsupportedImageError to the caller as a rejection (Requirement 2.4)', async () => {
    const { adapter } = fakeAdapter([], {
      infer: async () => {
        throw new UnsupportedImageError('only JPEG and PNG are supported');
      },
    });
    const detector = new Detector(adapter);
    await expect(detector.detect(image)).rejects.toBeInstanceOf(UnsupportedImageError);
    // The detector is still usable afterwards.
    await expect(detector.detect(image)).rejects.toThrow('only JPEG and PNG');
  });

  it('retries loading after a failed load', async () => {
    let attempts = 0;
    const { adapter } = fakeAdapter([{ label: 'cat', confidence: 0.9 }], {
      load: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('network down');
      },
    });
    const detector = new Detector(adapter);
    await expect(detector.detect(image)).rejects.toThrow('network down');
    await expect(detector.detect(image)).resolves.toHaveLength(1);
    expect(attempts).toBe(2);
  });
});
