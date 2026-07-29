# Compact operation entrypoint: agm-exec

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `execute`
- Workflow depth: default `regulated`; allowed `regulated`
- Mode: `product-write`
- Purpose: Execute one decision-owner-approved generated prompt as the execution source of truth with checkpoints, deviation stops, and a Result Package.
- Deliverable: integrated Result Package awaiting canonical QA

## Inputs and help

- Required: approved prompt path or resumable task_id.
- Conditional: decision-owner choice when a material deviation exceeds the approved prompt.
- Minimal example: `$agm-exec requested_by=Billy prompt=.agrimap-agent/instructions/YYYY-MM/<task-id>/executor.prompt.md`

## Execute this contract

1. Require prompt_status=owner-approved and execute its ordered steps as the task source of truth.
2. Stop and report structured deviation evidence when a material change exceeds scope; return the Result Package and integration artifact.
3. Own implementation only: update the acceptance checklist and record integration evidence, but do not create qa.md or result.md; QA and final Leader closure are later phases.

## Load now

- [goal-rules.md](../goal-rules.md) — mandatory Think/Simplicity/Surgical/Goal-Driven discipline
- [prompt.md](../prompt.md) — Prompt Result source of truth and deviation contract
- [subagents-and-branches.md](../subagents-and-branches.md) — native activity, workspace, and integration contract
- [qa-and-done.md](../qa-and-done.md) — regulated QA and completion source

## Load only when the condition matches

- When the approved prompt targets C# backend work: [backend-engineer.md](../backend-engineer.md) — backend discipline carried into execution
- When the approved prompt targets C# backend work: [patterns/csharp.md](../patterns/csharp.md) — project-wide C# execution baseline
- When the approved backend prompt touches cookie, header, query, form, JSON body, or device-ID resolution: [patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md](../patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md) — request-value execution contract
- When the approved prompt touches a stored procedure, table, or persisted data: [db-schema-context.md](../db-schema-context.md) — schema evidence required before data changes
- When the approved Prompt Result touches FE/BE URL, domain, redirect, or callback logic: [application-url-matrix.md](../application-url-matrix.md) — authoritative environment-specific execution values

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
