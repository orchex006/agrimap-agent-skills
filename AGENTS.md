# AgriMap skill-package development

User-approved scope and host instruction hierarchy are authoritative. This repository is a skill package, not a product service.

- Ordinary discussion creates no lifecycle or task artifacts. Relevant raw requester submissions may be captured once under `.agrimap-agent/prompts/YYYY-MM/<conversation>/history.md`; never mix AI output into raw history or capture unrelated conversations.
- Authorized bounded writes use concise audit evidence. Create a tracked task only for resume, handoff, or explicit tracking needs; v3 uses one `task.md`. Preserve legacy artifacts and history.
- `agm-prompt` creates V1 when an executable prompt is first finalized. Further immutable versions require a substantive requester-backed content revision. Explanation, comparison, acknowledgment, approval and unchanged retries create no version. No `requirements/` tree.
- Prompt Results remain one file per version under `.agrimap-agent/prompts/YYYY-MM/<conversation>/<context>-vNNN.md`, preserve valid prior requirements and explicitly state Main/Subagent ownership.
- SQL context access is read-only through sql-context-pack: metadata and bounded masked SELECT within the connected profile. Never execute database DDL/DML, EXEC/CALL, routine deployment or metadata writes, irrespective of model/depth. Authoring SQL files is a separate explicitly authorized action, not database execution.
- Edit canonical sources, then run the adapter generator. Do not manually diverge installed/generated copies.
- Verify changed behavior proportionally. Reuse matching evidence; do not rerun unrelated checks or create documentation merely to satisfy an obsolete file count.
