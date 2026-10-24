"""Plan runner guard: the hooks that keep a run's helper agents lean and safe (.claude/skills/plan-runner/SKILL.md).

Hook use (from .claude/settings.json): `python guard.py hook` with the hook's JSON on stdin.
Commands: `python guard.py selftest | status | off [RULE] | on [RULE] | allow RULE AGENT`.

Scope: several runs may be active at once (<state>/active/<run>.json, each run in its own worktree and chat). A rule acts only on
calls from the session bound to a run (the coordinator's first crew Agent call binds it) that carry an agent_id (a helper agent).
The main chat, other sessions and helpers outside a run are never touched. Commands take `--run ID` when the cwd's branch
doesn't identify the run.

Recovery: any error inside the guard lets the call through (exit 0) and is logged; a slow call is logged; a rule can be
turned off or allowed once per agent; the whole guard can be turned off. Only the binding fallback and the commands call git.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bash_rules import Refuse, check_bash  # noqa: E402

# --- limits (change here) ----------------------------------------------------------------------------------------------
IMAGE_BUDGET = 8                 # screenshots per helper agent
IMAGE_MAX_SIDE = 1600            # px on the long side
READ_MAX_LINES = 400             # a text file longer than this needs offset / limit
REPORT_MAX_LINES = 15            # a worker's final message
SEARCH_REPORT_MAX_LINES = 30     # a searcher's `found` report (the plan check lists wrong claims and readers)
REPORT_STARTS = ("done", "blocked", "approve", "changes", "found", "cause", "checks")
BIG_OUTPUT_CHARS = 8000          # a Bash result this long gets a warning
MIN_FREE_GB = 3.0                # on every drive the run uses
STALE_SEC = 24 * 3600            # an active run older than this is ignored
SLOW_SEC = 1.0                   # a guard call slower than this is logged

IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp")
RULES = ("image_budget", "image_size", "read_range", "watch_mode", "whole_suite", "git_ops",
         "no_agents", "write_scope", "big_output", "report_format", "disk", "read_only")
# The crew's agent files (.claude/agents/plan-*.md). Their tool lists already leave out Agent (all) and Edit/Write (these);
# the guard backs that up and keeps the read-only ones from committing through Bash.
CREW_PREFIX = "plan-"
READ_ONLY_TYPES = ("plan-reviewer", "plan-gate", "plan-searcher", "plan-diagnoser", "plan-checker")
WHOLE_SUITE_TYPES = ("plan-checker",)   # the run's checks may run whole suites
BLOCKED_HINT = "If nothing else works, end your turn with `blocked: guard {rule}` and say what you need."


# --- where the run state lives ------------------------------------------------------------------------------------------

def common_dir(start):
    """The main repo's git folder, from any worktree under it, without calling git ('' when not in a repo)."""
    d = os.path.abspath(start or ".")
    while True:
        g = os.path.join(d, ".git")
        if os.path.isdir(g):
            return g
        if os.path.isfile(g):
            try:
                with open(g, encoding="utf8") as f:
                    line = f.read().strip()
            except OSError:
                return ""
            if line.startswith("gitdir:"):
                gd = os.path.normpath(os.path.join(d, line[7:].strip()))
                parts = gd.replace("\\", "/").split("/worktrees/")
                return os.path.normpath(parts[0]) if len(parts) > 1 else gd
            return ""
        up = os.path.dirname(d)
        if up == d:
            return ""
        d = up


def state_dir(start):
    c = common_dir(start)
    return os.path.join(c, "plan-runner") if c else ""


