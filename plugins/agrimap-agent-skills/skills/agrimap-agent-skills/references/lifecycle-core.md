# Workflow lifecycle core — v3

Check whether this request concerns AgriMap. Quoted commands, cwd, model name and old task state alone do not activate a workflow. A direct answer, explanation, comparison, help or read-only review has no execution state, depth, requester question or task artifacts unless a durable deliverable/tracking was requested.

## Durable work

Reuse a conversation/host-confirmed requester via `--requested-by` on start/identify; missing runtime state does not invalidate confirmation. Otherwise inspect `agm-workspace.mjs requester --cwd <project> --session <id>` read-only: hooks/runtime share valid session/local-user recovery. Never infer identity from Git/OS authorship or copied audit history. Reject expired/revoked/foreign/ambiguous records; ask once only when confirmation remains missing/conflicting. Persistent confirmation needs no daily renewal. Identity grants no publication authority.

For adopted product repositories before durable work, compare the installed AGENTS.md bootstrap version marker/receipt to the active skill manifest. Missing or different versions require reconciliation within this invocation using release-and-bootstrap.md and project-bootstrap.mjs; automatically update recognized unmodified templates with backups, preserve custom project rules through a scoped merge, then verify freshness. For release, check branch freshness before bootstrap writes. No product bootstrap in the skill-package root or for ordinary questions.
Follow explicit project recording requirements, including bootstrap AGENTS §9 portable terminal reports, without duplicate lifecycles or changing skill-package defaults.
Follow recommendations.md in every operation: proactively give supported advice with gaps, assumptions and confidence. Advice grants no write authority, task artifacts or prompt version.

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
