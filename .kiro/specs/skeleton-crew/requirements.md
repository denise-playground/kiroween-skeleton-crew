# Requirements Document

## Introduction

This project is a Kiroween hackathon submission for the **Skeleton Crew** category. It provides one reusable skeleton template for building AI-integrated object detection applications, and two distinct applications built from that template.

The skeleton has two core parts:

1. **Detection Core**: on-device object detection that runs for free on the developer's machine.
2. **MCP Server Kit**: a custom Model Context Protocol (MCP) server that wraps the Detection Core as tools and lets each application register its own tools.

**Kiro is the agent layer.** Instead of calling a paid LLM API, Kiro connects to each application's MCP server, and Kiro custom agents use the tools to reason about images. This keeps the project free to run and uses Kiro features directly.

Each application supplies only configuration, app-specific tools, and a Kiro custom agent definition. The applications do not modify skeleton code.

### Decisions

- Repository: one public GitHub repository containing the Skeleton and two separate Application folders, as required by the Skeleton Crew rules. The `.kiro/` directory sits at the repository root.
- Language: TypeScript on Node.js (target: Node 22 LTS), organized as a pnpm workspaces monorepo.
- Cost: no paid LLM APIs. Detection runs on-device and AI reasoning is done by Kiro through MCP.
- MCP implementation: the official MCP TypeScript SDK v2 (`@modelcontextprotocol/server`) using stdio transport. Requires Node.js 20 or later (target: Node 22 LTS).
- Detection: on-device model (TensorFlow.js COCO-SSD), no API key needed.
- Interfaces: Application 1 is a **CLI** and Application 2 is a **web UI**. Using two different interfaces on the same Skeleton shows its flexibility.
- Both Applications also work through Kiro: each has an MCP_Server and an App_Agent. Because Kiro is the agent layer, AI reasoning happens inside Kiro. The CLI and web UI use the Detection Core and app-specific logic directly, without AI reasoning.

- Application 1 ("Poltergeist Detector"): a CLI that compares two photos of the same place, taken before and after something may have changed. It detects objects in both and reports what appeared, what vanished, and what moved, themed as a haunting report ("the poltergeist took your cup"). It uses the bounding boxes that COCO-SSD returns.
- Application 2 ("The Witch's Pantry"): a web UI food app. The user photographs or uploads a food/fridge photo, the app detects food items (editable by the user), and suggests recipes from a local dataset, themed as potions from a witch's pantry.

## Glossary

- **Skeleton**: the shared template package(s) that all applications depend on.
- **Application (App)**: a project under `apps/` that is built from the Skeleton.
- **Detector**: the Skeleton component that runs object detection on an image.
- **Detection**: a single detected object with a label, confidence score, and, when the model localizes it, a bounding box.
- **MCP_Server**: an MCP server built with the Skeleton's MCP Server Kit that hosts Tools for one Application.
- **Tool**: a named, schema-validated function exposed by the MCP_Server.
- **Kiro_Custom_Agent**: a Kiro agent configuration in `.kiro/agents/` that runs inside Kiro.
- **App_Agent**: a Kiro_Custom_Agent that acts as an Application's AI layer by calling that Application's Tools.
- **Dev_Agent**: a Kiro_Custom_Agent that helps the developer extend the Skeleton.
- **Agent_Hook**: a Kiro hook in `.kiro/hooks/` that runs automatically on an IDE or agent event.
- **Steering_File**: a Markdown file in `.kiro/steering/` that gives Kiro project conventions and context.
- **Property_Test**: a test that checks a property holds for many generated inputs, using the `fast-check` library.
- **Usage_Log**: the `KIRO_USAGE.md` file that records how Kiro features were used, for the hackathon write-up.
- **Curse_Level**: a number from 0 to 100 computed per serving of a recipe, where a higher value means more sodium, saturated fat, and added sugar relative to reference daily values, slightly reduced by fibre and protein.
- **Potion_Purity**: the label derived from the Curse_Level: Pure, Murky, or Cursed.

## Requirements

### Requirement 1: Monorepo skeleton structure

**User Story:** As a developer, I want the skeleton and applications kept in separate packages, so that I can build new applications without changing the template.

#### Acceptance Criteria