def read_json(path, default):
    try:
        with open(path, encoding="utf8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp%d" % os.getpid()
    with open(tmp, "w", encoding="utf8") as f:
        json.dump(data, f, indent=1)
    os.replace(tmp, path)


def _fresh(a, now):
    try:
        return isinstance(a, dict) and isinstance(a.get("run"), str) and bool(a["run"]) and now - float(a.get("started", 0)) < STALE_SEC
    except (TypeError, ValueError):
        return False   # a corrupt start time counts as stale


def active_file(state, rid):
    return os.path.join(state, "active", rid + ".json")


def active_runs(state, now=None):
    """The active, not stale runs: one file each in <state>/active/, plus a legacy <state>/active.json as one more entry (read-only:
    a run still on old code reads only that file, so it is never moved or rewritten here; active/<run>.json wins for the same id)."""
    if not state:
        return []
    now = time.time() if now is None else now
    d = os.path.join(state, "active")
    names = sorted(f for f in os.listdir(d) if f.endswith(".json")) if os.path.isdir(d) else []
    runs = [a for a in (read_json(os.path.join(d, f), {}) for f in names) if _fresh(a, now)]
    old = read_json(os.path.join(state, "active.json"), {})
    if _fresh(old, now) and not os.path.exists(active_file(state, old["run"])):
        runs.append(old)
    return runs


def drop_active(state, rid):
    """Remove the run's active file, and the legacy active.json if it names the run."""
    legacy = os.path.join(state, "active.json")
    for path in (active_file(state, rid), legacy):
        if path != legacy or read_json(legacy, {}).get("run") == rid:
            try:
                os.remove(path)
            except OSError:
                pass


def branch_of(cwd):
    """The checkout's current branch ('' when unknown). PLAN_RUNNER_BRANCH, when set, stands in for git (tests)."""
    if os.environ.get("PLAN_RUNNER_BRANCH"):
        return os.environ["PLAN_RUNNER_BRANCH"]
    try:
        r = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd or ".", capture_output=True, text=True, timeout=3)
        return r.stdout.strip() if r.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError, ValueError):
        return ""


def pick(runs, rid, cwd):
    """(entry, '') for the run a command means, else ({}, why): --run ID, else the run on the cwd's branch, else the only run."""
    if rid:
        hit = [a for a in runs if a["run"] == rid]
        return (hit[0], "") if hit else ({}, "no active run %s (active: %s)" % (rid, ", ".join(a["run"] for a in runs) or "none"))
    if not runs:
        return {}, "no active run"
    br = branch_of(cwd)
    hit = [a for a in runs if br and a.get("branch") == br]
    if len(hit) == 1:
        return hit[0], ""
    if len(runs) == 1:
        return runs[0], ""
    return {}, "several runs are active (%s); name one with --run ID" % ", ".join("%s [%s]" % (a["run"], a.get("branch", "?")) for a in runs)


def take_run(argv):
    """(argv without `--run ID`, ID or '')."""
    out, rid, i = [], "", 0
    while i < len(argv):
        if argv[i] == "--run" and i + 1 < len(argv):
            rid = argv[i + 1]
            i += 2
        else:
            out.append(argv[i])
            i += 1
    return out, rid


class Run:
    """One active run, or `ok` False (`err` says why). `session`: the run bound to that hook session (no git, no guessing);
    otherwise `rid`, else the run on the cwd's branch, else the only run."""

    def __init__(self, start, now=None, rid="", session=None):
        self.state = state_dir(start)
        runs = active_runs(self.state, now)
        self.err = ""
        if session is not None:
            self.active = next((a for a in runs if session and a.get("session") == session), {})
        else:
            self.active, self.err = pick(runs, rid, start)
        self.ok = bool(self.active)
        self.file = active_file(self.state, self.active["run"]) if self.ok else ""
        self.dir = os.path.join(self.state, "runs", self.active["run"]) if self.ok else ""

    def path(self, *parts):
        return os.path.join(self.dir, *parts)

    def guard_cfg(self):
        return read_json(self.path("guard.json"), {"all_off": False, "off": [], "allow": []})

    def log(self, kind, **kw):
        if not self.dir:
            return
        os.makedirs(self.dir, exist_ok=True)
        kw.update({"t": round(time.time(), 1), "kind": kind})
        with open(self.path("guard.log"), "a", encoding="utf8") as f:
            f.write(json.dumps(kw) + "\n")


# --- the rules ----------------------------------------------------------------------------------------------------------

def png_size(path):
    """(w, h) of a PNG from its header, or None."""
    try:
        with open(path, "rb") as f:
            head = f.read(24)
    except OSError:
        return None
    if len(head) == 24 and head[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
    return None


def line_count(path, limit):
    """Lines in a text file, counting only up to `limit` + 1 (0 when unreadable)."""
    try:
        if os.path.getsize(path) < limit * 2:  # too small to hold that many lines
            return 0
        n = 0
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 16), b""):
                n += chunk.count(b"\n")
                if n > limit:
                    return n
        return n
    except OSError:
        return 0


