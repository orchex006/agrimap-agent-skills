# Nine deterministic release command sequences

## State resolved by the Agent

Before writes, resolve one exact command from the table below and record a compact checkpoint in the target's existing project index/recording mechanism. Do not introduce a second lifecycle. Record command, target root/remote, authorized paths, baseline HEAD, baseline owner versions, selected owners, candidate versions, candidate SHA when known, completed steps, pending steps and confirmation scope. Unknown candidate SHA stays pending until Git supplies it; never invent one.

Use distinct names: inhouseBaselineVersion, inhouseCandidateVersion, productionBaselineVersion, productionCandidateVersion, releaseCandidateSha and finalDevelopSha. Before freezing the release commit, evidence can reference an existing source-content SHA; after commit record the actual releaseCandidateSha in the checkpoint. Never amend endlessly to make a commit contain its own SHA. A notes Source candidate field must follow the verified target schema and truthfully identify its source; it must not be fabricated to satisfy a regex.

On resume, compare the recorded command, versions, notes and Git state. A matching candidate resumes the next missing step. A missing checkpoint requires reconstruction from actual diffs/history; uncertain provenance requires clarification, not another PATCH bump. A different unfinished mode is not automatically inherited or converted. Full may internally prepare both owners; no other command may broaden to both.

## Ownership that every step checks

| Data/artifact | Sole owner or rule |
| --- | --- |
| Inhouse version pair | Jenkinsfile: IMAGE_TAG and PROJECT_VERSION, equal values |
| Production version pair | Jenkinsfile_Production: IMAGE_TAG and PROJECT_VERSION, equal values |
| Version calculation | PATCH+1 of that owner's proven baseline, once per candidate; 1.2.9 becomes 1.2.10 |
| Versioned notes | release-notes/<productionCandidateVersion>.md only |
| Release index | release.md describes/links the Production release; never keyed by Inhouse version |
| Annotated tag | v<productionCandidateVersion>, referencing verified Production SHA |
| Inhouse-only history | changelog.md and .agrimap-agent/memory/project.md; no versioned notes or release index changes |

For Production-only commands, the Inhouse owner must be unchanged by the run. For Inhouse-only commands, the Production owner, release.md and existing versioned notes must be unchanged by the run. Check both staged and unstaged diff against the captured baseline, not merely the last commit. Existing unrelated edits are inventoried and preserved; they are not permission to publish them. Never create/delete a historical notes file merely because its filename equals an Inhouse number: provenance and Production history determine ownership, not numeric coincidence.

Example: candidate Inhouse 1.0.6 and Production 1.0.3 means notes release-notes/1.0.3.md and tag v1.0.3. Do not create release-notes/1.0.6.md from Inhouse. If both numbers happen to match, create one Production-owned file, not an environment-ambiguous shared release.

## Shared steps

