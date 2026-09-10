import os from "node:os";
import path from 'node:path';
import {readFile, readdir, stat} from 'node:fs/promises';

export const IDENTITY_SCHEMA_VERSION = 2;
export const DEFAULT_CONFIRMATION_HOURS = 0;
export const IDENTITY_SOURCES = Object.freeze([
  "manual-confirmed",
  "git-config-confirmed",
  "legacy-migrated",
]);

const IDENTITY_SOURCE_SET = new Set(IDENTITY_SOURCES);

function validIso(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

export function confirmationExpiry(confirmedAt, hours = DEFAULT_CONFIRMATION_HOURS) {
  if (!Number(hours)) return null;
  const confirmed = Date.parse(String(confirmedAt || ""));
  const boundedHours = Math.min(168, Math.max(1, Number(hours) || DEFAULT_CONFIRMATION_HOURS));
  return Number.isFinite(confirmed)
    ? new Date(confirmed + boundedHours * 3_600_000).toISOString()
    : "";
}

export function normalizeIdentity(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const confirmedAt = validIso(value.confirmedAt || value.updatedAt);
  const persistent = value.schemaVersion >= 2 && value.expiresAt === null;
  const expiresAt = persistent ? null : validIso(value.expiresAt)
    || confirmationExpiry(confirmedAt, options.confirmationHours || 24);
  const requestedBy = String(value.requestedBy || "").trim();
  const identitySource = IDENTITY_SOURCE_SET.has(value.identitySource)
    ? value.identitySource
    : "legacy-migrated";
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const expiresMs = Date.parse(expiresAt);

  return {
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    sessionId: String(value.sessionId || "").trim(),
    requestedBy,
    requesterId: String(value.requesterId || "").trim() || null,
    identitySource,
    confirmedAt: confirmedAt || null,
    expiresAt: expiresAt || null,
    model: String(value.model || value.actor || "unknown").trim() || "unknown",
    modelLabel: String(value.modelLabel || "not-configured").trim() || "not-configured",
    role: String(value.role || "leader").trim() || "leader",
    agent: String(value.agent || "primary").trim() || "primary",
    provider: String(value.provider || options.defaultProvider || "unknown").trim() || "unknown",
    machine: String(value.machine || "").trim() || null,
    osUser: String(value.osUser || "").trim() || null,
    expired: Boolean(value.revoked) || !requestedBy || !confirmedAt || (!persistent && (!Number.isFinite(expiresMs) || expiresMs <= nowMs)),
  };
}

export function localAuditMetadata() {
  let osUser = null;
  try {
    osUser = os.userInfo().username || null;
  } catch {
    osUser = null;
  }
  return {
    machine: os.hostname() || null,
    osUser,
  };
}

export function isIdentitySource(value) {
  return IDENTITY_SOURCE_SET.has(value);
}

const identityKey = value => String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

// Read local confirmation records only; never infer the requester from Git/OS names.
// Shared by hooks and runtime so an expired session cannot hide a newer confirmation.
export async function readConfirmedIdentity(state, sessionId, options = {}) {
  const local = options.local || localAuditMetadata();
  const session = identityKey(sessionId);
  async function read(relative) {
    const file = path.join(state, relative);
    try {
      if ((await stat(file)).size > 65536) return null;
      const raw = JSON.parse(await readFile(file, 'utf8'));
      if (!isIdentitySource(raw?.identitySource)) return null;
      const identity = normalizeIdentity(raw, options);
      return identity ? {...identity, revoked: Boolean(raw.revoked), confirmationRecord: relative.replaceAll('\\', '/')} : null;
    } catch { return null; }
  }
  const current = session ? await read(`runtime/sessions/${session}.json`) : null;
  if (current && (!current.expired || current.revoked)) return current;
  const sameLocal = identity => Boolean(identity && local.machine && local.osUser
    && identity.machine === local.machine && identity.osUser === local.osUser);
  const newerThanCurrent = identity => !current || (identity.requestedBy === current.requestedBy
    && Date.parse(identity.confirmedAt) > Date.parse(current.confirmedAt));
  const user = await read(`runtime/users/${identityKey(local.machine + '-' + local.osUser)}.json`);
  if (sameLocal(user) && user.revoked) return user;
  if (sameLocal(user) && !user.expired && newerThanCurrent(user)) return {...user, sessionId: session};
  // Older versions recorded session files without a users registry. Recover only
  // unambiguous, still-valid confirmations from this same workspace and local user.
  const names = (await readdir(path.join(state, 'runtime/sessions'), {withFileTypes:true}).catch(() => []))
    .filter(e => e.isFile() && /^[a-zA-Z0-9._-]+\.json$/.test(e.name)).map(e => e.name);
  if (names.length > 256) return current;
  const records = (await Promise.all(names.map(name => read(`runtime/sessions/${name}`)))).filter(sameLocal);
  const candidates = records.filter(identity => !identity.expired && newerThanCurrent(identity)
    && !records.some(other => other.requestedBy === identity.requestedBy && other.revoked));
  if (new Set(candidates.map(identity => identity.requestedBy)).size !== 1) return current;
  candidates.sort((a,b) => Date.parse(b.confirmedAt) - Date.parse(a.confirmedAt));
  return {...candidates[0], sessionId: session};
}
