"""Plan runner state: the run file the coordinator keeps instead of editing notes by hand (.claude/skills/plan-runner/SKILL.md).

  python run_file.py begin ID --plan PATH --branch NAME   start a run (makes it active for the guard); also resumes one, even after `end`.
                                                            Only from a linked worktree (Claude Code's EnterWorktree), never the main checkout.
                                                            It reads this chat's context size from its own transcript (CLAUDE_CODE_SESSION_ID),
                                                            else the guard's recorded one; with neither it says the size is unknown (no guessing)
  python run_file.py task ID TITLE --model M [--spec full|partial] [--checks "C1; C2"] [--deps A,B] [--review none|quick|full]
                                   [--tests T1,T2] [--plan-lines S] [--early-deps A,B]
                                   --early-deps: these deps only need to be built (status review or later), not reviewed: for a task
                                   that only reads their code, such as a long measurement; their review fixes go into its packet later
  python run_file.py set ID key=value ...                  status=building|review|fixing|approved|merged|blocked, commit=, note=, rounds=,
                                                            agent=<id> [role=worker|reviewer|fixer|searcher|diagnoser] [effort=low|medium|high]
                                                            (adds a helper; role defaults to worker; role= and effort= need agent= in the same call),
                                                            tokens= (the completion notice's number = the helper's final context size, not its use)
  python run_file.py helper AGENT ROLE [EFFORT]            a run-level helper (checker, gate, searcher, diagnoser) for the usage report
  python run_file.py ready                                 the tasks that can start: every dependency merged, or (a dependency
                                                            given with --early-deps) at least built and merged into the run branch
  python run_file.py status                                tasks + guard health (after every report)
  python run_file.py usage [--json]                        real token use and API-equivalent cost per task, role and helper, with each
                                                            helper's model (from its transcript) and effort (as recorded) (from transcripts)
  python run_file.py end                                   the run is over: the guard stops acting, a summary and the usage are printed,
                                                            and the helpers' worktrees and branches are removed
  python run_file.py show                                  the whole run file (to resume after /clear)
  python run_file.py merge TASK AGENT                      merge worktree-agent-AGENT (--no-ff), record commit= and the diff range;
                                                            status review (merged when the task's review is none). Prints the reviewer's
                                                            `git diff before..after`
  python run_file.py cleanup                               remove every helper's worktree and worktree-agent-* branch (end does it too)

Several runs may be active at once, each in its own worktree and chat. Every command except begin acts on one run: `--run ID`
(anywhere in the arguments) wins, else the active run whose branch is this checkout's branch, else the only active run; with
several and no match it lists them and asks for --run.

The state lives in the main repo's git folder (<git common dir>/plan-runner/runs/<id>/run.json, active/<id>.json), shared by every worktree.
"""
import json
import os
import re
import subprocess
import sys
import time

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # a Windows console is cp1252: a note with an arrow crashed `set`
    except (AttributeError, ValueError):
        pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guard  # noqa: E402
import transcripts  # noqa: E402

STATUSES = ("todo", "building", "review", "fixing", "approved", "merged", "blocked", "skipped")
DONE = ("merged", "skipped")
ROLES = ("worker", "reviewer", "fixer", "searcher", "diagnoser", "checker", "gate")
SPECS = ("full", "partial")


RUN_ID = ""   # --run, set by main


def _active():
    """(state dir, the active entry of the run the command means); exits with a message when there is none."""
    st = guard.state_dir(os.getcwd())
    if not st:
        sys.exit("not inside a git repo")
    act, err = guard.pick(guard.active_runs(st), RUN_ID, os.getcwd())
    if not act:
        sys.exit("no active run (python run_file.py begin ID ...)" if err == "no active run" else err)
    return st, act


def _run_path(st, rid):
    return os.path.join(st, "runs", rid, "run.json")


def _load():
    st, act = _active()
    rid = act["run"]
    run = guard.read_json(_run_path(st, rid), {})
    return st, rid, _mend(run if isinstance(run, dict) else {})


