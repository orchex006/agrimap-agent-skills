#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./cli-args.mjs";

const modulePath = fileURLToPath(import.meta.url);
const moduleDirectory = path.dirname(modulePath);
const defaultSkillRoot = path.resolve(moduleDirectory, "..");

const DEFAULT_TOKEN_ESTIMATE = Object.freeze({
  lowCharsPerToken: 4,
  highCharsPerToken: 3,
});

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeSlashes(value) {
  return String(value).replaceAll("\\", "/");
}

export function normalizeReferencePath(referencePath) {
  const withoutAnchor = String(referencePath || "").split("#", 1)[0];
  return normalizeSlashes(withoutAnchor).replace(/^\.\//u, "").replace(/^references\//u, "");
}

export function measureText(text, tokenEstimate = DEFAULT_TOKEN_ESTIMATE) {
  const value = String(text);
  const words = value.match(/\S+/gu)?.length || 0;
  const characters = value.length;
  return {
    words,
    characters,
    lines: value.length === 0 ? 0 : value.split(/\r?\n/u).length,
    estimatedTokensLow: Math.ceil(characters / tokenEstimate.lowCharsPerToken),
    estimatedTokensHigh: Math.ceil(characters / tokenEstimate.highCharsPerToken),
  };
}

function sumMeasurements(records, tokenEstimate) {
  const totals = records.reduce(
    (result, record) => ({
      words: result.words + record.measurement.words,
      characters: result.characters + record.measurement.characters,
      lines: result.lines + record.measurement.lines,
    }),
    { words: 0, characters: 0, lines: 0 },
  );
  return {
    ...totals,
    estimatedTokensLow: Math.ceil(totals.characters / tokenEstimate.lowCharsPerToken),
    estimatedTokensHigh: Math.ceil(totals.characters / tokenEstimate.highCharsPerToken),
  };
}

export function routeCoverageIssues(scenario, operation) {
  const availableConditional = new Set(
    (operation.conditionalReferences || []).map((reference) => normalizeReferencePath(reference.path)),
  );
  const issues = [];
  for (const referencePath of scenario.activate || []) {
    const normalized = normalizeReferencePath(referencePath);
    if (!availableConditional.has(normalized)) {
      issues.push({
        code: "ROUTE_REFERENCE_MISSING",
        reference: normalized,
        message: `${operation.operation} does not declare conditional reference ${normalized}`,
      });
    }
  }
  return issues;
}

export function budgetIssuesForStage(stageName, measurement, budget = {}) {
  const issues = [];
  if (Number.isFinite(budget.maxWords) && measurement.words > budget.maxWords) {
    issues.push({
      code: "WORD_BUDGET_EXCEEDED",
      stage: stageName,
      actual: measurement.words,
      limit: budget.maxWords,
      message: `${stageName} uses ${measurement.words} words; budget is ${budget.maxWords}`,
    });
  }
  if (Number.isFinite(budget.maxEstimatedTokensHigh) && measurement.estimatedTokensHigh > budget.maxEstimatedTokensHigh) {
    issues.push({
      code: "TOKEN_BUDGET_EXCEEDED",
      stage: stageName,
      actual: measurement.estimatedTokensHigh,
      limit: budget.maxEstimatedTokensHigh,
      message: `${stageName} estimates up to ${measurement.estimatedTokensHigh} tokens; budget is ${budget.maxEstimatedTokensHigh}`,
    });
  }
  return issues;
}

async function findPackageRoot(explicitRoot) {
  if (explicitRoot) {
    const resolved = path.resolve(explicitRoot);
    if (await exists(path.join(resolved, "config", "operations.json"))) return resolved;
    throw new Error(`Package root does not contain config/operations.json: ${resolved}`);
  }

  const starts = [process.cwd(), defaultSkillRoot];
  for (const start of starts) {
    let candidate = path.resolve(start);
    while (true) {
      if (
        await exists(path.join(candidate, "config", "operations.json"))
        && await exists(path.join(candidate, "skills", "agrimap-agent-skills", "references", "lifecycle-core.md"))
      ) {
        return candidate;
      }
      const parent = path.dirname(candidate);
      if (parent === candidate) break;
      candidate = parent;
    }
  }
  throw new Error("Cannot locate the agrimap-agent-skills source repository. Run with --root <package-root>.");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validateAuditConfig(config) {
  const issues = [];
  if (config?.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (!config?.budgets || typeof config.budgets !== "object") issues.push("budgets are required");
  if (!Array.isArray(config?.scenarios)) issues.push("scenarios must be an array");
  const ids = new Set();
  for (const scenario of config?.scenarios || []) {
    if (!scenario?.id || !scenario?.operation) issues.push("every scenario needs id and operation");
    if (ids.has(scenario.id)) issues.push(`duplicate scenario id: ${scenario.id}`);
    ids.add(scenario.id);
    for (const field of ["activate", "select", "mustLoad"]) {
      if (scenario[field] !== undefined && !Array.isArray(scenario[field])) issues.push(`${scenario.id}: ${field} must be an array`);
    }
  }
  if (issues.length > 0) throw new Error(`Invalid token coverage config:\n- ${issues.join("\n- ")}`);
}

function operationBaselines(operations) {
  return operations.map((operation) => ({
    id: `baseline-${operation.operation}`,
    description: `Generated baseline for ${operation.name}`,
    operation: operation.operation,
    depth: operation.depth.default,
    activate: [],
    select: [],
    mustLoad: operation.references.map((reference) => normalizeReferencePath(reference.path)),
    generatedBaseline: true,
  }));
}

function resolveReferenceFile(skillRoot, referencePath) {
  const referencesRoot = path.resolve(skillRoot, "references");
  const normalized = normalizeReferencePath(referencePath);
  const resolved = path.resolve(referencesRoot, normalized);
  if (resolved !== referencesRoot && !resolved.startsWith(`${referencesRoot}${path.sep}`)) {
    throw new Error(`Reference escapes skill root: ${referencePath}`);
  }
  return { absolutePath: resolved, normalized };
}

async function evaluateScenario({ root, skillRoot, scenario, operation, budgets, tokenEstimate }) {
  const records = new Map();
  const issues = routeCoverageIssues(scenario, operation);
  const loadedReferencePaths = new Set();

  async function addFile(absolutePath, displayPath, group, referencePath = null) {
    const key = path.resolve(absolutePath);
    if (records.has(key)) return;
    try {
      const text = await readFile(key, "utf8");
      records.set(key, {
        path: normalizeSlashes(displayPath),
        group,
        reference: referencePath,
        measurement: measureText(text, tokenEstimate),
      });
      if (referencePath) loadedReferencePaths.add(normalizeReferencePath(referencePath));
    } catch (error) {
      issues.push({
        code: "INPUT_FILE_MISSING",
        path: normalizeSlashes(displayPath),
        message: `${displayPath}: ${error.code || error.message}`,
      });
    }
  }

  async function addReference(referencePath, group) {
    const { absolutePath, normalized } = resolveReferenceFile(skillRoot, referencePath);
    await addFile(absolutePath, path.relative(root, absolutePath), group, normalized);
  }

  if (scenario.kind === "router") {
    const routerPath = path.join(skillRoot, "SKILL.md");
    await addFile(routerPath, path.relative(root, routerPath), "direct");
  } else {
    const aliasPath = path.join(root, "plugins", "agrimap-agent-skills", "skills", operation.name, "SKILL.md");
    const lifecyclePath = path.join(skillRoot, "references", "lifecycle-core.md");
    const operationPath = path.join(skillRoot, "references", "operations", `${operation.operation}.md`);
    await addFile(aliasPath, path.relative(root, aliasPath), "direct");
    await addFile(lifecyclePath, path.relative(root, lifecyclePath), "direct");
    await addFile(operationPath, path.relative(root, operationPath), "direct");
  }
  const directRecords = [...records.values()];
  const direct = sumMeasurements(directRecords, tokenEstimate);

  for (const reference of operation.references) await addReference(reference.path, "load-now");
  const requiredRecords = [...records.values()];
  const required = sumMeasurements(requiredRecords, tokenEstimate);

  const conditionalByPath = new Map(
    (operation.conditionalReferences || []).map((reference) => [normalizeReferencePath(reference.path), reference]),
  );
  for (const referencePath of scenario.activate || []) {
    const normalized = normalizeReferencePath(referencePath);
    if (conditionalByPath.has(normalized)) await addReference(conditionalByPath.get(normalized).path, "conditional");
  }
  for (const referencePath of scenario.select || []) await addReference(referencePath, "selected");

  for (const referencePath of scenario.mustLoad || []) {
    const normalized = normalizeReferencePath(referencePath);
    if (!loadedReferencePaths.has(normalized)) {
      issues.push({
        code: "EXPECTED_REFERENCE_NOT_LOADED",
        reference: normalized,
        message: `${scenario.id} expects ${normalized}, but the scenario route does not load it`,
      });
    }
  }

  const allRecords = [...records.values()];
  const total = sumMeasurements(allRecords, tokenEstimate);
  const scenarioBudgets = {
    direct: { ...budgets.direct, ...scenario.budgets?.direct },
    required: { ...budgets.required, ...scenario.budgets?.required },
    scenario: { ...budgets.scenario, ...scenario.budgets?.scenario },
  };
  issues.push(...budgetIssuesForStage("direct", direct, scenarioBudgets.direct));
  issues.push(...budgetIssuesForStage("required", required, scenarioBudgets.required));
  issues.push(...budgetIssuesForStage("scenario", total, scenarioBudgets.scenario));

  return {
    id: scenario.id,
    description: scenario.description,
    operation: operation.operation,
    alias: operation.name,
    depth: scenario.depth || operation.depth.default,
    generatedBaseline: Boolean(scenario.generatedBaseline),
    status: issues.length === 0 ? "pass" : "warning",
    stages: { direct, required, scenario: total },
    files: allRecords,
    issues,
  };
}

function formatTokens(measurement) {
  return `${measurement.estimatedTokensLow.toLocaleString("en-US")}-${measurement.estimatedTokensHigh.toLocaleString("en-US")}`;
}

function renderTextReport(report, details) {
  const lines = [
    "AgriMap token/read coverage audit",
    `Token estimate: ${report.tokenEstimate.highCharsPerToken}-${report.tokenEstimate.lowCharsPerToken} characters/token (range only; provider tokenizers differ)`,
    `Package root: ${report.root}`,
    "",
  ];
  for (const scenario of report.scenarios) {
    const marker = scenario.status === "pass" ? "PASS" : "WARN";
    lines.push(`${marker} ${scenario.id} [${scenario.operation}/${scenario.depth}]`);
    lines.push(
      `  direct ${scenario.stages.direct.words.toLocaleString("en-US")}w ~${formatTokens(scenario.stages.direct)} tok | `
      + `required ${scenario.stages.required.words.toLocaleString("en-US")}w ~${formatTokens(scenario.stages.required)} tok | `
      + `scenario ${scenario.stages.scenario.words.toLocaleString("en-US")}w/${scenario.stages.scenario.characters.toLocaleString("en-US")}c ~${formatTokens(scenario.stages.scenario)} tok`,
    );
    for (const issue of scenario.issues) lines.push(`  ! ${issue.code}: ${issue.message}`);
    if (details) {
      for (const file of scenario.files) {
        lines.push(`  - [${file.group}] ${file.path}: ${file.measurement.words}w/${file.measurement.characters}c ~${formatTokens(file.measurement)} tok`);
      }
    }
  }
  lines.push(
    "",
    `Summary: ${report.summary.scenarios} scenarios; ${report.summary.passed} passed; ${report.summary.warnings} warnings; ${report.summary.coverageIssues} coverage issues; ${report.summary.budgetIssues} budget issues`,
  );
  if (!details) lines.push("Use --details to show every loaded file, or --json for machine-readable output.");
  return `${lines.join("\n")}\n`;
}

function helpText() {
  return `Usage: node token-coverage.mjs [options]

Options:
  --scenario <id[,id]>  Audit only selected scenarios
  --list                List available scenario IDs
  --details             Show every file counted in each scenario
  --json                Return machine-readable JSON
  --strict              Exit 1 when coverage or budget issues exist
  --root <path>         Explicit source-package root
  --config <path>       Override assets/token-coverage-scenarios.json
  --help                Show this help
`;
}

export async function runTokenCoverage(options = {}) {
  const root = await findPackageRoot(options.root);
  const skillRoot = path.join(root, "skills", "agrimap-agent-skills");
  const configPath = options.config
    ? path.resolve(options.config)
    : path.join(skillRoot, "assets", "token-coverage-scenarios.json");
  const [operationConfig, auditConfig] = await Promise.all([
    readJson(path.join(root, "config", "operations.json")),
    readJson(configPath),
  ]);
  validateAuditConfig(auditConfig);
  const operations = operationConfig.operations || [];
  const routerOperation = {
    name: "agrimap-agent-skills",
    operation: "router",
    depth: { default: "light", allowed: ["light"] },
    references: [
      { path: "skill-routing.md", why: "intent x lane skill selection" },
      { path: "operation-index.md", why: "dedicated operation selection" },
      { path: "platform-syntax.md", why: "active-provider invocation rendering" }
    ],
    conditionalReferences: [],
  };
  const operationByName = new Map([
    ...operations.map((operation) => [operation.operation, operation]),
    [routerOperation.operation, routerOperation],
  ]);
  const tokenEstimate = { ...DEFAULT_TOKEN_ESTIMATE, ...(auditConfig.tokenEstimate || {}) };
  const scenarios = [
    ...(auditConfig.includeOperationBaselines === false ? [] : operationBaselines(operations)),
    ...auditConfig.scenarios,
  ];
  const selectedIds = options.scenario
    ? new Set(String(options.scenario).split(",").map((value) => value.trim()).filter(Boolean))
    : null;
  const selectedScenarios = selectedIds ? scenarios.filter((scenario) => selectedIds.has(scenario.id)) : scenarios;
  if (selectedIds) {
    const missingIds = [...selectedIds].filter((id) => !selectedScenarios.some((scenario) => scenario.id === id));
    if (missingIds.length > 0) throw new Error(`Unknown scenario: ${missingIds.join(", ")}`);
  }

  const results = [];
  for (const scenario of selectedScenarios) {
    const operation = operationByName.get(scenario.operation);
    if (!operation) throw new Error(`${scenario.id}: unknown operation ${scenario.operation}`);
    results.push(await evaluateScenario({
      root,
      skillRoot,
      scenario,
      operation,
      budgets: auditConfig.budgets,
      tokenEstimate,
    }));
  }
  const allIssues = results.flatMap((scenario) => scenario.issues);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    root: normalizeSlashes(root),
    config: normalizeSlashes(path.relative(root, configPath)),
    tokenEstimate,
    budgets: auditConfig.budgets,
    summary: {
      scenarios: results.length,
      passed: results.filter((scenario) => scenario.status === "pass").length,
      warnings: results.filter((scenario) => scenario.status !== "pass").length,
      coverageIssues: allIssues.filter((issue) => ["ROUTE_REFERENCE_MISSING", "EXPECTED_REFERENCE_NOT_LOADED", "INPUT_FILE_MISSING"].includes(issue.code)).length,
      budgetIssues: allIssues.filter((issue) => issue.code.endsWith("BUDGET_EXCEEDED")).length,
    },
    scenarios: results,
    availableScenarioIds: scenarios.map((scenario) => scenario.id),
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(helpText());
    return;
  }
  const report = await runTokenCoverage({ root: args.root, config: args.config, scenario: args.scenario });
  if (args.list) {
    process.stdout.write(`${report.availableScenarioIds.join("\n")}\n`);
    return;
  }
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : renderTextReport(report, Boolean(args.details)));
  if (args.strict && (report.summary.coverageIssues > 0 || report.summary.budgetIssues > 0)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(modulePath)) {
  main().catch((error) => {
    process.stderr.write(`TOKEN_COVERAGE_ERROR: ${error.message}\n`);
    process.exitCode = 1;
  });
}
