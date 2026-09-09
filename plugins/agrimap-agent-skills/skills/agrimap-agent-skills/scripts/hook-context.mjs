#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCliArgs } from "./cli-args.mjs";
import { localAuditMetadata, normalizeIdentity } from "./identity.mjs";
import { classifyRequest, unquotedIntent } from './governance-policy.mjs';
import { AGRIMAP_OPERATION_ALIASES, AGRIMAP_ROUTER_ALIAS } from "./operation-aliases.mjs";

const AGRIMAP_PROJECT_PATTERNS = Object.freeze([
  /^agmwa-[a-z]+(?:-[a-z]+)*-ng$/i,
  /^agm(?:ws|bo)-[a-z]+(?:-[a-z]+)*-netcore$/i,
  /^agrimap-[a-z]+(?:-[a-z]+)*$/i,
  /^agrimap\.[a-z]+(?:\.[a-z]+)*$/i,
]);

const EXPLICIT_SKILL_ALIASES = Object.freeze([
  AGRIMAP_ROUTER_ALIAS,
  ...AGRIMAP_OPERATION_ALIASES,
]);

const EXPLICIT_SKILL_ALTERNATION = EXPLICIT_SKILL_ALIASES.map(escapeRegex).join("|");
const EXPLICIT_SKILL_PATTERNS = Object.freeze({
  codex: new RegExp(`(?:^|\\s)\\$(?:${EXPLICIT_SKILL_ALTERNATION})(?=$|\\s)`, "i"),
  claude: new RegExp(`(?:^|\\s)/agrimap-agent-skills:(?:${EXPLICIT_SKILL_ALTERNATION})(?=$|\\s)`, "i"),
  gemini: new RegExp(`(?:^|\\s)/(?:${EXPLICIT_SKILL_ALTERNATION})(?=$|\\s)`, "i"),
});

const SQL_META_INTENT_PATTERN = /\bagm-sql\b|\b(?:skill|plugin|package|hook|routing|router)s?\b|(?:สกิล|ปลั๊กอิน|แพ็กเกจ|ฮุก|ไม่ใช้\s*(?:skill|agm-sql))/iu;
const SQL_ACTION_PATTERN = /\b(?:create|add|write|generate|edit|modify|update|change|fix|refactor|analy[sz]e|explain|review|inspect)\b|(?:สร้าง|เพิ่ม|เขียน|แก้ไข|แก้|ปรับ|รีแฟกเตอร์|วิเคราะห์|อธิบาย|ตรวจ)/iu;
const SQL_TARGET_PATTERN = /(?:\.sql\b|\b(?:sql|t-?sql|stored\s+procedure|procedure|ddl|dml)\b|(?:เอสคิวแอล|สโตร์ดโปรซีเยอร์|โปรซีเยอร์))/iu;
const SQL_DEFINITION_PATTERN = /\b(?:create|alter|drop)\s+(?:table|view|procedure|function|trigger|index)\b|(?:สร้าง|แก้ไข|ปรับ)\s*(?:ตาราง|วิว|โปรซีเยอร์)/iu;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function workspaceRoot(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return cwd;
  }
}

function remoteRepositoryName(cwd) {
  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const tail = remote.replace(/[\\/]+$/, "").split(/[\\/:]/).filter(Boolean).at(-1) || "";
    return tail.replace(/\.git$/i, "");
  } catch {
    return "";
  }
}

function recognizedProjectName(value) {
  const name = String(value || "").trim();
  return Boolean(name) && AGRIMAP_PROJECT_PATTERNS.some((pattern) => pattern.test(name));
}

function explicitSkillInvocation(provider, prompt) {
  const value = unquotedIntent(prompt);
  if (/^\s*(?:example|ตัวอย่าง)\s*:/i.test(value)) return false;
  const pattern = EXPLICIT_SKILL_PATTERNS[provider];
  const adapterMarker = new RegExp(`(?:^|\\s)AGRIMAP_EXPLICIT_ALIAS=(?:${EXPLICIT_SKILL_ALTERNATION})(?=$|\\s)`, "i");
  return Boolean(value) && ((Boolean(pattern) && pattern.test(value)) || adapterMarker.test(value));
}

