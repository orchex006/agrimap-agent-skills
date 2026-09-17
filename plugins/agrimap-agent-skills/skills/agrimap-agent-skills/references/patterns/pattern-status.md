# Pattern status

These authority statuses apply to catalog collections and entries. Conflict-matrix rows use the resolution statuses in [conflict-resolution.md](conflict-resolution.md). `missing-owner-example` has the same meaning in both places.

- `current`: maintained AgriMap guidance confirmed from a current standard, project, or owner set.
- `verified`: authoritative for the stated scope, but not necessarily the newest cross-project convention.
- `legacy-compatible`: retained because deployed code may follow it; after conflict resolution it outranks neighboring project structure only within its declared structural scope, never for unproven behavior/data semantics.
- `unverified`: useful evidence with unresolved correctness or placement concerns.
- `missing-owner-example`: do not establish a new shared convention from this skill.
- `mixed`: collection-only status; inspect every entry because authority differs within the collection.

Evidence mode is separate from authority:

- `curated-reference`: maintained guidance; update content and hash together when the owner changes it.
- `raw-immutable`: byte-for-byte source evidence; annotate defects outside the evidence.
- `mixed`: collection-only mode; inspect every entry.

Per-collection `MUST` rows live in [checklists/](checklists/README.md); this table remains the
authority source they route to.

## Current catalog

| Pattern | Status | Notes |
| --- | --- | --- |
| FE main architecture, generated API, and mandatory store/facade tests | `current` | Use `golden/frontend-main`; match the active Angular version and deployed contracts. |
| FE library public API, naming, generated API, Playground, and smoke-test baseline | `current` | Use `golden/frontend-libraries`; richer assertions and full semver rules remain decision-owner evidence gaps. |
| BE new boundary placement | `verified` | Map transport DTOs before inward repository ports; classify models by meaning. Do not silently migrate legacy code. |
| BE main/library C# programming templates NULL-01 through TOOL-01 | `current` | Owner-confirmed 2026-07-19 in `patterns/csharp.md`; governs new code and behavior-safe refactors even when no local example exists. Raw legacy files remain compatibility evidence. |
| BE main with `backend_profile=agmws` examples | `legacy-compatible` | Raw layer flow remains useful evidence; `patterns/csharp.md` now owns new port placement and route/response conventions. Project behavior and business/data semantics still require active evidence. |
| BE main with `backend_profile=agmbo` scheduler | `missing-owner-example` | Requires `Infrastructure/Jobs/JobScheduler.cs`, registration, retry, and concurrency examples. |
| BE library behavior, configuration, README-style usage, and Playground | `current` | Use `golden/backend-libraries`; the active package's published API and source remain authoritative. |
| BE main/library HTTP request-value normalization | `current` | Use `013-1-extensions-request-value-normalize.md`; verify the active `AgriMap.Platform.Extensions` package surface before migrating callers. |
| SQL collection | `mixed` | Read every entry's status in `golden/sql/manifest.json`; never infer data semantics from collection status. |
| SQL relationship/data semantics | `unverified` | Cascade, seed IDs, list input, indexing, and replace semantics require active-project evidence or owner decision. |
| BE unit-test scaffold and route-precedence matrix | `current` | Owner-approved target: xUnit + NSubstitute under `Tests/`; this is a target convention, not evidence that product repositories already contain tests. |
| BE integration tests and SQL tests | `missing-owner-example` | Read the target framework and neighboring tests; no broader owner-authored integration/SQL test template has been supplied. |
| BE shared analyzer/formatting tooling | `current` | Owner-approved target at the shared `services/` root; do not claim `.editorconfig`, `Directory.Build.props`, analyzers, or Jenkins format gates already exist until verified. |

Change authority only with owner approval or strong current-project evidence. Record the decision in `.agrimap-agent/decisions/` and the knowledge index. Coverage or maturity such as `90%+`/`near-complete` describes breadth, not authority.
