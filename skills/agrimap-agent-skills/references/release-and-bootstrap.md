# Project bootstrap and release knowledge

Load only for relevant initialization/adoption, backfill, branch/version/release or pipeline work. Quoted intents in documentation requests never execute releases.

For existing project work, read the target repository's applicable AGENTS.md completely before its release or portable-recording workflow. The [bundled project AGENTS.md](../assets/bootstrap/AGENTS.md) is the owner-supplied installation source, not an override for a different installed project contract. This reference is only a routing summary: resolve differences against the target's instructions and explicit owner decisions, never silently combine conflicting contracts. Do not import project-only requirements into the skill-package root.

## Bootstrap

Use scripts/project-bootstrap.mjs plan --target <project> --kind fe-main|be-main|fe-library|be-library, then apply within authorized initialization or the scoped release prerequisite repair below. agm-workspace init --bootstrap uses the same installer. No installation on identify/session start; never target the skill-package root.

Copy AGENTS.md, GEMINI.md, CLAUDE.md, CURSOR.md and release-notes/README.md byte-exactly from assets/bootstrap; insert only its Deployment block into README. Hashes and conflict checks apply; changed existing files require explicit adoption. Do not copy root .gitignore, Jenkinsfiles, changelog or version-specific notes. Bootstrap does not bump, commit, push or deploy.

New main FE/BE scaffolds start 1.0.0 and libraries 0.0.x; adoption never resets existing owners. The supplied release contract describes a .NET main-service profile. Verify actual FE/library tool and pipeline applicability; do not invent support, stages or server triggers.

## Release prerequisite repair

An executable agm-release command authorizes checking and installing compatible missing bootstrap prerequisites needed by that command in its named product target. No separate init invocation is required. Help, quoted commands and skill-package maintenance do not authorize product bootstrap.

Before audit, inspect applicable parent/target instructions, actual project kind, worktree and the synchronized branch used by the selected stage (develop for indexing/preparation). If target AGENTS.md is missing, inspect the bundled AGENTS.md completely and prove its profile applies before installing it; absence is a repair condition, not by itself a terminal blocker. Never copy from another branch without proving provenance, or carry unrelated changes across branches.

Run the installer plan with the proven target/kind. Inspect every planned path and the bundle hashes. A compatible plan containing only create, insert-section and unchanged entries may be applied immediately with the same arguments; verify applied=true, hashes and actual diff, then read the installed target instructions and rerun the failed audit/check in this invocation. The bootstrap file set and README section above are the installation boundary. Preserve existing memory/history and unrelated README content.

The installer refuses the entire plan when any entry conflicts. Do not loop apply or invent a force flag. Inspect the exact differing files/README block and applicable authority. Keep valid project-specific instructions; a difference alone does not require template replacement. If replacement is necessary, present the concrete adoption diff and request confirmation unless that exact change is already authorized. After adoption is authorized, perform only the reviewed file/block edits from the verified bundle, rerun plan/apply and verification, then continue. An incompatible project profile or unresolved instruction conflict blocks only dependent work; report the evidence and decision needed, not instructions for the requester to restore/commit files manually.

Missing Jenkinsfiles are outside this bundle: inspect tracked history and remote state for a proven recovery within scope; do not invent pipeline configuration. Tool repair follows release-tools.md. Bootstrap cannot resolve an incompatible mandatory CLI gate by itself.

For indexing/prepare, bootstrap changes remain local. Composite release commands include reviewed prerequisite paths in their normal content publication before the version metadata commit. Standalone pipeline/promote still require a prepared candidate: do not alter a frozen candidate or bump versions to add bootstrap files; repair in a separate preparation workspace and report the required candidate refresh when needed. Any refreshed candidate must pass the usual checks and Production confirmation. Bootstrap itself never commits, pushes or tags, and does not remove any confirmation gate.

## Release distinctions

- Fixed owners: Jenkinsfile/Inhouse/jenkins and Jenkinsfile_Production/Production/jenkins-release. Prepare only at develop; PATCH+1 independently; only IMAGE_TAG/PROJECT_VERSION pair may change in the selected owner. No arbitrary version.
- Promotion is develop -> verified jenkins SHA -> jenkins-release using fast-forward-only checks. The jenkins gate is branch ordering, not waiting for a green pipeline. Proceed through authorized checkpoints without waiting for Jenkins; report pipeline pending/not verified unless actually observed. Never perform server rollout or call Jenkins API under this contract.
- Prepare-* publishes develop only. Group B is exactly Version Inhouse, Version Both, Version Production and Version + Tags: read §§2.3/6.3 for complete reviewed working-copy publication, separate content/version commits, and final audit commit/push to develop. Other deploy aliases do not inherit that expanded scope.
- Exact owner group-B intent confirms branch pushes including final audit publication; only Version + Tags confirms annotated tag push. Other outward effects follow §2.1. Quoted intent does not confirm anything.
- Version Production and Version + Tags bump Production only; Version Both computes both independently. Only Version + Tags publishes an annotated tag, with verbatim notes equality and remote object/peeled-SHA verification.
- Group-B final audit commit is NOT promoted or tagged. Release SHA and final develop SHA may differ. Freeze avoids self-referential SHA/commit loops; resume unfinished checkpoints without a second bump.
- Missing memory allows bootstrap only for the named backfill exception. Missing permissions, divergence, conflict, verification failure or tag collision require evidence and safe alternatives before a decision request, not fabricated success.

## Evidence and recording

Canonical artifact names: changelog.md, release.md, release-notes/<VERSION>.md, .agrimap-agent/memory/project.md. Changelog entries are English, newest-first, one heading per day. Release prose/tag annotation is Thai with English schema fields and technical identifiers. Backfill requires actual reachable history plus source/dirty coverage and README capability/API inventory.

For repositories adopting this AGENTS, its §9 portable recording contract requires logs, current/recent memory and terminal report for repository-changing runs, even without skills. Follow its allowlist and group-B publication exception; do not silently replace it with the package's optional-report default or create duplicate lifecycles. Other repositories retain their own applicable contract.

Agent executes authorized agm-release/Git steps, checks every exit code immediately, and reports actual results. CLI audit/prepare/verify is not Git publication or proof of deployment. Full details and precedence are owned by project AGENTS, not this summary.