1. THE project SHALL be a single public GitHub repository organized as a pnpm workspaces monorepo, with the Skeleton under `packages/` and each Application in its own separate folder under `apps/`.
2. THE Skeleton SHALL expose its public API through documented package entry points: one browser-safe entry point and one Node-only entry point, so the web UI never bundles Node-only code.
3. WHEN an Application is built, THE build SHALL succeed without modifying any file in `packages/`.
4. THE Skeleton SHALL include a README that explains how to create a new Application from the template.
5. EACH Application folder SHALL contain its own `package.json` and a README with setup and run instructions for that Application.
6. THE root README SHALL state the required Node.js version and that the project uses pnpm, with install instructions (for example via Corepack or `npm install -g pnpm`).
7. THE Skeleton SHALL NOT require any paid API key to build, test, or run.

### Requirement 2: Object detection core

**User Story:** As an application developer, I want a ready-to-use detector, so that my app can find objects in images without implementing ML code.

#### Acceptance Criteria

1. WHEN the Detector receives a valid image file path or base64-encoded image, THE Detector SHALL return a list of Detections.
2. THE Detector SHALL include a label and a confidence score between 0 and 1 for each Detection, and SHALL include a bounding box (x, y, width, height) when the active model localizes the object. Whole-image classification models SHALL return Detections without a bounding box.
3. WHERE a minimum confidence threshold is configured, THE Detector SHALL exclude Detections below that threshold.
4. IF the input is not a supported image format, THEN THE Detector SHALL return a descriptive error without crashing the process.
5. THE Detector SHALL load the model once and reuse it across detection calls.
6. THE Detector SHALL be usable from the MCP_Server, a CLI Application, and a web UI Application through the same public API.

### Requirement 3: Custom MCP server kit

**User Story:** As an application developer, I want an MCP server kit that hosts detection tools and my own tools, so that Kiro can use them.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a built-in `detect_objects` Tool that wraps the Detector.
2. THE MCP_Server SHALL expose a built-in `count_objects` Tool that returns counts of Detections grouped by label.
3. THE MCP_Server SHALL allow an Application to register additional Tools with a name, description, input schema, and handler.
4. WHEN a Tool is called with input that fails schema validation, THE MCP_Server SHALL return a validation error describing the invalid fields.
5. IF a Tool handler throws an error, THEN THE MCP_Server SHALL return an error result to the caller and keep running.
6. IF an Application registers a Tool whose name already exists, THEN THE MCP_Server SHALL reject the registration with a descriptive error at startup.
7. THE MCP_Server SHALL be runnable over stdio.

### Requirement 4: Kiro as the agent layer

**User Story:** As a developer, I want Kiro to use my custom MCP servers through custom agents, so that my applications get AI reasoning without paid APIs.

#### Acceptance Criteria

1. THE project SHALL include a workspace `.kiro/settings/mcp.json` entry for each Application's MCP_Server.
2. WHEN Kiro connects to an Application's MCP_Server, THE MCP_Server SHALL list both the built-in Tools and the Application's Tools.
3. EACH Application SHALL include an App_Agent with a system prompt describing the Application's purpose and access only to that Application's Tools.
4. THE project SHALL include sample images in a `samples/` folder that App_Agents can pass to `detect_objects`.
5. THE Skeleton SHALL include an App_Agent template that new Applications copy and customize.

### Requirement 5: Application 1 – Poltergeist Detector (CLI before/after scene comparison)

**User Story:** As someone who shares a space or wants to check a room after a change, I want to compare two photos of the same place and see what appeared, vanished or moved, so that I can tell what changed without studying both photos by eye.

#### Acceptance Criteria

