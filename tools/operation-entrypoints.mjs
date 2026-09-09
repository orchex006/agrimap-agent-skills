import path from "node:path";

export function operationEntrypointFile(item) {
  return `${item.operation}.md`;
}

export function renderOperationIndex(config) {
  const publicOperations = config.operations.filter((item) => item.visibility !== "compatibility");
  return [
    "# AgriMap operation routing index",
    "",
    "<!-- Generated from config/operations.json. Do not edit directly. -->",
    "",
    "Use this file only to select one dedicated `agm-*` skill. It is not an execution contract.",
    "",
    "| Dedicated skill | Operation | Purpose | Mode | Workflow depth |",
    "| --- | --- | --- | --- | --- |",
    ...publicOperations.map((item) => `| \`${item.name}\` | \`${item.operation}\` | ${item.description} | \`${item.mode}\` | default \`${item.depth.default}\`; allowed ${item.depth.allowed.map((depth) => `\`${depth}\``).join(", ")} |`),
    "",
    "After selecting one row, hand off to that skill and stop the router. Never combine multiple operation skills implicitly.",
    "",
  ].join("\n");
}

export function renderOperationAliasesModule(config) {
  const aliases = config.operations.map((item) => item.name);
  const publicAliases = config.operations.filter((item) => item.visibility !== "compatibility").map((item) => item.name);
  const compatibilityAliases = config.operations.filter((item) => item.visibility === "compatibility").map((item) => item.name);
  return [
    "// Generated from config/operations.json. Do not edit directly.",
    "",
    `export const AGRIMAP_ROUTER_ALIAS = ${JSON.stringify("agrimap-agent-skills")};`,
    `export const AGRIMAP_OPERATION_ALIASES = Object.freeze(${JSON.stringify(aliases, null, 2)});`,
    `export const AGRIMAP_PUBLIC_OPERATION_ALIASES = Object.freeze(${JSON.stringify(publicAliases, null, 2)});`,
    `export const AGRIMAP_COMPATIBILITY_ALIASES = Object.freeze(${JSON.stringify(compatibilityAliases, null, 2)});`,
    "",
  ].join("\n");
}

export function operationConfigIssues(config) {
  const issues = [];
  if (config?.schemaVersion !== 3) issues.push("schemaVersion must be 3");
  if (!Array.isArray(config?.operations) || config.operations.length === 0) return [...issues, "operations must be a non-empty array"];
  const names = new Set();
  const operations = new Set();
  for (const item of config.operations) {
    for (const field of ["name", "operation", "description", "mode", "deliverable", "example"]) {
      if (!String(item?.[field] || "").trim()) issues.push(`${item?.name || "unknown"}: ${field} is required`);
    }
    if (item.entrypointPolicy !== undefined && (typeof item.entrypointPolicy !== "string" || !item.entrypointPolicy.trim())) issues.push(`${item.name}: entrypointPolicy must be a non-empty string`);
    if (names.has(item.name)) issues.push(`duplicate alias: ${item.name}`);
    if (operations.has(item.operation)) issues.push(`duplicate operation: ${item.operation}`);
    names.add(item.name);
    operations.add(item.operation);
    if (item.visibility && item.visibility !== "compatibility") issues.push(`${item.name}: visibility may only be compatibility when present`);
    if (item.visibility === "compatibility" && !String(item.replacedBy || "").trim()) issues.push(`${item.name}: compatibility aliases require replacedBy`);
    const allowedDepths = item?.depth?.allowed;
    if (!["light", "standard", "regulated"].includes(item?.depth?.default)) issues.push(`${item.name}: depth.default must be light|standard|regulated`);
    if (!Array.isArray(allowedDepths) || allowedDepths.length === 0 || allowedDepths.some((depth) => !["light", "standard", "regulated"].includes(depth))) {
      issues.push(`${item.name}: depth.allowed must contain only light|standard|regulated`);
    } else if (!allowedDepths.includes(item.depth.default)) {
      issues.push(`${item.name}: depth.allowed must include depth.default`);
    }
    for (const field of ["requiredInputs", "conditionalInputs", "instructions", "references"]) {
      if (!Array.isArray(item?.[field]) || item[field].length === 0) issues.push(`${item.name}: ${field} must be non-empty`);
    }
    if (item.mode === "action-routed") {
      if (!Array.isArray(item.actions) || item.actions.length < 2) {
        issues.push(`${item.name}: action-routed operations require at least two actions`);
      } else {
        const actionNames = new Set();
        for (const action of item.actions) {
          if (!String(action?.name || "").trim()) issues.push(`${item.name}: every action requires a name`);
          if (actionNames.has(action.name)) issues.push(`${item.name}: duplicate action ${action.name}`);
          actionNames.add(action.name);
          if (!["product-read-only", "product-write"].includes(action?.mode)) issues.push(`${item.name}/${action.name}: invalid action mode`);
          if (!["explicit", "explicit-or-safe-default"].includes(action?.activation)) issues.push(`${item.name}/${action.name}: invalid activation`);
          if (!Array.isArray(action?.depths) || action.depths.length === 0 || action.depths.some((depth) => !item.depth.allowed.includes(depth))) {
            issues.push(`${item.name}/${action.name}: depths must be a non-empty subset of operation depths`);
          }
          if (!String(action?.purpose || "").trim()) issues.push(`${item.name}/${action.name}: purpose is required`);
          if (action.activation === "explicit-or-safe-default" && action.mode !== "product-read-only") issues.push(`${item.name}/${action.name}: safe-default activation must be product-read-only`);
        }
      }
    } else if (item.actions) {
      issues.push(`${item.name}: actions are valid only for action-routed operations`);
    }
    for (const reference of [...(item.references || []), ...(item.conditionalReferences || [])]) {
      if (!reference?.path || !reference?.why) issues.push(`${item.name}: every reference needs path and why`);
    }
  }
  return issues;
}

function referenceLink(reference) {
  const [file, anchor] = String(reference.path).split("#", 2);
  const target = `../${file}${anchor ? `#${anchor}` : ""}`;
  return `[${file}](${target}) — ${reference.why}`;
}

export function renderOperationEntrypoint(item) {
  const conditional = (item.conditionalReferences || []).length
    ? item.conditionalReferences.map((reference) => `- When ${reference.when}: ${referenceLink(reference)}`)
    : ["- No additional conditional reference by default; select one target pattern only when lifecycle-core routing requires it."];
  const actionContract = item.mode === "action-routed"
    ? [
        "## Action gate",
        "",
        "Resolve exactly one action before target inspection or product writes. Safe defaults are read-only; fallback is action routing, not a passive capability. Capabilities support the chosen read or authorized write but cannot choose it or create write intent.",
        "",
        "| Action | Mode | Activation | Allowed depth | Purpose |",
        "| --- | --- | --- | --- | --- |",
        ...item.actions.map((action) => `| \`${action.name}\` | \`${action.mode}\` | \`${action.activation}\` | ${action.depths.map((depth) => `\`${depth}\``).join(", ")} | ${action.purpose} |`),
        "",
      ]
    : [];
  const compatibility = item.visibility === "compatibility"
    ? [`- Compatibility: deprecated; use ${item.replacedBy}. Preserve this operation name only for existing prompts, audit, and automation.`, ""]
    : [];
  return [
    `# Compact operation entrypoint: ${item.name}`,
    "",
    "<!-- Generated from config/operations.json. Do not edit directly. -->",
    "",
    `- Operation: \`${item.operation}\``,
    `- Workflow depth: default \`${item.depth.default}\`; allowed ${item.depth.allowed.map((depth) => `\`${depth}\``).join(", ")}`,
    `- Mode: \`${item.mode}\``,
    `- Purpose: ${item.description}.`,
    `- Deliverable: ${item.deliverable}`,
    ...compatibility,
    "",
    ...(item.entrypointPolicy ? [item.entrypointPolicy, ""] : []),
    ...actionContract,
    "## Inputs and help",
    "",
    `- Required: ${item.requiredInputs.join("; ")}.`,
    `- Conditional: ${item.conditionalInputs.join("; ")}.`,
    `- Minimal example: \`${item.example}\``,
    "",
    "## Execute this contract",
    "",
    ...item.instructions.map((instruction, index) => `${index + 1}. ${instruction}`),
    "",
    "## Load now",
    "",
    ...item.references.map((reference) => `- ${referenceLink(reference)}`),
    "",
    "## Load only when the condition matches",
    "",
    ...conditional,
    "",
    "Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.",
    "",
  ].join("\n");
}