def scratch_root():
    """Claude Code's session scratchpads (<temp>/claude/...): helpers write scratch scripts there."""
    import tempfile
    return os.path.join(tempfile.gettempdir(), "claude")


def under(path, root):
    try:
        p = os.path.normcase(os.path.abspath(path))
        r = os.path.normcase(os.path.abspath(root))
        return p == r or p.startswith(r.rstrip("\\/") + os.sep)
    except (TypeError, ValueError):
        return False


def free_gb(path):
    try:
        return shutil.disk_usage(path).free / 1e9
    except OSError:
        return 1e9


# --- the hook ------------------------------------------------------------------------------------------------------------

def bind(ev, cwd):
    """The coordinator's own Agent call binds its session to an unbound run: the one its packet names, else (a plan-* agent type)
    the only unbound one or the one on the cwd's branch. Returns the bound Run, or None."""
    ti = ev.get("tool_input", {}) or {}
    state = state_dir(cwd)
    free = [a for a in active_runs(state) if not a.get("session")]
    named = re.findall(r"plan-runner run ([\w.\-]+)", json.dumps(ti))
    hit = [a for a in free if a["run"] in named]
    if not hit and str(ti.get("subagent_type", "") if isinstance(ti, dict) else "").startswith(CREW_PREFIX):
        hit = free if len(free) == 1 else [a for a in free if a.get("branch") and a["branch"] == branch_of(cwd)]
    if len(hit) != 1:
        return None
    hit[0]["session"] = ev.get("session_id", "")
    hit[0]["transcript"] = ev.get("transcript_path", "")   # the usage report reads the coordinator's use from it
    write_json(active_file(state, hit[0]["run"]), hit[0])
    return Run(cwd, session=hit[0]["session"])


def handle(ev, run, out):
    """Apply the rules to one hook event. Writes a refusal or note to `out` (a dict: exit, stderr, stdout)."""
    name = ev.get("hook_event_name", "")
    agent = ev.get("agent_id") or ""
    if not run.ok or not agent:   # run: the one bound to this event's session
        return
    cfg = run.guard_cfg()
    if cfg.get("all_off"):
        return
    if name == "SubagentStart":
        write_json(run.path("agents", agent + ".json"), {"type": ev.get("agent_type", ""), "cwd": ev.get("cwd", ""), "t": time.time()})
        return
    reg = read_json(run.path("agents", agent + ".json"), {})
    try:
        if name == "PreToolUse":
            _pre(ev, run, agent, reg)
        elif name == "PostToolUse":
            _post(ev, out, cfg)
        elif name == "SubagentStop":
            _stop(ev, run, out, cfg, agent)
    except Refuse as r:
        if r.rule in cfg.get("off", []) or [r.rule, agent] in cfg.get("allow", []):
            run.log("allowed", rule=r.rule, agent=agent)
            return
        run.log("refuse", rule=r.rule, agent=agent, tool=ev.get("tool_name", ""), path=r.path)
        out["exit"] = 2
        out["stderr"] = "plan-runner guard (%s): %s %s" % (r.rule, r.text, BLOCKED_HINT.format(rule=r.rule))


