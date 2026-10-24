"""Tests for the plan runner's guard and run file. Run: python -m unittest discover -s .claude/skills/plan-runner/tests"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import guard  # noqa: E402
import run_file  # noqa: E402


class Repo:
    """A scratch repo with a main checkout and one agent worktree, like .claude/worktrees/agent-x."""

    def __init__(self):
        self.tmp = tempfile.mkdtemp(prefix="plan-runner-test-")
        self.main = os.path.join(self.tmp, "repo")
        self.wt = os.path.join(self.main, ".claude", "worktrees", "agent-x")
        os.makedirs(os.path.join(self.main, ".git", "worktrees", "agent-x"))
        os.makedirs(self.wt)
        with open(os.path.join(self.wt, ".git"), "w") as f:
            f.write("gitdir: %s\n" % os.path.join(self.main, ".git", "worktrees", "agent-x"))
        self.state = os.path.join(self.main, ".git", "plan-runner")

    def activate(self, run="r1", session="S", started=None, branch=""):
        guard.write_json(self.active_path(run), {"run": run, "started": started or time.time(), "session": session, "branch": branch})

    def active_path(self, run="r1"):
        return os.path.join(self.state, "active", run + ".json")

    def active(self, run="r1"):
        return guard.read_json(self.active_path(run), {})

    def ev(self, name, tool="", ti=None, agent="A", session="S", **kw):
        d = {"hook_event_name": name, "tool_name": tool, "tool_input": ti or {}, "agent_id": agent, "session_id": session, "cwd": self.wt}
        d.update(kw)
        return json.dumps(d)

    def hook(self, *a, **kw):
        return guard.hook_main(self.ev(*a, **kw))

    def log(self, run="r1"):
        p = os.path.join(self.state, "runs", run, "guard.log")
        if not os.path.exists(p):
            return []
        with open(p, encoding="utf8") as f:
            return [json.loads(l) for l in f]

    def close(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class GuardScope(unittest.TestCase):
    def setUp(self):
        self.r = Repo()

    def tearDown(self):
        self.r.close()

    def test_the_state_is_found_from_a_worktree_and_from_the_main_checkout(self):
        self.assertEqual(guard.state_dir(self.r.wt), self.r.state)
        self.assertEqual(guard.state_dir(self.r.main), self.r.state)

    def test_no_active_run_means_no_rule_acts(self):
        self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"})["exit"], 0)

    def test_a_stale_run_is_ignored(self):
        self.r.activate(started=time.time() - guard.STALE_SEC - 10)
        self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"})["exit"], 0)

    def test_the_main_chat_and_other_sessions_are_never_touched(self):
        self.r.activate()
        self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"}, agent="")["exit"], 0)
        self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"}, session="OTHER")["exit"], 0)

    def test_the_coordinators_first_agent_call_binds_the_session(self):
        self.r.activate(session="")
        self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"})["exit"], 0)  # not bound yet
        self.r.hook("PreToolUse", "Agent", {"prompt": "# plan-runner run r1 — T001"}, agent="")
        self.assertEqual(self.r.active()["session"], "S")
        self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"})["exit"], 2)

    def test_a_crew_agent_type_binds_the_session_without_the_packet_line(self):
        self.r.activate(session="")
        self.r.hook("PreToolUse", "Agent", {"prompt": "build it", "subagent_type": "general-purpose"}, agent="")
        self.assertEqual(self.r.active().get("session"), "")
        self.r.hook("PreToolUse", "Agent", {"prompt": "build it", "subagent_type": "plan-builder"}, agent="")
        self.assertEqual(self.r.active()["session"], "S")

    def test_the_bind_records_the_transcript_and_the_run_file_finds_it(self):
        mine = os.path.join(self.r.tmp, "sess.jsonl")
        with open(mine, "w", encoding="utf8") as f:
            f.write("{}\n")
        self.r.activate(session="")
        self.r.hook("PreToolUse", "Agent", {"prompt": "# plan-runner run r1 — T001"}, agent="", transcript_path=mine)
        act = self.r.active()
        self.assertEqual((act["session"], act["transcript"]), ("S", mine))
        cwd, old = os.getcwd(), os.environ.get("PLAN_RUNNER_PROJECTS")
        os.chdir(self.r.main)
        os.environ["PLAN_RUNNER_PROJECTS"] = os.path.join(self.r.tmp, "projects")   # never the real ~/.claude
        try:
            self.assertEqual(run_file._coordinators({}, act), [mine])
            self.assertEqual(run_file._coordinators({"coordinators": [mine]}, act), [mine])   # not added twice
            self.assertEqual(run_file._coordinators({}, dict(act, transcript=os.path.join(self.r.tmp, "gone.jsonl"))), [])
        finally:
            os.chdir(cwd)
            if old is None:
                os.environ.pop("PLAN_RUNNER_PROJECTS", None)
            else:
                os.environ["PLAN_RUNNER_PROJECTS"] = old


class GuardTwoRuns(unittest.TestCase):
    def setUp(self):
        self.r = Repo()
        self.r.activate("r1", session="", branch="claude/a")
        self.r.activate("r2", session="", branch="claude/b")
        self.old = os.environ.pop("PLAN_RUNNER_BRANCH", None)
        self.cwd = os.getcwd()
        os.chdir(self.r.wt)

    def tearDown(self):
        os.chdir(self.cwd)
        os.environ.pop("PLAN_RUNNER_BRANCH", None)
        if self.old is not None:
            os.environ["PLAN_RUNNER_BRANCH"] = self.old
        self.r.close()

    def push(self, session):
        return self.r.hook("PreToolUse", "Bash", {"command": "git push"}, session=session)["exit"]

    def test_each_session_binds_to_its_own_run_and_rules_act_only_there(self):
        self.r.hook("PreToolUse", "Agent", {"prompt": "# plan-runner run r2 — T001"}, agent="", session="S2")
        self.r.hook("PreToolUse", "Agent", {"prompt": "# plan-runner run r1 — T001"}, agent="", session="S1")
        self.assertEqual((self.r.active("r1")["session"], self.r.active("r2")["session"]), ("S1", "S2"))
        self.assertEqual((self.push("S1"), self.push("S2"), self.push("S3")), (2, 2, 0))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(guard.main(["off", "--run", "r1"]), 0)
        self.assertEqual((self.push("S1"), self.push("S2")), (0, 2))   # off for r1 only
        self.assertEqual(len(self.r.log("r1")) - 1, 1)   # one refusal, then the config line
        self.assertEqual([e["kind"] for e in self.r.log("r2")], ["refuse", "refuse"])

    def test_a_packet_id_that_is_a_prefix_of_another_binds_the_exact_run(self):
        self.r.activate("r10", session="", branch="claude/c")
        self.r.hook("PreToolUse", "Agent", {"prompt": "# plan-runner run r10 — T001"}, agent="", session="S9")
        self.assertEqual((self.r.active("r10")["session"], self.r.active("r1")["session"]), ("S9", ""))

    def test_a_crew_agent_binds_by_branch_when_the_packet_names_no_run(self):
        os.environ["PLAN_RUNNER_BRANCH"] = "claude/b"
        self.r.hook("PreToolUse", "Agent", {"prompt": "build", "subagent_type": "plan-builder"}, agent="", session="S2")
        self.assertEqual((self.r.active("r1")["session"], self.r.active("r2")["session"]), ("", "S2"))
        os.environ["PLAN_RUNNER_BRANCH"] = "claude/zzz"   # r2 is taken: r1 is the only free run
        self.r.hook("PreToolUse", "Agent", {"prompt": "build", "subagent_type": "plan-builder"}, agent="", session="S1")
        self.assertEqual(self.r.active("r1")["session"], "S1")

    def test_an_unmatched_crew_agent_binds_nothing_when_runs_are_ambiguous(self):
        os.environ["PLAN_RUNNER_BRANCH"] = "claude/zzz"
        self.r.hook("PreToolUse", "Agent", {"prompt": "build", "subagent_type": "plan-builder"}, agent="", session="S1")
        self.assertEqual((self.r.active("r1")["session"], self.r.active("r2")["session"]), ("", ""))


class GuardRules(unittest.TestCase):
    def setUp(self):
        self.r = Repo()
        self.r.activate()
        self.r.hook("SubagentStart", agent_type="general-purpose")

    def tearDown(self):
        self.r.close()

    def bash(self, cmd):
        return self.r.hook("PreToolUse", "Bash", {"command": cmd})["exit"]

    def test_dev_servers_and_watchers_are_refused_unless_backgrounded(self):
        for cmd in ("npm run dev", "npm start", "npm run dev --workspace @ottlib/client", "npx vite", "vite --port 5173",
                    "npx vitest --root packages/server", "npx vitest watch", "npx tsx watch src/index.ts", "tsc -b --watch",
                    "node --watch dist/index.js", "apps/android/gradlew -p apps/android :tv:test --continuous"):
            self.assertEqual(self.bash(cmd), 2, cmd)
        self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "npm run dev", "run_in_background": True})["exit"], 0)
        for cmd in ("npm run build", "npx vite build", "npx tsc -b", "npx vitest run --root packages/server",
                    "npm test --workspace @ottlib/server -- titleParser"):
            self.assertEqual(self.bash(cmd), 0, cmd)

    def test_whole_suites_and_branch_work_are_refused(self):
        self.assertEqual(self.bash("npm test"), 2)
        self.assertEqual(self.bash("apps/android/gradlew -p apps/android test"), 2)
        for cmd in ("git push -u origin x", "git merge y", "git rebase main", "git switch y", "git stash", "git reset --hard",
                    "git checkout other", "gh pr create", "git branch -D y"):
            self.assertEqual(self.bash(cmd), 2, cmd)
        for cmd in ("git add -A && git commit -m x", "git diff --stat", "git checkout -- a.ts", "git log --oneline -3"):
            self.assertEqual(self.bash(cmd), 0, cmd)

    def test_read_only_crew_types_cannot_change_files(self):
        for kind in guard.READ_ONLY_TYPES:
            self.r.hook("SubagentStart", agent="R", agent_type=kind)
            run = lambda cmd: self.r.hook("PreToolUse", "Bash", {"command": cmd}, agent="R")["exit"]
            self.assertEqual(run("git add -A && git commit -m x"), 2, kind)
            self.assertEqual(run("git checkout -- a.ts"), 2, kind)
            self.assertEqual(run("git diff a..b -- x.ts && git log -3"), 0, kind)
            self.assertEqual(self.r.hook("PreToolUse", "Edit", {"file_path": os.path.join(self.r.wt, "a.ts")}, agent="R")["exit"], 2, kind)
        self.assertEqual(self.bash("git add -A && git commit -m x"), 0)   # a builder still commits

    def test_the_agent_type_on_the_event_counts_without_a_registration(self):
        ev = {"command": "git commit -m x"}
        self.assertEqual(self.r.hook("PreToolUse", "Bash", ev, agent="Z", agent_type="plan-gate")["exit"], 2)
        self.assertEqual(self.r.hook("PreToolUse", "Bash", ev, agent="Z", agent_type="plan-builder")["exit"], 0)

    def test_only_the_checker_runs_whole_suites(self):
        self.r.hook("SubagentStart", agent="C", agent_type="plan-checker")
        whole = {"command": "npm test"}
        self.assertEqual(self.r.hook("PreToolUse", "Bash", whole, agent="C")["exit"], 0)
        self.assertEqual(self.r.hook("PreToolUse", "Bash", whole)["exit"], 2)

    def test_every_form_of_a_whole_suite_run_is_refused(self):
        self.r.hook("SubagentStart", agent="C", agent_type="plan-checker")
        refused = ("npm test", "npm t", "npm run test", "npm.cmd test", "npm test --workspaces", "npm test -ws -- x",
                   "npx vitest run", "npx --yes vitest run", "node_modules/.bin/vitest run",
                   "apps/android/gradlew -p apps/android test", "bash apps/android/gradlew -p apps/android check",
                   "apps/android/gradlew.bat -p apps/android testDebugUnitTest", "./gradlew build --stacktrace",
                   "cd apps/android && ./gradlew test")
        for cmd in refused:
            self.assertEqual(self.bash(cmd), 2, cmd)
            self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": cmd}, agent="C")["exit"], 0, cmd)
        for cmd in ("npm test --workspace @ottlib/server", "npm test -w @ottlib/client -- PosterGrid", "npm test --workspace=@ottlib/shared",
                    "npx vitest run src/x.test.ts", "npx vitest run --root packages/server",
                    "apps/android/gradlew -p apps/android :core:model:test", "./gradlew test --tests '*Contract*'",
                    "./gradlew :tv:compileDebugKotlin :mobile:compileDebugKotlin", "npm run build --workspace @ottlib/shared"):
            self.assertEqual(self.bash(cmd), 0, cmd)

    def test_wrapped_whole_suite_runs_are_refused(self):
        wrapped = ("timeout -s KILL 600 npm test",
                   "timeout --kill-after 5 --foreground 600 npm test",
                   "bash -c \"npm test\"",
                   "env CI=1 npm test",
                   "nohup timeout -s TERM 900 env A=b npm run test",
                   "time npx vitest run",
                   "nice -n 5 ./gradlew test",
                   "bash <<'EOS'\nnpm test\nEOS",
                   "bash -s <<EOS\nnpm run dev\nEOS")
        for cmd in wrapped:
            self.assertEqual(self.bash(cmd), 2, cmd)
        for cmd in ("timeout -s KILL 600 npm test --workspace @ottlib/server -- a",
                    "env CI=1 npx vitest run src/a.test.ts",
                    "cat > note.md <<'EOF'\nnpm test passes\nEOF"):
            self.assertEqual(self.bash(cmd), 0, cmd)

    def test_the_new_report_starts_pass(self):
        for msg in ("found\nsrc/a.ts:12 — the spawn table", "cause: the typed array\nfix: append()", "checks pass\nimport ok"):
            self.assertEqual(self.r.hook("SubagentStop", last_assistant_message=msg)["stdout"], "", msg)

    def test_writes_stay_in_the_worktree(self):
        inside = os.path.join(self.r.wt, "src", "a.ts")
        outside = os.path.join(self.r.main, "src", "a.ts")
        self.assertEqual(self.r.hook("PreToolUse", "Edit", {"file_path": inside})["exit"], 0)
        self.assertEqual(self.r.hook("PreToolUse", "Edit", {"file_path": outside})["exit"], 2)
        # status names what was refused, so a false refusal can be told from a real one
        self.assertEqual(guard.health(guard.Run(self.r.wt))["refusals"][-1].get("path"), outside)

    def test_scratch_scripts_may_go_in_the_scratchpad(self):
        scratch = os.path.join(guard.scratch_root(), "proj", "session", "scratchpad", "edit.py")
        self.assertEqual(self.r.hook("PreToolUse", "Write", {"file_path": scratch})["exit"], 0)

    def test_no_nested_agents(self):
        self.assertEqual(self.r.hook("PreToolUse", "Agent", {"prompt": "x"})["exit"], 2)

    def test_the_image_budget_and_size(self):
        for i in range(guard.IMAGE_BUDGET):
            self.assertEqual(self.r.hook("PreToolUse", "Read", {"file_path": os.path.join(self.r.wt, "s%d.png" % i)})["exit"], 0)
        self.assertEqual(self.r.hook("PreToolUse", "Read", {"file_path": os.path.join(self.r.wt, "z.png")})["exit"], 2)
        big = os.path.join(self.r.wt, "big.png")
        with open(big, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\x0dIHDR" + (3000).to_bytes(4, "big") + (2000).to_bytes(4, "big"))
        self.r.hook("SubagentStart", agent="B")
        self.assertEqual(self.r.hook("PreToolUse", "Read", {"file_path": big}, agent="B")["exit"], 2)

    def test_long_files_are_read_by_range(self):
        p = os.path.join(self.r.wt, "long.ts")
        with open(p, "w") as f:
            f.write("line\n" * (guard.READ_MAX_LINES + 1))
        self.assertEqual(self.r.hook("PreToolUse", "Read", {"file_path": p})["exit"], 2)
        self.assertEqual(self.r.hook("PreToolUse", "Read", {"file_path": p, "offset": 10, "limit": 40})["exit"], 0)

    def test_big_output_gets_a_note_not_a_block(self):
        out = self.r.hook("PostToolUse", "Bash", {"command": "cat x"}, tool_response={"stdout": "y" * (guard.BIG_OUTPUT_CHARS + 1)})
        self.assertEqual(out["exit"], 0)
        self.assertIn("big_output", out["stdout"])

    def test_the_report_format_is_sent_back_once(self):
        long = self.r.hook("SubagentStop", last_assistant_message="I did many things\n" * 30)
        self.assertIn('"block"', long["stdout"])
        again = self.r.hook("SubagentStop", last_assistant_message="I did many things\n" * 30, stop_hook_active=True)
        self.assertEqual(again["stdout"], "")
        good = self.r.hook("SubagentStop", last_assistant_message="done T001 abc1234\nfiles: a.ts:3 — x\ntests: h 4/4")
        self.assertEqual(good["stdout"], "")
        self.assertEqual(self.r.hook("SubagentStop", last_assistant_message="**done** T002 abc")["stdout"], "")
        self.assertEqual(self.r.hook("SubagentStop", last_assistant_message="")["stdout"], "")  # reported by hand-back

    def test_a_searchers_found_report_may_run_to_30_lines(self):
        found = "found\n" + "reader: T1 tests/a_test.ts:3 — pins x\n" * 25
        self.assertEqual(self.r.hook("SubagentStop", last_assistant_message=found)["stdout"], "")
        done = "done T001 abc\n" + "files: a.ts:3 — x\n" * 20
        self.assertIn('"block"', self.r.hook("SubagentStop", last_assistant_message=done)["stdout"])

    def test_every_refusal_says_how_to_get_unblocked(self):
        out = self.r.hook("PreToolUse", "Bash", {"command": "git push"})
        self.assertIn("blocked: guard git_ops", out["stderr"])


class GuardRecovery(unittest.TestCase):
    def setUp(self):
        self.r = Repo()
        self.r.activate()
        self.r.hook("SubagentStart")
        self.cwd = os.getcwd()
        os.chdir(self.r.main)

    def tearDown(self):
        os.chdir(self.cwd)
        self.r.close()

    def test_an_error_inside_the_guard_lets_the_call_through_and_is_logged(self):
        real = guard._pre

        def broken(*a):
            raise KeyError("bug")
        guard._pre = broken
        try:
            out = self.r.hook("PreToolUse", "Bash", {"command": "git push"})
        finally:
            guard._pre = real
        self.assertEqual(out["exit"], 0)
        self.assertEqual([e["kind"] for e in self.r.log()][-1], "error")
        self.assertEqual(guard.health(guard.Run(self.r.main))["errors"], 1)

    def test_bad_input_fails_open(self):
        self.assertEqual(guard.hook_main("{broken")["exit"], 0)
        self.assertEqual(guard.hook_main("")["exit"], 0)

    def test_a_rule_can_be_turned_off_and_on_and_the_whole_guard_too(self):
        with contextlib.redirect_stdout(io.StringIO()):
            guard.main(["off", "git_ops"])
            self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"})["exit"], 0)
            guard.main(["on", "git_ops"])
            self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"})["exit"], 2)
            guard.main(["off"])
            self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"})["exit"], 0)
            guard.main(["on"])
            self.assertEqual(self.r.hook("PreToolUse", "Bash", {"command": "git push"})["exit"], 2)

    def test_a_one_agent_allow(self):
        with contextlib.redirect_stdout(io.StringIO()):
            guard.main(["allow", "no_agents", "A"])
        self.assertEqual(self.r.hook("PreToolUse", "Agent", {"prompt": "x"})["exit"], 0)
        self.r.hook("SubagentStart", agent="B")
        self.assertEqual(self.r.hook("PreToolUse", "Agent", {"prompt": "x"}, agent="B")["exit"], 2)

    def test_an_unknown_rule_is_refused_by_the_command(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(guard.main(["off", "nonsense"]), 1)

    def test_the_selftest_passes(self):
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            self.assertEqual(guard.selftest(), 0)
        self.assertIn("selftest: passed", buf.getvalue())


class RunFile(unittest.TestCase):
    def setUp(self):
        self.r = Repo()
        self.cwd = os.getcwd()
        os.chdir(self.r.wt)
        self.old_env = {k: os.environ.pop(k, None) for k in ("CLAUDE_CODE_SESSION_ID", "PLAN_RUNNER_BRANCH")}

    def tearDown(self):
        os.chdir(self.cwd)
        for k, v in self.old_env.items():
            os.environ.pop(k, None)
            if v is not None:
                os.environ[k] = v
        self.r.close()

    def run_cmd(self, *args):
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            run_file.main(list(args))
        return buf.getvalue()

    def test_tasks_become_ready_when_their_dependencies_are_merged(self):
        self.run_cmd("begin", "r1", "--plan", "plans/x-plan.md", "--branch", "claude/x")
        self.run_cmd("task", "T1", "Data", "--model", "haiku")
        self.run_cmd("task", "T2", "View", "--deps", "T1")
        self.run_cmd("task", "T3", "Pager")
        self.assertEqual(self.run_cmd("ready").strip(), "T1 T3")
        self.run_cmd("set", "T1", "status=merged", "commit=abc1234", "tokens=1200")
        self.assertEqual(self.run_cmd("ready").strip(), "T2 T3")

    def test_an_early_dependency_only_needs_to_be_built(self):
        self.run_cmd("begin", "r1", "--plan", "plans/x-plan.md", "--branch", "claude/x")
        self.run_cmd("task", "T1", "Loaner")
        self.run_cmd("task", "T2", "Measure", "--early-deps", "T1")
        self.run_cmd("task", "T3", "Loss flow", "--deps", "T1")
        self.assertEqual(self.run_cmd("ready").strip(), "T1")
        self.run_cmd("set", "T1", "status=review", "commit=abc1234")
        self.assertEqual(self.run_cmd("ready").strip(), "T2")
        self.run_cmd("set", "T1", "status=merged")
        self.assertEqual(self.run_cmd("ready").strip(), "T2 T3")

    def test_a_note_with_an_arrow_prints(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        self.assertIn("→", self.run_cmd("set", "T1", "note=resume_route → T4"))

    def test_status_shows_the_guards_health_and_the_canary(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        self.run_cmd("set", "T1", "status=building", "agent=A9")
        out = self.run_cmd("status")
        self.assertIn("NOT bound yet", out)
        self.assertIn("CANARY", out)  # A9 never reached the guard
        self.r.activate(session="S")
        self.r.hook("SubagentStart", agent="A9")
        self.assertNotIn("CANARY", self.run_cmd("status"))

    def test_runs_are_active_at_once_and_found_by_branch_or_by_run_id(self):
        self.run_cmd("begin", "r1", "--branch", "claude/a")
        self.run_cmd("begin", "r2", "--branch", "claude/b")
        self.assertEqual(sorted(a["run"] for a in guard.active_runs(self.r.state)), ["r1", "r2"])
        os.environ["PLAN_RUNNER_BRANCH"] = "claude/b"
        self.run_cmd("task", "T1", "Data")   # the branch picks r2
        self.assertEqual(run_file._load()[1], "r2")
        self.run_cmd("task", "--run", "r1", "T9", "Other")   # --run anywhere in the arguments wins over the branch
        os.environ.pop("PLAN_RUNNER_BRANCH")
        self.assertEqual(json.loads(self.run_cmd("show", "--run", "r1"))["order"], ["T9"])
        self.assertEqual(json.loads(self.run_cmd("show", "--run", "r2"))["order"], ["T1"])
        self.assertEqual(os.path.basename(guard.Run(self.r.wt, rid="r1").dir), "r1")

    def test_several_runs_and_no_match_asks_for_run(self):
        self.run_cmd("begin", "r1", "--branch", "claude/a")
        self.run_cmd("begin", "r2", "--branch", "claude/b")
        os.environ["PLAN_RUNNER_BRANCH"] = "claude/other"
        with self.assertRaises(SystemExit) as cm:
            self.run_cmd("status")
        self.assertIn("--run", str(cm.exception))
        self.assertIn("r1", str(cm.exception))
        with self.assertRaises(SystemExit):
            self.run_cmd("show", "--run", "nope")
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            self.assertEqual(guard.main(["off"]), 1)
        self.assertIn("--run", buf.getvalue())

    def test_the_only_run_needs_no_branch_or_run_id(self):
        self.run_cmd("begin", "r1", "--branch", "claude/a")
        os.environ["PLAN_RUNNER_BRANCH"] = "claude/elsewhere"
        self.assertEqual(run_file._load()[1], "r1")

    def test_begin_is_refused_in_the_main_checkout(self):
        os.chdir(self.r.main)
        with self.assertRaises(SystemExit) as cm:
            self.run_cmd("begin", "r1")
        self.assertIn("EnterWorktree", str(cm.exception))
        os.chdir(self.r.wt)
        self.assertEqual(guard.active_runs(self.r.state), [])

    def test_begin_refuses_a_run_bound_to_another_live_chat_but_resumes_its_own(self):
        self.run_cmd("begin", "r1")
        self.r.activate(run="r1", session="S1")
        os.environ["CLAUDE_CODE_SESSION_ID"] = "S2"
        with self.assertRaises(SystemExit) as cm:
            self.run_cmd("begin", "r1")
        self.assertIn("another chat", str(cm.exception))
        self.run_cmd("begin", "r2")   # a different id is fine
        os.environ["CLAUDE_CODE_SESSION_ID"] = "S1"
        self.assertIn("active", self.run_cmd("begin", "r1"))   # its own chat resumes
        self.r.activate(run="r1", session="S1")
        del os.environ["CLAUDE_CODE_SESSION_ID"]
        self.assertIn("active", self.run_cmd("begin", "r1"))   # caller unknown: not refused

    def test_a_run_bound_to_a_chat_that_went_quiet_can_be_resumed(self):
        old = os.path.join(self.r.tmp, "left.jsonl")
        with open(old, "w") as f:
            f.write("{}\n")
        t = time.time() - run_file.LIVE_SEC - 60
        os.utime(old, (t, t))
        self.r.activate(run="r1", session="S1")
        act = self.r.active()
        act["transcript"] = old
        guard.write_json(self.r.active_path(), act)
        os.environ["CLAUDE_CODE_SESSION_ID"] = "S2"
        self.assertIn("active", self.run_cmd("begin", "r1"))

    def test_a_legacy_active_file_is_one_more_entry_and_is_never_touched(self):
        legacy = os.path.join(self.r.state, "active.json")
        guard.write_json(legacy, {"run": "old", "started": time.time(), "branch": "claude/o", "session": "SO"})
        self.assertEqual([a["run"] for a in guard.active_runs(self.r.state)], ["old"])
        self.assertTrue(guard.Run(self.r.wt).ok)
        self.assertTrue(guard.Run(self.r.wt, session="SO").ok)
        self.assertEqual(run_file._load()[1], "old")
        self.assertEqual(guard.read_json(legacy, {})["run"], "old")   # an old-style reader still finds it
        self.assertFalse(os.path.exists(self.r.active_path("old")))
        self.run_cmd("begin", "old", "--branch", "claude/o")   # a resume writes the new file; it wins over the legacy one
        self.assertTrue(os.path.exists(self.r.active_path("old")))
        self.assertEqual(len(guard.active_runs(self.r.state)), 1)
        self.assertTrue(os.path.exists(legacy))

    def test_end_removes_the_active_file_and_the_legacy_one_naming_the_run(self):
        legacy = os.path.join(self.r.state, "active.json")
        guard.write_json(legacy, {"run": "old", "started": time.time()})
        self.run_cmd("begin", "old")
        self.run_cmd("end", "--run", "old")
        self.assertFalse(os.path.exists(legacy))
        self.assertFalse(os.path.exists(self.r.active_path("old")))
        guard.write_json(legacy, {"run": "other", "started": time.time()})
        self.run_cmd("begin", "r1")
        self.run_cmd("end", "--run", "r1")
        self.assertTrue(os.path.exists(legacy))   # names another run: kept

    def test_end_removes_only_its_own_active_file(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("begin", "r2")
        self.assertIn("ended", self.run_cmd("end", "--run", "r1"))
        self.assertFalse(os.path.exists(self.r.active_path("r1")))
        self.assertTrue(os.path.exists(self.r.active_path("r2")))
        self.assertEqual(run_file._load()[1], "r2")

    def test_end_turns_the_guard_off(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("end")
        self.assertFalse(guard.Run(self.r.wt).ok)


if __name__ == "__main__":
    unittest.main()
