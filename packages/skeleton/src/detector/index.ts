// Browser-safe detection core. Do not import Node modules from this folder.

export { CocoSsdAdapter, cocoPredictionToDetection } from './coco-ssd-adapter.js';
export type { CocoPrediction, CocoSsdAdapterOptions } from './coco-ssd-adapter.js';
export { countByLabel } from './count-by-label.js';
export { MobileNetFoodAdapter, filterToAllowedLabels } from './mobilenet-food-adapter.js';
export type { ClassifierPrediction, MobileNetFoodAdapterOptions } from './mobilenet-food-adapter.js';
export type { ImageDecoder, PixelImage } from './pixel-image.js';
export { Detector } from './detector.js';
export { filterByConfidence } from './filter-by-confidence.js';
export type { ModelAdapter } from './model-adapter.js';
export { UnsupportedImageError } from './types.js';
export type { Detection, DetectOptions, Detector as DetectorInterface, DetectorImageInput } from './types.js';
