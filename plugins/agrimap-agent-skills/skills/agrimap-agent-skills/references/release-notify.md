# Release Description and team notification (N)

Applies to `release production`, `release full` (with or without `--flash`) and `promote`, every time the Production tag checkpoint (T) is verified, including a release that paused for confirmation and finished through `promote` or a resume. Send once per version. `release inhouse`, `pipeline` and `prepare` never notify. The target's AGENTS.release.md §8.2 owns the wording rules; follow it when present. This is the AI summary card (`POST …/release-description`: project name, version, items with related projects); the Jenkins build card (`POST …/release`) is sent by each Jenkinsfile and is not the Agent's.

## Flags

`--silent` (alias `--skip-noti`) is a bare modifier accepted only on `release production|full` and `promote`; it may precede or follow the command words and combines with `--flash`. It skips sending only. Reject it on other actions, valued or duplicated, before writes.

## Write the description

1. Source: the verified Production notes and reviewed baseline-to-candidate diff. One plain-Thai bullet per change a user can notice; merge small related changes; omit bump/audit/ci.
2. Header `# <project name> / <Production version>`; project name from README/project memory, else the repository name. Fixed shape: the header line, then `- ` bullets immediately; no blank line, sub-heading, table, bold or intro/outro text.
3. An item that comes from or requires changes in other projects (generated `agmws-*` API client, `@agrimap/*` package, `AgriMap.*` NuGet, another service's endpoint, a project that must be updated or deployed with it) ends with `(เกี่ยวข้อง: <repo>, <repo>)`. Describe the visible effect, not the mechanism.
4. No class, file, route, SHA or ticket text. Keep technical terms the team knows as they are (header, `x-correlation-id`, API names) instead of vague Thai paraphrases: "ปรับเพิ่มการส่งรหัส x-correlation-id ใน header เพื่อให้ทีมงานตรวจสอบและประสานงานแก้ปัญหาได้ตรงจุด". A BA must be able to paste it to a customer unchanged.
5. Save to `.agrimap-agent/reports/YYYY-MM/<RUN_ID>-release-description.md` so the F `audit:` commit carries it.
6. The final answer always has a `description-released` heading followed by the full text in a `markdown` code block, whether notify is sent, pending or skipped (`--silent`). Missing it means the release is not `completed`.

```markdown
# <project> / <version>
- xxx
- yyy
- zzz
```

## Send

Unless `--silent`, run from the target root after F:

```text
node tools/agrimap/release-notify.mjs send --description <file> --environment Production
```

The script checks `GET …/healthz` before POST. Missing `tools/agrimap/release-notify.mjs` is a bootstrap freshness repair (managed file), not a reason to skip.

| Exit | Meaning | Action |
| --- | --- | --- |
| 0 | `sent: true` | Report `notify: sent`; never send again |
| 2 | `NOTIFY_WEBHOOK_URL` (…/agrimap-notify/release-description) not set | Ask once with the host question tool (Claude AskUserQuestion, the Codex/Antigravity equivalent; plain text only when none) using the script's `question`, standard URL first; run the chosen `set-url`, then `send` again in this invocation |
| 3 | Health failed | Report `notify: pending (health HTTP <status>)` and the resend command; no POST was made |
| 4 | POST failed or unknown | Report `notify: pending` with the status; if `sent` is `unknown`, ask before resending |

Notification never changes release success, branches, tags or versions. Do not retry in a loop.
