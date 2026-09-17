# Golden compliance checklists

One file per golden collection. Each file is the **MUST-tier extract** of its collection: the
structural rules an operation has to verify before a product write, with the golden entry that
owns each rule and the detection command that proves it.

Load the checklist that matches the detected target kind. It replaces "browse the whole
collection" as the default path — open a full golden entry only when the checklist points at it
or when a rule is disputed.

## Compliance tiers

These three tiers apply to every collection. They make [structure over
logic](../../backend-engineer.md#structure-over-logic-owner-stance-2026-07-16) checkable instead
of merely stated.

| Tier | Meaning | Deviation |
| --- | --- | --- |
| `MUST` | Structure, placement, naming, and public contract. Verify against the named golden entry before writing. | Not a taste question. A mismatch is a defect: fix it, or stop and report the conflict. |
| `SHOULD` | Idiom and shape inside a correct structure. | Allowed when an active contract, deployed compatibility, or neighbouring file requires it — record the reason in the receipt. |
| `FREE` | Internal logic inside a correctly placed layer: algorithm, validation body, local decomposition. | Apply best engineering judgment. Never demand a golden example, block, or escalate for a `FREE` choice. |

A `MUST` row is satisfied only by **opening the named entry**, not by recalling it. Report the
entries actually opened on the receipt `Patterns:` line per
[goal-rules.md](../../goal-rules.md#pre-write-gate) item 6.

## Precedence

These checklists do not replace [conflict-resolution.md](../conflict-resolution.md). When a `MUST`
row conflicts with deployed behaviour or an owner decision, that file's decision precedence wins
and the conflict is surfaced to the owner. Structural precedence is never permission to break a
deployed contract.

## Files

| Checklist | Target kind | Collection |
| --- | --- | --- |
| [frontend-main.md](frontend-main.md) | `fe-main` | `golden/frontend-main/` |
| [frontend-libraries.md](frontend-libraries.md) | `fe-library` | `golden/frontend-libraries/` |
| [backend-main.md](backend-main.md) | `be-main` (`agmws` and `agmbo`) | `golden/backend-main/` |
| [backend-libraries.md](backend-libraries.md) | `be-library` | `golden/backend-libraries/` |
| [sql.md](sql.md) | `sql-table`, `sql-procedure` | `golden/sql/` |
