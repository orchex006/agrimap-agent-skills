#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { LOG_EVENTS, MILESTONE_TYPES, QA_FAILED_EVENT } from "../skills/agrimap-agent-skills/scripts/log-events.mjs";
import {
  renderTaskArtifactSchemaDocs,
  taskArtifactRequiredSections,
  taskArtifactSchemaIssues,
} from "../skills/agrimap-agent-skills/scripts/task-artifact-schema.mjs";
import {
  operationConfigIssues,
  operationEntrypointPath,
  renderAliasSkill,
  renderGeminiCommandPrompt,
  renderOperationAliasesModule,
  renderOperationIndex,
  renderOperationEntrypoint,
} from "./operation-entrypoints.mjs";

const root = process.cwd();
const errors = [];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function parseJson(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

async function filesUnder(directory) {
  const result = [];
  if (!(await exists(directory))) return result;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(entryPath));
    else result.push(entryPath);
  }
  return result;
}

function hookCommands(value) {
  if (Array.isArray(value)) return value.flatMap(hookCommands);
  if (!value || typeof value !== "object") return [];
  return [
    ...(typeof value.command === "string" ? [value.command] : []),
    ...Object.entries(value)
      .filter(([key]) => key !== "command")
      .flatMap(([, child]) => hookCommands(child)),
  ];
}

for (const required of [
  ".rgignore",
  ".gitignore",
  "skills/agrimap-agent-skills/SKILL.md",
  "plugins/agrimap-agent-skills/.codex-plugin/plugin.json",
  "plugins/agrimap-agent-skills/.claude-plugin/plugin.json",
  "plugins/agrimap-agent-skills/hooks/codex-hooks.json",
  "plugins/agrimap-agent-skills/hooks/claude-hooks.json",
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  "gemini-extension.json",
  "hooks/hooks.json",
  "skills/agrimap-agent-skills/references/patterns/conflict-resolution.md",
  "skills/agrimap-agent-skills/references/analysis-discipline.md",
  "skills/agrimap-agent-skills/references/glossary.md",
  "skills/agrimap-agent-skills/references/lifecycle-core.md",
  "skills/agrimap-agent-skills/references/goal-rules.md",
  "skills/agrimap-agent-skills/references/prompt.md",
  "skills/agrimap-agent-skills/references/application-url-matrix.md",
  "skills/agrimap-agent-skills/references/runtime-core.md",
  "skills/agrimap-agent-skills/references/backend-engineer.md",
  "skills/agrimap-agent-skills/references/db-schema-context.md",
  "skills/agrimap-agent-skills/references/service-ownership.md",
  "skills/agrimap-agent-skills/references/evals/sql-scenarios.md",
  "skills/agrimap-agent-skills/scripts/log-events.mjs",
  "skills/agrimap-agent-skills/scripts/operation-aliases.mjs",
  "skills/agrimap-agent-skills/scripts/install-sqlfluff.mjs",
  "skills/agrimap-agent-skills/scripts/identity.mjs",
  "skills/agrimap-agent-skills/scripts/task-artifact-schema.mjs",
  "skills/agrimap-agent-skills/scripts/agm-prompt-version.mjs",
  "skills/agrimap-agent-skills/scripts/token-coverage.mjs",
  "skills/agrimap-agent-skills/scripts/sql-contract-preflight.mjs",
  "skills/agrimap-agent-skills/scripts/validate-sql-artifacts.mjs",
  "skills/agrimap-agent-skills/scripts/mcp-server.mjs",
  "skills/agrimap-agent-skills/assets/task-artifact-schema.json",
  "skills/agrimap-agent-skills/assets/passive-skill-map.json",
  "skills/agrimap-agent-skills/assets/token-coverage-scenarios.json",
  "skills/agrimap-agent-skills/assets/templates/service-ownership.yaml",
  "skills/agrimap-agent-skills/assets/templates/execution-report.md",
  "tests/README.md",
  "tests/helpers/harness.mjs",
  "tests/unit/cli-args.test.mjs",
  "tests/unit/extract-code-blocks.test.mjs",
  "tests/unit/fe-scenarios.test.mjs",
  "tests/unit/feature-lifecycle-policy.test.mjs",
  "tests/unit/governance-policy.test.mjs",
  "tests/unit/operation-contracts.test.mjs",
  "tests/unit/prompt-version.test.mjs",
  "tests/unit/qa-policy.test.mjs",
  "tests/unit/sql-artifacts.test.mjs",
  "tests/unit/sql-contract-preflight.test.mjs",
  "tests/unit/sql-scenarios.test.mjs",
  "tests/unit/sqlfluff-install.test.mjs",
  "tests/unit/task-artifact-schema.test.mjs",
  "tests/unit/verify-golden.test.mjs",
  "tests/unit/mcp-server.test.mjs",
  "tests/integration/package/usage.test.mjs",
  "tests/integration/workspace/workspace.test.mjs",
  "tests/integration/workspace/cases/bootstrap-and-prune.mjs",
  "tests/integration/workspace/cases/identity-and-checkpoint.mjs",
  "tests/integration/workspace/cases/hooks.mjs",
  "tests/integration/workspace/cases/completion.mjs",
  "tests/integration/workspace/cases/history.mjs",
  "tests/integration/workspace/cases/frontend-reuse.mjs",
  "tools/operation-entrypoints.mjs",
  "docs/USAGE.md",
  "plugins/agrimap-agent-skills/docs/USAGE.md",
  "examples/inputs/LONG-REQUEST.md",
  "examples/inputs/references/checkout-flow.svg",
  "plugins/agrimap-agent-skills/examples/inputs/references/checkout-flow.svg",
]) {
  if (!(await exists(path.join(root, required)))) errors.push(`${required}: missing`);
}

const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
if (!/^\.tmp-\*\/$/m.test(gitignore)) errors.push(".gitignore must keep .tmp-*/ as a residue safety net.");
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name.startsWith(".tmp-")) errors.push(`Workspace temp residue is forbidden: ${entry.name}`);
}

