// Test fixture, started as a child process by stdio.test.ts. It is not part of the public API.
// It prints stray output with console.log on purpose, to prove that stdout stays clean.

import * as z from 'zod/v4';
import { createSkeletonServer } from './create-server.js';
import { registerTool } from './register-tool.js';
import { textResult } from './results.js';
import { serveOverStdio } from './stdio.js';

serveOverStdio('fixture', () => {
  const server = createSkeletonServer({
    name: 'fixture',
    version: '0.0.0',
    detector: { detect: async () => [{ label: 'banana', confidence: 0.9 }] },
  });
  registerTool(server, {
    name: 'say_hello',
    description: 'Says hello.',
    inputSchema: z.object({ name: z.string() }),
    handler: async ({ name }) => {
      console.log('STRAY STDOUT FROM A HANDLER');
      return textResult(`hello ${name}`);
    },
  });
  return server;
});

console.log('STRAY STDOUT AT STARTUP');
