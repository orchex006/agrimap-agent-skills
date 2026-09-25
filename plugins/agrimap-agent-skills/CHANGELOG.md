# Changelog

Release history, not current operating instructions. Start with [Getting Started](docs/GETTING-STARTED.md) and [Migration](docs/MIGRATION-3.0.md) for current behavior.

## 4.9.3 — 2026-09-25

Skill-first routing, team commit style, pending-work release and customer-facing Release Description with Teams notification.

- Bootstrap `AGENTS.md` §0 makes skill loading mandatory for every model before code/SQL work, with an evidence table: `agmws-*`/`agmbo-*` → `agm-be` (be-main), .NET libraries → `agm-be` (be-library), `agmwa-*` → `agm-fe` (fe-main), Angular library workspaces → `agm-fe` (fe-library), tables/SP/views/`.sql` → `agm-sql`. Golden format is the default from the first draft; a `Skill · Target · Golden` receipt line and a pre-delivery self-check are required.
- `agm-fe`, `agm-be` and `agm-sql` descriptions now name their triggers (agmwa/agmws/agmbo, Angular/.NET libraries, tables/SP/views) so hosts pick them without an explicit skill name.
- Prompt hook adds a domain skill line from the repository name/root markers and an `agm-sql` line when SQL intent is detected (the previously unused SQL intent detector is now wired in; `SP`, `procedures` and `ตาราง` are recognized).
- agm-release pending work: publishing commands (`release`, `pipeline`) now include all pending product work automatically, like group B `Version *`: dirty paths and unpushed develop commits become a reviewed content commit before the version commit. Work stays local only on explicit requester exclusion; secrets, ignored state and nested repos are always excluded and listed.
- After publication the final audit commit is pushed to develop once and verified, so develop ends clean and equal to origin. This replaces the 4.9.1 carry-forward (`--push-audit` is no longer needed); a develop-triggered pipeline, if configured, runs once more.
- Team commit style (bootstrap `AGENTS.md` §10.6): `feature:`, `fix:`, `comment:` plus a plain-language description an App Leader, BA or customer can read (at most 100 characters, no scope); agm-release commits use `bump:`, `audit:`, `ci:`. `git-flow.mjs` generates and validates this style (legacy English Conventional Commits in explicit input still pass); new workflow policies default to `commitConvention: agrimap`, `commitLanguage: th`.
- Release Description (`AGENTS.release.md` §8.2, `release-notify.md`): `release production|full` (including `--flash`) end with a plain-Thai `# <project> / <version>` bullet summary a BA can send to customers; items that come from or require changes in other projects end with `(เกี่ยวข้อง: <repo>, …)` (e.g. `agmws-identity-netcore`). It is saved under `.agrimap-agent/reports/` and always shown in the final answer.
- Teams notification: new managed bootstrap file `tools/agrimap/release-notify.mjs` (`check`, `set-url`, `send --preview`) posts `{projectName, version, environment?, items[{text, relatedProjects}]}` to the agrimap-notify `POST /release-description` endpoint (separate from the Jenkins build card `POST /release`). It reads `NOTIFY_WEBHOOK_URL`, checks `GET …/healthz` before every POST, asks once for the URL when it is missing and saves it as a user environment variable. Failures leave the release completed with notify `pending`. `--silent` (alias `--skip-noti`) skips sending only.
- Integration without MR/PR: new workflow policies default to `integration.method: local-merge` (also the fallback when no policy exists). `merge`/`รวม` merges into the target and pushes only after local verification passes; `pr`/`mr` still opens one on request. Existing confirmed policies keep their recorded method (switch with `agm-workspace.mjs policy set --key integration.method --value local-merge`).
- Fix: `start` no longer fails with `RUN_ID_COLLISION` when two runs start in the same second; a generated `ddHHmmss` ID moves to the next free second as bootstrap §9.2 requires (explicit `--execution` IDs still report the collision). This made `git-flow` CI flaky on Linux.
- Bootstrap manifest mode `managed`: the bundle owns the file and always replaces it (with backup) instead of reporting a merge conflict.
- Docs: `docs/RELEASE.md` no longer says `--flash` is unsupported on prepare/pipeline (supported since 4.9.1).

