#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const lock = JSON.parse(readFileSync(new URL('../assets/tool-versions.json', import.meta.url), 'utf8'));
export const SQLFLUFF_VERSION = lock.sqlfluff?.version;
if (lock.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(SQLFLUFF_VERSION || '')) throw new Error('SQLFLUFF_LOCK_INVALID');
const installers = [
  ['python', ['-m', 'pip']],
  ['py', ['-m', 'pip']],
  ['pip', []],
];
const matches = result => result.status === 0 && result.stdout.match(/^sqlfluff, version (\S+)$/m)?.[1] === SQLFLUFF_VERSION;

function defaultRun(command, args) {
  return spawnSync(command, args, { encoding: "utf8", windowsHide: true });
}

function invoke(run, command, args) {
  try {
    const result = run(command, args) || {};
    return {
      command: [command, ...args].join(" "),
      status: Number.isInteger(result.status) ? result.status : null,
      stdout: String(result.stdout || "").trim(),
      stderr: String(result.stderr || result.error?.message || "").trim(),
    };
  } catch (error) {
    return { command: [command, ...args].join(" "), status: null, stdout: "", stderr: String(error?.message || error) };
  }
}

export function installSqlfluff({ run = defaultRun } = {}) {
  const initial = invoke(run, 'sqlfluff', ['--version']);
  const attempts = [initial];
  const evidence = { skillVersion: lock.skillVersion, expectedVersion: SQLFLUFF_VERSION };
  if (matches(initial)) return {ok:true, ...evidence, changed:false, installer:null, version:initial.stdout};
  for (const [command, prefix] of installers) {
    const args = [...prefix, 'install', '--upgrade', `sqlfluff==${SQLFLUFF_VERSION}`];
    const installation = invoke(run, command, args);
    attempts.push(installation);
    if (installation.status !== 0) continue;
    const verification = invoke(run, 'sqlfluff', ['--version']);
    attempts.push(verification);
    if (matches(verification)) return {ok:true, ...evidence, changed:true, installer:installation.command, version:verification.stdout};
  }

  const error = new Error("Automatic installation did not produce the locked SQLFluff version on PATH.");
  error.code = "SQLFLUFF_INSTALL_FAILED";
  error.attempts = attempts;
  throw error;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(installSqlfluff(), null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      code: error.code || "SQLFLUFF_INSTALL_FAILED",
      message: error.message,
      attempts: error.attempts || [],
    }, null, 2));
    process.exitCode = 1;
  }
}