def _mend(run):
    """A hand-edited or damaged run file gets the shape the commands rely on, instead of a crash."""
    if not isinstance(run.get("tasks"), dict):
        run["tasks"] = {}
    if not isinstance(run.get("order"), list):
        run["order"] = list(run["tasks"])
    if not isinstance(run.get("coordinators"), list):
        run["coordinators"] = []
    run["coordinators"] = [p for p in run["coordinators"] if isinstance(p, str) and p]
    if not isinstance(run.get("helpers"), list):
        run["helpers"] = []
    run["helpers"] = [h for h in run["helpers"] if isinstance(h, dict) and h.get("id")]
    if "started" in run and not isinstance(run["started"], (int, float)):
        run["started"] = time.time()   # unknown start: the coordinator's window begins now
    if "ended" in run and not isinstance(run["ended"], (int, float)):
        run.pop("ended")
    return run


def _save(st, rid, run):
    guard.write_json(_run_path(st, rid), run)


def _opts(args):
    out, pos, i = {}, [], 0
    while i < len(args):
        if args[i].startswith("--") and i + 1 < len(args):
            out[args[i][2:]] = args[i + 1]
            i += 2
        else:
            pos.append(args[i])
            i += 1
    return pos, out


LIVE_SEC = 600   # a bound chat whose transcript was last written longer ago than this has been left


def _checkout(start):
    """(top-level folder, True when it is the main checkout: its .git is a folder) of the checkout around `start`."""
    d = os.path.abspath(start)
    while True:
        g = os.path.join(d, ".git")
        if os.path.exists(g):
            return d, os.path.isdir(g)
        if os.path.dirname(d) == d:
            return "", False
        d = os.path.dirname(d)


def _worktree_hint():
    return "Enter a worktree first (Claude Code's EnterWorktree), then begin again."


def _taken(old, sid):
    """True when the active entry `old` is bound to another chat that is still alive."""
    if not old or not old.get("session") or not sid or old["session"] == sid:
        return False
    t = old.get("transcript")
    try:
        return not (isinstance(t, str) and os.path.exists(t) and time.time() - os.path.getmtime(t) > LIVE_SEC)
    except (OSError, ValueError):
        return True


def begin(args):
    pos, o = _opts(args)
    if not pos or not re.fullmatch(r"[\w.\-]+", pos[0]):
        sys.exit("usage: begin ID --plan PATH --branch NAME (ID: letters, digits, . _ -)")
    st = guard.state_dir(os.getcwd())
    if not st:
        sys.exit("not inside a git repo")
    top, is_main = _checkout(os.getcwd())
    if not top or is_main:
        sys.exit("This is the main checkout, not a linked worktree. " + _worktree_hint())
    rid = pos[0]
    act = next((a for a in guard.active_runs(st) if a["run"] == rid), {})
    if _taken(act, os.environ.get("CLAUDE_CODE_SESSION_ID", "")):
        sys.exit("run %s is bound to another chat that is still writing; resume it there, or `python run_file.py end --run %s` first" % (rid, rid))
    run = guard.read_json(_run_path(st, rid), {})
    if not isinstance(run, dict) or not run:
        run = {"id": rid, "plan": o.get("plan", ""), "branch": o.get("branch", ""), "started": time.time(), "tasks": {}, "order": []}
    run.pop("ended", None)   # a resume after `end` is running again: the coordinator's window must not stay cut off
    warn = _check_coordinator(run, _known_transcript(act, rid))
    _save(st, rid, run)
    branch = o.get("branch") or run.get("branch") or guard.branch_of(os.getcwd())
    guard.write_json(guard.active_file(st, rid), {"run": rid, "started": time.time(), "branch": branch})
    print("run %s active (state %s). Packets must carry the line: plan-runner run %s" % (rid, os.path.dirname(_run_path(st, rid)), rid))
    if warn:
        print(warn)


def _known_transcript(act, rid):
    """The coordinator transcript the guard recorded for this run (its transcript_path, or the bound session id), if it still exists."""
    try:
        if act.get("run") != rid:
            return ""
        cands = [act.get("transcript")]
        if isinstance(act.get("session"), str) and act["session"]:
            cands.append(os.path.join(transcripts.project_dir(os.getcwd()), act["session"] + ".jsonl"))
        return next((p for p in cands if isinstance(p, str) and p and os.path.exists(p)), "")
    except (OSError, TypeError, ValueError):
        return ""


def _this_session():
    """This chat's own transcript, from the session id Claude Code gives every command it runs (CLAUDE_CODE_SESSION_ID): the sure
    answer, when the environment has it. "" otherwise."""
    sid = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
    if not sid:
        return ""
    try:
        p = os.path.join(transcripts.project_dir(os.getcwd()), sid + ".jsonl")
        return p if os.path.exists(p) else ""
    except (OSError, TypeError, ValueError):
        return ""


