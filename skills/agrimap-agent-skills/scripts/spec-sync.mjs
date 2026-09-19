// Spec Read Gate, Spec Sync Gate and drift check (ACG C9-B, spec §19.8-19.11).
// specContext and specCheck are read-only. planSpecSync is a pure plan over an
// overlay; applySpecSync recomputes it, refuses a different planHash and writes
// each file through a temp file + rename, keeping the file's line endings.
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultRun } from "./run-command.mjs";
import { planHashOf } from "./git-flow.mjs";
import { loadProject, resolveSpecSources } from "./project-profile.mjs";
import { loadLocalMemory } from "./local-memory.mjs";
import { writeDecision } from "./decision-records.mjs";
import { Overlay, adapterFor, manifestMismatches, semanticOf, sha256 } from "./spec-adapters.mjs";

export { chooseStatusValue } from "./spec-adapters.mjs";

const toSlash = value => String(value || "").replaceAll("\\", "/");
const exists = file => stat(file).then(() => true, () => false);
const warn = (code, subject, fix) => ({ code, subject, fix });
const READ_FIRST_MAX = 8;
const SEMANTIC_WORDS = { done: "delivered", inProgress: "in progress", blocked: "blocked", dropped: "dropped", planned: "planned" };

export function globRegex(glob) {
  let source = "";
  const value = toSlash(glob);
  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith("**/", index)) { source += "(?:.*/)?"; index += 2; }
    else if (value.startsWith("**", index)) { source += ".*"; index += 1; }
    else if (value[index] === "*") source += "[^/]*";
    else if (value[index] === "?") source += "[^/]";
    else source += value[index].replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

export function coveredBy(scopes, relativePaths) {
  const ids = new Set();
  for (const scope of scopes || []) {
    if (relativePaths.some(item => (scope.covers || []).some(glob => globRegex(glob).test(toSlash(item))))) ids.add(scope.source);
  }
  return [...ids];
}

// Resolved sources of the project profile with their adapters. Read-only.
export async function specSources(root, { sessionCwd = null, run = defaultRun, project = null, localMemory = null } = {}) {
  const loaded = project || await loadProject(root);
  const profile = loaded.profile;
  const result = { exists: loaded.exists, valid: loaded.validation?.ok ?? false, mode: profile?.developmentMode || null, profile, sources: [], warnings: [], cards: [] };
  if (!profile?.specs?.sources?.length) return result;
  const memory = localMemory || await loadLocalMemory(root);
  const resolved = await resolveSpecSources(root, sessionCwd || root, memory, { run, project: loaded });
  result.warnings.push(...resolved.warnings);
  result.cards.push(...resolved.cards);
  for (const entry of resolved.sources) {
    const declared = profile.specs.sources.find(item => item.id === entry.id) || {};
    if (!entry.resolved) { result.warnings.push(warn("SPEC_SOURCE_UNRESOLVED", entry.id, "answer the spec location card or `local set-path`")); continue; }
    const dir = entry.kind === "repo" ? path.join(root, entry.path) : path.resolve(entry.path);
    const { adapter, warnings } = await adapterFor(dir, declared.format || entry.format);
    result.warnings.push(...warnings.map(item => ({ ...item, subject: `${entry.id}: ${item.subject}` })));
    const git = entry.kind === "repo" ? true : run("git", ["rev-parse", "--show-toplevel"], { cwd: dir }).ok;
    result.sources.push({ id: entry.id, kind: entry.kind, dir, relative: entry.kind === "repo" ? toSlash(entry.path) : null, format: adapter.format, adapter, version: entry.version, statusMap: declared.statusMap || null, git });
  }
  return result;
}

function displayPath(source, file) {
  return source.kind === "repo" ? toSlash(path.posix.join(source.relative, file)) : toSlash(path.join(source.dir, file));
}

// ------------------------------------------------------------ spec context

