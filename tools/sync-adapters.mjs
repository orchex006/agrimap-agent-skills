#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  loadTaskArtifactSchema,
  renderTaskArtifactSchemaDocs,
  replaceTaskArtifactSchemaDocs,
  taskArtifactSchemaIssues,
} from "../skills/agrimap-agent-skills/scripts/task-artifact-schema.mjs";
import {
  operationConfigIssues,
  operationEntrypointPath,
  renderAliasSkill,
  renderGeminiCommandPrompt,
  renderOperationIndex,
  renderOperationAliasesModule,
  renderOperationEntrypoint,
} from "./operation-entrypoints.mjs";

const root = process.cwd();
const canonicalSkill = path.join(root, "skills", "agrimap-agent-skills");
const pluginRoot = path.join(root, "plugins", "agrimap-agent-skills");
const pluginSkills = path.join(pluginRoot, "skills");
const packageManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const packageVersion = packageManifest.version;
if (packageManifest.name !== 'agrimap-agent-skills') throw new Error('SYNC_WORKSPACE_MISMATCH');
async function removeGenerated(target) {
  const resolved = path.resolve(target);
  const relative = path.relative(path.resolve(root), resolved);
  const allowed = ['skills/agrimap-agent-skills/references/operations', 'plugins/agrimap-agent-skills/skills', 'plugins/agrimap-agent-skills/docs', 'plugins/agrimap-agent-skills/examples', 'plugins/agrimap-agent-skills/hooks', 'commands'];
  if (!relative || path.isAbsolute(relative) || !allowed.includes(relative.split(path.sep).join('/'))) throw new Error('UNSAFE_GENERATED_TARGET');
  await rm(resolved, { recursive: true, force: true });
}
if (typeof packageVersion !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(packageVersion)) {
  throw new Error("package.json version must be a valid semantic version.");
}
// Keep installed-contract tracking coupled to the package version at generation time.
const bootstrapRoot = path.join(canonicalSkill, 'assets/bootstrap');
const bootstrapManifestPath = path.join(bootstrapRoot, 'manifest.json');
const bootstrapManifest = JSON.parse(await readFile(bootstrapManifestPath, 'utf8'));
const bootstrapAgentsPath = path.join(bootstrapRoot, 'AGENTS.md');
const bootstrapAgents = await readFile(bootstrapAgentsPath, 'utf8');
if (!/<!-- AGRIMAP BOOTSTRAP VERSION: [^>]+ -->/.test(bootstrapAgents)) throw new Error('BOOTSTRAP_VERSION_MARKER_MISSING');
await writeFile(bootstrapAgentsPath, bootstrapAgents.replace(/<!-- AGRIMAP BOOTSTRAP VERSION: [^>]+ -->/, `<!-- AGRIMAP BOOTSTRAP VERSION: ${packageVersion} -->`).replaceAll('\r\n', '\n'), 'utf8');
for (const item of bootstrapManifest.files) {
  const nextHash = createHash('sha256').update(await readFile(path.join(bootstrapRoot, item.source))).digest('hex');
  if (bootstrapManifest.version !== packageVersion && item.sha256 !== nextHash) {
    item.previous ??= [];
    if (!item.previous.some(old => old.sha256 === item.sha256)) item.previous.push({version: bootstrapManifest.version, sha256: item.sha256});
  }
  item.sha256 = nextHash;
}
bootstrapManifest.version = packageVersion;
await writeFile(bootstrapManifestPath, JSON.stringify(bootstrapManifest, null, 2) + '\n', 'utf8');
const operations = JSON.parse(await readFile(path.join(root, "config", "operations.json"), "utf8"));
const operationIssues = operationConfigIssues(operations);
if (operationIssues.length) throw new Error(`Invalid operation config:\n- ${operationIssues.join("\n- ")}`);
const operationEntrypointsDirectory = path.join(canonicalSkill, "references", "operations");
await removeGenerated(operationEntrypointsDirectory);
await mkdir(operationEntrypointsDirectory, { recursive: true });
for (const item of operations.operations) {
  await writeFile(operationEntrypointPath(canonicalSkill, item), renderOperationEntrypoint(item), "utf8");
}
await writeFile(
  path.join(canonicalSkill, "references", "operation-index.md"),
  renderOperationIndex(operations),
  "utf8",
);
await writeFile(
  path.join(canonicalSkill, "scripts", "operation-aliases.mjs"),
  renderOperationAliasesModule(operations),
  "utf8",
);
const taskArtifactSchema = await loadTaskArtifactSchema(canonicalSkill);
const schemaIssues = taskArtifactSchemaIssues(taskArtifactSchema);
if (schemaIssues.length) throw new Error(`Invalid task artifact schema:\n- ${schemaIssues.join("\n- ")}`);
const generatedTaskArtifactDocs = renderTaskArtifactSchemaDocs(taskArtifactSchema);
for (const relativePath of ["README.md", path.join("docs", "USAGE.md")]) {
  const filePath = path.join(root, relativePath);
  const content = await readFile(filePath, "utf8");
  await writeFile(filePath, replaceTaskArtifactSchemaDocs(content, generatedTaskArtifactDocs), "utf8");
}