1. THE Application SHALL register at least one app-specific Tool using the MCP Server Kit: `compare_scenes`, which takes the paths of a "before" image and an "after" image and returns the objects that appeared, vanished, moved, and stayed in place.
2. THE Application SHALL include an App_Agent that uses the built-in Tools and `compare_scenes`, with a poltergeist-investigator persona (for example, reporting results as a "haunting report").
3. WHEN the user runs the CLI with `compare <before> <after>`, THE CLI SHALL detect objects in both images and print a human-readable report with one section each for appeared, vanished, and moved objects, and the count of objects that stayed in place.
4. WHERE the `--json` flag is given, THE CLI SHALL print the same results as JSON instead of the human-readable report.
5. WHERE the `--min-confidence <value>` flag is given, THE CLI SHALL pass that value to the Detector as the minimum confidence threshold.
6. WHERE the `--tolerance <fraction>` flag is given, THE CLI SHALL use it as how far an object must move, as a fraction of its own size, before it is reported as moved.
7. WHEN the user runs the CLI with `--help` or with no arguments, THE CLI SHALL print usage instructions that say the two photos should be taken from the same spot.
8. IF either image path does not exist, is outside the allowed folder, or is not a supported image, THEN THE CLI SHALL print a message that names that image and exit with a non-zero exit code.
9. IF neither image contains any detection, THEN THE CLI SHALL say that nothing was detected, instead of printing an empty report.
10. THE CLI and the `compare_scenes` Tool SHALL share the same app logic, so results are the same in the terminal and in Kiro.

### Requirement 6: Application 2 – The Witch's Pantry (web UI food + recipes)

**User Story:** As a user, I want to photograph my food or fridge and get recipe ideas for what I actually have, so that I can decide what to cook without manually listing ingredients.

#### Acceptance Criteria

1. THE Application SHALL register at least one app-specific Tool using the MCP Server Kit: `suggest_recipes`, which takes a list of ingredient names and returns matching recipes from a local recipe dataset.
2. THE Application SHALL include an App_Agent that uses the built-in Tools and `suggest_recipes`, with a witch's-pantry persona (for example, presenting recipes as "potions").
3. THE web UI SHALL run detection entirely in the browser without any paid service or backend server.
4. THE web UI SHALL build to static files that can be deployed to a free static host (for example GitHub Pages), so judges can open a working app URL.
5. WHEN the user selects or drops an image, THE web UI SHALL display the image with a bounding box and label for each Detection that has a localized region, and a labelled tag for each whole-image classification result.
6. THE Detector used by this Application SHALL use a food-capable model (for example an image classifier covering common fruits, vegetables, and pantry items), configured as a Skeleton model adapter rather than a change to the Skeleton's Detector interface.
7. THE web UI SHALL show detected ingredients as an editable list of chips: the user SHALL be able to remove an incorrectly detected ingredient and add a missing one by typing its name.
8. WHEN the ingredient list changes (by detection, removal, or manual addition), THE web UI SHALL re-run `suggest_recipes` and display the matching recipes.
9. EACH displayed recipe SHALL show which of the user's ingredients it matches and which ingredients are missing.
10. WHILE detection or recipe matching is running, THE web UI SHALL show a loading indicator.
11. IF the selected file is not a supported image, THEN THE web UI SHALL show a descriptive error message.
12. IF no recipe matches any detected ingredient, THEN THE web UI SHALL show a message that no recipes were found, instead of an empty result area.
13. THE web UI SHALL be keyboard accessible, and each Detection and recipe result SHALL also be exposed as text so results are available to screen readers.
14. THE web UI and the `suggest_recipes` Tool SHALL share the same recipe-matching logic, so results are the same in the browser and in Kiro.
15. THE local recipe dataset SHALL be original or from a source whose license permits redistribution in an open source repository, per Requirement 12.

### Requirement 7: Developer custom agents

**User Story:** As a developer, I want Kiro custom agents specialized for this skeleton, so that extending the template is fast and consistent.

#### Acceptance Criteria

1. THE project SHALL include a `tool-builder` Dev_Agent that scaffolds a new MCP Tool (handler, input schema, registration, and test) following the skeleton conventions.
2. THE project SHALL include an `app-generator` Dev_Agent that creates a new Application under `apps/` from the Skeleton, including its MCP config entry and App_Agent.
3. EACH Dev_Agent SHALL reference the relevant Steering_Files and grant only the tools it needs.

### Requirement 8: Agent hooks

**User Story:** As a developer, I want repetitive checks automated with hooks, so that quality stays consistent without manual steps.

#### Acceptance Criteria

1. THE project SHALL include an Agent_Hook that runs the affected package's tests when a TypeScript source file is saved.
2. THE project SHALL include an Agent_Hook that, when a new Tool file is created, checks that the Tool is registered and documented.
3. THE project SHALL include an Agent_Hook that, after a spec task completes, adds a short entry to the Usage_Log.

### Requirement 9: Steering files

**User Story:** As a developer, I want project conventions in steering files, so that Kiro's generated code matches the skeleton architecture.