for (const legacyTestRunner of ["tools/test-scripts.mjs", "tools/test-usage-examples.mjs"]) {
  if (await exists(path.join(root, legacyTestRunner))) errors.push(`${legacyTestRunner}: obsolete monolithic test runner found`);
}

const packageManifest = await parseJson("package.json");
const operations = await parseJson("config/operations.json");
const codexPlugin = await parseJson("plugins/agrimap-agent-skills/.codex-plugin/plugin.json");
const claudePlugin = await parseJson("plugins/agrimap-agent-skills/.claude-plugin/plugin.json");
const codexMarketplace = await parseJson(".agents/plugins/marketplace.json");
const claudeMarketplace = await parseJson(".claude-plugin/marketplace.json");
const geminiExtension = await parseJson("gemini-extension.json");
const geminiHooks = await parseJson("hooks/hooks.json");
const codexHooks = await parseJson("plugins/agrimap-agent-skills/hooks/codex-hooks.json");
const claudeHooks = await parseJson("plugins/agrimap-agent-skills/hooks/claude-hooks.json");
const taskArtifactSchema = await parseJson("skills/agrimap-agent-skills/assets/task-artifact-schema.json");
const passiveSkillMap = await parseJson("skills/agrimap-agent-skills/assets/passive-skill-map.json");
const rgIgnore = await readFile(path.join(root, ".rgignore"), "utf8");
const generatedMirrorIgnore = "/plugins/agrimap-agent-skills/skills/agrimap-agent-skills/**";
if (!rgIgnore.split(/\r?\n/).includes(generatedMirrorIgnore)) errors.push(`.rgignore must exclude the generated canonical mirror: ${generatedMirrorIgnore}`);

if (operations) {
  for (const issue of operationConfigIssues(operations)) errors.push(`Operation config: ${issue}`);
  const operationIndexPath = path.join(root, "skills", "agrimap-agent-skills", "references", "operation-index.md");
  if (!(await exists(operationIndexPath))) {
    errors.push(`${path.relative(root, operationIndexPath)}: operation routing index missing; run npm run sync.`);
  } else if (await readFile(operationIndexPath, "utf8") !== renderOperationIndex(operations)) {
    errors.push(`${path.relative(root, operationIndexPath)}: operation routing index is stale; run npm run sync.`);
  }
  const operationAliasesPath = path.join(root, "skills", "agrimap-agent-skills", "scripts", "operation-aliases.mjs");
  if (!(await exists(operationAliasesPath))) {
    errors.push(`${path.relative(root, operationAliasesPath)}: operation alias registry missing; run npm run sync.`);
  } else if (await readFile(operationAliasesPath, "utf8") !== renderOperationAliasesModule(operations)) {
    errors.push(`${path.relative(root, operationAliasesPath)}: operation alias registry is stale; run npm run sync.`);
  }
  for (const item of operations.operations || []) {
    const entrypointPath = operationEntrypointPath(path.join(root, "skills", "agrimap-agent-skills"), item);
    if (!(await exists(entrypointPath))) {
      errors.push(`${path.relative(root, entrypointPath)}: compact operation entrypoint missing; run npm run sync.`);
    } else if (await readFile(entrypointPath, "utf8") !== renderOperationEntrypoint(item)) {
      errors.push(`${path.relative(root, entrypointPath)}: compact operation entrypoint is stale; run npm run sync.`);
    }
    const aliasPath = path.join(root, "plugins", "agrimap-agent-skills", "skills", item.name, "SKILL.md");
    if (await exists(aliasPath) && await readFile(aliasPath, "utf8") !== renderAliasSkill(item)) {
      errors.push(`${path.relative(root, aliasPath)}: generated compact alias is stale; run npm run sync.`);
    }
    const commandPath = path.join(root, "commands", `${item.name}.toml`);
    if (await exists(commandPath)) {
      const expected = `description = ${JSON.stringify(item.description)}\nprompt = ${JSON.stringify(renderGeminiCommandPrompt(item))}\n`;
      if (await readFile(commandPath, "utf8") !== expected) errors.push(`${path.relative(root, commandPath)}: generated compact Gemini command is stale; run npm run sync.`);
    }
  }
}

if (passiveSkillMap) {
  if (passiveSkillMap.schemaVersion !== 1 || !Array.isArray(passiveSkillMap.capabilities)) errors.push("Passive skill map must use schemaVersion 1 with a capabilities array.");
  const capabilities = passiveSkillMap.capabilities || [];
  const ids = capabilities.map((item) => item.id);
  if (new Set(ids).size !== ids.length) errors.push("Passive capability IDs must be unique.");
  for (const requiredId of ["goal-rules", "refactor-guard", "test-decision", "design-discipline", "sql-explain"]) {
    if (!ids.includes(requiredId)) errors.push(`Passive skill map missing ${requiredId}.`);
  }
  for (const capability of capabilities) {
    for (const field of ["id", "reference", "activation", "authorityEffect", "conflicts"]) {
      if (!String(capability?.[field] || "").trim()) errors.push(`Passive capability ${capability?.id || "unknown"} missing ${field}.`);
    }
    for (const field of ["operations", "actions", "requiredInputs", "evidenceOutput"]) {
      if (!Array.isArray(capability?.[field]) || capability[field].length === 0) errors.push(`Passive capability ${capability?.id || "unknown"} requires non-empty ${field}.`);
    }
    if (capability?.grantsProductWrite !== false) errors.push(`Passive capability ${capability?.id || "unknown"} must set grantsProductWrite=false.`);
    const referenceFile = String(capability?.reference || "").split("#", 1)[0];
    if (referenceFile && !(await exists(path.join(root, "skills", "agrimap-agent-skills", "references", referenceFile)))) errors.push(`Passive capability ${capability?.id} reference is missing: ${referenceFile}.`);
  }
  const goalRules = capabilities.find((item) => item.id === "goal-rules");
  const requiredGoalOperations = ["analyze", "architect", "be", "design", "diagnose", "fe", "sql", "review", "simulate", "execute", "plan", "qa", "prompt"];
  if (JSON.stringify(goalRules?.operations) !== JSON.stringify(requiredGoalOperations)) errors.push("goal-rules operation mapping is incomplete or reordered unexpectedly.");
  for (const operation of requiredGoalOperations) {
    const item = operations?.operations?.find((candidate) => candidate.operation === operation);
    if (!item?.references?.some((reference) => reference.path === "goal-rules.md")) errors.push(`${operation} must load mandatory goal-rules.md.`);
  }
}

