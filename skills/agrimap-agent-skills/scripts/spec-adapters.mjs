// Spec format adapters (ACG C9-B). Each adapter reads a spec source and plans
// line edits against an Overlay so several edits to one file chain and the
// manifest is computed from the final bytes. No npm dependency: YAML goes
// through the line subset in yaml-lines.mjs.
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { listItemBlocks, listUnder, mappingUnder, insertBlockScalar, setBlockScalar, splitLines } from "./yaml-lines.mjs";

const toSlash = value => String(value || "").replaceAll("\\", "/");
const exists = file => stat(file).then(() => true, () => false);
const MORYNTH = "morynth-context-index@1";
const GENERIC = "generic-markdown";
const GENERIC_ID = /\b[A-Z][A-Z0-9]{1,9}-\d{2,4}\b/g;
const ONE_ID = /\b[A-Z][A-Z0-9]{1,9}-\d{2,4}\b/;
const EVIDENCE_HEADING = "## Implementation evidence";

// ------------------------------------------------------------ status words

export const STATUS_WORDS = Object.freeze({
  planned: ["planned", "todo", "open", "backlog", "not-started"],
  inProgress: ["in-progress", "in_progress", "doing", "wip", "started"],
  done: ["delivered", "done", "completed", "implemented", "closed"],
  blocked: ["blocked", "on-hold", "waiting"],
  dropped: ["dropped", "cancelled", "canceled", "wontfix"],
});
const STATUS_DEFAULT = Object.freeze({ planned: "planned", inProgress: "in-progress", done: "delivered", blocked: "blocked", dropped: "dropped" });

export function semanticOf(value) {
  const word = String(value ?? "").trim().toLowerCase();
  if (!word) return null;
  for (const [semantic, words] of Object.entries(STATUS_WORDS)) if (words.includes(word)) return semantic;
  return "unknown";
}

// §19.7.1: statusMap override, then the most used accepted word already in the
// file, then the default with STATUS_VALUE_NEW (a warning, never a stop).
export function chooseStatusValue(semantic, observedValues = [], statusMap = null) {
  if (!STATUS_DEFAULT[semantic]) return { value: null, warning: { code: "STATUS_SEMANTIC_INVALID", subject: String(semantic), fix: "use planned|inProgress|done|blocked|dropped" } };
  if (statusMap?.[semantic]) return { value: String(statusMap[semantic]), warning: null };
  const counts = new Map();
  for (const raw of observedValues) {
    const word = String(raw ?? "").trim();
    if (STATUS_WORDS[semantic].includes(word.toLowerCase())) counts.set(word, (counts.get(word) || 0) + 1);
  }
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (used) return { value: used, warning: null };
  const value = STATUS_DEFAULT[semantic];
  return { value, warning: { code: "STATUS_VALUE_NEW", subject: value, fix: "set specs.sources[].statusMap if the team uses another word" } };
}

// ------------------------------------------------------------------ overlay

export class Overlay {
  constructor(root) {
    this.root = root;
    this.texts = new Map();
    this.original = new Map();
    this.edits = new Map();
  }

  async read(relative) {
    const key = toSlash(relative);
    if (this.texts.has(key)) return this.texts.get(key);
    const text = await readFile(path.join(this.root, key), "utf8").catch(() => null);
    this.original.set(key, text);
    this.texts.set(key, text);
    return text;
  }

  write(relative, text, edits) {
    const key = toSlash(relative);
    this.texts.set(key, text);
    this.edits.set(key, [...(this.edits.get(key) || []), ...edits]);
  }

  changed() {
    return [...this.edits.keys()].filter(key => this.texts.get(key) !== this.original.get(key));
  }

  plan() {
    return this.changed().map(file => ({ file, created: this.original.get(file) === null, edits: this.edits.get(file) }));
  }
}

const warn = (code, subject, fix) => ({ code, subject, fix });

// ------------------------------------------------------------ shared edits

function parseInlineList(value) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  return (text.startsWith("[") ? text.slice(1, -1) : text).split(",").map(item => item.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
}

function appendLines(text, eol, newLines) {
  const base = text.endsWith(eol) || text === "" ? text : `${text}${eol}`;
  return `${base}${newLines.join(eol)}${eol}`;
}

const cell = value => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();

