---
topic: {{area}}/{{subject}}
status: proposed # proposed|approved|rejected|superseded
supersedes: null # previous decision file name for the same topic, or null
superseded_by: null # filled in when a newer decision replaces this one
affected: [] # for example [agmws, fe-main, sql]
service_refs: [] # service_id values from knowledge/service-ownership.yaml
review_evidence: "{{task_id}}" # latest task that confirmed this decision is current
date: {{date}}
requested_by: {{requested_by}}
requester_authority: {{requester_authority}}
decision_owner: {{decision_owner}}
authority_evidence: {{authority_evidence}}
kind: convention # workflow|architecture|convention|contract|preference
summary: "" # <= 140 chars; used by recall
scope_paths: [] # globs such as ["src/Orders/**"]
applies_when: "" # short condition, for example "new stored procedure"
origin: explicit # explicit|card|correction|promoted
card_id: null
---

# Decision: {{title}}

- Task: `{{task_id}}`
- Decision owner: {{decision_owner}}
- Authority evidence: {{authority_evidence}}

## Problem and evidence

{{problem_and_evidence}}

## Options and trade-offs

{{options}}

## Decision, reason, and consequences

{{decision_reason_consequences}}

## Continuation notes

{{continuation_notes}}
