# Advisor (shared by /plan-writer and /plan-runner)

The advisor takes the place of the user for decisions. Agent file: `.claude/agents/advisor.md` (Fable 5.1 · high, Read only, doesn't browse).

## When it is on
- The user asks for it: "use advisor", "advisor <model> <effort>" (for example `advisor opus high`, `advisor sonnet medium`),
  in the command or in chat. Without a model and effort the default is **Fable 5.1 · high** (`model: "fable"`, effort `high`).
  With them, pass the named `model` and `effort` on the Agent call.
- The setting lasts for the whole run. Say once at the start: "advisor on (Fable 5.1 · high)".

## What changes while it is on
- **Never ask the user** (no AskUserQuestion, no grill list, no "approve this?"). Every question goes to the advisor, and its
  `decision:` is taken as the user's answer. Mark such calls in the plan or PR as "advisor's call", not "user's".
- The advisor's `escalate:` is the only case that reaches the user: a spend, an account or store step, or a change to a
  decision the user already made. Everything else is decided.
- Approval gates the skill asks the user for (plan review, plan approval) go to the advisor as well. Steps that need the user's
  own hands stay theirs (a device or browser check, merging the pull request, a release).
- Memory: don't save the advisor's calls as the user's decisions.

## How to ask
1. Start `advisor` (Agent, `subagent_type: "advisor"`, foreground: your next step waits on it) with a packet:
   ```
   advice for <skill> run <topic>
   Question: <one question>
   Options: <each option with what it costs>, and your recommendation
   Context: <plan goal, the plan sections and memory lines that touch it, what is already decided>
   ```
   Keep the context to what the question needs, not the whole chat.
2. The advisor does not browse the repo. If it answers with `need:` lines, start a Haiku 5.5 searcher (`writer-searcher` or `plan-searcher`,
   whichever the skill owns) with those lines, then send its `found` lines to the advisor with SendMessage
   and take the new answer.
3. Batch related questions in one packet. Don't call the advisor for a fact you can read in one small read.
4. Name it in updates with its model and effort, e.g. "advisor (Fable 5.1 · high)".

## Cost
Fable 5.1 is the dearest model ($10 in / $50 out per million tokens, cache read $0.25): keep packets small and batch
questions. The usage table prices it like any other helper.