def _check_coordinator(run, known=""):
    """R1: remember this session's transcript and return a note or warning (never refuses, never crashes).
    The transcript is this chat's own (CLAUDE_CODE_SESSION_ID) or the one the guard recorded for the run; never a guess from the
    folder, which holds every concurrent chat."""
    try:
        t = _this_session() or known
        if not t:
            return "(coordinator transcript not found: its context size and usage are unknown)"
        ctx = transcripts.context_tokens(t)
    except Exception as e:   # a check, never a reason to fail `begin`
        return "(coordinator context not checked: %s)" % e.__class__.__name__
    if not isinstance(run.get("coordinators"), list):
        run["coordinators"] = []
    if t not in run["coordinators"]:
        run["coordinators"].append(t)
    run["context_at_begin"] = ctx
    if ctx is None:
        return "(coordinator context size unreadable: %s has no readable call near its end; it was not checked)" % os.path.basename(t)
    return transcripts.context_warning(ctx)


def task(args):
    pos, o = _opts(args)
    if len(pos) < 2:
        sys.exit("usage: task ID TITLE --model M ...")
    if o.get("spec", "full") not in SPECS:
        sys.exit("--spec must be one of %s" % ", ".join(SPECS))
    st, rid, run = _load()
    tid = pos[0]
    run["tasks"][tid] = {"id": tid, "title": " ".join(pos[1:]), "model": o.get("model", "sonnet"),
                         "spec": o.get("spec", "full"), "checks": [c.strip() for c in o.get("checks", "").split(";") if c.strip()],
                         "deps": [d for d in o.get("deps", "").split(",") if d], "review": o.get("review", "quick"),
                         "tests": [t for t in o.get("tests", "").split(",") if t], "plan_lines": o.get("plan-lines", ""),
                         "status": "todo", "commit": "", "agent": "", "agents": [], "tokens": 0, "rounds": 0, "note": ""}
    early = [d for d in o.get("early-deps", "").split(",") if d]
    run["tasks"][tid]["early_deps"] = early
    run["tasks"][tid]["deps"] += [d for d in early if d not in run["tasks"][tid]["deps"]]  # an early dep is still a dep
    if tid not in run["order"]:
        run["order"].append(tid)
    _save(st, rid, run)
    print("task %s added" % tid)


def set_(args):
    if len(args) < 2:
        sys.exit("usage: set ID key=value ...")
    st, rid, run = _load()
    t = run["tasks"].get(args[0])
    if t is None:
        sys.exit("no task %s" % args[0])
    role = effort = None
    pairs = [kv.partition("=") for kv in args[1:]]
    for k, _, v in pairs:
        if k == "status" and v not in STATUSES:
            sys.exit("status must be one of %s" % ", ".join(STATUSES))
        if k == "role":
            if v not in ROLES:
                sys.exit("role must be one of %s" % ", ".join(ROLES))
            role = v
        if k == "effort":
            effort = v
    if (role is not None or effort is not None) and not any(k == "agent" and v for k, _, v in pairs):
        sys.exit("role= and effort= name the helper that agent= adds: give agent=<id> in the same call")
    for k, _, v in pairs:
        if k == "agent":
            _add_agent(t, v)
        elif k not in ("role", "effort"):
            t[k] = int(v) if k in ("tokens", "rounds") and v.isdigit() else v
    if role is not None:
        _set_role(t, role)
    if effort is not None:
        _set_latest(t, "effort", effort)
    t["at"] = time.time()
    _save(st, rid, run)
    print("%s: %s" % (args[0], ", ".join(args[1:])))


def _add_agent(t, aid):
    """Every helper of a task (worker, reviewers, fixers) is kept for the usage report; `agent` stays the latest id."""
    agents = t.setdefault("agents", [])
    if t.get("agent") and not any(a["id"] == t["agent"] for a in agents):
        agents.append({"id": t["agent"], "role": "worker"})   # a run file from before the list existed
    if not any(a["id"] == aid for a in agents):
        agents.append({"id": aid, "role": "worker"})
    t["agent"] = aid


def _set_role(t, role):
    """role= names the task's latest helper (the one `agent=` added or repeated in the same call)."""
    _set_latest(t, "role", role)


def _set_latest(t, key, value):
    for a in t.get("agents", []):
        if a["id"] == t.get("agent"):
            a[key] = value


