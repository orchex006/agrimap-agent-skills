# Delegation, workspace, and progress

Load only when independent delegation is justified and supported by the host. Delegation does not itself select regulated depth. Use one writer per file/contract and Main integration; sequential work is valid.

## Dispatch boundary

- Delegate only bounded units with distinct ownership; use at most five active agents.
- Keep one writer model per wave for each file and logical contract. Sequence overlap.
- The Leader owns integration, conflict resolution, verification dispatch, and synthesis. Neither the requester nor decision owner is responsible for collecting or merging agent fragments.
- For QA delegation, import [qa-and-done.md](qa-and-done.md) as the single policy source; do not restate its write/status/correction rules here.

## Workspace contract

Every packet defines `workspace_need`: isolation, requested mode, `base_ref`, exact base commit, provider instruction, visibility check, integration return, and fallback mode.

| Mode | Use | Integration return |
| --- | --- | --- |
| shared workspace | bounded non-overlapping writers or sequential work | changed file set |
| worktree | provider proves supported isolated branch/worktree | visible commit SHA |
| isolated-sandbox | filesystem is isolated without a shared Git ref | portable patch or changed artifacts |
| unknown | do not parallelize writers until visibility is proven | sequential handoff |

- Claude custom agents may use `isolation: worktree` when the installed version supports it.
- A normal subagent starts in the current working directory unless the provider proves isolation.
- Codex managed worktrees are surface-dependent; never infer them from agent creation alone.
- If required uncommitted parent state is absent from the base commit, use shared/sequential work or obtain an authorized commit boundary.

## Delegation packet

Include only task-local data:

- task/objective/non-goals and inherited authority when tracked;
- display label, actual model identity, bounded output, and provider-native inspection path;
- exact files/symbols, ownership, forbidden files, required reference excerpts, constraints, verification, and handoff format;
- workspace contract and integration artifact;
- ordered steps only when the executor needs them.

Do not tell a subagent to load the umbrella or an entire reference tree.

## Visible progress

Current Codex surfaces expose native agent activity: app thread, CLI `/agent`, and IDE background-agent panel. Announce each label/task/output/inspection path before spawn. Continue safe Leader work; when only waiting, inspect and report `running|completed|blocked` at least every 60 seconds. Never emit an unexplained multi-minute wait.

Native activity is the detailed trace. Only when the active surface genuinely lacks it, declare `.agrimap-agent/runtime/progress/<task-id>.jsonl` as fallback. Write `started`, meaningful phase/status transitions, and `finished|blocked`; do not write per step, tool call, read, or unchanged poll. Optional unchanged liveness is capped at once per five minutes.

Official Codex behavior: [Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Handoff and integration

Return status, summary, execution identity, display/thread/progress channel, files/symbols, behavior, decisions, commands/results, risks, memory facts, workspace mode, and integration artifact. A `done` status is testimony only.

The Leader verifies visibility and ownership before integration, integrates once, resolves conflicts without overwriting unrelated work, and then follows the selected workflow depth's completion contract.