- R — Read target instructions, resolve intent and baseline, detect tools using release-tools.md, and construct the exact required-step list. Read-only help creates no state. If instructions disagree, use host/user authority and identify any remaining conflict rather than combining contracts silently.
- I — Run audit diff-only, inspect actual source and committed/staged/unstaged/untracked/deleted coverage, reconcile English newest-first changelog and canonical project index. Every scoped change has an entry or justified exclusion. No versioned notes, bump, commit, push or tag in indexing alone.
- H — On develop, calculate or resume Inhouse candidate, modify only its owner pair, reconcile index/changelog, verify owner diff and unchanged Production artifacts. No release.md or versioned notes creation. Check CLI compatibility before calling any mutating helper.
- P — On develop, calculate or resume Production candidate, modify only its owner pair, create/reconcile Production notes and release.md, fill actual change/verification evidence, and verify unchanged Inhouse owner except H explicitly authorized inside full. Planned tag identity in notes is metadata, not creation/publication of a Git tag. Prepare must not require a real tag to exist.
- V — Verify selected owner pairs, allowed diffs, artifact provenance, notes completeness where Production is selected, and git diff --check. Use compatible CLI gates plus actual evidence; a helper exit 0 alone is insufficient. Preserve exact failure output. Inhouse V must not require Production notes/tag. Production/full V requires Production notes but no existing/pushed tag.
- D — Review exact publication paths, separate existing content commit from version metadata commit where applicable, commit the prepared candidate once, record releaseCandidateSha, push develop and verify its remote SHA. Never blanket-stage, stash away unknown work or force-push. Missing prepare is a prerequisite failure, not permission for pipeline to bump.
- J — Fetch/check ancestry, fast-forward jenkins to releaseCandidateSha, push and verify exact remote SHA. Already verified identical checkpoint is reused. Production transit through jenkins never grants an Inhouse bump. Do not wait for a green Jenkins pipeline or call its API.
- Q — Check Production fast-forward feasibility and tag collision, verify candidate notes blob, and prepare human-readable summary of changes, Production version and planned tag plus internally resolved SHAs. No jenkins-release mutation or tag creation yet.
- C — Present the concrete Q plan and ask whether to publish Production and its annotated tag, explaining that confirmation is required by the requester's release contract. The human does not calculate SHAs or run commands. Wait for actual confirmation; invocation of promote/full/production is not confirmation. Revalidate afterward; materially changed candidate/destination/tag requires a new plan and answer.
- T — After C, fast-forward/push jenkins-release from the exact verified J SHA, verify remote equality, create Production annotated tag with --cleanup=verbatim using the notes blob at that SHA, compare full annotation and peeled SHA, push tag, verify remote tag object and peeled SHA. Only CRLF/LF normalization is allowed for annotation equality. Never move/overwrite a tag. No GitLab Release object or server rollout implied.
- F — Update target-required logs/index/memory/report with actual checkpoints. Local-only commands retain local artifacts. After publication, commit/push only reviewed final audit artifacts to develop when authorized and required by the target, verify finalDevelopSha, and never promote/tag that audit commit or bump again. If the target requires a report, runtime light completion without a report is not enough. List remaining_steps; mark completed only when every required step has evidence.

## Exact command expansion and completion

| Exact Agent arguments | Required sequence | Prerequisite and finish evidence |
| --- | --- | --- |
| indexing | R → I → F | Covered index/changelog and local diff check; no publication |
| prepare inhouse | R → I if stale → H → V → F | Local Inhouse candidate; Production owner/notes/index unchanged by run; no commit/push/tag |
| prepare production | R → I if stale → P → V → F | Local Production candidate and its notes; Inhouse unchanged; no commit/push/tag |
| pipeline inhouse | R → V → D → J → F | Existing prepared Inhouse candidate; develop and jenkins remote checkpoints; no Production/tag |
| pipeline production | R → V → D → J → Q → F | Existing prepared Production candidate; develop/jenkins verified; no jenkins-release mutation/tag |
| promote | R → V → check recorded D/J → Q → C → T → F | Existing Production-ready candidate; confirmed Production/tag remote checkpoints |
| release full | R → I → H → P → V → D → J → Q → C → T → F | Both owner candidates prepared independently, one Production notes file, one frozen SHA reused across branches, Production tag |
| release production | R → I → P → V → D → J → Q → C → T → F | Production owner only; Inhouse version unchanged despite J transit; Production tag |
| release inhouse | R → I → H → V → D → J → F | Inhouse owner only; no Production notes/release.md/tag writes |

Standalone pipeline/promote never performs missing H/P implicitly. Inspect and explain the exact prerequisite and supported next command; do not choose both or restart the entire release. Composite commands perform all missing authorized steps without repeatedly asking to continue. Full's pipeline inhouse and pipeline production share D/J, so execute them once, then Q; do not run two independent releases.

## Recovery and terminal communication

For failed detection, inspect package/shim/runtime before installation. For verify failure, distinguish schema metadata from Git tag existence and repair only proven, authorized content. For accidental run-owned wrong notes or owner writes, preserve baseline evidence and undo only that run's exact erroneous changes before retry; never delete pre-existing or published artifacts. For an actual CLI contract mismatch, follow release-tools.md without weakening a gate or silently broadening scope.

On branch failure retain successful remote checkpoints; on tag failure retain Production SHA and resume the tag checkpoint without H/P/D/J. On resume, unchanged successful checkpoints need no duplicate writes. A later promote attempt presents remaining outward actions for confirmation. Real access, divergence, conflicting ownership or incompatible mandatory CLI can be blocked, but only after supported autonomous recovery is exhausted.

Final response says selected command, Inhouse/Production versions, notes path or not applicable, verified branch/tag checkpoints, final audit status and remaining_steps. Pending confirmation is pending; local prepared is not deployed; branch push is not a green pipeline or server rollout. Never end with installation instructions for a human when the Agent can perform the authorized installation itself.
