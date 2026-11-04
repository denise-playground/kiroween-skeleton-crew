import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UnsupportedImageError } from '../detector/types.js';
import { ImageAccessError, createNodeImageDecoder } from './image-decoder.js';

/** A solid-colour image, encoded in memory so the tests need no sample files. */
function makePng(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(200);
  return PNG.sync.write(png);
}
function makeJpeg(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 4, 128);
  return Buffer.from(jpeg.encode({ data, width, height }, 90).data);
}

let root: string;
let outside: string;
const decode = () => createNodeImageDecoder({ allowedRoot: root });

beforeAll(async () => {
  const base = await mkdtemp(join(tmpdir(), 'skeleton-img-'));
  root = join(base, 'allowed');
  outside = join(base, 'outside');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(root, 'a.png'), makePng(8, 6));
  await writeFile(join(root, 'b.jpg'), makeJpeg(10, 4));
  await writeFile(join(root, 'upper.JPEG'), makeJpeg(5, 5));
  await writeFile(join(root, 'fake.png'), Buffer.from('GIF89a not really a png'));
  await writeFile(join(root, 'notes.txt'), 'hello');
  await writeFile(join(outside, 'secret.png'), makePng(2, 2));
  await symlink(outside, join(root, 'escape'));
});

afterAll(async () => {
  await rm(join(root, '..'), { recursive: true, force: true });
});

describe('createNodeImageDecoder: files', () => {
  it('decodes a PNG into RGBA pixels', async () => {
    const image = await decode()({ kind: 'filePath', path: join(root, 'a.png') });
    expect(image).toMatchObject({ width: 8, height: 6 });
    expect(image.data).toBeInstanceOf(Uint8Array);
    expect(image.data.length).toBe(8 * 6 * 4);
  });

  it('decodes a JPEG and accepts an upper-case extension', async () => {
    const image = await decode()({ kind: 'filePath', path: join(root, 'upper.JPEG') });
    expect(image).toMatchObject({ width: 5, height: 5 });
    expect(image.data.length).toBe(5 * 5 * 4);
  });

  it('resolves a relative path against the allowed folder', async () => {
    const image = await decode()({ kind: 'filePath', path: 'b.jpg' });
    expect(image).toMatchObject({ width: 10, height: 4 });
  });

  it('rejects an unsupported extension with UnsupportedImageError', async () => {
    await expect(decode()({ kind: 'filePath', path: join(root, 'notes.txt') })).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('judges the format by content, not by name', async () => {
    await expect(decode()({ kind: 'filePath', path: join(root, 'fake.png') })).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('refuses a file outside the allowed folder', async () => {
    await expect(decode()({ kind: 'filePath', path: join(outside, 'secret.png') })).rejects.toBeInstanceOf(ImageAccessError);
  });

  it('refuses ../ traversal out of the allowed folder', async () => {
    await expect(decode()({ kind: 'filePath', path: '../outside/secret.png' })).rejects.toBeInstanceOf(ImageAccessError);
  });

  it('refuses a symlink that points outside the allowed folder', async () => {
    await expect(decode()({ kind: 'filePath', path: join(root, 'escape', 'secret.png') })).rejects.toBeInstanceOf(ImageAccessError);
  });

  it('reports a missing file with a descriptive error', async () => {
    await expect(decode()({ kind: 'filePath', path: join(root, 'nope.png') })).rejects.toThrow(/not found/i);
  });

  it('refuses files above the size cap', async () => {
    const small = createNodeImageDecoder({ allowedRoot: root, maxFileBytes: 10 });
    await expect(small({ kind: 'filePath', path: join(root, 'a.png') })).rejects.toThrow(/too large/i);
  });

  it('refuses images above the megapixel cap before decoding', async () => {
    const tiny = createNodeImageDecoder({ allowedRoot: root, maxMegapixels: 0.00001 });
    await expect(tiny({ kind: 'filePath', path: join(root, 'a.png') })).rejects.toBeInstanceOf(UnsupportedImageError);
    await expect(tiny({ kind: 'filePath', path: join(root, 'b.jpg') })).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});

describe('createNodeImageDecoder: base64', () => {
  it('decodes base64 PNG and JPEG', async () => {
    const png = await decode()({ kind: 'base64', data: makePng(3, 3).toString('base64'), mimeType: 'image/png' });
    expect(png).toMatchObject({ width: 3, height: 3 });
    const jpg = await decode()({ kind: 'base64', data: makeJpeg(4, 2).toString('base64'), mimeType: 'image/jpeg' });
    expect(jpg).toMatchObject({ width: 4, height: 2 });
  });

  it('rejects an unsupported MIME type', async () => {
    await expect(decode()({ kind: 'base64', data: 'AAAA', mimeType: 'image/gif' })).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('rejects base64 above the size cap', async () => {
    const small = createNodeImageDecoder({ allowedRoot: root, maxBase64Chars: 8 });
    await expect(small({ kind: 'base64', data: 'A'.repeat(100), mimeType: 'image/png' })).rejects.toBeInstanceOf(ImageAccessError);
  });

  it('rejects a truncated PNG with UnsupportedImageError instead of crashing', async () => {
    const truncated = makePng(8, 8).subarray(0, 40).toString('base64');
    await expect(decode()({ kind: 'base64', data: truncated, mimeType: 'image/png' })).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it('any bytes that are not JPEG or PNG are rejected with UnsupportedImageError (Requirement 2.4)', async () => {
    const d = decode();
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 200 }), async (bytes) => {
        const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
        fc.pre(!starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && !starts([0xff, 0xd8, 0xff]));
        await expect(
          d({ kind: 'base64', data: Buffer.from(bytes).toString('base64'), mimeType: 'image/png' }),
        ).rejects.toBeInstanceOf(UnsupportedImageError);
      }),
    );
  });
});
