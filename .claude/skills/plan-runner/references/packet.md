# Packets

The fixed rules (start steps, test commands, layering, commit and report format) live in each agent file
(`.claude/agents/plan-*.md`), so a packet carries only that task's slice: at most about 3k tokens. Never paste the whole plan,
the whole AGENTS.md or another task's part. Keep the first line exactly as shown: the guard reads it.

## Builder (`plan-builder`, `plan-builder-opus`)
```
plan-runner run <run id> — <task id>: <title>
Run sha: <git rev-parse HEAD at spawn time>

## Your task
<the plan's lines for this task, copied (only these)>

## Checks it must meet
<the task's checks from the run file, one per line>

## Start from
<files and functions with line numbers (from the searcher's report, if one ran)>

## Tests to run
<the task's own test files, and the readers the plan check found: tests and contract fixtures that pin what this task
changes, as `npm test --workspace @ottlib/<pkg> -- <names>` or one Gradle module (the full suite is the checker's)>

## Task rules
<only what the agent file doesn't already say: the widths, TV focus path or mobile shapes for a UI task, tests to write,
a migration's number, whether the contract fixtures and Kotlin DTO change, ...>
Don't edit the plan's progress log: put measured values in your report as `numbers:` lines.
```

## Fixer (the same builder type, fresh: never the builder resumed)
```
plan-runner run <run id> — fix <task id>: <title>
Run sha: <git rev-parse HEAD at spawn time>

Fix only these:
<findings, or the failing test lines (short), or the diagnoser's fix lines>
Files: <files>. Failing test files to run: <files, or none>.
Commit message: "<task id>: review fixes" (or "<task id>: check fixes").
```

## Task reviewer (`plan-reviewer`)
```
plan-runner run <run id> — review <task id>: <title>

Diff: git diff <before sha>..<after sha> -- <files>
Plan lines:
<the plan's lines for this task>
Checks:
<the task's checks>
Run so far (merged tasks whose changes this task's code meets; look for interactions):
<task id>: <one line, e.g. "GET /api/movies/:id/playback now returns subtitles[]">
```

## Plan check (`plan-searcher`, run-level, before the split)
```
plan-runner run <run id> — search
Plan: <plan path>
1. Check each code claim the plan makes against the code: every file:line, and every assumption about what exists or how it
   behaves today (a route, a column, a setting). Report each wrong one as `wrong: <plan §> <claim> -> <what the code has, file:line>`.
   Also every behaviour the plan assumes already happens and every behaviour it switches off: say whether it exists and what
   replaces it.
2. For every value, key, route, schema or type the plan changes, removes or renames, list its readers outside the task's own
   files: tests that pin it, `contract/fixtures/`, Kotlin DTOs (`apps/android/core/model`), the web client's hooks, scripts,
   docs. Report each as `reader: <task id> <path:line — what reads it>`. Skip pure line drift (±20 lines).
3. Find, for each task, where it should start (file:line of the functions or screens to change):
<task id>: <one line: what the task changes>
```

## Checker (`plan-checker`, run-level, after every task is merged)
```
plan-runner run <run id> — checks
Full suite: npm run build; npm test; apps/android/gradlew -p apps/android test
Android apps changed: <yes: also compile :tv and :mobile | no>
Shots: <screenshots to merge and what each must show, or none>
Re-check only (after fixes): <failing test files, or none>
```

## Gate review (`plan-gate`, run-level, before the pull request)
```
plan-runner run <run id> — gate
Stat: out/plan-runner/<run id>-gate.stat
Diff: out/plan-runner/<run id>-gate.diff   (git diff <base sha>..<head sha>, base = git merge-base HEAD origin/master)
Plan goal: <2–4 lines from the plan>
Task checks:
<task id>: <its checks, one line>
```

## Diagnoser (`plan-diagnoser`, on call)
```
plan-runner run <run id> — diagnose
Failing: <the failing lines, short>
Log: <path>
Commits: <base sha>..<head sha>
```
