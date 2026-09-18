// Team decision records and project facts shared by policy, project profile and
// decision cards. Records are committed team state under .agrimap-agent/.
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { writeRecord as writeFile } from "./sensitive-recording.mjs";

export function bangkokParts(timestamp = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(timestamp)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    period: `${parts.year}-${parts.month}`,
    runId: `${parts.day}${parts.hour}${parts.minute}${parts.second}`,
  };
}

const yamlValue = value => value === null || value === undefined ? "null" : JSON.stringify(String(value));

async function unusedPath(file) {
  for (let index = 1; index < 100; index += 1) {
    const candidate = index === 1 ? file : file.replace(/\.md$/, `-${index}.md`);
    if (!(await stat(candidate).then(() => true, () => false))) return candidate;
  }
  throw new Error("DECISION_PATH_EXHAUSTED");
}

// Frontmatter keeps every v1 field and adds the v2 fields (kind, summary,
// scope_paths, applies_when, origin, card_id).
export async function writeDecision(root, {
  slug, topic, kind = "convention", title, summary, problem, options, decision, requestedBy,
  origin = "explicit", cardId = null, supersedes = null, now = new Date(),
}) {
  const local = bangkokParts(now);
  const directory = path.join(root, ".agrimap-agent", "decisions", local.period);
  await mkdir(directory, { recursive: true });
  const file = await unusedPath(path.join(directory, `${local.runId}-${slug}.md`));
  const content = [
    "---",
    `topic: ${topic}`,
    "status: approved # proposed|approved|rejected|superseded",
    `supersedes: ${supersedes ? yamlValue(supersedes) : "null"}`,
    "superseded_by: null",
    "affected: []",
    "service_refs: []",
    'review_evidence: "not-recorded"',
    `date: ${local.date}`,
    `requested_by: ${yamlValue(requestedBy)}`,
    "requester_authority: requester",
    `decision_owner: ${yamlValue(requestedBy)}`,
    `authority_evidence: ${yamlValue(origin === "card" ? `decision card ${cardId}` : "explicit requester instruction")}`,
    `kind: ${kind}`,
    `summary: ${yamlValue(String(summary).slice(0, 140))}`,
    "scope_paths: []",
    'applies_when: ""',
    `origin: ${origin}`,
    `card_id: ${cardId ? yamlValue(cardId) : "null"}`,
    "---",
    "",
    `# Decision: ${title}`,
    "",
    "## Problem and evidence",
    "",
    problem,
    "",
    "## Options and trade-offs",
    "",
    options,
    "",
    "## Decision, reason, and consequences",
    "",
    decision,
    "",
  ].join("\n");
  await writeFile(file, content, "utf8");
  return path.relative(path.join(root, ".agrimap-agent"), file).replaceAll("\\", "/");
}

// Adds one line under `## Facts` of memory/project.md; replaces a line with the
// same key prefix so repeated confirmations do not accumulate.
export async function upsertProjectFact(root, key, line) {
  const file = path.join(root, ".agrimap-agent", "memory", "project.md");
  let content = await readFile(file, "utf8").catch(() => "# Project memory\n");
  const entry = `- ${key}: ${line}`;
  const lines = content.replace(/\s+$/, "").split(/\r?\n/);
  const existing = lines.findIndex(item => item.startsWith(`- ${key}:`));
  if (existing >= 0) lines[existing] = entry;
  else {
    let heading = lines.findIndex(item => item.trim() === "## Facts");
    if (heading < 0) { lines.push("", "## Facts", ""); heading = lines.length - 2; }
    let insert = heading + 1;
    while (insert < lines.length && !/^#{1,6}\s/.test(lines[insert])) insert += 1;
    while (insert > heading + 1 && !lines[insert - 1].trim()) insert -= 1;
    lines.splice(insert, 0, entry);
  }
  content = `${lines.join("\n")}\n`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return ".agrimap-agent/memory/project.md";
}
