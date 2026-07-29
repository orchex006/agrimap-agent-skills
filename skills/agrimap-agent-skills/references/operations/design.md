# Compact operation entrypoint: agm-design

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `design`
- Workflow depth: default `light`; allowed `light`, `standard`, `regulated`
- Mode: `product-read-only`
- Purpose: Design FE, BE, SQL, or architecture behavior and acceptance through one product-read-only discipline.
- Deliverable: direct design at light; tracked analysis.md only at standard/regulated

## Inputs and help

- Required: objective; target=fe|be|sql|architecture.
- Conditional: target_kind and phase for FE/BE; backend_profile for be-main; decision-owner choice when architecture alternatives are material.
- Minimal example: `$agm-design depth=light target=architecture objective="Design ownership and migration for order status"`

## Execute this contract

1. Resolve exactly one target discipline before inspection, then define actors, boundaries, data/contract flow, states, transitions, validation, failure/recovery, migration, and measurable acceptance as applicable.
2. Use only the matching FE, BE, SQL, or architecture references below; remain product-read-only and do not implement.

## Load now

- [goal-rules.md](../goal-rules.md) — mandatory Think/Simplicity/Surgical/Goal-Driven discipline
- [analysis-discipline.md](../analysis-discipline.md) — facts versus proposed design
- [input-and-scope.md](../input-and-scope.md) — design reference coverage

## Load only when the condition matches

- When target=fe: [frontend-engineer.md](../frontend-engineer.md) — frontend design discipline
- When target=be: [backend-engineer.md](../backend-engineer.md) — backend boundary discipline
- When the backend design contains C#: [patterns/csharp.md](../patterns/csharp.md) — project-wide C# contract and boundary examples
- When the backend design includes cookie, header, query, form, JSON body, or device-ID resolution: [patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md](../patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md) — request-value resolution contract
- When target=sql: [patterns/sql.md](../patterns/sql.md) — SQL schema, result, transaction, and deployment design discipline
- When target=architecture: [service-ownership.md](../service-ownership.md) — canonical service/data ownership and architecture boundaries
- When the design reads or writes data through a stored procedure, view, or table: [db-schema-context.md](../db-schema-context.md) — owner DDL evidence and SP → table tracing
- When target is FE or BE and URL, domain, redirect, or callback logic is in scope: [application-url-matrix.md](../application-url-matrix.md) — authoritative environment-specific design values

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
