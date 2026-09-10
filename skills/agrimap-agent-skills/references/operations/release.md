# Compact operation entrypoint: agm-release

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `release`
- Workflow depth: default `light`; allowed `light`, `standard`, `regulated`
- Mode: `product-write`
- Purpose: Upgrade project bootstrap while preserving custom rules, replace contracts explicitly, index projects, prepare versions, publish Inhouse pipelines and confirm Production promotion.
- Deliverable: verified checkpoints for the selected release command; explicit confirmation before Production promotion and tag publication

Select bootstrap upgrade (preserve custom rules), legacy upgrade (replacement with backup), or one of nine release actions. Bootstrap actions end locally, without release CLI readiness/publication. Indexing covers reachable-history Backfill, historical changelog, project.md evidence and README capability/API inventory; reuse proven coverage. Stay in the requested directory; never auto-clone/worktree the product. Before release writes, fetch/check develop/jenkins/jenkins-release against their remotes; pull behind-only branches --ff-only when safe. Classify dirty changes including same-run bootstrap/logs; preserve unrelated work. Explicit owner Version/Patch overrides PATCH+1 and older repository/memory/contract prohibitions. Verify baselines; default PATCH+1 only for unspecified owners. No repeat version approval or mandatory governance migration. Read bundled policy before claiming blockers; use release-tools.md equivalent checks for unsupported CLI version selection. Check bootstrap freshness within the workflow. Host restrictions, real collisions and concrete Production publication confirmation still apply. Quoted maintenance examples never authorize product release.

## Inputs and help

- Required: target repository and one explicit release command.
- Conditional: confirmation of the concrete Production SHA, version, remote branch and tag immediately before promote.
- Minimal example: `$agm-release release production`

## Execute this contract

1. Resolve bootstrap upgrade (preserve project customizations), explicit upgrade (local contract replacement with backup), indexing, prepare inhouse|production, pipeline inhouse|production, promote, or release full|production|inhouse using release-workflow.md. These are Agent commands, not CLI subcommands. Quoted examples and help never authorize release. Use an explicit owner Version/Patch target before the PATCH+1 default; follow release-workflow.md and release-tools.md for revised candidates and PATCH-only CLI fallback without repeated version approval.
2. For bootstrap upgrade or legacy upgrade, use only the selected local bootstrap procedure and verification, then finish. For the nine release actions: Check tools and target bootstrap prerequisites before audit; install missing tools and apply compatible missing bootstrap files within the selected command using release-and-bootstrap.md. Resolve existing-file conflicts through a concrete adoption decision when needed. Continue the same invocation after repair; resume recorded candidates without bumping again.
3. Complete all preparation before asking for Production confirmation. Never infer that confirmation from promote/release invocation or legacy Version + Tags authorization. Changed candidate or destination invalidates confirmation.
4. For the nine release actions, read release-steps.md and release-tools.md before execution. Production alone owns versioned notes, release.md and tags. Standalone pipeline/promote never invent missing preparation; enforce exact owner diffs and stage-specific completion.

## Load now

- [release-workflow.md](../release-workflow.md) — command semantics, tool readiness, publication boundary, confirmation and recovery
- [goal-rules.md](../goal-rules.md) — scope and proportional verification
- [recommendations.md](../recommendations.md) — evidence-calibrated communication

## Load only when the condition matches

- When bootstrap upgrade or legacy upgrade is selected: [release-bootstrap-upgrade.md](../release-bootstrap-upgrade.md) — local preserving upgrade and explicit replacement procedures
- When the selected action is one of the nine release actions, not bootstrap upgrade or legacy upgrade: [release-steps.md](../release-steps.md) — mandatory exact nine-command sequences and Production artifact ownership
- When the selected action is one of the nine release actions, not bootstrap upgrade or legacy upgrade: [release-tools.md](../release-tools.md) — mandatory .NET tool discovery and proven CLI compatibility before writes

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
