# Evidence-driven analysis

Support consequential claims with sources. Distinguish observed facts, inference, testable hypotheses and missing evidence. Never promote an assumption to fact by repetition.
Use [recommendations.md](recommendations.md) routinely: recommend when evidence supports it, explicitly surface insufficient information otherwise, and label provisional advice with assumptions and confidence. Do not wait for the requester to discover a gap.
Inspect the target and affected callers sufficiently to support the conclusion. Scope inspection to relevant contracts, failure paths, state/concurrency, data integrity and ownership; do not enumerate irrelevant probes.

Answer at the requested level of detail. Findings, impact and actionable recommendations should be easy to assess; headings are optional. Do not force seven headings or an analysis artifact on a simple question.
Database conclusions require actual caller and object/schema evidence. Search local context first, then the permitted read-only managed route in db-schema-context.md. Name missing evidence rather than inventing it. Analysis does not authorize data writes.
Persist an analysis document only when requested or needed by a downstream consumer; otherwise the direct answer is the deliverable.
