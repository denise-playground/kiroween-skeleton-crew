# How Kiro Was Used

Running log for the Kiroween (Skeleton Crew) write-up. Add short, concrete notes as you go: what you did, what Kiro produced, and what changed because of it.

## Kiro IDE / CLI / Web

- Task 1 (workspace scaffold) ran in the Kiro IDE from the spec. Kiro checked each tool's Node requirement before installing and found that Vitest 5.1.0 needs Node 22.12 or later, so `engines.node` was tightened from `>=22` to `>=22.12.0`. The first typecheck failed because `pnpm add -w` only installs the root; a full `pnpm install` was needed to create the `workspace:*` links. Both checks (`pnpm typecheck`, `pnpm test`) pass after that.

## Custom agents

- Spike A (task 3): built a throwaway `spike-hello` agent to learn the real file format. Kiro's current docs showed that the `allowedTools` field I first wrote is CLI 2.x legacy and IDE 1.0 uses `permissions.rules`, so the file was rewritten before testing. With the agent active, a "list the project files" request was refused while `hello` still worked.

## Agent hooks

- 

## Spec-driven development

- Started with a rough idea (one template + two apps) and turned it into a requirements doc in `.kiro/specs/skeleton-crew/requirements.md` using EARS-style acceptance criteria.
- First review of the hackathon rubric changed the spec: "custom agents" and "MCP" were reinterpreted as Kiro development features, and Requirements 8–13 were added (MCP in Kiro, custom agents, hooks, steering, PBT, this log).

- Decided to make Kiro the agent layer: custom agents in Kiro call the project's own MCP servers, so there are no paid LLM APIs. This removed the planned agent runtime and LLM provider code from the spec, which made the skeleton smaller.

- Chose one CLI app and one web UI app on the same skeleton, to show the template works across different interfaces. Added shared requirements so each app's CLI/UI and its MCP tools use the same logic.

- Pasted the official submission rules into Kiro and reviewed them together. This corrected an assumption (two separate GitHub repos) to one repo with two app folders, and added a submission-readiness requirement (license, `.kiro/` committed, deployable web UI).

- Finalized the two apps: "Graveyard Shift Inventory" (CLI photo sorter) and "The Witch's Pantry" (web UI food detection + recipes). Filled in Requirements 5 and 6 and wrote concrete property tests for each app's logic (grouping, recipe matching).

- Researched the MCP TypeScript SDK, TensorFlow.js Node backends, and food-classifier options before writing `design.md`, instead of assuming the first library guess was right. This caught two real issues: local Node (18.20.4) is below the MCP SDK v2's minimum (20+), and COCO-SSD has almost no food classes, which is why the design adds a swappable model-adapter layer and a `Detection` shape that supports both boxes (COCO-SSD) and whole-image labels (MobileNet-style food classifier).

- Wrote `tasks.md` with each task tied to requirement numbers, spikes placed first to test the riskiest assumptions, and a must-have vs stretch split with an explicit cut order.
- Added a stretch feature mid-spec: nutrition, a Curse Level (0 to 100) and Potion Purity labels for the Witch's Pantry, with a "Best match" / "Purest first" toggle. Because it sits in its own requirement (14) marked stretch, the core app does not depend on it, and its scoring rules became property tests (bounds, monotonicity, scaling invariance).

### Spec vs. vibe coding

- 

## Steering docs

- Updated `AGENTS.md` (always loaded by Kiro) with the project overview, architecture, and hard rules: no paid APIs, never ignore `.kiro/`, skeleton stays generic. This keeps the decisions from the spec in every conversation.

## MCP

- Spike A (task 3): a one-tool MCP server was registered in `.kiro/settings/mcp.json` and called from Kiro. Findings: the server only showed up after a window reload, Kiro runs servers from the workspace root so relative `args` work, and `node --import tsx` runs TypeScript with no build step. A raw stdio check confirmed stdout carries only protocol messages and bad input returns an error result without stopping the server. Details are in `design.md`.

- Spike B (task 4): ran COCO-SSD on the pure-JS CPU backend (`@tensorflow/tfjs` 4.22.0) with `jpeg-js` and `pngjs` decoders in Node 22.23.0. Measured ~5.6 s cold model load (one-time) and **4.8–6.4 s per-image inference** on 4 real food photos (avg 5.2 s). Inference is flat across image sizes — the bottleneck is JS execution, not pixel upload. Detection quality on real photos was usable: bowl, broccoli, carrot, orange, banana all detected. Discovered that `tf.browser.fromPixels` in Node needs `{ data: Buffer, width, height }` where `data instanceof Uint8Array` — passing a re-wrapped `Uint8Array` view breaks the internal check. Decision: document `@tensorflow/tfjs-node` as an optional speed-up, not a requirement. Details in `design.md`.

## Property-based testing

- 

## Kiro powers

- 

## Submission checklist (not scored by Kiro, but required by Devpost)

- [ ] Public GitHub repo, license visible in About section, `.kiro/` committed
- [ ] Web UI deployed and reachable at a public URL
- [ ] CLI run instructions in its app README
- [ ] Devpost text description written
- [ ] Demo video (≤3 min, public on YouTube, no copyrighted music, shows real usage)
- [ ] This file finished and linked from the submission
- [ ] Blog post published during the submission period, mentions "Kiroween Hackathon 2026"
- [ ] Social post published, starts with `#KiroweenHackathon26`, written by hand (not AI-generated)

