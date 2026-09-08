# Useful state and audit

All project state is under <project>/.agrimap-agent, never the global installation. Ordinary conversation has no lifecycle. Capture relevant raw submissions once at prompts/YYYY-MM/<conversation>/history.md; AI text never belongs there.

Bounded durable work records concise milestone logs and current/recent memory. Tracked work adds tasks/YYYY-MM/<id>/task.md only when it will be read for resume/handoff. Reports and separate analysis/QA/results are optional deliverables; do not duplicate the same evidence.
Current memory is working state, recent is a concise outcome journal, project.md is reusable facts and pointers. Reopen relevant state after compaction/resume, validate against current files, and do not load unrelated history.
Completion removes matching current state and archives tasks to tasks/complete; blocked state stays resumable. Never migrate/delete historical artifacts automatically. Legacy schema v1-v4 audit remains readable; requester, executor, file claims and Git authorship are distinct.
Runtime generates timestamps/IDs/metadata. Confirmed requester attribution persists in the user/workspace scope; it is not owner authority. Record actual model separately from modelLabel.
Use one lifecycle owner: installed runtime or portable fallback emits the same evidence, not two parallel runs.