async function planEvidenceIn(overlay, file, { id, evidence, executionId, date }) {
  const text = (await overlay.read(file)) ?? "";
  const { lines, eol } = splitLines(text);
  const row = `| ${cell(id)} | ${cell(evidence)} | ${cell(executionId)} | ${cell(date)} |`;
  if (lines.includes(row)) return { file, edits: [] };
  const start = lines.findIndex(line => line.trim() === EVIDENCE_HEADING);
  if (start < 0) {
    const added = ["", EVIDENCE_HEADING, "", "| ID | Evidence | Execution | Date |", "| --- | --- | --- | --- |", row];
    const trimmed = text.replace(/(\r?\n)+$/, "");
    const next = appendLines(trimmed, eol, added);
    const firstLine = splitLines(trimmed).lines.length + 1;
    const edits = added.map((after, index) => ({ line: firstLine + index, before: null, after }));
    overlay.write(file, next, edits);
    return { file, edits, sectionCreated: true };
  }
  let insertAt = start + 1;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,2}\s/.test(lines[index])) break;
    if (lines[index].trim().startsWith("|")) insertAt = index + 1;
  }
  lines.splice(insertAt, 0, row);
  const edits = [{ line: insertAt + 1, before: null, after: row }];
  overlay.write(file, lines.join(eol), edits);
  return { file, edits };
}

async function planChangelogIn(overlay, file, { date, summary }) {
  const text = await overlay.read(file);
  if (text === null) return null;
  const { lines, eol } = splitLines(text);
  const entry = `- ${summary}`;
  const heading = `## ${date}`;
  const at = lines.findIndex(line => line.trim() === heading);
  const edits = [];
  if (at >= 0) {
    let insertAt = at + 1;
    while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt += 1;
    if (lines.slice(insertAt).some(line => line === entry)) return { file, edits: [] };
    lines.splice(insertAt, 0, entry);
    edits.push({ line: insertAt + 1, before: null, after: entry });
  } else {
    let insertAt = lines.findIndex(line => /^##\s/.test(line));
    if (insertAt < 0) {
      insertAt = lines.length;
      while (insertAt > 0 && lines[insertAt - 1] === "") insertAt -= 1;
      lines.splice(insertAt, 0, "", heading, "", entry);
      edits.push(...["", heading, "", entry].map((after, index) => ({ line: insertAt + index + 1, before: null, after })));
    } else {
      lines.splice(insertAt, 0, heading, "", entry, "");
      edits.push(...[heading, "", entry, ""].map((after, index) => ({ line: insertAt + index + 1, before: null, after })));
    }
  }
  overlay.write(file, lines.join(eol), edits);
  return { file, edits };
}

export const sha256 = text => createHash("sha256").update(Buffer.from(String(text), "utf8")).digest("hex");

// `<sha256>  <relative/path>` lines, LF unless the file uses CRLF; keeps order,
// appends new files, recomputes only files this sync changed.
async function planManifestIn(overlay, file, changedFiles) {
  const text = await overlay.read(file);
  if (text === null) return null;
  const { lines, eol } = splitLines(text);
  const targets = changedFiles.filter(item => item !== file);
  const seen = new Set();
  const edits = [];
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^([0-9a-fA-F]{64})( {2}|\s\*)(.+)$/);
    if (!match) continue;
    const relative = toSlash(match[3].trim());
    if (!targets.includes(relative)) continue;
    seen.add(relative);
    const after = `${sha256(await overlay.read(relative))}  ${relative}`;
    if (after !== line) { lines[index] = after; edits.push({ line: index + 1, before: line, after }); }
  }
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") end -= 1;
  const appended = [];
  for (const relative of targets) {
    if (seen.has(relative)) continue;
    appended.push(`${sha256(await overlay.read(relative))}  ${relative}`);
  }
  lines.splice(end, 0, ...appended);
  appended.forEach((after, index) => edits.push({ line: end + index + 1, before: null, after }));
  if (!edits.length) return { file, edits: [] };
  overlay.write(file, lines.join(eol), edits);
  return { file, edits };
}

export async function manifestMismatches(root, file = "manifest.sha256", { limit = 50 } = {}) {
  const text = await readFile(path.join(root, file), "utf8").catch(() => null);
  if (text === null) return [];
  const findings = [];
  for (const line of text.split(/\r?\n/)) {
    if (findings.length >= limit) break;
    const match = line.match(/^([0-9a-fA-F]{64})( {2}|\s\*)(.+)$/);
    if (!match) continue;
    const relative = toSlash(match[3].trim());
    const body = await readFile(path.join(root, relative)).catch(() => null);
    const actual = body ? createHash("sha256").update(body).digest("hex") : null;
    if (actual !== match[1].toLowerCase()) findings.push({ code: "MANIFEST_MISMATCH", subject: relative, fix: actual ? "spec sync recomputes it; otherwise ask the spec owner" : "file listed in the manifest is missing" });
  }
  return findings;
}

