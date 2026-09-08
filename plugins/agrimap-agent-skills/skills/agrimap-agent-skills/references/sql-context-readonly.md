# sql-context-pack: read-only supporting capability

Use when a task needs exact schema/metadata or bounded masked data that local authoritative references cannot answer. Read the installed sql-context-pack SKILL and the relevant route. Do not create a new AgriMap task for retrieval.

Use only the current conversation's explicitly connected profile and its allowed scope. Never inherit another room's profile or request credentials. Search exact object names, read index pagination to completion, preserve source/profile/object identity and freshness.
Permitted: capabilities, metadata/context index, registered-folder listing, relational SELECT via sqlctx_query_data with masked output and at most 500 rows.
Do not invoke CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/MERGE/TRUNCATE, EXEC/CALL, SELECT INTO, procedure/function execution, routine deployment, metadata sync, owner-resolution apply or any database write. This restriction holds for all users/models/depths within this integration; a supporting skill cannot expand it.
Do not auto-run exports that materialize files, classify/apply folders, install tools or change profiles merely to answer a query. Missing profile/service/evidence is a named gap; continue independent work. No direct database connection fallback.
The managed service's read-only profile and query parser are authoritative. scripts/governance-policy.mjs supplies a conservative tool/query guard for adapters; this package does not proxy arbitrary SQL or grant database permissions.
