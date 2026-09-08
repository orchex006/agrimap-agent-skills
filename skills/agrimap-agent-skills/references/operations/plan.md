# Compact operation entrypoint: agm-plan

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `plan`
- Workflow depth: default `light`; allowed `light`, `standard`, `regulated`
- Mode: `product-read-only`
- Purpose: Create a reverse-engineered execution plan.
- Deliverable: requested result with proportional evidence; no lifecycle for ordinary answers

## Inputs and help

- Required: objective.
- Conditional: decision-owner choice when multiple material approaches remain viable.
- Minimal example: `$agm-plan objective="Add order cancellation" target_files=src/orders.ts`

## Execute this contract

1. Reverse-engineer current behavior, dependencies, callers, tests, and integration order before planning.
2. Each step names target, action, reason, verification, and decision-owner gate; do not implement.

## Load now

- [goal-rules.md](../goal-rules.md) — mandatory Think/Simplicity/Surgical/Goal-Driven discipline
- [analysis-discipline.md](../analysis-discipline.md) — evidence-backed plan assumptions
- [input-and-scope.md](../input-and-scope.md) — scope ledger
- [recommendations.md](../recommendations.md) — visible evidence-calibrated recommendations and routine uncertainty disclosure

## Load only when the condition matches

- When target_kind is fe-main or fe-library: [frontend-engineer.md](../frontend-engineer.md) — frontend execution-plan fundamentals
- When target_kind is be-main or be-library: [backend-engineer.md](../backend-engineer.md) — backend execution-plan fundamentals
- When the backend plan contains C#: [patterns/csharp.md](../patterns/csharp.md) — project-wide C# implementation baseline
- When the backend plan touches cookie, header, query, form, JSON body, or device-ID resolution: [patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md](../patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md) — request-value API and precedence plan
- When the plan touches a stored procedure, table, or persisted data: [db-schema-context.md](../db-schema-context.md) — schema evidence required before data steps
- When the plan includes FE/BE URL, domain, redirect, or callback logic: [application-url-matrix.md](../application-url-matrix.md) — authoritative environment-specific plan inputs
- When material intent remains unresolved: [elicitation.md](../elicitation.md) — resolve only consequential ambiguity

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