if (!packageManifest?.scripts?.test?.includes("npm run verify:golden")) errors.push("npm test must include golden verification.");
if (!packageManifest?.scripts?.test?.includes("npm run validate")) errors.push("npm test must include package validation before behavioral suites.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("fe-scenarios.test.mjs")) errors.push("Frontend scenario eval is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("feature-lifecycle-policy.test.mjs")) errors.push("Feature lifecycle policy test is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("governance-policy.test.mjs")) errors.push("Governance policy test is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("qa-policy.test.mjs")) errors.push("QA provider-neutral policy test is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("task-artifact-schema.test.mjs")) errors.push("Task artifact schema contract test is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("token-coverage.test.mjs")) errors.push("Token coverage audit test is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("prompt-version.test.mjs")) errors.push("Prompt version contract test is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("sql-artifacts.test.mjs")) errors.push("SQL artifact contract test is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["test:unit"]?.includes("sql-scenarios.test.mjs")) errors.push("SQL cross-provider scenario eval is not wired into the automated unit suite.");
if (!packageManifest?.scripts?.["audit:tokens"]?.includes("token-coverage.mjs")) errors.push("Token coverage audit command is missing.");
for (const scriptName of ["test:unit", "test:integration", "test:workspace", "test:usage"]) {
  if (!packageManifest?.scripts?.[scriptName]) errors.push(`package.json script is missing: ${scriptName}`);
}
if (!packageManifest?.scripts?.test?.includes("npm run test:unit") || !packageManifest?.scripts?.test?.includes("npm run test:integration")) {
  errors.push("npm test must run the categorized unit and integration suites.");
}

const canonicalSkill = await readFile(path.join(root, "skills", "agrimap-agent-skills", "SKILL.md"), "utf8");
if (!/^---\r?\nname: agrimap-agent-skills\r?\ndescription: .+\r?\n---/s.test(canonicalSkill)) errors.push("Canonical SKILL.md frontmatter is invalid.");
if (canonicalSkill.split(/\r?\n/).length > 80) errors.push("Routing SKILL.md exceeds the 80-line single-purpose limit.");
for (const marker of ["Perform one task only", "[operation-index.md](references/operation-index.md)", "Select exactly one", "AgriMap router active", "Stop.", "PACKAGE_ENTRYPOINT_MISSING", "not a fallback execution engine"])
  if (!canonicalSkill.includes(marker)) errors.push(`Routing-only skill contract missing marker: ${marker}`);
for (const forbidden of ["## Start every task", "## Owner reference library", "## Analyze before editing", "## Route technical patterns", "## Delegate deliberately", "## Checkpoint every durable state transition", "## Verify and close"])
  if (canonicalSkill.includes(forbidden)) errors.push(`Routing skill contains execution responsibility: ${forbidden}`);

const lifecycleCorePath = path.join(root, "skills", "agrimap-agent-skills", "references", "lifecycle-core.md");
const lifecycleCoreReference = await readFile(lifecycleCorePath, "utf8");
for (const marker of ["Select `workflow_depth`", "`light`", "`standard`", "`regulated`", "Help and history remain light diagnostics", "Persistence by depth", "Only `standard|regulated` write", "Terminal lifecycle", "Milestone checkpoints", "behaviorally complete acceptance slice", "Boundaries"])
  if (!lifecycleCoreReference.includes(marker)) errors.push(`Lifecycle core missing marker: ${marker}`);
for (const marker of ["For `action-routed` operations", "resolve one action before target inspection", "Embedded passive capabilities support the selected read or authorized write action", "creating write intent", "must not create anything under `tasks/**`"])
  if (!lifecycleCoreReference.includes(marker)) errors.push(`Domain action boundary missing marker: ${marker}`);
if (lifecycleCoreReference.split(/\r?\n/).length > 70) errors.push("Lifecycle core exceeds its 70-line budget.");
const runtimeCoreReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "runtime-core.md"), "utf8");
if (!runtimeCoreReference.includes("compatibility pointer") || !runtimeCoreReference.includes("lifecycle-core.md")) errors.push("Legacy runtime-core.md must be only a compatibility pointer to lifecycle-core.md.");
if (runtimeCoreReference.split(/\r?\n/).length > 8) errors.push("Legacy runtime-core compatibility pointer has regrown into policy.");

const frontendEngineerReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "frontend-engineer.md"), "utf8");
if (!frontendEngineerReference.includes("[fe-scenarios.md](evals/fe-scenarios.md)")) errors.push("Frontend eval catalog is unreachable from the dedicated frontend discipline.");
const sqlPatternReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "patterns", "sql.md"), "utf8");
if (!sqlPatternReference.includes("[sql-scenarios.md](../evals/sql-scenarios.md)")) errors.push("SQL eval catalog is unreachable from the SQL discipline.");

const glossaryReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "glossary.md"), "utf8");
for (const marker of [
  "Requester authority",
  "Substantive work",
  "Milestone checkpoint",
  "Material choice/change",
  "Complex work",
  "Few files / small task",
  "Proportional verification",
  "third closure for that key must use `full`",
  "Verification-only QA",
  "Configurable model label",
  "Actual model",
]) {
  if (!glossaryReference.includes(marker)) errors.push(`Workflow glossary missing marker: ${marker}`);
}

const memoryAndLogsReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "memory-and-logs.md"), "utf8");
const documentedLogEvents = memoryAndLogsReference.match(/Canonical events:\s*`([^`]+)`/)?.[1]?.split("|") || [];
if (JSON.stringify(documentedLogEvents) !== JSON.stringify(LOG_EVENTS)) {
  errors.push(`Documented log event enum differs from scripts/log-events.mjs: ${documentedLogEvents.join("|") || "missing"}`);
}
const documentedMilestones = memoryAndLogsReference.match(/Canonical milestones:\s*`([^`]+)`/)?.[1]?.split("|") || [];
if (JSON.stringify(documentedMilestones) !== JSON.stringify(MILESTONE_TYPES)) {
  errors.push(`Documented milestone enum differs from scripts/log-events.mjs: ${documentedMilestones.join("|") || "missing"}`);
}
const workspaceScriptReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "scripts", "agm-workspace.mjs"), "utf8");
if (!workspaceScriptReference.includes('from "./log-events.mjs"')) {
  errors.push("agm-workspace.mjs does not enforce the canonical log event enum.");
}
for (const marker of ["auditEventIssues", 'case "history"', "REQUEST_OBJECTIVE_REQUIRED", "TASK_ID_EXISTS", "AMBIGUOUS_ACTIVE_TASK", "QA_CORRECTION_LIMIT", "QA_FINDING_PRODUCT_FILES_FORBIDDEN", "INVALID_WORKFLOW_DEPTH", "CHECKPOINT_EVENT_NOT_MILESTONE", "INVALID_MILESTONE"])
  if (!workspaceScriptReference.includes(marker)) errors.push(`Workspace audit implementation missing marker: ${marker}`);
const terminalEventDeclaration = workspaceScriptReference.match(/const TERMINAL_AUDIT_EVENTS = new Set\(\[[^\]]+\]\)/)?.[0] || "";
if (!terminalEventDeclaration || terminalEventDeclaration.includes('"qa-finding"')) errors.push("qa-finding must exist as a non-terminal audit checkpoint, not a terminal task outcome.");
for (const marker of ["loadTaskArtifactSchema", "taskArtifactSchema.scaffoldOrder", "renderTaskArtifact"])
  if (!workspaceScriptReference.includes(marker)) errors.push(`Workspace task-artifact schema integration missing marker: ${marker}`);
for (const hardcodedTemplate of ['renderAssetTemplate("task-brief.md"', 'renderAssetTemplate("checklist.md"'])
  if (workspaceScriptReference.includes(hardcodedTemplate)) errors.push(`Workspace scaffold bypasses task-artifact schema: ${hardcodedTemplate}`);

if (taskArtifactSchema) {
  for (const issue of taskArtifactSchemaIssues(taskArtifactSchema)) errors.push(`Task artifact schema: ${issue}`);
  if (JSON.stringify(taskArtifactSchema.workflowDepths) !== JSON.stringify(["light", "standard", "regulated"])) errors.push("Task artifact schema workflowDepths must be light|standard|regulated.");
  if (JSON.stringify(taskArtifactSchema.artifacts?.["qa.md"]?.requiredForDepths) !== JSON.stringify(["standard", "regulated"])) errors.push("qa.md must be required for both tracked depths.");
  for (const [artifact, definition] of Object.entries(taskArtifactSchema.artifacts || {})) {
    const templatePath = path.join(root, "skills", "agrimap-agent-skills", "assets", "templates", definition.template || "");
    if (!(await exists(templatePath))) {
      errors.push(`${artifact}: schema template is missing: ${definition.template || "undefined"}`);
      continue;
    }
    const template = await readFile(templatePath, "utf8");
    for (const field of definition.requiredFields || []) {
      const escaped = String(field.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`^\\s*-\\s*${escaped}:`, "m").test(template)) {
        errors.push(`${artifact}: template ${definition.template} is missing required field: ${field.label}`);
      }
    }
    for (const heading of taskArtifactRequiredSections(definition)) {
      const escaped = String(heading).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!new RegExp(`^##\\s+${escaped}\\s*$`, "m").test(template)) {
        errors.push(`${artifact}: template ${definition.template} is missing required section: ${heading}`);
      }
    }
    if (definition.kind === "checklist" && !/^\s*- \[[ xX]\]\s+/m.test(template)) {
      errors.push(`${artifact}: checklist template has no checkbox item.`);
    }
  }
  const generatedSchemaDocs = renderTaskArtifactSchemaDocs(taskArtifactSchema);
  for (const relativePath of ["README.md", "docs/USAGE.md"]) {
    const content = await readFile(path.join(root, relativePath), "utf8");
    if (!content.includes(generatedSchemaDocs)) errors.push(`${relativePath}: generated task-artifact schema block is stale; run npm run sync.`);
  }
}

const syncAdapter = await readFile(path.join(root, "tools", "sync-adapters.mjs"), "utf8");
if (!syncAdapter.includes("packageManifest.version")) errors.push("Sync adapter does not read the canonical package version.");
if (/\bversion\s*:\s*["']\d+\.\d+\.\d+/.test(syncAdapter)) errors.push("Sync adapter contains a hardcoded semantic version.");

const ownerExampleStatus = "missing-owner-example";
for (const relativePath of [
  "README.md",
  "skills/agrimap-agent-skills/references/patterns/conflict-resolution.md",
  "skills/agrimap-agent-skills/references/patterns/pattern-status.md",
]) {
  const content = await readFile(path.join(root, relativePath), "utf8");
  if (!content.includes(ownerExampleStatus)) errors.push(`${relativePath}: canonical owner-example status is missing`);
  if (content.includes("needs-owner-example")) errors.push(`${relativePath}: obsolete owner-example status found`);
}

for (const relativePath of [
  "skills/agrimap-agent-skills/references/patterns/frontend.md",
  "skills/agrimap-agent-skills/references/patterns/backend.md",
  "skills/agrimap-agent-skills/references/patterns/sql.md",
]) {
  const content = await readFile(path.join(root, relativePath), "utf8");
  if (!content.includes("conflict-resolution.md")) errors.push(`${relativePath}: conflict-resolution link missing`);
}

const delegationReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "subagents-and-branches.md"), "utf8");
for (const marker of ["one writer model per wave", "workspace_need", "base commit", "isolated-sandbox", "portable patch", "Neither the requester nor decision owner is responsible"])
  if (!delegationReference.includes(marker)) errors.push(`Delegation contract missing marker: ${marker}`);
for (const marker of ["For QA delegation, import [qa-and-done.md]", "single policy source", "do not restate", "isolation: worktree", "normal subagent starts in the current working directory"])
  if (!delegationReference.includes(marker)) errors.push(`Delegation composition contract missing marker: ${marker}`);
