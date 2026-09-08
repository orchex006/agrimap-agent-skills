#!/usr/bin/env node

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;
const VERSION_PATTERN = /-v(\d{3,})\.md$/;
const REQUIRED_SECTIONS = [
  "## Main Assignment",
  "## Subagent Assignments",
  "## Acceptance Criteria",
  "## Deviation and Handoff Contract",
];

export class PromptVersionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PromptVersionError";
    this.code = code;
  }
}

function safeSegment(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized || !/^[A-Za-z0-9._-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new PromptVersionError("INVALID_PROMPT_IDENTITY", `${label} must contain only letters, digits, dot, underscore, or hyphen.`);
  }
  return normalized;
}

export function normalizePromptContext(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return safeSegment(slug, "context");
}

function localPeriod(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function posixRelative(root, target) {
  return path.relative(root, target).split(path.sep).join("/");
}

function assertInside(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PromptVersionError("PROMPT_SOURCE_CONFIRM_REQUIRED", "Prompt source must be a version file inside .agrimap-agent/prompts.");
  }
  return relative;
}

function versionFromName(fileName, context) {
  const prefix = `${context}-v`;
  if (!fileName.startsWith(prefix) || !VERSION_PATTERN.test(fileName)) return null;
  return Number(fileName.match(VERSION_PATTERN)[1]);
}

async function filesForFamily(promptRoot, period, conversationId, context) {
  const directory = path.join(promptRoot, period, conversationId);
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({ fileName: entry.name, version: versionFromName(entry.name, context) }))
    .filter((entry) => Number.isInteger(entry.version))
    .sort((left, right) => left.version - right.version)
    .map((entry) => ({ ...entry, path: path.join(directory, entry.fileName), period }));
}