#### Acceptance Criteria

1. THE project SHALL include a Steering_File describing the project structure and tech stack.
2. THE project SHALL include a Steering_File describing how to add a Tool to the MCP_Server.
3. THE project SHALL include a Steering_File describing how to create an App_Agent.
4. WHERE a Steering_File applies only to specific files, THE Steering_File SHALL use `fileMatch` inclusion so it loads only when those files are in context.

### Requirement 10: Property-based testing

**User Story:** As a developer, I want property-based tests for the core logic, so that edge cases missed by example-based tests are caught.

#### Acceptance Criteria

1. THE project SHALL include a Property_Test verifying that the sum of `count_objects` counts equals the number of Detections for any list of Detections.
2. THE project SHALL include a Property_Test verifying that every Detection returned with a confidence threshold has a confidence greater than or equal to that threshold.
3. THE project SHALL include a Property_Test verifying that registering any Tool name twice is always rejected.
4. THE project SHALL include a Property_Test verifying that for any input that fails a Tool's schema, the MCP_Server returns a validation error and does not call the handler.
5. THE Poltergeist Detector SHALL include a Property_Test verifying that, for any two lists of Detections, every Detection in the "before" list is reported exactly once as vanished, moved, or unchanged, and every Detection in the "after" list is reported exactly once as appeared, moved, or unchanged.
6. THE Poltergeist Detector SHALL include a Property_Test verifying that swapping the "before" and "after" lists swaps the number of appeared and vanished objects for every label, and that comparing a scene with itself reports nothing appeared, vanished or moved.
7. THE Witch's Pantry SHALL include a Property_Test verifying that every recipe returned by `suggest_recipes` matches at least one of the given ingredients.
8. THE Witch's Pantry SHALL include a Property_Test verifying that adding an ingredient to the list never decreases the number of matched ingredients for any recipe.
9. THE Witch's Pantry SHALL include a Property_Test verifying that, for any recipe and ingredient list, the matched and missing ingredient lists together equal the recipe's full ingredient list, with no overlap.
10. THE Witch's Pantry SHALL include a Property_Test verifying that the Curse_Level is always between 0 and 100 for any non-negative nutrition values.
11. THE Witch's Pantry SHALL include a Property_Test verifying that increasing sodium, saturated fat, or added sugar never lowers the Curse_Level, and increasing fibre or protein never raises it.
12. THE Witch's Pantry SHALL include a Property_Test verifying that multiplying every ingredient amount and the serving count by the same factor leaves the per-serving nutrition unchanged.
13. THE Witch's Pantry SHALL include a Property_Test verifying that sorting recipes by purity produces a list whose Curse_Levels never decrease.

### Requirement 11: Kiro usage write-up

**User Story:** As a hackathon participant, I want a running log of how I used Kiro, so that I can write a clear submission write-up for the judges.

#### Acceptance Criteria

1. THE project SHALL include a Usage_Log with sections for: Kiro IDE/CLI/Web, custom agents, agent hooks, spec-driven development, steering, MCP, property-based testing, and Kiro powers.
2. THE Usage_Log SHALL include concrete examples, such as a problem a hook or property test caught, rather than only feature lists.
3. THE Usage_Log SHALL include a comparison between spec-driven development and vibe coding based on this project.
4. THE project SHALL keep this spec (requirements, design, tasks) in `.kiro/specs/skeleton-crew/`.

### Requirement 12: Hackathon submission readiness

**User Story:** As a hackathon participant, I want the repository to meet every submission rule, so that the project is not disqualified and judges can test it easily.

#### Acceptance Criteria

1. THE repository SHALL include an OSI-approved open source `LICENSE` file at the root, so GitHub shows it in the About section.
2. THE repository SHALL include the `.kiro/` directory at the root with the specs, hooks, and steering files.
3. THE `.gitignore` file SHALL NOT exclude the `.kiro/` directory or any of its sub-folders.
4. THE repository SHALL include all source code, assets (including sample images), and instructions needed to run both Applications.
5. THE root README SHALL describe the features of the Skeleton and both Applications, link to the deployed web UI, and explain how to run the CLI Application.
6. THE repository SHALL NOT include third-party trademarks or copyrighted material, including in sample images, unless permission is documented.

### Requirement 13: Devpost submission package

