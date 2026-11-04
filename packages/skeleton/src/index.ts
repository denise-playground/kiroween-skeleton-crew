// Browser-safe entry point of the skeleton package (`@skeleton-crew/core`).
// It must not import Node modules (fs, path, ...). Node-only code is exported from
// `@skeleton-crew/core/node` (src/node/index.ts) instead (Requirement 1.2).

export const SKELETON_NAME = 'skeleton-crew';

export * from './detector/index.js';
