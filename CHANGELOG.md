# Changelog

Release history, not current operating instructions. Start with [Getting Started](docs/GETTING-STARTED.md) and [Migration](docs/MIGRATION-3.0.md) for current behavior.

## 3.2.1 — 2026-09-09

- Synchronize each release-stage branch with its remote using fast-forward-only semantics before evaluating publication gates.
- Re-evaluate synchronized SHAs and continue within the same invocation when the mismatch was only stale local state, avoiding unnecessary repeated `$agm-release` commands.
- Preserve safe stops for genuine remote divergence and re-confirm Production when its concrete candidate, destination or tag changes.

## 3.2.0 — 2026-09-09

- Define nine exact agm-release sequences with explicit prerequisites, owner-specific patching, resume checkpoints, Production confirmation and completion evidence.
- Restrict versioned release notes, release.md and tags to the Production candidate; Inhouse-only work updates its owner, changelog and project index.
- Add verified .NET Global Tool discovery/install instructions, PATH fallback and source-backed compatibility diagnosis for environment notes and planned tag metadata.
- Document model-independent execution for the requested model families without claiming cross-model behavioral certification; the external CLI and installed target contracts are not migrated by this package change.

## 3.1.0 — 2026-09-09

- Add agm-release with tool readiness and missing-tool installation guidance, indexing, patch preparation, pipeline publication, Production promotion, and full/environment release flows.
- Require confirmation of the concrete candidate before Production branch and annotated tag publication; pipeline production stops at the verified Inhouse checkpoint.
- Document every command, version owner, push destination, resume behavior, and confirmation boundary in the README.

## 3.0.1 — 2026-09-08

- Package the current v3 skills and documentation for local Codex plugin installation
- Clarify that the target repository AGENTS.md governs project work; the bundled contract is an installation source, not an automatic override
- Preserve the owner-supplied bootstrap AGENTS.md bytes and document remaining CLI-template/runtime compatibility limits; this patch does not migrate product repositories

## 3.0.0 — 2026-09-08

Major redesign of governance and runtime behavior.

- Replaced bootstrap project AGENTS with the complete owner-supplied canonical release/deployment/portable-recording contract; synchronized bundle hashes, thin pointers and supporting documentation
- Aligned group-B complete working-copy publication, separate content/version/final-audit commits, exact remote tag checkpoints and non-blocking pipeline status reporting

- Removed public agm-design, agm-simulate, agm-review and agm-history aliases and generated commands. Existing audit evidence/internal history tooling remain available.
- Design is now passive in all remaining operations: proactive supported recommendations, visible evidence gaps, separated facts/assumptions, justified confidence and conditional provisional advice; no fabricated details or automatic implementation.

- Intent-first hooks: unrelated questions and quoted commands do not open workflows; SessionStart is silent.
- Lazy state: no question task trees, one task.md for new tracked runs, optional separate reports, legacy history retained.
- Persistent confirmed user/workspace identity without the default daily prompt; authority remains separate.
- Prompt revisions require meaningful requester-backed changes; identical bodies are idempotent.
- Proportional verification with matching-evidence reuse; no automatic third-run full QA or one-correction-only policy for v3.
- Managed SQL context is metadata/SELECT only; database writes and routine execution are prohibited.
- Canonical bootstrap bundle and guarded idempotent installer, branch/version/release knowledge, main 1.0.0 and library 0.0.x distinction.
- Model profiles outcome/guided/bounded; provider labels are not capability rankings.
- Golden portability: restore 31 hash-proven LF files and refresh two curated-reference hashes to reviewed repository text; raw evidence hash checks remain strict.
- Breaking changes and compatibility details: docs/MIGRATION-3.0.md.
- Reorganized Thai user documentation into Getting Started, operation reference, 12 beginner recipes, workflows, release, troubleshooting and maintainer guides. Installation commands are separate from chat instructions and internal runtime commands.
- Added documentation link/anchor, example alias/action and distributed-mirror validation; updated generated help to match v3 execution authorization.

### Carried-forward database-context work

- Added `references/db-schema-context.md` as the owner of database evidence: owner DDL lookup by object name, the mandatory one-hop expansion from a stored procedure to the tables and `LUT_*` lookups it touches, and an ordered SP → table trace from a failing call to the exact condition, `THROW` code, and column that raised it.
- Routed that gate as a conditional reference from `analyze`, `diagnose`, `simulate`, `plan`, `design`, `architect`, `review`, `be`, `sql`, `qa`, `prompt`, and `execute`, so stored-procedure work can no longer be diagnosed or reviewed from application code alone.
- Added a `Database source of trust` gate to `backend-engineer.md`, made `analysis-discipline.md` name the db-schema path before declaring evidence missing, and gave `diagnose` an explicit instruction to open the procedure and its tables instead of stopping at the caller.
- Re-baselined token-coverage budgets for the added mandatory context and added a `diagnose-be-stored-procedure-light` coverage scenario plus contract regression tests.

## 2.1.0 - 2026-07-24

