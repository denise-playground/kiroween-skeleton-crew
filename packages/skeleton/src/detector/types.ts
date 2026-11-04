// Shared detection types. Browser-safe: no Node imports here (Requirement 1.2).

/** One detected object or whole-image classification. */
export interface Detection {
  label: string;
  /** Confidence score, 0 to 1. */
  confidence: number;
  /**
   * Present for localized detectors (for example COCO-SSD). Absent for
   * whole-image classifiers (for example a MobileNet-style food classifier),
   * which describe the whole image rather than a region of it.
   */
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DetectOptions {
  /** Detections below this confidence are excluded. Default is adapter-specific. */
  minConfidence?: number;
}

/** Input accepted by a Detector. File paths only resolve in Node. */
export type DetectorImageInput =
  | { kind: 'filePath'; path: string }
  | { kind: 'base64'; data: string; mimeType: string };

/** Implemented by model adapters (CocoSsdAdapter, MobileNetFoodAdapter, ...). */
export interface Detector {
  detect(image: DetectorImageInput, options?: DetectOptions): Promise<Detection[]>;
}

/** Thrown when an image's format is not supported, or input is otherwise unusable. */
export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedImageError';
  }
}
