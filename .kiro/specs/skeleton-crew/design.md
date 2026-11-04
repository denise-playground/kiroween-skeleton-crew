# Design Document

## Overview

The Skeleton is a pnpm workspaces monorepo (Node 22 LTS) with one shared package (`packages/skeleton`) and two applications (`apps/graveyard-shift`, `apps/witches-pantry`). The Skeleton exposes a detector abstraction and an MCP server kit. Each Application wraps the Skeleton with its own CLI or web UI, its own MCP tools, and its own Kiro custom agent (App_Agent). Kiro is the only LLM in the system: it talks to each Application's MCP server as a client.

```
playground/
├── LICENSE                          # MIT, required for Requirement 12
├── README.md                        # root overview, links to both apps
├── KIRO_USAGE.md
├── package.json                     # private root; "packageManager": "pnpm@10.34.9", engines.node >=22.12.0 (Vitest 5 minimum)
├── tsconfig.base.json               # shared strict compiler options, extended by each package
├── vitest.config.ts                 # one workspace-wide test run
├── pnpm-workspace.yaml              # packages: ["packages/*", "apps/*"]
├── .nvmrc                           # 22
├── samples/                         # sample images, no copyrighted material
├── .kiro/
│   ├── settings/mcp.json            # registers both app MCP servers with Kiro
│   ├── agents/
│   │   ├── tool-builder.md          # Dev_Agent
│   │   ├── app-generator.md         # Dev_Agent
│   │   ├── graveyard-shift.md   # App_Agent
│   │   └── witches-pantry.md               # App_Agent
│   ├── hooks/
│   │   ├── test-on-save.json
│   │   ├── tool-registration-check.json
│   │   └── usage-log-on-task.json
│   ├── steering/
│   │   ├── project-structure.md
│   │   ├── adding-a-tool.md         # fileMatch: packages/skeleton/src/mcp/tools/**
│   │   └── adding-an-agent.md
│   └── specs/skeleton-crew/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── packages/
│   └── skeleton/
│       ├── package.json
│       └── src/
│           ├── detector/            # Node-only entry point
│           ├── detector-browser/    # browser-safe entry point
│           ├── mcp/                 # MCP server kit (Node-only)
│           └── agent-template/      # App_Agent markdown template
└── apps/
    ├── graveyard-shift/   # CLI, Node
    │   ├── package.json
    │   ├── README.md
    │   └── src/
    └── witches-pantry/               # web UI, Vite + TypeScript, browser-only
        ├── package.json
        ├── README.md
        └── src/
```

## Research findings that shape this design

- **MCP SDK.** The current TypeScript SDK ships as `@modelcontextprotocol/server` v2 (`McpServer`, `server.registerTool(name, config, handler)`, Zod input schemas, `serveStdio(createServer)`). It requires Node.js 20+ and ESM (`"type": "module"`). ([MCP TypeScript SDK docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-server.md)) The older `@modelcontextprotocol/sdk` v1.x package still exists and is what most third-party tutorials show; this design targets v2 and notes v1 as a fallback if a required Kiro integration only documents v1.
- **Node version.** The default Node on this machine was 18.20.4, below the v2 SDK's minimum. Node 22 is now installed and selected with `nvm use`. The repo pins it with `.nvmrc` and `engines.node`, so anyone cloning it gets a clear error on the wrong version instead of a confusing SDK failure.
- **Package manager.** pnpm 10.34.9, pinned in the root `packageManager` field, with `workspace:*` links between the apps and the skeleton. pnpm 10 blocks dependency install scripts by default, so the root `package.json` lists the packages that need them (for example `esbuild` for Vite) under `pnpm.onlyBuiltDependencies`. Optional native packages such as `@tensorflow/tfjs-node` are deliberately not on that list, so a default install never needs build tools.
- **TensorFlow.js in Node has two backends:** `@tensorflow/tfjs-node` (native C++ bindings, fast, requires node-gyp/build tools and can fail to install on some machines) and the pure-JS CPU backend bundled in `@tensorflow/tfjs` (slower, no native build step). Given the 4-week deadline and "someone else must be able to clone and run this," the design defaults to the pure-JS CPU backend for the CLI app, with `tfjs-node` as an optional, documented speed-up, not a requirement.
- **COCO-SSD's 80 classes include very few foods**: banana, apple, orange, broccoli, carrot, sandwich, hot dog, pizza, donut, cake. It also returns a bounding box per detected object, which fits the photo sorter well.
- **Generic food/fruit/vegetable classifiers (MobileNet-based) return whole-image labels, not boxes.** This is why Requirement 2.6's model-adapter approach and Requirement 6.5's "classification vs. localized detection" distinction exist: the Detector's public shape must support both a bounding box (optional) and a confidence-scored label (always), and the web UI must render both cases.

