# Release Description and team notification (N)

Applies to `release production` and `release full`, with or without `--flash`, after the Production branch/tag checkpoint (T) is verified. Other actions never notify. The target's AGENTS.release.md §8.2 owns the wording rules; follow it when present. This is the AI summary card (`POST …/release-description`: project name, version, items with related projects); the Jenkins build card (`POST …/release`) is sent by each Jenkinsfile and is not the Agent's.

## Flags

`--silent` (alias `--skip-noti`) is a bare modifier accepted only on `release production|full`; it may precede or follow the command words and combines with `--flash`. It skips sending only. Reject it on other actions, valued or duplicated, before writes.

## Write the description

1. Source: the verified Production notes and reviewed baseline-to-candidate diff. One plain-Thai bullet per change a user can notice; merge small related changes; omit bump/audit/ci.
2. Header `# <project name> / <Production version>`; project name from README/project memory, else the repository name.
3. An item that comes from or requires changes in other projects (generated `agmws-*` API client, `@agrimap/*` package, `AgriMap.*` NuGet, another service's endpoint, a project that must be updated or deployed with it) ends with `(เกี่ยวข้อง: <repo>, <repo>)`. Describe the visible effect, not the mechanism.
4. No class, file, route, SHA or ticket text. A BA must be able to paste it to a customer unchanged.
5. Save to `.agrimap-agent/reports/YYYY-MM/<RUN_ID>-release-description.md` so the F `audit:` commit carries it, and always show the full text in the final answer, including under `--silent`.

## Send

Unless `--silent`, run from the target root after F:

```text
node tools/agrimap/release-notify.mjs send --description <file> --environment Production
```

The script checks `GET …/healthz` before POST. Missing `tools/agrimap/release-notify.mjs` is a bootstrap freshness repair (managed file), not a reason to skip.

| Exit | Meaning | Action |
| --- | --- | --- |
| 0 | `sent: true` | Report `notify: sent`; never send again |
| 2 | `NOTIFY_WEBHOOK_URL` (…/agrimap-notify/release-description) not set | Ask the requester once for the URL, run `set-url <url>`, then `send` again in this invocation |
| 3 | Health failed | Report `notify: pending (health HTTP <status>)` and the resend command; no POST was made |
| 4 | POST failed or unknown | Report `notify: pending` with the status; if `sent` is `unknown`, ask before resending |

Notification never changes release success, branches, tags or versions. Do not retry in a loop.
