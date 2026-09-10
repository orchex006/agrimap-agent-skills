// Shared v3 decisions. No filesystem, database or subprocess effects.
export const READ_OPERATIONS = new Set(['analyze', 'diagnose', 'simulate', 'plan', 'design', 'architect', 'review', 'history', 'qa', 'help', 'explain']);

export function selectWorkflow({ operation, action, tracking = false, risk = '', depth, persist = false } = {}) {
  const readOnly = READ_OPERATIONS.has(action || operation)
    || (operation === 'doctor' && (!action || ['status', 'version', 'check'].includes(action)));
  if (readOnly && !tracking && !persist) return { depth: null, reason: 'direct-answer', task: false };
  if (depth && !['light', 'standard', 'regulated'].includes(depth)) throw new Error('INVALID_WORKFLOW_DEPTH');
  const regulated = /^(external-publication|persisted-data-change|public-contract-change|independent-assurance|security-boundary)$/.test(risk);
  const selected = regulated ? 'regulated' : tracking ? 'standard' : 'light';
  if (depth && depth !== selected) throw new Error('WORKFLOW_DEPTH_REASON_MISMATCH');
  return { depth: selected, reason: regulated ? risk : tracking ? 'resume-or-handoff' : 'bounded-authorized-work', task: selected !== 'light' };
}

export function instructionProfile({ measuredProfile, taskProfile, model } = {}) {
  // Names and parameter counts are not capability evidence.
  const profile = taskProfile || measuredProfile || 'guided';
  if (!['outcome', 'guided', 'bounded'].includes(profile)) throw new Error('INVALID_INSTRUCTION_PROFILE');
  return { profile, model: model || 'unknown', changesAuthority: false };
}

export function verificationDecision({ kind, behaviorChanged = false, sharedContract = false, release = false, evidenceMatches = false } = {}) {
  if (evidenceMatches) return 'reuse-matching-evidence';
  if (kind === 'discussion') return 'none';
  if (kind === 'docs') return 'structure-and-links';
  if (release || sharedContract) return 'affected-contract-and-delivery-checks';
  return behaviorChanged ? 'targeted-regression' : 'proportional-static-check';
}

export function unquotedIntent(prompt = '') {
  return String(prompt).replace(/```[\s\S]*?```/g, '').replace(/^\s*>.*$/gm, '')
    .replace(/`[^`]*`/g, '').replace(/"[^"\n]*"|“[^”\n]*”/g, '');
}

export function classifyRequest({ prompt = '', explicit = false, recognized = false, relevant = false } = {}) {
  const text = unquotedIntent(prompt).trim();
  if (!text) return { active: false, reason: 'no-current-intent' };
  if (!explicit && /^\s*(?:example|ตัวอย่าง)\s*:/i.test(text)) return { active: false, reason: 'non-project-example' };
  // Require a relationship to the current software work, not a keyword alone.
  const projectAnchor = /\b(?:agrimap|agm(?:ws|wa|bo)-[\w-]+|(?:this|our|current)\s+(?:repo(?:sitory)?|project|code|file|service|pipeline|release|branch))\b|(?:ในโครงการ|ในโปรเจกต์|โครงการนี้|โปรเจกต์นี้|โค้ด.*นี้|ไฟล์.*นี้|งานเดิม)/i.test(text);
  const changeIntent = /\b(?:implement|fix|refactor|modify|update|build|deploy|merge|push|bump|migrate)\b|(?:แก้ไข|ปรับแก้|ปรับปรุง|เพิ่ม|สร้าง|อัปเดต)/i.test(text);
  const softwareTarget = /\b(?:repo(?:sitory)?|project|code|skill|plugin|hook|pipeline|release|branch|changelog|sql|schema|api|test|component|service|version|bug)\b|(?:โครงการ|โปรเจกต์|โค้ด|สกิล|แพ็กเกจ|ฐานข้อมูล|เวอร์ชัน|ไฟล์|บั๊ก)/i.test(text);
  const projectTerms = projectAnchor || (changeIntent && softwareTarget);
  return { active: explicit || (recognized && (relevant || projectTerms)), reason: explicit ? 'explicit-invocation' : recognized && (relevant || projectTerms) ? 'relevant-project-intent' : 'ordinary-conversation' };
}

const SQL_READ_TOOLS = new Set(['sqlctx_list_context_index', 'sqlctx_query_data', 'sqlctx_list_managed_folders', 'sqlctx_get_capabilities']);
export function sqlContextToolAllowed(name) { return SQL_READ_TOOLS.has(name); }

// Defense in depth for the AgriMap adapter. The managed service's read-only
// profile/relational parser remains authoritative; this is not a SQL parser.
export function validateReadQuery(sql) {
  const text = String(sql || '').replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, ' ').trim();
  if (!/^SELECT\b/i.test(text) || /;\s*\S/.test(text)
      || /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|MERGE|TRUNCATE|EXEC(?:UTE)?|INTO|OPENROWSET|OPENQUERY|OPENDATASOURCE)\b/i.test(text)) {
    return { ok: false, code: 'SQL_CONTEXT_READ_ONLY' };
  }
  return { ok: true };
}
