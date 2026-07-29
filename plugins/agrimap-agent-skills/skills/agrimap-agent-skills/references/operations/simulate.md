# Compact operation entrypoint: agm-simulate

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `simulate`
- Workflow depth: default `light`; allowed `light`, `standard`, `regulated`
- Mode: `product-read-only`
- Purpose: Simulate scenarios, risks, and observable outcomes.
- Deliverable: direct simulation at light; tracked analysis.md only at standard/regulated

## Inputs and help

- Required: scenario.
- Conditional: inputs and observables when they cannot be derived from the scenario.
- Minimal example: `$agm-simulate depth=light scenario="Retry after timeout" inputs=timeout,retry-count`

## Execute this contract

1. Model the initial state, transitions, branches, failure modes, and observables.
2. Label assumptions and confidence; do not present a simulation as measured runtime fact.

## Load now

- [goal-rules.md](../goal-rules.md) — mandatory Think/Simplicity/Surgical/Goal-Driven discipline
- [analysis-discipline.md](../analysis-discipline.md) — assumption and confidence labels

## Load only when the condition matches

- When target_kind is fe-main or fe-library: [frontend-engineer.md](../frontend-engineer.md) — frontend state and observable fundamentals
- When target_kind is be-main or be-library: [backend-engineer.md](../backend-engineer.md) — backend boundary and runtime fundamentals
- When the backend scenario contains C#: [patterns/csharp.md](../patterns/csharp.md) — project-wide C# behavior and style baseline
- When the backend scenario involves cookie, header, query, form, JSON body, or device-ID resolution: [patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md](../patterns/golden/backend-libraries/013-1-extensions-request-value-normalize.md) — request-value transition and precedence behavior
- When the scenario touches a stored procedure, table, or persisted data: [db-schema-context.md](../db-schema-context.md) — schema facts behind simulated data outcomes
- When the scenario includes an application URL, domain, redirect, or callback: [application-url-matrix.md](../application-url-matrix.md) — authoritative environment-specific transitions

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
