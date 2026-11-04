import type { Detection, DetectorImageInput } from './types.js';

/**
 * A swappable model behind the Detector (Requirement 2.6). Adapters return raw,
 * unfiltered Detections. The Detector applies the confidence threshold.
 * Adapters throw UnsupportedImageError for input they cannot decode.
 */
export interface ModelAdapter {
  /** Short name used in logs and errors, for example "coco-ssd". */
  readonly name: string;
  /** Threshold used when the caller does not pass minConfidence. */
  readonly defaultMinConfidence: number;
  /** Loads model weights. Called by the Detector at most once at a time. */
  load(): Promise<void>;
  /** Runs the model on one image. Called only after load() has resolved. */
  infer(image: DetectorImageInput): Promise<Detection[]>;
}
