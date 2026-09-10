# AgriMap skill-package development

<!-- AGM-MAINTAINER-ONLY -->

Scope: apply this file only when the user explicitly assigns development, testing or publication of this source repository. Reading an installed/cached skill, using it in another project, or installing/updating a package is NOT repository development. A matching package name, cwd, Git directory or encountering this file does not activate these rules. In consumer/cache contexts, do not load DEVELOPMENT.md or apply its branch, PR, version or publication workflow to the user's project.

User-approved scope and host instruction hierarchy are authoritative. This repository is a skill package, not a product service.

- For authorized package development, read [DEVELOPMENT.md](DEVELOPMENT.md). Use the existing directory and scoped development branch; never automatically clone/copy the product or create a worktree.
- No direct commits/pushes to main. Editing, committing/pushing, merging a PR and publishing a release have separate authorization boundaries; a version bump is not publication authority.
- Keep maintainer rules out of runtime entrypoints, hooks and product bootstrap templates. Runtime artifacts exclude this root file and DEVELOPMENT.md; retain the distinct assets/bootstrap/AGENTS.md template.

- Ordinary discussion creates no lifecycle or task artifacts. Relevant raw requester submissions may be captured once under `.agrimap-agent/prompts/YYYY-MM/<conversation>/history.md`; never mix AI output into raw history or capture unrelated conversations.
- Authorized bounded writes use concise audit evidence. Create a tracked task only for resume, handoff, or explicit tracking needs; v3 uses one `task.md`. Preserve legacy artifacts and history.
- `agm-prompt` creates V1 when an executable prompt is first finalized. Further immutable versions require a substantive requester-backed content revision. Explanation, comparison, acknowledgment, approval and unchanged retries create no version. No `requirements/` tree.
- Prompt Results remain one file per version under `.agrimap-agent/prompts/YYYY-MM/<conversation>/<context>-vNNN.md`, preserve valid prior requirements and explicitly state Main/Subagent ownership.
- SQL context access is read-only through sql-context-pack: metadata and bounded masked SELECT within the connected profile. Never execute database DDL/DML, EXEC/CALL, routine deployment or metadata writes, irrespective of model/depth. Authoring SQL files is a separate explicitly authorized action, not database execution.
- Edit canonical sources, then run the adapter generator. Do not manually diverge installed/generated copies.
- Verify changed behavior proportionally. Reuse matching evidence; do not rerun unrelated checks or create documentation merely to satisfy an obsolete file count.
