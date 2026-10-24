"""Tests for the run file: tasks, usage and cost, the coordinator check, merge and cleanup. Run: python -m unittest discover -s .claude/skills/plan-runner/tests
Everything lives in temp folders: PLAN_RUNNER_PROJECTS points the transcript root at one, the repo is a scratch repo."""
import contextlib
import io
import json
import os
import sys
import tempfile
import time
import shutil
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
sys.path.insert(0, HERE)
import guard  # noqa: E402
import run_file  # noqa: E402
import transcripts  # noqa: E402
from test_guard import Repo  # noqa: E402
from test_transcripts import line, write_lines  # noqa: E402


class RunUsage(unittest.TestCase):
    def setUp(self):
        self.r = Repo()
        self.cwd = os.getcwd()
        os.chdir(self.r.wt)
        self.proj = tempfile.mkdtemp(prefix="plan-runner-proj-")
        self.old_env = os.environ.get("PLAN_RUNNER_PROJECTS")
        os.environ["PLAN_RUNNER_PROJECTS"] = self.proj
        self.folder = os.path.join(self.proj, transcripts.slug(os.getcwd()))
        self.old_sid = os.environ.pop("CLAUDE_CODE_SESSION_ID", None)   # the session running the tests must not leak in

    def tearDown(self):
        os.chdir(self.cwd)
        os.environ.pop("CLAUDE_CODE_SESSION_ID", None)
        if self.old_sid is not None:
            os.environ["CLAUDE_CODE_SESSION_ID"] = self.old_sid
        if self.old_env is None:
            os.environ.pop("PLAN_RUNNER_PROJECTS", None)
        else:
            os.environ["PLAN_RUNNER_PROJECTS"] = self.old_env
        shutil.rmtree(self.proj, ignore_errors=True)
        self.r.close()

    def run_cmd(self, *args):
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            run_file.main(list(args))
        return buf.getvalue()

    def coordinator(self, context):
        os.environ["CLAUDE_CODE_SESSION_ID"] = "sess1"   # this chat, as Claude Code tells every command it runs
        write_lines(os.path.join(self.folder, "sess1.jsonl"), [line("c1", model="claude-opus-5-5", cr=context, out=20)])

    def test_begin_warns_over_150k_and_stays_quiet_under_it(self):
        self.coordinator(160_000)
        out = self.run_cmd("begin", "r1")
        self.assertIn("WARNING", out)
        self.assertIn("/clear", out)
        self.assertIn("active", out)  # not refused: the run started
        self.run_cmd("end")
        self.coordinator(40_000)
        out = self.run_cmd("begin", "r2")
        self.assertNotIn("WARNING", out)
        self.assertEqual(run_file._load()[2]["context_at_begin"], 40_000)

    def test_begin_without_a_transcript_says_so_and_still_starts(self):
        out = self.run_cmd("begin", "r1")
        self.assertIn("not found", out)
        self.assertIn("active", out)

    def test_begin_never_guesses_the_newest_file_in_the_folder(self):
        write_lines(os.path.join(self.folder, "sess1.jsonl"), [line("c1", model="claude-opus-5-5", cr=160_000)])   # a concurrent chat's file
        out = self.run_cmd("begin", "r1")
        self.assertIn("unknown", out)
        self.assertNotIn("WARNING", out)
        self.assertIn("active", out)
        self.assertEqual(run_file._load()[2].get("coordinators"), [])
        self.assertIn("coordinator: no transcript found", self.run_cmd("usage"))

    def test_begin_prefers_the_guards_recorded_transcript_over_the_newest_file(self):
        mine = os.path.join(self.folder, "mine.jsonl")
        write_lines(mine, [line("c1", model="claude-opus-5-5", cr=170_000)])
        write_lines(os.path.join(self.folder, "other.jsonl"), [line("c2", model="claude-opus-5-5", cr=1_000)])   # newer, a concurrent session
        now = time.time()
        os.utime(mine, (now - 30, now - 30))
        self.r.activate(run="r1", session="S")
        act = self.r.active()
        act["transcript"] = mine
        guard.write_json(self.r.active_path(), act)
        out = self.run_cmd("begin", "r1")
        self.assertIn("WARNING", out)
        self.assertEqual(run_file._load()[2]["coordinators"], [mine])
        # the bound session id alone finds it too, and another run's record is not used
        self.r.activate(run="r1", session="mine")
        self.assertEqual(run_file._known_transcript(self.r.active(), "r1"), mine)
        self.assertEqual(run_file._known_transcript(self.r.active(), "r2"), "")

    def test_begin_soon_after_clear_reads_this_chats_own_transcript_by_its_session_id(self):
        left = os.path.join(self.folder, "left.jsonl")   # the big chat left by /clear a moment ago: still within LIVE_SEC
        write_lines(left, [line("c1", model="claude-opus-5-5", cr=600_000)])
        mine = os.path.join(self.folder, "S2.jsonl")
        write_lines(mine, [line("c2", model="claude-opus-5-5", cr=20_000)])
        now = time.time()
        os.utime(left, (now - 10, now - 10))
        os.utime(mine, (now - 20, now - 20))   # even when the left file looks newer
        os.environ["CLAUDE_CODE_SESSION_ID"] = "S2"
        out = self.run_cmd("begin", "r1")
        self.assertNotIn("WARNING", out)
        self.assertEqual(run_file._load()[2]["coordinators"], [mine])

    def test_begin_with_a_corrupt_active_file_still_starts(self):
        self.r.activate(run="r1", session=12345)   # not a string
        act = self.r.active()
        act["started"] = "yesterday"
        guard.write_json(self.r.active_path(), act)
        out = self.run_cmd("begin", "r1")
        self.assertIn("active", out)
        act = self.r.active()   # begin rewrote it: damage it again for usage
        act.update({"session": 12345, "transcript": ["x"]})
        guard.write_json(self.r.active_path(), act)
        self.assertIn("Cost is API-equivalent", self.run_cmd("usage"))

    def test_a_damaged_run_file_or_run_id_does_not_crash_usage_or_end(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        st, rid, _ = run_file._load()
        guard.write_json(run_file._run_path(st, rid), {"started": "noon", "coordinators": [1, None], "tasks": "?"})
        self.assertIn("Cost is API-equivalent", self.run_cmd("usage"))
        self.assertIn("ended", self.run_cmd("end"))
        guard.write_json(self.r.active_path("r1"), {"run": 5})
        with self.assertRaises(SystemExit):
            run_file._load()

    def test_usage_and_end_mend_a_run_file_whose_coordinators_is_not_a_list(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        st, rid, run = run_file._load()
        run["coordinators"] = "oops"
        run_file._save(st, rid, run)
        out = self.run_cmd("usage")   # no crash: the bad value is replaced by the chat's own transcript
        self.assertIn("coordinator", out)
        self.assertIsInstance(run_file._load()[2]["coordinators"], list)
        self.assertIn("ended", self.run_cmd("end"))

    def test_begin_with_an_unreadable_transcript_still_starts(self):
        os.makedirs(os.path.join(self.folder, "broken.jsonl"))   # a folder where the file should be: reading it fails
        os.environ["CLAUDE_CODE_SESSION_ID"] = "broken"
        out = self.run_cmd("begin", "r1")
        self.assertIn("active", out)
        self.assertIn("not checked", out)
        self.run_cmd("task", "T1", "Data")
        self.assertIn("coordinator: no transcript found", self.run_cmd("usage"))
        self.assertIn("ended", self.run_cmd("end"))

    def test_begin_says_when_the_context_size_cannot_be_read(self):
        os.makedirs(self.folder)
        os.environ["CLAUDE_CODE_SESSION_ID"] = "huge"
        with open(os.path.join(self.folder, "huge.jsonl"), "w", encoding="utf8") as f:
            f.write(line("c1", model="claude-opus-5-5", cr=500_000) + "x" * 2_100_000 + "\n")   # one line longer than the 2 MB tail
        out = self.run_cmd("begin", "r1")
        self.assertIn("context size unreadable", out)
        self.assertNotIn("WARNING", out)
        self.assertIsNone(run_file._load()[2]["context_at_begin"])

    def test_begin_on_a_resumed_run_clears_ended(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        self.run_cmd("end")
        self.assertIn("ended", guard.read_json(run_file._run_path(self.r.state, "r1"), {}))
        self.run_cmd("begin", "r1")
        self.assertNotIn("ended", run_file._load()[2])

    def test_role_must_be_a_known_one_and_come_with_an_agent(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        for args in (["agent=A1", "role=boss"], ["role=reviewer"], ["role="], ["status=building", "role=fixer"]):
            with self.assertRaises(SystemExit, msg=str(args)):
                self.run_cmd("set", "T1", *args)
        t = run_file._load()[2]["tasks"]["T1"]
        self.assertEqual((t["agents"], t["status"]), ([], "todo"))   # a refused call changes nothing
        self.run_cmd("set", "T1", "role=worker", "agent=A1")
        self.assertEqual(run_file._load()[2]["tasks"]["T1"]["agents"], [{"id": "A1", "role": "worker"}])

    def test_agents_keep_their_roles_and_the_old_agent_form_still_works(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        self.run_cmd("set", "T1", "status=building", "agent=A1")
        self.run_cmd("set", "T1", "status=review", "agent=A2", "role=reviewer", "tokens=1234")
        self.run_cmd("set", "T1", "agent=A3", "role=fixer")
        self.run_cmd("set", "T1", "agent=A2")  # repeating an id adds nothing
        t = run_file._load()[2]["tasks"]["T1"]
        self.assertEqual(t["agents"], [{"id": "A1", "role": "worker"}, {"id": "A2", "role": "reviewer"}, {"id": "A3", "role": "fixer"}])
        self.assertEqual((t["agent"], t["tokens"]), ("A2", 1234))
        self.assertNotIn("role", t)

    def test_a_run_file_from_before_the_list_gets_its_old_agent_as_worker(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        st, rid, run = run_file._load()
        run["tasks"]["T1"].pop("agents")
        run["tasks"]["T1"]["agent"] = "OLD"
        run_file._save(st, rid, run)
        self.run_cmd("set", "T1", "agent=NEW", "role=fixer")
        self.assertEqual(run_file._load()[2]["tasks"]["T1"]["agents"], [{"id": "OLD", "role": "worker"}, {"id": "NEW", "role": "fixer"}])

    def test_usage_sums_per_agent_and_task_and_prices_the_models(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        helpers = os.path.join(self.folder, "sess1", "subagents")
        write_lines(os.path.join(helpers, "agent-W1.jsonl"), [line("a", inp=0, cw=0, cr=1_000_000, out=0), line("a", cr=1_000_000, out=0)])
        write_lines(os.path.join(helpers, "agent-R1.jsonl"), [line("b", model="claude-mystery-9", cr=500_000, out=100)])
        self.run_cmd("set", "T1", "agent=W1")
        self.run_cmd("set", "T1", "agent=agent-R1", "role=reviewer")  # the notice may carry the prefix
        out = self.run_cmd("usage")
        self.assertIn("worker", out)
        self.assertIn("$0.20", out)   # 1M cache read on Sonnet, the 3-line... 2-line call counted once
        self.assertIn("?", out)       # the unknown model
        self.assertIn("RUN TOTAL", out)
        self.assertIn("final context size", out)
        self.assertIn("2x input", out)
        self.assertNotIn("no transcript found", out)

    def test_tasks_keep_their_spec_and_checks(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data", "--spec", "partial", "--checks", "hub list shows 8; ; save keeps the order")
        t = run_file._load()[2]["tasks"]["T1"]
        self.assertEqual((t["spec"], t["checks"]), ("partial", ["hub list shows 8", "save keeps the order"]))
        self.assertIn("partial", self.run_cmd("status"))
        self.run_cmd("task", "T2", "Docs")
        self.assertEqual(run_file._load()[2]["tasks"]["T2"]["spec"], "full")
        with self.assertRaises(SystemExit):
            self.run_cmd("task", "T3", "X", "--spec", "vague")

    def test_cost_text_is_the_table_cell_not_the_rounded_cost(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        helpers = os.path.join(self.folder, "sess1", "subagents")
        write_lines(os.path.join(helpers, "agent-W1.jsonl"), [line("a", cr=24_755, out=0)])   # Sonnet: 24755 * 0.20 / 1e6 = 0.004951
        write_lines(os.path.join(helpers, "agent-M1.jsonl"), [line("m", model="claude-mystery-9", cr=1000, out=1)])
        self.run_cmd("set", "T1", "agent=W1")
        self.run_cmd("set", "T1", "agent=M1")
        self.run_cmd("set", "T1", "agent=GHOST", "role=fixer")
        data = json.loads(self.run_cmd("usage", "--json"))
        by_helper = {r["helper"]: r for r in data["rows"]}
        self.assertEqual(by_helper["W1"]["cost"], 0.005)   # the 4-place rounding that used to show $0.01 on the dashboard
        self.assertEqual(by_helper["W1"]["cost_text"], "$0.00")
        self.assertEqual(by_helper["M1"]["cost_text"], "?")
        self.assertEqual(by_helper["GHOST"]["cost_text"], "?")
        table = self.run_cmd("usage").splitlines()
        row = [l for l in table if l.split()[:3] == ["T1", "worker", "W1"]][0]
        self.assertEqual(row.split()[-1], by_helper["W1"]["cost_text"])
        entries = data["rows"] + data["tasks"] + data["by_type"] + [data["main"], data["total"]]
        self.assertTrue(all("cost_text" in r for r in entries if r))
        self.assertEqual(transcripts._with_text({"cost": 0.004951})["cost_text"], "$0.00")
        self.assertEqual(transcripts._with_text({"cost": None})["cost_text"], "?")
        # the session report (/plan-writer) uses the same text
        coord = os.path.join(self.folder, "sess1.jsonl")
        sess = transcripts.session_json(coord)
        self.assertTrue(all("cost_text" in r for r in sess["rows"] + sess["by_type"] + [sess["main"], sess["total"]] if r))

    def test_end_writes_usage_json_equal_to_usage_json_and_prints_its_path(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        helpers = os.path.join(self.folder, "sess1", "subagents")
        write_lines(os.path.join(helpers, "agent-W1.jsonl"), [line("a", cr=1_000_000, out=100)])
        write_lines(os.path.join(helpers, "agent-R1.jsonl"), [line("b", model="claude-opus-5-5", cr=500_000, out=100)])
        self.run_cmd("set", "T1", "agent=W1")
        self.run_cmd("set", "T1", "agent=R1", "role=reviewer")
        out = self.run_cmd("end")
        ended = guard.read_json(os.path.join(guard.state_dir(os.getcwd()), "runs", "r1", "run.json"), {})["ended"]
        last = out.rstrip("\n").splitlines()[-1]
        self.assertTrue(last.startswith("usage json: "))
        path = last[len("usage json: "):]
        self.assertTrue(os.path.isabs(path))
        self.assertEqual(os.path.basename(path), "usage.json")
        self.assertEqual(os.path.dirname(path), os.path.dirname(os.path.abspath(run_file._run_path(guard.state_dir(os.getcwd()), "r1"))))
        with open(path, encoding="utf-8") as f:
            written = json.load(f)
        # the run is no longer active after `end`: bring it back (as a resume does) and compare with `usage --json`
        self.run_cmd("begin", "r1")
        run = run_file._load()[2]
        run["ended"] = ended
        guard.write_json(os.path.join(os.path.dirname(path), "run.json"), run)
        self.assertEqual(written, json.loads(self.run_cmd("usage", "--json")))
        self.assertIn("RUN TOTAL", out)   # the table is still printed
        total_line = [l for l in out.splitlines() if l.startswith("RUN TOTAL")][0]
        self.assertEqual(total_line.split()[-1], written["total"]["cost_text"])

    def test_usage_json_rows_equal_the_table(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        self.run_cmd("task", "T2", "Docs")
        helpers = os.path.join(self.folder, "sess1", "subagents")
        write_lines(os.path.join(helpers, "agent-W1.jsonl"), [line("a", cr=1_000_000, out=100)])
        write_lines(os.path.join(helpers, "agent-R1.jsonl"), [line("b", model="claude-opus-5-5", cw=200_000, cr=500_000, out=100)])
        write_lines(os.path.join(helpers, "agent-M1.jsonl"), [line("m", model="claude-mystery-9", cr=1000, out=1)])
        write_lines(os.path.join(helpers, "agent-G1.jsonl"), [line("g", model="claude-opus-5-5", cr=1_000_000)])
        self.run_cmd("set", "T1", "agent=W1")
        self.run_cmd("set", "T1", "agent=R1", "role=reviewer", "effort=high")
        self.run_cmd("set", "T2", "agent=M1")
        self.run_cmd("set", "T2", "agent=GHOST", "role=fixer")
        self.run_cmd("helper", "G1", "gate")
        table = self.run_cmd("usage").splitlines()
        data = json.loads(self.run_cmd("usage", "--json"))
        self.assertEqual(data["note"], transcripts.price_note())
        self.assertIn(data["note"], table)

        def money(r):
            return "?" if r["cost"] is None else "$%.2f" % r["cost"]

        def check(r, lead):
            """The table has a line starting with `lead` that shows this row's numbers."""
            row = [l for l in table if l.split()[:len(lead)] == lead]
            self.assertEqual(len(row), 1, lead)
            cells = row[0].split()
            self.assertEqual(cells[-1], money(r))
            self.assertEqual(cells[-6], str(r["calls"]))
            self.assertEqual(cells[-5], transcripts._n(r["cache_read"]))
            self.assertEqual(cells[-4], transcripts._n(r["cache_write"]))
            self.assertEqual(cells[-3], transcripts._n(r["input"]))
            self.assertEqual(cells[-2], transcripts._n(r["output"]))

        self.assertEqual([r["helper"] for r in data["rows"]], ["W1", "R1", "M1", "GHOST", "G1"])
        by_helper = {r["helper"]: r for r in data["rows"]}
        self.assertTrue(by_helper["GHOST"]["missing"])
        for r in data["rows"]:
            if not r.get("missing"):
                check(r, [r["task"], r["role"], r["helper"]])
        self.assertEqual(by_helper["R1"]["effort"], "high")
        self.assertEqual(by_helper["R1"]["cost"], round((200_000 * 4.0 * 2.0 + 500_000 * 0.20 + 100 * 20.0) / 1e6, 4))
        self.assertIsNone(by_helper["M1"]["cost"])
        self.assertEqual([t["task"] for t in data["tasks"]], ["T1", "T2"])   # a task with more than one helper, as the table has always done
        check(data["tasks"][0], ["T1", "total"])
        check(data["tasks"][1], ["T2", "total"])
        self.assertEqual(data["tasks"][0]["calls"], by_helper["W1"]["calls"] + by_helper["R1"]["calls"])
        self.assertEqual([r["role"] for r in data["by_type"]], ["gate", "reviewer", "worker"])
        for r in data["by_type"]:
            check(r, ["all", r["role"]])
        check(data["main"], ["coordinator"])
        check(data["total"], ["RUN", "TOTAL"])
        self.assertEqual(data["total"]["calls"], sum(r["calls"] for r in data["rows"] if not r.get("missing")) + data["main"]["calls"])

    def test_run_level_helpers_count_in_the_usage(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        write_lines(os.path.join(self.folder, "sess1", "subagents", "agent-G1.jsonl"), [line("g", model="claude-opus-5-5", cr=1_000_000, out=0)])
        self.run_cmd("helper", "G1", "gate")
        self.run_cmd("helper", "G1", "gate")   # once only
        for bad in (["G2"], ["G2", "boss"]):
            with self.assertRaises(SystemExit):
                self.run_cmd("helper", *bad)
        self.assertEqual(run_file._load()[2]["helpers"], [{"id": "G1", "role": "gate"}])
        out = self.run_cmd("usage")
        row = [l for l in out.splitlines() if l.startswith("run ")][0].split()
        self.assertEqual(row[:3], ["run", "gate", "G1"])
        self.assertIn("RUN TOTAL", out)

    def test_a_missing_transcript_is_reported_not_a_crash(self):
        self.coordinator(10_000)
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        self.run_cmd("set", "T1", "agent=GHOST")
        out = self.run_cmd("usage")
        self.assertIn("GHOST", out)
        self.assertIn("no transcript found", out)
        self.assertIn("1 agent(s) without a transcript", out)
        self.assertIn("ended", self.run_cmd("end"))   # end prints the same report without failing

    def test_without_any_coordinator_transcript_usage_still_runs(self):
        self.run_cmd("begin", "r1")
        self.run_cmd("task", "T1", "Data")
        self.run_cmd("set", "T1", "agent=GHOST")
        out = self.run_cmd("usage")
        self.assertIn("coordinator: no transcript found", out)
        self.assertIn("no transcript found", out)

    def test_the_coordinators_use_counts_only_inside_the_run_window(self):
        os.environ["CLAUDE_CODE_SESSION_ID"] = "sess1"
        write_lines(os.path.join(self.folder, "sess1.jsonl"), [
            line("c0", model="claude-opus-5-5", cr=1_000_000, ts="2020-01-01T00:00:00Z"),   # before the run: left out
            line("c1", model="claude-opus-5-5", cr=2_000_000, ts="2999-01-01T00:00:00Z")])  # after `ended`: left out
        self.run_cmd("begin", "r1")
        out = self.run_cmd("usage")
        self.assertIn("coordinator", out)
        self.assertNotIn("no transcript found", out)
        row = [l for l in out.splitlines() if l.startswith("coordinator")][0].split()
        self.assertEqual(row[2], "0")   # calls (row[1] is the model column, "?" with no calls)


class MergeAndCleanup(unittest.TestCase):
    """`merge` and `cleanup` on a real scratch repo: a main checkout, the run's worktree and helper worktrees."""

    def git(self, cwd, *args):
        import subprocess
        return subprocess.run(("git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false") + args, cwd=cwd,
                              capture_output=True, text=True, check=True).stdout.strip()

    def write(self, path, text):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf8") as f:
            f.write(text)

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="plan-runner-merge-")
        self.main = os.path.join(self.tmp, "repo")
        os.makedirs(self.main)
        self.git(self.main, "init", "-q", "-b", "master")
        self.write(os.path.join(self.main, "a.txt"), "a\n")
        self.git(self.main, "add", "-A")
        self.git(self.main, "commit", "-q", "-m", "base")
        self.wt = os.path.join(self.main, ".claude", "worktrees", "run")
        self.git(self.main, "worktree", "add", "-q", "-b", "claude/topic", self.wt)
        self.cwd = os.getcwd()
        os.chdir(self.wt)
        self.proj = tempfile.mkdtemp(prefix="plan-runner-proj-")
        self.old_env = os.environ.get("PLAN_RUNNER_PROJECTS")
        os.environ["PLAN_RUNNER_PROJECTS"] = self.proj
        self.old_sid = os.environ.pop("CLAUDE_CODE_SESSION_ID", None)
        self.env = {k: os.environ.get(k) for k in ("GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL")}
        os.environ.update(GIT_AUTHOR_NAME="t", GIT_AUTHOR_EMAIL="t@t", GIT_COMMITTER_NAME="t", GIT_COMMITTER_EMAIL="t@t")
        self.run_cmd("begin", "r1", "--plan", "p.md", "--branch", "claude/topic")

    def tearDown(self):
        os.chdir(self.cwd)
        for k, v in self.env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        if self.old_sid is not None:
            os.environ["CLAUDE_CODE_SESSION_ID"] = self.old_sid
        if self.old_env is None:
            os.environ.pop("PLAN_RUNNER_PROJECTS", None)
        else:
            os.environ["PLAN_RUNNER_PROJECTS"] = self.old_env
        shutil.rmtree(self.proj, ignore_errors=True)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_cmd(self, *args):
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            run_file.main(list(args))
        return buf.getvalue()

    def helper_branch(self, aid, files):
        path = os.path.join(self.main, ".claude", "worktrees", "agent-" + aid)
        self.git(self.main, "worktree", "add", "-q", "-b", "worktree-agent-" + aid, path, "claude/topic")
        for name, text in files.items():
            self.write(os.path.join(path, name), text)
        self.git(path, "add", "-A")
        self.git(path, "commit", "-q", "-m", aid)
        return path

    def test_merge_records_the_commit_and_the_diff_range(self):
        self.run_cmd("task", "T1", "Thing", "--review", "full")
        self.helper_branch("A1", {"b.txt": "b\n"})
        before = self.git(self.wt, "rev-parse", "HEAD")
        out = self.run_cmd("merge", "T1", "A1")
        t = run_file._load()[2]["tasks"]["T1"]
        self.assertEqual(t["status"], "review")
        self.assertEqual(t["commit"], self.git(self.wt, "rev-parse", "HEAD"))
        self.assertEqual(t["before"], before)
        self.assertIn("git diff %s.." % before[:9], out)
        self.assertTrue(os.path.exists(os.path.join(self.wt, "b.txt")))

    def test_a_task_without_review_is_merged_at_once(self):
        self.run_cmd("task", "T1", "Docs", "--review", "none")
        self.helper_branch("A1", {"doc.md": "x\n"})
        self.run_cmd("merge", "T1", "A1")
        self.assertEqual(run_file._load()[2]["tasks"]["T1"]["status"], "merged")

    def test_a_real_conflict_is_left_for_the_coordinator_and_not_recorded(self):
        self.run_cmd("task", "T1", "One")
        self.run_cmd("task", "T2", "Two")
        self.helper_branch("A1", {"a.txt": "one\n"})
        self.helper_branch("A2", {"a.txt": "two\n"})
        self.run_cmd("merge", "T1", "A1")
        with self.assertRaises(SystemExit) as e:
            self.run_cmd("merge", "T2", "A2")
        self.assertIn("a.txt", str(e.exception))
        self.assertEqual(run_file._load()[2]["tasks"]["T2"]["status"], "todo")
        self.git(self.wt, "merge", "--abort")

    def test_end_removes_the_helpers_worktrees_and_branches(self):
        self.run_cmd("task", "T1", "One")
        path = self.helper_branch("A1", {"b.txt": "b\n"})
        self.run_cmd("set", "T1", "agent=A1")
        self.run_cmd("merge", "T1", "A1")
        self.run_cmd("end")
        self.assertFalse(os.path.exists(path))
        self.assertNotIn("worktree-agent-A1", self.git(self.main, "branch", "--list"))
        self.assertTrue(os.path.exists(self.wt))   # the run's own worktree stays


if __name__ == "__main__":
    unittest.main()
