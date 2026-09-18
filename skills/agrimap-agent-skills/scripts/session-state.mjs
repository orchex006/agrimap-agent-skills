// runtime/sessions/<session>.json is shared by identity confirmation and the
// governance fields below; every writer merges instead of replacing.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile as plainWrite } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeRecord as writeFile } from "./sensitive-recording.mjs";

export const GOVERNANCE_SESSION_FIELDS = Object.freeze(["instructionsAck", "lastCard", "lastDelivery"]);

export function safeSession(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export function sessionStatePath(state, session) {
  return path.join(state, "runtime", "sessions", `${safeSession(session)}.json`);
}

export async function readJsonFile(file) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return null; }
}

export async function writeJsonFile(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readSessionState(state, session) {
  return (await readJsonFile(sessionStatePath(state, session))) || {};
}

// patch values of undefined delete the field.
export async function updateSessionState(state, session, patch) {
  const file = sessionStatePath(state, session);
  const next = { ...(await readJsonFile(file) || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  await writeJsonFile(file, next);
  return next;
}

// Session pointer outside any repository so a hook running in a non-Git cwd
// can find the target roots of this session. Deleting it loses nothing.
export function sessionPointerPath(session) {
  const digest = createHash("sha256").update(safeSession(session)).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), "agrimap-agent", "sessions", `${digest}.json`);
}

export async function writeSessionPointer(session, targetRoots) {
  if (!safeSession(session)) return null;
  const file = sessionPointerPath(session);
  const current = await readJsonFile(file);
  const roots = [...new Set([...(targetRoots || []).map(root => path.resolve(root)), ...(current?.targetRoots || [])])].slice(0, 8);
  await mkdir(path.dirname(file), { recursive: true });
  // Machine-local temp file outside .agrimap-agent: plain JSON of absolute paths.
  await plainWrite(file, `${JSON.stringify({ targetRoots: roots, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
  return file;
}
