# Compact operation entrypoint: agm-release

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `release`
- Workflow depth: default `light`; allowed `light`, `standard`, `regulated`
- Mode: `product-write`
- Purpose: Index AgriMap projects, prepare requested or default patch versions, publish Inhouse pipelines, and promote Production with explicit confirmation.
- Deliverable: verified checkpoints for the selected release command; explicit confirmation before Production promotion and tag publication

## Inputs and help

- Required: target repository and one explicit release command.
- Conditional: confirmation of the concrete Production SHA, version, remote branch and tag immediately before promote.
- Minimal example: `$agm-release release production`

## Execute this contract

1. Resolve indexing, prepare inhouse|production, pipeline inhouse|production, promote, or release full|production|inhouse using release-workflow.md. These are Agent commands, not CLI subcommands. Quoted examples and help never authorize release. Use an explicit owner Version/Patch target before the PATCH+1 default; follow release-workflow.md and release-tools.md for revised candidates and PATCH-only CLI fallback without repeated version approval.
2. Check tools and target bootstrap prerequisites before audit; install missing tools and apply compatible missing bootstrap files within the selected command using release-and-bootstrap.md. Resolve existing-file conflicts through a concrete adoption decision when needed. Continue the same invocation after repair; resume recorded candidates without bumping again.
3. Complete all preparation before asking for Production confirmation. Never infer that confirmation from promote/release invocation or legacy Version + Tags authorization. Changed candidate or destination invalidates confirmation.
4. Read release-steps.md and release-tools.md before execution. Production alone owns versioned notes, release.md and tags. Standalone pipeline/promote never invent missing preparation; enforce exact owner diffs and stage-specific completion for all nine commands.

## Load now

- [release-workflow.md](../release-workflow.md) — command semantics, tool readiness, publication boundary, confirmation and recovery
- [goal-rules.md](../goal-rules.md) — scope and proportional verification
- [recommendations.md](../recommendations.md) — evidence-calibrated communication
- [release-steps.md](../release-steps.md) — mandatory exact nine-command sequences and Production artifact ownership
- [release-tools.md](../release-tools.md) — mandatory .NET tool discovery and proven CLI compatibility before writes

## Load only when the condition matches

- No additional conditional reference by default; select one target pattern only when lifecycle-core routing requires it.

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
