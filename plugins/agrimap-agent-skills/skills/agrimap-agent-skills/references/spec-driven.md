# Spec-driven work

Load when `context` reports `developmentMode` spec-first, or hybrid with changed files inside `specs.scopes`. In code-first projects, tests and code are the source of truth: do not edit specs or documents beyond the changelog/README the project AGENTS requires, and mention a contradiction you notice in one line.

## Mode

`.agrimap-agent/policy/project.json` holds the team's mode. When it is missing, run `project infer`: high confidence → `project init --inferred` and state the mode with its evidence in one plan line; otherwise put its card in the first question round, before any write. Record the answer with `decide record`.

## Locations

Use the spec paths returned by `context`; never search the disk. A missing external path is resolved by `context` from local memory, bounded discovery (persisted on `context --ack`) or a card. Committed files refer to external specs by id, never by an absolute path; `deliver` refuses a `LOCAL_PATH_LEAK`.

## Before writing

Read the spec entry and the items your request touches, not the whole pack. Name the task, requirement and acceptance IDs in your plan. Blocking open questions become an R2 card quoting the question.

- Request matches the spec: implement it.
- Request adds or changes behavior: update the spec items first in the same branch, then implement; report the change.
- Request contradicts the spec: R2 card (follow the request and update the spec, follow the spec, or clarify).
- Mechanical updates (task status, evidence, spec changelog, manifest) are yours. Semantic changes follow the current instruction; when implementation reveals a gap the instruction does not cover, ask with an R2 card. Judge by the work and the instruction, not by who owns the file.

## Standing instructions

An instruction about specs given once becomes the project rule: `project set specs.sync auto|off`, or a one-time R1 card asking whether it applies to every task. Never require the requester to repeat it.
