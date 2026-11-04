import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import type { ModelAdapter } from './model-adapter.js';
import type { ImageDecoder } from './pixel-image.js';
import type { Detection, DetectorImageInput } from './types.js';

/** The part of a COCO-SSD result that this adapter uses. */
export interface CocoPrediction {
  /** [x, y, width, height] in pixels. */
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

/** Converts one COCO-SSD result into a Detection with a bounding box. */
export function cocoPredictionToDetection(prediction: CocoPrediction): Detection {
  const [x, y, width, height] = prediction.bbox;
  return {
    label: prediction.class,
    confidence: prediction.score,
    box: { x, y, width, height },
  };
}

export interface CocoSsdAdapterOptions {
  decodeImage: ImageDecoder;
  /** Default 0.5. */
  defaultMinConfidence?: number;
  /** Most boxes the model returns per image. Default 20. */
  maxBoxes?: number;
}

/**
 * Localized object detection (80 COCO classes) with a bounding box per Detection.
 * Runs on whatever TensorFlow.js backend is active, so it works in Node and in the browser.
 */
export class CocoSsdAdapter implements ModelAdapter {
  readonly name = 'coco-ssd';
  readonly defaultMinConfidence: number;
  private model: cocoSsd.ObjectDetection | undefined;
  private readonly decodeImage: ImageDecoder;
  private readonly maxBoxes: number;

  constructor(options: CocoSsdAdapterOptions) {
    this.decodeImage = options.decodeImage;
    this.defaultMinConfidence = options.defaultMinConfidence ?? 0.5;
    this.maxBoxes = options.maxBoxes ?? 20;
  }

  async load(): Promise<void> {
    await tf.ready();
    this.model = await cocoSsd.load();
  }

  async infer(image: DetectorImageInput): Promise<Detection[]> {
    if (!this.model) throw new Error('CocoSsdAdapter.infer() called before load()');
    const pixels = await this.decodeImage(image);
    const tensor = tf.browser.fromPixels(pixels, 3);
    try {
      // minScore 0: the Detector applies the confidence threshold, not the model.
      const predictions = await this.model.detect(tensor, this.maxBoxes, 0);
      return predictions.map(cocoPredictionToDetection);
    } finally {
      tensor.dispose();
    }
  }
}