def _pre(ev, run, agent, reg):
    tool = ev.get("tool_name", "")
    ti = ev.get("tool_input", {}) or {}
    kind = str(ev.get("agent_type") or reg.get("type") or "")
    if tool == "Agent":
        raise Refuse("no_agents", "A helper agent can't start agents of its own.")
    if tool == "Bash":
        check_bash(str(ti.get("command", "")), read_only=kind in READ_ONLY_TYPES, whole_suite_ok=kind in WHOLE_SUITE_TYPES,
                   background=bool(ti.get("run_in_background")))
        mark = run.path("agents", agent + ".disk")
        if not os.path.exists(mark):
            low = [d for d in {os.path.splitdrive(os.path.abspath(ev.get("cwd", ".")))[0] or "/", os.path.expanduser("~")}
                   if free_gb(d) < MIN_FREE_GB]
            if low:
                raise Refuse("disk", "Less than %.0f GB free on %s; stop and report so the coordinator can free space." % (MIN_FREE_GB, ", ".join(low)))
            open(mark, "w").close()
        return
    if tool in ("Edit", "Write", "NotebookEdit"):
        if kind in READ_ONLY_TYPES:
            raise Refuse("read_only", "You are read-only (%s): report what you found; a fixer makes the change." % kind)
        root = reg.get("cwd") or ev.get("cwd", "")
        fp = str(ti.get("file_path") or ti.get("notebook_path") or "")
        if root and fp and not under(fp, root) and not under(fp, scratch_root()):
            raise Refuse("write_scope", "Write only inside your own worktree (%s) or your scratchpad." % root, fp)
        return
    if tool == "Read":
        fp = str(ti.get("file_path", ""))
        if fp.lower().endswith(IMAGE_EXT):
            size = png_size(fp)
            if size and max(size) > IMAGE_MAX_SIDE:
                raise Refuse("image_size", "This image is %dx%d; make a downscaled contact sheet (python .claude/skills/plan-runner/scripts/sheet.py OUT.png IN...) and read that." % size)
            cpath = run.path("agents", agent + ".images")
            n = len(read_json(cpath, []))
            if n >= IMAGE_BUDGET:
                raise Refuse("image_budget", "You have looked at %d images, the budget; put the rest in one downscaled contact sheet (python .claude/skills/plan-runner/scripts/sheet.py OUT.png IN...)." % IMAGE_BUDGET)
            write_json(cpath, read_json(cpath, []) + [fp])
            return
        if not ti.get("offset") and not ti.get("limit") and os.path.isfile(fp) and line_count(fp, READ_MAX_LINES) > READ_MAX_LINES:
            raise Refuse("read_range", "This file is over %d lines; Grep for what you need, then Read with offset and limit." % READ_MAX_LINES)


def _post(ev, out, cfg):
    if "big_output" in cfg.get("off", []):
        return
    resp = ev.get("tool_response", {})
    text = json.dumps(resp) if not isinstance(resp, str) else resp
    if ev.get("tool_name") == "Bash" and len(text) > BIG_OUTPUT_CHARS:
        out["stdout"] = json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext":
            "plan-runner guard (big_output): that output was %d characters. Send long output to a file and grep it, or use the quiet wrappers." % len(text)}})


def _stop(ev, run, out, cfg, agent):
    if ev.get("stop_hook_active") or "report_format" in cfg.get("off", []):
        return
    msg = str(ev.get("last_assistant_message") or "").strip()
    lines = [l for l in msg.splitlines() if l.strip()]
    if not lines:  # the report went through the hand-back tool (or there is none: the coordinator's "no report" path)
        return
    first = lines[0].strip().lower().lstrip("#*` ") if lines else ""
    limit = SEARCH_REPORT_MAX_LINES if first.startswith("found") else REPORT_MAX_LINES
    if len(lines) > limit or not first.startswith(REPORT_STARTS):
        run.log("sendback", rule="report_format", agent=agent, lines=len(lines))
        out["stdout"] = json.dumps({"decision": "block", "reason":
            "plan-runner guard (report_format): end with the report only, at most %d lines, first line `done <task> <commit>` or `blocked <task>: <question>` (a reviewer: `approve` or `changes`; searcher `found`, diagnoser `cause`, checker `checks pass|fail`)." % REPORT_MAX_LINES})


def hook_main(stdin_text):
    out = {"exit": 0, "stderr": "", "stdout": ""}
    t0 = time.time()
    run = None
    where = ""
    try:
        ev = json.loads(stdin_text or "{}")
        where = "%s:%s" % (ev.get("hook_event_name", ""), ev.get("tool_name", ""))
        cwd = ev.get("cwd") or os.getcwd()
        sid = ev.get("session_id") or ""
        run = Run(cwd, session=sid)
        if not run.ok and sid and not ev.get("agent_id") and ev.get("hook_event_name") == "PreToolUse" and ev.get("tool_name") == "Agent":
            run = bind(ev, cwd) or run
        handle(ev, run, out)
    except Exception:  # the guard never blocks on its own error
        out = {"exit": 0, "stderr": "", "stdout": ""}
        try:
            if run is not None and run.ok:
                run.log("error", where=where, trace=traceback.format_exc()[-1500:])
        except Exception:
            pass
    dt = time.time() - t0
    if dt > SLOW_SEC and run is not None and run.ok:
        try:
            run.log("slow", sec=round(dt, 2))
        except Exception:
            pass
    return out


