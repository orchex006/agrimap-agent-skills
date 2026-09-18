# Team git workflow

Load for product writes in a Git repository or for a short integration reply. Scripts plan; run `apply` only with the returned `planHash`. On any non-ok result stop and follow its `next` or card. Never create worktrees or clones, stash, reset, force-push or stage with `git add -A`/`.`.

## Repository and policy

1. `agm-workspace.mjs context --cwd <session cwd> [--paths <files>] [--hint <project>]`. Read every `readRequired` file completely, then `context --ack <sha12,…>`. Each repository you write needs its own ack; never write `.agrimap-agent` outside a Git root.
2. `policy show`. Missing: `policy infer` and put its card in the first question round, then `decide record`. Never guess prefixes, bases or targets.

## Start

After `start`, run `branch plan --type feature|fix|hotfix|refactor|docs|chore --slug <english-kebab>` then `branch apply`. The work type is yours unless it changes base or target (hotfix vs fix); then use a card. Pre-existing dirty files are carried but never delivered. Host-created worktree branches follow `hostWorktreeBranch`.

## Deliver

After verification, add the changelog entry required by the project AGENTS, then `deliver plan [--input message.json]` and `deliver apply`. Failed or missing verification still delivers the work branch with `AGM-Verification` and the `DELIVERED_UNVERIFIED` warning; merge is not offered until it passes. Messages are Conventional Commits in English with a header of at most 72 characters. The script stages exact own paths and verifies the remote SHA; it refuses protected branches, suspected secrets, missing acknowledgement or changelog. If the policy disables delivery, report exact paths and commit only when asked (`--explicit commit|push`). Then run `integrate options` and end with the delivery summary (at most 12 lines, warnings under `⚠️ ต้องตามต่อ` with code, impact and fix) and its next-step card.

## Short replies

| Reply | Intent |
| --- | --- |
| an option number | the stored card option |
| merge, รวม, รวมเข้า <branch>, ship, ผ่าน รวมได้, LGTM | integrate |
| pr, mr, เปิด PR, ส่งรีวิว | open-pr |
| อัปเดต branch, sync | update-branch (merge, never rebase or force) |
| แก้ต่อ, พักไว้ | continue, park |
| ทิ้ง, ยกเลิก branch | abandon (R3 card) |

Questions ("merge ยังไง?") and quoted text are not commands. A resolved reply is the explicit instruction for exactly the planned action; deleting branches, other targets or merging with failing checks needs its own card. Run `integrate plan --intent <intent>` then `integrate apply`. For local merge, run the verification the plan requests before `--stage push`. Report blocked reviews, failing checks, conflicts and server rejections with evidence; never bypass reviews or enable auto-merge unless the reply asked for it. `jenkins` and `jenkins-release` are release targets: use the project release intents.