export async function specContext({ root, sessionCwd = null, tasks = [], query = "", paths = [], run = defaultRun }) {
  const resolved = await specSources(root, { sessionCwd, run });
  if (!resolved.exists) return { ok: false, code: "PROJECT_PROFILE_REQUIRED", next: { action: "run", command: "project infer" } };
  const scoped = paths.length ? coveredBy(resolved.profile.specs?.scopes, paths) : [];
  const selected = scoped.length ? resolved.sources.filter(source => scoped.includes(source.id)) : resolved.sources;
  const warnings = [...resolved.warnings];
  const readFirst = [];
  const items = [];
  const blockingQuestions = [];
  const add = (source, file, reason) => {
    if (!file || readFirst.length >= READ_FIRST_MAX || readFirst.some(entry => entry.source === source.id && entry.file === file)) return;
    readFirst.push({ source: source.id, file, path: displayPath(source, file), reason });
  };
  for (const source of selected) {
    const index = await source.adapter.readIndex(source.dir, { query, ids: tasks });
    warnings.push(...index.warnings.map(item => ({ ...item, subject: `${source.id}: ${item.subject}` })));
    const found = await source.adapter.findItems(source.dir, { ids: tasks, query });
    warnings.push(...found.warnings.map(item => ({ ...item, subject: `${source.id}: ${item.subject}` })));
    for (const goal of index.goals || []) add(source, goal, "goal README supersedes older tasks");
    add(source, index.entry, "entry");
    for (const item of found.items) add(source, item.file, `${item.kind} ${item.id}`);
    if (index.canonical?.spec) add(source, index.canonical.spec, "canonical spec");
    for (const file of index.readOrder) add(source, file, "read order");
    items.push(...found.items.map(({ requirements: _r, acceptance, ...item }) => ({ source: source.id, ...item, ...(acceptance?.length ? { acceptance } : {}) })));
    blockingQuestions.push(...found.blockingQuestions.map(question => ({ source: source.id, id: question.id, file: question.file, line: question.line, text: question.title, refs: question.refs })));
  }
  return {
    ok: true, mode: resolved.mode, sources: selected.map(source => ({ id: source.id, kind: source.kind, format: source.format, version: source.version, git: source.git })),
    readFirst, items, blockingQuestions, warnings, cards: resolved.cards,
    record: { sources: selected.map(source => source.id), items: [...new Set(items.map(item => item.id))], readAt: new Date().toISOString() },
    next: blockingQuestions.length ? { action: "ask", command: "R2 card quoting each blocking question before writing" } : { action: "read", files: readFirst.map(entry => entry.path) },
  };
}

// ---------------------------------------------------------------- sync plan

export function parseEvidence(values) {
  const rows = [];
  const errors = [];
  for (const raw of values) {
    const at = String(raw).indexOf("=");
    const id = at > 0 ? String(raw).slice(0, at).trim() : "";
    const evidence = at > 0 ? String(raw).slice(at + 1).trim() : "";
    if (!/^[A-Z][A-Z0-9-]*\d$/.test(id) || !evidence) { errors.push({ value: raw, reason: "use ID=<repo-relative path or test name>" }); continue; }
    if (path.isAbsolute(evidence) || /^[A-Za-z]:[\\/]/.test(evidence) || evidence.startsWith("\\\\") || toSlash(evidence).split("/").includes("..")) {
      errors.push({ value: `${id}=…`, reason: "absolute or parent paths are not allowed; use a repository-relative path" });
      continue;
    }
    rows.push({ id, evidence: toSlash(evidence) });
  }
  return { rows, errors };
}

