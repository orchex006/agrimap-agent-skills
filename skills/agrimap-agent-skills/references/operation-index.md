# AgriMap operation routing index

<!-- Generated from config/operations.json. Do not edit directly. -->

Use this file only to select one dedicated `agm-*` skill. It is not an execution contract.

| Dedicated skill | Operation | Purpose | Mode | Workflow depth |
| --- | --- | --- | --- | --- |
| `agm-analyze` | `analyze` | Analyze scope, hidden problems, impacts, and trade-offs | `product-read-only` | default `light`; allowed `light`, `standard`, `regulated` |
| `agm-diagnose` | `diagnose` | Diagnose a problem to a proven root cause | `product-read-only` | default `light`; allowed `light`, `standard`, `regulated` |
| `agm-plan` | `plan` | Create a reverse-engineered execution plan | `product-read-only` | default `light`; allowed `light`, `standard`, `regulated` |
| `agm-architect` | `architect` | Design boundaries, contracts, and migration trade-offs | `product-read-only` | default `light`; allowed `light`, `standard`, `regulated` |
| `agm-fe` | `fe` | Analyze, design, create, edit, refactor, or explicitly test frontend work through one domain façade | `action-routed` | default `light`; allowed `light`, `standard`, `regulated` |
| `agm-be` | `be` | Analyze, design, create, edit, refactor, or explicitly test backend work through one domain façade | `action-routed` | default `light`; allowed `light`, `standard`, `regulated` |
| `agm-sql` | `sql` | Analyze, design, create, edit, refactor, or explain SQL work through one domain façade | `action-routed` | default `light`; allowed `light`, `standard`, `regulated` |
| `agm-qa` | `qa` | Verify an artifact under a product-read-only, execution-restricted QA contract | `verification-only` | default `light`; allowed `light`, `standard`, `regulated` |
| `agm-prompt` | `prompt` | Analyze and refine requester intent into one immutable versioned Prompt Result with explicit Main and Subagent ownership | `workflow-write-only` | default `light`; allowed `light` |
| `agm-exec` | `execute` | Implement an authorized objective, approved Prompt Result, or resumable task with proportional verification and scoped delivery | `product-write` | default `light`; allowed `light`, `standard`, `regulated` |

After selecting one row, hand off to that skill and stop the router. Never combine multiple operation skills implicitly.
