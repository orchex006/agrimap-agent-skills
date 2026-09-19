// Line-based YAML subset for spec packs (ACG C9-B). Not a YAML parser: it reads
// the shapes spec packs use and edits one line at a time so a status change is a
// one-line diff. Unsupported constructs (tab indent, anchors/aliases, block or
// multi-line scalars) fail only for that construct with ADAPTER_PARSE_FAILED.

const FAILED = "ADAPTER_PARSE_FAILED";

export function splitLines(text) {
  const value = String(text ?? "");
  return { lines: value.split(/\r?\n/), eol: value.includes("\r\n") ? "\r\n" : "\n" };
}

function fail(line, reason) {
  return { ok: false, code: FAILED, line, reason };
}

function indentOf(line) {
  const match = line.match(/^([ \t]*)/)[1];
  return { width: match.length, tab: match.includes("\t") };
}

const blank = line => /^\s*(?:#.*)?$/.test(line);

// Splits `value  # comment` outside quotes.
function splitComment(raw) {
  let quote = null;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quote) { if (char === quote) quote = null; continue; }
    if (char === "'" || char === '"') { if (!raw.slice(0, index).trim()) quote = char; continue; }
    if (char === "#" && (index === 0 || /\s/.test(raw[index - 1]))) {
      const head = raw.slice(0, index);
      return { value: head.trimEnd(), comment: raw.slice(head.trimEnd().length) };
    }
  }
  return { value: raw.trimEnd(), comment: "" };
}