async function markdownFiles(root, { limit = 200, depth = 4 } = {}) {
  const found = [];
  async function walk(dir, level) {
    if (found.length >= limit || level > depth) return;
    for (const entry of (await readdir(dir, { withFileTypes: true }).catch(() => [])).sort((a, b) => a.name.localeCompare(b.name))) {
      if (found.length >= limit) return;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, level + 1);
      else if (/\.md$/i.test(entry.name)) found.push(toSlash(path.relative(root, full)));
    }
  }
  await walk(root, 0);
  return found;
}

function queryWords(query) {
  return [...new Set(String(query || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 3))];
}

function rankByQuery(items, query) {
  const words = queryWords(query);
  if (!words.length) return [];
  return items
    .map(item => ({ item, score: words.filter(word => String(item.title || "").toLowerCase().includes(word) || String(item.id).toLowerCase() === word).length }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.item);
}

// ---------------------------------------------------- morynth-context-index@1

const M = {
  index: "06-agent/CONTEXT-INDEX.yaml",
  entry: "06-agent/AGENT-START-HERE.md",
  tasks: "06-agent/TASKS.yaml",
  requirements: "06-agent/REQUIREMENTS.yaml",
  questions: "06-agent/OPEN-QUESTIONS.yaml",
  traceability: "00-source-of-truth/TRACEABILITY.md",
  changelog: "CHANGELOG.md",
  manifest: "manifest.sha256",
};

const fromAgentDir = relative => toSlash(path.posix.normalize(path.posix.join("06-agent", toSlash(relative))));

function expandRange(value) {
  const range = String(value || "").match(/^([A-Z][A-Z0-9]*-)(\d+)\.\.([A-Z][A-Z0-9]*-)?(\d+)$/);
  if (!range) return parseInlineList(value);
  const width = range[2].length;
  const ids = [];
  for (let number = Number(range[2]); number <= Number(range[4]) && ids.length < 500; number += 1) ids.push(`${range[1]}${String(number).padStart(width, "0")}`);
  return ids;
}

async function goalReadmes(root, words, ids) {
  const goals = path.join(root, "goals");
  const result = [];
  for (const entry of await readdir(goals, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const relative = `goals/${entry.name}/README.md`;
    const text = await readFile(path.join(root, relative), "utf8").catch(() => null);
    if (text === null) continue;
    const lower = `${entry.name} ${text}`.toLowerCase();
    if (words.some(word => lower.includes(word)) || ids.some(id => text.includes(id))) result.push(relative);
  }
  return result;
}

const morynth = {
  format: MORYNTH,
  files: M,
  async detect(root) {
    const text = await readFile(path.join(root, M.index), "utf8").catch(() => null);
    return Boolean(text && /^schema:\s*morynth-context-index@1\s*(?:#.*)?$/m.test(text));
  },
  async readIndex(root, { query = "", ids = [] } = {}) {
    const text = await readFile(path.join(root, M.index), "utf8").catch(() => "");
    const warnings = [];
    const project = mappingUnder(text, "project");
    const order = listUnder(text, "read_order");
    const canonical = mappingUnder(text, "canonical_files");
    for (const part of [project, order, canonical]) if (!part.ok) warnings.push(warn(part.code, `${M.index}:${part.line}`, `read ${M.entry} yourself; ${part.reason}`));
    const goals = await goalReadmes(root, queryWords(query), ids);
    return {
      projectId: project.value?.id ?? null, version: project.value?.version ?? null, entry: M.entry,
      readOrder: [...goals, ...(order.value || []).map(fromAgentDir)],
      canonical: Object.fromEntries(Object.entries(canonical.value || {}).map(([key, value]) => [key, fromAgentDir(value)])),
      goals, warnings,
    };
  },
  async tasks(root, overlay = null) {
    const text = overlay ? await overlay.read(M.tasks) : await readFile(path.join(root, M.tasks), "utf8").catch(() => null);
    if (text === null) return { ok: false, code: "SPEC_FILE_MISSING", file: M.tasks, blocks: [], text: null };
    const parsed = listItemBlocks(text, "tasks");
    return parsed.ok ? { ok: true, blocks: parsed.blocks, text } : { ...parsed, file: M.tasks, blocks: [], text };
  },
  async findItems(root, { ids = [], query = "" } = {}) {
    const warnings = [];
    const items = [];
    const tasks = await this.tasks(root);
    if (!tasks.ok) warnings.push(warn(tasks.code === "SPEC_FILE_MISSING" ? "SPEC_FILE_MISSING" : "ADAPTER_PARSE_FAILED", `${M.tasks}${tasks.line ? `:${tasks.line}` : ""}`, `read ${M.tasks} yourself; automatic sync skips it`));
    for (const block of tasks.blocks) {
      items.push({
        id: block.id, kind: "task", file: M.tasks, line: block.startLine, title: block.fields.title?.value || "",
        status: block.fields.status?.value ?? null, requirements: parseInlineList(block.fields.requirements?.value), acceptance: parseInlineList(block.fields.acceptance?.value),
      });
    }
    const reqText = await readFile(path.join(root, M.requirements), "utf8").catch(() => null);
    const requirements = [];
    if (reqText !== null) {
      const groups = listItemBlocks(reqText, "groups");
      if (!groups.ok) warnings.push(warn("ADAPTER_PARSE_FAILED", `${M.requirements}:${groups.line}`, `read ${M.requirements} yourself`));
      for (const group of groups.blocks || []) {
        for (const id of expandRange(group.fields.ids?.value)) requirements.push({ id, kind: "requirement", file: M.requirements, line: group.startLine, title: group.fields.title?.value || group.id, status: null });
      }
    }
    const qText = await readFile(path.join(root, M.questions), "utf8").catch(() => null);
    const questions = [];
    if (qText !== null) {
      const { lines } = splitLines(qText);
      const parsed = listItemBlocks(qText, "questions");
      if (!parsed.ok) warnings.push(warn("ADAPTER_PARSE_FAILED", `${M.questions}:${parsed.line}`, `read ${M.questions} yourself`));
      for (const block of parsed.blocks || []) {
        const body = lines.slice(block.startLine - 1, block.endLine).join("\n");
        questions.push({ id: block.id, kind: "question", file: M.questions, line: block.startLine, title: block.fields.text?.value || block.fields.question?.value || "", status: block.fields.status?.value ?? "open", refs: [...new Set(body.match(GENERIC_ID) || [])] });
      }
    }
    const wanted = new Set(ids);
    let selected;
    if (wanted.size) {
      selected = items.filter(item => wanted.has(item.id));
      for (const task of selected) for (const id of task.requirements) wanted.add(id);
      selected.push(...requirements.filter(item => wanted.has(item.id) && !selected.some(entry => entry.id === item.id)));
    } else selected = rankByQuery([...items, ...requirements], query).slice(0, 10);
    const acceptance = [...new Set(selected.flatMap(item => item.acceptance || []))].map(id => ({ id, kind: "acceptance", file: M.tasks, line: selected.find(item => (item.acceptance || []).includes(id))?.line ?? null, title: "", status: null }));
    const related = new Set(selected.flatMap(item => [item.id, ...(item.acceptance || []), ...(item.requirements || [])]));
    const blocking = questions.filter(question => !/^(?:closed|answered|resolved)$/i.test(String(question.status)) && question.refs.some(ref => related.has(ref)));
    return { items: [...selected, ...acceptance].slice(0, 20), blockingQuestions: blocking, allTasks: items, warnings };
  },
  async planStatus(overlay, id, semantic, { statusMap = null, force = false } = {}) {
    const tasks = await this.tasks(overlay.root, overlay);
    if (!tasks.ok) return { warnings: [warn(tasks.code === "SPEC_FILE_MISSING" ? "SPEC_FILE_MISSING" : "ADAPTER_PARSE_FAILED", `${M.tasks}${tasks.line ? `:${tasks.line}` : ""}`, `update ${id} in ${M.tasks} by hand: spec sync plan --tasks ${id}`)] };
    const block = tasks.blocks.find(item => item.id === id);
    if (!block) return { warnings: [warn("TASK_NOT_FOUND", id, `check the id in ${M.tasks}`)] };
    return statusEdit(overlay, M.tasks, tasks, block, semantic, { statusMap, force });
  },
  planEvidence(overlay, input) { return planEvidenceIn(overlay, M.traceability, input); },
  planChangelog(overlay, input) { return planChangelogIn(overlay, M.changelog, input); },
  planManifest(overlay, changed) { return planManifestIn(overlay, M.manifest, changed); },
  async evidence(root) { return evidenceRows(root, M.traceability); },
};

async function statusEdit(overlay, file, tasks, block, semantic, { statusMap, force }) {
  const warnings = [];
  const observed = tasks.blocks.map(item => item.fields.status?.value).filter(value => value !== null && value !== undefined);
  const current = block.fields.status;
  if (current?.unsupported) return { warnings: [warn("ADAPTER_PARSE_FAILED", `${file}:${current.line}`, `set the status of ${block.id} by hand (${current.unsupported})`)] };
  if (current && semanticOf(current.value) === "unknown" && !force) {
    return { warnings: [warn("STATUS_VALUE_UNKNOWN", `${block.id}: ${current.value}`, `status "${current.value}" is not a known word; update ${block.id} only when asked`)], skipped: true };
  }
  const choice = chooseStatusValue(semantic, observed, statusMap);
  if (!choice.value) return { warnings: [choice.warning] };
  if (choice.warning) warnings.push({ ...choice.warning, subject: `${choice.warning.subject} in ${file}` });
  if (current && current.value === choice.value) return { warnings, unchanged: true, value: choice.value };
  const result = current ? setBlockScalar(tasks.text, block, "status", choice.value) : insertBlockScalar(tasks.text, block, "status", choice.value);
  if (!result.ok) return { warnings: [...warnings, warn(result.code, `${file}:${result.line || block.startLine}`, `set the status of ${block.id} by hand`)] };
  if (!current) warnings.push(warn("TASK_STATUS_LINE_ADDED", block.id, `added "status: ${choice.value}" to ${file}`));
  overlay.write(file, result.text, [result.edit]);
  return { warnings, value: choice.value, edit: result.edit };
}

async function evidenceRows(root, file) {
  const text = await readFile(path.join(root, file), "utf8").catch(() => null);
  if (text === null) return [];
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === EVIDENCE_HEADING);
  if (start < 0) return [];
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    const cells = line.split("|").slice(1, -1).map(value => value.trim());
    if (cells.length < 2 || cells[0] === "ID" || /^-+$/.test(cells[0])) continue;
    rows.push({ id: cells[0], evidence: cells[1], execution: cells[2] || null, date: cells[3] || null, file });
  }
  return rows;
}

// --------------------------------------------------------- generic-markdown

const generic = {
  format: GENERIC,
  async detect() { return true; },
  async readIndex(root, { query = "", ids = [] } = {}) {
    const readme = await exists(path.join(root, "README.md")) ? "README.md" : null;
    const words = queryWords(query);
    const matches = [];
    for (const file of await markdownFiles(root)) {
      if (file === readme || matches.length >= 7) continue;
      const text = await readFile(path.join(root, file), "utf8").catch(() => "");
      const lower = text.toLowerCase();
      if (ids.some(id => text.includes(id)) || (words.length && words.some(word => lower.includes(word)))) matches.push(file);
    }
    return { projectId: null, version: null, entry: readme, readOrder: [...(readme ? [readme] : []), ...matches], canonical: {}, goals: [], warnings: [] };
  },
  async scan(root, overlay = null) {
    const items = [];
    for (const file of await markdownFiles(root)) {
      const text = overlay ? await overlay.read(file) : await readFile(path.join(root, file), "utf8").catch(() => "");
      const lines = splitLines(text || "").lines;
      for (const [index, line] of lines.entries()) {
        const box = line.match(/^\s*[-*] \[( |x|X)\] (.*)$/);
        const ids = line.match(GENERIC_ID) || [];
        if (!ids.length) continue;
        const id = ids[0];
        if (items.some(item => item.id === id && item.file === file)) continue;
        const statusLine = sectionStatus(lines, index);
        items.push({
          id, kind: box || statusLine ? "task" : id.startsWith("AC-") ? "acceptance" : "requirement", file, line: index + 1,
          title: line.replace(/^\s*(?:[-*] \[[ xX]\] |[-*#>|]+\s*)/, "").replace(id, "").replace(/^[\s:—-]+/, "").trim().slice(0, 120),
          status: box ? (box[1] === " " ? "planned" : "done") : statusLine?.value ?? null, checkbox: Boolean(box), statusLine: statusLine?.line ?? null,
        });
      }
    }
    return items;
  },
  async findItems(root, { ids = [], query = "" } = {}) {
    const all = await this.scan(root);
    const items = ids.length ? all.filter(item => ids.includes(item.id)) : rankByQuery(all, query).slice(0, 10);
    return { items, blockingQuestions: [], allTasks: all.filter(item => item.kind === "task"), warnings: [] };
  },
  async planStatus(overlay, id, semantic, { statusMap = null } = {}) {
    const all = await this.scan(overlay.root, overlay);
    const item = all.find(entry => entry.id === id && (entry.checkbox || entry.statusLine));
    if (!item) return { warnings: [warn("TASK_NOT_FOUND", id, `no checkbox or Status line for ${id}; update it by hand`)] };
    const text = await overlay.read(item.file);
    const { lines, eol } = splitLines(text);
    if (item.statusLine) {
      const index = item.statusLine - 1;
      const before = lines[index];
      const observed = all.filter(entry => entry.statusLine && entry.file === item.file).map(entry => entry.status);
      if (semanticOf(item.status) === "unknown") return { warnings: [warn("STATUS_VALUE_UNKNOWN", `${id}: ${item.status}`, `update ${id} only when asked`)], skipped: true };
      const choice = chooseStatusValue(semantic, observed, statusMap);
      if (!choice.value) return { warnings: [choice.warning] };
      const after = before.replace(/(Status:\s*)(\S+)/i, `$1${choice.value}`);
      if (after === before) return { warnings: [], unchanged: true, value: choice.value };
      lines[index] = after;
      overlay.write(item.file, lines.join(eol), [{ line: index + 1, before, after }]);
      return { warnings: choice.warning ? [choice.warning] : [], value: choice.value };
    }
    if (semantic !== "done" && semantic !== "planned") return { warnings: [warn("STATUS_NOT_REPRESENTABLE", id, `a checkbox holds only done or planned; note ${semantic} in the summary`)] };
    const index = item.line - 1;
    const before = lines[index];
    const after = before.replace(/\[( |x|X)\]/, semantic === "done" ? "[x]" : "[ ]");
    if (after === before) return { warnings: [], unchanged: true, value: semantic };
    lines[index] = after;
    overlay.write(item.file, lines.join(eol), [{ line: index + 1, before, after }]);
    return { warnings: [], value: semantic };
  },
  async planEvidence(overlay, input) {
    if (await overlay.read("TRACEABILITY.md") !== null) return planEvidenceIn(overlay, "TRACEABILITY.md", input);
    const item = (await this.scan(overlay.root, overlay)).find(entry => entry.id === input.id);
    if (!item) return { file: null, edits: [], warnings: [warn("EVIDENCE_TARGET_MISSING", input.id, "no file mentions this id; add evidence by hand")] };
    return planEvidenceIn(overlay, item.file, input);
  },
  planChangelog(overlay, input) { return planChangelogIn(overlay, "CHANGELOG.md", input); },
  planManifest(overlay, changed) { return planManifestIn(overlay, "manifest.sha256", changed); },
  async evidence(root) {
    const rows = [];
    for (const file of await markdownFiles(root, { limit: 50 })) rows.push(...await evidenceRows(root, file));
    return rows;
  },
};

function sectionStatus(lines, index) {
  for (let cursor = index; cursor < Math.min(lines.length, index + 12); cursor += 1) {
    if (cursor > index && (/^#{1,6}\s/.test(lines[cursor]) || ONE_ID.test(lines[cursor]))) break;
    const match = lines[cursor].match(/\bStatus:\s*([A-Za-z_-]+)/i);
    if (match) return { line: cursor + 1, value: match[1] };
  }
  return null;
}

// --------------------------------------------------------------- selection

export const ADAPTERS = Object.freeze({ [MORYNTH]: morynth, [GENERIC]: generic });

// Declared format wins when it detects; morynth is detected even when the
// profile says generic; spec-kit/kiro/openspec layouts fall back with a warning.
export async function adapterFor(root, format = GENERIC) {
  const warnings = [];
  if (format === MORYNTH && await morynth.detect(root)) return { adapter: morynth, warnings };
  if (format === MORYNTH) warnings.push(warn("SPEC_FORMAT_FALLBACK", toSlash(path.basename(root)), `${M.index} lacks schema: ${MORYNTH}; using ${GENERIC}`));
  else if (await morynth.detect(root)) return { adapter: morynth, warnings };
  for (const marker of [".specify", ".kiro/specs", "openspec"]) {
    if (await exists(path.join(root, marker))) { warnings.push(warn("SPEC_FORMAT_FALLBACK", marker, `${marker} is read as ${GENERIC}; tool-specific sync is not supported`)); break; }
  }
  return { adapter: generic, warnings };
}