## Architecture

### Layers

1. **Detector (packages/skeleton/src/detector + detector-browser).** A `Detector` interface with one method, `detect(image, options) -> Detection[]`, implemented by swappable **model adapters**. Two adapters ship in the skeleton:
   - `CocoSsdAdapter` — object detection with boxes, used by Graveyard Shift Inventory.
   - `MobileNetFoodAdapter` — whole-image food/ingredient classification, used by The Witch's Pantry, via `@tensorflow/tfjs` + `@tensorflow-models/mobilenet` (or an equivalent food-oriented classifier), filtered to a curated food-label allowlist maintained in the Witch's Pantry app.
   
   Both adapters are built on `@tensorflow/tfjs`, so they run unchanged in Node and in the browser; only image decoding differs per environment (browser canvas vs. a pure-JS decoder such as `jpeg-js`/`pngjs` in Node). This matters because the Pantry runs the food adapter in two places: in the browser for the UI, and in Node inside its MCP server so Kiro's `detect_objects` calls work on the same model. All callers use the same `Detector` interface (Requirement 2.6) regardless of adapter or environment.

2. **MCP Server Kit (packages/skeleton/src/mcp).** A small wrapper over `@modelcontextprotocol/server`:
   - `createSkeletonServer(options)` returns an `McpServer` pre-registered with `detect_objects` and `count_objects`.
   - `registerTool(server, definition)` is the one function Applications call to add their own tools; it throws at registration time on a duplicate name (Requirement 3.6).
   - Each Application has its own `src/mcp-server.ts` entry that imports the kit, registers its app-specific tool(s), and calls `serveStdio(createServer)`.

3. **Applications.** Each app folder contains:
   - Its interface code (CLI argument parsing, or the Vite web UI).
   - Its app logic module (`sortPhotos.ts` / `suggestRecipes.ts`) — pure functions with no I/O side effects beyond what's passed in, so the CLI/UI and the MCP tool handler both call the exact same function (Requirements 5.10 / 6.14).
   - Its MCP server entry, which registers that app logic as a tool.
   - Its own `package.json`, README, and (for the CLI) a `bin` entry.

4. **Kiro.** Connects to both MCP servers via `.kiro/settings/mcp.json`. Each Application has a matching App_Agent in `.kiro/agents/` scoped to only that app's tools plus the built-ins.

### Data flow — Graveyard Shift Inventory (CLI)

```
scan <folder> --json --move-to out/
        │
        ▼
 CLI (src/cli.ts) ──► reads image files in folder
        │
        ▼
 Detector.detect() (CocoSsdAdapter, pure-JS CPU backend)
        │
        ▼
 sortPhotos(detectionsPerFile) ──► grouped-by-label result
        │
        ├──► human-readable manifest / JSON (stdout)
        └──► optional file copy into out/<label>/
```

The same `sortPhotos` function backs the `sort_photos` MCP tool, which calls `Detector.detect()` per file path it's given and returns the grouped result as structured content.

### Data flow — The Witch's Pantry (web UI)