## 4.9.1 — 2026-09-22

agm-release fixes.

- `--flash` is accepted on `prepare inhouse|production` and `pipeline inhouse|production` (previously rejected); still rejected on indexing, promote and bootstrap. Pipeline with flash never creates a missing candidate.
- Single push per ref: develop, jenkins and jenkins-release are pushed at most once per invocation and the tag once, after all local commits are built. This stops the post-release develop audit push that started an extra pipeline per release.
- The final audit (history added after D, e.g. at confirmation) is committed locally on develop and carried into the next release's develop push; push it now only on explicit request (`--push-audit`).
- Local develop commits ahead of origin/develop and tracked agent recording (`.agrimap-agent/prompts/**/history.md`, logs, memory, reports) from earlier conversations are included in the release by default; only ignored/runtime state, secrets and requester exclusions are left out.

## 4.9.0 — 2026-09-19

Agent Collaboration Governance, phase P4 (spec §20.4; runbook `specs/acg-roadmap-4.7-4.9.md` §7).

- `git-guard.mjs` (Claude `PreToolUse`, matcher `Bash|PowerShell`): parses Bash and PowerShell command lines (`;`, `&&`, `||`, `|`, `&`, newline, backslash/backtick continuation, `git -C`) and denies force/mirror pushes (G1), pushes to protected branches outside a release execution (G2), add-everything and `.agrimap-agent/local` (G3), deletion of protected branches and tags (G5); asks for `reset --hard`, `clean -f`, `checkout -- .`, `restore .` (G4) and `stash` (G6). Fail-open with one stderr line.
- `delivery-reminder.mjs` (Claude `Stop`): blocks once per execution when verified work is not delivered under a policy that commits on completion; `stop_hook_active` never blocks.
- Hooks are generated only for Claude Code; Codex and Gemini/Antigravity are `not-supported-on-host` until their pre-tool formats are confirmed. The validator enforces this.
- `governance.guards` defaults to true (one-time switch of the earlier `false` default, `guardsDefault`); `false` makes both hooks no-ops.

## 4.8.0 — 2026-09-19

Agent Collaboration Governance, phase P3 (spec §20.3; runbook `specs/acg-roadmap-4.7-4.9.md` §6).

- Decision memory: `recall --topic --paths --kind` scores approved decisions (topic, area, scope glob, kind, age) from a cached index (`cache/decisions-index.json`), output at most 2,000 characters. Decisions now record `value`, `scope_paths` and `applies_when`.
- Every card (`decide card` and the git cards of branch/deliver/integrate) is checked first: an approved precedent with a matching option suppresses it (`suppressed`, counted as a question avoided); a calibrated R1 medium card is `autoDecided` unless the requester said "always ask" for that kind. `governance.decisionMemory:false` restores 4.7.0 behaviour.
- Learning under `runtime/` (never committed): `decide record` and `decide correction` write signals; the same value chosen twice becomes `promotable` (`decide promote`, one card per session; "not needed" is never offered again); per-kind R1 calibration (10 signals, n ≥ 5, 0.8 / 0.5); `decide always-ask --kind`; `decide list`.
- `complete` records `precedents` and `questions_avoided`.
- Hook session digest: at most three lines / 600 characters (target, branch, policy, mode, decisions, open execution), only when its hash changes; no git or network.
- Instruction diet: the bootstrap `AGENTS.md` core keeps §1, §3, §9, §10 and a short §2 (21,074 characters, from 61,058; includes the owner rule that explicit human instructions such as a chosen version take precedence over defaults but never over §3 safety invariants); §2 in full and §4–§8 moved verbatim to the new `AGENTS.release.md` with unchanged section numbers. Bootstrap installs it; an unmodified 4.7.0 template updates automatically.
- `governance.decisionMemory` defaults to true (one-time switch of the earlier `false` default, `decisionMemoryDefault`).