def helper(args):
    if len(args) not in (2, 3) or args[1] not in ROLES:
        sys.exit("usage: helper AGENT ROLE [EFFORT] (role one of %s)" % ", ".join(ROLES))
    st, rid, run = _load()
    if not any(h["id"] == args[0] for h in run["helpers"]):
        run["helpers"].append({"id": args[0], "role": args[1]})
    if len(args) == 3:
        next(h for h in run["helpers"] if h["id"] == args[0])["effort"] = args[2]
    _save(st, rid, run)
    print("run helper %s: %s" % (args[0], args[1]))


BUILT = ("review", "fixing", "approved") + DONE


def ready_ids(run):
    def met(t, d):
        return run["tasks"].get(d, {}).get("status") in (BUILT if d in t.get("early_deps", []) else DONE)
    return [tid for tid in run["order"] if run["tasks"][tid]["status"] == "todo"
            and all(met(run["tasks"][tid], d) for d in run["tasks"][tid]["deps"])]


def ready(_args):
    _, _, run = _load()
    print(" ".join(ready_ids(run)) or "(none ready)")


def _agents_of(t):
    return t.get("agents") or ([{"id": t["agent"], "role": "worker"}] if t.get("agent") else [])


def status(_args):
    st, rid, run = _load()
    rows = ["%-5s %-9s %-7s %-7s %-6s %-9s %7s  %s" % ("task", "status", "model", "spec", "review", "commit", "ctx_tok", "title")]
    for tid in run["order"]:
        t = run["tasks"][tid]
        rows.append("%-5s %-9s %-7s %-7s %-6s %-9s %7s  %s" % (tid, t["status"], t["model"], t.get("spec", "full"), t["review"],
                                                              t["commit"][:9], t["tokens"] or "", t["title"][:60]))
    print("\n".join(rows))
    g = guard.Run(os.getcwd(), rid=rid)
    if g.ok:
        h = guard.health(g)
        cfg = h["cfg"]
        line = "guard: %s | session %s | agents seen %d | refusals %d | sent back %d | errors %d | slow %d" % (
            "OFF" if cfg.get("all_off") else "on", "bound" if h["session_bound"] else "NOT bound yet", len(h["agents"]),
            h["refuse"], h["sendback"], h["errors"], h["slow"])
        print(line)
        if cfg.get("off"):
            print("guard rules off: %s" % ", ".join(cfg["off"]))
        if h["errors"]:
            print("GUARD ERRORS: %d (%s). From 3 errors: python guard.py off (the whole guard, this run only), then tell the user;"
                  " the packet rules still apply." % (h["errors"], ", ".join("%s x%d" % kv for kv in h["error_where"].items())))
        if h["by_rule"]:
            print("refusals by rule: %s" % ", ".join("%s x%d" % kv for kv in sorted(h["by_rule"].items())))
            for e in h["refusals"][-5:]:
                print("  refused %s: %s %s %s" % (e.get("rule"), str(e.get("agent", ""))[:9], e.get("tool", ""), e.get("path", "") or "-"))
        started = [(t["id"], a["id"]) for t in run["tasks"].values() for a in _agents_of(t)]
        started += [("run:" + h["role"], h["id"]) for h in run["helpers"]]
        missing = list(dict.fromkeys(tid for tid, aid in started if aid not in h["agents"] and not cfg.get("all_off")))
        if missing:
            print("CANARY: no guard registration for %s: the guard isn't running for them; carry on with the packet rules and tell the user" % ", ".join(missing))
    left = ready_ids(run)
    print("ready: %s" % (" ".join(left) or "none"))


def _coordinators(run, act):
    """The coordinator session transcripts of this run: those kept so far, plus the bound session's."""
    if not isinstance(run.get("coordinators"), list):
        run["coordinators"] = []
    paths = run["coordinators"]
    cands = [act.get("transcript"), _this_session()]
    if isinstance(act.get("session"), str) and act["session"]:
        cands.append(os.path.join(transcripts.project_dir(os.getcwd()), act["session"] + ".jsonl"))
    for p in cands:
        if isinstance(p, str) and p and os.path.exists(p) and p not in paths:
            paths.append(p)
    return paths


def usage(args):
    st, rid, run = _load()
    paths = _coordinators(run, _active()[1])
    _save(st, rid, run)
    if "--json" in args:   # the rows and totals as JSON, for the chat table or an outside mod
        print(json.dumps(transcripts.report_json(run, paths, time.time()), indent=2))
    else:
        print("\n".join(transcripts.report_lines(run, paths, time.time())))


