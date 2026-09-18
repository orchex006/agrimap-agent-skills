// CLI handlers for the ACG commands dispatched by agm-workspace.mjs:
// context, policy, decide, branch, deliver, integrate, project and local.
// Audit logging stays in agm-workspace (passed in as ctx.appendLog).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { defaultRun } from "./run-command.mjs";
import { acknowledge, instructionChain, readRequired, resolveTargetRoots, scanBelow, worktreeFacts } from "./instruction-chain.mjs";
import { inferPolicy, initPolicy, loadPolicy, setPolicyValue } from "./workflow-policy.mjs";
import { recordChoice, renderCard, normalizeOptions, storeCard, validateCard } from "./decision-card.mjs";
import { applyBranch, applyDelivery, applyIntegration, integrationOptions, planBranch, planDelivery, planIntegration } from "./git-flow.mjs";
import { inferProject, initProject, loadProject, resolveSpecSources, setProjectValue, verifySpecPath } from "./project-profile.mjs";
import { addWorkingNote, loadLocalMemory, localPathsForLeakCheck, setLocalPath } from "./local-memory.mjs";
import { readJsonFile, readSessionState, safeSession, updateSessionState, writeJsonFile } from "./session-state.mjs";
import { bangkokParts } from "./decision-records.mjs";

const toSlash = value => String(value || "").replaceAll("\\", "/");
const list = value => String(value === true ? "" : value || "").split(",").map(item => item.trim()).filter(Boolean);
const GOVERNANCE_DEFAULTS = Object.freeze({ workflowPolicy: true, delivery: true, decisionMemory: false, guards: false, projectMode: true, specSync: false });

function globRegex(glob) {
  let source = "";
  const value = toSlash(glob);
  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith("**/", index)) { source += "(?:.*/)?"; index += 2; }
    else if (value.startsWith("**", index)) { source += ".*"; index += 1; }
    else if (value[index] === "*") source += "[^/]*";
    else if (value[index] === "?") source += "[^/]";
    else source += value[index].replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

async function governanceFlags(root) {
  const config = await readJsonFile(path.join(root, ".agrimap-agent", "config.json"));
  return { ...GOVERNANCE_DEFAULTS, ...(config?.governance || {}) };
}

async function readInput(file) {
  if (!file || file === true) return null;
  try { return JSON.parse(await readFile(path.resolve(String(file)), "utf8")); } catch (error) { throw Object.assign(new Error(`INPUT_UNREADABLE: ${error.message}`), { code: "INPUT_UNREADABLE" }); }
}

function cardResult(card) {
  const normalized = { ...card, options: normalizeOptions(card) };
  return { card, render: renderCard(normalized) };
}

async function storeAndRender(state, session, card, executionId) {
  if (!session) return { ...cardResult(card), stored: false };
  const stored = await storeCard(state, session, card, { executionId });
  return stored.ok ? { card, cardId: stored.cardId, render: stored.render, stored: true } : { card, ...stored };
}

async function activeFor(ctx, state, session) {
  if (!session) return { active: null, activePath: null };
  const activePath = ctx.activeTaskPath(state, session);
  return { active: await readJsonFile(activePath), activePath };
}

async function logForActive(ctx, state, active, event) {
  if (!active?.executionId || !active.requestedBy) return null;
  return ctx.appendLog(state, {
    executionId: active.executionId, taskId: active.taskId ?? null, requestedBy: active.requestedBy,
    requesterId: active.requesterId ?? null, identitySource: active.identitySource || "legacy-migrated",
    model: active.model || "unknown", modelLabel: active.modelLabel, role: active.role || "leader", agent: active.agent || "primary", provider: active.provider || "unknown",
    workflowDepth: active.workflowDepth || "light", artifactVersion: active.artifactVersion, risk: active.risk,
    files: [], verification: [], ...event,
  });
}

function requireGit(ctx, root) {
  return ctx.isGitRoot(root) ? null : { ok: false, code: "TARGET_NOT_GIT", message: "This command needs a Git repository; run context to resolve the target root." };
}