async function buildSync({ root, sessionCwd = null, active = null, tasks = [], status = null, evidence = [], deviation = null, date, run = defaultRun, pendingCards = [] }) {
  const resolved = await specSources(root, { sessionCwd, run });
  if (!resolved.exists) return { ok: false, code: "PROJECT_PROFILE_REQUIRED", next: { action: "run", command: "project infer" } };
  const parsed = parseEvidence(evidence);
  if (parsed.errors.length) return { ok: false, code: "EVIDENCE_PATH_INVALID", message: "Evidence must be repository-relative.", details: parsed.errors };
  const warnings = [...resolved.warnings];
  if (!resolved.sources.length) return { ok: false, code: "SPEC_SOURCE_UNRESOLVED", message: "No spec source resolves on this machine.", warnings, next: { action: "run", command: "context (answer the spec location card)" } };
  const executionId = active?.executionId || "manual";
  const verified = ["passed", "not-applicable"].includes(active?.verificationStatus);
  const semantic = status || (verified ? "done" : "inProgress");
  const wanted = tasks.length ? tasks : active?.spec?.items || [];
  for (const card of pendingCards || []) warnings.push(warn("SPEC_DECISION_PENDING", card.cardId, `semantic spec change waits for card ${card.cardId}; mechanical sync continues`));
  const perSource = [];
  const updated = [];
  const unmatchedEvidence = new Set(parsed.rows.map(row => row.id));
  for (const source of resolved.sources) {
    const overlay = new Overlay(source.dir);
    const found = await source.adapter.findItems(source.dir, { ids: wanted });
    warnings.push(...found.warnings.map(item => ({ ...item, subject: `${source.id}: ${item.subject}` })));
    const taskIds = [...new Set(found.items.filter(item => item.kind === "task").map(item => item.id))];
    const known = new Set(found.allTasks.flatMap(task => [task.id, ...(task.acceptance || []), ...(task.requirements || [])]));
    for (const id of taskIds) {
      const result = await source.adapter.planStatus(overlay, id, semantic, { statusMap: source.statusMap });
      warnings.push(...(result.warnings || []).map(item => ({ ...item, subject: `${source.id}: ${item.subject}` })));
      if (result.value && !result.skipped) updated.push({ source: source.id, id, value: result.value, changed: !result.unchanged });
    }
    const rows = parsed.rows.filter(row => known.has(row.id) || (resolved.sources.length === 1));
    for (const row of rows) {
      unmatchedEvidence.delete(row.id);
      const result = await source.adapter.planEvidence(overlay, { id: row.id, evidence: row.evidence, executionId, date });
      warnings.push(...(result?.warnings || []));
    }
    if (!overlay.changed().length && !deviation) { perSource.push({ source, overlay, taskIds, evidence: rows.length }); continue; }
    const changedIds = updated.filter(item => item.source === source.id && item.changed).map(item => `${item.id} → ${item.value}`);
    const summary = [
      changedIds.length ? changedIds.join(", ") : "spec evidence",
      rows.length ? `evidence ${rows.length}` : null,
      deviation ? `deviation: ${String(deviation).slice(0, 160)} (decision spec-deviation-${executionId})` : null,
      `(AGM-Execution ${executionId})`,
    ].filter(Boolean).join("; ");
    await source.adapter.planChangelog(overlay, { date, executionId, summary });
    const manifest = await source.adapter.planManifest(overlay, overlay.changed());
    perSource.push({ source, overlay, taskIds, evidence: rows.length, manifest: Boolean(manifest?.edits?.length) });
  }
  for (const id of unmatchedEvidence) warnings.push(warn("EVIDENCE_TARGET_MISSING", id, "no spec source declares this id; add it to the spec first"));
  const files = [];
  for (const { source, overlay } of perSource) {
    for (const item of overlay.plan()) {
      files.push({ source: source.id, kind: source.kind, file: item.file, path: displayPath(source, item.file), created: item.created, edits: item.edits, before: overlay.original.get(item.file) === null ? null : sha256(overlay.original.get(item.file)), after: sha256(overlay.texts.get(item.file)) });
    }
  }
  const evidenceCount = perSource.reduce((sum, item) => sum + item.evidence, 0);
  const manifestUpdated = perSource.some(item => item.manifest);
  const changedTasks = updated.filter(item => item.changed);
  const specLine = `- Spec: ${changedTasks.length ? `${[...new Set(changedTasks.map(item => item.id))].join(", ")} → ${changedTasks[0].value}` : "status unchanged"} · evidence ${evidenceCount}${manifestUpdated ? " · manifest updated" : ""}${resolved.sources.some(source => source.kind === "external" && !source.git) ? " · local only (not Git)" : ""}`;
  return {
    ok: true, semantic, perSource, files, warnings, updated, evidenceCount, manifestUpdated, specLine, deviation: deviation || null,
    sources: resolved.sources.map(source => ({ id: source.id, kind: source.kind, git: source.git, dir: source.kind === "external" ? toSlash(source.dir) : source.relative })),
    planHash: planHashOf({ files: files.map(({ source, file, before, after }) => ({ source, file, before, after })), deviation: deviation || null, semantic }),
  };
}

