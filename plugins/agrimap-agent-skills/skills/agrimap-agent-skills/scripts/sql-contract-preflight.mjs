#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./cli-args.mjs";
import { verifyGolden } from "./verify-golden.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDirectory, "..");
const goldenRoot = path.join(skillRoot, "references", "patterns", "golden");
const sqlGoldenRoot = path.join(goldenRoot, "sql");
const objectNamePattern = /^[A-Z][A-Z0-9_]*$/;

function procedureSuffix(name) {
  for (const suffix of ["_CHECK_Q", "_I", "_U", "_D", "_Q"]) {
    if (name.endsWith(suffix)) return suffix;
  }
  return null;
}

function entryKind(content) {
  if (/\bCREATE\s+TABLE\b/i.test(content)) return "sql-table";
  if (/\b(?:CREATE\s+OR\s+ALTER|CREATE|ALTER)\s+PROCEDURE\b/i.test(content)) return "sql-procedure";
  return "support";
}

function selectionScore(entry, targetKind, objectName, content) {
  const heading = String(entry.heading || "").toUpperCase();
  const fileStem = path.parse(entry.fileName).name.toUpperCase();
  const kind = entryKind(content);
  if (kind !== targetKind) return -1;

  let score = entry.status === "current" ? 30 : 10;
  if (heading === objectName || fileStem === objectName) score += 1000;

  const objectTokens = new Set(objectName.split("_").filter((token) => token.length > 1));
  for (const token of fileStem.split("_")) if (objectTokens.has(token)) score += 8;

  if (targetKind === "sql-table") {
    const lookupTarget = objectName.startsWith("LUT_");
    const lookupExample = fileStem.startsWith("LUT_");
    if (lookupTarget === lookupExample) score += 200;
    if (fileStem === "LUT_APP_MESSAGES" && objectName !== fileStem) score = -1;
  } else if (procedureSuffix(fileStem) === procedureSuffix(objectName)) {
    score += 300;
  }
  return score;
}

export async function sqlContractPreflight({ targetKind, objectName, integrityVerifier = verifyGolden } = {}) {
  const normalizedKind = String(targetKind || "").toLowerCase();
  const normalizedObject = String(objectName || "").replace(/\.sql$/i, "").toUpperCase();
  const issues = [];
  if (!["sql-table", "sql-procedure"].includes(normalizedKind)) {
    issues.push({ code: "SQL_TARGET_KIND_REQUIRED", message: "--target-kind must be sql-table or sql-procedure" });
  }
  if (!objectNamePattern.test(normalizedObject)) {
    issues.push({ code: "SQL_OBJECT_REQUIRED", message: "--object must be one canonical SQL object name" });
  }
  if (normalizedKind === "sql-procedure" && normalizedObject && !procedureSuffix(normalizedObject)) {
    issues.push({ code: "PROCEDURE_SUFFIX_INVALID", message: "procedure must end with _I, _U, _D, _Q, or _CHECK_Q" });
  }
  if (issues.length) return { ok: false, gate: "SQL_CONTRACT_BLOCKED", issues };

  const integrity = await integrityVerifier({ goldenRoot });
  const warnings = integrity.ok
    ? []
    : [{
        code: "GOLDEN_INTEGRITY_INVALID",
        message: "Package-wide golden integrity validation failed; continuing with installed SQL references.",
        issues: integrity.failures.map((failure) => ({ code: failure.code, path: failure.path })),
      }];

  const manifest = JSON.parse(await readFile(path.join(sqlGoldenRoot, "manifest.json"), "utf8"));
  const candidates = [];
  for (const entry of manifest.examples) {
    if (entry.language !== "sql" || entry.fileName === "LUT_APP_MESSAGES.example.sql") continue;
    const content = await readFile(path.join(sqlGoldenRoot, entry.fileName), "utf8");
    const score = selectionScore(entry, normalizedKind, normalizedObject, content);
    if (score >= 0) candidates.push({ entry, score });
  }
  candidates.sort((left, right) => right.score - left.score || left.entry.fileName.localeCompare(right.entry.fileName));
  if (!candidates.length) {
    return {
      ok: false,
      gate: "GOLDEN_EXAMPLE_NOT_FOUND",
      issues: [{ code: "GOLDEN_EXAMPLE_NOT_FOUND", message: `no ${normalizedKind} golden example is available` }],
    };
  }

  const primary = candidates[0].entry;
  const message = manifest.examples.find((entry) => entry.fileName === "LUT_APP_MESSAGES.example.sql");
  if (!message) {
    return {
      ok: false,
      gate: "MESSAGE_TEMPLATE_NOT_FOUND",
      issues: [{ code: "MESSAGE_TEMPLATE_NOT_FOUND", message: "SQL golden manifest must declare LUT_APP_MESSAGES.example.sql" }],
    };
  }

  const goldenPath = (fileName) => `references/patterns/golden/sql/${fileName}`;
  return {
    ok: true,
    gate: "SQL_CONTRACT_READY",
    targetKind: normalizedKind,
    object: normalizedObject,
    warnings,
    requiredReferences: [
      "references/patterns/conflict-resolution.md",
      "references/patterns/sql.md",
      "references/patterns/golden/sql/manifest.json",
    ],
    requiredNormalizations: normalizedKind === "sql-procedure"
      ? [{
          code: "PROCEDURE_DECLARATION_CANONICAL",
          requirement: "Render every created or edited procedure with CREATE OR ALTER PROCEDURE, even when selected raw-immutable evidence uses standalone CREATE PROCEDURE or ALTER PROCEDURE.",
        }]
      : [],
    selectedGolden: [
      { role: "structure", path: goldenPath(primary.fileName), status: primary.status, evidenceMode: primary.evidenceMode },
      { role: "messages", path: goldenPath(message.fileName), status: message.status, evidenceMode: message.evidenceMode },
    ],
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const result = await sqlContractPreflight({ targetKind: args["target-kind"], objectName: args.object });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
