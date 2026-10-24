# Packets

Keep each packet small: only what this helper needs. Never paste the whole plan or AGENTS.md.

## Search (`writer-searcher`, fact sweep)
```
plan-writer search — <topic>: <area of this search>
Find, as path:line with one line each:
1. <what to find: a route, a service, a repository method, a screen, a setting, where X happens today>
2. ...
Also: plans in plans/ that touch <systems> (path and the section that matters).
```

## Option probe (`writer-searcher`, before the grill)
```
plan-writer search — <topic>: option probe
For each option, say whether what it relies on exists and behaves as assumed today, with path:line:
1. <option>: relies on <route / setting / column / provider / screen / focus handler>
2. ...
```

## Plan check (`writer-searcher`, after the draft)
```
plan-writer search — <topic>: plan check
Plan: plans/<topic>-plan.md
Sections: <all, or the § range this searcher checks>
Check each code claim the plan makes against the code: every file:line, and every assumption about what exists or how it
behaves today (a route, a column, a setting, a value). Report each wrong one as
`wrong: <plan §> <claim> -> <what the code has, path:line>`.
Then, for every value, key, route or type the plan changes or removes, list its readers outside the planned files (tests that
pin it, contract/fixtures, Kotlin DTOs in apps/android/core/model, the web client, scripts) as
`reader: <plan §> <path:line — what reads it>`.
Skip pure line drift (±20 lines).
```

## Issue (`writer-issuer`, on approval)
```
plan-writer issue — <topic>
Plan: plans/<topic>-plan.md (approved <date>, branch claude/<topic>)
issue: none | <n>
Type: bug | enhancement
Extra labels: <accessibility / documentation, or none>
```

## Run (`writer-runner`; `model: "sonnet"` only when reading the run needs judgement)
```
plan-writer run — <topic>: <what this measures>
Run, in order:
1. <command, e.g. npm test --workspace @ottlib/server -- scanner, or apps/android/gradlew -p apps/android :core:data:test>
2. ...
Report: <the numbers to copy, the lines to grep for, or the shots to merge into a sheet>
Budget: <minutes; at most about 10 — say what to drop if it runs over>
```
