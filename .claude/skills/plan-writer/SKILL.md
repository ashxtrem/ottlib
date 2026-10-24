---
name: plan-writer
description: Discuss and write an OttLib plan (plans/<topic>-plan.md) with the user, ready for /plan-runner. The main chat thinks on Opus · high (grill the open decisions with recommended answers, weigh options, draft); Haiku helpers fetch files and facts (writer-searcher) and run tests, builds or timings (writer-runner), with Sonnet as the runner only when a run needs judgement. On approval it saves the user's calls to memory, has a Sonnet issuer (writer-issuer) create or update the plan's GitHub issue (label planned), and commits the plan on claude/<topic>. Optionally a Fable 5.1 review of the finished plan when asked. Use it when the user says "/plan-writer", "plan this", "write a plan", "let's plan", "draft a plan for", or wants to discuss a feature before building it.
argument-hint: "<topic or idea>"
model: opus
effort: high
---

# Plan writer

Comes before `/plan-runner`: an idea goes in, an approved plan that the runner can split and build comes out.
AGENTS.md still applies (layering, small files, shared types, Tailwind, Android rules). `master` is PR-only: never push to it.

## Who does what
| Role | How to start it | Model · effort | Does |
|---|---|---|---|
| Thinker | you, the main chat | Opus · high (this skill's frontmatter) | talk with the user, decide, recommend, write the plan |
| Searcher | `subagent_type: "writer-searcher"` | Haiku · medium | files, `file:line`, old plans, AGENTS.md, config values; the plan check |
| Runner | `subagent_type: "writer-runner"` | Haiku · medium | a test file or suite, a build, a timing; raw results |
| Runner (judgement) | `writer-runner` with `model: "sonnet"` | Sonnet · medium | only when reading the run needs judgement: a flaky or tangled failure, a loop that picks the next value |
| Fable reviewer | `subagent_type: "writer-reviewer"` | Fable 5.1 · high | only when the user asks for a Fable review of the plan; reads the plan, asks for facts with `need:` lines |
| Issuer | `subagent_type: "writer-issuer"` | Sonnet · medium | once, on approval: drafts the GitHub issue from the plan and creates it (or comments the plan on the plan's issue), label `planned` |

- **All thinking stays with you:** options, trade-offs, recommendations, values to pick, the plan text. Helpers bring facts
  and raw results only.
- **Anything you'd look up goes to a searcher,** unless you already know the exact file and it's one small read. Several
  independent searches go out in one message, `run_in_background: true` unless your next step waits on them.
- Name a helper with its model and effort when you mention it ("searcher (Haiku · medium)").
- The frontmatter sets Opus · high only for the turn that invokes the skill; later turns fall back to the chat's model. In
  your first message, ask the user once to set the chat to Opus and high effort when it isn't on them.
- Edit the plan with Edit, never with `python`/`sed` replace scripts.

## Advisor mode
When the user says "use advisor" or "advisor <model> <effort>" (default **Fable 5.1 · high**), never ask the user: every grill
question, the plan review and the approval go to the `advisor` agent with the plan context, and its decision is taken as the
answer. When it needs code facts, a Haiku 5.5 searcher fetches them for it. Only its `escalate:` reaches the user. Mark such
calls "advisor's call" in the plan and don't save them to memory as the user's. Full rules: `../plan-runner/references/advisor.md`.

## Steps
1. **Intake.**
   - Start from today's code: `git fetch origin master`, and work on it (a fresh worktree or `git merge origin/master`).
   - For an issue: `gh issue view <n>`, then check it isn't already done (`gh pr list --search <n> --state all`,
     `git log origin/master --oneline --grep "#<n>"`). Keep the number for the plan's `Issue:` line (step 7).
   - In one short message: what you understood, what's in and out of scope, and the facts you're about to fetch. Don't ask
     questions yet unless the ask is unclear.
   - When the user asks whether it's worth doing ("analyse first", "is it needed", "user impact"), answer that first, after
     the sweep and before any question: a verdict, the impact on each client (web, TV, phone) and effort against value.
2. **Fact sweep.** 2–4 searchers in parallel with the search packet (`references/packets.md`): the code the change meets, the
   plans in `plans/` on the same systems, and the matching decisions in memory (you read `MEMORY.md` yourself). Add a runner
   only when a measured value today decides something (a scan's duration, a response's size, a test that may already fail).
   - **Probe the options before you offer them.** For each option you expect to put to the user, have a searcher confirm it can
     work today (the option-probe packet): the route, setting, column, provider or screen it relies on exists and behaves as
     assumed. An option that turns out impossible after the user picked it costs a whole extra round.
3. **Grill: at most 2 rounds** of up to 4 questions (AskUserQuestion, or a numbered list when they need explaining). Users
   take the recommended answer almost every time, so ask only what is theirs to decide:
   - **Ask:** scope (what's in, what's out), and behaviour the user sees (what a screen shows, what a setting does, which
     clients get it). Scope first.
   - **Decide yourself, as "my calls":** values (timeouts, limits, defaults), internals (file layout, patterns, test shape)
     and anything with one clear best answer. List them in the summary, each with its value and a one-line why, so the user
     can change any of them at approval.
   - A question that only comes up after the draft (a plan-check finding that changes a decision) may use one more round.
   - Each with your recommended answer first and why, and what the other option costs.
   - For a new pluggable piece (a metadata provider, a playback handoff), name the interface it implements (AGENTS.md
     plug-in pattern) and the option you rejected.
   - For UI: the web app at phone and desktop widths; on TV the D-pad focus path, initial focus and Back; on mobile the window
     width classes and the Fold's cover, inner and tabletop shapes.
   - When the user says "go as you recommend", take your recommendations and mark them as yours in the plan.
4. **Draft** `plans/<topic>-plan.md` in the shape of `references/plan-shape.md`. Each claim about today's code carries its
   `file:line`. The task table is what `/plan-runner` splits on: files, spec (`full` or `partial`), deps, 2–5 checks.
5. **Plan check.** One searcher with the check packet (two or three in parallel, one per part, for a plan over about 200
   lines). Fix each `wrong:` line in the draft with Edit; ask the user only when one changes a decision. Put its `reader:`
   lines (tests, contract fixtures and Kotlin DTOs that pin what the plan changes) in the matching tasks' checks.
   (`/plan-runner` checks again at its start, for plans written without this skill.)
5b. **Fable review (only when the user asked for it,** e.g. "review with Fable", before or after the plan is drafted; for a
   plan over about 250 lines, offer it once in the summary, one line). One `writer-reviewer` (Fable 5.1 · high) with the plan
   path, the memory lines it quotes and the plan check's `wrong:` lines, to save a `need:` round. It cannot start helpers:
   when it answers with `need:` lines, one searcher (Haiku 5.5) fetches them and you send the `found` lines back to it with
   SendMessage. Fix each `must:` in the draft, take the `should:` lines you agree with, and show the user what changed and
   what you declined. A `questions:` line is the user's call (the advisor's, when advisor mode is on). Cost note: Fable 5.1 is
   $10 in / $50 out per million tokens, so send it the plan path, not a pasted plan.