function primarySqlProductIntent(prompt) {
  const value = String(prompt || "").trim();
  if (!value || SQL_META_INTENT_PATTERN.test(value)) return false;
  if (SQL_DEFINITION_PATTERN.test(value)) return true;
  return SQL_ACTION_PATTERN.test(value) && SQL_TARGET_PATTERN.test(value);
}

function projectActivation(cwd, config) {
  if (config?.activation?.auto === true) return { active: true, reason: "config-opt-in" };
  const rootName = path.basename(cwd);
  if (recognizedProjectName(rootName)) return { active: true, reason: `project-name:${rootName}` };
  const remoteName = remoteRepositoryName(cwd);
  return recognizedProjectName(remoteName)
    ? { active: true, reason: `remote-name:${remoteName}` }
    : { active: false, reason: "not-agrimap" };
}

function safeSessionId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function zonedParts(timestamp = new Date().toISOString(), timeZone = "Asia/Bangkok") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    period: `${value.year}-${value.month}`,
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}:${value.second}`,
    runId: `${value.day}${value.hour}${value.minute}${value.second}`,
  };
}

async function archiveRawPrompt(stateRoot, config, input) {
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const eventName = input.hook_event_name || input.hookEventName || "";
  if (!['UserPromptSubmit', 'BeforeAgent'].includes(eventName) || !prompt) return null;
  // A host submission ID deduplicates retries, not repeated human submissions.
  const submitId = input.prompt_id || input.event_id || input.message_id;
  if (submitId) {
    const marker = path.join(stateRoot, 'runtime', 'submits', fingerprint(String(input.session_id || input.sessionId) + ':' + submitId));
    await mkdir(path.dirname(marker), { recursive: true });
    try { await writeFile(marker, '', { flag: 'wx' }); } catch (error) { if (error.code === 'EEXIST') return null; throw error; }
  }
  const timestamp = new Date().toISOString();
  const local = zonedParts(timestamp, config?.timeZone || "Asia/Bangkok");
  const conversationId = safeSessionId(
    input.session_id || input.sessionId || input.conversation_id || input.conversationId || input.context_id || input.contextId || input.room_id || input.roomId,
  ) || "unscoped";
  const promptPath = path.join(stateRoot, "prompts", local.period, conversationId, "history.md");
  await mkdir(path.dirname(promptPath), { recursive: true });
  await appendFile(promptPath, `### [${local.date} ${local.time}]\n${prompt}\n\n`, "utf8");
  return path.relative(stateRoot, promptPath).replace(/\\/g, "/");
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readText(filePath, limit = 7000) {
  try {
    const value = await readFile(filePath, "utf8");
    return value.length > limit
      ? `${value.slice(0, limit)}\n[context truncated by hook; read the file directly]`
      : value;
  } catch {
    return "";
  }
}

