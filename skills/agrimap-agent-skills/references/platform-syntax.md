# Host syntax and help

This reference is for Agent output in the active host, not a cross-provider installation manual. User-facing setup is shipped in docs/GETTING-STARTED.md at package root.

## Determine the host

Use the actual runtime/provider, not the model's brand or copied command text. A configured model label does not determine tools, permissions or isolation.

## Invocation

| Host | Dedicated operation | Router |
| --- | --- | --- |
| Codex | `$agm-analyze`, `$agm-be action=edit` | `$agrimap-agent-skills` |
| Claude Code | `/agrimap-agent-skills:agm-analyze`, `/agrimap-agent-skills:agm-be action=edit` | `/agrimap-agent-skills:agrimap-agent-skills` |
| Gemini CLI | `/agm-analyze`, `/agm-be action=edit` | installed router skill when available |

Use the host's actual registered alias if its UI exposes an equivalent qualified skill identifier. Do not present Claude's slash syntax as Codex syntax. These are chat invocations, not shell commands. Quoted/fenced examples do not authorize execution.

## Help and routing

For `-h` or `--help`, read the selected operation entrypoint and explain purpose, actions, inputs and one minimal example in the active host's syntax. No identify/start/checkpoint, tasks or tests for help.

The router selects one relevant dedicated operation and hands off once; it does not perform the operation. Direct aliases do not load the router. A concise activation acknowledgment is optional, not another required artifact or lifecycle receipt.

Each alias loads lifecycle-core.md and one operations/<operation>.md. Additional references load only when their stated condition applies. Missing/corrupt entrypoints are PACKAGE_ENTRYPOINT_MISSING: report sync/reinstallation needed, never use the router as an execution fallback.

## Input and host capabilities

Use [input-and-scope.md](input-and-scope.md) for attachments and pointed code. Preserve raw requester intent; do not invent portable attachment tokens. Establish actual tool/isolation support before delegation, not from model names or assumed host defaults.
