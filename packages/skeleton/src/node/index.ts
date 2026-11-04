// Node-only entry point (`@skeleton-crew/core/node`).
// Anything that needs fs, path or other Node modules lives here, never in the browser-safe entry.

export { ImageAccessError, createNodeImageDecoder } from './image-decoder.js';
export type { NodeImageDecoderOptions } from './image-decoder.js';
export * from './mcp/index.js';
// Apps build tool input schemas with this `z`, so they share the kit's Zod version.
export * as z from 'zod/v4';
