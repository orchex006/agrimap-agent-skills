#!/usr/bin/env node
// Claude Code PreToolUse gate for Edit|Write|MultiEdit|NotebookEdit (4.9.5).
// A code/SQL file in an AgriMap repository needs its lane skill (or agm-exec)
// loaded in this session first. Denies once per session and lane, then lets a
// retry through so a requester who declined skills is never locked out.
// Fail-open: any error allows the write and writes one stderr line.
// governance.skillGate:false (or governance.guards:false) makes it a no-op.
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeSession } from "./session-state.mjs";
import { laneById, laneFromPath, loadRouting, recognizedProjectName, repositoryLane } from "./skill-routing.mjs";

const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;
const SKIPPED_SEGMENTS = new Set([".agrimap-agent", "node_modules", "bin", "obj", "dist", ".git"]);

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

async function existingDirectory(target) {
  let current = path.dirname(path.resolve(target));
  for (let level = 0; level < 64; level += 1) {
    if (await stat(current).then((item) => item.isDirectory(), () => false)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return null; }
}

// Skills that satisfy a lane: its own lane skill, or agm-exec which loads every lane's contract.
export function acceptedSkills(routing, lane) {
  return [...new Set([laneById(routing, lane)?.skill, "agm-exec"].filter(Boolean))];
}

// Evidence that a skill was loaded: a Skill tool call, a slash command, or a
// read of its operation entrypoint. Hook context text never matches these forms.
export function skillLoaded(transcript, skills) {
  const names = skills.map((skill) => skill.replace(/^agm-/, "")).join("|");
  const entrypoints = skills.map((skill) => (skill === "agm-exec" ? "execute" : skill.replace(/^agm-/, ""))).join("|");
  return new RegExp(`"skill"\\s*:\\s*"(?:agrimap-agent-skills:)?agm-(?:${names})"`).test(transcript)
    || new RegExp(`<command-name>/?(?:agrimap-agent-skills:)?agm-(?:${names})</command-name>`).test(transcript)
    || new RegExp(`"file_path"\\s*:\\s*"[^"]*references[\\\\/]+operations[\\\\/]+(?:${entrypoints})\\.md"`).test(transcript)
    || new RegExp(`"file_path"\\s*:\\s*"[^"]*skills[\\\\/]+agm-(?:${names})[\\\\/]+SKILL\\.md"`).test(transcript);
}

function stateFile(session) {
  return path.join(os.tmpdir(), "agrimap-skill-gate", `${safeSession(session) || "unknown"}.json`);
}

export async function evaluateWrite({ filePath, transcriptPath, session, routing = loadRouting() }) {
  if (!filePath) return null;
  const directory = await existingDirectory(filePath);
  if (!directory) return null;
  const root = git(directory, ["rev-parse", "--show-toplevel"]);
  if (!root) return null;
  const relative = path.relative(root, path.resolve(filePath)).replaceAll("\\", "/");
  if (!relative || relative.startsWith("..") || relative.split("/").some((segment) => SKIPPED_SEGMENTS.has(segment))) return null;
  const config = await readJson(path.join(root, ".agrimap-agent", "config.json"));
  if (config?.governance?.skillGate === false || config?.governance?.guards === false) return null;
  const packageManifest = await readJson(path.join(root, "package.json"));
  if (packageManifest?.name === "agrimap-agent-skills") return null;
  const remote = git(root, ["config", "--get", "remote.origin.url"]).replace(/[\\/]+$/, "").split(/[\\/:]/).filter(Boolean).at(-1)?.replace(/\.git$/i, "") || "";
  const names = [path.basename(root), remote];
  const agents = await readFile(path.join(root, "AGENTS.md"), "utf8").catch(() => "");
  const agrimap = config?.activation?.auto === true || names.some(recognizedProjectName) || agents.includes("AGRIMAP BOOTSTRAP VERSION");
  if (!agrimap) return null;
  const repoLane = repositoryLane(routing, { names, rootEntries: await readdir(root).catch(() => []) });
  const lane = laneFromPath(routing, relative, repoLane);
  if (!lane) return null;
  const skills = acceptedSkills(routing, lane);
  const transcript = transcriptPath
    ? await stat(transcriptPath).then((item) => (item.size <= MAX_TRANSCRIPT_BYTES ? readFile(transcriptPath, "utf8") : null), () => null)
    : null;
  if (transcript === null) return null;
  if (skillLoaded(transcript, skills)) return null;
  const family = laneById(routing, lane).family;
  const file = stateFile(session);
  const state = (await readJson(file)) || {};
  if (state[family]) return null;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ ...state, [family]: new Date().toISOString() }), "utf8");
  return {
    lane,
    skills,
    reason: `AGM_SKILL_GATE[${family}]: ${relative} is ${lane} work. Load the skill first (Skill tool: agrimap-agent-skills:${skills[0]}; cross-lane work: agrimap-agent-skills:agm-exec), open the references its entrypoint names, state \`Skill · Lane · Golden\`, then retry this edit. If the requester explicitly declined AgriMap skills, retry once; the gate allows it.`,
  };
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text ? JSON.parse(text) : {};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = await readStdin();
    const toolInput = input.tool_input || input.toolInput || {};
    const verdict = await evaluateWrite({
      filePath: toolInput.file_path || toolInput.notebook_path || "",
      transcriptPath: input.transcript_path || input.transcriptPath || "",
      session: input.session_id || input.sessionId,
    });
    if (verdict) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: verdict.reason } }));
  } catch (error) {
    process.stderr.write(`AGM skill gate skipped (fail-open): ${String(error?.message || error).slice(0, 160)}\n`);
  }
}