export async function planSpecSync(options) {
  const { root, sessionCwd = null, active = null, tasks = [], status = null, evidence = [], deviation = null, date, pendingCards = [], run = defaultRun } = options;
  if (status && !Object.hasOwn(SEMANTIC_WORDS, status)) return { ok: false, code: "STATUS_SEMANTIC_INVALID", message: "--status must be done|inProgress|blocked|dropped|planned." };
  const built = await buildSync({ root, sessionCwd, active, tasks, status, evidence, deviation, date, run, pendingCards });
  if (!built.ok) return built;
  const { perSource: _unused, ...plan } = built;
  return { ...plan, next: plan.files.length || plan.deviation ? { action: "run", command: `spec sync apply --plan-hash ${plan.planHash}` } : { action: "none" } };
}

async function atomicWrite(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.agm-${process.pid}-${Date.now()}.tmp`;
  await writeFile(temp, text, "utf8");
  await rename(temp, file);
}

export async function applySpecSync(options) {
  const built = await buildSync({ ...options, run: options.run || defaultRun });
  if (!built.ok) return built;
  if (built.planHash !== options.planHash) return { ok: false, code: "PLAN_STALE", message: "Spec files changed since the plan; run spec sync plan again.", next: { action: "run", command: "spec sync plan" } };
  const written = [];
  for (const { source, overlay } of built.perSource) {
    for (const file of overlay.changed()) {
      await atomicWrite(path.join(source.dir, file), overlay.texts.get(file));
      written.push({ source: source.id, kind: source.kind, file, path: displayPath(source, file) });
    }
  }
  let decisionRef = null;
  if (built.deviation) {
    decisionRef = await writeDecision(options.root, {
      slug: `spec-deviation-${String(options.active?.executionId || "manual").slice(0, 24)}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      topic: "spec/deviation", kind: "contract", title: "Implementation differs from the spec design", summary: String(built.deviation).slice(0, 140),
      requestedBy: options.active?.requestedBy || "agent", origin: "explicit",
      problem: "The verified implementation differs from the design in the spec.", options: "Record the deviation, or change the code to match the spec.",
      decision: String(built.deviation),
    });
  }
  return {
    ok: true, appliedAt: new Date().toISOString(), files: written, updated: built.updated, evidenceCount: built.evidenceCount,
    manifestUpdated: built.manifestUpdated, specLine: built.specLine, warnings: built.warnings, sources: built.sources,
    decisionRef: decisionRef ? `.agrimap-agent/${decisionRef}` : null,
  };
}

// ------------------------------------------------------------ semantic card

export function specSemanticCard({ ids = [], finding, evidence = [] }) {
  return {
    kind: "contract", topic: `spec/semantic/${ids[0] || "general"}`.toLowerCase(), risk: "R2", confidence: "medium",
    question: `งานนี้พบว่า spec ${ids.join(", ") || ""} ไม่ตรงกับที่ implement: ${String(finding || "").slice(0, 120)}`.trim(),
    impact: "ส่วนที่เป็นเนื้อหาของ spec (requirement/AC/design) แก้ได้เมื่อมีคำตอบเท่านั้น; status/evidence ยัง sync ต่อได้",
    checked: evidence.length ? evidence.slice(0, 5) : ["implementation and tests of this execution"],
    options: [
      { id: "1", label: "แก้ spec ตามที่ implement", effect: "Agent แก้ requirement/AC ใน branch เดียวกันแล้ว sync", value: "update-spec" },
      { id: "2", label: "แก้ code ให้ตรง spec", effect: "Agent แก้ code แล้ว verify ใหม่", value: "update-code" },
      { id: "3", label: "บันทึกเป็น open question แล้วไปต่อ", effect: "ไม่แก้เนื้อหา spec ในรอบนี้", value: "open-question" },
    ],
    recommended: "1", recommendedReason: "มีหลักฐานจาก test/code ของงานนี้", blocking: true, default: null, recordAs: "decision", paths: [], expiresHours: 72,
  };
}

