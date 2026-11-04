---
inclusion: always
---

# Project Structure

## Stack

- TypeScript only, strict mode. Shared options live in `tsconfig.base.json`; each package extends it.
- Node 22 (`.nvmrc`), pnpm workspaces. Run `nvm use` first. Use pnpm only, with exact versions (`pnpm add --save-exact`).
- Tests: Vitest for unit tests and `fast-check` for property-based tests. Run with `pnpm test` (`vitest run`). Typecheck with `pnpm typecheck`.
- Detection: TensorFlow.js (COCO-SSD and a MobileNet-style food classifier) behind a `ModelAdapter`.
- MCP: each app runs its own stdio MCP server. Kiro custom agents call it. No paid APIs.

## Layout

```
packages/skeleton/        shared template (package name @skeleton-crew/core)
apps/graveyard-shift/     CLI photo sorter
apps/witches-pantry/      web UI, food detection and recipes
samples/                  own photos only
.kiro/                    specs, steering, hooks, agents, settings (always committed)
```

Tests sit next to the code as `*.test.ts` under `src/`.

## The skeleton stays generic

- `packages/skeleton` knows nothing about photos, recipes, or any single app.
- Apps never edit files under `packages/`. App-specific logic lives in the app folder.
- Apps import the skeleton through `@skeleton-crew/core` (`workspace:*`).
- The browser-safe entry point must not import Node modules (`fs`, `path`, etc.). Node-only code (image loading, MCP server kit) goes in the Node entry point.
- Each app's CLI or UI and its MCP tools call the same app logic. Do not duplicate it.

## Naming

- Files and folders: `kebab-case` (`sort-photos.ts`, `sort-photos.test.ts`).
- Types, interfaces, classes: `PascalCase`. Functions and variables: `camelCase`.
- MCP tool names: `snake_case` (`detect_objects`, `sort_photos`).
- ESM only (`"type": "module"`). Use `.js` extensions in relative imports if the tsconfig requires them.

## Behavior rules

- Log only to stderr in MCP servers. stdout belongs to the protocol.
- Validate tool input with Zod before the handler runs. A thrown error becomes an error result, not a crash.
- Never commit from the agent. Never add `.kiro/` to `.gitignore`.
