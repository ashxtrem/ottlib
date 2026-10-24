# Reports

Each agent file (`.claude/agents/plan-*.md`) holds its own report format. The guard sends back, once, a final message over
15 lines (30 for a searcher's `found`) or one that doesn't start with one of these words: `done`, `blocked`, `approve`, `changes`, `found`, `cause`,
`checks`.

| Agent | First line | Then |
|---|---|---|
| builder, fixer | `done T003 <sha>` or `blocked T003: <question>` | `files:` (up to 8), `tests:`, `numbers:` (measured values, if any), `concerns:` / `done so far:` |
| task reviewer, gate | `approve` or `changes` | up to 10 findings: `file:line: bug\|risk\|rule\|test: problem. fix.` |
| checker | `checks pass` or `checks fail` | what ran and the sheets, or up to 10 failing lines and the log path |
| searcher | `found` | `wrong:` plan claims and `reader:` lines (plan check), `<task>: <path:line — what is there>`, then `not found:` |
| diagnoser | `cause: …` | `from:`, `fix:` (up to 5), `test:` |

## What the coordinator records
- Each task helper once: `run_file.py set <task> agent=<id> role=worker|reviewer|fixer`, plus `status=… commit=… note=…`.
- Each run-level helper once: `run_file.py helper <id> checker|gate|searcher|diagnoser`.

The completion notice's `total_tokens` is the helper's final context size, not what it used (`tokens=` is still accepted, but
it is not a cost). The run's cost per task and role comes from `run_file.py usage` (also printed by `end`), which reads each
helper's transcript; run-level helpers show as task `run`.
