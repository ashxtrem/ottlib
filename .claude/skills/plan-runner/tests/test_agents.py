"""The crew's agent files (.claude/agents/plan-*.md) match what the skill and the guard expect."""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import guard  # noqa: E402

AGENTS = os.path.normpath(os.path.join(HERE, "..", "..", "..", "agents"))
CREW = {  # name: (model, effort or None)
    "plan-builder": ("sonnet", "high"),
    "plan-builder-opus": ("opus", "medium"),
    "plan-reviewer": ("sonnet", "high"),
    "plan-gate": ("fable", "high"),
    "plan-checker": ("sonnet", "medium"),
    "plan-searcher": ("haiku", None),
    "plan-diagnoser": ("opus", "high"),
}


def parse(name):
    with open(os.path.join(AGENTS, name + ".md"), encoding="utf8") as f:
        text = f.read()
    _, head, body = text.split("---\n", 2)
    meta = dict(line.split(": ", 1) for line in head.strip().splitlines())
    meta["tools"] = [t.strip() for t in meta.get("tools", "").split(",")]
    return meta, body


class CrewFiles(unittest.TestCase):
    def test_every_role_has_its_file_model_and_effort(self):
        for name, (model, effort) in CREW.items():
            meta, _ = parse(name)
            self.assertEqual(meta["name"], name)
            self.assertEqual(meta["model"], model, name)
            self.assertEqual(meta.get("effort"), effort, name)
            self.assertTrue(name.startswith(guard.CREW_PREFIX))

    def test_no_crew_agent_can_start_agents(self):
        for name in CREW:
            self.assertNotIn("Agent", parse(name)[0]["tools"], name)

    def test_the_guards_read_only_types_have_no_edit_tools(self):
        self.assertEqual(set(guard.READ_ONLY_TYPES) | set(guard.WHOLE_SUITE_TYPES) <= set(CREW), True)
        for name in guard.READ_ONLY_TYPES:
            tools = parse(name)[0]["tools"]
            self.assertFalse({"Edit", "Write", "NotebookEdit"} & set(tools), name)
        for name in set(CREW) - set(guard.READ_ONLY_TYPES):
            self.assertIn("Edit", parse(name)[0]["tools"], name)

    def test_the_gate_reads_only(self):
        self.assertEqual(parse("plan-gate")[0]["tools"], ["Read", "Grep", "Glob"])

    def test_the_two_builders_differ_only_in_model_and_effort(self):
        self.assertEqual(parse("plan-builder")[1], parse("plan-builder-opus")[1])

    def test_reports_start_with_a_word_the_guard_accepts(self):
        starts = {"plan-reviewer": "`approve` or `changes`", "plan-gate": "`approve` or `changes`", "plan-searcher": "```\nfound",
                  "plan-diagnoser": "```\ncause", "plan-checker": "```\nchecks", "plan-builder": "```\ndone"}
        for name, marker in starts.items():
            self.assertIn(marker.strip("`\n").split("`")[0], guard.REPORT_STARTS)
            self.assertIn(marker, parse(name)[1], name)


if __name__ == "__main__":
    unittest.main()