async function isSkillPackageRepository(cwd) {
  const [manifest, operations, lifecycle] = await Promise.all([
    readJson(path.join(cwd, "package.json")),
    readJson(path.join(cwd, "config", "operations.json")),
    readText(path.join(cwd, "skills", "agrimap-agent-skills", "references", "lifecycle-core.md"), 200),
  ]);
  return manifest?.name === "agrimap-agent-skills"
    && Array.isArray(operations?.operations)
    && lifecycle.startsWith("# Workflow lifecycle core");
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeProvider(value) {
  const provider = typeof value === "string" ? value.toLowerCase() : "";
  return new Set(["codex", "claude", "gemini", "antigravity"]).has(provider)
    ? provider
    : "unknown";
}

function resolveHookProvider(configuredProvider, environment) {
  // Codex exports both PLUGIN_ROOT and the Claude-compatible root. Check its
  // provider-specific variable first so a cached Claude hook cannot mislabel a
  // Codex session. Gemini has no equivalent host environment marker; its hook
  // lives in the extension-only root and carries an explicit provider value.
  if (String(environment.PLUGIN_ROOT || "").trim()) {
    return { provider: "codex", source: "Codex PLUGIN_ROOT" };
  }
  if (configuredProvider === "gemini") {
    return { provider: "gemini", source: "Gemini extension hook" };
  }
  if (String(environment.CLAUDE_PLUGIN_ROOT || "").trim()) {
    return { provider: "claude", source: "Claude CLAUDE_PLUGIN_ROOT" };
  }
  return { provider: configuredProvider, source: "explicit hook configuration" };
}

function gitRequesterSuggestion(cwd) {
  try {
    return execFileSync("git", ["config", "--get", "user.name"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  if (!filePath) return;
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  } catch {
    // Context delivery must remain fail-open. A later prompt may retry the refresh.
  }
}

async function readStdin() {
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

const args = parseCliArgs(process.argv.slice(2));
const input = await readStdin();
const configuredProvider = normalizeProvider(args.provider);
const provider = resolveHookProvider(configuredProvider, process.env).provider;
const cwd = workspaceRoot(path.resolve(input.cwd || process.cwd()));
const stateRoot = path.join(cwd, '.agrimap-agent');
const config = await readJson(path.join(stateRoot, 'config.json'));
const sessionId = safeSessionId(input.session_id || input.sessionId || input.conversation_id || input.conversationId);
const prompt = input.prompt || '';
const explicit = explicitSkillInvocation(provider, prompt);
const selection = classifyRequest({ prompt, explicit, recognized: projectActivation(cwd, config).active });
const output = { continue: true, suppressOutput: true };
// SessionStart is intentionally silent. Current-turn intent precedes identity,
// old execution state and all persistence. Names/cwd alone are insufficient.
if (selection.active) {
  await archiveRawPrompt(stateRoot, config, input);
  const active = sessionId ? await readJson(path.join(stateRoot, 'runtime', 'active', sessionId + '.json')) : null;
  const local = localAuditMetadata();
  const userKey = safeSessionId(local.machine + '-' + local.osUser);
  const rawIdentity = (sessionId && await readJson(path.join(stateRoot, 'runtime', 'sessions', sessionId + '.json')))
    || await readJson(path.join(stateRoot, 'runtime', 'users', userKey + '.json'));
  const identity = rawIdentity ? normalizeIdentity(rawIdentity) : null;
  const packageWork = await isSkillPackageRepository(cwd);
  const context = [
    'AgriMap 3.0: resolve current intent before choosing one operation. Quoted commands are examples, not authorization.',
    'Questions/explanations use no lifecycle, task files, identity prompt or tests. Start execution only for authorized durable work.',
    'Supporting skills add relevant evidence; they never grant database writes or release authority.',
    'SQL context is read-only: managed metadata and SELECT only; no DDL/DML, EXEC, metadata sync or routine deployment.',
    packageWork ? 'Workspace kind: skill-package. Package work never creates root product FE/BE/SQL artifacts.' : 'Use only the applicable project contracts.',
    identity && !identity.expired ? 'Confirmed requester: ' + identity.requestedBy + '. Identity is not approval authority.'
      : 'For a write that needs attribution, reuse confirmed conversation identity or ask once; do not ask for ordinary questions.',
    input.model ? 'Actual host model: ' + input.model + '; configurable labels are separate.' : 'Record actual host model when known; otherwise unknown.',
    sessionId ? 'Session: ' + sessionId : 'Use a stable session for durable work.'
  ];
  if (active) context.push('Existing execution ' + (active.executionId || active.taskId) + ': resume only if this request concerns it; unrelated conversation does not replace it.');
  output.hookSpecificOutput = { hookEventName: input.hook_event_name || input.hookEventName || 'UserPromptSubmit', additionalContext: context.join('\n') };
}
process.stdout.write(JSON.stringify(output));
