# Compact operation entrypoint: agm-sql

<!-- Generated from config/operations.json. Do not edit directly. -->

- Operation: `sql`
- Workflow depth: default `light`; allowed `light`, `standard`, `regulated`
- Mode: `action-routed`
- Purpose: Analyze, design, create, edit, refactor, or explain SQL work through one domain façade.
- Deliverable: action-specific SQL analysis, design, explanation, or bounded SQL implementation

## Action gate

Resolve exactly one action before target inspection or product writes. Safe defaults are read-only; fallback is action routing, not a passive capability. Capabilities support the chosen read or authorized write but cannot choose it or create write intent.

| Action | Mode | Activation | Allowed depth | Purpose |
| --- | --- | --- | --- | --- |
| `analyze` | `product-read-only` | `explicit-or-safe-default` | `light`, `standard`, `regulated` | Inspect SQL scope, schema, callers, contracts, risks, and trade-offs without editing |
| `design` | `product-read-only` | `explicit-or-safe-default` | `light`, `standard`, `regulated` | Define SQL objects, data flow, result and error contracts, deployment, and acceptance without editing |
| `create` | `product-write` | `explicit` | `light` | Create a bounded new SQL object or slice |
| `edit` | `product-write` | `explicit` | `light` | Modify a bounded existing SQL object or slice |
| `refactor` | `product-write` | `explicit` | `light`, `standard`, `regulated` | Refactor SQL under exactly one behavior mode while preserving declared results, transactions, side effects, errors, and deployment behavior |
| `explain` | `product-read-only` | `explicit-or-safe-default` | `light`, `standard`, `regulated` | Explain SQL purpose, contracts, reads/writes, flow, transactions, errors, assumptions, and risks without execution or edits |

## Inputs and help

- Required: one action or unambiguous natural-language intent; an objective or pointed SQL target.
- Conditional: target_kind when table/procedure placement cannot be resolved; output_owner=product|owner-reference|knowledge-draft for new SQL; an exact existing SQL target for edit/refactor; owner evidence for persisted-data, reference promotion, or contract decisions.
- Minimal example: `$agm-sql action=explain target_files=sql/ORDER/ORDER_Q.sql`

## Execute this contract

1. Resolve exactly one action before inspection. Explicit action= wins; otherwise infer only from unambiguous verbs and report the resolved action. Ask one short question when create, edit, refactor, or read versus write remains ambiguous.
2. For analyze/design/explain, never execute SQL, connect to a database, or edit product files. Explain uses FACT, INFERENCE, and UNKNOWN and routes requested modifications to edit.
3. Edit/refactor requires an exact existing target; otherwise stop SQL_EDIT_TARGET_NOT_FOUND. Never switch to create; preserve the existing path unless migration is authorized.
4. Create requires output_owner=product|owner-reference|knowledge-draft; otherwise stop SQL_OUTPUT_OWNER_REQUIRED. The absence of a directory is never create authority.
5. Skill-package meta work never authorizes root product SQL; fixtures/examples require an explicit package-owned path.
6. For create/edit, show the bounded slice, stay within light limits, load applicable schema/caller evidence, and route broader work to agm-prompt before any product write.
7. For action=refactor, require exactly one mode before editing; when ambiguous, stop and show all five modes with one recommendation. Preserve result sets, transactions, side effects, error mapping, and deployment idempotency unless recorded authority and the selected mode explicitly allow a change, then format and validate every declared changed SQL path.

## Load now

- [goal-rules.md](../goal-rules.md) — mandatory Think/Simplicity/Surgical/Goal-Driven discipline
- [passive-capabilities.md](../passive-capabilities.md) — embedded design/explanation boundaries
- [elicitation.md](../elicitation.md) — action and scope resolution
- [patterns/sql.md](../patterns/sql.md) — current SQL contract, formatting, and validation

## Load only when the condition matches

- When action=refactor: [refactor-modes.md](../refactor-modes.md) — exact refactor behavior and logic-change boundary
- When any table, view, or procedure outside the edited file is read, joined, or written: [db-schema-context.md](../db-schema-context.md) — owner DDL evidence for every referenced object

Do not read the router `SKILL.md` during operation execution. If this generated entrypoint is missing or corrupt, stop with `PACKAGE_ENTRYPOINT_MISSING` and ask for package sync/reinstallation; never broaden into the router.