await removeGenerated(pluginSkills);
await mkdir(pluginSkills, { recursive: true });
await cp(canonicalSkill, path.join(pluginSkills, "agrimap-agent-skills"), { recursive: true });
for (const file of ['README.md', 'CHANGELOG.md']) await cp(path.join(root, file), path.join(pluginRoot, file));
for (const directory of ["docs", "examples"]) {
  await removeGenerated(path.join(pluginRoot, directory));
  await cp(path.join(root, directory), path.join(pluginRoot, directory), { recursive: true });
}

for (const item of operations.operations) {
  const aliasDirectory = path.join(pluginSkills, item.name);
  await mkdir(aliasDirectory, { recursive: true });
  await writeFile(
    path.join(aliasDirectory, "SKILL.md"),
    renderAliasSkill(item),
    "utf8",
  );
}

const codexManifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
const codexManifest = JSON.parse(await readFile(codexManifestPath, "utf8"));
codexManifest.version = packageVersion;
codexManifest.hooks = "./hooks/codex-hooks.json";
await writeFile(codexManifestPath, `${JSON.stringify(codexManifest, null, 2)}\n`, "utf8");

const claudeMarketplacePath = path.join(root, ".claude-plugin", "marketplace.json");
const claudeMarketplace = JSON.parse(await readFile(claudeMarketplacePath, "utf8"));
const claudeMarketplaceEntry = claudeMarketplace.plugins?.find((plugin) => plugin.name === packageManifest.name);
if (!claudeMarketplaceEntry) throw new Error(`Claude marketplace entry not found for ${packageManifest.name}.`);
claudeMarketplaceEntry.version = packageVersion;
await writeFile(claudeMarketplacePath, `${JSON.stringify(claudeMarketplace, null, 2)}\n`, "utf8");

const claudeManifestDirectory = path.join(pluginRoot, ".claude-plugin");
await mkdir(claudeManifestDirectory, { recursive: true });
await writeFile(
  path.join(claudeManifestDirectory, "plugin.json"),
  `${JSON.stringify({
    name: "agrimap-agent-skills",
    description: "Routing skill plus dedicated one-operation AgriMap engineering skills",
    version: packageVersion,
    author: { name: "Billy" },
    hooks: "./hooks/claude-hooks.json",
  }, null, 2)}\n`,
  "utf8",
);