// --------------------------------------------------------------- spec check

async function logFiles(dir, limit = 500) {
  const found = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
      if (found.length >= limit) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".jsonl")) found.push(full);
    }
  }
  await walk(dir);
  return found;
}

async function syncedExecutions(root) {
  const ids = new Set();
  for (const file of await logFiles(path.join(root, ".agrimap-agent", "logs"))) {
    const text = await readFile(file, "utf8").catch(() => "");
    for (const line of text.split(/\r?\n/)) {
      if (!line.includes("spec-sync")) continue;
      try { const event = JSON.parse(line); if (event.milestone === "spec-sync") ids.add(event.executionId || event.execution_id); } catch { /* skip */ }
    }
  }
  return ids;
}

const looksLikePath = value => /[\\/]/.test(value) || /\.[a-z0-9]{1,5}$/i.test(value);

export async function specCheck({ root, sessionCwd = null, source = null, limit = 50, run = defaultRun }) {
  const resolved = await specSources(root, { sessionCwd, run });
  if (!resolved.exists) return { ok: true, findings: [], lines: [], truncated: false, checked: [] };
  const findings = [];
  const push = item => { if (findings.length < limit) findings.push(item); };
  const sources = resolved.sources.filter(item => !source || item.id === source);
  for (const entry of sources) {
    for (const item of await manifestMismatches(entry.dir, "manifest.sha256", { limit })) push({ ...item, subject: `${entry.id}: ${item.subject}` });
    const rows = await entry.adapter.evidence(entry.dir);
    for (const row of rows) {
      if (looksLikePath(row.evidence) && !(await exists(path.join(root, row.evidence)))) push({ code: "EVIDENCE_MISSING", subject: `${entry.id}: ${row.id} → ${row.evidence}`, fix: "update the evidence path or restore the file" });
    }
    const withEvidence = new Set(rows.map(row => row.id));
    const found = await entry.adapter.findItems(entry.dir, {});
    for (const task of found.allTasks) {
      if (semanticOf(task.status) !== "done") continue;
      const covering = [task.id, ...(task.acceptance || [])];
      if ((task.acceptance || []).length && !covering.some(id => withEvidence.has(id))) push({ code: "DONE_WITHOUT_EVIDENCE", subject: `${entry.id}: ${task.id}`, fix: `spec sync plan --tasks ${task.id} --evidence <AC>=<test>` });
    }
  }
  const covers = (resolved.profile?.specs?.scopes || []).flatMap(scope => scope.covers || []);
  if (covers.length && findings.length < limit) {
    const logged = run("git", ["log", "-n", "50", "--format=%H%x1f%B%x1e", "--", ...covers.map(glob => `:(glob)${glob}`)], { cwd: root });
    const synced = await syncedExecutions(root);
    for (const record of String(logged.stdout || "").split("\x1e")) {
      const [sha, body] = record.trim().split("\x1f");
      const execution = String(body || "").match(/^AGM-Execution:\s*(\S+)/m)?.[1];
      if (execution && !synced.has(execution)) push({ code: "UNSYNCED_EXECUTION", subject: `${execution} @${String(sha).slice(0, 7)}`, fix: `spec sync plan for the tasks of ${execution}` });
    }
  }
  const lines = findings.slice(0, 5).map(item => `- ${item.code}: ${item.subject} — ${item.fix}`);
  return { ok: true, findings, lines, truncated: findings.length >= limit, checked: sources.map(item => item.id), warnings: resolved.warnings };
}
