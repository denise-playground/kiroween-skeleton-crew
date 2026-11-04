// Build check for Requirement 1.2: the browser-safe entry point must not pull in Node modules.
// It bundles each entry for the browser with esbuild. esbuild fails when the import graph
// reaches a Node built-in such as node:fs or path.

import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const entry = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

function bundleForBrowser(entryPoint: string) {
  return build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
}

describe('package entry points (Requirement 1.2)', () => {
  it('the browser-safe entry bundles for the browser without any Node module', { timeout: 60_000 }, async () => {
    const result = await bundleForBrowser(entry('./index.ts'));
    expect(result.errors).toEqual([]);
    expect(result.outputFiles.length).toBeGreaterThan(0);
  });

  it('the check can fail: the Node entry does not bundle for the browser', { timeout: 60_000 }, async () => {
    await expect(bundleForBrowser(entry('./node/index.ts'))).rejects.toThrow(/Could not resolve/);
  });
});
