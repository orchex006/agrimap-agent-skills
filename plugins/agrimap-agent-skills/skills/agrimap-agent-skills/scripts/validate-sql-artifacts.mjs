#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./cli-args.mjs";

function normalizeRelative(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function insideRoot(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

function maskCommentsAndStrings(sql) {
  const output = [];
  const bracketIdentifiers = [];
  let state = "code";
  let blockDepth = 0;

  const masked = (value) => value === "\r" || value === "\n" ? value : " ";

  for (let index = 0; index < sql.length; index += 1) {
    const current = sql[index];
    const next = sql[index + 1];

    if (state === "line-comment") {
      output.push(masked(current));
      if (current === "\r" || current === "\n") state = "code";
      continue;
    }

    if (state === "block-comment") {
      if (current === "/" && next === "*") {
        output.push(" ", " ");
        blockDepth += 1;
        index += 1;
      } else if (current === "*" && next === "/") {
        output.push(" ", " ");
        blockDepth -= 1;
        index += 1;
        if (blockDepth === 0) state = "code";
      } else {
        output.push(masked(current));
      }
      continue;
    }

    if (state === "single-quote") {
      output.push(masked(current));
      if (current === "'" && next === "'") {
        output.push(" ");
        index += 1;
      } else if (current === "'") {
        state = "code";
      }
      continue;
    }

    if (state === "double-quote") {
      output.push(masked(current));
      if (current === '"' && next === '"') {
        output.push(" ");
        index += 1;
      } else if (current === '"') {
        state = "code";
      }
      continue;
    }

    if (current === "[") {
      let cursor = index + 1;
      let identifier = "";
      let closed = false;
      while (cursor < sql.length) {
        if (sql[cursor] === "]" && sql[cursor + 1] === "]") {
          identifier += "]";
          cursor += 2;
        } else if (sql[cursor] === "]") {
          closed = true;
          cursor += 1;
          break;
        } else {
          identifier += sql[cursor];
          cursor += 1;
        }
      }

      if (!closed) {
        for (let remainder = index; remainder < sql.length; remainder += 1) {
          output.push(masked(sql[remainder]));
        }
        return { source: output.join(""), bracketIdentifiers };
      }

      const placeholder = `__AGM_BRACKET_${bracketIdentifiers.length}__`;
      bracketIdentifiers.push(identifier);
      output.push(`[${placeholder}]`);
      index = cursor - 1;
      continue;
    }

    if (current === "-") {
      if (next === "-") {
        output.push(" ", " ");
        state = "line-comment";
        index += 1;
      } else {
        output.push(current);
      }
    } else if (current === "/" && next === "*") {
      output.push(" ", " ");
      state = "block-comment";
      blockDepth = 1;
      index += 1;
    } else if (current === "'") {
      output.push("_");
      state = "single-quote";
    } else if (current === '"') {
      output.push("_");
      state = "double-quote";
    } else {
      output.push(current);
    }
  }

  return { source: output.join(""), bracketIdentifiers };
}

function extractObjectDefinitions(sql, kind) {
  const { source, bracketIdentifiers } = maskCommentsAndStrings(sql);
  const decodeBracketIdentifier = (value) => {
    const match = String(value || "").match(/^__AGM_BRACKET_(\d+)__$/);
    return match ? bracketIdentifiers[Number(match[1])] : value;
  };
  const prefix = kind === "table"
    ? String.raw`\b(?<declaration>CREATE)\s+(?<keyword>TABLE)\b`
    : String.raw`\b(?<declaration>CREATE\s+OR\s+ALTER|CREATE|ALTER)\s+(?<keyword>PROCEDURE|PROC)\b`;
  const pattern = new RegExp(
    `${prefix}\\s+(?:(?:\\[(?<bracketSchema>[^\\]]+)\\]|(?<plainSchema>[A-Z_][A-Z0-9_]*))\\s*\\.\\s*)?(?:\\[(?<bracketName>[^\\]]+)\\]|(?<plainName>[A-Z_][A-Z0-9_]*))`,
    "gi",
  );
  return [...source.matchAll(pattern)].map((match) => {
    const schema = decodeBracketIdentifier(match.groups?.bracketSchema) || match.groups?.plainSchema;
    const name = decodeBracketIdentifier(match.groups?.bracketName) || match.groups?.plainName;
    return {
      declaration: String(match.groups?.declaration || "").replace(/\s+/g, " ").toUpperCase(),
      keyword: String(match.groups?.keyword || "").toUpperCase(),
      schema: schema ? String(schema).toUpperCase() : null,
      name: String(name || "").toUpperCase(),
    };
  });
}

function extractObjectNames(sql, kind) {
  return extractObjectDefinitions(sql, kind).map((definition) => definition.name);
}

function columnDeclaration(sql, columnName) {
  const escaped = columnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\[${escaped}\\]\\s+\\[?([A-Z0-9_]+)\\]?\\s*(?:\\(\\s*(\\d+)\\s*(?:,\\s*(\\d+)\\s*)?\\))?`,
    "i",
  );
  const match = stripComments(sql).match(pattern);
  return match
    ? { type: match[1].toUpperCase(), precision: match[2] || null, scale: match[3] || null }
    : null;
}

function primaryKeyColumn(sql) {
  const match = stripComments(sql).match(/PRIMARY\s+KEY[\s\S]*?\(\s*\[([^\]]+)\]/i);
  return match?.[1] || null;
}

function hasColumnShape(sql, pattern) {
  return pattern.test(stripComments(sql));
}

function validateTable(sql, objectName, file, issues) {
  if (objectName === "LUT_APP_MESSAGES") {
    issues.push({ file, code: "MESSAGE_REGISTRY_CREATION_FORBIDDEN", message: "features write guarded rows to messages.sql; they do not recreate LUT_APP_MESSAGES" });
    return;
  }

  const keyName = primaryKeyColumn(sql) || (columnDeclaration(sql, "ID") ? "ID" : null);
  const key = keyName ? columnDeclaration(sql, keyName) : null;
  if (!keyName || !key) {
    issues.push({ file, code: "PRIMARY_KEY_TYPE_UNPROVEN", message: "table must declare [ID] or a parseable primary-key column" });
  } else if (objectName.startsWith("LUT_")) {
    if (key.type !== "INT") {
      issues.push({ file, code: "LOOKUP_KEY_TYPE_INVALID", message: `lookup primary key [${keyName}] must be INT` });
    }
    const name = columnDeclaration(sql, "NAME");
    if (!name || name.type !== "NVARCHAR" || name.precision !== "255") {
      issues.push({ file, code: "LOOKUP_NAME_INVALID", message: "lookup table must declare [NAME] NVARCHAR(255)" });
    }
  } else if (key.type !== "NUMERIC" || key.precision !== "38" || key.scale !== "0") {
    issues.push({ file, code: "GENERAL_KEY_TYPE_INVALID", message: `general-table primary key [${keyName}] must be NUMERIC(38, 0)` });
  }

  const required = [
    ["DATE_CREATED_INVALID", /\[DATE_CREATED\]\s+\[?DATETIME2\]?\s*\(\s*7\s*\)\s+NOT\s+NULL/i, "[DATE_CREATED] DATETIME2(7) NOT NULL"],
    ["DATE_MODIFIED_INVALID", /\[DATE_MODIFIED\]\s+\[?DATETIME2\]?\s*\(\s*7\s*\)\s+NULL/i, "[DATE_MODIFIED] DATETIME2(7) NULL"],
    ["USER_CREATED_INVALID", /\[USER_CREATED\]\s+\[?NUMERIC\]?\s*\(\s*38\s*,\s*0\s*\)\s+NOT\s+NULL/i, "[USER_CREATED] NUMERIC(38, 0) NOT NULL"],
    ["USER_MODIFIED_INVALID", /\[USER_MODIFIED\]\s+\[?NUMERIC\]?\s*\(\s*38\s*,\s*0\s*\)\s+NULL/i, "[USER_MODIFIED] NUMERIC(38, 0) NULL"],
    ["DEL_FLAG_INVALID", /\[DEL_FLAG\]\s+\[?BIT\]?\s+NOT\s+NULL/i, "[DEL_FLAG] BIT NOT NULL"],
  ];
  for (const [code, pattern, expected] of required) {
    if (!hasColumnShape(sql, pattern)) issues.push({ file, code, message: `table must declare ${expected}` });
  }
}

function procedureSuffix(name) {
  for (const suffix of ["_CHECK_Q", "_I", "_U", "_D", "_Q"]) {
    if (name.endsWith(suffix)) return suffix;
  }
  return null;
}

function maskCommentsPreserveLayout(sql) {
  const mask = (value) => value.replace(/[^\r\n]/g, " ");
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, mask)
    .replace(/--[^\r\n]*/g, mask);
}

function procedureSections(sql) {
  const pattern = /^[ \t]*--[ \t]*={20,}[ \t]*\r?\n[ \t]*--[ \t]*([^\r\n]*\S)[ \t]*\r?\n[ \t]*--[ \t]*={20,}[ \t]*$/gm;
  return [...sql.matchAll(pattern)].map((match) => ({
    label: match[1].trim(),
    index: match.index,
    end: match.index + match[0].length,
  }));
}

function nearestSection(sections, index) {
  let nearest = null;
  for (const section of sections) {
    if (section.end > index) break;
    nearest = section;
  }
  return nearest;
}

function lineNumberAt(sql, index) {
  return sql.slice(0, index).split(/\r?\n/).length;
}

function validateUserParameterTypes(sql, file, issues) {
  const source = stripComments(sql);
  const bodyIndex = source.search(/\bAS\s+BEGIN\b/i);
  const header = bodyIndex >= 0 ? source.slice(0, bodyIndex) : source;
  for (const [parameter, issueCode] of [
    ["SESSION_USER_ID", "SESSION_USER_ID_TYPE_INVALID"],
    ["USER_ID", "USER_ID_TYPE_INVALID"],
  ]) {
    const pattern = new RegExp(`@(?:PI_)?${parameter}\\s+\\[?([A-Z][A-Z0-9_]*)\\]?\\s*(?:\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\))?`, "gi");
    for (const match of header.matchAll(pattern)) {
      const valid = match[1].toUpperCase() === "NUMERIC" && match[2] === "38" && match[3] === "0";
      if (!valid) issues.push({ file, code: issueCode, message: `@${match[0].split(/\s+/)[0].slice(1)} must be NUMERIC(38, 0)` });
    }
  }
}

function validateProcedureComments(sql, file, issues) {
  const sections = procedureSections(sql);
  const code = maskCommentsPreserveLayout(sql);
  const stepSections = sections
    .map((section) => ({ ...section, step: section.label.match(/^Step\s+(\d+)\s*:\s*(\S(?:.*\S)?)$/i) }))
    .filter((section) => section.step);

  if (!stepSections.length) {
    issues.push({ file, code: "PROCEDURE_STEP_COMMENT_REQUIRED", message: "procedure must include Step 1: <specific business intent> in a canonical three-line section comment" });
  } else {
    const invalidSequence = stepSections.some((section, index) => Number(section.step[1]) !== index + 1);
    const vagueDescription = stepSections.some((section) => /^(?:insert|update|delete|select|process|logic|data|work|step)$/i.test(section.step[2].trim()));
    if (invalidSequence || vagueDescription) {
      issues.push({ file, code: "PROCEDURE_STEP_SEQUENCE_INVALID", message: "procedure steps must start at 1, increase without gaps, and name a specific business intent" });
    }
  }

  for (const match of code.matchAll(/\bTHROW\s+\d+\s*,/gi)) {
    const section = nearestSection(sections, match.index);
    const detail = section?.label.match(/^Validate\s+(.+)$/i)?.[1]?.trim() || "";
    if (!detail || /^(?:data|input|value|condition|rule|check)$/i.test(detail)) {
      issues.push({
        file,
        code: "VALIDATION_COMMENT_GATE_MISSING",
        message: `numbered THROW at line ${lineNumberAt(sql, match.index)} must belong to a specific Validate ... section`,
      });
    }
  }

  const transactionGates = [
    ["BEGIN_TRANSACTION_COMMENT_GATE_MISSING", /\bBEGIN\s+TRANSACTION\b/gi, "Begin Transaction"],
    ["COMMIT_TRANSACTION_COMMENT_GATE_MISSING", /\bCOMMIT\s+TRANSACTION\b/gi, "Commit Transaction"],
    ["ROLLBACK_TRANSACTION_COMMENT_GATE_MISSING", /\bROLLBACK\s+TRANSACTION\b/gi, "Rollback Transaction"],
  ];
  for (const [issueCode, pattern, label] of transactionGates) {
    for (const match of code.matchAll(pattern)) {
      const section = nearestSection(sections, match.index);
      if (section?.label.toLowerCase() !== label.toLowerCase()) {
        issues.push({ file, code: issueCode, message: `${label} at line ${lineNumberAt(sql, match.index)} requires its matching canonical section comment` });
      }
    }
  }

  const outputAssignments = [...code.matchAll(/^[ \t]*(?:SET|SELECT)\s+(@PO_[A-Z0-9_]+)\s*=/gim)];
  for (const outputName of new Set(outputAssignments.map((match) => match[1].toUpperCase()))) {
    const hasReturnGate = outputAssignments
      .filter((match) => match[1].toUpperCase() === outputName)
      .some((match) => {
        const label = nearestSection(sections, match.index)?.label || "";
        return /^Return\s+/i.test(label) && label.toUpperCase().includes(outputName.slice(1));
      });
    if (!hasReturnGate) {
      issues.push({ file, code: "RETURN_OUTPUT_COMMENT_GATE_MISSING", message: `${outputName} assignment requires a Return ${outputName.slice(1)} section comment` });
    }
  }
}

function previousBatch(sql, index) {
  const prefix = sql.slice(0, index);
  const matches = [...prefix.matchAll(/^\s*GO\s*$/gim)];
  const start = matches.length ? matches.at(-1).index + matches.at(-1)[0].length : Math.max(0, index - 2500);
  return sql.slice(start, index);
}

function validateMessages(sql, file, issues) {
  if (extractObjectNames(sql, "table").length || extractObjectNames(sql, "procedure").length) {
    issues.push({ file, code: "MESSAGE_FILE_OBJECT_FORBIDDEN", message: "messages.sql may contain guarded LUT_APP_MESSAGES inserts only" });
  }

  const insertPattern = /INSERT\s+INTO\s+\[agrimap_app\]\s*\.\s*\[LUT_APP_MESSAGES\]\s*\(\s*\[ID\]\s*,\s*\[DESCR\]\s*\)\s*VALUES\s*\(\s*(?:N)?'((?:''|[^'])*)'\s*,/gi;
  const inserts = [...stripComments(sql).matchAll(insertPattern)];
  if (!inserts.length) {
    issues.push({ file, code: "MESSAGE_INSERT_REQUIRED", message: "messages.sql must contain at least one LUT_APP_MESSAGES (ID, DESCR) insert" });
    return;
  }

  const seen = new Set();
  for (const insert of inserts) {
    const id = insert[1].replace(/''/g, "'");
    if (seen.has(id)) issues.push({ file, code: "MESSAGE_ID_DUPLICATE", message: `message ID is inserted more than once: ${id}` });
    seen.add(id);

    const batch = previousBatch(stripComments(sql), insert.index);
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "''");
    const guard = new RegExp(
      `IF\\s+NOT\\s+EXISTS[\\s\\S]*?FROM\\s+\\[agrimap_app\\]\\s*\\.\\s*\\[LUT_APP_MESSAGES\\][\\s\\S]*?WHERE\\s+\\[ID\\]\\s*=\\s*(?:N)?'${escaped}'`,
      "i",
    );
    if (!guard.test(batch)) {
      issues.push({ file, code: "MESSAGE_GUARD_MISSING", message: `message ID ${id} must have a preceding IF NOT EXISTS guard on the same ID` });
    }
  }
}

export async function validateSqlArtifacts({ cwd = process.cwd(), files = [] } = {}) {
  const root = path.resolve(cwd);
  const requested = Array.isArray(files) ? files : String(files).split(",");
  const normalizedFiles = requested.map((value) => String(value).trim()).filter(Boolean);
  const issues = [];
  const results = [];

  if (!normalizedFiles.length) {
    return { ok: false, files: [], issues: [{ file: null, code: "FILES_REQUIRED", message: "pass created SQL paths with --files" }] };
  }

  for (const inputFile of normalizedFiles) {
    const absolute = path.resolve(root, inputFile);
    const relative = normalizeRelative(path.relative(root, absolute));
    if (!insideRoot(root, absolute)) {
      issues.push({ file: inputFile, code: "PATH_OUTSIDE_ROOT", message: "SQL artifact path escapes --cwd" });
      continue;
    }

    let sql;
    try {
      sql = await readFile(absolute, "utf8");
    } catch (error) {
      issues.push({ file: relative, code: "FILE_UNREADABLE", message: error.message });
      continue;
    }

    const messageMatch = relative.match(/^sql\/([A-Z][A-Z0-9_]*)\/messages\.sql$/);
    const objectMatch = relative.match(/^sql\/([A-Z][A-Z0-9_]*)\/(table|procedure)\/([A-Z][A-Z0-9_]*)\.sql$/);
    if (!messageMatch && !objectMatch) {
      issues.push({ file: relative, code: "PATH_CONTRACT_INVALID", message: "expected sql/<GROUP_OR_DOMAIN>/table/<TABLE>.sql, procedure/<PROCEDURE>.sql, or messages.sql" });
      continue;
    }

    if (messageMatch) {
      validateMessages(sql, relative, issues);
      results.push({ file: relative, domain: messageMatch[1], kind: "messages" });
      continue;
    }

    const [, domain, kind, fileStem] = objectMatch;
    const tableDefinitions = extractObjectDefinitions(sql, "table");
    const procedureDefinitions = extractObjectDefinitions(sql, "procedure");
    const tables = tableDefinitions.map((definition) => definition.name);
    const procedures = procedureDefinitions.map((definition) => definition.name);
    for (const definition of [...tableDefinitions, ...procedureDefinitions]) {
      if (definition.schema !== "AGRIMAP_APP") {
        issues.push({
          file: relative,
          code: "OBJECT_SCHEMA_INVALID",
          message: `${definition.name} must be declared in [agrimap_app], not ${definition.schema ? `[${definition.schema}]` : "an unqualified schema"}`,
        });
      }
    }
    if (kind === "table") {
      if (tables.length !== 1) issues.push({ file: relative, code: "TABLE_OBJECT_COUNT_INVALID", message: `expected exactly one CREATE TABLE; found ${tables.length}` });
      if (procedures.length) issues.push({ file: relative, code: "TABLE_FILE_PROCEDURE_FORBIDDEN", message: "table file must not define a procedure" });
      if (tables.length === 1 && tables[0] !== fileStem) issues.push({ file: relative, code: "TABLE_FILENAME_MISMATCH", message: `filename ${fileStem}.sql must match table ${tables[0]}` });
      if (tables.length === 1) validateTable(sql, tables[0], relative, issues);
      results.push({ file: relative, domain, kind, object: tables[0] || null });
    } else {
      if (procedures.length !== 1) issues.push({ file: relative, code: "PROCEDURE_OBJECT_COUNT_INVALID", message: `expected exactly one procedure definition; found ${procedures.length}` });
      if (tables.length) issues.push({ file: relative, code: "PROCEDURE_FILE_TABLE_FORBIDDEN", message: "procedure file must not define a table" });
      if (
        procedureDefinitions.length !== 1
        || procedureDefinitions[0].declaration !== "CREATE OR ALTER"
        || procedureDefinitions[0].keyword !== "PROCEDURE"
      ) {
        issues.push({
          file: relative,
          code: "PROCEDURE_DECLARATION_INVALID",
          message: "created or edited procedures must use CREATE OR ALTER PROCEDURE; standalone CREATE/ALTER or PROC declarations are forbidden",
        });
      }
      if (procedures.length === 1 && procedures[0] !== fileStem) issues.push({ file: relative, code: "PROCEDURE_FILENAME_MISMATCH", message: `filename ${fileStem}.sql must match procedure ${procedures[0]}` });
      if (!procedureSuffix(fileStem)) issues.push({ file: relative, code: "PROCEDURE_SUFFIX_INVALID", message: "procedure must end with _I, _U, _D, _Q, or _CHECK_Q" });
      if (procedures.length === 1) {
        validateUserParameterTypes(sql, relative, issues);
        validateProcedureComments(sql, relative, issues);
      }
      results.push({ file: relative, domain, kind, object: procedures[0] || null });
    }
  }

  return { ok: issues.length === 0, files: results, issues };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const files = String(args.files || "").split(",").map((value) => value.trim()).filter(Boolean);
  const result = await validateSqlArtifacts({ cwd: args.cwd || process.cwd(), files });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