async function rootAck(root, session) {
  const chain = await instructionChain(root, []);
  return readRequired(root, session, chain);
}

// ------------------------------------------------------------------ context

async function contextCommand(ctx, args) {
  const sessionCwd = path.resolve(String(args.cwd || process.cwd()));
  const paths = list(args.paths);
  const session = safeSession(args.session);
  const resolution = await resolveTargetRoots({ sessionCwd, target: args.target && args.target !== true ? String(args.target) : null, paths, hint: args.hint, depth: args.depth });
  if (!resolution.ok) return { ...resolution, sessionCwd: toSlash(sessionCwd), next: { action: "ask", command: "ask the requester for the target repository path" } };
  const scan = resolution.scan || (resolution.cwdIsRepo ? null : await scanBelow(sessionCwd, { depth: Math.min(4, Number(args.depth) || 3) }));
  const strayStateRoots = (scan?.strayStateRoots || []).map(toSlash);
  const warnings = strayStateRoots.length ? ["STRAY_STATE_ROOT"] : [];
  if (!resolution.resolved) {
    if (args.ack) return { ok: false, code: "ACK_TARGET_REQUIRED", message: "No single target repository; pass --target <root> with --ack.", sessionCwd: toSlash(sessionCwd) };
    return {
      ok: true, resolved: false, reason: resolution.reason, sessionCwd: toSlash(sessionCwd), cwdIsRepo: false,
      repositories: (scan?.repositories || []).slice(0, 8).map(dir => toSlash(dir)), strayStateRoots, warnings,
      ...(resolution.card ? cardResult(resolution.card) : {}),
      next: resolution.card ? { action: "ask", command: "then context --target <chosen root> --session <id>" } : { action: "ask", command: "ask for the repository path" },
    };
  }
  if (args.ack && !(args.target || paths.length || resolution.cwdIsRepo)) return { ok: false, code: "ACK_TARGET_REQUIRED", message: "Pass --target <root> with --ack when the session cwd is outside a repository." };
  if (args.ack && !session) return { ok: false, code: "SESSION_REQUIRED", message: "--session is required with --ack." };
  const targets = [];
  for (const root of resolution.roots) {
    const relativePaths = paths.map(item => path.relative(root, path.resolve(sessionCwd, item)));
    let chain = await instructionChain(root, relativePaths);
    const flags = await governanceFlags(root);
    const localMemory = await loadLocalMemory(root);
    const project = await loadProject(root);
    const spec = flags.projectMode && project.exists ? await resolveSpecSources(root, sessionCwd, localMemory, { project }) : { sources: [], warnings: [], cards: [], discovered: [] };
    let acknowledged = null;
    if (args.ack) {
      const result = await acknowledge(root, session, list(args.ack), chain);
      if (!result.ok) return result;
      acknowledged = result.acknowledged;
      await ctx.ensureLayout(root, false);
      for (const item of spec.discovered) await setLocalPath(root, { kind: "spec", id: item.id, path: item.path, version: item.version, date: bangkokParts().date });
      chain = await instructionChain(root, relativePaths);
    }
    const required = await readRequired(root, session, chain);
    const facts = await worktreeFacts(root);
    const scopes = project.profile?.specs?.scopes || [];
    const covers = paths.length && scopes.length ? relativePaths.some(item => scopes.some(scope => (scope.covers || []).some(glob => globRegex(glob).test(toSlash(item))))) : null;
    const policy = await loadPolicy(root);
    targets.push({
      targetRoot: toSlash(root), isLinkedWorktree: facts.isLinkedWorktree, branch: facts.branch, stateRoot: toSlash(path.join(root, ".agrimap-agent")),
      chain: chain.map(({ path: _absolute, ...entry }) => entry), readRequired: required, acknowledged,
      policy: { exists: policy.exists, status: policy.status, valid: policy.validation?.ok ?? null },
      projectProfile: project.exists
        ? { exists: true, status: project.status, developmentMode: project.profile?.developmentMode || null, valid: project.validation?.ok ?? false, sources: spec.sources, coversChangedPaths: covers }
        : { exists: false, next: flags.projectMode ? "project infer" : "projectMode disabled: treat as code-first" },
      localMemory: { exists: localMemory.exists, path: localMemory.path, warnings: localMemory.warnings },
      warnings: [...localMemory.warnings, ...spec.warnings.map(item => item.code), ...(project.exists && !project.validation?.ok ? ["PROJECT_PROFILE_INVALID"] : [])],
      specWarnings: spec.warnings,
      cards: spec.cards.map(card => cardResult(card)),
      next: required.length
        ? { action: "read-and-ack", files: required, command: `context --target "${toSlash(root)}" --session ${session || "<id>"} --ack ${chain.filter(entry => required.includes(entry.relative)).map(entry => entry.sha12).join(",")}` }
        : { action: "none" },
    });
  }
  const primary = targets[0];
  return {
    ok: true, resolved: true, via: resolution.via, sessionCwd: toSlash(sessionCwd), cwdIsRepo: resolution.cwdIsRepo,
    ...primary, warnings: [...warnings, ...primary.warnings], strayStateRoots,
    ...(targets.length > 1 ? { targets } : {}),
  };
}