# --- commands ------------------------------------------------------------------------------------------------------------

def _cfg_cmd(args, rid=""):
    run = Run(os.getcwd(), rid=rid)
    if not run.ok:
        print(run.err or "no active run")
        return 1
    cfg = run.guard_cfg()
    cmd = args[0]
    rule = args[1] if len(args) > 1 else ""
    if rule and rule not in RULES:
        print("unknown rule %s (rules: %s)" % (rule, ", ".join(RULES)))
        return 1
    if cmd == "off":
        if rule:
            cfg["off"] = sorted(set(cfg.get("off", [])) | {rule})
        else:
            cfg["all_off"] = True
    elif cmd == "on":
        if rule:
            cfg["off"] = [r for r in cfg.get("off", []) if r != rule]
        else:
            cfg["all_off"] = False
    elif cmd == "allow":
        if len(args) < 3:
            print("usage: guard.py allow RULE AGENT")
            return 1
        cfg.setdefault("allow", []).append([rule, args[2]])
    write_json(run.path("guard.json"), cfg)
    run.log("config", cmd=" ".join(args))
    print("guard: all %s; rules off: %s; allowed: %s" % ("off" if cfg.get("all_off") else "on", cfg.get("off", []) or "none", cfg.get("allow", []) or "none"))
    return 0


def health(run):
    """Counts from the guard's log and the registered agents (run_file.py status shows them)."""
    h = {"errors": 0, "slow": 0, "refuse": 0, "sendback": 0, "by_rule": {}, "error_where": {}, "refusals": []}
    try:
        with open(run.path("guard.log"), encoding="utf8") as f:
            for line in f:
                e = json.loads(line)
                k = e.get("kind", "")
                k = "errors" if k == "error" else k
                if k in h and isinstance(h[k], int):
                    h[k] += 1
                if k == "refuse" and e.get("rule"):
                    h["by_rule"][e["rule"]] = h["by_rule"].get(e["rule"], 0) + 1
                    h["refusals"].append(e)
                if k == "errors":
                    h["error_where"][e.get("where", "?")] = h["error_where"].get(e.get("where", "?"), 0) + 1
    except (OSError, ValueError):
        pass
    agents_dir = run.path("agents")
    h["agents"] = sorted(f[:-5] for f in os.listdir(agents_dir) if f.endswith(".json")) if os.path.isdir(agents_dir) else []
    h["cfg"] = run.guard_cfg()
    h["session_bound"] = bool(run.active.get("session"))
    return h


