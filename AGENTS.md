# AGENTS.md - Primary Agent Reference

<!-- > Before making any changes follow this workflow:

> 1. Read the file completely
> 2. Check the `README.md` file before running specific commands
> 3. Read the relevant `package.json` to understand available commands
> 4. Never `cd` into directories to run commands -->
> 5. **⚠️ Never commit any changes to git**

## Project Overview

This is a **Kiroween hackathon** submission for the **Skeleton Crew** category: one reusable skeleton template for AI-integrated object detection apps, and two separate applications built from it.

- The spec is the source of truth: `.kiro/specs/skeleton-crew/` (requirements → design → tasks).
- Keep `KIRO_USAGE.md` updated with concrete notes on how Kiro features were used. It feeds the hackathon write-up.

## Project Architecture

One public GitHub repository, organized as a pnpm workspaces monorepo (Node 22 LTS):

```
packages/
  skeleton/          # shared template: detection core + MCP server kit
apps/
  poltergeist-detector/        # Application 1: CLI that compares a before and an after photo and reports what appeared, vanished or moved
  witches-pantry/               # Application 2: web UI, food detection + recipe suggestions (themed as potions)
.kiro/               # specs, hooks, steering, agents, MCP settings (must be committed)
samples/             # sample images (no copyrighted material)
```

- **Detection core:** on-device object detection (TensorFlow.js) with a pluggable model adapter.
- **MCP server kit:** each app runs its own MCP server with the built-in tools (`detect_objects`, `count_objects`) plus its own app-specific tools.
- **Kiro is the agent layer:** there are no paid LLM APIs. Kiro custom agents connect to each app's MCP server and call its tools.

## Rules

- **Language:** TypeScript only.
- **Package manager:** pnpm only. Never use `npm install` or `yarn`, and never commit `package-lock.json` or `yarn.lock`. Run `nvm use` (Node 22) before any command.
- **Dependencies:** add with exact versions (`pnpm add --save-exact`). Apps depend on the skeleton via `workspace:*`.
- **No paid services:** nothing may require a paid API key to build, test, or run.
- **Skeleton stays generic:** apps must not modify files in `packages/`. App-specific logic lives in the app folder.
- **Shared logic:** each app's CLI/UI and its MCP tools must use the same app logic.
- **Never add `.kiro/` or any of its sub-folders to `.gitignore`.** This would disqualify the submission.
- **No third-party trademarks or copyrighted material** in code, assets, or sample images.
- **Testing:** use property-based tests (`fast-check`) for core logic, as listed in the spec.