// ------------------------------------------------------------------- policy

async function policyCommand(ctx, sub, args, root) {
  const state = path.join(root, ".agrimap-agent");
  if (sub === "show") return { ok: true, ...(await loadPolicy(root)) };
  const gitError = requireGit(ctx, root);
  if (gitError) return gitError;
  if (sub === "infer") return inferPolicy(root);
  const requestedBy = await ctx.resolveRequester(state, args);
  if (sub === "init") return initPolicy(root, String(args.profile || "gitflow"), await readInput(args.input) || {}, requestedBy);
  if (sub === "set") return setPolicyValue(root, args.key, args.value, requestedBy);
  return { ok: false, message: "Use policy show|infer|init|set." };
}

// ------------------------------------------------------------------ decide

async function decideCommand(ctx, sub, args, root) {
  const state = path.join(root, ".agrimap-agent");
  const session = safeSession(args.session);
  const { active } = await activeFor(ctx, state, session);
  if (sub === "card") {
    const card = await readInput(args.input);
    const validation = validateCard(card);
    if (!validation.ok) return { ok: false, ...validation };
    await ctx.ensureLayout(root, false);
    const stored = await storeCard(state, session, card, { executionId: active?.executionId || null });
    return stored;
  }
  if (sub === "record") {
    const requestedBy = await ctx.resolveRequester(state, args);
    const result = await recordChoice(state, { session, cardId: args.card, choice: args.choice, note: args.note && args.note !== true ? String(args.note) : null, requestedBy });
    if (result.ok && !result.alreadyRecorded) {
      await logForActive(ctx, state, active, {
        event: "decision", milestone: "scope-decision", summary: `Card ${result.cardId}: ${result.label}`.slice(0, 240),
        reason: `${result.log.kind}/${result.log.topic} ${result.log.risk}; recommendedChosen=${result.recommendedChosen}`, files: (result.written || []).map(toSlash),
      });
    }
    return result;
  }
  return { ok: false, message: "Use decide card|record (recall/correction/list arrive in P3)." };
}

// ------------------------------------------------------------------- branch