def end(_args):
    st, rid, run = _load()
    _coordinators(run, _active()[1])
    run["ended"] = time.time()
    _save(st, rid, run)
    guard.drop_active(st, rid)
    _cleanup(run)
    mins = (run["ended"] - run.get("started", run["ended"])) / 60
    print("run %s ended: %d tasks, %.0f min" % (rid, len(run["tasks"]), mins))
    coords = run.get("coordinators", [])
    data = transcripts.report_data(run, coords, run["ended"])   # one computation: the table and usage.json both come from it
    print("\n".join(transcripts.report_lines(run, coords, run["ended"], data=data)))
    path = os.path.abspath(os.path.join(os.path.dirname(_run_path(st, rid)), "usage.json"))
    guard.write_json(path, transcripts.report_json(run, coords, run["ended"], data=data))
    print("usage json: " + path)   # the agent dashboard mod parses this line (keep it the last line)


def show(_args):
    _, _, run = _load()
    print(json.dumps(run, indent=1))


def _git(*args):
    """(exit code, stdout+stderr stripped) of a git command in this checkout."""
    p = subprocess.run(("git",) + args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return p.returncode, (p.stdout + p.stderr).strip()


def merge(args):
    """Merge a helper's branch into the run branch and record it, in one call (the coordinator's chained git commands were
    refused by Claude Code's worktree check). A conflict is left in progress, listed, and nothing is recorded."""
    if len(args) != 2:
        sys.exit("usage: merge TASK AGENT")
    st, rid, run = _load()
    tid, aid = args
    t = run["tasks"].get(tid)
    if t is None:
        sys.exit("no task %s" % tid)
    _, before = _git("rev-parse", "HEAD")
    branch = "worktree-agent-" + aid
    code, out = _git("merge", "--no-ff", "-m", "Merge %s: %s" % (tid, t["title"]), branch)
    if code:
        _, names = _git("diff", "--name-only", "--diff-filter=U")
        conflicts = [n for n in names.splitlines() if n]
        print(out[-1500:])
        sys.exit("merge of %s not done%s; resolve it, commit, then `set %s status=review commit=<sha>`" % (
            branch, (": conflicts in " + ", ".join(conflicts)) if conflicts else "", tid))
    _, after = _git("rev-parse", "HEAD")
    t["commit"], t["before"] = after, before
    t["status"] = "merged" if t.get("review") == "none" else "review"
    t["at"] = time.time()
    _save(st, rid, run)
    print("%s merged %s: status=%s commit=%s" % (tid, branch, t["status"], after[:9]))
    print("diff: git diff %s..%s" % (before[:9], after[:9]))


def cleanup(_args):
    _cleanup(_load()[2])


def _cleanup(run):
    """Remove the run's helper worktrees and branches (`end` does it too), with one retry for a worktree a process still holds."""
    ids = {a["id"] for t in run["tasks"].values() for a in _agents_of(t)} | {h["id"] for h in run.get("helpers", [])}
    _, listing = _git("worktree", "list", "--porcelain")
    paths = [ln[9:] for ln in listing.splitlines() if ln.startswith("worktree ")]
    left = []
    for aid in sorted(ids):
        for path in [p for p in paths if p.replace("\\", "/").rstrip("/").endswith("/agent-" + aid)]:
            code, out = _git("worktree", "remove", "--force", path)
            if code:
                time.sleep(2)
                code, out = _git("worktree", "remove", "--force", path)
            if code:
                left.append("%s (%s)" % (path, out.splitlines()[-1] if out else "?"))
        _git("branch", "-D", "worktree-agent-" + aid)
    _git("worktree", "prune")
    print("removed the helpers' worktrees and branches" + ("; still there: " + "; ".join(left) if left else ""))


def main(argv):
    global RUN_ID
    argv, RUN_ID = guard.take_run(argv)
    cmds = {"begin": begin, "task": task, "set": set_, "helper": helper, "ready": ready, "status": status, "usage": usage, "end": end,
            "show": show, "merge": merge, "cleanup": cleanup}
    if not argv or argv[0] not in cmds:
        print(__doc__)
        return 1
    try:
        cmds[argv[0]](argv[1:])
    finally:
        RUN_ID = ""
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
