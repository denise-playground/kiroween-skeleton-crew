import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import type { ModelAdapter } from './model-adapter.js';
import type { ImageDecoder } from './pixel-image.js';
import type { Detection, DetectorImageInput } from './types.js';

/** The part of a MobileNet result that this adapter uses. */
export interface ClassifierPrediction {
  /** ImageNet class name. May hold synonyms, for example "cucumber, cuke". */
  className: string;
  probability: number;
}

/**
 * Keeps only predictions whose name matches the allowlist, as whole-image Detections
 * (no bounding box). A class name with several comma-separated synonyms matches if any
 * synonym is in the allowlist, and the matched synonym becomes the label, so the label is
 * always a value the app put in its own allowlist. Matching ignores case and spacing.
 * The first matching synonym wins when more than one matches.
 */
export function filterToAllowedLabels(
  predictions: readonly ClassifierPrediction[],
  allowedLabels: ReadonlySet<string>,
): Detection[] {
  const detections: Detection[] = [];
  for (const prediction of predictions) {
    const synonyms = prediction.className.split(',').map((s) => s.trim().toLowerCase());
    const matched = synonyms.find((s) => allowedLabels.has(s));
    if (matched !== undefined) {
      detections.push({ label: matched, confidence: prediction.probability });
    }
  }
  return detections;
}

export interface MobileNetFoodAdapterOptions {
  decodeImage: ImageDecoder;
  /**
   * Labels the app accepts, for example ["broccoli", "cucumber", "banana"]. Passed in by the
   * app so the skeleton stays generic. Anything else the model says (plate, tray, ...) is dropped.
   */
  allowedLabels: readonly string[];
  /** Default 0.1. Whole-image scores are low on busy scenes (Spike C), so the default is low. */
  defaultMinConfidence?: number;
  /** How many top predictions to read before filtering. Default 10. */
  topK?: number;
}

/**
 * Whole-image classification (ImageNet MobileNet v2) filtered to an allowlist of food labels.
 * Best-effort only: Spike C found it misses common ingredients (no tomato, onion, carrot,
 * garlic or avocado class), so apps should treat results as suggestions the user can edit.
 */
export class MobileNetFoodAdapter implements ModelAdapter {
  readonly name = 'mobilenet-food';
  readonly defaultMinConfidence: number;
  private model: mobilenet.MobileNet | undefined;
  private readonly decodeImage: ImageDecoder;
  private readonly allowed: ReadonlySet<string>;
  private readonly topK: number;

  constructor(options: MobileNetFoodAdapterOptions) {
    this.decodeImage = options.decodeImage;
    this.allowed = new Set(options.allowedLabels.map((l) => l.trim().toLowerCase()));
    this.defaultMinConfidence = options.defaultMinConfidence ?? 0.1;
    this.topK = options.topK ?? 10;
  }

  async load(): Promise<void> {
    await tf.ready();
    this.model = await mobilenet.load({ version: 2, alpha: 1.0 });
  }

  async infer(image: DetectorImageInput): Promise<Detection[]> {
    if (!this.model) throw new Error('MobileNetFoodAdapter.infer() called before load()');
    const pixels = await this.decodeImage(image);
    const tensor = tf.browser.fromPixels(pixels, 3);
    try {
      const predictions = await this.model.classify(tensor, this.topK);
      return filterToAllowedLabels(predictions, this.allowed);
    } finally {
      tensor.dispose();
    }
  }
}
