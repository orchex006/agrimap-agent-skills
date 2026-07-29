# Compact operation entrypoint: agm-qa

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `qa`
- Workflow depth: default `light`; allowed `light`, `regulated`
- Mode: `verification-only`
- Purpose: Verify an artifact under a product-read-only, execution-restricted QA contract.
- Deliverable: direct QA evidence at light without tasks/**; tracked qa.md only at regulated

## Inputs and help

- Required: artifact or target to verify.
- Conditional: task_id for regulated tracked QA; qa_mode=full only when an explicit full-QA trigger applies.
- Minimal example: `$agm-qa depth=light qa_mode=light artifact="integrated workspace"`

## Execute this contract

1. Default to depth=light and qa_mode=light; a provider/model, SQL/BE/FE target, regulated implementation, or large diff never selects full by itself.
2. Apply qa-and-done.md, keep product artifacts read-only, and use only read-only inspection plus read-only AgriMap script paths. Never format SQL, install SQLFluff, or connect to LocalDB, dbserver, SQL Server, or another runtime service.
3. The only product-command exceptions are dotnet build for an existing BE project when compile evidence is necessary, and npm run start:agrimap:development for FE only at qa_mode=full when startup evidence is explicitly necessary; do not run other product commands.
4. Return only canonical status, evidence, commands actually run, and limitations.

## Load now

- [goal-rules.md](../goal-rules.md) — mandatory Think/Simplicity/Surgical/Goal-Driven discipline
- [qa-and-done.md](../qa-and-done.md) — single QA, correction, and completion policy

## Load only when the condition matches

- When the task is FE, BE, or SQL: [patterns/pattern-status.md](../patterns/pattern-status.md) — select exactly the matching pattern and Detect gates
- When target_kind is fe-main or fe-library: [frontend-engineer.md](../frontend-engineer.md) — frontend QA fundamentals
- When target_kind is be-main or be-library: [backend-engineer.md](../backend-engineer.md) — backend QA fundamentals including request-value normalization
- When the backend artifact contains C#: [patterns/csharp.md](../patterns/csharp.md) — project-wide C# QA baseline
- When BE work reads or refactors cookie, header, query, form, JSON body, or device-ID resolution: [patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md](../patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md) — request-value QA behavior matrix for main/library code
- When verification touches a stored procedure, SQL, or persisted data: [db-schema-context.md](../db-schema-context.md) — schema facts required to verify data and error behavior
- When FE/BE URL, domain, redirect, or callback logic is under verification: [application-url-matrix.md](../application-url-matrix.md) — authoritative expected URL values

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