- Added a read-only stdio MCP server (`skills/agrimap-agent-skills/scripts/mcp-server.mjs`, declared in `gemini-extension.json` under `mcpServers.agrimap`) so Gemini can load bundled AgriMap contract and reference files that its workspace-sandboxed file tools cannot reach.
- Regenerated the Gemini `/agm-*` commands to load `lifecycle-core.md`, their operation entrypoint, and conditional references through the `read_reference` MCP tool instead of an unreachable workspace-relative path; Codex and Claude activation paths are unchanged.
- Wired the MCP server into package validation and added a unit test that exercises the initialize/list/call handshake, `../`-prefixed reference resolution, and traversal refusal.

## 2.0.0 - 2026-07-24

- Redefined passive capabilities as embedded supporting skills that contribute relevant knowledge, understanding, criteria, and decisions to both read-only and already-authorized write work without selecting the operation, granting write authority, or expanding scope.
- Renamed implicit action fallback from `explicit-or-passive` to `explicit-or-safe-default`, constrained every safe-default action to `product-read-only`, and added generator validation plus regression coverage for that boundary.
- Clarified that Main is the primary writer, integration owner, and accountability point for a coupled assignment rather than a global prohibition on bounded Subagents or independent QA verification.

## 0.1.8 - 2026-07-24

- Made concise task artifacts, current memory, and append-only audit logs mandatory for every activated operation at `light`, `standard`, and `regulated` depth; depth now controls coordination and QA rather than persistence.
- Added generated `AGRIMAP_EXPLICIT_ALIAS` markers so provider command expansion cannot hide a direct alias invocation from the activation gate.

## 0.1.7 - 2026-07-18

- Assigned cosmetic SQL indentation, alignment, wrapping, and whitespace to SQLFluff instead of model hand-formatting; semantic SQL structure remains enforced.
- Added an exact `format_set` gate: every changed SQL path must be formatted and the identical complete set validated, with `formatted N/N` reported before handoff.
- Kept resolved SQL slices of at most three artifacts direct/light in `agm-create-feature`; only unresolved or material persisted-data decisions escalate to `agm-create-prompt`.

## 0.1.6 - 2026-07-18

- Changed SQLFluff setup to lazy installation: format directly, install only on command-not-found, then retry once; parser/format errors never reinstall.
- Removed co-loaded prose duplication from BE/FE pattern and prompt-delegation references while retaining canonical owners and route-contract tests for every cross-reference.

## 0.1.5 - 2026-07-18

- Added a deterministic first-use SQLFluff prerequisite that installs when missing, verifies the command, and blocks SQL writes on failure without wrapping the formatter.
- Required temporary probes to use the OS temp directory with guaranteed cleanup; workspace `.tmp-*` directories are forbidden and ignored only as a safety net.

## 0.1.4 - 2026-07-18

- Made `agm-analyze` light output CLI-readable and required real project code, local db-schema, and representative examples/data shapes before conclusive database analysis.
- Exposed all five SQL refactor modes in the operation input and first missing-mode response instead of returning a recommendation alone.
- Standardized writer formatting on direct `sqlfluff format` commands for one file or a folder, with prerequisite installation only when missing and validation after formatting.
- Made a nonzero folder-format run explicitly incomplete: isolate changed files, correct only in-scope parse defects, and rerun the folder command before handoff; QA remains product-read-only and never runs or installs SQLFluff.

## 0.1.3 - 2026-07-18

- Made conditional-reference loading a fail-closed activation gate before inspection, tools, writes, or delegation across generated provider entrypoints.
- Added deterministic SQL contract preflight with verified golden selection, explicit `[agrimap_app]` enforcement, and an executable guarded `LUT_APP_MESSAGES` insert template.
- Closed SQL verification to shipped skill scripts and static inspection; ScriptDom, database/runtime checks, and QA-mode self-promotion are forbidden.
- Prevented direct `agm-create-feature` from invoking QA or agents and routed persisted-data contracts to `agm-create-prompt` before product writes.
- Reconciled the SQL golden manifest, removed two proven byte-identical copies, and bumped the package version so Codex does not retain stale aliases.

## 0.1.2 - 2026-07-16