async function discoverFamilies(promptRoot, conversationId, context) {
  let periods = [];
  try {
    periods = (await readdir(promptRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && PERIOD_PATTERN.test(entry.name))
      .map((entry) => entry.name);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const families = [];
  for (const period of periods) {
    const files = await filesForFamily(promptRoot, period, conversationId, context);
    if (files.length) families.push({ period, files });
  }
  return families;
}

async function resolveExplicitSource({ cwd, promptRoot, sourcePath, conversationId, context }) {
  const absolute = path.resolve(cwd, sourcePath);
  const relative = assertInside(promptRoot, absolute);
  const segments = relative.split(path.sep);
  if (segments.length !== 3 || !PERIOD_PATTERN.test(segments[0]) || segments[1] !== conversationId) {
    throw new PromptVersionError("PROMPT_SOURCE_CONFIRM_REQUIRED", "Explicit prompt source must match YYYY-MM/<conversation-id>/<context>-vNNN.md.");
  }
  const version = versionFromName(segments[2], context);
  if (!Number.isInteger(version)) {
    throw new PromptVersionError("PROMPT_SOURCE_CONFIRM_REQUIRED", "Explicit prompt source does not belong to the requested context family.");
  }
  try {
    await readFile(absolute, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw new PromptVersionError("PROMPT_SOURCE_CONFIRM_REQUIRED", "Explicit prompt source does not exist.");
    throw error;
  }
  const familyFiles = await filesForFamily(promptRoot, segments[0], conversationId, context);
  const latest = familyFiles.at(-1);
  if (!latest || latest.version !== version) {
    throw new PromptVersionError("PROMPT_SOURCE_CONFIRM_REQUIRED", "Explicit prompt source must be the latest immutable version in its family.");
  }
  return { period: segments[0], latest, method: "explicit" };
}

export async function resolvePromptSource({ cwd = process.cwd(), conversationId, context, sourcePath, now = new Date() }) {
  const safeConversation = safeSegment(conversationId, "conversation-id");
  const safeContext = normalizePromptContext(context);
  const promptRoot = path.join(path.resolve(cwd), ".agrimap-agent", "prompts");
  if (sourcePath) {
    return {
      promptRoot,
      conversationId: safeConversation,
      context: safeContext,
      ...await resolveExplicitSource({ cwd, promptRoot, sourcePath, conversationId: safeConversation, context: safeContext }),
    };
  }
  const families = await discoverFamilies(promptRoot, safeConversation, safeContext);
  if (families.length > 1) {
    throw new PromptVersionError("PROMPT_SOURCE_CONFIRM_REQUIRED", "More than one credible prompt family exists for this conversation/context; name the source file explicitly.");
  }
  if (families.length === 1) {
    return {
      promptRoot,
      conversationId: safeConversation,
      context: safeContext,
      period: families[0].period,
      latest: families[0].files.at(-1),
      method: "implicit-single-family",
    };
  }
  return {
    promptRoot,
    conversationId: safeConversation,
    context: safeContext,
    period: localPeriod(now),
    latest: null,
    method: "new",
  };
}

function quote(value) {
  return JSON.stringify(String(value));
}

function renderPromptPackage(metadata, body) {
  return [
    "---",
    `prompt_family_id: ${quote(metadata.familyId)}`,
    `version: ${metadata.version}`,
    `supersedes: ${quote(metadata.supersedes)}`,
    `requester: ${quote(metadata.requester)}`,
    `created_at: ${quote(metadata.createdAt)}`,
    `provider: ${quote(metadata.provider)}`,
    `model: ${quote(metadata.model)}`,
    `source_selection_method: ${quote(metadata.sourceSelectionMethod)}`,
    `prompt_status: ${quote(metadata.status)}`,
    `intended_execution_operation: ${quote(metadata.intendedExecutionOperation)}`,
    `change_summary: ${quote(metadata.changeSummary || '')}`,
    `source_evidence: ${quote(metadata.sourceEvidence || '')}`,
    "---",
    "",
    body.trim(),
    "",
  ].join("\n");
}

function validateBody(body) {
  if (!String(body || "").trim()) throw new PromptVersionError("INVALID_PROMPT_RESULT", "Prompt Result body is required.");
  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(section)) throw new PromptVersionError("INVALID_PROMPT_RESULT", `Prompt Result body is missing ${section}.`);
  }
}

async function acquireFamilyLock(promptRoot, conversationId, context) {
  const lockRoot = path.join(promptRoot, ".locks");
  const lockPath = path.join(lockRoot, `${conversationId}--${context}.lock`);
  await mkdir(lockRoot, { recursive: true });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await mkdir(lockPath);
      return lockPath;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new PromptVersionError("PROMPT_VERSION_LOCK_TIMEOUT", "Timed out while allocating the next Prompt Result version.");
}

export async function createPromptVersion({
  cwd = process.cwd(),
  conversationId,
  context,
  body,
  requester,
  provider,
  model,
  sourcePath,
  status = "draft",
  intendedExecutionOperation = "execute",
  intent = 'revise',
  changeSummary = '',
  sourceEvidence = '',
  now = new Date(),
}) {
  if (!['revise', 'create', 'explain', 'compare', 'propose', 'acknowledge', 'approve', 'execute'].includes(intent)) throw new PromptVersionError('INVALID_PROMPT_INTENT', 'Unknown prompt intent.');
  if (['explain', 'compare', 'propose', 'acknowledge', 'approve', 'execute'].includes(intent)) {
    if (intent === 'approve' || intent === 'execute') {
      const resolved = await resolvePromptSource({cwd, conversationId, context, sourcePath, now});
      if (!resolved.latest) throw new PromptVersionError('PROMPT_SOURCE_CONFIRM_REQUIRED', 'Name an existing Prompt Result before approval or execution.');
      const content = await readFile(resolved.latest.path);
      return {ok:true,created:false,reason:'no-content-revision',version:resolved.latest.version,path:posixRelative(path.resolve(cwd),resolved.latest.path),sha256:createHash('sha256').update(content).digest('hex'),approvalRecorded:false,next:'Record current requester approval and this exact file/hash in the active audit checkpoint; this helper grants no authority.'};
    }
    return { ok: true, created: false, reason: 'no-content-revision' };
  }
  validateBody(body);
  if (!new Set(["draft", "owner-approved", "superseded", "executed"]).has(status)) {
    throw new PromptVersionError("INVALID_PROMPT_STATUS", "prompt status must be draft|owner-approved|superseded|executed.");
  }
  const safeConversation = safeSegment(conversationId, "conversation-id");
  const safeContext = normalizePromptContext(context);
  const promptRoot = path.join(path.resolve(cwd), ".agrimap-agent", "prompts");
  const lockPath = await acquireFamilyLock(promptRoot, safeConversation, safeContext);
  try {
    const resolved = await resolvePromptSource({ cwd, conversationId: safeConversation, context: safeContext, sourcePath, now });
    if (resolved.latest) {
      const previous = await readFile(resolved.latest.path, 'utf8');
      const priorBody = previous.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
      const normalize = (value) => value.replace(/\r\n/g, '\n').trim();
      if (normalize(priorBody) === normalize(body)) return { ok: true, created: false, reason: 'unchanged-content', version: resolved.latest.version, path: posixRelative(path.resolve(cwd), resolved.latest.path) };
      if (!changeSummary.trim() || !sourceEvidence.trim()) throw new PromptVersionError('PROMPT_CHANGE_EVIDENCE_REQUIRED', 'A revision needs changeSummary and sourceEvidence from the requester; suggestions alone are not requirements.');
    }
    const version = (resolved.latest?.version || 0) + 1;
    const fileName = `${safeContext}-v${String(version).padStart(3, "0")}.md`;
    const outputDirectory = path.join(promptRoot, resolved.period, safeConversation);
    const outputPath = path.join(outputDirectory, fileName);
    await mkdir(outputDirectory, { recursive: true });
    const metadata = {
      familyId: `${safeConversation}/${safeContext}`,
      version,
      supersedes: resolved.latest ? posixRelative(path.resolve(cwd), resolved.latest.path) : "none",
      requester: safeSegment(requester, "requester"),
      createdAt: now.toISOString(),
      provider: safeSegment(provider, "provider"),
      model: String(model || "").trim() || "unresolved",
      sourceSelectionMethod: resolved.method,
      status,
      intendedExecutionOperation,
      changeSummary,
      sourceEvidence,
    };
    const content = renderPromptPackage(metadata, body);
    await writeFile(outputPath, content, { encoding: "utf8", flag: "wx" });
    return { ok: true, created: true, sha256: createHash('sha256').update(content).digest('hex'), path: posixRelative(path.resolve(cwd), outputPath), period: resolved.period, ...metadata };
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new PromptVersionError("INVALID_ARGUMENTS", `Missing value for --${key}.`);
    result[key] = value;
    index += 1;
  }
  return result;
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (args._[0] !== "create") {
    throw new PromptVersionError("INVALID_ARGUMENTS", "Usage: agm-prompt-version.mjs create --cwd . --conversation <id> --context <slug> --content-file <path> --requester <name> --provider <name> --model <name> [--source <path>] [--status <status>]");
  }
  const cwd = path.resolve(args.cwd || process.cwd());
  const body = args["content-file"] ? await readFile(path.resolve(cwd, args["content-file"]), "utf8") : undefined;
  return createPromptVersion({
    cwd,
    conversationId: args.conversation,
    context: args.context,
    body,
    requester: args.requester,
    provider: args.provider,
    model: args.model,
    sourcePath: args.source,
    status: args.status || "draft",
    intent: args.intent || 'revise',
    changeSummary: args['change-summary'] || '',
    sourceEvidence: args['source-evidence'] || '',
  });
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  runCli()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ ok: false, code: error.code || "PROMPT_VERSION_FAILED", message: error.message })}\n`);
      process.exitCode = 1;
    });
}