```
 User drops/selects an image
        │
        ▼
 Detector.detect() (MobileNetFoodAdapter, runs in-browser via tfjs)
        │
        ▼
 Ingredient chip list (editable: remove / add by typing)
        │
        ▼
 suggestRecipes(ingredientNames, recipeDataset)
        │
        ▼
 Recipe cards: matched vs. missing ingredients per recipe
```

The same `suggestRecipes` function backs the `suggest_recipes` MCP tool. The recipe dataset is a static JSON file bundled with the app and imported by both the browser code and the MCP server (Node), so there is exactly one copy of the data.

## Components and interfaces

### `Detection` (shared type, packages/skeleton)

```ts
interface Detection {
  label: string;
  confidence: number;        // 0–1
  box?: {                    // present for localized detectors (COCO-SSD), absent for whole-image classifiers (MobileNet)
    x: number; y: number; width: number; height: number;
  };
}

interface DetectOptions {
  minConfidence?: number;    // default defined per adapter
}

interface Detector {
  detect(image: DetectorImageInput, options?: DetectOptions): Promise<Detection[]>;
}

type DetectorImageInput =
  | { kind: 'filePath'; path: string }        // Node only
  | { kind: 'base64'; data: string; mimeType: string }; // Node or browser
```

- Requirement 2.4 (unsupported format) and 2.3 (threshold filtering) are implemented once, in a shared `filterByConfidence` helper and a shared image-decoding error type, reused by every adapter.
- Requirement 2.5 (load once) is implemented by each adapter lazily loading its model on first `detect()` call and caching the loaded model on the adapter instance.

### MCP Server Kit (packages/skeleton/src/mcp)

```ts
function createSkeletonServer(opts: { name: string; version: string; detector: Detector }): McpServer;

function registerTool<Input>(
  server: McpServer,
  def: { name: string; description: string; inputSchema: ZodSchema<Input>; handler: (input: Input) => Promise<ToolResult> }
): void; // throws SkeletonMcpError if def.name already registered
```

- Built-in tools:
  - `detect_objects({ imagePath, minConfidence? })` → `Detection[]` as structured JSON content.
  - `count_objects({ imagePath, minConfidence? })` → `{ [label]: count }`, computed by running `detect_objects` then grouping (Requirement 3.2); the grouping logic is the same pure function used by Requirement 10.5's property test.
- Error handling: tool handlers are wrapped so a thrown error becomes `{ isError: true, content: [...] }` instead of crashing the process (Requirement 3.5).
- Safety of file access: because a model chooses the arguments, `detect_objects` and `count_objects` only read files with supported image extensions that resolve inside an allowed root (default: the workspace folder), and cap base64 input size. A path outside the allowed root is rejected with a descriptive error.
- Logging: stdout is the protocol channel for stdio servers, so server code logs only to stderr (`console.error`). A lint rule or hook should flag `console.log` under `src/mcp/` and each app's `mcp-server.ts`.

### Graveyard Shift Inventory app logic

```ts
function sortPhotos(
  entries: { filePath: string; detections: Detection[] }[]
): { byLabel: Record<string, string[]>; unlabeled: string[] };
```

