import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { projectRoot } from "../helpers/harness.mjs";

const sqlDiscipline = await readFile(path.join(projectRoot, "skills", "agrimap-agent-skills", "references", "patterns", "sql.md"), "utf8");
const conflictResolution = await readFile(path.join(projectRoot, "skills", "agrimap-agent-skills", "references", "patterns", "conflict-resolution.md"), "utf8");
const evals = await readFile(path.join(projectRoot, "skills", "agrimap-agent-skills", "references", "evals", "sql-scenarios.md"), "utf8");

test("applicable golden structure outranks neighboring project structure without overriding behavior", () => {
  const legacyGolden = sqlDiscipline.indexOf("4. Matching `legacy-compatible` or `unverified` golden evidence");
  const neighboringProject = sqlDiscipline.indexOf("5. Neighboring project structure");
  assert.ok(legacyGolden >= 0 && neighboringProject > legacyGolden);
  assert.match(sqlDiscipline, /never authorizes business-semantic or deployed-behavior changes/i);
  assert.match(conflictResolution, /matching legacy-compatible structural evidence/i);
  assert.match(conflictResolution, /structural precedence is not permission to break a deployed contract/i);
});

test("SQL eval catalog is reachable and encodes deterministic cross-provider gates", () => {
  assert.match(sqlDiscipline, /\[sql-scenarios\.md\]\(\.\.\/evals\/sql-scenarios\.md\)/);
  assert.match(sqlDiscipline, /do not load the eval catalog during ordinary SQL work/i);

  const matches = [...evals.matchAll(/^## S(\d+) —[^\n]+\n([\s\S]*?)(?=^## S\d+ —|^## Release gate)/gm)];
  assert.deepEqual(matches.map((match) => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const [scenarioId, body] of matches.map((match) => [`S${match[1]}`, match[2]])) {
    assert.match(body, /^\*\*Situation:\*\*/m, `${scenarioId}: Situation missing`);
    assert.match(body, /^\*\*Prompt:\*\*/m, `${scenarioId}: Prompt missing`);
    assert.match(body, /\*\*\[HARD\]\*\*/, `${scenarioId}: HARD assertion missing`);
    assert.match(body, /\*\*\[RUBRIC\]\*\*/, `${scenarioId}: RUBRIC assertion missing`);
    assert.match(body, /^\*\*Anti-pattern:\*\*/m, `${scenarioId}: anti-pattern missing`);
  }

  for (const provider of ["Claude", "Codex", "Gemini"]) assert.ok(evals.includes(provider));
  assert.match(evals, /at least three times/i);
  assert.match(evals, /validate-sql-artifacts\.mjs/);
  assert.match(evals, /formatted 3\/3/);
  assert.match(evals, /Every created or edited procedure declares `CREATE OR ALTER PROCEDURE`/);
  assert.match(evals, /standalone `CREATE PROCEDURE`, `ALTER PROCEDURE`, `CREATE PROC`, and `ALTER PROC` fail validation/);
});
