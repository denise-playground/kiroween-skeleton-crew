// Node-only. Do not import this file from the browser-safe entry point.

import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import type { ImageDecoder, PixelImage } from '../detector/pixel-image.js';
import { UnsupportedImageError } from '../detector/types.js';
import type { DetectorImageInput } from '../detector/types.js';

/** Thrown when a file path is outside the allowed folder, missing, or too large. */
export class ImageAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageAccessError';
  }
}

export interface NodeImageDecoderOptions {
  /**
   * The only folder images may be read from. A model chooses the paths in MCP calls, so
   * anything that resolves outside this folder (including through symlinks) is refused.
   */
  allowedRoot: string;
  /** Largest file read from disk, in bytes. Default 25 MB. */
  maxFileBytes?: number;
  /** Largest base64 input, in characters. Default 34 million (about 25 MB decoded). */
  maxBase64Chars?: number;
  /** Largest image, in megapixels. Guards against decompression bombs. Default 50. */
  maxMegapixels?: number;
}

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);
}

/** Decides the format from the file's first bytes, never from its name. */
function sniffFormat(bytes: Uint8Array): 'png' | 'jpeg' {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpeg';
  throw new UnsupportedImageError('Unsupported image format: only JPEG and PNG are supported.');
}

function decodePng(bytes: Buffer, maxMegapixels: number): PixelImage {
  // The IHDR chunk holds width and height at bytes 16 to 23. Check the size before decoding.
  if (bytes.length >= 24) {
    const megapixels = (bytes.readUInt32BE(16) * bytes.readUInt32BE(20)) / 1_000_000;
    if (megapixels > maxMegapixels) {
      throw new UnsupportedImageError(`Image is too large: ${megapixels.toFixed(1)} MP (limit ${maxMegapixels} MP).`);
    }
  }
  try {
    const { data, width, height } = PNG.sync.read(bytes);
    return { data, width, height };
  } catch (error) {
    throw new UnsupportedImageError(`Could not decode PNG: ${(error as Error).message}`);
  }
}

function decodeJpeg(bytes: Buffer, maxMegapixels: number): PixelImage {
  try {
    const { data, width, height } = jpeg.decode(bytes, { maxResolutionInMP: maxMegapixels });
    return { data, width, height };
  } catch (error) {
    throw new UnsupportedImageError(`Could not decode JPEG: ${(error as Error).message}`);
  }
}

/** Creates the ImageDecoder that Node apps pass to the model adapters. */
export function createNodeImageDecoder(options: NodeImageDecoderOptions): ImageDecoder {
  const maxFileBytes = options.maxFileBytes ?? 25 * 1024 * 1024;
  const maxBase64Chars = options.maxBase64Chars ?? 34_000_000;
  const maxMegapixels = options.maxMegapixels ?? 50;

  async function readAllowedFile(path: string): Promise<Buffer> {
    if (!SUPPORTED_EXTENSIONS.has(extname(path).toLowerCase())) {
      throw new UnsupportedImageError(`Unsupported file type "${extname(path) || path}": only .jpg, .jpeg and .png are supported.`);
    }
    let rootReal: string;
    let fileReal: string;
    try {
      rootReal = await realpath(resolve(options.allowedRoot));
      fileReal = await realpath(resolve(rootReal, path));
    } catch {
      throw new ImageAccessError(`File not found or not readable: ${path}`);
    }
    const rel = relative(rootReal, fileReal);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new ImageAccessError(`Path is outside the allowed folder (${options.allowedRoot}): ${path}`);
    }
    const info = await stat(fileReal);
    if (!info.isFile()) throw new ImageAccessError(`Not a file: ${path}`);
    if (info.size > maxFileBytes) {
      throw new ImageAccessError(`File is too large: ${info.size} bytes (limit ${maxFileBytes}).`);
    }
    return readFile(fileReal);
  }

  function readBase64(data: string, mimeType: string): Buffer {
    if (!SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new UnsupportedImageError(`Unsupported MIME type "${mimeType}": only image/jpeg and image/png are supported.`);
    }
    if (data.length > maxBase64Chars) {
      throw new ImageAccessError(`Base64 input is too large: ${data.length} characters (limit ${maxBase64Chars}).`);
    }
    return Buffer.from(data, 'base64');
  }

  return async (input: DetectorImageInput): Promise<PixelImage> => {
    const bytes = input.kind === 'filePath' ? await readAllowedFile(input.path) : readBase64(input.data, input.mimeType);
    return sniffFormat(bytes) === 'png' ? decodePng(bytes, maxMegapixels) : decodeJpeg(bytes, maxMegapixels);
  };
}
