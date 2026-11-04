import { defineConfig } from 'vitest/config';

// One test run for the whole workspace. Tests live next to the code as *.test.ts.
// When the web UI needs a browser-like environment (task 20), switch to Vitest projects.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
  },
});
