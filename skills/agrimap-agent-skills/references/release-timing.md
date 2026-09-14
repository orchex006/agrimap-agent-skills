# Release timing and complete audit publication

Apply to all nine release actions, including --flash, identically across models. Bootstrap may use timing without publication authority. Help/quoted examples start no timer.

## Two durations

At executable release intent, before requester lookup, run `node <bundle>/scripts/release-timing.mjs <action> <state.json> [label]`. Use one absolute, ignored state path per invocation under `.agrimap-agent/runtime/release-timing/`; verify ignore status or use a host-local directory outside the repository. Timer state needs no identity/task/history and is never staged. These are bundled helper verbs, not .NET CLI options. Serialize transitions:

| Action and label | Boundary |
| --- | --- |
| `start readiness` | Start once; existing state is rejected |
| `step <label>` | Close previous interval, start named work |
| `wait requester` / `wait confirmation` | Before asking/yielding for human input; also label other human waits |
| `step <label>` | Resume on actual answer processing; matching approval creates no wait |
| `pause interrupted` | Stop active measurement for unattended/unknown gaps |
| `finish` | After final audit push, remote verification and worktree check; local actions after local verification |
| `report` | Read-only totals; pending confirmation remains unfinished |

Label actual steps: readiness, indexing, hash, changelog, preparation, verification, commit-push-inhouse, commit-push-production, tag, final-audit. Split hash/changelog from indexing and tag from Production publication if reported separately. Tool execution, builds, network and retries count as active. When independent work continues during a pending question, keep measuring that work; wait begins only when work stops. Concurrent work counts once in one interval, never summed overlapping tool/subagent durations. Reused checkpoints count only actual recheck time.

Report **Elapsed** = start to finish, including human waits; **Active** = sum of measured non-overlapping step intervals. Show excluded human wait and per-step minutes/seconds; sum milliseconds before rounding. Example: indexing 3 + hash 5 + changelog 1 + Inhouse 1 + Production 2 + tag 1 = Active 13 min; with 7 min waiting, Elapsed 20 min assuming no other work. Include readiness/verification/final-audit when performed.

Resume the same timeline. Known interruptions use pause. Late collection, crashes during active intervals or missing timestamps require an explicit partial/unknown result, not the uncorrected helper total or fabricated boundaries. Elapsed = active + human wait + unmeasured; the helper flags unmeasured gaps. This is execution wall time, not model CPU time.

## No leftover release history

Publishing actions include reviewed release-owned history/final audit in their existing commit/push scope by default; target silence needs no additional approval. Explicit user/target exclusions remain effective. Local-only indexing/prepare gain no commit authority.

1. **R inventory:** inspect staged/unstaged/untracked/deleted paths, explicitly including `.agrimap-agent/prompts/**/history.md`, logs, memory and required reports. Classify current/prior release-owned content, unrelated work and restricted/ignored files. Relevant release requests and requester/confirmation answers are eligible; today's date or folder prefix alone proves no ownership. Never publish unrelated conversations, secrets or ignored runtime. For mixed files, stage only reviewed attributable hunks or report the unresolved boundary.
2. **D candidate:** flush eligible recording, refresh status/diff, stage exact reviewed paths/hunks and inspect staged diff. Include eligible existing history. Never blanket-stage (`git add .`/`git add -A`), force-add ignored state or omit history merely because it is not source code.
3. **F final audit:** after confirmation/publication, inventory again because capture hooks may append history after D. Flush completion recording; batch remaining eligible history/log/index/report into one develop-only audit commit/push unless explicitly restricted. Verify finalDevelopSha remotely. Preserve releaseCandidateSha/tag: never promote audit to jenkins/jenkins-release, retag, amend candidate or bump. Inhouse also performs F.
4. **Final status:** verify tracked and untracked leftovers. Reconcile late eligible hook writes in the same authorized finalization; persistent writers mean pending, not an endless loop. Report unrelated/ignored/restricted exclusions with reasons. Never claim completed with eligible audit leftovers. Failed audit push resumes F only; failed tag resumes tag then F.
5. **Avoid audit loops:** tracked audit stores known release checkpoints and a timing snapshot labelled through pre-audit publication. Put final audit SHA and finished timing in terminal/ignored state after verification; do not append tracked records just to embed their own commit SHA/duration. Flush target-required completion records before final staging.

Final output: candidate and final develop SHAs separately, audit status, excluded paths/reasons, remaining_steps, Elapsed, Active, human wait and per-step breakdown. Explicit recording restrictions retain local artifacts with the boundary reported.
