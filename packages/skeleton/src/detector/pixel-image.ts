import type { DetectorImageInput } from './types.js';

/**
 * Decoded pixels, 4 bytes per pixel (RGBA), row by row.
 *
 * `data` must be a real Uint8Array or a Node Buffer. Do not re-wrap it with
 * `new Uint8Array(buffer, offset, length)`: TensorFlow.js in Node rejects such a view
 * (found in Spike B).
 */
export interface PixelImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Turns a DetectorImageInput into pixels. This is the only part that differs between
 * Node (jpeg-js and pngjs, task 11) and the browser (canvas), so adapters take it as a
 * parameter and stay environment-neutral.
 * Implementations throw UnsupportedImageError for formats they cannot decode.
 */
export type ImageDecoder = (input: DetectorImageInput) => Promise<PixelImage>;