## 4.7.0 — 2026-09-19

Agent Collaboration Governance, phase P2 (spec `specs/agent-collaboration-governance-v2.md` §20.2; runbook `specs/acg-roadmap-4.7-4.9.md`).

- Spec Read Gate: `spec context --tasks|--query|--paths` returns at most eight files to read first (goal READMEs first), the matching task/requirement/acceptance items and the open questions that block them.
- Spec Sync Gate: `spec sync plan|apply` updates task status (the file's own status words; `statusMap` override; `STATUS_VALUE_NEW`/`STATUS_VALUE_UNKNOWN`/`TASK_STATUS_LINE_ADDED` are warnings), appends implementation evidence, the spec changelog and `manifest.sha256`, and writes each file through temp + rename keeping line endings. Evidence paths must be repository-relative. `--deviation` records a decision. Adapters: `morynth-context-index@1` and `generic-markdown`; spec-kit, kiro and openspec layouts fall back with `SPEC_FORMAT_FALLBACK`. YAML goes through a new line-based subset (`yaml-lines.mjs`), no dependency.
- `deliver plan` precondition 7: covered work returns `SPEC_NOT_SYNCED` as a self-fix; after a failed sync attempt the work still delivers with the warning. `--spec-na "<reason>"` skips it; `specs.enforcement: "block"` stops with `SPEC_SYNC_REQUIRED`. Delivery returns `specLine` for the summary and `SPEC_SOURCE_NOT_GIT` for a non-Git spec pack.
- A spec pack in its own Git repository is a second target root: sync links the execution there, it is delivered with that repository's policy (or `--explicit`), and the code delivery reports both commits.
- `spec check` reports manifest mismatches, missing evidence, done tasks without evidence and executions that touched spec scopes without a sync; the first `context` of a session in spec-first scope shows up to five of them (`openWarnings`).
- `spec semantic` stores the R2 card for a spec gap the work revealed; while it is open, sync warns `SPEC_DECISION_PENDING` and keeps the mechanical updates. `spec standing` turns a one-off "update the spec too" in a code-first project into the rule for every task (hybrid + sync auto for the touched directories) without asking, reported as decided for you.
- `governance.specSync` defaults to true; a 4.6.0 config still holding the unused `false` default is switched on once (`specSyncDefault`).
- Fix: audit written after a delivery (`logs/`, `memory/recent/`, `reports/`, `decisions/`) is no longer snapshotted as pre-existing work and is committed by the next delivery.
- `glab` merge request flags checked against glab 1.115: `--description-file`, and `--auto-merge=false` for a plain merge.
- Pre-write gate item 9 and the After-verification section of `spec-driven.md`; direct and required budgets are unchanged.

## 4.6.0 — 2026-09-18

Agent Collaboration Governance, phase P1 (spec `specs/agent-collaboration-governance-v2.md` v2.1).

- Resolve the target repository and its AGENTS chain before writing: new `agm-workspace.mjs context` (read-only unless `--ack`) returns the target root, the chain outer→inner with sha12, `readRequired`, stray `.agrimap-agent` roots, the project mode and resolved spec paths. The hook no longer archives prompts or reads config outside a Git root and points to `context` instead.
- Decide, ask or confirm by owner × risk × confidence (`references/autonomy.md`); `decide card|record` validate, render and store one Decision Card and apply its `recordAs` once.
- Team workflow policy `.agrimap-agent/policy/workflow.json` (`policy show|infer|init|set`): asked once per project, then a standing authorization to commit and push only the execution's work branch.
- `branch plan|apply` creates the work branch from `origin/<base>` without touching local protected branches; host worktree branches push under the team name. `start` snapshots pre-existing dirty files.
- `deliver plan|apply` stages exact own paths only, refuses protected branches, suspected secrets (values never shown), missing acknowledgement or changelog and machine-local path leaks, then commits (Conventional Commits, `AGM-Execution` trailer) and verifies the remote SHA. Failed or missing verification still delivers the work branch with `AGM-Verification` and a `DELIVERED_UNVERIFIED` warning; merge is not offered until it passes.
- `integrate options|plan|apply`: next-step card, PR via `gh` (`glab` flags unverified), compare URL fallback, or local merge through `commit-tree` and one non-force push. Short replies (`1`, `merge`, `รวมเข้า dev`, `pr`) resolve through `resolveShortIntent` and the hook; questions never trigger git actions.
- Development mode `.agrimap-agent/policy/project.json` (`project show|infer|init|set`) with machine-local spec paths in the Git-ignored `.agrimap-agent/local/memory.md` (`local show|set-path|note`).
- Audit logs are one file per execution (`logs/YYYY-MM/YYYY-MM-DD/<id>.jsonl`); `project.md` no longer accumulates completed work unless `memory.completedWorkInProjectMd` is true. Older daily logs stay readable.
- Bootstrap AGENTS template: §10 team workflow (repository, policy, delivery, short replies, development mode), `policy/**` allowlist, `local/**` exclusion and the new log path.
- Eight token-coverage scenarios; direct and required budgets are unchanged (prose was trimmed to fit).

## 4.5.5 — 2026-09-17

- Route golden patterns by detected target kind. `fe`, `be`, `sql` and `execute` now declare conditional references to a per-collection checklist; previously only one golden entry was reachable from any operation and `fe`/`sql` declared none.
- Add `references/patterns/checklists/` — the `MUST`-tier extract of each golden collection with the entry owning each rule and its detection command, so a collection is entered by rule instead of browsed through five hops.
- Define `MUST` verify / `SHOULD` justify / `FREE` decide tiers, making the existing structure-over-logic stance checkable without turning internal implementation choices into blocking questions.
- Load the frontend, backend and SQL pattern contracts in `execute`, which previously carried none for frontend or SQL work, plus the generated-API source and the delegation contract when Subagent assignments are dispatched.
- Stop the generated command prompts from classing golden material as background: a golden entry or checklist named by a matched conditional reference is required, not an optional example.
- Add pre-write gate item 6: name the checklist loaded, the entries actually opened, and every `MUST` row conflicting with project code. Evidence, not a remembered convention.
- Add six token-coverage scenarios for the new routing; adjust two regulated scenario budgets for the added governance prose. Direct and required budgets are unchanged.

## 4.5.4 — 2026-09-14

- Release results, including `--flash`, must display elapsed, active, excluded human wait and per-step timing. The helper renders the final block; missing or incomplete measurement is explicitly disclosed.

- Redact recognizable credentials and personal-data labels before recording prompt history, audit logs, memory and new Prompt Results; retain deterministic markers without raw-value sidecars.
- Sanitize workspace input before slug generation and checkpoint truncation, and preserve valid JSON, prompt hashes and retry deduplication.
- Document detection limits and manual-recording requirements; do not rewrite historical records, Git tags or application source files.

## 4.5.2 — 2026-09-14

- Measure release elapsed time separately from active per-step time, excluding requester/confirmation waits and disclosing unmeasured interruptions; persist timing across turns and retries.
- Include reviewed release-owned prompt history before the candidate commit and after confirmation in develop-only final audit publication; verify no eligible audit leftovers without changing the frozen release SHA/tag.
- Make completion checks explicit for every model and normal/flash flow; retain local-only and unrelated/ignored-content boundaries.

## 4.5.1 — 2026-09-13

- Add explicit delta-only release --flash for full, inhouse and production, including short aliases; skip full-project Backfill while retaining owner, verification, confirmation and publication safeguards.
- Reuse matching tool/bootstrap/test evidence, batch scoped release recording and resume successful publication checkpoints without duplicate pushes.
- Publish the owner-requested 4.5.1 version with regenerated host metadata and bootstrap version tracking; preserve prior published versions.

## 4.1.1 — 2026-09-11

- Reduce repetitive release confirmations: proceed with assessed, authorized routine steps and consolidate Production branch/tag approval into one concise action/evidence/impact/recovery summary.
- Reuse matching human approval across retries and resume; retain successful publication checkpoints without duplicate pushes. Reconfirm only missing or materially changed approval.
- Preserve scope, work-loss, access and server-review safeguards; document recovery commands as plans, not rollback authority or a promise to undo deployment effects.
- Document all six project bootstrap targets, receipt and backup paths in the doctor guide, including custom-rule preservation and unchanged-file behavior.
- Regenerate package metadata, bootstrap version tracking and provider documentation for 4.1.1; preserve published tags and release assets.

## 4.1.0 — 2026-09-10

- Add maintainer-only source governance and development/release/hotfix branches without changing product runtime release rules.
- Separate edit, commit/push, PR integration and publication authority; preserve same-directory development and all prior work.
- Add explicit runtime packaging allowlists, provider-specific archives, version/SHA catalogs and checksums; exclude source-maintainer instructions while retaining product bootstrap templates.
- Add PR verification and manual, exact-version publication workflows with immutable-version collision checks. Server protection configuration and publication remain separate authorized steps.
- Document exact-version selection, rollback limitations and evidence-based historical backfill; do not invent historical releases.
- Bump source and generated version metadata to 4.1.0 at the requester's direction; incorporate the previously prepared 3.7.0 changes below.
- Show the current package version in documentation and retain 24 evidence-backed historical source tags; exclude the test prerelease and unpublished 3.7.0 draft from historical releases.
- Restore 62 canonical golden Git blobs to the exact raw bytes already preserved by committed mirrors and manifest hashes; repair inherited LF/CRLF index drift without changing golden content or rehashing evidence.

## 3.7.0 — 2026-09-10 (prepared changes; publication not verified)

- Keep product release work in the requested repository directory. Check all three local/remote release branches before new artifacts, use safe fast-forward pulls, and remove automatic product cloning/worktree recovery from entrypoints, release steps and bootstrap governance.
- Fix project-bootstrap CLI positional command handling; exercise plan/apply/upgrade through the executable rather than only imported functions.
- Honor start --requested-by and share confirmed requester lookup between hooks/runtime, including unambiguous valid local session recovery, read-only requester inspection, and protection against expired/revoked/foreign/conflicting identity reuse.
- Clarify that feature/hotfix integration into develop is a separate scoped action, not an implicit capability or permission of the existing release command surface.

- Add agm-doctor with read-only status, version and compatibility/dependency checks, plus explicit host-scoped AGM updates and requested-version selection.
- Distinguish loaded versus installed package versions, verified source availability, workflow-specific missing dependencies and unknown checks; preserve local changes and recovery evidence during native host updates.
- Generate native Antigravity root plugin.json and flat Markdown operation skills. Replace current Gemini extension installation guidance with agy plugin install, retain GEMINI.md and legacy Gemini adapters/records, and state unverified host hook/MCP integration limits.
- Add agm-release bootstrap upgrade for backed-up bootstrap refresh and reviewed custom-rule preservation; retain legacy upgrade as explicit scoped contract replacement. Keep product versions, publication and host package installation outside bootstrap maintenance.
- Track reviewed custom bootstrap merges against exact target/source hashes and verified backups; invalidate approvals after content or bundle changes instead of repeatedly treating reviewed custom rules as fresh conflicts.
- Document every release action, owner-version precedence, Production-only notes/tags, prerequisite repair, dirty-checkout recovery, indexing/backfill, resume and concrete Production confirmation.
- Add complete doctor command/status tables to the doctor guide and Getting Started, with package-update versus project-bootstrap examples and host syntax.
- Bump package/manifests, bootstrap version tracking, tool-lock skillVersion and generated adapters to 3.7.0; retain prior changelog history and the SQLFluff dependency pin.

## 3.6.1 — 2026-09-09

- Make release indexing perform Project Backfill, including historical changelog, complete capability/evidence catalog and README capability/API inventory.
- Require proven reachable-history coverage, reuse complete prior evidence and reconcile durable outputs instead of completing with a scoped or Temp-only index.

## 3.6.0 — 2026-09-09

- Pin SQLFluff 4.2.2 in the distributed tool lock associated with the skill version.
- Verify before SQL formatting; reuse exact matches and automatically install or align mismatched versions, checking the actual executable after installation.

## 3.5.0 — 2026-09-09

- Add Antigravity CLI recording examples and provider metadata support while preserving legacy Gemini records and adapter compatibility.
- Separate host identity from actual model identity; replace speculative Gemini model examples with runtime-reported model IDs or unknown.
- SQL authoring continues to use SQLFluff with the T-SQL dialect and the existing scoped formatting/validation contract.

## 3.4.5 — 2026-09-09

- Recover release preparation from dirty or occupied caller checkouts using isolated develop worktrees or separate clones, preserving original changes and classifying migration artifacts by evidence.

## 3.4.1 — 2026-09-09

- Add explicit agm-release upgrade for scoped contract replacement with backups, version tracking and verification.
- Keep freshness checks in all nine release actions; explicit upgrade does not grant release publication or replace product files.

## 3.4.0 — 2026-09-09

- Track installed AGENTS.md contract version and compare it with the active skill before durable project work.
- Automatically migrate recognized legacy bootstrap templates with exact backups and receipts; preserve custom instructions and README content, and report unknown content for scoped reconciliation.
- Generate the version marker and bootstrap manifest from the package version to prevent tracking drift.

## 3.2.5 — 2026-09-09

- Surface owner-version precedence directly in the generated release skill, operation entrypoint and Gemini command, including the 1.0.8 / 1.0.5 case.
- Resolve legacy project PATCH-only restrictions during planning as well as execution without requiring bootstrap adoption or governance migration; re-read current contracts before repeating stale refusals.

## 3.2.4 — 2026-09-09

- Honor explicit owner Version/Patch targets per environment, including skipped patches and minor/major changes; PATCH+1 applies only when no target is supplied.
- Reconcile revised unfinished candidates without repeated version approval or a governance rewrite, preserving published history and tag collision checks.
- Permit scoped direct preparation with equivalent verification when the release CLI only supports PATCH+1; retain Production publication confirmation and report CLI incompatibility truthfully.

## 3.2.3 — 2026-09-09

- Release indexing/preparation now creates missing `.agrimap-agent/memory/project.md` and required recording directories from scoped evidence, then continues without a separate Project Backfill invocation.
- Align bootstrap preflight and lifecycle instructions with missing-memory recovery while preserving history and prepared-candidate safeguards for standalone pipeline/promote.

## 3.2.2 — 2026-09-09

- Integrate compatible missing bootstrap installation into scoped agm-release readiness before audit, with verification and continuation in the same invocation.
- Retain concrete adoption decisions for conflicting replacements, prepared-candidate boundaries, and Production/tag confirmation.
- Distinguish missing project files from CLI installation failures; keep Jenkinsfile reconstruction outside bootstrap.

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
- Bound installation and package metadata to `orchex006/agrimap-agent-skills`; license remains pending golden-example rights confirmation.
- Added Codex plugin, Claude marketplace/plugin, and Gemini extension packaging.
- Made `package.json` the single package-version source of truth for all generated provider manifests and marketplace metadata.
