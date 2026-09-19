# Spec-driven work

Load when `context` reports `developmentMode` spec-first, or hybrid with changed files inside `specs.scopes`. In code-first projects, tests and code are the source of truth: do not edit specs or documents beyond the changelog/README the project AGENTS requires, and mention a contradiction you notice in one line.

## Mode

`.agrimap-agent/policy/project.json` holds the team's mode. When it is missing, run `project infer`: high confidence → `project init --inferred` and state the mode with its evidence in one plan line; otherwise put its card in the first question round, before any write. Record the answer with `decide record`.

## Locations

Use the spec paths returned by `context`; never search the disk. A missing external path is resolved by `context` from local memory, bounded discovery (persisted on `context --ack`) or a card. Committed files refer to external specs by id, never by an absolute path; `deliver` refuses a `LOCAL_PATH_LEAK`.

## Before writing

Run `spec context --session <id> --query "<request>"` (or `--tasks <ids>`) and read every `readFirst` file (at most 8), not the whole pack. Name the task, requirement and acceptance IDs in your plan. Each `blockingQuestions` entry becomes an R2 card quoting the question; never guess its answer.

- Request matches the spec: implement it.
- Request adds or changes behavior: update the spec items first in the same branch, then implement; report the change.
- Request contradicts the spec: R2 card (follow the request and update the spec, follow the spec, or clarify).
- No spec covers new spec-first work: add a minimal requirement, acceptance criteria and task first; ask when acceptance cannot be made measurable.
- Mechanical updates (task status, evidence, spec changelog, manifest) are yours. Semantic changes follow the current instruction; when implementation reveals a gap the instruction does not cover, run `spec semantic --tasks <ids> --finding "<gap>"` for its R2 card. Judge by the work and the instruction, not by who owns the file.

## After verification

Run `spec sync plan --session <id>` (task IDs default to the `spec context` items; `--evidence ID=<repo-relative test or file>` per verified acceptance item; `--deviation "<text>"` for design differences), then `spec sync apply --plan-hash <hash>`. Status words follow the file; `STATUS_VALUE_NEW` and `STATUS_VALUE_UNKNOWN` are warnings, not stops. `deliver plan` returns `SPEC_NOT_SYNCED` for covered work until you sync or pass `--spec-na "<reason>"`; when sync is impossible (`ADAPTER_PARSE_FAILED`, missing file), deliver anyway and list each warning under ⚠️ with its fix. A pending semantic card yields `SPEC_DECISION_PENDING` while mechanical sync continues. Put the returned `specLine` in the delivery summary. A separate spec Git repository is delivered with `deliver plan --cwd <linked root>` and the summary lists both commits; a non-Git pack is updated locally only (`SPEC_SOURCE_NOT_GIT`).

## Standing instructions

An instruction about specs given once becomes the project rule: `project set specs.sync auto|off`. In code-first, a one-off "update the spec too" runs `spec sync plan --once`, then `spec standing --paths <changed>` asks once whether it applies to every task. Never require the requester to repeat it.
