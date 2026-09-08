# Proportional verification and assurance

Choose checks from changed behavior and acceptance, not model, diff size, role name or number of previous passes. Questions/proposals require no tests. Documents use relevant content/link/structure checks. Implementation uses the smallest adequate existing regression/build/static checks; expand to affected consumers when contracts or dependencies change.

Reuse results only when source content, dependencies, configuration, environment and coverage still match. A new reviewer does not invalidate matching evidence. Stop when required evidence is sufficient. Never add speculative tests or repeatedly run full suites without a changed input, failed check or coverage gap.

Independent QA is warranted by the actual risk or explicit request. The verifier inspects final artifacts and relevant evidence, does not silently fix them, and may run project-declared local checks after inspecting their effects. Tests are not inherently read-only: keep writes in declared output/isolated paths, avoid external services and data mutation. No installations or network writes follow from QA alone.
SQL context remains metadata/SELECT only; no SQL DDL/DML, EXEC, metadata sync or deployment at any QA level.

qa_mode is not-applicable, light or full: light means targeted sufficient evidence; full means broader explicitly required acceptance coverage, not a fixed command list. No every-third-run escalation. Record omitted required checks honestly.
States: passed (required evidence complete), failed (defect), blocked (missing external prerequisite), not-applicable (no executable verification need). No conditional pass or invented test results.

Corrections stay in authorized scope with a bounded budget (default three attempts); continue only with evidence of progress. Repeated identical failure requires a changed approach/escalation. Reverify affected final artifacts. Exhaustion is unresolved work, not success. A material scope change requires requester direction.
Record evidence in the task record or delivery artifact already used; qa.md is optional for an independent consumer. The writer cannot attest independent review of its own change.
