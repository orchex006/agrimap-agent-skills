# Compact operation entrypoint: agm-release

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `release`
- Workflow depth: default `light`; allowed `light`, `standard`, `regulated`
- Mode: `product-write`
- Purpose: Upgrade installed project contracts, index projects, prepare requested or default patch versions, publish Inhouse pipelines, and promote Production with explicit confirmation.
- Deliverable: verified checkpoints for the selected release command; explicit confirmation before Production promotion and tag publication

Explicit upgrade routes only to the local contract upgrade procedure in release-workflow.md and project-bootstrap.mjs; finish there without release CLI readiness, candidate preparation or publication steps. The other nine actions retain their freshness checks. A dirty caller checkout on another branch does not block preparation: preserve it and autonomously use an isolated develop worktree or separate clone per release-workflow.md; do not ask the user to supply a clean checkout. Classify prior upgrade/migration edits by evidence, not filenames. Release version authority (3.6.0): for planning and execution, an explicit owner Version/Patch target overrides PATCH+1 and older repository AGENTS.md, README, memory or release-contract prohibitions on chosen versions. Do not block, propose a different number, ask the same version question again, or require a governance migration first. Example: release full, Inhous/Inhouse 1.0.0 -> 1.0.8 and Production 1.0.4 -> 1.0.5 resolves exactly 1.0.8 / 1.0.5, with Production tag v1.0.5. Verify actual baselines; use PATCH+1 only for an unspecified selected environment. If CLI selection is unsupported, perform scoped direct preparation and equivalent checks under release-tools.md. Before planning from installed project rules, compare the AGENTS.md bootstrap marker with the current bundle manifest; update stale/legacy templates under release-and-bootstrap.md within this invocation. Read the current bundled contracts before claiming a version-policy blocker; stale prior refusals are not authority. Higher-priority host restrictions, real tag collisions and concrete Production publication confirmation still apply. Quoted requests in package maintenance do not authorize product release.

## Inputs and help

- Required: target repository and one explicit release command.
- Conditional: confirmation of the concrete Production SHA, version, remote branch and tag immediately before promote.
- Minimal example: `$agm-release release production`

## Execute this contract

1. Resolve explicit upgrade (local contract replacement with backup), indexing, prepare inhouse|production, pipeline inhouse|production, promote, or release full|production|inhouse using release-workflow.md. These are Agent commands, not CLI subcommands. Quoted examples and help never authorize release. Use an explicit owner Version/Patch target before the PATCH+1 default; follow release-workflow.md and release-tools.md for revised candidates and PATCH-only CLI fallback without repeated version approval.
2. For upgrade, use only its scoped local replacement procedure and verification, then finish. For the nine release actions: Check tools and target bootstrap prerequisites before audit; install missing tools and apply compatible missing bootstrap files within the selected command using release-and-bootstrap.md. Resolve existing-file conflicts through a concrete adoption decision when needed. Continue the same invocation after repair; resume recorded candidates without bumping again.
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