- CLI (`src/cli.ts`) built on a minimal argument parser (Node's built-in `util.parseArgs`, no extra dependency) implementing `scan`, `--json`, `--move-to`, `--min-confidence`, `--help`.
- File moves use `fs.cp` (copy, not rename) per Requirement 5.5 ("without deleting the original files").
- Per-file errors are caught around each file's detection call and collected into a report line, so one bad file doesn't stop the scan (Requirement 5.9).

### The Witch's Pantry app logic

```ts
interface RecipeIngredient { name: string; grams: number; }
interface Recipe { id: string; name: string; servings: number; ingredients: RecipeIngredient[]; steps: string[]; flavorText?: string; }

function suggestRecipes(
  haveIngredients: string[],
  recipes: Recipe[],
  options?: { sortBy?: 'match' | 'purity' }          // purity only applies once Requirement 14 is built
): RecipeMatch[];
```

Matching works on ingredient names only, so the core flow does not depend on the nutrition work. Until the stretch work lands, `grams` and `servings` are still present in the dataset (they are cheap to write while authoring recipes) but unused.

- Sorted by match count descending; only recipes with at least one matched ingredient are returned (Requirement 10.7).
- Vite + TypeScript, no framework, to keep the skeleton's UI shell minimal and reusable. Ingredient chips are plain HTML with ARIA labelling for accessibility (Requirement 6.13).
- Recipe dataset: `apps/witches-pantry/src/recipes.json`, written originally for this project (not scraped), themed as "potions" (Requirement 6.15, Requirement 12.6).

### Nutrition, Curse Level, and Potion Purity (stretch, Requirement 14)

Data files, both in `apps/witches-pantry/src/data/`:
- `recipes.json`: recipes with grams per ingredient and a serving count.
- `nutrition.json`: per-100 g values for about 60 to 80 ingredients (`kcal`, `protein`, `carbs`, `fat`, `satFat`, `fibre`, `sodiumMg`, `addedSugar`) plus a `source` field per entry. Values are taken once from USDA FoodData Central, which I expect to be public domain but which must be confirmed before use. The added sugar column is set by hand: 0 for whole foods, and the true value for sugar, honey, and syrups. The app makes no network calls for nutrition.

Pure functions, shared by the UI and the MCP tool (same pattern as `suggestRecipes`):

```ts
interface Nutrition { kcal: number; protein: number; carbs: number; fat: number; satFat: number; fibre: number; sodiumMg: number; addedSugar: number; }

function nutritionPerServing(recipe: Recipe, table: NutritionTable): Nutrition;
function curseLevel(n: Nutrition): number;                       // 0 to 100, integer
function potionPurity(level: number): 'Pure' | 'Murky' | 'Cursed';
function dominantCurse(n: Nutrition): 'sodium' | 'saturatedFat' | 'addedSugar' | null;   // drives the tip
```

Curse Level formula, with weights that are a first draft and will be tuned against the real recipes during implementation:
- Each ratio is the per-serving amount divided by one third of the daily value, clamped to 0 to 1. A third is a rough per-meal share.
- Reference daily values: sodium 2300 mg, saturated fat 20 g, added sugar 50 g, fibre 28 g, protein 50 g. These are my recollection of the FDA Daily Values table and must be checked against the source when implemented.
- `penalty = 100 * (0.35 * sodiumRatio + 0.35 * satFatRatio + 0.30 * addedSugarRatio)`
- `antidote = 0.5 * fibreRatio + 0.5 * proteinRatio`
- `curseLevel = round(penalty * (1 - 0.25 * antidote))`, which is always within 0 to 100, never decreases when sodium, saturated fat, or added sugar rise, and never increases when fibre or protein rise.
- Purity labels: Pure 0 to 33, Murky 34 to 66, Cursed 67 to 100.

UI additions:
- A two-option toggle, "Best match" and "Purest first", using a native radio group so it is keyboard and screen-reader friendly.
- Each recipe card gets a potion-bottle meter (an SVG that fills with the Curse Level, with the number and label also shown as text, so meaning never depends on colour alone), a per-serving nutrition list, and one tip derived from `dominantCurse`.
- A fixed note: "Curse Level is a playful guide based on standard daily values, not medical or dietary advice."
- Wording rule: tips talk about ingredients and amounts ("a lot of salt in this potion, try half and add lemon"), never about weight, bodies, or calorie restriction.

Data validation (runs as a test, Requirement 14.13): for every ingredient, `4*protein + 4*carbs + 9*fat` must be within a stated tolerance of `kcal`. This catches typos in the hand-curated table.

MCP: `suggest_recipes` returns each recipe's nutrition, `curseLevel`, and `purity`, and accepts `sortBy`. No extra tool is needed. The Pantry App_Agent prompt tells the agent to use these fields for advice and to follow the wording rule.

## Data models

- **Detection** — see above.
- **SortResult** — `{ byLabel: Record<label, filePath[]>, unlabeled: filePath[], errors: { filePath, message }[] }`.
- **Recipe** — `{ id, name, servings, ingredients: { name, grams }[], steps: string[], flavorText? }`.
- **RecipeMatch** — `{ recipe, matched: string[], missing: string[], nutrition?, curseLevel?, purity? }`. The last three are filled in once Requirement 14 is built.

## Error handling

| Layer | Failure | Behavior |
|---|---|---|
| Detector | unsupported image format | rejects with `UnsupportedImageError`, caught at every call site, never crashes the process (Req 2.4) |
| MCP tool handler | handler throws | caught by the kit wrapper, returned as `isError: true` tool result (Req 3.5) |
| MCP tool handler | invalid input | rejected by Zod schema validation before the handler runs (Req 3.4) |
| CLI | folder missing / empty | printed message, exit code 1 (Req 5.8) |
| CLI | one file fails mid-scan | collected into `errors[]`, scan continues (Req 5.9) |
| Web UI | unsupported file picked | inline error message, no crash (Req 6.11) |
| Web UI | no recipe matches | "no recipes found" message instead of empty area (Req 6.12) |

## Testing strategy

- **Unit tests** (Vitest) for CLI argument parsing, recipe dataset loading, and adapter error paths.
- **Property-based tests** (`fast-check`), one file per property in Requirement 10:
  - `sortPhotos`: every input file appears in exactly one output group.
  - CLI `--move-to`: source folder file count is unchanged after a move-to run (uses a temp directory fixture, not the real filesystem).
  - `suggestRecipes`: every returned recipe has ≥1 matched ingredient; matched ∪ missing equals the set of the recipe's ingredient names, with empty intersection; adding an ingredient never decreases a recipe's matched count.
  - MCP kit: registering a duplicate tool name always throws; invalid input always rejects before the handler runs.
  - `curseLevel`: always within 0 to 100; monotonic in sodium, saturated fat, and added sugar (non-decreasing) and in fibre and protein (non-increasing).
  - `nutritionPerServing`: scaling every ingredient amount and the serving count by the same factor leaves the result unchanged.
  - Sorting by purity yields non-decreasing Curse Levels.
  - Dataset check (example-based, not property-based): kcal is consistent with protein, carbs, and fat for every ingredient.
- **Manual verification**: MCP Inspector (`pnpm dlx @modelcontextprotocol/inspector <command>`) against each app's server before wiring it into Kiro's `mcp.json`, and a Kiro session exercising each App_Agent end to end on the sample images.

## Deployment

- **Graveyard Shift Inventory**: published as a local CLI; README documents `pnpm install` then `pnpm --filter graveyard-shift start scan <folder>` from the repo root (with an optional `pnpm link --global` to get a bare `graveyard-shift scan <folder>` command). No hosting needed (Requirement 13.3).
- **The Witch's Pantry**: `pnpm --filter witches-pantry build` (Vite) produces static files in `dist/`, deployed via GitHub Pages (a `gh-pages` branch or GitHub Actions workflow), giving judges a working URL per Requirement 6.4 / 13.2.

## Spike B result: detection speed in Node (decided)

Ran COCO-SSD on the pure-JS CPU backend (`@tensorflow/tfjs` 4.22.0) via `jpeg-js` and `pngjs` in Node 22.23.0. Ten synthetic PNG images at sizes from 320×240 to 1920×1080.

**Key findings (measured on 4 real food photos, 408–612 px, Node 22.23.0):**

- Model cold-load time: ~5.6 s (one-time; the adapter caches it).
- Per-image inference: **4.8–6.4 s**, average **5.2 s**. The outlier (6.4 s) was the first post-load call; subsequent images converged to ~4.8 s. Inference time is almost flat across image sizes — the bottleneck is pure-JS computation, not pixel upload.
- Memory: ~54 MB heap, ~234 MB RSS after 4 images.
- Detection quality on real food photos was usable: `bowl`, `broccoli`, `carrot`, `orange`, `banana`, `dining table` were all detected. COCO-SSD's 80 classes include enough food-adjacent labels for the photo sorter use case.
- `tf.browser.fromPixels` in Node requires `{ data: Buffer | Uint8Array, width, height }`. The `data` value must satisfy `instanceof Uint8Array`. Do **not** re-wrap via `new Uint8Array(buf.buffer, offset, len)` — that creates a view whose prototype chain breaks the check. Both `jpeg-js` (with `useTArray: false`, default) and `PNG.sync.read` from `pngjs` return a `Buffer`, which satisfies `instanceof Uint8Array` directly.

**Decision:** ~5 s per image is slow for interactive use but acceptable for a batch CLI (user kicks it off and waits). Document `@tensorflow/tfjs-node` as an **optional speed-up** rather than a requirement so `pnpm install` never needs build tools. The CLI will print a one-time hint suggesting `tfjs-node`. Resizing inputs is skipped — timings are flat across sizes so it would not help.

Implementation note for Task 11 (Node image loading): use `jpeg-js` with default options and `PNG.sync.read` from `pngjs`. Both return a `Buffer` that TF.js accepts directly.

## Open implementation risks to validate early (spike before full build-out)

1. Confirm the pure-JS CPU `@tensorflow/tfjs` backend's COCO-SSD inference speed is acceptable for a CLI scanning dozens of images; fall back to documenting `tfjs-node` as opt-in if too slow.
2. Confirm a food-oriented browser classifier (MobileNet fine-tune or similar) gives usable ingredient labels on real fridge/food photos; if label quality is too noisy, lean more heavily on the editable ingredient chips (Requirement 6.7) as the primary input path rather than a nicety.
3. Verify the exact current Kiro `mcp.json` and custom-agent file schema against the installed Kiro version before building `.kiro/settings/mcp.json` and the agent files, since these formats have changed across recent Kiro releases.

## Spike A result: Kiro configuration formats (decided)

Tested in the Kiro IDE with a throwaway `hello` server and a throwaway agent. Findings:

- **Workspace MCP config:** `.kiro/settings/mcp.json` with `mcpServers.<name>.{command, args, env, disabled}` works. Kiro listed the server and called its tool. On first creation of the `.kiro/settings/` folder the server only appeared after a window reload.
- **Relative paths:** Kiro starts workspace servers with the workspace root as the working directory (the tool reported `cwd` as the repo root). Root-relative `args` such as `packages/skeleton/spike/hello-server.ts` work, so no absolute paths are needed in committed config.
- **Running TypeScript:** `node --import tsx <file>.ts` worked with no build step. Real entries use the same form until a build output exists.
- **stdout rule:** with `serveStdio` from `@modelcontextprotocol/server/stdio`, stdout carried only JSON-RPC and the startup banner went to stderr. Invalid input returned `isError: true` with a Zod message and the server kept running (supports Requirements 3.4, 3.5, 3.7).
- **Custom agent format:** `.kiro/agents/<name>.json` with `name`, `description`, `prompt`, `mcpServers`, `tools`, `permissions.rules`, `includeMcpJson`, and `welcomeMessage`. Select one MCP tool with `"tools": ["@server/tool"]`, and pre-approve it with `{ "capability": "mcp", "match": ["server/tool"], "effect": "allow" }`. `allowedTools` and `toolsSettings` are CLI 2.x legacy and are not read by IDE 1.0, so agent files must not use them.
- **Tool restriction:** with the agent active, a request to list project files was refused, and `hello` still worked. Set `includeMcpJson: false` so the agent sees only its own server.
- **Not verified:** which Node version Kiro uses to launch servers (the server started, but the version was not recorded), and whether the kiro-cli issue about workspace agents not receiving MCP tools (kirodotdev/Kiro #5873, kiro-cli 1.26.2) applies to the CLI. The IDE path works.

Decision: use `.kiro/settings/mcp.json` for the dev-time registration of each app server and one inline-`mcpServers` agent per app in `.kiro/agents/`, using the formats above. Tasks 17 and 21.2 can proceed on this basis.
