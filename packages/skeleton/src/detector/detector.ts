import { filterByConfidence } from './filter-by-confidence.js';
import type { ModelAdapter } from './model-adapter.js';
import type { DetectOptions, Detection, Detector as DetectorInterface, DetectorImageInput } from './types.js';

/**
 * Detector built around a ModelAdapter.
 * - Loads the model once and reuses it (Requirement 2.5), even when detect() is
 *   called several times before the first load finishes.
 * - Applies the confidence threshold (Requirement 2.3).
 * - Lets UnsupportedImageError from the adapter reach the caller as a rejection,
 *   so callers handle it without the process crashing (Requirement 2.4).
 */
export class Detector implements DetectorInterface {
  private loading: Promise<void> | undefined;

  constructor(private readonly adapter: ModelAdapter) {}

  async detect(image: DetectorImageInput, options: DetectOptions = {}): Promise<Detection[]> {
    await this.ensureLoaded();
    const raw = await this.adapter.infer(image);
    return filterByConfidence(raw, options.minConfidence ?? this.adapter.defaultMinConfidence);
  }

  private ensureLoaded(): Promise<void> {
    if (!this.loading) {
      this.loading = this.adapter.load().catch((error: unknown) => {
        // Forget a failed load so the next call can retry instead of failing forever.
        this.loading = undefined;
        throw error;
      });
    }
    return this.loading;
  }
}
