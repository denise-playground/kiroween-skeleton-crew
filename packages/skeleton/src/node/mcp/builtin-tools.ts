// Node-only. The two Tools every app server gets for free (Requirements 3.1 and 3.2).

import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { countByLabel } from '../../detector/count-by-label.js';
import type { DetectOptions, Detector } from '../../detector/types.js';
import { registerTool } from './register-tool.js';
import { jsonResult } from './results.js';

const imageInput = z.object({
  imagePath: z
    .string()
    .min(1)
    .describe('Path to a JPEG or PNG image. Relative paths are resolved inside the allowed images folder.'),
  minConfidence: z.number().min(0).max(1).optional().describe('Ignore detections below this confidence, from 0 to 1.'),
});

function optionsFrom(input: { minConfidence?: number | undefined }): DetectOptions {
  return input.minConfidence === undefined ? {} : { minConfidence: input.minConfidence };
}

/**
 * Registers `detect_objects` and `count_objects`. Reading files safely (allowed folder, size caps,
 * JPEG and PNG only) is the job of the Detector's image decoder, so a model-chosen path is checked
 * there and a refusal comes back as an error result.
 */
export function registerBuiltinTools(server: McpServer, detector: Detector): void {
  registerTool(server, {
    name: 'detect_objects',
    description:
      'Detect objects in an image. Returns a list of detections, each with a label and a confidence from 0 to 1, ' +
      'and a bounding box when the model can locate the object.',
    inputSchema: imageInput,
    handler: async (input) => {
      const detections = await detector.detect({ kind: 'filePath', path: input.imagePath }, optionsFrom(input));
      return jsonResult(detections);
    },
  });

  registerTool(server, {
    name: 'count_objects',
    description: 'Count the objects in an image, grouped by label. Returns an object such as {"banana": 2, "bowl": 1}.',
    inputSchema: imageInput,
    handler: async (input) => {
      const detections = await detector.detect({ kind: 'filePath', path: input.imagePath }, optionsFrom(input));
      return jsonResult(countByLabel(detections));
    },
  });
}
