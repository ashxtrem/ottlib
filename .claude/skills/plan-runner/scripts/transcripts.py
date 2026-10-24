"""Reading Claude Code transcripts for the plan runner: the coordinator's context size, and real token use and cost per helper
(.claude/skills/plan-runner/SKILL.md).

Transcripts: <projects root>/<project slug>/<session id>.jsonl, and one <session id>/subagents/agent-<agentId>.jsonl per helper.
The projects root is ~/.claude/projects, or $PLAN_RUNNER_PROJECTS (tests use it so they never touch the real folder).
One API call is logged over several lines with the same message id, so each field takes its largest value per message id.
"""
import datetime as dt
import glob
import json
import os
import re

CONTEXT_WARN = 150_000           # a coordinator context over this is expensive: every call re-reads it

# API-equivalent prices live in prices.json next to this file (dollars per million tokens), so an outside mod reads the same numbers.
# PRICES maps a model id to (input, output, cache read); the cache write is CACHE_WRITE_X times input (the 1-hour cache, see the note there).
def _load_prices(path=None):
    with open(path or os.path.join(os.path.dirname(os.path.abspath(__file__)), "prices.json"), encoding="utf-8") as f:
        data = json.load(f)
    models = data["models"]
    return ({k: (float(m["input"]), float(m["output"]), float(m["cache_read"])) for k, m in models.items()},
            {k: m.get("name", k) for k, m in models.items()}, float(data["cache_write_x"]))


PRICES, PRICE_NAMES, CACHE_WRITE_X = _load_prices()
FIELDS = ("in", "cw", "cr", "out")
USAGE_KEYS = {"in": "input_tokens", "cw": "cache_creation_input_tokens", "cr": "cache_read_input_tokens", "out": "output_tokens"}


