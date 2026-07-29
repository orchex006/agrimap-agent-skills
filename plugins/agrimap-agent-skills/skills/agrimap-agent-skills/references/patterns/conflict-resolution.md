# Pattern conflict resolution

## สารบัญ

- [Decision precedence](#decision-precedence)
- [Statuses](#statuses)
- [Frontend main conflict matrix](#frontend-main-conflict-matrix)
- [Frontend libraries conflict matrix](#frontend-libraries-conflict-matrix)
- [Backend main conflict matrix](#backend-main-conflict-matrix)
- [SQL conflict matrix](#sql-conflict-matrix)
- [Copy-readiness gate](#copy-readiness-gate)
- [Owner tour backlog](#owner-tour-backlog)

Use this file before using any golden material. First read `golden/manifest.json` and the selected collection manifest:

- `evidenceMode=curated-reference`: maintained AgriMap guidance. Correct it together with its manifest hash when the owner updates the standard.
- `evidenceMode=raw-immutable`: source evidence retained byte-for-byte. Correct active code and the annotation; never edit the evidence to hide a source defect.
- `evidenceMode=mixed`: inspect the status and evidence mode on every manifest entry.

## Decision precedence

1. Owner-approved behavior for the current task.
2. Current project code, tests, schemas, callers, and deployed contracts as facts about behavior and compatibility.
3. A verified AgriMap pattern, normalized pattern contract, or golden entry marked `current` for structure, naming, types, comments, and artifact layout.
4. Annotated `legacy-compatible` or `unverified` golden evidence for its declared structural scope after applying this file's conflict matrix; documented defects and unproven business semantics never gain authority.
5. Neighboring project structure only where normalized guidance and all applicable golden structural evidence are silent.
6. General engineering practice.

When project structure conflicts with applicable golden structure after this conflict matrix is applied, use golden structure for new work because existing projects may contain mixed conventions. This includes matching legacy-compatible structural evidence, while behavior and data semantics remain governed by active contracts and owner decisions. Preserve active behavior/data compatibility and show material conflicts to the owner; structural precedence is not permission to break a deployed contract.

## Statuses

These resolution statuses apply to individual conflict-matrix rows. For catalog authority statuses, use [pattern-status.md](pattern-status.md). `missing-owner-example` is shared by both taxonomies with the same meaning.

- `resolved-defect`: a compile, name, format, or redundant-code defect; never reproduce it.
- `canonical-v1`: safe structural guidance for new work; preserve existing public contracts unless change is approved.
- `project-dependent`: inspect the active project and follow its proven convention.
- `owner-decision-required`: behavior, data, or logical semantics need an explicit owner choice.
- `missing-owner-example`: evidence is insufficient; collect the requested example before establishing a shared convention.

## Frontend main conflict matrix

The frontend-main collection was renumbered and de-duplicated on 2026-07-16 (see `golden/frontend-main/manifest.json`). Files carrying the old defects (`list` vs `items` mismatch, undeclared `konectApi`, placeholder symbols in `013-example.ts`/`026-1-2-rule.txt`, `items` vs `items()` mixing) were removed or superseded by content regenerated from `CODING-STANDARD.md`; those `resolved-defect` rows are retired. Remaining rows:

| Evidence | Conflict | Resolution | Status |
| --- | --- | --- | --- |
| `010-5-component-layout.md`, `014-9-domain-file-template.ts` | Snippets use example symbols (`ExampleFlowFacade`, `XxxStore`). | Treat as structural sketches only. Imports, providers, selectors, and class names must resolve in the target build. | `canonical-v1` |
| `010-5-component-layout.md`, `013-8-naming-patterns.md` | Signal `input()`/`output()` may compete with decorator-based project code. | Follow the Angular version and neighboring component convention. Do not migrate syntax inside an unrelated task. | `project-dependent` |
| `017-10-assets-management.md` | Static image path depends on asset/build configuration (`baseHref`/`$base-path` per env). | Resolve through the active workspace asset and base-path convention. | `project-dependent` |
| `002-2-architecture-rules.md` (R1–R5) | Prose forbids component subscriptions/API access and store async work. | Keep stores synchronous and pure. Put feature orchestration in the facade when shared state/flow warrants it. A trivial local view may use the local service pattern with lifecycle safety when a facade/store adds no value. | `canonical-v1` |
| `018-11-generated-api-contract.md` | Anything hand-written under `generated-apis/`, or an API client/DTO created by hand in `domain/`. | API contract is produced only by `npm run gen-api:api` from swagger. Never hand-edit generated files or invent API clients/DTOs; add the endpoint to swagger or `services.api.json` and regenerate. | `canonical-v1` |
| `019-12-testing-conventions.md` | App has 85 component smoke tests and zero facade/store/service tests; logic layers are untested. | Newly established (2026-07-16): store mutators and facade use cases MUST have tests (levels 2–3). App uses Karma+Jasmine with `fixture.detectChanges()` (not the library's `whenStable()`). Assertion depth beyond the mandated success/error cases stays owner-extensible. | `canonical-v1` |

The AgriMap baseline remains `Feature UI -> Facade -> Signal Store and/or Generated API`, but it is a complexity-shaped pattern, not a requirement to create every layer for every component.

## Frontend libraries conflict matrix

Applies to the `@agrimap/*` workspace (`golden/frontend-libraries`). The overriding rule here is the **published contract**: anything re-exported from a library's `public-api.ts` is frozen — refactor internals freely, but changing a public symbol is a breaking change that requires a version bump and a fix to every consumer (see `003-3-public-api-contract.md`).

| Evidence | Conflict | Resolution | Status |
| --- | --- | --- | --- |
| `005-5-naming-in-libraries.md` | Library naming (no-suffix `TextBox`, `text-box.ts`) differs from frontend-main (`TextBoxComponent`, `text-box.component.ts`). | Use the library convention inside a library; use the app convention inside the app. Do not port one into the other. | `project-dependent` |
| `005-5-naming-in-libraries.md` | Legacy inconsistency inside libraries: `import-layer.facade.store.ts`, `menu-app.component.ts` suffix, `.css` vs `.scss`, mixed semicolon style. | New code follows the standard (`xxx.store.ts`, no `.component` suffix, `.scss`). Do not mass-rename legacy — files exported via `public-api.ts` cannot be renamed without a breaking bump. | `resolved-defect` |
| `009-9-ui-kit-form-control-pattern.ts` | ui-kit form-control outputs use native-event names (`input`/`change`/`focus`/`blur`), conflicting with app N4 (no `on` prefix, past tense). | Keep as-is; these are public API of ui-kit. Do not imitate in app components and do not rename in libraries. | `project-dependent` |
| `002-2-library-catalog-dependency-graph.md` | `auth-client` pins `@agrimap/ui-kit` at exact `0.0.75`; others use `*`/`^`. | When bumping `ui-kit`, update this exact pin in `auth-client/package.json` too. Verify with a grep across all `package.json` before publishing. | `owner-decision-required` |
| `006-6-facade-patterns-in-library.md` | Baseline says `UI → Facade → Store`, but most libraries (ui-kit, map-core, auth-client) have no facade. | Owner decision 2026-07-16: **Angular service-first is the accepted library architecture** — new library behavior uses services and presentational components. The existing facade+signal islands (`dynamic-lut`, `agrimap-component` request/import-layer domains, `dynamic-dashboard`) stay exactly as they are: never migrate them to services, never use them as precedent to add facades elsewhere in libraries. A library-wide move to Facade + Signal is a future owner-initiated refactor only. | `canonical-v1` |
| `004-4-versioning-publish-workflow.md` | Full semver (minor/major) rules are not yet agreed by the team. | Interim: dev bumps patch on `0.0.N`, prod on `1.0.N`. Do not introduce minor/major jumps until the team ratifies a scheme. | `owner-decision-required` |
| `012-11-testing-conventions.ts` | Only smoke tests (`should create`) exist; deeper assertion patterns are unestablished. | Baseline is `TestBed` + `await fixture.whenStable()`. Establishing richer assertion conventions is an owner decision. | `missing-owner-example` |

## Backend main conflict matrix

| Evidence | Conflict | Resolution | Status |
| --- | --- | --- | --- |
| `002-1-presentation-controller-examples.cs`, `003-1-presentation-controller-examples.cs` | Duplicate import and duplicate placeholder method signatures. | Remove duplicate imports in real code; never copy mutually exclusive template variants into one class. | `resolved-defect` |
| `007-*` through `010-*` | Task-returning method names mix suffix and non-suffix forms. | Owner decision 2026-07-19: every new or refactored `Task`-returning method uses the `Async` suffix across interface, implementation, and caller. Preserve an existing public name only when compatibility is outside the approved scope. | `canonical-v1` |
| `009-4-1-repository-interface.cs` | Repository port is under Infrastructure and consumes Presentation DTOs. | Owner decision 2026-07-19: new repository interfaces live under `Infrastructure/Persistence/Interfaces`, implementations under `Infrastructure/Persistence/Repositories`, and MongoDB/ORM models only under `Infrastructure/Persistence/Models`. Map Presentation DTOs before the port and do not silently relocate legacy public types during a feature fix. | `canonical-v1` |
| `017-5-domain-example.cs` | A model labeled Domain contains external uppercase JSON field mappings. | Classify by meaning: invariant/business concept belongs inward; procedure/external projection belongs in Infrastructure and maps inward. This example is unclassified until the owner tour. | `missing-owner-example` |
| `010-4-2-repository-implementation.cs` | Incomplete surrounding declarations and redundant `await Task.FromResult(...)`. | Supply real dependencies from the target class and return an already-computed value directly. | `resolved-defect` |
| `024-*` through `028-*` | Files use `.json` but contain comments/placeholders/multiple illustrative roots. | Treat them as response-shape notes, never JSON fixtures or parser inputs. | `resolved-defect` |
| Controller examples | Route styles and response envelopes differ. | Owner decision 2026-07-19: new actions return response DTOs directly, declare `[ProducesResponseType]`, propagate `CancellationToken`, use kebab-case controller routes and explicit snake_case wire names, and let `GlobalExceptionMiddleware` map `AppException`. Preserve deployed endpoints unless migration is explicitly scoped. | `canonical-v1` |
| Raw backend examples vs `patterns/csharp.md` owner templates NULL-01 through TOOL-01 | Legacy files contain null-forgiving suppression, body/sentinel identity precedence, direct claims and hardcoded identity, sync-over-async, swallowed exceptions, unstructured logging, transient use cases/repositories, and missing target tests/tooling. | Owner decision 2026-07-19: the maintained C# baseline governs new code and behavior-safe touched-line refactors. Raw files remain immutable compatibility evidence and never override these rules; material behavior/public-contract migration still requires explicit scope. | `canonical-v1` |

## SQL conflict matrix

| Evidence | Conflict | Resolution | Status |
| --- | --- | --- | --- |
| `patterns/sql.md` normalized DDL contract vs raw SSMS-export surface details (`USE [AgriMapDB]`, bracketed lowercase types, repeated generated options) | Raw entries retain tool-export noise while new work needs one stable structure. | Use the normalized golden contract in `sql.md` for every new script. Reuse matching `current` golden object/comment/section shapes only where they do not conflict with the normalized contract. Never let a neighboring project's mixed structure override it and never mass-rewrite unrelated legacy scripts. | `canonical-v1` |
| `NOTIFICATION_*.sql` | Unnamed defaults and section naming may differ from the normalized golden contract. | Do not copy those legacy differences into new work. New scripts follow the normalized golden section order and always name defaults (`DF_`); do not normalize unrelated existing scripts. | `resolved-defect` |
| `CONTENT.sql` (`[ID] INT` on a non-lookup table) vs `UM_USER`/`APP_USER_TOKEN` (`NUMERIC(38, 0)`) | Surrogate ID types are mixed in golden evidence. | Owner decision 2026-07-16: `[ID]` is `NUMERIC(38, 0)` for main/transaction tables and `INT` only for `LUT_*` lookup tables; no other ID type is allowed, and FK columns must match the referenced ID type exactly. `CONTENT.sql` is legacy — do not imitate, and never retype an existing table's ID without an owner decision. | `canonical-v1` |
| New `LUT_*` and general tables | Project copies use mixed lookup display columns and audit field types. | New lookup tables use `[ID] INT` and `[NAME] NVARCHAR(255)`. New general tables use `[ID] NUMERIC(38, 0)`. New business tables include `DATE_CREATED/DATE_MODIFIED` as `DATETIME2(7)`, `USER_CREATED/USER_MODIFIED` as `NUMERIC(38, 0)`, and `DEL_FLAG BIT`; `LUT_APP_MESSAGES` is the fixed registry exception. | `canonical-v1` |
| SQL task produces multiple tables/procedures/messages | Some projects group deployment SQL into one large file. | New output uses one table or procedure per file under `sql/<GROUP_OR_DOMAIN>/table|procedure/`; domain message inserts live only in `sql/<GROUP_OR_DOMAIN>/messages.sql`. `sql-table-and-procedure` describes scope, not bundling. | `canonical-v1` |
| Raw stored-procedure evidence uses standalone `CREATE PROCEDURE` or `ALTER PROCEDURE` | Captured scripts are not rerunnable across both initial deployment and later edits without choosing a different declaration. | Preserve raw-immutable evidence bytes, but every created or edited procedure output must normalize its declaration to `CREATE OR ALTER PROCEDURE`; never copy the standalone declaration from a golden or neighboring project. | `canonical-v1` |
| Stored procedure naming | Projects contain ad hoc procedure verbs and suffixes. | Use `_I` insert, `_U` update, `_D` delete, `_Q` query, and `_CHECK_Q` validation query. The object name and uppercase filename stem must match. | `canonical-v1` |
| `NOTIFICATION_CONTENT.sql` | A unique key on `(MESSAGE_ID, CHANNEL_ID)` is paired with a same-key non-unique index. | Do not reproduce a duplicate index unless included columns/order/filter or measured workload proves a separate purpose. | `resolved-defect` |
| `NOTIFICATION_*.sql` | Foreign keys mix `CASCADE` and `NO ACTION`. | Cascade behavior is relationship semantics, not style. Require schema/caller evidence and owner decision before changing it. | `owner-decision-required` |
| `LUT_NOTI_CHANNEL.sql` | Fixed identity seed values are deployment and ownership assumptions. | Confirm stable IDs, rerun/idempotency behavior, and environment ownership before seeding. | `owner-decision-required` |
| `FILE_STORAGE_I.sql`, `UM_USER_I.sql`, `UM_USER_U.sql`, `NOTIFICATION_USERS_Q.sql` | Custom splitter, `STRING_SPLIT`, and cursors coexist. | Choose from database version, input contract, order requirements, volume, and measured plan. Do not promote one technique globally yet. | `project-dependent` |
| `UM_USER_U.sql` | Update deletes and recreates all roles/permissions. | Treat as explicit replace semantics. Never infer it for a generic update or refactor; owner approval and regression cases are required. | `owner-decision-required` |
| `UM_USER_I.sql`, `UM_USER_U.sql`, `UM_USER_D.sql`, legacy `messages.txt` evidence | Role restrictions and message codes encode business policy. | Preserve the role/message meaning as project behavior, but do not copy the legacy message filename or layout into new artifacts. | `owner-decision-required` |
| Message artifacts across active projects | Dictionary tables, filenames, columns, and deployment shapes differ. | Use the AgriMap registry `[agrimap_app].[LUT_APP_MESSAGES] ([ID], [DESCR])` and the exact domain filename `messages.sql`. Guard every insert with `IF NOT EXISTS` on the same ID so the script is rerunnable. | `canonical-v1` |
| Same error code with different or ambiguous meanings | Reusing the key can show users the wrong message or overwrite another module's contract. | Stop that entry and obtain an owner decision; never silently replace the existing meaning. | `owner-decision-required` |

## Copy-readiness gate

For a `current` curated reference, record the target kind, active framework/package version, published or deployed contracts checked, applicable known issues, and verification path. For raw immutable or legacy-compatible evidence, also record:

- the target project evidence it matches;
- every conflict row that applies;
- corrected symbols/contracts in the execution plan;
- compile/parse/build and behavior verification appropriate to the target.

If the required match cannot be established, use that golden entry for discussion only. Do not downgrade an entire `current` collection because one entry has a documented exception.

## Owner tour backlog

Confirm these before promoting more patterns:

- FE main: assertion depth beyond the mandated store/facade success+error tests (section 12) — the generated API boundary (section 11) and store/facade/provider wiring are now documented;
- FE library: full semver rules (minor/major triggers) and richer unit-test assertion conventions — remaining open items now that `golden/frontend-libraries` documents public API, facade usage, generated API, and consumer wiring;
- BE main: repository-port location, Presentation-to-Application mapping, Domain versus persistence model examples, route/response conventions;
- BE library: README and Playground conventions;
- BE main with `backend_profile=agmbo`: `Infrastructure/Jobs/JobScheduler.cs` and registration/retry behavior;
- SQL: default constraint naming, cascade policy, index review, seed deployment, list-input convention, and update-versus-replace semantics;
- BE main, BE library, and SQL: representative unit/integration-test conventions. FE-main mandatory store/facade tests and the FE-library smoke-test baseline are already documented.