for (const forbidden of ["product_artifacts: read-only", "workflow_writes:", QA_FAILED_EVENT])
  if (delegationReference.includes(forbidden)) errors.push(`Delegation reference duplicates canonical QA policy: ${forbidden}`);
for (const marker of ["Current Codex surfaces expose native agent activity", "CLI `/agent`", "background-agent panel", "at least every 60 seconds", "Only when the active surface genuinely lacks it", "do not write per step", "once per five minutes"])
  if (!delegationReference.includes(marker)) errors.push(`Native subagent visibility contract missing marker: ${marker}`);
if (delegationReference.includes("one `step` line per ordered step")) errors.push("Subagent progress contract still requires per-step heartbeat writes.");

const workflowReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "workflows.md"), "utf8");
for (const marker of ["contains no executable lifecycle or operation rules", "Normal `agm-*` invocations must not load it", "lifecycle-core.md", "generated `operations/<operation>.md`", "do not merge multiple operation contracts"])
  if (!workflowReference.includes(marker)) errors.push(`Workflow source map missing marker: ${marker}`);
if (workflowReference.split(/\r?\n/).length > 30) errors.push("Workflow source map has regrown into a duplicated execution contract.");

const rolesReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "roles.md"), "utf8");
if (rolesReference.split(/\r?\n/).length > 40) errors.push("Role map has regrown into a duplicated execution contract.");

const sqlPattern = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "patterns", "sql.md"), "utf8");
for (const marker of ["sql-contract-preflight.mjs --target-kind sql-table|sql-procedure --object <OBJECT>", "install-sqlfluff.mjs", "CommandNotFound", "ENOENT", "other failures never install", "sqlfluff format --exclude-rules \"CP02, LT01, RF06\" --dialect tsql <FILE>.sql", "sqlfluff format --exclude-rules \"CP02, LT01, RF06\" --dialect tsql .", "format_set", "formatted N/N", "Do not hand-tune cosmetic indentation, alignment, wrapping, or whitespace", "nonzero folder exit is incomplete", "validate-sql-artifacts.mjs --files", "Use OS temp for probes and always clean it", "never create `.tmp-*` under project/workspace", "Every new table and procedure belongs to `[agrimap_app]`", "## Message collection gate", "`messages.sql`", "[agrimap_app].[LUT_APP_MESSAGES] ([ID], [DESCR])", "same code + same meaning", "same code + different or ambiguous meaning", "`IF NOT EXISTS`", "`no message changes`", "`readability-organization`", "`strict-preserve-logic`", "Neither lane uses ScriptDom"])
  if (!sqlPattern.includes(marker)) errors.push(`SQL message-collection contract missing marker: ${marker}`);
for (const marker of ["### Stored procedure section comments", "-- Validate required parameters", "-- Validate WIDGET_TYPE_ID", "-- Begin Transaction", "-- Step 1: Insert dashboard widget", "-- Return PO_DATA", "-- Commit Transaction", "-- Rollback Transaction"])
  if (!sqlPattern.includes(marker)) errors.push(`SQL procedure-comment contract missing marker: ${marker}`);

const promptReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "prompt.md"), "utf8");
for (const marker of ["V0 is only the requester input/start state", "first finalized model answer creates V1", "Never overwrite", "PROMPT_SOURCE_CONFIRM_REQUIRED", "one Prompt Package file", "## Main Assignment", "## Subagent Assignments", "Main ownership of integration", "scripts/agm-prompt-version.mjs create", "never product files or `tasks/**`", "agm-exec` accepts only an approved Prompt Result"])
  if (!promptReference.includes(marker)) errors.push(`agm-prompt contract missing marker: ${marker}`);

const executionReportTemplate = await readFile(path.join(root, "skills", "agrimap-agent-skills", "assets", "templates", "execution-report.md"), "utf8");
for (const marker of ["# Execution Log — {{TASK_TITLE}}", ".agrimap-agent/reports/<year>-<month>/<ddHHmmss>-<context>.md", "## Metadata", "## Linked Artifacts", "## Objectives", "## Files Read (Analysis Phase)", "## Files Generated (NEW)", "## Files Modified", "## Issues Found & Resolved", "## Task Files Status", "## Summary", "## Completion Checklist", "# Appendix — Task File Mini-Templates", ".agrimap-agent/prompts/<year>-<month>/<session_id|context_id|room_id>/<context>.md"])
  if (!executionReportTemplate.includes(marker)) errors.push(`Execution report template missing marker: ${marker}`);
if (executionReportTemplate.includes("tasks/<year>-<month>/<task_id>/execution_log.md")) errors.push("Execution report template still claims it lives under tasks/**.");
if (!workspaceScriptReference.includes('renderAssetTemplate("execution-report.md"')) errors.push("Workspace completion does not render the canonical execution-report.md template.");
for (const forbidden of ["./agrimap-agent/prompts", "agrimap-agent/requirements", 'path.join(root, "agrimap-agent")', 'path.join(cwd, "agrimap-agent")']) {
  if (workspaceScriptReference.includes(forbidden)) errors.push(`Non-dot workflow state path is forbidden: ${forbidden}`);
}

const urlMatrixReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "application-url-matrix.md"), "utf8");
for (const marker of [
  "http://localhost:4200/callback",
  "http://localhost:4201/agrimap-platform-wa/callback",
  "http://localhost:4202/agrimap-suite-wa/ii-online",
  "http://localhost:4202/agrimap-suite-wa/executive",
  "https://appserv2.cdg.co.th/agrimap-suite-wa/callback",
  "https://agrimap-online.cdg.co.th/callback",
  "https://agrimap-ex.ldd.go.th/callback",
  "https://agrimap-pro.ldd.go.th/callback",
  "Default` and `Normal` share the callback URL",
  "Never synthesize a URL by generic string concatenation",
  "Unsupported combinations return an explicit unsupported result",
]) {
  if (!urlMatrixReference.includes(marker)) errors.push(`Application URL matrix missing marker: ${marker}`);
}
for (const operation of ["analyze", "diagnose", "simulate", "plan", "design", "architect", "review", "fe", "be", "qa", "prompt", "execute"]) {
  const item = operations?.operations?.find((candidate) => candidate.operation === operation);
  if (!item?.conditionalReferences?.some((reference) => reference.path === "application-url-matrix.md")) errors.push(`${operation} must conditionally route to application-url-matrix.md.`);
}