def selftest():
    """Feed sample events through every rule in a scratch state folder and check each verdict. Prints one line per check."""
    import tempfile
    tmp = tempfile.mkdtemp(prefix="plan-runner-selftest-")
    repo = os.path.join(tmp, "repo")
    wt = os.path.join(repo, ".claude", "worktrees", "agent-x")
    os.makedirs(os.path.join(repo, ".git", "worktrees", "agent-x"))
    os.makedirs(wt)
    with open(os.path.join(wt, ".git"), "w") as f:
        f.write("gitdir: %s\n" % os.path.join(repo, ".git", "worktrees", "agent-x"))
    write_json(os.path.join(repo, ".git", "plan-runner", "active", "self.json"), {"run": "self", "started": time.time(), "session": "S"})
    big = os.path.join(wt, "big.ts")
    with open(big, "w") as f:
        f.write("x\n" * (READ_MAX_LINES + 5))

    def ev(name, tool="", ti=None, agent="A", **kw):
        d = {"hook_event_name": name, "tool_name": tool, "tool_input": ti or {}, "agent_id": agent, "session_id": "S", "cwd": wt}
        d.update(kw)
        return json.dumps(d)

    hook_main(ev("SubagentStart", agent_type="general-purpose"))
    hook_main(ev("SubagentStart", agent="R", agent_type="plan-reviewer"))
    hook_main(ev("SubagentStart", agent="C", agent_type="plan-checker"))
    checks = [
        ("a reviewer's commit is refused", ev("PreToolUse", "Bash", {"command": "git add -A && git commit -m x"}, agent="R"), 2),
        ("a reviewer's diff passes", ev("PreToolUse", "Bash", {"command": "git diff a..b -- x.ts"}, agent="R"), 0),
        ("a reviewer's write is refused", ev("PreToolUse", "Write", {"file_path": os.path.join(wt, "a.ts")}, agent="R"), 2),
        ("the checker may run a whole suite", ev("PreToolUse", "Bash", {"command": "npm test"}, agent="C"), 0),
        ("one workspace's test file passes", ev("PreToolUse", "Bash", {"command": "npm test --workspace @ottlib/server -- titleParser"}), 0),
        ("one Android module passes", ev("PreToolUse", "Bash", {"command": "apps/android/gradlew -p apps/android :core:model:test"}), 0),
        ("the whole suite is refused", ev("PreToolUse", "Bash", {"command": "npm test"}), 2),
        ("every Android module is refused", ev("PreToolUse", "Bash", {"command": "apps/android/gradlew -p apps/android test"}), 2),
        ("a dev server is refused", ev("PreToolUse", "Bash", {"command": "npm run dev"}), 2),
        ("a dev server in the background passes", ev("PreToolUse", "Bash", {"command": "npm run dev", "run_in_background": True}), 0),
        ("vitest in watch mode is refused", ev("PreToolUse", "Bash", {"command": "npx vitest --root packages/server"}), 2),
        ("git push is refused", ev("PreToolUse", "Bash", {"command": "git add -A && git push origin x"}), 2),
        ("git commit passes", ev("PreToolUse", "Bash", {"command": "git add -A && git commit -m t"}), 0),
        ("a nested agent is refused", ev("PreToolUse", "Agent", {"prompt": "x"}), 2),
        ("a write outside the worktree is refused", ev("PreToolUse", "Write", {"file_path": os.path.join(tmp, "elsewhere.ts")}), 2),
        ("a write inside passes", ev("PreToolUse", "Write", {"file_path": os.path.join(wt, "a.ts")}), 0),
        ("a long file read whole is refused", ev("PreToolUse", "Read", {"file_path": big}), 2),
        ("a long file read by range passes", ev("PreToolUse", "Read", {"file_path": big, "offset": 1, "limit": 50}), 0),
        ("the main chat is never touched", ev("PreToolUse", "Bash", {"command": "npm run dev"}, agent=""), 0),
        ("another session is never touched", json.dumps({"hook_event_name": "PreToolUse", "tool_name": "Bash", "agent_id": "B",
                                                          "session_id": "OTHER", "cwd": wt, "tool_input": {"command": "git push"}}), 0),
        ("a bad event fails open", "{not json", 0),
    ]
    for i in range(IMAGE_BUDGET):
        hook_main(ev("PreToolUse", "Read", {"file_path": os.path.join(wt, "s%d.png" % i)}))
    checks.append(("the %dth image is refused" % (IMAGE_BUDGET + 1), ev("PreToolUse", "Read", {"file_path": os.path.join(wt, "z.png")}), 2))
    ok = True
    for label, payload, want in checks:
        got = hook_main(payload)["exit"]
        good = got == want
        ok = ok and good
        print("%s %s" % ("ok  " if good else "FAIL", label))
    stop = json.loads(ev("SubagentStop", last_assistant_message="Here is a long story\n" * 20))
    res = hook_main(json.dumps(stop))
    good = '"block"' in res["stdout"]
    stop["stop_hook_active"] = True
    good = good and hook_main(json.dumps(stop))["stdout"] == ""
    ok = ok and good
    print("%s a long report is sent back once" % ("ok  " if good else "FAIL"))
    shutil.rmtree(tmp, ignore_errors=True)
    print("selftest: %s" % ("passed" if ok else "FAILED"))
    return 0 if ok else 1


def main(argv):
    if not argv or argv[0] == "hook":
        out = hook_main(sys.stdin.read())
        if out["stdout"]:
            sys.stdout.write(out["stdout"])
        if out["stderr"]:
            sys.stderr.write(out["stderr"])
        return out["exit"]
    if argv[0] == "selftest":
        return selftest()
    argv, rid = take_run(argv)
    if argv and argv[0] == "status":
        run = Run(os.getcwd(), rid=rid)
        if not run.ok:
            print(run.err or "no active run")
            return 0
        print(json.dumps(health(run), indent=1))
        return 0
    if argv and argv[0] in ("off", "on", "allow"):
        return _cfg_cmd(argv, rid)
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
