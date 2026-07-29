# Compact operation entrypoint: agm-prompt

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `prompt`
- Workflow depth: default `light`; allowed `light`
- Mode: `workflow-write-only`
- Purpose: Analyze and refine requester intent into one immutable versioned Prompt Result with explicit Main and Subagent ownership.
- Deliverable: .agrimap-agent/prompts/YYYY-MM/<conversation-id>/<context>-vNNN.md plus light memory/log/report evidence; never tasks/** or separate role files

## Inputs and help

- Required: objective or prompt text; conversation/session/context identity.
- Conditional: explicit source Prompt Result path for revision; owner confirmation when implicit source selection is ambiguous; target_kind/backend_profile for target-specific work.
- Minimal example: `$agm-prompt objective="Prepare a complete cancel-order implementation prompt" context=cancel-order`

## Execute this contract

1. Treat requester input as V0 only. The first finalized model result creates immutable V1; every focused continuation creates the next immutable version without overwriting prior files.
2. Create exactly one Prompt Package file per version. State Main ownership and either explicit Subagent assignments or explicit none, including files/contracts, forbidden overlap, model profile, verification, and handoff.
3. Use an explicit source path after validation. Without one, continue only when exactly one credible prompt family exists in the same conversation/context; otherwise stop PROMPT_SOURCE_CONFIRM_REQUIRED.
4. Remain workflow-write-only and product-read-only. Never create tasks/**, execute the Prompt Result, create separate role instructions, or store model answers/tool output/hidden reasoning as raw history.

## Load now

- [goal-rules.md](../goal-rules.md) — mandatory Think/Simplicity/Surgical/Goal-Driven discipline
- [prompt.md](../prompt.md) — immutable Prompt Result lifecycle, source resolution, and package sections
- [passive-capabilities.md](../passive-capabilities.md) — embedded design support for brief and acceptance
- [model-capability-matrix.yaml](../model-capability-matrix.yaml) — capability-profile routing labels

## Load only when the condition matches

- When the Prompt Result defines Subagent assignments: [subagents-and-branches.md](../subagents-and-branches.md) — Main/Subagent ownership, visibility, and integration boundaries
- When target_kind is fe-main or fe-library: [frontend-engineer.md](../frontend-engineer.md) — frontend fundamentals that every generated handoff must carry
- When target_kind is be-main or be-library: [backend-engineer.md](../backend-engineer.md) — backend fundamentals that every generated handoff must carry
- When the backend handoff contains C#: [patterns/csharp.md](../patterns/csharp.md) — project-wide C# rules that every generated handoff must carry
- When the backend handoff touches cookie, header, query, form, JSON body, or device-ID resolution: [patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md](../patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md) — request-value rules that every generated handoff must carry
- When target_kind is sql-table, sql-procedure, or sql-table-and-procedure: [patterns/sql.md](../patterns/sql.md) — SQL fundamentals that every generated handoff must carry
- When the handoff touches a stored procedure, table, or persisted data: [db-schema-context.md](../db-schema-context.md) — schema evidence the executor must carry
- When FE/BE URL, domain, redirect, or callback logic is in scope: [application-url-matrix.md](../application-url-matrix.md) — authoritative environment-specific Prompt Result inputs

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