for (const marker of ["PREMATURE_RESULT_ARTIFACT", "PREMATURE_QA_ARTIFACT", "CHECKPOINT_FIELD_BUDGETS"])
  if (!workspaceScriptReference.includes(marker)) errors.push(`Workspace phase/budget guard missing marker: ${marker}`);

const qaReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "qa-and-done.md"), "utf8");
for (const marker of ["single policy source", "Start every QA request at `depth=light` and `qa_mode=light`", "Product artifacts are read-only", "Result Package as testimony", "Verification tool allowlist", "SQLFluff installation and formatting are writer actions and are excluded", "Do not use LocalDB, dbserver, SQL Server", "dotnet build <existing-project-or-solution>", "npm run start:agrimap:development", "There is no conditional pass", "non-terminal `qa-finding`", "fresh verifier runs full QA", `terminal audit event is \`${QA_FAILED_EVENT}\``, "Regulated completion gate"])
  if (!qaReference.includes(marker)) errors.push(`QA contract missing marker: ${marker}`);
if ((qaReference.match(new RegExp(QA_FAILED_EVENT, "g")) || []).length !== 1) errors.push("qa-and-done.md must own exactly one literal terminal QA event name.");
if (qaReference.split(/\r?\n/).length > 80) errors.push("Canonical QA contract exceeds its 80-line budget.");

const compactPolicySources = new Map([
  ["SKILL.md", canonicalSkill],
  ["lifecycle-core.md", lifecycleCoreReference],
  ["runtime-core.md", runtimeCoreReference],
  ["workflows.md", workflowReference],
  ["roles.md", rolesReference],
  ["subagents-and-branches.md", delegationReference],
  ["prompt.md", promptReference],
]);
for (const [sourceName, content] of compactPolicySources) {
  if (content.includes(QA_FAILED_EVENT)) errors.push(`${sourceName} duplicates the terminal QA event owned by qa-and-done.md.`);
  if (/independent\s+(?:read-only|verification-only)?\s*QA/i.test(content)) errors.push(`${sourceName} duplicates the verifier boundary owned by qa-and-done.md.`);
}
if (delegationReference.split(/\r?\n/).length > 80) errors.push("Delegation reference exceeds its 80-line budget.");

const hookContextReference = await readFile(path.join(root, "skills", "agrimap-agent-skills", "scripts", "hook-context.mjs"), "utf8");
for (const forbidden of ["./agrimap-agent/prompts", "agrimap-agent/requirements", 'path.join(root, "agrimap-agent")', 'path.join(cwd, "agrimap-agent")']) {
  if (hookContextReference.includes(forbidden)) errors.push(`Hook contains a non-dot workflow state path: ${forbidden}`);
}
for (const marker of ["light creates no tasks/** artifacts", "every depth requires memory and audit attribution", "Reopen project memory on demand", "lifecycle-core.md", "Raw requester submits contain no AI answers"])
  if (!hookContextReference.includes(marker)) errors.push(`Hook lifecycle guidance missing marker: ${marker}`);

const frontendDiscipline = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "frontend-engineer.md"), "utf8");
if (!frontendDiscipline.includes("embedded supporting discipline is not a standalone workflow/alias")) errors.push("Frontend engineering is not defined as a composable discipline.");
if (frontendDiscipline.includes("`/agm-fe-engineer`")) errors.push("Frontend engineering still declares a standalone alias.");

const backendDiscipline = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "backend-engineer.md"), "utf8");
for (const marker of ["embedded supporting discipline", "`be-main`", "`be-library`", "`agmws`", "`agmbo`", "`foundation`", "`active-development`", "`stabilization`", "Do not add Type A/B/C or a required `change_kind`"])
  if (!backendDiscipline.includes(marker)) errors.push(`Backend discipline missing marker: ${marker}`);
if (backendDiscipline.includes("Require `change_kind`")) errors.push("Backend discipline incorrectly requires change_kind.");
for (const marker of ["## HTTP request-value normalization", "013-1-extensions-request-value-normalize.md", "both `be-main` and `be-library`", "direct `Request.Headers`", "require no DI registration", "Do not mass-replace mechanically"])
  if (!backendDiscipline.includes(marker)) errors.push(`Backend request normalization discipline missing marker: ${marker}`);
const requestValueReference = "patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md";
for (const operation of ["analyze", "diagnose", "be", "qa"]) {
  const item = operations?.operations?.find((candidate) => candidate.operation === operation);
  const routedReferences = [...(item?.references || []), ...(item?.conditionalReferences || [])];
  if (!routedReferences.some((reference) => reference.path === requestValueReference)) errors.push(`${operation} does not route to the backend request-value normalization contract.`);
}
for (const marker of ["## Error/message reconciliation", "same code + same meaning", "same code + different or ambiguous meaning", "`IF NOT EXISTS`", "`no message changes`"])
  if (!backendDiscipline.includes(marker)) errors.push(`Backend message-reconciliation contract missing marker: ${marker}`);

const modelMatrix = await readFile(path.join(root, "skills", "agrimap-agent-skills", "references", "model-capability-matrix.yaml"), "utf8");
if (modelMatrix.includes("fable5")) errors.push("Fable is duplicated as fable and fable5 instead of one model label.");
if (!modelMatrix.includes("fable: Fable 5")) errors.push("Fable 5 display label is missing.");
if (!modelMatrix.includes("mode: sparse_overrides") || !modelMatrix.includes("fallback: model_key")) errors.push("Display-label fallback policy must declare sparse overrides with model-key fallback.");
for (const marker of ["provider_entries_are: configurable_model_labels", "configured_field: modelLabel", "execution_field: model", "actual_host_reported_model_or_unknown"])
  if (!modelMatrix.includes(marker)) errors.push(`Model identity policy missing marker: ${marker}`);
