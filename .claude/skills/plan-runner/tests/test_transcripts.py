"""Tests for reading transcripts: token use per call, prices, the context size and Claude Code's folder names.
Run: python -m unittest discover -s .claude/skills/plan-runner/tests"""
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import transcripts  # noqa: E402

def line(mid, model="claude-sonnet-5-5", inp=0, cw=0, cr=0, out=0, ts="2026-10-11T10:00:00.000Z", kind="assistant"):
    return json.dumps({"type": kind, "timestamp": ts, "uuid": "u" + str(abs(hash((mid, out)))),
                       "message": {"id": mid, "model": model, "usage": {"input_tokens": inp, "cache_creation_input_tokens": cw,
                                                                       "cache_read_input_tokens": cr, "output_tokens": out}}})


def write_lines(path, lines):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        f.write("\n".join(lines) + "\n")


class Usage(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="plan-runner-usage-")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_one_message_over_three_lines_counts_the_max_per_field_not_the_sum(self):
        p = os.path.join(self.tmp, "t.jsonl")
        write_lines(p, [line("m1", inp=3, cw=500, cr=1000, out=5), line("m1", inp=3, cw=500, cr=1000, out=5),
                        line("m1", inp=3, cw=500, cr=1000, out=40), line("m2", inp=1, cr=2000, out=10), "{broken json", '{"type":"user"}'])
        u = transcripts.read_usage(p)
        self.assertEqual((u["calls"], u["in"], u["cw"], u["cr"], u["out"]), (2, 4, 500, 3000, 50))

    def test_cost_for_each_model_and_an_unknown_one(self):
        million = {"calls": 1, "in": 10 ** 6, "cw": 10 ** 6, "cr": 10 ** 6, "out": 10 ** 6}

        def one(model):
            return {"models": {model: dict(million)}}
        self.assertAlmostEqual(transcripts.cost(one("claude-opus-5-5")), 4 + 8 + 0.2 + 20)
        self.assertAlmostEqual(transcripts.cost(one("claude-sonnet-5-5")), 2 + 4 + 0.2 + 10)
        self.assertAlmostEqual(transcripts.cost(one("claude-haiku-4-5-20251001")), 1 + 2 + 0.1 + 5)
        self.assertAlmostEqual(transcripts.cost(one("claude-haiku-5-5")), 0.1 + 0.2 + 0.01 + 0.5)
        self.assertIn("Haiku 5.5 in 0.1 / out 0.5 / cache read 0.01", transcripts.price_note())
        self.assertIsNone(transcripts.cost(one("claude-mystery-9")))
        both = {"models": {"claude-opus-5-5": dict(million), "claude-mystery-9": dict(million)}}
        self.assertIsNone(transcripts.cost(both))

    def test_prices_unchanged_since_the_move(self):
        old_prices = {
            "claude-fable-5-1": (10.0, 50.0, 0.25),
            "claude-fable-5": (10.0, 50.0, 0.25),
            "claude-opus-5-5": (4.0, 20.0, 0.20),
            "claude-sonnet-5-5": (2.0, 10.0, 0.20),
            "claude-haiku-5-5": (0.10, 0.50, 0.01),
            "claude-haiku-4-5": (1.0, 5.0, 0.10),
        }
        old_names = {"claude-fable-5-1": "Fable 5.1", "claude-fable-5": "Fable 5", "claude-opus-5-5": "Opus 5.5", "claude-sonnet-5-5": "Sonnet 5.5",
                     "claude-haiku-5-5": "Haiku 5.5", "claude-haiku-4-5": "Haiku 4.5"}
        self.assertEqual(transcripts.PRICES, old_prices)
        self.assertEqual(list(transcripts.PRICES), list(old_prices))   # the order matters for the prefix match and the footer
        self.assertTrue(all(isinstance(p, tuple) for p in transcripts.PRICES.values()))
        self.assertEqual(transcripts.PRICE_NAMES, old_names)
        self.assertEqual(transcripts.CACHE_WRITE_X, 2.0)
        with open(os.path.join(HERE, "..", "scripts", "prices.json"), encoding="utf-8") as f:
            self.assertIn("1-hour cache", json.load(f)["note"])

    def test_load_prices_follows_the_file_it_is_pointed_at(self):
        with open(os.path.join(HERE, "..", "scripts", "prices.json"), encoding="utf-8") as f:
            data = json.load(f)
        data["cache_write_x"] = 1.25
        data["models"]["claude-opus-5-5"]["input"] = 7.5
        data["models"]["claude-opus-5-5"]["name"] = "Opus Test"
        alt = os.path.join(self.tmp, "prices-alt.json")
        with open(alt, "w", encoding="utf-8") as f:
            json.dump(data, f)
        prices, names, cw_x = transcripts._load_prices(alt)
        self.assertEqual(prices["claude-opus-5-5"], (7.5, 20.0, 0.20))
        self.assertEqual(names["claude-opus-5-5"], "Opus Test")
        self.assertEqual(cw_x, 1.25)
        self.assertNotEqual(prices, transcripts.PRICES)

    def test_every_model_in_the_real_prices_json_is_the_loaded_tuple(self):
        with open(os.path.join(HERE, "..", "scripts", "prices.json"), encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(list(data["models"]), list(transcripts.PRICES))
        for key, m in data["models"].items():
            self.assertEqual(transcripts.PRICES[key], (m["input"], m["output"], m["cache_read"]), key)
            self.assertEqual(transcripts.PRICE_NAMES[key], m["name"])
        self.assertEqual(transcripts.CACHE_WRITE_X, data["cache_write_x"])

    def test_price_note_follows_the_cache_write_multiple(self):
        self.assertIn("cache write 2x input", transcripts.price_note())   # today's exact text
        old = transcripts.CACHE_WRITE_X
        transcripts.CACHE_WRITE_X = 1.25
        try:
            self.assertIn("cache write 1.25x input", transcripts.price_note())
        finally:
            transcripts.CACHE_WRITE_X = old

    def test_session_json_rows_equal_the_table(self):
        coord = os.path.join(self.tmp, "sess.jsonl")
        write_lines(coord, [line("c1", model="claude-opus-5-5", inp=10, cw=2000, cr=300_000, out=500)])
        subs = os.path.join(self.tmp, "sess", "subagents")
        write_lines(os.path.join(subs, "agent-A1.jsonl"), [line("a", cr=1_000_000, out=100), line("b", cr=500_000, out=50)])
        write_lines(os.path.join(subs, "agent-A2.jsonl"), [line("c", model="claude-haiku-4-5", cr=2_000_000, out=0)])
        write_lines(os.path.join(subs, "agent-A3.jsonl"), [line("d", model="claude-mystery-9", cr=1000, out=1)])
        for aid, kind, desc in (("A1", "writer-searcher", "find files"), ("A2", "writer-searcher", "find more"), ("A3", "writer-runner", "run it")):
            with open(os.path.join(subs, "agent-%s.meta.json" % aid), "w", encoding="utf-8") as f:
                json.dump({"agentType": kind, "description": desc}, f)
        table = transcripts.session_lines(coord)
        data = transcripts.session_json(coord)
        self.assertEqual(json.loads(json.dumps(data))["rows"], data["rows"])   # plain JSON
        self.assertEqual(data["note"], transcripts.price_note())
        self.assertEqual(table[-1], data["note"])
        self.assertEqual(len(data["rows"]), 3)
        self.assertEqual([r["helper"] for r in data["by_type"]], ["writer-runner", "writer-searcher"])
        keys = {"helper", "task", "role", "model", "effort", "calls", "input", "output", "cache_read", "cache_write", "cost", "cost_text"}
        every = data["rows"] + data["by_type"] + [data["main"], data["total"]]
        self.assertTrue(all(set(r) == keys for r in every))
        body = table[1:-1]   # between the header and the price note: helpers, then all <type>, then main chat and TOTAL
        self.assertEqual(len(body), len(every))
        for r, text in zip(every, body):
            self.assertIn(r["helper"], text)
            self.assertEqual(int(text.split()[-6]), r["calls"])   # the calls column
            money = "$%.2f" % r["cost"] if r["cost"] is not None else "?"
            self.assertEqual(text.split()[-1], money)
        # costs: rounded to 4 places in the JSON; an unpriced model is null, and so is the total containing it
        first = data["rows"][0]
        self.assertEqual((first["calls"], first["cost"]), (2, round((1_500_000 * 0.20 + 150 * 10) / 1e6, 4)))
        self.assertIsNone(data["rows"][2]["cost"])
        self.assertIsNone(data["total"]["cost"])
        self.assertEqual(data["total"]["calls"], sum(r["calls"] for r in data["rows"]) + data["main"]["calls"])
        self.assertEqual(data["total"]["cache_read"], sum(r["cache_read"] for r in data["rows"]) + data["main"]["cache_read"])
        self.assertEqual(data["main"]["cost"], round((10 * 4 + 2000 * 8 + 300_000 * 0.20 + 500 * 20) / 1e6, 4))

    def test_session_json_flag_prints_json_from_the_command_line(self):
        coord = os.path.join(self.tmp, "sess.jsonl")
        write_lines(coord, [line("c1", cr=1_000_000)])
        import subprocess
        script = os.path.join(HERE, "..", "scripts", "transcripts.py")
        out = subprocess.run([sys.executable, script, "session", "--json", "--transcript", coord], capture_output=True, text=True, check=True).stdout
        data = json.loads(out)
        self.assertEqual(data["main"]["calls"], 1)
        out2 = subprocess.run([sys.executable, script, "session", "--transcript", coord, "--json"], capture_output=True, text=True, check=True).stdout
        self.assertEqual(json.loads(out2), data)

    def test_context_is_the_latest_calls_input_plus_cache(self):
        p = os.path.join(self.tmp, "t.jsonl")
        write_lines(p, [line("m1", inp=5, cw=1000, cr=50000, out=9), line("m2", inp=7, cw=2000, cr=160000, out=9)])
        self.assertEqual(transcripts.context_tokens(p), 162007)
        self.assertIsNone(transcripts.context_tokens(os.path.join(self.tmp, "none.jsonl")))


    def test_synthetic_and_unnamed_models_with_no_tokens_cost_nothing_and_need_no_price(self):
        p = os.path.join(self.tmp, "t.jsonl")
        nameless = json.dumps({"type": "assistant", "timestamp": "2026-10-11T10:00:00Z", "uuid": "x1",
                               "message": {"id": "n1", "usage": {"input_tokens": 0, "output_tokens": 0}}})
        write_lines(p, [line("s1", model="<synthetic>"), nameless, line("m1", model="claude-sonnet-5-5", cr=1_000_000)])
        u = transcripts.read_usage(p)
        self.assertEqual(u["calls"], 2)            # the synthetic call is dropped; the nameless one stays but has no tokens
        self.assertNotIn("<synthetic>", u["models"])
        self.assertAlmostEqual(transcripts.cost(u), 0.2)
        self.assertIsNone(transcripts.cost({"models": {"claude-mystery-9": {"calls": 1, "in": 1, "cw": 0, "cr": 0, "out": 0}}}))

    def test_odd_json_never_crashes(self):
        p = os.path.join(self.tmp, "t.jsonl")
        write_lines(p, ['[1,"usage"]', '"usage"', "null", '{"type":"assistant","message":["usage"]}',
                        '{"type":"assistant","message":{"id":["x"],"model":7,"usage":{"input_tokens":"x","output_tokens":null,"cache_read_input_tokens":[1]}}}',
                        '{"type":"assistant","message":{"id":"n","usage":{"input_tokens":NaN,"output_tokens":2.9}}}',
                        '{"type":"assistant","message":{"id":"u","usage":"usage"}}', line("ok", cr=100, out=3)])
        u = transcripts.read_usage(p)
        self.assertEqual((u["in"], u["cr"], u["out"]), (0, 100, 5))
        self.assertEqual(transcripts.context_tokens(p), 100)

    def test_a_call_with_neither_message_id_nor_uuid_is_skipped(self):
        p = os.path.join(self.tmp, "t.jsonl")
        bare = json.dumps({"type": "assistant", "timestamp": "2026-10-11T10:00:00Z",
                           "message": {"model": "claude-sonnet-5-5", "usage": {"cache_read_input_tokens": 9_000_000}}})
        write_lines(p, [bare, bare, line("ok", cr=1_000)])
        u = transcripts.read_usage(p)
        self.assertEqual(u["calls"], 1)
        self.assertEqual(u["cr"], 1_000)

    def test_lines_that_are_not_assistant_messages_are_ignored(self):
        p = os.path.join(self.tmp, "t.jsonl")
        write_lines(p, [line("u1", cr=999, kind="user"), line("a1", cr=7), line("s1", cr=555, kind="system")])
        u = transcripts.read_usage(p)
        self.assertEqual((u["calls"], u["cr"]), (1, 7))
        self.assertEqual(transcripts.context_tokens(p), 7)

    def test_iso_timestamps_with_an_offset_and_fractions_are_windowed(self):
        p = os.path.join(self.tmp, "t.jsonl")
        write_lines(p, [line("in1", cr=10, ts="2026-10-11T15:30:00.123456+05:30"),     # 10:00:00.123456Z, inside
                        line("early", cr=100, ts="2026-10-11T15:29:59.500000+05:30"),   # 09:59:59.5Z, before
                        line("in2", cr=20, ts="2026-10-11T10:00:30.5Z"),
                        line("late", cr=1000, ts="2026-10-11T10:02:00.000+00:00"),
                        line("bad", cr=5000, ts="not a time")])
        since = transcripts._ts("2026-10-11T10:00:00Z")
        u = transcripts.read_usage(p, since, since + 60)
        self.assertEqual((u["calls"], u["cr"]), (2, 30))

    def test_the_context_skips_empty_calls_and_says_nothing_for_a_missing_file(self):
        p = os.path.join(self.tmp, "t.jsonl")
        write_lines(p, [line("m1", cr=50_000), line("syn", model="<synthetic>")])
        self.assertEqual(transcripts.context_tokens(p), 50_000)
        write_lines(p, [line("zero")])
        self.assertIsNone(transcripts.context_tokens(p))

    def test_slug_matches_claude_codes_folder_name(self):
        self.assertEqual(transcripts.slug(r"E:\AI\lib\.claude\worktrees\bridge-cse_01SDNsjZmnS2XrKEr4i2hvyR"),
                         "E--AI-lib--claude-worktrees-bridge-cse-01SDNsjZmnS2XrKEr4i2hvyR")
        self.assertEqual(transcripts.slug("E:\\AI\\lib\\"), "E--AI-lib")   # a trailing separator adds nothing

    def test_a_very_long_path_finds_the_shortened_folder_by_its_prefix(self):
        old = os.environ.get("PLAN_RUNNER_PROJECTS")
        os.environ["PLAN_RUNNER_PROJECTS"] = self.tmp
        try:
            cwd = os.path.join(self.tmp, "w" * 150, "x" * 150, "leaf")
            s = transcripts.slug(cwd)
            self.assertGreater(len(s), transcripts.SLUG_PREFIX)
            self.assertEqual(transcripts.project_dir(cwd), os.path.join(self.tmp, s))   # nothing there yet: the exact name
            # another long path sharing the first characters, with no hash-like tail, is never taken
            os.makedirs(os.path.join(self.tmp, s[:transcripts.SLUG_PREFIX] + "x-sibling-worktree"))
            os.makedirs(os.path.join(self.tmp, s[:transcripts.SLUG_PREFIX] + "-sibling-worktree"))   # a dash, but not a hash-like tail
            self.assertEqual(transcripts.project_dir(cwd), os.path.join(self.tmp, s))
            short = os.path.join(self.tmp, s[:transcripts.SLUG_PREFIX] + "-a1b2c3")
            write_lines(os.path.join(short, "s.jsonl"), [line("m", cr=1)])
            os.makedirs(os.path.join(self.tmp, "unrelated"))
            self.assertEqual(transcripts.project_dir(cwd), short)
            self.assertEqual(transcripts.newest_transcript(cwd), os.path.join(short, "s.jsonl"))
            # a short path never looks past its exact name
            short_cwd = os.path.join(self.tmp, "short")
            exact_short = os.path.join(self.tmp, transcripts.slug(short_cwd))
            self.assertLessEqual(len(transcripts.slug(short_cwd)), transcripts.SLUG_PREFIX)
            os.makedirs(exact_short + "-a1b2c3")   # looks like a cut name with a hash, but the path is short
            self.assertEqual(transcripts.project_dir(short_cwd), exact_short)
        finally:
            if old is None:
                os.environ.pop("PLAN_RUNNER_PROJECTS", None)
            else:
                os.environ["PLAN_RUNNER_PROJECTS"] = old


if __name__ == "__main__":
    unittest.main()
