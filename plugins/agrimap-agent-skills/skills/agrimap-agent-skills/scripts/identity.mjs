import os from "node:os";

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