if (!/^  gemini:\r?$/m.test(modelMatrix) || !modelMatrix.includes("gemini-cli-default")) errors.push("Gemini model capability routing is missing.");
if (!promptReference.includes("provider") || !promptReference.includes("model")) errors.push("agm-prompt provider/model metadata contract is missing.");

const rootIgnore = await readFile(path.join(root, ".gitignore"), "utf8").catch(() => "");
if (!rootIgnore.split(/\r?\n/).includes(".agrimap-agent/")) errors.push("Development repository must ignore its entire local .agrimap-agent state.");

const goldenManifest = await parseJson("skills/agrimap-agent-skills/references/patterns/golden/manifest.json");
if (goldenManifest?.annotation !== "../conflict-resolution.md") errors.push("Golden manifest does not point to the canonical conflict annotation.");
if (packageManifest?.repository?.url !== "git+https://github.com/gasxhermvc/agrimap-agent-skills.git") errors.push("Package repository URL is invalid.");

const referenceRoot = path.join(root, "skills", "agrimap-agent-skills", "references");
for (const file of (await filesUnder(referenceRoot)).filter((candidate) => candidate.endsWith(".md") && !candidate.includes(`${path.sep}patterns${path.sep}golden${path.sep}`))) {
  const content = await readFile(file, "utf8");
  if (content.split(/\r?\n/).length > 100 && !/^## (?:สารบัญ|Table of contents|Contents)\s*$/m.test(content.split(/\r?\n/).slice(0, 45).join("\n"))) {
    errors.push(`${path.relative(root, file)}: reference over 100 lines must include a top-level table of contents near the start.`);
  }
}
for (const file of (await filesUnder(path.join(referenceRoot, "patterns", "golden"))).filter((candidate) => candidate.endsWith(".json"))) {
  try {
    JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(root, file)}: .json golden file is not strict JSON: ${error.message}`);
  }
}

if (await exists(path.join(root, ".agm"))) errors.push("Legacy .agm directory must not exist.");
if (await exists(path.join(root, ".agrimap-agent", "owner.json"))) errors.push("Shared owner.json must not exist.");
if (await exists(path.join(root, ".agrimap-agent", "runtime", "active-task.json"))) errors.push("Shared active-task.json must not exist.");

for (const [label, manifest] of [["Codex", codexPlugin], ["Claude", claudePlugin], ["Gemini", geminiExtension]]) {
  if (manifest && manifest.name !== "agrimap-agent-skills") errors.push(`${label} manifest name differs from agrimap-agent-skills.`);
  if (manifest && manifest.version !== packageManifest?.version) errors.push(`${label} manifest version differs from package version ${packageManifest?.version}.`);
}
if (codexMarketplace?.plugins?.[0]?.source?.path !== "./plugins/agrimap-agent-skills") errors.push("Codex marketplace source path is invalid.");
if (claudeMarketplace?.plugins?.[0]?.source !== "./plugins/agrimap-agent-skills") errors.push("Claude marketplace source path is invalid.");
if (claudeMarketplace?.plugins?.[0]?.version !== packageManifest?.version) errors.push(`Claude marketplace version differs from package version ${packageManifest?.version}.`);
if (!geminiHooks?.hooks?.SessionStart || !geminiHooks?.hooks?.BeforeAgent) errors.push("Gemini context hooks are incomplete.");
const geminiMcpServers = geminiExtension?.mcpServers;
const geminiMcpNames = geminiMcpServers ? Object.keys(geminiMcpServers) : [];
if (geminiMcpNames.length !== 1 || geminiMcpNames[0] !== "agrimap") {
  errors.push("Gemini extension must declare exactly one MCP server named `agrimap` (no underscore) to serve bundled references.");
} else {
  const agrimapServer = geminiMcpServers.agrimap;
  const mcpArgs = Array.isArray(agrimapServer?.args) ? agrimapServer.args.join(" ") : "";
  if (agrimapServer?.command !== "node") errors.push("Gemini MCP server must launch with `node`.");
  if (!mcpArgs.includes("${extensionPath}") || !mcpArgs.includes("scripts") || !mcpArgs.includes("mcp-server.mjs")) {
    errors.push("Gemini MCP server args must resolve mcp-server.mjs through ${extensionPath}.");
  }
}
if (packageManifest && !packageManifest?.scripts?.["test:unit"]?.includes("mcp-server.test.mjs")) errors.push("Gemini MCP server test is not wired into the automated unit suite.");
if (codexPlugin?.hooks !== "./hooks/codex-hooks.json") errors.push("Codex manifest must select the Codex-specific hook file.");
if (claudePlugin?.hooks !== "./hooks/claude-hooks.json") errors.push("Claude manifest must select the Claude-specific hook file.");
if (await exists(path.join(root, "plugins", "agrimap-agent-skills", "hooks", "hooks.json"))) errors.push("Ambiguous default plugin hooks/hooks.json must not exist.");
if (!codexHooks?.hooks?.SessionStart || !codexHooks?.hooks?.UserPromptSubmit || !codexHooks?.hooks?.SubagentStart) errors.push("Codex context hooks are incomplete.");
if (!claudeHooks?.hooks?.SessionStart || !claudeHooks?.hooks?.UserPromptSubmit || !claudeHooks?.hooks?.SubagentStart) errors.push("Claude context hooks are incomplete.");
const codexHookCommands = hookCommands(codexHooks);
if (!codexHookCommands.length || codexHookCommands.some((command) => !command.includes("--provider codex") || !command.includes("${PLUGIN_ROOT}"))) errors.push("Codex hooks must pass an explicit codex provider and use PLUGIN_ROOT.");
const claudeHookCommands = hookCommands(claudeHooks);
if (!claudeHookCommands.length || claudeHookCommands.some((command) => !command.includes("--provider claude"))) errors.push("Claude hooks must pass an explicit claude provider.");
const geminiHookCommands = hookCommands(geminiHooks);
if (!geminiHookCommands.length || geminiHookCommands.some((command) => !command.includes("--provider gemini"))) errors.push("Gemini hooks must pass an explicit gemini provider.");

if (operations) {
  const names = operations.operations.map((item) => item.name);
  if (new Set(names).size !== names.length) errors.push("Operation aliases are not unique.");
  if (names.includes("agm-fe-engineer")) errors.push("Passive frontend discipline must not expose agm-fe-engineer.");
  if (!operations.operations.some((item) => item.name === "agm-history" && item.operation === "history")) errors.push("agm-history operation is required for durable requester/task queries.");
  for (const [name, actions] of Object.entries({ "agm-fe": ["analyze", "design", "create", "edit", "refactor", "test"], "agm-be": ["analyze", "design", "create", "edit", "refactor", "test"], "agm-sql": ["analyze", "design", "create", "edit", "refactor", "explain"] })) {
    const item = operations.operations.find((candidate) => candidate.name === name);
    if (item?.mode !== "action-routed") errors.push(`${name} must be action-routed.`);
    if (JSON.stringify(item?.actions?.map((action) => action.name)) !== JSON.stringify(actions)) errors.push(`${name} action list is invalid.`);
  }
  for (const name of ["agm-fe", "agm-be", "agm-sql"]) {
    const refactor = operations.operations.find((item) => item.name === name)?.actions?.find((action) => action.name === "refactor");
    if (refactor?.mode !== "product-write" || refactor?.activation !== "explicit" || JSON.stringify(refactor?.depths) !== JSON.stringify(["light", "standard", "regulated"])) {
      errors.push(`${name} action=refactor must be explicit product-write at light|standard|regulated.`);
    }
  }
  for (const keptName of ["agm-analyze", "agm-design"])
    if (!operations.operations.some((item) => item.name === keptName && item.visibility !== "compatibility")) errors.push(`${keptName} must remain a primary operation.`);
  for (const removedName of ["agm-create-feature", "agm-create-unit-test", "agm-refactor", "agm-refactor-fe", "agm-refactor-be", "agm-refactor-sql", "agm-create-prompt"])
    if (operations.operations.some((item) => item.name === removedName)) errors.push(`${removedName} must be absent from the distributed operation surface.`);
  const promptOperation = operations.operations.find((item) => item.name === "agm-prompt" && item.operation === "prompt");
  if (promptOperation?.mode !== "workflow-write-only" || JSON.stringify(promptOperation?.depth) !== JSON.stringify({ default: "light", allowed: ["light"] }) || !promptOperation?.deliverable?.includes("never tasks/**")) {
    errors.push("agm-prompt must be light-only workflow-write-only and artifactless.");
  }
  for (const name of names) {
    for (const target of [
      path.join(root, "commands", `${name}.toml`),
      path.join(root, "plugins", "agrimap-agent-skills", "skills", name, "SKILL.md"),
    ]) {
      if (!(await exists(target))) errors.push(`${path.relative(root, target)}: generated adapter missing`);
    }
  }
  const commands = (await filesUnder(path.join(root, "commands"))).filter((file) => file.endsWith(".toml"));
  if (commands.length !== names.length) errors.push(`Expected ${names.length} Gemini commands; found ${commands.length}.`);
}

for (const command of await filesUnder(path.join(root, "commands"))) {
  if (!command.endsWith(".toml")) continue;
  const content = await readFile(command, "utf8");
  if (!/^description = ".+"\r?\nprompt = ".+"\r?\n$/s.test(content)) errors.push(`${path.relative(root, command)}: unexpected TOML adapter shape`);
  if (content.includes("\\\\n")) errors.push(`${path.relative(root, command)}: contains literal escaped newline text`);
}

const canonicalDirectory = path.join(root, "skills", "agrimap-agent-skills");
const pluginCanonicalDirectory = path.join(root, "plugins", "agrimap-agent-skills", "skills", "agrimap-agent-skills");
const canonicalFiles = (await filesUnder(canonicalDirectory)).map((file) => path.relative(canonicalDirectory, file)).sort();
const pluginCanonicalFiles = (await filesUnder(pluginCanonicalDirectory)).map((file) => path.relative(pluginCanonicalDirectory, file)).sort();

for (const relativeFile of canonicalFiles.filter((file) => file.endsWith(".md"))) {
  const sourcePath = path.join(canonicalDirectory, relativeFile);
  const content = await readFile(sourcePath, "utf8");
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim();
    if (/^(?:https?:\/\/|mailto:|#)/i.test(rawTarget)) continue;
    const target = rawTarget.split("#", 1)[0];
    const resolvedTarget = path.resolve(path.dirname(sourcePath), target);
    const relativeTarget = path.relative(canonicalDirectory, resolvedTarget);
    if (relativeTarget === ".." || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
      errors.push(`${path.relative(root, sourcePath)}: relative link escapes the standalone skill root: ${rawTarget}`);
    } else if (!(await exists(resolvedTarget))) {
      errors.push(`${path.relative(root, sourcePath)}: relative link target is missing: ${rawTarget}`);
    }
  }
}

if (JSON.stringify(canonicalFiles) !== JSON.stringify(pluginCanonicalFiles)) {
  errors.push("Plugin routing-skill/shared-resource file list differs from the authored source; run npm run sync.");
} else {
  for (const relativeFile of canonicalFiles) {
    const authored = await readFile(path.join(canonicalDirectory, relativeFile));
    const generated = await readFile(path.join(pluginCanonicalDirectory, relativeFile));
    if (!authored.equals(generated)) errors.push(`Plugin canonical copy differs: ${relativeFile}`);
  }
}

try {
  const result = JSON.parse(execFileSync(process.execPath, [path.join(root, "skills", "agrimap-agent-skills", "scripts", "verify-golden.mjs")], { cwd: root, encoding: "utf8" }));
  assert.equal(result.ok, true);
} catch (error) {
  errors.push(`Golden verification failed: ${error.message}`);
}

if (errors.length) {
  process.stdout.write(`${JSON.stringify({ ok: false, errors }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ ok: true, aliases: operations.operations.length, checks: "manifests, provider isolation, adapters, routing-only skill, dedicated operation skills, task-artifact schema/templates/docs, glossary, delegation ownership, usage examples, golden sources" }, null, 2)}\n`);
}
