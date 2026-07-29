# Compact operation entrypoint: agm-review

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `review`
- Workflow depth: default `light`; allowed `light`, `standard`, `regulated`
- Mode: `product-read-only`
- Purpose: Review code or artifacts with evidence-backed findings.
- Deliverable: direct findings at light; tracked analysis.md only at standard/regulated

## Inputs and help

- Required: target.
- Conditional: review_scope when the requester wants narrower coverage than the default.
- Minimal example: `$agm-review depth=light target_files=src/orders.ts review_scope=correctness,regression,tests`

## Execute this contract

1. Review correctness, regressions, contracts/data, maintainability, relevant performance, and tests in that order.
2. Report actionable findings by severity with file/line, evidence, and impact; do not fix them.

## Load now

- [goal-rules.md](../goal-rules.md) — mandatory Think/Simplicity/Surgical/Goal-Driven discipline
- [analysis-discipline.md](../analysis-discipline.md) — finding evidence and severity

## Load only when the condition matches

- When the target is FE, BE, or SQL: [patterns/pattern-status.md](../patterns/pattern-status.md) — route to the current target pattern only
- When target_kind is fe-main or fe-library: [frontend-engineer.md](../frontend-engineer.md) — frontend review fundamentals
- When target_kind is be-main or be-library: [backend-engineer.md](../backend-engineer.md) — backend review fundamentals
- When the backend review contains C#: [patterns/csharp.md](../patterns/csharp.md) — project-wide C# review baseline
- When the backend review touches cookie, header, query, form, JSON body, or device-ID resolution: [patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md](../patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md) — request-value correctness and precedence review
- When the review touches a stored procedure, SQL, or persisted data: [db-schema-context.md](../db-schema-context.md) — schema evidence behind data and error-code findings
- When the review touches FE/BE URL, domain, redirect, or callback logic: [application-url-matrix.md](../application-url-matrix.md) — authoritative expected URL values

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
