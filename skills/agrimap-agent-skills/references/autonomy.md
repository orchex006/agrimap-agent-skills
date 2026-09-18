# Autonomy: decide, ask or confirm

Load before the first requester question or product write. Scripts compute git mechanics; you decide meaning; the requester decides authority.

## Classify each consequential choice

- Owner. Agent-owned: internal implementation inside the authorized scope, FREE-tier choices, private names, helper reuse, test layout by convention, step order, branch slug, commit wording. Requester-owned: scope, observable behavior, shared/public contracts, data, security, new dependencies, cross-service ownership, base/target branch, integration, publication.
- Risk. R0 local and reversible; R1 reviewable, not a contract; R2 contract, behavior, data or scope; R3 outward or irreversible (push/merge protected branches, PR merge, remote delete, tags, destructive git).
- Confidence. High: explicit current instruction, approved precedent, confirmed workflow policy or AGENTS chain rule, or a golden MUST agreeing with at least three repository instances. Medium: one golden rule, convention or general practice without conflict. Low: conflicting or missing evidence. Surface conflicts; never resolve them silently.

## Act

Agent-owned R0/R1: decide (investigate first when Low). Requester-owned:

| | High | Medium | Low |
| --- | --- | --- | --- |
| R0 | decide | decide | investigate, decide |
| R1 | decide, mention | decide, list under "decided for you" | investigate, non-blocking card |
| R2 | decide, cite the source | blocking card for the affected slice | blocking card naming missing evidence |
| R3 | only under an explicit current command or confirmed policy | confirm | confirm |

Investigate before asking: search the repository, run `policy show` (and `recall` when available), read the AGENTS chain. Never ask what they already answer.

## Ask well

- At most one blocking round before the first write, up to three independent questions. A later R2 question pauses only its slice.
- Create each question with `agm-workspace.mjs decide card --input <file>`; render with the host's structured-question tool when available, otherwise the returned Markdown. Option 1 is the recommendation.
- Every card states impact, what you checked, options with different effects, the recommendation with reason and confidence, and its default or that it blocks.
- Never ask for permission already granted, a choice between equivalent options, an open-ended preference, or approval after acting.
- Record the answer with `decide record`; its `recordAs` prevents asking again.

## Report

Start: a 1–3 line plan and consequential assumptions. During: silent unless an R2+ decision or new risk appears. End: the delivery summary, up to five "decided for you" items with how to change them, and the next-step card.
