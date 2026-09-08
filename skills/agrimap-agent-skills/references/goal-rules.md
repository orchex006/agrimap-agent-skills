# Goal Rules — mandatory embedded supporting discipline

`assets/passive-skill-map.json` maps this embedded discipline to operations. It supports read or authorized write reasoning without choosing actions, expanding scope, or creating write intent.

## GR-1 — Think Before Coding

- Apply [recommendations.md](recommendations.md): proactively give supported recommendations; visibly identify missing information, assumptions, limitations and confidence. Unsupported material choices remain unresolved, not fabricated defaults.

- Resolve material intent, scope, write boundary, behavior/logic impact, and measurable completion before the first product write.
- Never invent material intent. Ask the requester when ambiguity could change logic, contract, data, target, files, authority, or acceptance.
- Present a materially simpler equivalent approach before writing when one exists.
- If evidence conflicts or reasoning becomes confused, stop the affected work and state the exact ambiguity or evidence required.
- Do not interrupt for cosmetic uncertainty or a choice that is provably equivalent inside the authorized boundary.

## GR-2 — Simplicity First

- Implement the smallest readable complete change for the current problem.
- Do not create future abstractions, options, compatibility layers, or generalized infrastructure without current acceptance evidence.
- Treat “200 lines reducible to 50” as a complexity signal, not a literal quota. Never perform a risky rewrite merely to reduce line count.

## GR-3 — Surgical Changes

- Change only authorized files, symbols, contracts, and behavior. Preserve repository style and unrelated requester changes.
- Report unrelated dead or deprecated code; do not delete it.
- Remove code only when the authorized change itself makes it unnecessary and the removal is inside the approved scope.

## GR-4 — Goal-Driven Execution

- Define observable acceptance and verification before product writes, then iterate until they pass or a genuine blocker is recorded.
- For a reproducible behavior defect with an existing harness, capture a failing regression test before the fix.
- Product-read-only, documentation-only, and non-executable work uses measurable evidence and may classify tests `not_applicable`.
- Embedded capabilities create no write intent; only the selected action and requester scope authorize tests or product files.

## Pre-write gate

Before a product write, be able to state all five items:

1. authorized objective and non-goals;
2. exact write boundary;
3. behavior/logic allowed to change and required to remain stable;
4. simplest complete approach and why a smaller one is insufficient;
5. observable acceptance and verification method.

If a material item is unresolved, stop before writing.
