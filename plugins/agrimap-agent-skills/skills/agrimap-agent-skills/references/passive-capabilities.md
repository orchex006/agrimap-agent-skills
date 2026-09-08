# Passive capability catalog — embedded supporting skills

`assets/passive-skill-map.json` routes embedded supporting skills: relevant knowledge and decisions applied to the active operation/action. They support both product-read-only and already-authorized product-write work but cannot choose/replace context, change mode/scope, or create write intent; action/requester contracts remain authoritative.

## Goal Rules

The mandatory `goal-rules` capability is owned by [goal-rules.md](goal-rules.md). Every mapped operation loads it before substantive reasoning or product writes.

## Design

- Design is passive, not a standalone agm-design command. Every remaining operation uses [recommendations.md](recommendations.md) for proactive, evidence-calibrated advice and visible uncertainty.
- Recommend when supported; otherwise name missing information, assumptions and limitations. Provide provisional guidance only with explicit conditions and confidence. This creates no implementation authority or additional workflow.

## Passive FE/BE/refactor test decision

- Activate test planning only for an actual executable change, an explicit test request, or a concrete regression risk. Ordinary analysis and documentation do not require a test classification artifact.
- For relevant changes, inspect the existing harness and affected boundaries; keep a concise decision in the current result, not another file.
- Select `required` for authorized changes to behavior, data, public contracts, regressions, multiple/failure branches, concurrency/security, or shared components with a test harness. Required tests stay within product-write scope.
- Select `recommended` for lower-risk testable work. Use the smallest useful in-scope check; ask only if a materially broader scope is needed.
- Select `not_applicable` only with a concrete reason such as documentation-only work or no executable behavior boundary.
- In read-only actions it may classify or recommend tests but never write them. In an authorized `edit`, it may require a regression test inside scope; edit authority—not the capability—authorizes that write.
- Explicit `action=test`, an unambiguous request to create tests, or a `required` decision inside an already-authorized product-write implementation grants test write intent. If behaviors are already named, create only those; otherwise create the smallest risk-complete set.
- Keep test naming, placement, framework, and public-contract expectations consistent with repository evidence.

## Refactor guard

- Activate only after explicit `action=refactor` or unambiguous refactor intent has selected `agm-fe`, `agm-be`, or `agm-sql`.
- Load [refactor-modes.md](refactor-modes.md), require exactly one mode, and record the logic-preservation boundary before editing.
- Infer a safe behavior-preserving mode when intent and scope are clear and state it briefly. Ask only when plausible modes materially change behavior or scope; do not present all five modes by default.
- This guard cannot initiate a refactor, convert read intent into write intent, or broaden file scope.

## SQL explain

- Remain product-read-only: do not execute database writes, edit files, format SQL, or create migrations. Managed metadata/SELECT follows [sql-context-readonly.md](sql-context-readonly.md).
- Explain purpose; inputs and outputs/result sets; objects read and written; joins, filters, and business rules; control flow; transactions; error/message behavior; deployment/idempotency; assumptions; risks; and relevant performance concerns.
- Label claims as `FACT` when directly supported by SQL/schema/callers, `INFERENCE` when derived, and `UNKNOWN` when evidence is missing.
- Prefer plain language or compact pseudocode. If modification is requested, route to `agm-sql action=edit`; explain itself never edits.
## External supporting capabilities

- SQL schema/metadata gaps: sql-context-pack via [sql-context-readonly.md](sql-context-readonly.md); never write authority.
- Bootstrap/branch/version/release requests: [release-and-bootstrap.md](release-and-bootstrap.md); quoted intents never execute.
- Capability choice requires relevant inputs, evidence output, effect boundary and fallback. Do not start another lifecycle merely to retrieve supporting knowledge.
