# @skeleton-crew/core

The shared skeleton for AI-integrated object detection apps. It holds a detection core and a
Model Context Protocol (MCP) server kit. It knows nothing about photos, recipes or any single app.

Apps depend on it as `"@skeleton-crew/core": "workspace:*"` and never edit files in this folder.

## What is inside

| Part | What it gives you |
|---|---|
| Detection core | `Detector`, `Detection`, `ModelAdapter`, `filterByConfidence`, `countByLabel`, `UnsupportedImageError` |
| Model adapters | `CocoSsdAdapter` (boxes, 80 classes) and `MobileNetFoodAdapter` (whole-image labels, filtered to an allowlist you pass in) |
| Node image loading | `createNodeImageDecoder`: JPEG and PNG, only inside an allowed folder, with size caps |
| MCP server kit | `createSkeletonServer` (comes with `detect_objects` and `count_objects`), `registerTool`, `serveOverStdio` |
| App_Agent template | `agent-template/app-agent.template.json` |

## Two entry points

- `@skeleton-crew/core` is browser-safe. It imports no Node modules, so a web app can bundle it. A test bundles it for the browser to keep it that way.
- `@skeleton-crew/core/node` is Node-only (file access, the MCP kit). Use it from CLIs and MCP servers.

The adapters take an **image decoder** as a parameter, because decoding is the one thing that differs between environments. In Node use `createNodeImageDecoder`. In a browser, write a decoder that draws the image to a canvas and returns its pixels.

## Create a new app

1. **Make the folder** `apps/<your-app>/` with a `package.json` that has `"type": "module"` and the dependency `"@skeleton-crew/core": "workspace:*"`. Copy `tsconfig.json` from an existing app. Run `pnpm install` from the repo root to link it.
2. **Write the app logic** as plain functions in `apps/<your-app>/src/`. The CLI or UI and the MCP tool must both call these same functions, so results match everywhere.
3. **Write the MCP server entry**, `apps/<your-app>/src/mcp-server.ts`:

   ```ts
   import { CocoSsdAdapter, Detector } from '@skeleton-crew/core';
   import { createNodeImageDecoder, createSkeletonServer, registerTool, serveOverStdio, z } from '@skeleton-crew/core/node';

   const decodeImage = createNodeImageDecoder({ allowedRoot: 'samples' });
   const detector = new Detector(new CocoSsdAdapter({ decodeImage }));

   serveOverStdio('my-app', () => {
     const server = createSkeletonServer({ name: 'my-app', version: '0.1.0', detector });
     registerTool(server, {
       name: 'my_tool', // snake_case
       description: 'What the tool does, written for a model.',
       inputSchema: z.object({ imagePath: z.string() }),
       handler: async ({ imagePath }) => ({ content: [{ type: 'text', text: `looked at ${imagePath}` }] }),
     });
     return server;
   });
   ```

4. **Register the server with Kiro** in `.kiro/settings/mcp.json`. The working folder is the repo root, so use root-relative paths:

   ```json
   { "mcpServers": { "my-app": { "command": "node", "args": ["--import", "tsx", "apps/my-app/src/mcp-server.ts"] } } }
   ```

5. **Create the App_Agent**: copy `agent-template/app-agent.template.json` to `.kiro/agents/<your-app>.json` and fill in every `{{PLACEHOLDER}}` (app name, description, persona, your tool name, the MCP entry path, a welcome message). The template gives the agent only this app's tools.
6. **Test it**: run `pnpm test` and `pnpm typecheck`, check the server with `pnpm dlx @modelcontextprotocol/inspector node --import tsx apps/my-app/src/mcp-server.ts`, then ask the agent in Kiro to use a tool.

## Rules to know

- **Tool names are snake_case** (lower-case letters, digits, underscores, starting with a letter). `registerTool` rejects anything else, and rejects a name that is already registered, including `detect_objects` and `count_objects`.
- **Build input schemas with the `z` exported from `@skeleton-crew/core/node`**, so your app and the kit use the same Zod version. Keep them plain (no `.transform()` or `.default()`). The SDK checks input against the schema before the handler runs, so the handler gets exactly what the caller sent.
- **stdout belongs to the protocol.** `serveOverStdio` sends `console.log` to stderr, but still log with `console.error` in your own code.
- **A handler that throws** becomes an error result and the server keeps running.
- **Detection is slow on the default backend.** It uses pure JavaScript TensorFlow.js, about 5 seconds per image for COCO-SSD on a laptop. `@tensorflow/tfjs-node` is an optional, much faster backend, but it needs build tools to install.
- **The food classifier is best-effort.** `MobileNetFoodAdapter` uses ImageNet labels, which lack tomato, onion, carrot, garlic and avocado. Treat its output as suggestions the user can edit.
- **Model download behind a proxy**: if loading a model fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, run Node with `--use-system-ca` (for example `NODE_OPTIONS=--use-system-ca`).

## Tests

`pnpm test` from the repo root runs everything offline. The tests that load the real models are skipped unless you set `RUN_MODEL_TESTS=1`.
