# Input and scope contract

Normalize all requester input before analysis. Preserve decision-owner authority metadata separately.

## Input manifest

Record each item with:

- `id`
- `kind`: `text`, `large-text`, `image`, `attachment`, `file`, `directory`, `url`, or `requester-note`
- `source`
- `priority`
- `requester_intent`
- `loaded`: `full`, `chunked`, `visual-inspection`, `metadata-only`, or `unavailable`
- `hash` when available
- `facts`
- `uncertainties`

## Host mentions and free text

Interpret host-native references (`@file`, attach, drag-drop) by their observed role: target, required evidence or optional example. A separate input manifest needs an actual complex-input or handoff consumer; do not create one for a simple question. When a reference is ambiguous, state a safe interpretation and proceed read-only; clarify before writes if a wrong interpretation would materially change scope. Use [elicitation.md](elicitation.md) for consequential gaps, not to fill every optional parameter.

## Large text

- Measure size before reading.
- Read fully when practical; otherwise index and chunk by stable headings or line ranges.
- Track which chunks were read.
- Never claim full coverage after partial reading.

## Images and multimodal files

- Use the platform's visual/file tools rather than treating binary content as text.
- Separate visible facts from interpretation.
- Preserve requester annotations and spatial references; mark decision-owner-approved material separately.
- If the model or tool cannot inspect the file, state that limitation and ask for a supported representation.

## Pointed files and directories

- Validate the path and scope before reading.
- Respect ignore files and the configured binary skip list.
- If the requester explicitly points to a normally skipped binary, use a suitable inspector; do not dump raw binary into context.

## Default skip list

Skip generated/dependency/build output unless the task targets it:

- `.git/`, `node_modules/`, `bin/`, `obj/`, `dist/`, `coverage/`
- `*.dll`, `*.exe`, `*.pdb`, `*.so`, `*.dylib`, `*.class`

Do not turn this list into a security policy. It is context hygiene only.

## Scope ledger

Before implementation, record objective, deliverables, non-goals, affected systems, logic/contract/data impact, tests, authorized decision-owner decisions, and unresolved concerns. For cross-service scope, point to the relevant `service_id` in `.agrimap-agent/knowledge/service-ownership.yaml`; do not copy a second ownership map. Update the ledger when the requester adds requirements, and do not treat a new material requirement as authorized until its decision authority is recorded.