function unquote(value) {
  const match = value.match(/^(['"])(.*)\1$/);
  if (!match) return value;
  return match[1] === "'" ? match[2].replaceAll("''", "'") : match[2].replace(/\\"/g, '"');
}

// Returns { value } or { unsupported: reason } for a scalar after `key:`.
function scalar(raw) {
  const { value } = splitComment(raw.trim());
  if (/^[|>][+-]?\d*$/.test(value)) return { unsupported: "block scalar" };
  if (/^[&*][^\s]+/.test(value)) return { unsupported: "anchor or alias" };
  if (/^(['"])/.test(value) && !/^(['"]).*\1$/.test(value)) return { unsupported: "multi-line quoted scalar" };
  return { value: unquote(value) };
}

const KEY_LINE = /^(\s*)(- )?([A-Za-z0-9_.-]+):(?:\s+(.*))?$|^(\s*)(- )?([A-Za-z0-9_.-]+):$/;

function keyLine(line) {
  const match = line.match(KEY_LINE);
  if (!match) return null;
  return match[3] !== undefined
    ? { indent: match[1].length, dash: Boolean(match[2]), key: match[3], rest: match[4] ?? "" }
    : { indent: match[5].length, dash: Boolean(match[6]), key: match[7], rest: "" };
}

function findKey(lines, key, indent = 0) {
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = keyLine(lines[index]);
    if (parsed && !parsed.dash && parsed.key === key && parsed.indent === indent) return { index, parsed };
  }
  return null;
}

export function topLevelScalar(text, key) {
  const { lines } = splitLines(text);
  const found = findKey(lines, key, 0);
  if (!found) return { ok: true, value: null, line: null };
  if (indentOf(lines[found.index]).tab) return fail(found.index + 1, "tab indent");
  const result = scalar(found.parsed.rest);
  if (result.unsupported) return fail(found.index + 1, result.unsupported);
  return { ok: true, value: result.value === "" ? null : result.value, line: found.index + 1 };
}

export function mappingUnder(text, key) {
  const { lines } = splitLines(text);
  const found = findKey(lines, key, 0);
  if (!found) return { ok: true, value: {} };
  const value = {};
  for (let index = found.index + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (blank(line)) continue;
    const indent = indentOf(line);
    if (indent.tab) return fail(index + 1, "tab indent");
    if (indent.width === 0) break;
    if (indent.width !== 2) continue;
    const parsed = keyLine(line);
    if (!parsed || parsed.dash) continue;
    const result = scalar(parsed.rest);
    if (result.unsupported) return fail(index + 1, result.unsupported);
    if (result.value !== "") value[parsed.key] = result.value;
  }
  return { ok: true, value };
}

export function listUnder(text, key) {
  const { lines } = splitLines(text);
  let found = findKey(lines, key, 0);
  if (!found) {
    for (let indent = 2; indent <= 8 && !found; indent += 2) found = findKey(lines, key, indent);
  }
  if (!found) return { ok: true, value: [] };
  const rest = splitComment(found.parsed.rest.trim()).value;
  if (rest.startsWith("[")) {
    if (!rest.endsWith("]")) return fail(found.index + 1, "multi-line flow sequence");
    return { ok: true, value: rest.slice(1, -1).split(",").map(item => unquote(item.trim())).filter(Boolean) };
  }
  const base = found.parsed.indent;
  const value = [];
  for (let index = found.index + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (blank(line)) continue;
    const indent = indentOf(line);
    if (indent.tab) return fail(index + 1, "tab indent");
    const item = line.match(/^(\s*)- (.*)$/);
    if (item && item[1].length >= base) {
      const result = scalar(item[2]);
      if (result.unsupported) return fail(index + 1, result.unsupported);
      value.push(result.value);
      continue;
    }
    if (indent.width <= base) break;
  }
  return { ok: true, value };
}

// Blocks of `- <idKey>: X` items under `listKey:`. Line numbers are 1-based.
export function listItemBlocks(text, listKey, idKey = "id") {
  const { lines } = splitLines(text);
  const found = findKey(lines, listKey, 0);
  if (!found) return { ok: true, blocks: [] };
  const blocks = [];
  let itemIndent = null;
  let current = null;
  const close = end => { if (current) { current.endLine = end; blocks.push(current); current = null; } };
  let index = found.index + 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (blank(line)) continue;
    const indent = indentOf(line);
    if (indent.tab) {
      if (current) return fail(index + 1, "tab indent");
      continue;
    }
    const parsed = keyLine(line);
    if (itemIndent === null) {
      if (parsed?.dash && parsed.key === idKey) itemIndent = parsed.indent;
      else if (indent.width === 0) break;
      else continue;
    }
    if (indent.width < itemIndent || (indent.width === itemIndent && !line.slice(itemIndent).startsWith("- "))) break;
    if (indent.width === itemIndent) {
      close(lastContent(lines, index));
      if (!(parsed?.dash && parsed.key === idKey)) continue;
      const id = scalar(parsed.rest);
      if (id.unsupported) return fail(index + 1, id.unsupported);
      current = { id: id.value, startLine: index + 1, endLine: index + 1, fieldIndent: itemIndent + 2, fields: { [idKey]: { line: index + 1, value: id.value } } };
      continue;
    }
    if (!current) continue;
    if (indent.width === current.fieldIndent && parsed && !parsed.dash && !current.fields[parsed.key]) {
      const result = scalar(parsed.rest);
      current.fields[parsed.key] = result.unsupported ? { line: index + 1, value: null, unsupported: result.unsupported } : { line: index + 1, value: result.value === "" ? null : result.value };
    }
  }
  close(lastContent(lines, index));
  return { ok: true, blocks };
}

function lastContent(lines, before) {
  for (let index = before - 1; index >= 0; index -= 1) if (!blank(lines[index])) return index + 1;
  return before;
}

function quoteLike(original, value) {
  const trimmed = original.trim();
  if (trimmed.startsWith("'")) return `'${String(value).replaceAll("'", "''")}'`;
  if (trimmed.startsWith('"')) return `"${String(value).replaceAll('"', '\\"')}"`;
  return String(value);
}

export function setBlockScalar(text, block, field, value) {
  const { lines, eol } = splitLines(text);
  const entry = block?.fields?.[field];
  if (!entry) return { ok: false, code: "FIELD_NOT_FOUND", field };
  if (entry.unsupported) return fail(entry.line, entry.unsupported);
  const before = lines[entry.line - 1];
  const match = before.match(new RegExp(`^(\\s*(?:- )?${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*)(.*)$`));
  if (!match) return fail(entry.line, "field line changed");
  const { value: old, comment } = splitComment(match[2]);
  const prefix = old ? match[1] : `${match[1].trimEnd()} `;
  const after = `${prefix}${quoteLike(old, value)}${comment}`;
  lines[entry.line - 1] = after;
  return { ok: true, text: lines.join(eol), edit: { line: entry.line, before, after } };
}

export function insertBlockScalar(text, block, field, value) {
  const { lines, eol } = splitLines(text);
  const after = `${" ".repeat(block.fieldIndent)}${field}: ${value}`;
  lines.splice(block.startLine, 0, after);
  return { ok: true, text: lines.join(eol), edit: { line: block.startLine + 1, before: null, after } };
}
