# Skill-package development and publication

<!-- AGM-MAINTAINER-ONLY -->

Maintainer-only source documentation. Apply only to an explicitly assigned task developing this repository, never to installed/cache usage, package installation or product releases. No runtime skill routes here. This document is excluded from installation artifacts.

## Branches and authority

| Branch | Purpose | Integration |
| --- | --- | --- |
| feature/*, fix/* | Scoped development from develop | PR into develop |
| develop | Next-version integration | Cut release/<base-version> when ready |
| release/<base-version> | Stabilization, optional <base-version>-rc.N packages | PR into main, then reconcile into develop |
| main | Reviewed stable source | Stable publication only at an explicitly selected, verified commit |
| hotfix/* | Urgent fix from main | PR into main, patch release, then reconcile into develop |

Use this same working directory. Inspect status, branch/upstream and fetch when synchronization is in scope; safely fast-forward the relevant branch before new work. Preserve all existing edits. Creating a development branch can carry same-scope uncommitted work without copying files. Do not stash/reset, auto-clone, create worktrees or commit unrelated changes to bypass a conflict. Diagnose concrete blockers in place.

An implementation request authorizes scoped local changes, not commits or external writes. A commit/push request covers its named development branch, not main, PR merge or publication. Explicit release approval can cover the complete named version/source/publication sequence without repeated questions. Never infer publication from a bump, successful tests or the word finish.

PR into main must originate from release/* or hotfix/* in this repository; PR into develop accepts feature/*, fix/* and release/hotfix synchronization. Review scope and verification; no blind conflict resolutions or history rewrites. Main/develop protection and required checks must also be configured on the server: Markdown alone cannot enforce them.

## Version lifecycle

Use package.json as the version authority; edit canonical files and run npm run sync. During development use Unreleased changelog notes; published previews require distinct prerelease numbers (for example 4.2.0-rc.1). Finalization changes to the approved version, removes its unreleased heading marker, regenerates and rechecks the exact final commit. A bump to 4.1.0 in a working branch does not claim that 4.1.0 is published.

Never alter a published version's tag or assets. Every release has a v<version> tag, exact source SHA, host-specific runtime archives, SHA256SUMS, release.json and release notes. Later fixes require a new version. Previews never become latest stable. Downloadability and ongoing maintenance are separate; keeping older artifacts does not promise indefinite backports or simultaneous installation in every host.

## Local verification and packaging

Run from the source repository, not from a cache:

```powershell
npm run sync
npm test
npm run test:release
npm run audit:tokens:strict
npm run package:build
```

package:build creates a fresh directory beneath ignored dist/ with one .tgz per host, catalog and checksums. It never deletes an earlier build, installs a plugin, creates a tag or publishes. Dirty builds are labelled local-preview with sourceDirty=true and are not releasable artifacts. tar and Node >=20 are required. The artifacts contain generated runtime data, not the source package's npm scripts.

config/distribution.json is the user-document allowlist shared by sync and packaging. tools/package-release.mjs excludes maintainer files, rejects symlinks and unexpected instruction files, preserves the exact product bootstrap AGENTS template, verifies host versions and keeps provider hooks separate. GitHub's automatic source archives and full Git clones are source distributions, NOT sanitized runtime artifacts: root AGENTS scope protection still matters there. Do not claim .gitignore or export-ignore controls Git clones.

## CI and publication

package-ci.yml checks PR branch routing, generated drift, package tests, release tests, token budgets and artifact construction on Windows/Linux. It has read-only permissions and never publishes. Configure its checks as required for main/develop.

package-release.yml is manual workflow_dispatch only. Select main for a stable release or release/<base-version> for an rc.N prerelease; supply the exact package version. It runs validation, rejects dirty/mismatched sources and existing version tags, then builds from that commit. Publication uses the package-release environment. Administrators must configure required reviewers and deployment branch restrictions before enabling publication; creating a workflow/environment name does not configure protection.

The publish job creates a draft GitHub release/tag targeting the verified SHA, uploads the archives/catalog/checksums, then publishes the draft. Stable latest promotion is an explicit input, disabled by default; use it only for the intended current stable version. A failed partial publication must be inspected and reconciled explicitly; do not delete/repoint tags, overwrite assets or rerun hoping to replace them. Source SHA and artifacts must remain paired. This workflow does not merge PRs or push source branches.

Server setup (separate authorized administration): require PRs/reviews and package CI for main/develop, prohibit force-push/deletion, protect v* tags against update/deletion, enable immutable releases where available, and restrict package-release environment to main and release/* with required reviewers. Until verified, report protection as not configured/unknown, not enforced.

## Previous versions and adoption

GitHub Releases is the version listing. Each new release's release.json maps that exact version/source SHA to host archives and SHA-256 values. Use the selected version's assets, not branch HEAD or the automatic source zip. See docs/VERSIONS.md for the consumer procedure; it contains no development rules.

For history before this pipeline, first prove the historical commit, manifest version and available artifacts. Do not fabricate old tags or rebuild today's source under yesterday's version. Backfilling historical tags/releases requires a separate approved mapping of versions to verified commits; record reconstructed artifacts honestly. On 2026-09-10 the read-only origin tag listing was empty; existing changelog entries alone do not establish installable tagged releases. No retrospective publication is performed by this migration.

Current adoption: preserve the existing uncommitted 3.7.0 work, create local develop from the existing main baseline and work on feature/package-development-4.1.0 in the same directory. The requested final source version is 4.1.0. Commit/push, PRs, protection setup and first publication remain separate actions.

Follow-up authorization on 2026-09-10: publish the prepared work on GitHub, show the latest documentation version and retain historical version tags. config/release-history.json records the 24 verified stable mappings for retrospective tagging, excluding the test prerelease and unpublished 3.7.0 draft. This publication request covers development/release PR integration and 4.1.0 publication, not bypassing checks or required reviewer approvals. Server protection setup remains a separate decision.

References: [SemVer](https://semver.org/), [GitHub workflow triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), [GitHub release create](https://cli.github.com/manual/gh_release_create).
