# Workflow lifecycle core — v3

First determine whether the current request concerns AgriMap. Quoted commands, cwd, model name and old task state alone do not activate a workflow. A direct answer, explanation, comparison, help or read-only review has no execution state, depth, requester question or task artifacts unless a durable deliverable/tracking was requested.

## Durable work
An adopted repository's explicit recording contract may require additional artifacts. In particular, the owner-supplied bootstrap AGENTS §9 requires portable terminal reports; follow that project contract without duplicating lifecycles. It does not change the skill-package defaults below.
Recommendations and passive design follow recommendations.md in every operation: give supported advice proactively; make insufficiency, assumptions, missing information and confidence visible. Advice alone never creates write authority, task artifacts or a prompt version.

Use existing requester authorization; never require a generated prompt merely to repeat approval.
- light: bounded authorized work; concise current/recent memory and milestone audit; no tasks.
- standard: actual resume/handoff/tracking need; one task.md holding scope, acceptance, progress, evidence and result.
- regulated: actual public/data/security boundary, independent assurance or external publication; same task record plus evidence required by that boundary.
Depth is derived from work, not model or file count. Record its reason. Model instruction profiles outcome/guided/bounded affect scaffolding only.
Use `agm-workspace.mjs start --operation <op> --session <id> --tracking --risk <reason>` where relevant. Read-only calls return started=false unless --persist/--tracking requests durable work. Never create empty task trees. Explicit init alone prepares project knowledge; --bootstrap installs project assets.

## Evidence and completion
Checkpoint only changed acceptance, decision, integration or verification outcomes. Keep raw submissions in prompts history, not memory. Model-authored facts, decisions and evidence are concise; runtime supplies metadata.
v3 tracked work uses task.md, not five mandatory documents. Separate analysis/QA/results only when an actual consumer needs them. Legacy five-file executions stay readable and can finish under their original contract.
Complete only after actual acceptance and proportional verification; artifact existence or a command exit code alone is not product success. Finalize recent memory, remove current state, archive tracked state. Reports are requested deliverables, not mandatory duplicates for every bounded edit. Never delete historical prompts/logs as migration.