def projects_root():
    env = os.environ.get("PLAN_RUNNER_PROJECTS")
    if env:
        return env
    return os.path.join(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude"), "projects")


def slug(path):
    """Claude Code's folder name for a working directory: every character that isn't a letter or digit becomes '-'."""
    path = path.rstrip("\\/") or path   # a trailing separator is not part of the folder name
    full = path if re.match(r"[A-Za-z]:[\\/]", path) else os.path.abspath(path)   # a Windows drive path is already absolute
    return re.sub(r"[^A-Za-z0-9]", "-", full)


SLUG_PREFIX = 200   # Claude Code may cut a very long folder name and add a hash; the first characters stay the same


def project_dir(cwd):
    """The transcripts folder of a working directory: the exact slug, or for a very long path an existing folder that starts with it."""
    root, s = projects_root(), slug(cwd)
    exact = os.path.join(root, s)
    if os.path.isdir(exact) or len(s) <= SLUG_PREFIX:
        return exact
    try:
        near = [os.path.join(root, d) for d in os.listdir(root)   # the cut name plus a hash-like tail, nothing looser
                if d.startswith(s[:SLUG_PREFIX]) and re.fullmatch(r"-[0-9A-Za-z]{4,}", d[SLUG_PREFIX:]) and os.path.isdir(os.path.join(root, d))]
        return max(near, key=os.path.getmtime) if near else exact
    except OSError:
        return exact


def newest_transcript(cwd):
    """Fallback when the guard has not recorded this session's transcript: the most recently modified .jsonl in the cwd's folder.
    It can pick another session that is open in the same folder at the same time (the begin note names the file it took)."""
    files = glob.glob(os.path.join(glob.escape(project_dir(cwd)), "*.jsonl"))
    return max(files, key=os.path.getmtime) if files else ""


def helper_path(coordinator, agent_id):
    """The helper's transcript next to the coordinator's: <session>/subagents/agent-<id>.jsonl."""
    aid = agent_id[6:] if agent_id.startswith("agent-") else agent_id
    return os.path.join(os.path.splitext(coordinator)[0], "subagents", "agent-%s.jsonl" % aid)


def _num(v):
    """A usage count: a number as an int, anything else (a string, null, a list) as 0."""
    try:
        return int(v) if isinstance(v, (int, float)) else 0
    except (ValueError, OverflowError):   # NaN or infinity
        return 0


def _usage_of(e):
    """(message, usage) of an assistant line, or None for any other line (including JSON that is not an object)."""
    if not isinstance(e, dict) or e.get("type") != "assistant":
        return None
    m = e.get("message")
    us = m.get("usage") if isinstance(m, dict) else None
    return (m, us) if isinstance(us, dict) else None


def _ts(s):
    try:
        return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except (ValueError, AttributeError):
        return None


def _calls(path, since=None, until=None):
    """One dict per API call (message id): the largest value of each usage field, and the model.
    Claude Code also logs `<synthetic>` assistant lines (errors, interrupts) with no usage: those are not calls."""
    seen = {}
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            if '"usage"' not in line:
                continue
            try:
                e = json.loads(line)
            except ValueError:
                continue
            mu = _usage_of(e)
            if mu is None:
                continue
            m, us = mu
            if since is not None or until is not None:
                t = _ts(e.get("timestamp", ""))
                if t is None or (since is not None and t < since) or (until is not None and t > until):
                    continue
            mid = m["id"] if isinstance(m.get("id"), str) and m["id"] else e.get("uuid")
            if not isinstance(mid, str) or not mid:
                continue   # no id at all: it can't be told apart from other calls, so it isn't merged with them
            model = m["model"] if isinstance(m.get("model"), str) else "?"
            cur = seen.setdefault(mid, {"model": model, "in": 0, "cw": 0, "cr": 0, "out": 0})
            for k, name in USAGE_KEYS.items():
                cur[k] = max(cur[k], _num(us.get(name)))
    return [c for c in seen.values() if not (c["model"] == "<synthetic>" and not any(c[k] for k in FIELDS))]


def read_usage(path, since=None, until=None):
    """Totals {calls, in, cw, cr, out, models: {model: {calls, in, cw, cr, out}}} of one transcript (None when unreadable)."""
    try:
        calls = _calls(path, since, until)
    except OSError:
        return None
    u = {"calls": len(calls), "in": 0, "cw": 0, "cr": 0, "out": 0, "models": {}}
    for c in calls:
        mm = u["models"].setdefault(c["model"], {"calls": 0, "in": 0, "cw": 0, "cr": 0, "out": 0})
        mm["calls"] += 1
        for k in FIELDS:
            u[k] += c[k]
            mm[k] += c[k]
    return u


def merge(a, b):
    """Add usage b into a (a may be None)."""
    if a is None:
        a = {"calls": 0, "in": 0, "cw": 0, "cr": 0, "out": 0, "models": {}}
    for k in ("calls",) + FIELDS:
        a[k] += b[k]
    for model, mm in b["models"].items():
        am = a["models"].setdefault(model, {"calls": 0, "in": 0, "cw": 0, "cr": 0, "out": 0})
        for k in ("calls",) + FIELDS:
            am[k] += mm[k]
    return a


def price_note():
    """The footer under a usage table, built from PRICES so it never drifts from what was charged."""
    def g(x):
        return ("%.2f" % x).rstrip("0").rstrip(".")
    parts = ["%s in %s / out %s / cache read %s" % (PRICE_NAMES.get(k, k), g(p[0]), g(p[1]), g(p[2])) for k, p in PRICES.items()]
    return ("Cost is API-equivalent (%s dollars per million tokens; cache write %sx input, the 1-hour cache). A model without a price "
            "shows ?. On a subscription nothing is billed per token." % (", ".join(parts), g(CACHE_WRITE_X)))


def price_of(model):
    for key, p in PRICES.items():
        if model.startswith(key):
            return p
    return None


def cost(u):
    """API-equivalent dollars of a usage dict, or None when a model that used tokens has no price."""
    total = 0.0
    for model, mm in u["models"].items():
        if not any(mm[k] for k in FIELDS):
            continue   # no tokens (`<synthetic>`, or a missing model name "?"): costs nothing and needs no price
        p = price_of(model)
        if p is None:
            return None
        total += (mm["in"] * p[0] + mm["cw"] * p[0] * CACHE_WRITE_X + mm["cr"] * p[2] + mm["out"] * p[1]) / 1e6
    return total


def context_tokens(path):
    """What the latest call of this transcript read: input + cache read + cache write (None when none can be read)."""
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            f.seek(max(0, size - 2_000_000))   # the latest call is near the end; a long tail is plenty
            tail = f.read().decode("utf-8", errors="replace")
    except OSError:
        return None
    last = None
    for line in tail.splitlines():
        if '"usage"' not in line:
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        mu = _usage_of(e)
        if mu is None:
            continue
        total = sum(_num(mu[1].get(USAGE_KEYS[k])) for k in ("in", "cw", "cr"))
        if total > 0:   # a `<synthetic>` line has none: it must not hide the real latest call
            last = total
    return last


def context_warning(tokens):
    if tokens is None or tokens <= CONTEXT_WARN:
        return ""
    return ("WARNING: this coordinator session already holds about %dk tokens of context (limit %dk). Every coordinator call re-reads it "
            "on the coordinator's model, which made up a third of the last run's cost. Better: `/clear` or open a new session, then "
            "`/plan-runner resume` (or start the run there). The run is not blocked." % (tokens // 1000, CONTEXT_WARN // 1000))


# --- the usage report -----------------------------------------------------------------------------------------------------

def _n(x):
    return "%.2fM" % (x / 1e6) if x >= 1e6 else "%.0fk" % (x / 1e3) if x >= 1e3 else str(x)


def _money_text(c):
    """A cost in dollars as the tables and the JSON `cost_text` show it: "$0.00", or "?" when a used model has no price."""
    return "$%.2f" % c if c is not None else "?"


def _money(u):
    return _money_text(cost(u) if u else None)


def _with_text(r):
    """A report row with its JSON fields: cost rounded to 4 places and `cost_text`, the exact text of the table cell (made from the unrounded cost)."""
    if r is None:
        return None
    c = r.get("cost")
    return dict(r, cost=None if c is None else round(c, 4), cost_text=_money_text(c))


def _short_model(u):
    """The models a transcript ran on, short (opus, sonnet, haiku); a fallback mid-run shows both."""
    names = []
    for m in sorted((u or {}).get("models", {})):
        n = next((k for k in ("opus", "sonnet", "haiku", "fable") if k in m), m)
        if n not in names:
            names.append(n)
    return "+".join(names) or "?"


def _report_row(task, role, helper, u, effort=""):
    """One row of the run report: raw numbers (cost in dollars, None when a used model has no price); the table and the JSON both format this."""
    return {"helper": helper, "task": task, "role": role, "model": _short_model(u), "effort": effort, "calls": u["calls"], "input": u["in"],
            "output": u["out"], "cache_read": u["cr"], "cache_write": u["cw"], "cost": cost(u)}


def _row(r):
    money = _money_text(r["cost"])
    return "%-11s %-9s %-10s %-7s %-6s %5d %9s %9s %8s %7s %8s" % (r["task"], r["role"], r["helper"][:9], r["model"], r["effort"], r["calls"],
                                                                _n(r["cache_read"]), _n(r["cache_write"]), _n(r["input"]), _n(r["output"]), money)


def report_data(run, coordinators, now):
    """The usage of a run as numbers: {"rows": [one per helper, in run order; a helper with no transcript has "missing": True], "tasks": [the total of each
    task with more than one helper], "by_type": [one per role], "main": the coordinator row or None, "total": the run row or None}.
    `coordinators`: transcript paths of the coordinator session(s). report_lines and report_json both format this."""
    rows, tasks, run_total, by_role = [], [], None, {}
    groups = []
    for tid in run["order"]:
        t = run["tasks"][tid]
        groups.append((tid, t.get("agents") or ([{"id": t["agent"], "role": "worker"}] if t.get("agent") else [])))
    if run.get("helpers"):
        groups.append(("run", run["helpers"]))   # run-level helpers: checker, gate review, searcher, diagnoser
    for tid, agents in groups:
        task_total = None
        for a in agents:
            u = None
            for c in coordinators:
                u = read_usage(helper_path(c, a["id"]))
                if u:
                    break
            if u is None:
                rows.append({"helper": a["id"], "task": tid, "role": a["role"], "missing": True})
                continue
            rows.append(_report_row(tid, a["role"], a["id"], u, a.get("effort", "")))
            task_total, run_total = merge(task_total, u), merge(run_total, u)
            by_role[a["role"]] = merge(by_role.get(a["role"]), u)
        if task_total and len(agents) > 1:
            tasks.append(_report_row(tid, "total", "", task_total))
    coord = None
    for c in coordinators:
        u = read_usage(c, run.get("started"), run.get("ended") or now)
        coord = merge(coord, u) if u else coord
    if coord:
        run_total = merge(run_total, coord)
    return {"rows": rows, "tasks": tasks, "by_type": [_report_row("all", role, "", u) for role, u in sorted(by_role.items())],
            "main": _report_row("coordinator", "", "", coord) if coord else None,
            "total": _report_row("RUN TOTAL", "", "", run_total) if run_total else None}


def report_lines(run, coordinators, now, data=None):
    """The usage table of a run. `coordinators`: transcript paths of the coordinator session(s)."""
    d = data or report_data(run, coordinators, now)
    lines = ["%-11s %-9s %-10s %-7s %-6s %5s %9s %9s %8s %7s %8s" % ("task", "role", "agent", "model", "effort", "calls", "cache_rd", "cache_wr",
                                                                   "input", "output", "cost")]
    missing = [r["helper"] for r in d["rows"] if r.get("missing")]
    totals = {r["task"]: r for r in d["tasks"]}
    for i, r in enumerate(d["rows"]):
        if r.get("missing"):
            lines.append("%-11s %-9s %-10s no transcript found (looked next to %s)" % (r["task"], r["role"], r["helper"][:9],
                                                                                       os.path.basename(coordinators[0]) if coordinators else "no coordinator transcript"))
        else:
            lines.append(_row(r))
        if (i + 1 == len(d["rows"]) or d["rows"][i + 1]["task"] != r["task"]) and r["task"] in totals:
            lines.append(_row(totals[r["task"]]))
    lines += [_row(r) for r in d["by_type"]]
    if d["main"]:
        lines.append(_row(d["main"]))
    else:
        lines.append("coordinator: no transcript found, its use is not counted")
    if d["total"]:
        lines.append(_row(d["total"]))
    lines.append(price_note())
    lines.append("The completion notice's total_tokens is the helper's final context size, not what it used: the numbers above come from the transcripts.")
    if missing:
        lines.append("%d agent(s) without a transcript: %s" % (len(missing), ", ".join(missing)))
    return lines


def report_json(run, coordinators, now, data=None):
    """The same rows as report_lines, as a JSON-ready dict; costs in dollars rounded to 4 places (None when a model has no price), each with `cost_text`, the text the table shows."""
    d = data or report_data(run, coordinators, now)
    fix = _with_text
    return {"rows": [fix(r) for r in d["rows"]], "tasks": [fix(r) for r in d["tasks"]], "by_type": [fix(r) for r in d["by_type"]],
            "main": fix(d["main"]), "total": fix(d["total"]), "note": price_note()}


def _meta(path):
    """agentType and description of a helper, from the agent-<id>.meta.json Claude Code writes next to its transcript."""
    try:
        with open(os.path.splitext(path)[0] + ".meta.json", encoding="utf-8") as f:
            m = json.load(f)
        return m.get("agentType") or "?", m.get("description") or ""
    except (OSError, ValueError):
        return "?", ""


def _session_row(helper, task, role, u):
    """One row of the session usage: raw numbers (cost in dollars, None when a used model has no price); the table and the JSON both format this."""
    return {"helper": helper, "task": task, "role": role, "model": _short_model(u), "effort": "", "calls": u["calls"], "input": u["in"],
            "output": u["out"], "cache_read": u["cr"], "cache_write": u["cw"], "cost": cost(u)}


def session_data(coordinator, since=None):
    """The usage of one chat with no run file (/plan-writer): {"rows": [one per helper], "by_type": [...], "main": row or None, "total": row or None}.
    `since` (epoch seconds) drops calls made before it, so an earlier topic in the same chat is not counted. Both outputs are built from this."""
    rows, total, by_type = [], None, {}
    for p in sorted(glob.glob(os.path.join(glob.escape(os.path.splitext(coordinator)[0]), "subagents", "agent-*.jsonl"))):
        u = read_usage(p, since)
        if not u or not u["calls"]:
            continue
        kind, desc = _meta(p)
        rows.append(_session_row(kind, desc, "helper", u))
        total, by_type[kind] = merge(total, u), merge(by_type.get(kind), u)
    chat = read_usage(coordinator, since)
    if chat:
        total = merge(total, chat)
    return {"rows": rows, "by_type": [_session_row(k, "", "type", u) for k, u in sorted(by_type.items())],
            "main": _session_row("main chat", "", "main", chat) if chat else None, "total": _session_row("TOTAL", "", "total", total) if total else None}


def _session_line(helper, task, r):
    money = _money_text(r["cost"])
    return "%-24s %-28s %-7s %5d %9s %9s %8s %7s %8s" % (helper, task, r["model"], r["calls"], _n(r["cache_read"]), _n(r["cache_write"]),
                                                       _n(r["input"]), _n(r["output"]), money)


def session_lines(coordinator, since=None, data=None):
    """The usage table of one chat with no run file (/plan-writer): every helper in <session>/subagents, then the chat itself."""
    d = data or session_data(coordinator, since)
    lines = ["%-24s %-28s %-7s %5s %9s %9s %8s %7s %8s" % ("helper", "task", "model", "calls", "cache_rd", "cache_wr", "input", "output", "cost")]
    lines += [_session_line(r["helper"][:24], r["task"][:28], r) for r in d["rows"]]
    lines += [_session_line("all " + r["helper"][:20], "", r) for r in d["by_type"]]
    for key in ("main", "total"):
        if d[key]:
            lines.append(_session_line(d[key]["helper"], "", d[key]))
    lines.append(price_note())
    return lines


def session_json(coordinator, since=None, data=None):
    """The same rows as session_lines, as a JSON-ready dict; costs in dollars rounded to 4 places (None when a model has no price), each with `cost_text`, the text the table shows."""
    d = data or session_data(coordinator, since)
    fix = _with_text
    return {"rows": [fix(r) for r in d["rows"]], "by_type": [fix(r) for r in d["by_type"]], "main": fix(d["main"]), "total": fix(d["total"]),
            "note": price_note()}


if __name__ == "__main__":
    import sys
    # python transcripts.py session [--since ISO-or-epoch] [--transcript PATH] [--json]: the usage of this chat and its helpers (/plan-writer).
    args = sys.argv[1:]
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]   # a flag with no value: take it out before the options are paired
    if not args or args[0] != "session":
        sys.exit("usage: transcripts.py session [--since ISO|EPOCH] [--transcript PATH] [--json]")
    opt = dict(zip(args[1::2], args[2::2]))
    since = opt.get("--since")
    if since is not None:
        since = float(since) if re.fullmatch(r"[0-9.]+", since) else _ts(since)
    path = opt.get("--transcript") or newest_transcript(os.getcwd())
    if not path:
        sys.exit("no transcript found for %s" % os.getcwd())
    if as_json:
        print(json.dumps(session_json(path, since), indent=2))
    else:
        print("\n".join(session_lines(path, since)))