- Made the normalized SQL golden contract authoritative over inconsistent project structure for new artifacts, with one object per canonical domain path and exact `messages.sql` handling.
- Added AgriMap lookup/general key types, audit fields, stored-procedure suffixes, guarded `LUT_APP_MESSAGES (ID, DESCR)` inserts, a deterministic SQL artifact validator, and cross-provider SQL scenarios.
- Captured the host-reported model in session hook context and propagated it to requester identification instead of reporting `unknown` when the host supplies a model.
- Standardized stored-procedure section comments for validation gates, transaction boundaries, numbered business steps, and `PO_DATA` returns, with deterministic validation.
- Distinguished SQL session actor (`SESSION_USER_ID`) from target subject (`USER_ID`) and documented their audit-versus-filter usage.
- Made QA direct/light by default, renamed tracked fast QA to light QA, restricted full selection to explicit triggers, and added a closed QA execution allowlist that forbids database/runtime validation.
- Made QA depth, mode, tools, and acceptance provider-neutral so reasoning-heavy model labels cannot silently broaden verification.
- Made `agm-create-feature` light/direct-only with no brief, checklist, QA, result, memory, or log artifacts; tracked feature work now starts with `agm-create-prompt`.
- Defined tracked feature artifact ownership and order as prompt contract (`brief.md`/`checklist.md`) → execution → QA (`qa.md`) → final Leader closure (`result.md`), with command-level premature-artifact guards.
- Added provider-neutral checkpoint compaction budgets so Fable/Claude detail does not produce larger memory/log state than Codex/GPT or Gemini.
- Split alias loading into `lifecycle-core.md` plus exactly one operation contract, with glossary/discipline references conditional.
- Added enforced `light|standard|regulated` workflow depth: light is stateless, standard omits separate QA, and regulated retains the full gate.
- Replaced atomic-task checkpoint guidance with four milestone types and command-level rejection of created/terminal checkpoint events.
- Added the curated request-value normalization golden contract for both BE main/library and routed analyze, diagnose, refactor-be, and QA to it conditionally.
- Reduced subagent fallback progress from per-step heartbeat writes to meaningful state transitions, with native threads remaining the primary trace.
- Added a lightweight lane for bounded work: no requester receipt, task artifacts, memory/log writes, separate QA, or delegation; scope growth promotes to tracked before further product writes.
- Centralized workflow-depth selection in `lifecycle-core.md` and regulated QA/correction/completion policy in `qa-and-done.md`, replacing copies in workflows, roles, delegation, and prompt references.
- Allowed one bounded in-scope correction plus a fresh full verification pass in the same tracked task; repeated or material/scope failures use terminal closure.
- Excluded the byte-for-byte generated plugin mirror from default ripgrep searches while retaining full package validation.
- Reduced `agrimap-agent-skills` to a routing-only skill; each of the 16 generated `agm-*` skills now owns exactly one operation and never falls back to the router for execution.
- Added a generated operation routing index and fail-closed `PACKAGE_ENTRYPOINT_MISSING` behavior for absent/corrupt compact contracts.
- Isolated Codex, Claude, and Gemini hook discovery so each host records only its own provider.
- Added runtime provider correction for stale cross-loaded Codex/Claude hook artifacts.
- Added a normative workflow glossary separating requester from decision-owner authority and defining substantive work, durable milestones, material/complex/small work, proportional verification, verification-only QA, the exact two-light-then-full QA counter, and configured versus actual model identity.
- Centralized task artifact fields, required sections, QA/full-release rules, templates, generated documentation, and completion validation in `assets/task-artifact-schema.json`.
- Added historical QA-counter enforcement, separate verifier identity checks, workflow-write/product-read-only evidence, and schema/template/docs contract tests.
- Replaced stale Codex subagent fallback guidance with the current native app/CLI/IDE workflow, including `/agent`, inspectable threads, descriptive labels, and a mandatory non-silent 60-second status cadence.
- Changed generated aliases and Gemini commands from umbrella reloads to compact runtime-core + glossary + operation-specific entrypoints generated from `config/operations.json`.
- Bumped the package version so provider-hook fixes replace cached `0.1.1` installations.

## 0.1.1 - 2026-07-16

- Split Codex and Claude plugin hooks into explicitly selected provider-specific files; Gemini retains its extension hooks.
- Added Gemini prompt rendering and model-capability routing without inventing a fixed live model name.
- Enforced QA mode, pattern evidence, separate implementation/QA identity, delivery boundary, and Outstanding items in task completion validation.
- Updated silent task-hook integration expectations and restored green workspace/package tests.
- Linked frontend scenario evals from the skill and wired their structural contract into the automated unit suite.
- Added tables of contents to long operational references for selective loading.
- Consolidated five non-parseable legacy response-shape `.json` fragments into one clearly labeled Markdown reference.

## 0.1.0 - 2026-07-14

- Created the `agrimap-agent-skills` umbrella workflow and `/agm-*` provider adapters.
- Added role/workflow contracts, explicit refactor modes, prompt delegation, QA gates, and task-level memory/logging.
- Added per-session requester attribution for multi-person projects.
- Added phase-aware Front-end Engineer workflow and reusable-artifact index tooling.
- Preserved legacy FE/BE/SQL coding examples with provenance and hashes, then removed legacy `.agm` governance.
- Added a canonical conflict matrix that separates corrected defects, project-dependent choices, and owner-required logical/data decisions without modifying raw examples.
- Added one-file/one-logical-contract writer ownership, workspace-mode detection, and Frontier-owned sandbox integration.
- Normalized `agmws` and `agmbo` as the only `backend_profile` values under `target_kind=be-main`; removed them from the target-kind dimension.
- Bound installation and package metadata to `gasxhermvc/agrimap-agent-skills`; license remains pending golden-example rights confirmation.
- Added Codex plugin, Claude marketplace/plugin, and Gemini extension packaging.
- Made `package.json` the single package-version source of truth for all generated provider manifests and marketplace metadata.