6. **Review with the user.** Give a short summary and the path: goal; the user's decisions; **my calls** (each with its value);
   **impact** (what changes on web, TV and phone, and effort against value in one line); tasks; risks. Iterate until they
   approve. Don't commit before approval.
7. **On approval:**
   - Write "Approved by the user (<date>: "<their words>")" under the title and "plan written and approved" in the progress
     log.
   - Save the user's calls to memory: update the matching memory file or add one, with a line in `MEMORY.md`. Calls only, not
     the plan's content.
   - **Track it as an issue.** One `writer-issuer` (Sonnet · medium) with the issue packet (`references/packets.md`), in the
     foreground: every plan gets an issue its pull request can close. With no issue (the plan came from a request), it drafts
     one from the plan and creates it; with an issue, it comments the approved plan on it. Both get the `planned` label, so
     `gh issue list --label planned` shows what we've picked. Then add `Issue: #<n>` on the line after "Approved by the user"
     with Edit. If it reports a `gh` error, tell the user and commit without the line.
   - Commit the plan on its run branch: `git fetch origin master`, then `git checkout -b claude/<topic> origin/master` (the
     untracked plan file comes along), `git add plans/<topic>-plan.md`, commit `Add the <topic> plan (#<n>)` with the
     attribution trailer. Don't push.
   - Then switch back to the branch you were on (`git checkout -`), so `claude/<topic>` is free for the runner's worktree.
   - Tell the user: the plan path, the branch, the issue link (created or commented), and to start the build with
     `/plan-runner plans/<topic>-plan.md` in a fresh session or after `/clear` (the runner carries on on `claude/<topic>`).
   - End with the usage: `python .claude/skills/plan-runner/scripts/transcripts.py session` (add `--since <ISO time>` when the
     chat did other work before this plan). Turn it into a markdown table, one row per helper (helper, task, model, calls,
     cost), then the totals per helper type, the main chat and the total. Say that the cost is API-equivalent (prices in its
     last line) and that a subscription bills none.

## Keep your context small
- Read helper reports, never whole files or logs. One small read is fine when you know exactly where to look.
- Keep chat messages short; the detail goes in the plan file.