async function branchCommand(ctx, sub, args, root) {
  const gitError = requireGit(ctx, root);
  if (gitError) return gitError;
  const state = path.join(root, ".agrimap-agent");
  const session = safeSession(args.session);
  const flags = await governanceFlags(root);
  if (!flags.workflowPolicy) return { ok: true, action: "skip", reason: "governance.workflowPolicy is false", commands: [] };
  const loaded = await loadPolicy(root);
  if (loaded.exists && !loaded.validation?.ok) return { ok: false, code: "POLICY_INVALID", details: loaded.validation?.details || [] };
  const { active, activePath } = await activeFor(ctx, state, session);
  const options = { root, policy: loaded.policy, active, type: String(args.type || "feature"), slug: args.slug, ticket: args.ticket && args.ticket !== true ? args.ticket : null, mode: args.mode && args.mode !== true ? String(args.mode) : null };
  if (sub === "plan") {
    const plan = await planBranch(options);
    return plan.card ? { ...plan, ...(await storeAndRender(state, session, plan.card, active?.executionId)) } : plan;
  }
  if (sub === "apply") {
    if (options.mode === "stop") return { ok: true, action: "stopped", message: "The requester handles the working tree first." };
    const result = await applyBranch({ ...options, planHash: args["plan-hash"] });
    if (!result.ok) return result;
    const warnings = [...(result.warnings || [])];
    if (active && activePath) {
      Object.assign(active, result.record);
      await writeJsonFile(activePath, active);
      await logForActive(ctx, state, active, { event: "changed", milestone: "work-branch", summary: `Work branch ${result.record.branch} ready from ${result.record.base}@${String(result.record.baseSha).slice(0, 7)}`, reason: `branch action ${result.record.branchAction}` });
    } else warnings.push({ code: "NO_ACTIVE_EXECUTION", subject: "branch", fix: "start the execution so delivery can find this branch" });
    return { ...result, warnings };
  }
  return { ok: false, message: "Use branch plan|apply." };
}

// ------------------------------------------------------------------ deliver

async function deliverCommand(ctx, sub, args, root) {
  const gitError = requireGit(ctx, root);
  if (gitError) return gitError;
  const state = path.join(root, ".agrimap-agent");
  const session = safeSession(args.session);
  const { active, activePath } = await activeFor(ctx, state, session);
  const loaded = await loadPolicy(root);
  const flags = await governanceFlags(root);
  const localPaths = localPathsForLeakCheck(await loadLocalMemory(root));
  const bodyFallback = active ? await ctx.executionSummaries(state, active.executionId) : [];
  const options = {
    root, policy: loaded.validation?.ok ? loaded.policy : null, active, ackRequired: await rootAck(root, session),
    explicit: args.explicit && args.explicit !== true ? String(args.explicit) : null, input: await readInput(args.input),
    changelogNa: args["changelog-na"] && args["changelog-na"] !== true ? String(args["changelog-na"]) : null,
    mixed: args.mixed && args.mixed !== true ? String(args.mixed) : null, allowSecretPaths: list(args["allow-secret-paths"]), excludePaths: list(args["exclude-paths"]),
    localPaths, bodyFallback, governance: flags,
  };
  const policyWarnings = loaded.exists && !loaded.validation?.ok ? [{ code: "POLICY_INVALID", subject: "workflow.json", fix: "fix the policy; delivery is not automatic meanwhile" }] : [];
  if (sub === "plan") {
    const plan = await planDelivery(options);
    const withWarnings = { ...plan, warnings: [...policyWarnings, ...(plan.warnings || [])] };
    return plan.card ? { ...withWarnings, ...(await storeAndRender(state, session, plan.card, active?.executionId)) } : withWarnings;
  }
  if (sub === "apply") {
    const result = await applyDelivery({ ...options, planHash: args["plan-hash"], pushOnly: Boolean(args["push-only"]) });
    if (!result.ok) return result;
    const delivery = { commit: result.commit, remoteSha: result.remoteSha, pushedAt: result.pushed ? new Date().toISOString() : null };
    Object.assign(active, { delivery });
    await writeJsonFile(activePath, active);
    const lastDelivery = {
      executionId: active.executionId, taskId: active.taskId ?? null, objective: active.objective, branch: result.branch, remoteBranch: result.remoteBranch,
      base: active.base || null, workType: active.workType || null, commit: result.commit, remoteSha: result.remoteSha, remoteVerified: result.remoteVerified,
      header: result.header, files: result.files, verification: result.verification, warnings: result.warnings, preexistingDirty: active.preexistingDirty || [],
      identity: { requestedBy: active.requestedBy, requesterId: active.requesterId ?? null, identitySource: active.identitySource, model: active.model, modelLabel: active.modelLabel, role: active.role, agent: active.agent, provider: active.provider, workflowDepth: active.workflowDepth, artifactVersion: active.artifactVersion, risk: active.risk },
      deliveredAt: new Date().toISOString(),
    };
    await updateSessionState(state, session, { lastDelivery });
    await logForActive(ctx, state, active, {
      event: "delivered", summary: `Delivered ${result.branch} @${String(result.commit).slice(0, 7)}${result.remoteVerified ? " (remote verified)" : ""}`,
      reason: `branch=${result.branch}; remoteBranch=${result.remoteBranch}; commit=${result.commit}; remoteVerified=${result.remoteVerified}`,
      files: result.files, warnings: result.warnings,
    });
    await ctx.appendRecent(state, active, "delivered", `${result.branch} @${String(result.commit).slice(0, 7)}`);
    return result;
  }
  return { ok: false, message: "Use deliver plan|apply." };
}