**User Story:** As a hackathon participant, I want a checklist of everything the Devpost submission needs, so that nothing is missing at deadline time and I can qualify for bonus prizes.

#### Acceptance Criteria

1. THE submission SHALL include the public GitHub repository URL described in Requirement 12.
2. THE submission SHALL include a URL to the deployed, working web UI Application.
3. THE submission SHALL include instructions for running the CLI Application, since it has no deployed URL.
4. THE submission SHALL include a text description of the project's features and functionality for the Devpost form.
5. THE submission SHALL include a demo video that is 3 minutes or under, uploaded to YouTube as public, showing the project working end-to-end on the device it was built for, with no third-party trademarks or copyrighted music.
6. THE submission SHALL include the Kiro usage write-up (Requirement 11 / `KIRO_USAGE.md`) covering IDE/CLI/Web usage, custom agents, agent hooks, spec-driven development, steering, MCP, property-based testing, and Kiro powers.
7. THE submission SHALL select the Skeleton Crew category in the Devpost form.
8. WHERE the entrant wants to qualify for the Blog Post Bonus Prize, THE submission SHALL include a link to a public blog post on a third-party platform, published during the hackathon submission period, mentioning "Kiroween Hackathon 2026".
9. WHERE the entrant wants to qualify for the Social Blitz Bonus Prize, THE submission SHALL include a link to a public social media post that starts with the hashtag `#KiroweenHackathon26` and contains original commentary rather than AI-generated text.
10. WHERE the entrant wants to qualify for the Best Demo Bonus Prize, THE demo video SHALL be produced with extra attention to clarity and memorability, since this prize is judged on the Presentation criterion alone among the top 10% of overall scores.
11. IF login credentials are required to test the web UI Application, THEN THE submission SHALL include those credentials and instructions in the private Devpost submission form fields, not in the public repository.

### Requirement 14: Nutrition, Curse Level, and Potion Purity (stretch)

**User Story:** As a user choosing what to cook, I want to see how nutritious each recipe is as a playful Halloween "curse level", so that I can pick lighter recipes without reading a nutrition label.

**Priority:** stretch. This requirement is built only after the core Witch's Pantry flow (detect, edit ingredients, suggest recipes) works end to end.

#### Acceptance Criteria

1. EACH recipe in the local dataset SHALL list every ingredient with an amount in grams and SHALL state the number of servings.
2. THE Application SHALL include a local ingredient nutrition table with values per 100 g for calories, protein, carbohydrates, fat, saturated fat, fibre, sodium, and added sugar, plus a note on the source of each entry.
3. THE nutrition table SHALL come from a source whose license permits redistribution in an open source repository, and the source SHALL be credited in the README.
4. THE Application SHALL compute per-serving nutrition for every recipe from its ingredient amounts and the nutrition table, using a function shared by the web UI and the MCP_Server.
5. THE Application SHALL compute a Curse_Level from 0 to 100 per serving, based on sodium, saturated fat, and added sugar relative to reference daily values, reduced by no more than 25% for fibre and protein.
6. THE Application SHALL map the Curse_Level to a Potion_Purity label: Pure (0 to 33), Murky (34 to 66), or Cursed (67 to 100).
7. WHEN recipes are displayed, THE web UI SHALL show each recipe's Curse_Level, Potion_Purity label, and per-serving calories, protein, fibre, sodium, sugar, and fat.
8. THE web UI SHALL provide a toggle with two options, "Best match" and "Purest first", that sorts the recipe list by ingredient match or by ascending Curse_Level.
9. WHERE a recipe's Curse_Level is high, THE web UI SHALL show a short tip naming the nutrient that contributes most to it.
10. THE web UI SHALL show a note that the Curse_Level is a playful guide based on standard daily values and is not medical or dietary advice.
11. THE `suggest_recipes` Tool SHALL return each recipe's per-serving nutrition, Curse_Level, and Potion_Purity, and SHALL accept an optional `sortBy` value of `match` or `purity`, so that the App_Agent can give advice based on them.
12. THE Curse_Level and Potion_Purity SHALL NOT use weight-loss, body-shape, or calorie-restriction language in the UI, tips, or App_Agent prompt.
13. THE dataset SHALL pass an automated check that each ingredient's calories are consistent with its protein, carbohydrate, and fat values within a stated tolerance.
