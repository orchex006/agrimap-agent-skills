#!/usr/bin/env node
// Claude Stop hook (ACG C8 §11.3): blocks the end of a turn once per execution
// when verified work is not delivered although the confirmed workflow policy
// commits on completion. stop_hook_active or a written marker never block
// again, so it cannot loop. Fail-open; governance.guards:false is a no-op.
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPolicy } from "./workflow-policy.mjs";
import { safeSession } from "./session-state.mjs";

export const REMINDER_REASON = "AGM: work is verified but not delivered. Run deliver plan/apply per workflow policy, or tell the user why delivery is skipped.";

async function readJson(file) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return null; }
}

async function executionEvents(state, executionId) {
  const events = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === `${executionId}.jsonl` || (entry.name.endsWith(".jsonl") && !/^\d/.test(entry.name))) {
        for (const line of (await readFile(full, "utf8").catch(() => "")).split(/\r?\n/)) {
          if (!line.includes(executionId)) continue;
          try { const event = JSON.parse(line); if ((event.execution_id || event.executionId) === executionId) events.push(event); } catch { /* skip */ }
        }
      }
    }
  }
  await walk(path.join(state, "logs"));
  return events;
}

function ownDirty(root, preexisting) {
  const pre = new Set((preexisting || []).map(entry => entry.path));
  let stdout = "";
  try { stdout = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return []; }
  return stdout.split("\0").filter(record => record.length > 3).map(record => record.slice(3).replaceAll("\\", "/"))
    .filter(file => !file.startsWith(".agrimap-agent/") && !pre.has(file));
}

export async function reminderFor(input) {
  if (input.stop_hook_active === true || input.stopHookActive === true) return null;
  const session = safeSession(input.session_id || input.sessionId);
  if (!session) return null;
  let root = null;
  try { root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: path.resolve(input.cwd || process.cwd()), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; }
  const state = path.join(root, ".agrimap-agent");
  const config = await readJson(path.join(state, "config.json"));
  if (config?.governance?.guards === false || config?.governance?.delivery === false) return null;
  const active = await readJson(path.join(state, "runtime", "active", `${session}.json`));
  if (!active?.executionId || active.delivery?.commit) return null;
  const marker = path.join(state, "runtime", "reminders", safeSession(active.executionId));
  if (await readFile(marker, "utf8").then(() => true, () => false)) return null;
  const loaded = await loadPolicy(root);
  if (loaded.policy?.status !== "confirmed" || loaded.policy?.delivery?.commitOnComplete !== true) return null;
  const events = await executionEvents(state, active.executionId);
  const verified = events.some(event => event.event === "verified" && (event.verification_status || event.verificationStatus || "passed") === "passed");
  if (!verified || events.some(event => event.event === "delivered")) return null;
  if (!ownDirty(root, active.preexistingDirty).length) return null;
  await mkdir(path.dirname(marker), { recursive: true });
  await writeFile(marker, `${new Date().toISOString()}\n`, "utf8");
  return { decision: "block", reason: REMINDER_REASON };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    const output = await reminderFor(text ? JSON.parse(text) : {});
    if (output) process.stdout.write(JSON.stringify(output));
  } catch (error) {
    process.stderr.write(`AGM delivery reminder skipped (fail-open): ${String(error?.message || error).slice(0, 160)}\n`);
  }
}
