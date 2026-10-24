---
name: plan-runner
description: Run an approved OttLib plan (plans/*-plan.md) end to end with a crew of helper agents (.claude/agents/plan-*.md, each with its own model, effort and tools). The main chat coordinates; a fresh builder makes each task in its own worktree (Sonnet when the spec is full, Opus when partial), a read-only Sonnet reviewer checks each diff, one checker runs the full web and Android suites after the merge, a fresh read-only Fable gate reviews the whole run, then the main chat opens the pull request into master. Repo hooks guard the helpers and fail open with a health check. Use it when the user says to run, build or execute a plan with agents, "/plan-runner", or "run the plan", and for "/plan-runner resume|status|guard off|guard on|end".
---

# Plan runner

Scripts: `.claude/skills/plan-runner/scripts/` (tests: `python -m unittest discover -s .claude/skills/plan-runner/tests`).
AGENTS.md still applies to you and to every helper. `master` is PR-only: the run ends in a pull request, never a push to it.

**Shell form:** write each command with the script's literal path, one per Bash call
(`python .claude/skills/plan-runner/scripts/run_file.py status`). Never `S=...; python $S/...`, `git -C`,
`cd <agent worktree> && ...` or `&&`-chained git: in a worktree Claude Code asks permission for them. Merging and cleanup are
`run_file.py merge` and `end`, not git chains. Edit files with Edit, not `python`/`sed` heredocs.

## The crew
Each role is an agent file in `.claude/agents/`, with its model, effort and tools set there. Start a helper with
`subagent_type: "<name>"` and leave `model` out unless this table says to override it.

| Role | `subagent_type` | Model · effort | Tools | When |
|---|---|---|---|---|
| Builder (spec full) | `plan-builder` | Sonnet · high | edits, no Agent | a task whose steps are fully written down |
| Builder (docs, config) | `plan-builder` with `model: "haiku"` | Haiku | edits, no Agent | docs, config examples, fixtures-only changes |
| Builder (spec partial) | `plan-builder-opus` | Opus · medium | edits, no Agent | a task that needs judgement |
| Task reviewer | `plan-reviewer` | Sonnet · high | read-only | each task with review above `none` |
| Checker | `plan-checker` | Sonnet · medium | read-only | once, after every task is merged |
| Gate review | `plan-gate` | Fable 5.1 · high | Read, Grep, Glob only | once, before the pull request |
| Searcher | `plan-searcher` | Haiku | read-only | on call: start points for packets |
| Diagnoser | `plan-diagnoser` | Opus · high | read-only | on call: a failure that isn't obvious |

You (the coordinator) run on this chat's own model and effort; the skill can't set them. Coordinating is bookkeeping, so
suggest medium effort at the start if the chat is on a higher one.

## Advisor mode
When the user says "use advisor" or "advisor <model> <effort>" (default **Fable 5.1 · high**), never ask the user: a `blocked`
helper, an unclear failure, a review round that finds more, a plan-check `wrong:` line that changes a decision all go to the
`advisor` agent with the plan context, and its decision is the answer. When it needs code facts, a `plan-searcher` (Haiku 5.5)
fetches them for it. Only its `escalate:` reaches the user. Where this file says "ask the user" it means the advisor while the
mode is on. Full rules: `references/advisor.md`. Usage prices Fable 5.1 like any helper (`transcripts.py`).

## Keep your own context small
- Read reports, findings and failing lines only: never whole diffs, whole logs or whole files.
- Send searches you'd make for packets to the searcher, and long checks to the checker.
- Keep each update to the user to 1-2 lines (what happened, anything that needs them); the run file holds the state, so no
  tables or recaps after each event. Every coordinator turn re-reads the whole chat.
- Whenever an update names a helper, give its model and effort with it, e.g. "builder (Opus · medium)", "gate
  (Fable 5.1 · high)". Take them from the crew table, with any `model` override you passed.
- Start a run from a fresh session or after `/clear`. The run file holds the state.

## Commands
| Ask | Do |
|---|---|
| `/plan-runner [plan]` | The run below. The default plan is the one this chat last wrote. |
| `/plan-runner <issue URL or a request>` | No plan file: the small-job lane below. |
| `/plan-runner resume` | `python .claude/skills/plan-runner/scripts/run_file.py show`, then carry on from the first task not merged. |
| `/plan-runner status` | `python .claude/skills/plan-runner/scripts/run_file.py status`, reported briefly. |
| `/plan-runner guard off\|on [RULE]` | `python .claude/skills/plan-runner/scripts/guard.py off\|on [RULE]` |
| `/plan-runner end` | `python .claude/skills/plan-runner/scripts/run_file.py end` |

Each command acts on the run whose branch is this checkout's branch, else the only active run. When several runs are active and
the branch doesn't identify one, it lists them: add `--run <id>` (to `run_file.py` and `guard.py` commands alike).
`resume` from a second chat: check the run's last activity first (`run_file.py status`, `git log -1 --format=%cr`); if its own
chat is still working (activity in the last ~10 min, or the user says it is), stop and say so instead of taking over.

## Small-job lane (an issue URL or a request instead of a plan)
- Read the issue with `gh issue view <n>`, then check it isn't already done (`git log origin/master --grep "#<n>"`,
  `gh pr list --search <n> --state all`).
- One file and a few lines, nothing to decide: do it yourself in the worktree, run its tests and the full suite, and open the PR.
- Otherwise, when it is clear enough to build: write a short plan (`plans/<topic>-plan.md`, the
  `../plan-writer/references/plan-shape.md` sections, 1-3 tasks) and run it as below, with the reviewer and the full-suite
  check; skip the gate for one task.
- When it needs decisions (scope, behaviour the user sees), say so and suggest `/plan-writer <issue>` instead of guessing.
- Runs of 2 tasks or fewer skip the chat-size question at `begin`.

## The run
1. **Start.**
   - **Worktree first.** Several runs may run at once, each in its own worktree and chat. If this chat is not in a worktree,
     enter one (EnterWorktree). `begin` refuses the main checkout.
   - Check that `git status` is clean, then `git fetch origin master` and `git checkout -b claude/<topic> origin/master`.
     If `/plan-writer` already committed the plan on `claude/<topic>`, check out that branch instead (`git checkout claude/<topic>`,
     then `git merge origin/master` if master moved since). If git says the branch is checked out in another worktree, make
     the run branch from it: `git checkout -b claude/<topic>-run claude/<topic>`, and use that name below.
   - `npm ci --no-audit --no-fund` in this worktree (the checker runs here, and a new worktree has no node_modules).
   - Run `python .claude/skills/plan-runner/scripts/guard.py selftest`. If it fails, carry on without the guard (`guard.py off`
     after `begin`) and tell the user.
   - `python .claude/skills/plan-runner/scripts/run_file.py begin <YYYYMMDD-topic> --plan <plan> --branch claude/<topic>`. It
     checks this chat's size: if it warns (over 150k tokens), tell the user in one line, suggest `/clear` or a new session and
     `/plan-runner resume` there, and go on only if they say so. It never refuses on size. It refuses an id that another live
     chat has bound.
2. **Split** the plan into tasks of about 1–3 files or one layer each:
   - **Plan check first.** One `plan-searcher` with the plan-check packet (`references/packet.md`) checks every `file:line`
     claim and code assumption the plan makes (a route that exists, a function's current behaviour), and finds start points for
     the packets in the same pass. Put its `wrong` lines into the packets, and ask the user only when one changes a decision.
     It also lists the **readers** of everything the plan changes (tests that pin a value, contract fixtures, Kotlin DTOs, the
     web client): put each task's readers in its packet's `Tests to run` and `Task rules`.
   - **Files:** two tasks that list the same file are one task, or a chain with `--deps`; parallel builders on one file cost a
     merge conflict or a serial fix chain.
   - Add each with `run_file.py task T001 "<title>" --model sonnet|haiku|opus --spec full|partial --checks "<c1>; <c2>"
     --deps T00x --review none|quick|full --tests <test files> --plan-lines "<§ refs>" [--early-deps T00x]`.
   - **Early deps:** when a task only needs another task's code to exist (a client screen on a new route, an Android DTO on a
     new shared schema), give that dependency with `--early-deps`. The task becomes ready as soon as the dependency is merged
     into the run branch, before its review. If that review later changes the code, tell the running helper with SendMessage
     or put the changes in its fixer packet.
   - **Spec:** `full` when the plan says exactly what to build (files, names, values, behaviour); `partial` when the builder
     must decide something. Full goes to `plan-builder` (or Haiku for docs and config), partial to `plan-builder-opus`.
   - **Checks:** 2–5 things that must be true when the task is done. The builder, the reviewer and the gate all work from them.
   - Use review `none` for docs only.
   - Show the table (`run_file.py status`) in chat and go on. Approved plans run in one go.
   - Record the plan-check searcher with `run_file.py helper <id> searcher` (Haiku has no effort) and use its `found` lines
     in the packets.
3. **Build** every task `run_file.py ready` lists:
   - One `Agent` call each, in one message, with `subagent_type` from the crew table, `run_in_background: true`,
     `isolation: "worktree"`, and the packet from `references/packet.md` (first line `plan-runner run <id> — <task>`).
   - Then `run_file.py set T00x status=building agent=<agentId> effort=<its effort>` (role `worker`). Every `agent=` and
     `helper` call carries the helper's effort from the crew table, so the usage table can show it.
   - The built-in worktree starts from `origin/master`, not from your commit. The packet's `Run sha:` (your
     `git rev-parse HEAD` at spawn time) is where the agent file's first step resets to, and you merge a task before you start
     the tasks that depend on it.
4. **On each report** (formats in `references/report.md`):
   1. `run_file.py status`. React to its warning lines (below).
   2. `done`: `python .claude/skills/plan-runner/scripts/run_file.py merge T00x <agentId>`. It merges `worktree-agent-<agentId>`,
      records `commit=` and prints the reviewer's `git diff before..after` (a task with review `none` goes straight to merged).
      A conflict is left for you: resolve it, commit, then `set T00x status=review commit=<sha>`. Don't record the notice's
      `total_tokens`: that is the helper's final context size, not what it used. `run_file.py usage` reads the real use from
      the transcripts. A task started early (`--early-deps`) whose dependency's API changed in its review: send the running
      builder the new signature (SendMessage) at once, or put it in its fixer packet.
   3. `blocked`: answer from the plan if you can, otherwise ask the user (AskUserQuestion). Then start a fresh builder with
      the answer and the work so far (its branch is in the run).
   4. Start the tasks that are now `ready`.
5. **Review** a task with review above `none`:
   - A `plan-reviewer` with `run_in_background: true` and the reviewer packet. Give it the task's
     `git diff <before>..<after> -- <its files>` range, not the diff text, and the packet's `Run so far` lines: one line per
     task already merged that changes what this task's code meets (a new route, a changed schema). Interactions between tasks
     are what a lone task review misses. Record it: `set T00x agent=<agentId> role=reviewer effort=high`.
   - `approve`: `set status=merged`. Its `risk` and `rule` notes need no fixer: fold them into the next task that touches those
     files, or leave them for the gate.
   - `changes`: first check each finding against the plan and the code; drop a wrong one and say why in `note=`. Then the
     nits: fix findings of 3 lines or fewer yourself with Edit (say so in `note=`). Otherwise a fresh fixer of the builder's
     type (never the builder resumed), with the fixer packet: `set T00x agent=<id> role=fixer effort=<its effort>`, then
     `run_file.py merge` its branch and review again.
   - **No second round** when the fix changed 30 lines or fewer, did only what the findings asked, and its tests pass:
     `set status=merged` and say so in `note=`. A bigger fix, or one that changes behaviour beyond the findings, is reviewed again.
   - At most 2 review rounds per task. What a second round still finds on the same files goes into the next task that touches
     them (put it in that task's packet). If no later task touches them, ask the user.
6. **Check and gate, together,** once every task is merged. Start both in one message: they are independent. First
   `git fetch origin master` and `git merge origin/master` (another PR may have merged meanwhile), then:
   - One `plan-checker` (not isolated: it runs in this checkout, on the run branch) with the checker packet;
     `run_file.py helper <id> checker medium`. It runs what CI runs: `npm run build`, the full `npm test` (with the contract
     fixtures), the Android unit tests, and the two app compiles when `apps/android` changed.
   - The gate has no shell, so write its diff first, each in its own call: `mkdir -p out/plan-runner`, then
     `git diff --stat <base>..<head> > out/plan-runner/<run id>-gate.stat` and
     `git diff <base>..<head> > out/plan-runner/<run id>-gate.diff`, where base is `git merge-base HEAD origin/master` and head
     is your `git rev-parse HEAD` now. Then one `plan-gate` (Fable 5.1 · high) with the gate packet naming those files;
     `run_file.py helper <id> gate high`. Skip the gate for a one-task run. Fable is the dearest model ($10 in / $50 out per
     million tokens): send file paths and short checks, never pasted diff text.
   - Don't edit the run branch while the checker or the gate runs in this checkout.
   - `checks pass`: go on. `checks fail`: when the cause is plain from the failing lines, a fresh fixer with them (its packet
     names the failing test files). When it isn't, a `plan-diagnoser` first (`helper <id> diagnoser high`), then a fixer with
     its `fix:` lines.
   - Gate `approve`: go on. Gate `changes`: nits yourself, the rest to fresh fixers.
   - After any fixes: a fresh checker for the failed checks plus the fixes' tests (the full suite again when a fix touched a
     shared schema, a migration or a response the apps read). No second gate unless the fixes changed more than about 30
     lines; then one more gate on new diff files for the new range, and anything it still finds goes to the user.
7. **Long helpers.** A builder or fixer past 25 min with no report: check its worktree (`git log -3`, `git status`) and send it
   a short "report what you have" (SendMessage). A test-only failure goes to a fixer with the one failing file, not the area.
8. **Finish.**
   - Update the plan's progress log. **Only you write it**, once, here: builders put measured values in their reports
     (`numbers:` lines), never in the plan, so parallel tasks don't conflict on it. Keep the values from each report in the
     task's `note=` as you go.
   - **Map the issue to the PR.** The issue is the plan's `Issue: #<n>` line (added by `/plan-writer` on approval), or the
     small-job lane's issue. No issue (an older plan, or a request): start one `writer-issuer` (Sonnet · medium) with the
     issue packet from `../plan-writer/references/packets.md` (`issue: none`) before the PR, and add the `Issue:` line to the
     plan in the finish commit.
   - Commit, `git push -u origin claude/<topic>`, and `gh pr create --base master --body-file <file>` (write the body with
     Write; end it with the attribution line). Its first line is `Closes #<issue>`: `master` is the default branch, so this
     links the PR to the issue and closes it on merge.
   - Check the link: `gh pr view <pr> --json closingIssuesReferences` must list the issue. If it doesn't, fix the body
     (`gh pr edit <pr> --body-file <file>`) and check again.
   - Comment a brief on the issue (`gh issue comment <issue> --body-file <file>`): the PR link, what changed in 3-5 lines,
     and anything left for a device or browser check.
   - Comment the checker's result on the PR: `gh pr comment <n> --body-file <file>` with its web totals (tests, files,
     seconds) and its Android lines.
   - Bind the PR with the `ccd_pr` tools when this session has them and offer Auto-fix; otherwise give the PR link once.
   - Stop any helper still running (TaskStop), then `run_file.py end`: it removes the run's agent worktrees and their branches
     (it lists any it couldn't remove). Report the PR link and the issue it closes, then end the report with the usage table
     that `run_file.py end` prints (or `run_file.py usage`), turned into a markdown table with one row per helper: task, role,
     model, effort, calls, cost. After the rows, add a row per task total, the coordinator and the run total. Say that the
     cost is API-equivalent and that a subscription bills none.

## When `status` warns (guard recovery)
- **`session NOT bound yet` after the first Agent call:** neither a `plan-*` agent type nor the packet's first line named the
  run. Fix the call. The helpers already started are unguarded, so mention it.
- **`CANARY: no guard registration for …`:** the hooks aren't running (settings not loaded, Python missing). Carry on with the
  agent files' rules only and tell the user once.
- **`GUARD ERRORS: n`:** the guard let those calls through. From 3 errors,
  `python .claude/skills/plan-runner/scripts/guard.py off` for this run and tell the user.
- **A helper reports `blocked: guard <rule>`:** if the refusal was wrong,
  `python .claude/skills/plan-runner/scripts/guard.py allow <rule> <agentId>`, or `off <rule>` for the run. Then start a fresh
  helper with the handover.
- **A helper ends with no report:** read its worktree's `git log -3` and `git status`. Then start a fresh helper to finish,
  with a 5-line handover.