// ---------------------------------------------------------------- integrate

async function integrateCommand(ctx, sub, args, root) {
  const gitError = requireGit(ctx, root);
  if (gitError) return gitError;
  const state = path.join(root, ".agrimap-agent");
  const session = safeSession(args.session);
  const { active } = await activeFor(ctx, state, session);
  const sessionState = await readSessionState(state, session);
  const delivery = sessionState.lastDelivery || (active?.delivery ? { ...active, ...active.delivery, executionId: active.executionId } : null);
  const loaded = await loadPolicy(root);
  const policy = loaded.validation?.ok ? loaded.policy : null;
  if (sub === "options") {
    const result = await integrationOptions({ root, policy, delivery });
    if (!result.ok) return result;
    return { ...result, ...(await storeAndRender(state, session, result.card, delivery?.executionId)) };
  }
  const options = {
    root, state, policy, active, delivery, intent: String(args.intent || "integrate"), branch: args.branch && args.branch !== true ? String(args.branch) : null,
    target: args.target && args.target !== true ? String(args.target) : null, whenGreen: Boolean(args["when-green"]), confirmUnverified: Boolean(args["confirm-unverified"]),
    confirmTarget: Boolean(args["confirm-target"]), choice: args.choice && args.choice !== true ? String(args.choice) : null, ackRequired: await rootAck(root, session),
  };
  if (sub === "plan") {
    const plan = await planIntegration(options);
    return plan.card ? { ...plan, ...(await storeAndRender(state, session, plan.card, delivery?.executionId)) } : plan;
  }
  if (sub !== "apply") return { ok: false, message: "Use integrate options|plan|apply." };
  const result = await applyIntegration({ ...options, planHash: args["plan-hash"], stage: args.stage && args.stage !== true ? String(args.stage) : null });
  if (!result.ok) return result.card ? { ...result, ...(await storeAndRender(state, session, result.card, delivery?.executionId)) } : result;
  if (options.intent === "park" && active) await ctx.appendRecent(state, active, "parked", "Work branch parked; resume with the same session.");
  const integrated = result.intent === "integrate" && (result.mergeSha || result.pr) && !result.stage;
  if (integrated) {
    const identity = delivery?.identity || active || {};
    await logForActive(ctx, state, { ...identity, executionId: delivery?.executionId || active?.executionId, taskId: delivery?.taskId ?? active?.taskId ?? null }, {
      event: "integrated", summary: `Integrated ${result.source || delivery?.branch} into ${result.target || ""}${result.autoMerge ? " (auto-merge enabled)" : ""}`.slice(0, 240),
      reason: `method=${result.method || "pull-request"}; pr=${result.pr?.url || result.pr?.number || "none"}; mergeSha=${result.mergeSha || "pending"}; remoteVerified=${Boolean(result.remoteVerified)}`,
      warnings: result.warnings,
    });
    await updateSessionState(state, session, { lastCard: undefined, lastDelivery: delivery ? { ...delivery, integrated: { target: result.target, mergeSha: result.mergeSha || null, pr: result.pr || null, at: new Date().toISOString() } } : undefined });
    const rule = policy?.integration?.deleteBranchAfterMerge || "ask";
    if (rule === "ask" && result.remoteVerified) {
      const card = {
        kind: "integration", topic: "git/delete-branch", risk: "R3", confidence: "high",
        question: `ลบ branch ${result.source} หลัง merge ไหม`, impact: "branch ที่ merge แล้วไม่จำเป็นต้องเก็บ",
        checked: [`${result.target} มี ${String(result.sourceSha || "").slice(0, 7)} แล้ว`],
        options: [
          { id: "1", label: "ลบทั้ง local และ remote", effect: "integrate plan --intent abandon --choice both", value: "both" },
          { id: "2", label: "เก็บไว้", effect: "ไม่ลบอะไร", value: "keep" },
        ],
        recommended: "1", recommendedReason: "merge แล้ว", blocking: true, default: null, recordAs: "none", paths: [], expiresHours: 24,
      };
      return { ...result, ...(await storeAndRender(state, session, card, delivery?.executionId)) };
    }
    if (rule === "always" && result.method === "local-merge") {
      const current = defaultRun("git", ["branch", "--show-current"], { cwd: root }).stdout.trim();
      if (current === result.source) return { ...result, deletedBranch: false, warnings: [...(result.warnings || []), { code: "BRANCH_CHECKED_OUT", subject: result.source, fix: "switch away, then integrate plan --intent abandon --choice both" }] };
      defaultRun("git", ["branch", "-d", result.source], { cwd: root });
      defaultRun("git", ["push", "origin", "--delete", delivery?.remoteBranch || result.source], { cwd: root });
      return { ...result, deletedBranch: true };
    }
  }
  return result;
}