export function renderAliasSkill(item) {
  return `---\nname: ${item.name}\ndescription: ${item.description}. Apply only to a relevant AgriMap target or explicit current invocation, never unrelated conversation or quoted examples.\n---\n\nResolve current intent and target relevance before any identity or lifecycle. Ordinary questions create no execution or task artifacts. Run only ${item.operation}.\n${item.entrypointPolicy ? `\n${item.entrypointPolicy}\n\n` : ""}Read ../agrimap-agent-skills/references/lifecycle-core.md and ../agrimap-agent-skills/references/operations/${item.operation}.md, then only the required and matching conditional references. Respect host/user authority and the selected action. Missing required contracts: PACKAGE_ENTRYPOINT_MISSING.\n`;
}
export function renderGeminiCommandPrompt(item) {
  return [
    `AGRIMAP_EXPLICIT_ALIAS=${item.name}`,
    `Run AgriMap ${item.operation} only for the current requested intent; quoted examples are not actions.`,
    'Use read_reference for bundled references: lifecycle-core.md and operations/' + item.operation + '.md, then required and matching conditional references only. Do not recursively follow background/example links.',
    'Ordinary questions create no lifecycle or identity question. Host instructions and explicit requester scope are authoritative. Supporting SQL context is metadata/SELECT only; no database writes.',
    ...(item.entrypointPolicy ? [item.entrypointPolicy] : []),
    'Requester arguments:', '{{args}}'
  ].join('\n\n');
}

export function operationEntrypointPath(skillRoot, item) {
  return path.join(skillRoot, "references", "operations", operationEntrypointFile(item));
}
