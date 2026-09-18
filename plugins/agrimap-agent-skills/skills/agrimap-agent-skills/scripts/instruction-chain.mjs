// Target root and AGENTS instruction chain (ACG C1). Resolution and chain
// listing are read-only; acknowledge() is the only writer.
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultRun } from "./run-command.mjs";
import { readSessionState, updateSessionState, writeSessionPointer } from "./session-state.mjs";

export { writeSessionPointer };
export const INSTRUCTION_FILES = Object.freeze(["AGENTS.md", "CLAUDE.md", "GEMINI.md", "CURSOR.md"]);
const DEFAULT_SKIP = [".git", "bin", "obj", "node_modules", "dist", "coverage"];
// Assembled so runtime archives never contain the literal maintainer marker.
const MAINTAINER_MARKER = `<!-- AGM-${"MAINTAINER"}-ONLY -->`;
const MAX_SCAN_DIRECTORIES = 200;
const MAX_CHAIN_LEVELS = 8;
const toSlash = value => String(value || "").replaceAll("\\", "/");
const exists = file => stat(file).then(() => true, () => false);
const sameDir = (a, b) => process.platform === "win32" ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);

async function existingDirectory(target) {
  let current = path.resolve(target);
  for (;;) {
    const info = await stat(current).catch(() => null);
    if (info?.isDirectory()) return current;
    if (info?.isFile()) return path.dirname(current);
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export async function gitTop(target, { run = defaultRun } = {}) {
  const dir = await existingDirectory(target);
  if (!dir) return null;
  const result = run("git", ["rev-parse", "--show-toplevel"], { cwd: dir });
  return result.ok && result.stdout.trim() ? path.resolve(result.stdout.trim()) : null;
}

// Breadth-first scan below the session cwd: repositories (a `.git` file or
// directory) stop the descent; `.agrimap-agent` outside a repository is stray.
export async function scanBelow(sessionCwd, { depth = 3, skip = DEFAULT_SKIP } = {}) {
  const repositories = [];
  const strayStateRoots = [];
  const queue = [[path.resolve(sessionCwd), 0]];
  let visited = 0;
  while (queue.length && visited < MAX_SCAN_DIRECTORIES) {
    const [dir, level] = queue.shift();
    visited += 1;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    if (level > 0 && entries.some(entry => entry.name === ".git")) { repositories.push(dir); continue; }
    if (entries.some(entry => entry.name === ".agrimap-agent" && entry.isDirectory())) strayStateRoots.push(dir);
    if (level >= depth) continue;
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !skip.includes(entry.name)) queue.push([path.join(dir, entry.name), level + 1]);
    }
  }
  return { repositories, strayStateRoots, truncated: queue.length > 0 };
}

export async function findStrayStateRoots(sessionCwd, depth = 3) {
  return (await scanBelow(sessionCwd, { depth })).strayStateRoots;
}

async function remoteName(dir, run) {
  const remote = run("git", ["config", "--get", "remote.origin.url"], { cwd: dir });
  return remote.ok ? remote.stdout.trim().replace(/[\\/]+$/, "").split(/[\\/:]/).at(-1)?.replace(/\.git$/i, "") || "" : "";
}

async function logsMtime(dir) {
  return (await stat(path.join(dir, ".agrimap-agent", "logs")).catch(() => null))?.mtimeMs || 0;
}

export async function rootCard(candidates, hint, { run = defaultRun } = {}) {
  const needle = String(hint || "").toLowerCase().trim();
  const scored = [];
  for (const dir of candidates) {
    const names = [path.basename(dir), await remoteName(dir, run)].map(value => value.toLowerCase());
    scored.push({ dir, hint: needle && names.some(name => name.includes(needle) || needle.split(/\s+/).every(part => name.includes(part))) ? 1 : 0, agents: await exists(path.join(dir, "AGENTS.md")) ? 1 : 0, mtime: await logsMtime(dir) });
  }
  scored.sort((a, b) => b.hint - a.hint || b.agents - a.agents || b.mtime - a.mtime || a.dir.localeCompare(b.dir));
  const options = scored.slice(0, 4).map((item, index) => ({ id: String(index + 1), label: path.basename(item.dir).slice(0, 60), effect: `resolve and write only in ${toSlash(item.dir)}`, value: toSlash(item.dir) }));
  return {
    kind: "root", topic: "repo/target-root", risk: "R2", confidence: scored[0]?.hint ? "medium" : "low",
    question: "งานนี้ต้องแก้ใน repository ไหน",
    impact: "Agent จะอ่าน AGENTS chain และเขียนไฟล์/สถานะเฉพาะใน repository ที่เลือก",
    checked: [`session cwd อยู่นอก Git repository`, `พบ ${candidates.length} repositories ข้างใต้`],
    options, recommended: "1",
    recommendedReason: scored[0]?.hint ? `ชื่อตรงกับ "${hint}"` : "มี AGENTS.md หรือถูกใช้ล่าสุด",
    blocking: true, default: null, recordAs: "none", paths: [], expiresHours: 24,
  };
}