// ------------------------------------------------------------------ project

async function projectCommand(ctx, sub, args, root) {
  const state = path.join(root, ".agrimap-agent");
  if (sub === "show") return { ok: true, ...(await loadProject(root)) };
  const gitError = requireGit(ctx, root);
  if (gitError) return gitError;
  if (sub === "infer") return inferProject(root, { sessionCwd: args["session-cwd"] && args["session-cwd"] !== true ? String(args["session-cwd"]) : null });
  if (sub === "init") {
    const overrides = await readInput(args.input) || {};
    if (args.inferred) {
      const inferred = await inferProject(root);
      return initProject(root, String(args.mode || inferred.proposal.developmentMode), overrides, null, { inferred: true, inference: inferred.proposal.inference || { confidence: inferred.confidence, evidence: inferred.evidence, at: bangkokParts().date } });
    }
    return initProject(root, String(args.mode || ""), overrides, await ctx.resolveRequester(state, args));
  }
  if (sub === "set") return setProjectValue(root, args.key, args.value, await ctx.resolveRequester(state, args));
  return { ok: false, message: "Use project show|infer|init|set." };
}

// -------------------------------------------------------------------- local

async function localCommand(ctx, sub, args, root) {
  const gitError = requireGit(ctx, root);
  if (gitError) return gitError;
  if (sub === "show") return { ok: true, ...(await loadLocalMemory(root)) };
  if (sub === "set-path") {
    const kind = String(args.kind || "spec");
    const id = String(args.id || "");
    const target = args.path && args.path !== true ? String(args.path) : "";
    let version = null;
    if (kind === "spec") {
      const check = await verifySpecPath(root, id, target);
      if (!check.ok) return check;
      version = check.version;
    }
    try { return { ok: true, ...(await setLocalPath(root, { kind, id, path: target, version, date: bangkokParts().date })) }; } catch (error) { return { ok: false, code: error.message }; }
  }
  if (sub === "note") {
    try { return { ok: true, ...(await addWorkingNote(root, { text: args.text, date: bangkokParts().date })) }; } catch (error) { return { ok: false, code: error.message }; }
  }
  return { ok: false, message: "Use local show|set-path|note." };
}

export const GOVERNANCE_COMMANDS = Object.freeze(["context", "policy", "decide", "branch", "deliver", "integrate", "project", "local"]);

export async function runGovernanceCommand(command, sub, args, root, ctx) {
  try {
    if (command === "context") return await contextCommand(ctx, args);
    const handlers = { policy: policyCommand, decide: decideCommand, branch: branchCommand, deliver: deliverCommand, integrate: integrateCommand, project: projectCommand, local: localCommand };
    return await handlers[command](ctx, sub, args, root);
  } catch (error) {
    return { ok: false, code: error.code || "COMMAND_FAILED", message: String(error.message || error) };
  }
}