function providerHooks(provider, pluginRootToken) {
  const script = `node \"${pluginRootToken}/skills/agrimap-agent-skills/scripts/hook-context.mjs\"`;
  return {
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: "command",
              command: `${script} --provider ${provider} --mode session`,
              statusMessage: "Loading AgriMap task memory",
            },
          ],
        },
      ],
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `${script} --provider ${provider} --mode task`,
              statusMessage: "Refreshing AgriMap task context",
            },
          ],
        },
      ],
      SubagentStart: [
        {
          hooks: [
            {
              type: "command",
              command: `${script} --provider ${provider} --mode subagent`,
              statusMessage: "Loading AgriMap handoff contract",
            },
          ],
        },
      ],
    },
  };
}

const hooksDirectory = path.join(pluginRoot, "hooks");
// This directory is shared by the Codex and Claude packages. Never generate
// hooks/hooks.json here: both hosts auto-discover that default path, which can
// cross-load the other host's provider flag. Their manifests select only the
// provider-specific files below. Gemini uses the repository-root extension
// hooks/hooks.json and is therefore outside this plugin root.
await removeGenerated(hooksDirectory);
await mkdir(hooksDirectory, { recursive: true });
await writeFile(
  path.join(hooksDirectory, "codex-hooks.json"),
  `${JSON.stringify(providerHooks("codex", "${PLUGIN_ROOT}"), null, 2)}\n`,
  "utf8",
);
await writeFile(
  path.join(hooksDirectory, "claude-hooks.json"),
  `${JSON.stringify(providerHooks("claude", "${CLAUDE_PLUGIN_ROOT}"), null, 2)}\n`,
  "utf8",
);

await removeGenerated(path.join(root, "commands"));
await mkdir(path.join(root, "commands"), { recursive: true });
for (const item of operations.operations) {
  const prompt = renderGeminiCommandPrompt(item);
  await writeFile(
    path.join(root, "commands", `${item.name}.toml`),
    `description = ${JSON.stringify(item.description)}\nprompt = ${JSON.stringify(prompt)}\n`,
    "utf8",
  );
}

const geminiHooks = {
  hooks: {
    SessionStart: [
      {
        hooks: [
          {
            type: "command",
            name: "agm-session-context",
            command: "node \"${extensionPath}${/}skills${/}agrimap-agent-skills${/}scripts${/}hook-context.mjs\" --provider gemini --mode session",
            description: "Load requester and current AgriMap memory without blocking the session",
          },
        ],
      },
    ],
    BeforeAgent: [
      {
        hooks: [
          {
            type: "command",
            name: "agm-task-context",
            command: "node \"${extensionPath}${/}skills${/}agrimap-agent-skills${/}scripts${/}hook-context.mjs\" --provider gemini --mode task",
            description: "Refresh AgriMap task context before agent planning",
          },
        ],
      },
    ],
  },
};
await mkdir(path.join(root, "hooks"), { recursive: true });
await writeFile(path.join(root, "hooks", "hooks.json"), `${JSON.stringify(geminiHooks, null, 2)}\n`, "utf8");

await writeFile(
  path.join(root, "gemini-extension.json"),
  `${JSON.stringify({
    name: "agrimap-agent-skills",
    version: packageVersion,
    description: "Routing skill plus dedicated one-operation AgriMap engineering skills",
    // Gemini file tools are sandboxed to the workspace, so a globally installed
    // extension's bundled references are unreachable by the model. This stdio MCP
    // server (launched from the resolved ${extensionPath}) serves them on demand.
    // The server name must not contain "_": Gemini exposes tools as
    // mcp_{serverName}_{toolName} and splits on the first "_" after "mcp_".
    mcpServers: {
      agrimap: {
        command: "node",
        args: ["${extensionPath}${/}skills${/}agrimap-agent-skills${/}scripts${/}mcp-server.mjs"],
        cwd: "${extensionPath}",
      },
    },
  }, null, 2)}\n`,
  "utf8",
);

process.stdout.write(
  `${JSON.stringify({ ok: true, version: packageVersion, aliases: operations.operations.length, canonicalSkill, pluginRoot }, null, 2)}\n`,
);
