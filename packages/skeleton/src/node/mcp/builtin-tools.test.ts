import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { UnsupportedImageError } from '../../detector/types.js';
import type { Detection, DetectOptions, Detector, DetectorImageInput } from '../../detector/types.js';
import { createSkeletonServer } from './create-server.js';
import { SkeletonMcpError } from './errors.js';
import { registerTool } from './register-tool.js';
import { textResult } from './results.js';
import { connectClient, textOf } from './test-helpers.js';
import * as z from 'zod/v4';

/** A Detector that returns fixed detections and records how it was called. */
function fakeDetector(detections: Detection[], failWith?: Error) {
  const calls: { image: DetectorImageInput; options: DetectOptions | undefined }[] = [];
  const detector: Detector = {
    async detect(image, options) {
      calls.push({ image, options });
      if (failWith) throw failWith;
      return detections;
    },
  };
  return { detector, calls };
}

const parse = (result: unknown) => JSON.parse(textOf(result as { content: unknown[] }));

describe('built-in tools', () => {
  it('lists detect_objects and count_objects', async () => {
    const { detector } = fakeDetector([]);
    const client = await connectClient(createSkeletonServer({ name: 'app', version: '1.0.0', detector }));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['count_objects', 'detect_objects']);
  });

  it('detect_objects returns the detections, with boxes when present (Requirement 3.1)', async () => {
    const detections: Detection[] = [
      { label: 'banana', confidence: 0.9, box: { x: 1, y: 2, width: 3, height: 4 } },
      { label: 'broccoli', confidence: 0.4 },
    ];
    const { detector, calls } = fakeDetector(detections);
    const client = await connectClient(createSkeletonServer({ name: 'app', version: '1.0.0', detector }));
    const result = await client.callTool({ name: 'detect_objects', arguments: { imagePath: 'a.jpg' } });
    expect(result.isError).toBeFalsy();
    expect(parse(result)).toEqual(detections);
    expect(calls[0]?.image).toEqual({ kind: 'filePath', path: 'a.jpg' });
  });

  it('count_objects groups detections by label (Requirement 3.2)', async () => {
    const { detector } = fakeDetector([
      { label: 'banana', confidence: 0.9 },
      { label: 'banana', confidence: 0.8 },
      { label: 'bowl', confidence: 0.7 },
    ]);
    const client = await connectClient(createSkeletonServer({ name: 'app', version: '1.0.0', detector }));
    const result = await client.callTool({ name: 'count_objects', arguments: { imagePath: 'a.jpg' } });
    expect(parse(result)).toEqual({ banana: 2, bowl: 1 });
  });

  it('count_objects total equals the number of detections, for any detections (Requirement 10.1)', async () => {
    const detectionArb = fc.record({
      label: fc.constantFrom('banana', 'bowl', 'cup'),
      confidence: fc.float({ min: 0, max: 1, noNaN: true }),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(detectionArb, { maxLength: 20 }), async (detections) => {
        const { detector } = fakeDetector(detections);
        const client = await connectClient(createSkeletonServer({ name: 'app', version: '1.0.0', detector }));
        const counts = parse(await client.callTool({ name: 'count_objects', arguments: { imagePath: 'a.jpg' } }));
        const total = (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);
        expect(total).toBe(detections.length);
      }),
      { numRuns: 30 },
    );
  });

  it('passes minConfidence to the detector, and omits it when not given', async () => {
    const { detector, calls } = fakeDetector([]);
    const client = await connectClient(createSkeletonServer({ name: 'app', version: '1.0.0', detector }));
    await client.callTool({ name: 'detect_objects', arguments: { imagePath: 'a.jpg', minConfidence: 0.7 } });
    await client.callTool({ name: 'detect_objects', arguments: { imagePath: 'a.jpg' } });
    expect(calls[0]?.options).toEqual({ minConfidence: 0.7 });
    expect(calls[1]?.options).toEqual({});
  });

  it('rejects an out-of-range minConfidence without calling the detector', async () => {
    const { detector, calls } = fakeDetector([]);
    const client = await connectClient(createSkeletonServer({ name: 'app', version: '1.0.0', detector }));
    const result = await client.callTool({ name: 'detect_objects', arguments: { imagePath: 'a.jpg', minConfidence: 2 } });
    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('returns an unsupported-image error as a readable error result, and keeps serving (Requirement 2.4)', async () => {
    const { detector } = fakeDetector([], new UnsupportedImageError('only JPEG and PNG are supported'));
    const client = await connectClient(createSkeletonServer({ name: 'app', version: '1.0.0', detector }));
    const failed = await client.callTool({ name: 'detect_objects', arguments: { imagePath: 'a.gif' } });
    expect(failed.isError).toBe(true);
    expect(textOf(failed as { content: unknown[] })).toContain('only JPEG and PNG');
    const again = await client.callTool({ name: 'count_objects', arguments: { imagePath: 'a.gif' } });
    expect(again.isError).toBe(true);
  });

  it('lets an app add its own tool next to the built-ins (Requirement 3.3)', async () => {
    const { detector } = fakeDetector([]);
    const server = createSkeletonServer({ name: 'app', version: '1.0.0', detector });
    registerTool(server, { name: 'sort_photos', description: 'd', inputSchema: z.object({}), handler: async () => textResult('x') });
    const client = await connectClient(server);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('sort_photos');
    expect(tools).toHaveLength(3);
  });

  it('rejects an app tool that reuses a built-in name (Requirement 3.6)', () => {
    const { detector } = fakeDetector([]);
    const server = createSkeletonServer({ name: 'app', version: '1.0.0', detector });
    expect(() =>
      registerTool(server, { name: 'detect_objects', description: 'd', inputSchema: z.object({}), handler: async () => textResult('x') }),
    ).toThrow(SkeletonMcpError);
  });
});