export async function resolveTargetRoots({ sessionCwd = process.cwd(), target = null, paths = [], hint = null, depth = 3, run = defaultRun, skip } = {}) {
  const cwd = path.resolve(sessionCwd);
  const cwdTop = await gitTop(cwd, { run });
  const boundedDepth = Math.min(4, Math.max(1, Number(depth) || 3));
  if (target) {
    const top = await gitTop(path.resolve(cwd, target), { run });
    return top ? { ok: true, resolved: true, roots: [top], via: "target", cwdIsRepo: Boolean(cwdTop) } : { ok: false, code: "TARGET_NOT_GIT", target: toSlash(target) };
  }
  if (paths.length) {
    const roots = new Map();
    const outside = [];
    for (const item of paths) {
      const top = await gitTop(path.resolve(cwd, item), { run });
      if (top) roots.set(process.platform === "win32" ? top.toLowerCase() : top, top);
      else outside.push(toSlash(item));
    }
    if (outside.length) return { ok: false, code: "PATH_NOT_IN_GIT", paths: outside };
    return { ok: true, resolved: true, roots: [...roots.values()], via: "paths", cwdIsRepo: Boolean(cwdTop) };
  }
  if (cwdTop) return { ok: true, resolved: true, roots: [cwdTop], via: "cwd", cwdIsRepo: true };
  const scan = await scanBelow(cwd, { depth: boundedDepth, skip });
  if (scan.repositories.length === 1) return { ok: true, resolved: true, roots: scan.repositories, via: "scan", cwdIsRepo: false, scan };
  if (!scan.repositories.length) return { ok: true, resolved: false, reason: "NO_REPOSITORY", roots: [], cwdIsRepo: false, scan };
  return { ok: true, resolved: false, reason: "MULTIPLE_REPOSITORIES", roots: [], cwdIsRepo: false, scan, card: await rootCard(scan.repositories, hint, { run }) };
}

function sha12(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

async function describe(file, targetRoot, nested) {
  const content = await readFile(file).catch(() => null);
  if (content === null) return null;
  const text = content.toString("utf8");
  const name = path.basename(file);
  return {
    path: toSlash(file),
    relative: toSlash(path.relative(targetRoot, file)),
    sha12: sha12(content),
    bytes: content.length,
    bootstrapVersion: text.match(/<!-- AGRIMAP BOOTSTRAP VERSION: ([^ >]+) -->/)?.[1] || null,
    maintainerOnly: text.includes(MAINTAINER_MARKER),
    pointerOnly: name !== "AGENTS.md" && content.length <= 400 && /AGENTS\.md/.test(text),
    nested,
  };
}

async function instructionFilesIn(dir) {
  const names = new Set((await readdir(dir).catch(() => [])));
  return INSTRUCTION_FILES.filter(name => names.has(name)).map(name => path.join(dir, name));
}

// Outermost -> innermost from the drive root (max 8 levels, home skipped), plus
// nested AGENTS.md between the target root and each planned path.
export async function instructionChain(targetRoot, paths = []) {
  const root = path.resolve(targetRoot);
  const levels = [];
  let current = root;
  for (let level = 0; level < MAX_CHAIN_LEVELS; level += 1) {
    levels.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const chain = [];
  for (const dir of levels.reverse()) {
    if (sameDir(dir, os.homedir()) && !sameDir(dir, root)) continue;
    for (const file of await instructionFilesIn(dir)) {
      const entry = await describe(file, root, false);
      if (entry) chain.push(entry);
    }
  }
  const nested = new Map();
  for (const item of paths) {
    const absolute = path.resolve(root, item);
    const relative = path.relative(root, path.dirname(absolute));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) continue;
    let dir = root;
    for (const part of relative.split(path.sep)) {
      dir = path.join(dir, part);
      const file = path.join(dir, "AGENTS.md");
      if (!nested.has(file) && await exists(file)) nested.set(file, await describe(file, root, true));
    }
  }
  return [...chain, ...[...nested.values()].filter(Boolean)];
}

export async function readRequired(targetRoot, session, chain) {
  const ack = session ? (await readSessionState(path.join(targetRoot, ".agrimap-agent"), session)).instructionsAck || {} : {};
  return chain.filter(entry => !entry.pointerOnly && ack[entry.relative] !== entry.sha12).map(entry => entry.relative);
}

// Every sha must belong to a current chain file; nothing is written otherwise.
export async function acknowledge(targetRoot, session, sha12s, chain) {
  const bySha = new Map(chain.map(entry => [entry.sha12, entry]));
  const unknown = sha12s.filter(value => !bySha.has(value));
  if (unknown.length) return { ok: false, code: "ACK_HASH_MISMATCH", unknown, message: "A file changed after it was read or the hash is not in the chain; read it again, then ack its current sha12." };
  const state = path.join(targetRoot, ".agrimap-agent");
  const current = (await readSessionState(state, session)).instructionsAck || {};
  const next = { ...current };
  for (const value of sha12s) next[bySha.get(value).relative] = value;
  await updateSessionState(state, session, { instructionsAck: next });
  await writeSessionPointer(session, [targetRoot]);
  return { ok: true, acknowledged: sha12s.map(value => bySha.get(value).relative) };
}

export async function worktreeFacts(root, { run = defaultRun } = {}) {
  const gitDir = run("git", ["rev-parse", "--path-format=absolute", "--git-dir"], { cwd: root });
  const common = run("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root });
  const branch = run("git", ["branch", "--show-current"], { cwd: root });
  return {
    isLinkedWorktree: gitDir.ok && common.ok && !sameDir(gitDir.stdout.trim(), common.stdout.trim()),
    branch: branch.ok ? branch.stdout.trim() || null : null,
  };
}
