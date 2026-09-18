// Project development mode and spec locations (ACG C9-A):
// .agrimap-agent/policy/project.json is team state; machine paths stay in local memory.
import { mkdir, open, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { writeRecord as writeFile } from "./sensitive-recording.mjs";
import { defaultRun } from "./run-command.mjs";
import { bangkokParts, upsertProjectFact, writeDecision } from "./decision-records.mjs";

export const PROJECT_PATH = ".agrimap-agent/policy/project.json";
export const DEVELOPMENT_MODES = Object.freeze(["code-first", "spec-first", "hybrid"]);
const MODE_LABEL = { "code-first": "Not AI-First (code-first)", "spec-first": "AI-First (spec-first)", hybrid: "ผสม (hybrid)" };
const FORMATS = new Set(["generic-markdown", "morynth-context-index@1"]);
const SOURCE_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const DISCOVERY_BUDGET_MS = 1000;
const clone = value => JSON.parse(JSON.stringify(value));
const toSlash = value => String(value || "").replaceAll("\\", "/");
const lines = value => String(value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const exists = file => stat(file).then(() => true, () => false);

export function projectDefaults(mode = "code-first") {
  return {
    schemaVersion: 1,
    status: "confirmed",
    developmentMode: mode,
    confirmedBy: null,
    confirmedAt: null,
    decisionRef: null,
    inference: null,
    specs: { sources: [], scopes: [], sync: mode === "code-first" ? "off" : "auto", enforcement: "warn" },
    hybrid: { newWork: "spec-first" },
  };
}

export function validateProject(profile) {
  const details = [];
  const add = (field, reason) => details.push({ code: "PROJECT_PROFILE_INVALID", field, reason });
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return { ok: false, details: [{ code: "PROJECT_PROFILE_INVALID", field: "", reason: "must be a JSON object" }] };
  if (profile.schemaVersion !== 1) add("schemaVersion", "must be 1");
  if (!["inferred", "confirmed"].includes(profile.status)) add("status", "must be inferred|confirmed");
  if (!DEVELOPMENT_MODES.includes(profile.developmentMode)) add("developmentMode", `must be ${DEVELOPMENT_MODES.join("|")}`);
  if (profile.status === "confirmed" && (!profile.confirmedBy || !profile.confirmedAt)) add("confirmedBy", "confirmed profile requires confirmedBy and confirmedAt");
  const specs = profile.specs || {};
  const ids = new Set();
  for (const [index, source] of (Array.isArray(specs.sources) ? specs.sources : []).entries()) {
    if (!SOURCE_ID.test(String(source?.id || ""))) add(`specs.sources[${index}].id`, "must match ^[a-z0-9][a-z0-9-]{1,63}$");
    else if (ids.has(source.id)) add(`specs.sources[${index}].id`, "must be unique");
    ids.add(source?.id);
    if (!["repo", "external"].includes(source?.kind)) add(`specs.sources[${index}].kind`, "must be repo|external");
    if (source?.kind === "external" && Object.hasOwn(source, "path")) add(`specs.sources[${index}].path`, "external sources are referenced by id; the machine path belongs in local memory");
    if (source?.kind === "repo" && (!source.path || path.isAbsolute(source.path) || toSlash(source.path).split("/").includes(".."))) add(`specs.sources[${index}].path`, "repo sources need a repository-relative path");
    if (source?.format !== undefined && !FORMATS.has(source.format)) add(`specs.sources[${index}].format`, "must be generic-markdown|morynth-context-index@1");
  }
  if (specs.sources !== undefined && !Array.isArray(specs.sources)) add("specs.sources", "must be an array");
  for (const [index, scope] of (Array.isArray(specs.scopes) ? specs.scopes : []).entries()) {
    if (!ids.has(scope?.source)) add(`specs.scopes[${index}].source`, "must reference a declared source");
  }
  if (specs.sync !== undefined && !["auto", "ask", "off"].includes(specs.sync)) add("specs.sync", "must be auto|ask|off");
  if (specs.enforcement !== undefined && !["warn", "block"].includes(specs.enforcement)) add("specs.enforcement", "must be warn|block");
  if (profile.developmentMode === "code-first" && specs.sync === "auto" && !profile.decisionRef) add("specs.sync", "code-first auto sync needs an explicit instruction recorded as decisionRef");
  if (profile.hybrid?.newWork !== undefined && !["spec-first", "code-first"].includes(profile.hybrid.newWork)) add("hybrid.newWork", "must be spec-first|code-first");
  return { ok: details.length === 0, details };
}

export async function loadProject(root) {
  const text = await readFile(path.join(root, PROJECT_PATH), "utf8").catch(() => null);
  if (text === null) return { exists: false, status: null, profile: null, validation: null };
  let profile;
  try { profile = JSON.parse(text); } catch { return { exists: true, status: null, profile: null, validation: { ok: false, details: [{ code: "PROJECT_PROFILE_INVALID", field: "", reason: "not valid JSON" }] } }; }
  return { exists: true, status: profile?.status || null, profile, validation: validateProject(profile) };
}

async function readHead(file, limit = 65536) {
  let handle;
  try {
    handle = await open(file, "r");
    const buffer = Buffer.alloc(limit);
    const { bytesRead } = await handle.read(buffer, 0, limit, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } catch { return null; } finally { await handle?.close(); }
}

function normalizeRemote(url) {
  const value = String(url || "").trim().replace(/\.git$/i, "").replace(/\/+$/, "");
  const scp = value.match(/^[^@/]+@([^:]+):(.+)$/);
  if (scp) return `${scp[1]}/${scp[2]}`.toLowerCase();
  try { const parsed = new URL(value); return `${parsed.host}${parsed.pathname}`.toLowerCase(); } catch { return value.toLowerCase(); }
}

// Reads id/version/entry of a spec pack without a YAML dependency.
export async function specIndexInfo(dir, format = "generic-markdown") {
  if (format === "morynth-context-index@1") {
    const text = await readHead(path.join(dir, "06-agent", "CONTEXT-INDEX.yaml"));
    const block = text?.split(/\r?\n/) || [];
    const start = block.findIndex(line => /^project:\s*$/.test(line));
    const field = key => {
      for (let index = start + 1; start >= 0 && index < block.length && /^\s/.test(block[index]); index += 1) {
        const match = block[index].match(new RegExp(`^\\s{2}${key}:\\s*["']?([^"'#]+?)["']?\\s*(?:#.*)?$`));
        if (match) return match[1].trim();
      }
      return null;
    };
    return { projectId: field("id"), version: field("version"), entry: "06-agent/AGENT-START-HERE.md" };
  }
  return { projectId: null, version: null, entry: await exists(path.join(dir, "README.md")) ? "README.md" : null };
}

export async function fingerprintMatches(dir, source, { run = defaultRun } = {}) {
  if (!source?.fingerprint?.file) return { ok: await exists(dir), reason: "no-fingerprint" };
  const text = await readHead(path.join(dir, source.fingerprint.file));
  if (text === null || !text.includes(String(source.fingerprint.contains || ""))) return { ok: false, reason: "fingerprint-mismatch" };
  if (source.remote) {
    const remote = run("git", ["remote", "get-url", "origin"], { cwd: dir });
    if (remote.ok && normalizeRemote(remote.stdout) !== normalizeRemote(source.remote)) return { ok: false, reason: "remote-mismatch" };
    if (!remote.ok) return { ok: true, reason: "fingerprint", notGit: true };
  }
  return { ok: true, reason: "fingerprint" };
}

async function childDirectories(dir, limit = 200) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter(entry => entry.isDirectory()).slice(0, limit).map(entry => path.join(dir, entry.name));
}

// Bounded discovery: ancestors 1-4 of the target root plus the session cwd,
// one directory level each, names containing the id or "spec".
export async function discoverSpecCandidates(targetRoot, sessionCwd, { id = null, deadline = Date.now() + DISCOVERY_BUDGET_MS } = {}) {
  const bases = [];
  let current = path.resolve(targetRoot);
  for (let level = 1; level <= 4; level += 1) {
    const parent = path.dirname(current);
    if (parent === current) break;
    bases.push(parent);
    current = parent;
  }
  if (sessionCwd) bases.push(path.resolve(sessionCwd));
  const seen = new Set();
  const found = [];
  for (const base of [...new Set(bases)]) {
    if (Date.now() > deadline) break;
    for (const dir of await childDirectories(base)) {
      const name = path.basename(dir).toLowerCase();
      if (seen.has(dir.toLowerCase()) || path.resolve(dir) === path.resolve(targetRoot)) continue;
      if ((id && name.includes(id)) || name.includes("spec")) { seen.add(dir.toLowerCase()); found.push(dir); }
    }
  }
  return found;
}

export async function verifySpecPath(root, id, target, { run = defaultRun } = {}) {
  if (!target || typeof target !== "string") return { ok: false, code: "CARD_CHOICE_INVALID", message: "Answer with free:<absolute spec path>." };
  const project = await loadProject(root);
  const source = project.profile?.specs?.sources?.find(item => item.id === id);
  const dir = path.resolve(target);
  if (!(await exists(dir))) return { ok: false, code: "LOCAL_PATH_STALE", message: "The path does not exist on this machine." };
  if (source) {
    const check = await fingerprintMatches(dir, source, { run });
    if (!check.ok) return { ok: false, code: "LOCAL_PATH_STALE", message: `Spec fingerprint check failed (${check.reason}).` };
  }
  const info = await specIndexInfo(dir, source?.format);
  return { ok: true, path: dir, version: info.version };
}

// Resolves every declared source for `context`. Read-only: discovered paths are
// returned in `discovered` and persisted to local memory only by `context --ack`.
export async function resolveSpecSources(targetRoot, sessionCwd, localMemory, { run = defaultRun, project = null } = {}) {
  const loaded = project || await loadProject(targetRoot);
  const result = { sources: [], warnings: [], cards: [], discovered: [] };
  if (!loaded.profile?.specs?.sources?.length) return result;
  const deadline = Date.now() + DISCOVERY_BUDGET_MS;
  for (const source of loaded.profile.specs.sources) {
    const format = source.format || "generic-markdown";
    if (source.kind === "repo") {
      const dir = path.join(targetRoot, source.path);
      const present = await exists(dir);
      if (!present) result.warnings.push({ code: "SPEC_SOURCE_MISSING", subject: source.id, fix: `create ${source.path} or correct specs.sources` });
      const info = present ? await specIndexInfo(dir, format) : {};
      result.sources.push({ id: source.id, kind: "repo", resolved: present, path: toSlash(source.path), via: "repo", format, version: info.version ?? source.version ?? null, entry: info.entry ?? null });
      continue;
    }
    const remembered = localMemory?.specs?.find(item => item.id === source.id);
    let resolved = null;
    if (remembered) {
      const check = await exists(remembered.path) ? await fingerprintMatches(remembered.path, source, { run }) : { ok: false };
      if (check.ok) resolved = { path: path.resolve(remembered.path), via: "local-memory", notGit: check.notGit };
      else result.warnings.push({ code: "LOCAL_PATH_STALE", subject: source.id, fix: "bounded discovery or `local set-path`" });
    }
    let candidates = [];
    if (!resolved) {
      for (const dir of await discoverSpecCandidates(targetRoot, sessionCwd, { id: source.id, deadline })) {
        const check = await fingerprintMatches(dir, source, { run });
        if (check.ok) candidates.push({ path: dir, notGit: check.notGit, version: (await specIndexInfo(dir, format)).version });
      }
      if (candidates.length === 1) {
        resolved = { path: candidates[0].path, via: "discovery", notGit: candidates[0].notGit };
        result.discovered.push({ id: source.id, path: candidates[0].path, version: candidates[0].version });
      }
    }
    if (!resolved) {
      result.cards.push(candidates.length > 1 ? specChoiceCard(source, candidates) : specMissingCard(source, targetRoot));
      result.sources.push({ id: source.id, kind: "external", resolved: false, path: null, via: null, format, version: source.version ?? null, entry: null });
      continue;
    }
    const info = await specIndexInfo(resolved.path, format);
    if (resolved.notGit !== false && !(await exists(path.join(resolved.path, ".git")))) result.warnings.push({ code: "SPEC_SOURCE_NOT_GIT", subject: source.id, fix: "move the spec pack into its own Git repository (spec §19.21)" });
    if (source.version && info.version && source.version !== info.version) {
      result.cards.push(versionCard(source, info.version));
    }
    result.sources.push({ id: source.id, kind: "external", resolved: true, path: toSlash(resolved.path), via: resolved.via, format, version: info.version ?? source.version ?? null, entry: info.entry });
  }
  return result;
}

function specChoiceCard(source, candidates) {
  return {
    kind: "project", topic: `spec/location/${source.id}`, risk: "R2", confidence: "medium",
    question: `spec ${source.id} ใช้ชุดไหนบนเครื่องนี้`,
    impact: "Agent จะอ่านและอัปเดต spec ชุดที่เลือก และจำ path ไว้เฉพาะเครื่องนี้",
    checked: candidates.map(item => `${path.basename(item.path)} (version ${item.version || "unknown"})`),
    options: candidates.slice(0, 4).map((item, index) => ({ id: String(index + 1), label: path.basename(item.path).slice(0, 60), effect: `ใช้ ${toSlash(item.path)}`, value: item.path })),
    recommended: "1", recommendedReason: "fingerprint ตรงทุกตัว ให้เลือก version ที่ repo นี้ใช้",
    blocking: true, default: null, recordAs: `local:spec:${source.id}`, paths: [], expiresHours: 24,
  };
}

function specMissingCard(source, targetRoot) {
  const options = [];
  if (source.remote) options.push({ id: String(options.length + 1), label: "clone จาก remote", effect: `Agent รัน git clone ไปที่ ${toSlash(path.join(path.dirname(targetRoot), source.id))} แล้วบันทึก path`, value: path.join(path.dirname(targetRoot), source.id) });
  options.push({ id: String(options.length + 1), label: "ระบุ path ที่มีอยู่แล้ว", effect: "ตอบเป็นข้อความ free:<path> แล้ว Agent ตรวจ fingerprint ก่อนบันทึก", value: null });
  options.push({ id: String(options.length + 1), label: "ทำต่อโดยไม่มี spec รอบนี้", effect: "ทำงานต่อพร้อม warning SPEC_SOURCE_UNRESOLVED", value: "skip" });
  return {
    kind: "project", topic: `spec/location/${source.id}`, risk: "R1", confidence: "low",
    question: `spec ${source.id} อยู่ที่ไหนในเครื่องนี้`,
    impact: "ต้องใช้ spec ก่อนเขียนงานที่อยู่ใต้ spec; path จะถูกจำเฉพาะเครื่องนี้",
    checked: ["local memory ไม่มีหรือ path ใช้ไม่ได้", "ค้น directory ข้างเคียง 4 ระดับแล้วไม่พบ fingerprint ที่ตรง"],
    options, recommended: "1", recommendedReason: source.remote ? "มี remote ของ spec ให้ clone ได้ทันที" : "ยังไม่มี remote ของ spec ให้ clone",
    blocking: true, default: null, recordAs: `local:spec:${source.id}`, paths: [], expiresHours: 24,
  };
}

function versionCard(source, localVersion) {
  return {
    kind: "project", topic: `spec/version/${source.id}`, risk: "R2", confidence: "medium",
    question: `spec ${source.id} บนเครื่องนี้เป็น ${localVersion} แต่ repo อ้าง ${source.version}`,
    impact: "อ่าน spec ผิด version ทำให้ implement ไม่ตรงกับที่ทีมตกลง",
    checked: [`policy version ${source.version}`, `index บนเครื่องนี้ ${localVersion}`],
    options: [
      { id: "1", label: "ใช้ของเครื่องนี้และอัปเดต version", effect: `project.json specs.sources[${source.id}].version = ${localVersion}`, value: localVersion },
      { id: "2", label: "หยุด ให้ spec ตรงกับ repo ก่อน", effect: "ไม่เขียนงานที่อยู่ใต้ spec จนกว่า version ตรงกัน", value: source.version },
    ],
    recommended: "1", recommendedReason: "เลือกข้อ 1 เมื่อเครื่องนี้มี version ที่ใหม่กว่า",
    blocking: true, default: null, recordAs: "none", paths: [], expiresHours: 24,
  };
}

const tokens = value => String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 1 && !/^v?\d+$/.test(token) && token !== "spec");

export async function inferProject(root, { run = defaultRun, sessionCwd = null, now = Date.now() } = {}) {
  const git = args => run("git", args, { cwd: root });
  const files = lines(git(["ls-files"]).stdout).map(toSlash);
  const score = { "spec-first": 0, "code-first": 0, hybrid: 0 };
  const evidence = [];
  const toolSpecs = files.filter(file => /^(?:\.specify\/|\.kiro\/specs\/|openspec\/)/.test(file) || /^specs\/[^/]+\/spec\.md$/.test(file));
  if (toolSpecs.length) { score["spec-first"] += 4; evidence.push(`spec tooling files: ${toolSpecs.slice(0, 3).join(", ")}`); }
  const specDocs = files.filter(file => /\.md$/i.test(file) && (/(^|\/)(?:spec|specs|requirements|prd)\//i.test(file) || /(^|\/)(?:[^/]+\.spec\.md|SPEC[^/]*\.md|PRD[^/]*\.md)$/.test(file)));
  if (specDocs.length >= 3 && specDocs.length >= files.length * 0.05) { score["spec-first"] += 2; evidence.push(`${specDocs.length} spec documents in the repository`); }
  for (const doc of ["AGENTS.md", "README.md"]) {
    const text = await readHead(path.join(root, doc));
    if (text && /spec-driven|source of truth|ตาม spec|AGENT-START-HERE/i.test(text)) { score["spec-first"] += 2; evidence.push(`${doc} declares spec-driven work`); break; }
  }
  const total = Number(git(["rev-list", "--count", "HEAD"]).stdout.trim()) || 0;
  const specFiles = [...new Set([...toolSpecs, ...specDocs])];
  if (specFiles.length && total) {
    const first = lines(git(["log", "--diff-filter=A", "--reverse", "--format=%H", "--", ...specFiles.slice(0, 50)]).stdout)[0];
    const position = first ? Number(git(["rev-list", "--count", first]).stdout.trim()) : 0;
    if (position && position <= Math.max(1, total * 0.1)) { score["spec-first"] += 2; evidence.push("specs were added in the first 10% of history"); }
    else if (position && position >= total * 0.8) { score.hybrid += 2; evidence.push("specs were added late in history"); }
  }
  for (const file of specFiles.slice(0, 10)) {
    const text = await readHead(path.join(root, file));
    if (text && /\bREQ-\d+|\bAC-[A-Z]+-\d+|\bFE-\d{3}\b|\bBE-\d{3}\b|^#+\s*Acceptance/m.test(text)) { score["spec-first"] += 1; evidence.push("specs carry requirement/acceptance IDs"); break; }
  }
  const repoTokens = new Set(tokens(path.basename(root)));
  const candidates = [];
  for (const dir of await discoverSpecCandidates(root, sessionCwd)) {
    const morynth = await specIndexInfo(dir, "morynth-context-index@1");
    const shared = [...new Set([...tokens(path.basename(dir)), ...tokens(morynth.projectId)])].filter(token => repoTokens.has(token));
    if (shared.length >= 2) candidates.push({ path: dir, projectId: morynth.projectId, version: morynth.version, format: morynth.projectId ? "morynth-context-index@1" : "generic-markdown" });
  }
  if (candidates.length) { score["spec-first"] += 2; evidence.push(`nearby spec pack ${path.basename(candidates[0].path)} (not yet linked)`); }
  const firstCommitAt = Number(lines(git(["log", "--reverse", "--format=%ct"]).stdout)[0]) * 1000 || now;
  if (!specFiles.length && (total >= 50 || now - firstCommitAt > 182 * 86_400_000)) { score["code-first"] += 3; evidence.push(`no spec files; ${total} commits since ${new Date(firstCommitAt).toISOString().slice(0, 7)}`); }
  const docs = files.filter(file => /\.md$/i.test(file));
  if (docs.length && docs.every(file => /(^|\/)(?:readme|changelog|usage)\.md$/i.test(file))) { score["code-first"] += 1; evidence.push("documents are only README/changelog/usage"); }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [[mode, top], [, second]] = ranked;
  // Conflicting spec-first and code-first evidence is always low confidence (§5.3).
  const conflict = score["spec-first"] > 0 && score["code-first"] > 0;
  const confidence = conflict || top < 2 ? "low" : top >= 4 && top - second >= 3 ? "high" : "medium";
  const developmentMode = top > 0 ? mode : "code-first";
  const proposal = projectDefaults(developmentMode);
  if (confidence === "high") {
    Object.assign(proposal, { status: "inferred", inference: { confidence, evidence, at: new Date(now).toISOString().slice(0, 10) } });
    return { ok: true, proposal, confidence, evidence, candidates, card: null, planLine: `ถือว่าเป็น ${MODE_LABEL[developmentMode]}: ${evidence.slice(0, 2).join("; ")} — ถ้าไม่ใช่บอกได้` };
  }
  return { ok: true, proposal, confidence, evidence, candidates, card: modeCard(developmentMode, confidence, evidence, candidates, conflict) };
}

function modeCard(mode, confidence, evidence, candidates, conflict) {
  const pack = candidates[0] ? ` ${path.basename(candidates[0].path)}` : "";
  const options = [
    { id: "1", label: "AI-First (spec-first)", effect: `spec${pack} เป็นหลัก ตรวจก่อนทำและอัปเดต spec ให้เองทุกงาน`, value: "spec-first" },
    { id: "2", label: "Not AI-First (code-first)", effect: "code และ test เดิมเป็นหลัก ไม่แตะ spec เอง", value: "code-first" },
    { id: "3", label: "ผสม (hybrid)", effect: "ของเดิมยึด code งานใหม่ทำจาก spec", value: "hybrid" },
  ];
  const recommended = candidates.length ? "1" : options.find(option => option.value === mode)?.id || "2";
  return {
    kind: "project", topic: "project/development-mode", risk: "R2", confidence,
    question: "โปรเจกต์นี้พัฒนาแบบไหน",
    impact: "กำหนดว่า Agent ยึด code หรือ spec และจะอัปเดต spec ให้เองทุกงานหรือไม่ (ถามครั้งเดียว)",
    checked: evidence.length ? evidence : ["ไม่พบหลักฐานเรื่อง spec หรือ history ที่ชัด"],
    options, recommended,
    recommendedReason: conflict ? "หลักฐานขัดกัน จึงแนะนำตาม spec pack ที่พบ" : `หลักฐานเอียงไปทาง ${MODE_LABEL[mode]} แต่ยังไม่ชัด`,
    blocking: true, default: null, recordAs: "project:developmentMode", paths: [], expiresHours: 24,
  };
}

function deepMerge(base, overrides) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return overrides === undefined ? base : overrides;
  const result = !base || typeof base !== "object" || Array.isArray(base) ? {} : { ...base };
  for (const [key, value] of Object.entries(overrides)) result[key] = deepMerge(result[key], value);
  return result;
}

async function writeProjectFile(root, profile) {
  const file = path.join(root, PROJECT_PATH);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

async function modeDecision(root, profile, requestedBy, { now, cardId, supersedes }) {
  return writeDecision(root, {
    slug: "development-mode", topic: "project/development-mode", kind: "workflow", title: "Project development mode",
    summary: `${MODE_LABEL[profile.developmentMode]}; spec sync ${profile.specs?.sync || "off"}`,
    requestedBy, origin: cardId ? "card" : "explicit", cardId, now, supersedes,
    problem: "Agents need to know whether code or specs are the source of truth before writing.",
    options: "code-first (Not AI-First), spec-first (AI-First) or hybrid.",
    decision: `${MODE_LABEL[profile.developmentMode]}. Spec sync: ${profile.specs?.sync || "off"}; enforcement: ${profile.specs?.enforcement || "warn"}.`,
  });
}

export async function initProject(root, mode, overrides = {}, requestedBy, { now = new Date(), cardId = null, inferred = false, inference = null } = {}) {
  if (!DEVELOPMENT_MODES.includes(mode)) return { ok: false, code: "PROJECT_PROFILE_INVALID", details: [{ field: "developmentMode", reason: `must be ${DEVELOPMENT_MODES.join("|")}` }] };
  const current = await loadProject(root);
  const profile = deepMerge(projectDefaults(mode), overrides || {});
  profile.developmentMode = mode;
  if (inferred) {
    Object.assign(profile, { status: "inferred", confirmedBy: null, confirmedAt: null, inference: inference || profile.inference });
  } else {
    if (!String(requestedBy || "").trim()) return { ok: false, code: "REQUESTER_REQUIRED", message: "--requested-by is required to confirm the development mode." };
    Object.assign(profile, { status: "confirmed", confirmedBy: requestedBy, confirmedAt: bangkokParts(now).date, inference: null, decisionRef: "pending" });
  }
  const validation = validateProject(profile);
  if (!validation.ok) return { ok: false, code: "PROJECT_PROFILE_INVALID", details: validation.details };
  if (!inferred) profile.decisionRef = await modeDecision(root, profile, requestedBy, { now, cardId, supersedes: current.profile?.decisionRef || null });
  await writeProjectFile(root, profile);
  const written = [PROJECT_PATH];
  if (!inferred) {
    written.push(`.agrimap-agent/${profile.decisionRef}`);
    written.push(await upsertProjectFact(root, "Development mode", `${MODE_LABEL[mode]} in \`${PROJECT_PATH}\` (confirmed ${profile.confirmedAt} by ${requestedBy})`));
  }
  return { ok: true, written, profile };
}

function parseValue(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

// Keys are dotted; `sources[<id>]` selects a source by id.
export async function setProjectValue(root, key, value, requestedBy, { now = new Date(), cardId = null, confirm = false } = {}) {
  const current = await loadProject(root);
  if (!current.exists || !current.profile) {
    if (key === "developmentMode") return initProject(root, parseValue(value), {}, requestedBy, { now, cardId });
    return { ok: false, code: "PROJECT_PROFILE_REQUIRED", next: { action: "run", command: "project infer" } };
  }
  const profile = clone(current.profile);
  const parts = String(key || "").split(".").filter(Boolean);
  if (!parts.length || parts.some(part => /__proto__|constructor|prototype/.test(part))) return { ok: false, code: "PROJECT_KEY_INVALID" };
  let cursor = profile;
  for (const [index, raw] of parts.entries()) {
    const selector = raw.match(/^([A-Za-z]+)\[([a-z0-9-]+)\]$/);
    const last = index === parts.length - 1;
    if (selector) {
      const list = cursor[selector[1]] ||= [];
      let item = list.find(entry => entry?.id === selector[2]);
      if (!item) { item = { id: selector[2] }; list.push(item); }
      if (last) { Object.assign(item, parseValue(value)); break; }
      cursor = item;
    } else if (last) cursor[raw] = parseValue(value);
    else cursor = cursor[raw] ||= {};
  }
  if (!String(requestedBy || "").trim()) return { ok: false, code: "REQUESTER_REQUIRED", message: "Changing the team project profile requires --requested-by." };
  if (confirm || profile.status === "confirmed") Object.assign(profile, { status: "confirmed", confirmedBy: requestedBy, confirmedAt: bangkokParts(now).date, inference: null });
  profile.decisionRef = "pending";
  const validation = validateProject(profile);
  if (!validation.ok) return { ok: false, code: "PROJECT_PROFILE_INVALID", details: validation.details };
  profile.decisionRef = await modeDecision(root, profile, requestedBy, { now, cardId, supersedes: current.profile.decisionRef || null });
  await writeProjectFile(root, profile);
  return { ok: true, written: [PROJECT_PATH, `.agrimap-agent/${profile.decisionRef}`], profile };
}
