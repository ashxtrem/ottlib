"""The guard's rules for a helper's Bash commands: no whole-suite test runs (the checker's job), no commands that never return
(dev servers, watchers), no git or gh operations that are the coordinator's, and no commits from read-only helpers.

`check_bash` raises `Refuse` for the first rule a command breaks; guard.py decides whether that rule is off or allowed.
"""
import os
import re


class Refuse(Exception):
    def __init__(self, rule, text, path=""):
        super().__init__(text)
        self.rule = rule
        self.text = text
        self.path = path  # what was refused (a file path), so status can tell a real block from a false one


SHELL_SPLIT = re.compile(r"&&|\|\||;|\||\n|\$\(|`")
GIT_REFUSED = ("push", "merge", "rebase", "switch", "worktree", "stash", "remote", "pull", "fetch", "cherry-pick")
NPM_HEADS = ("npm", "pnpm", "yarn")
NPM_TEST = ("test", "t", "tst")
NPM_RUN = ("run", "run-script", "rum", "urn")
NPM_LONG_SCRIPTS = ("dev", "start", "serve", "preview", "watch")   # scripts that keep running: the root `dev` never returns
NPM_SCOPE_FLAGS = ("--workspace", "-w", "--prefix", "-C")         # one workspace's suite, not every package's
GRADLE_HEADS = ("gradlew", "gradle")
GRADLE_VALUE_FLAGS = ("-p", "--project-dir", "--tests", "-x", "--exclude-task", "-c", "--settings-file", "--init-script", "-I")
GRADLE_WHOLE_TASKS = ("test", "check", "build")                    # without a `:module:` prefix these run in every module
VITEST_SCOPE_FLAGS = ("--root", "-r", "--dir", "--project", "--workspace")
WHOLE_SUITE_TEXT = ("Run only your task's tests: `npm test --workspace @ottlib/<pkg> -- <file or name>`, or one Android module "
                    "(`apps/android/gradlew -p apps/android :core:model:test`). The full suite runs once after the merge (the checker).")
WATCH_TEXT = ("`%s` keeps running and never returns. Run one-shot commands (`vitest run`, `tsc -b`, `vite build`); start a server "
              "only with run_in_background and stop it before you report.")

_HEREDOC = re.compile(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n(?P<body>.*?)\n\s*\2\b", re.S)
_HEREDOC_SHELLS = ("bash", "sh", "zsh", "dash", "ksh")
_TIMEOUT_VALUE_FLAGS = ("-s", "-k", "--signal", "--kill-after")
_SHELL_VALUE_FLAGS = ("-o", "-O", "--rcfile", "--init-file")


def _heredoc_owner_is_shell(before):
    """True when the command that owns a `<<` (the last simple command on its line) runs its input as a script."""
    line = before.rsplit("\n", 1)[-1]
    toks = [t.strip("'\"") for t in SHELL_SPLIT.split(line)[-1].split()]
    names = [os.path.basename(t).lower().removesuffix(".exe") for t in toks]
    if any(n in _HEREDOC_SHELLS for n in names):
        return True
    return any(re.fullmatch(r"python[\d.]*", n) for n in names) and "-" in toks


def _heredoc_body(m):
    return "\n" + m.group("body") + "\n" if _heredoc_owner_is_shell(m.string[:m.start()]) else ""


def segments(cmd):
    """The simple commands in a shell line, each as a token list (leading `VAR=x` and `cd dir` steps dropped)."""
    out = []
    # heredoc bodies are text, not commands (a report or commit note may name a script),
    # unless the command owning the `<<` is a shell: then the body is run, so its lines are checked
    cmd = _HEREDOC.sub(_heredoc_body, cmd or "")
    for seg in SHELL_SPLIT.split(cmd):
        toks = seg.strip().strip("()").split()
        while toks and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[0]):
            toks = toks[1:]
        if toks:
            out.append(toks)
    return out


def _name(tok):
    """A command's bare name: no folder, no Windows suffix (`npm.cmd`, `gradlew.bat`, `node.exe`)."""
    b = os.path.basename(tok.strip("'\"")).lower()
    for ext in (".exe", ".cmd", ".bat", ".ps1"):
        if b.endswith(ext):
            return b[:-len(ext)]
    return b


def _strip_wrappers(toks):
    """Drop leading `timeout [flags] N`, `env [flags] [VAR=x]`, `nohup`, `bash|sh [flags]` (and `bash -c "..."`) and `npx [flags]`."""
    toks = [t.strip("'\"") for t in toks]
    for _ in range(8):
        if not toks:
            break
        head = _name(toks[0])
        if head == "timeout":
            i = 1
            while i < len(toks) and toks[i].startswith("-"):
                flag = toks[i]
                i += 2 if flag in _TIMEOUT_VALUE_FLAGS else 1
            toks = toks[i + 1:]   # the duration
        elif head == "env":
            i = 1
            while i < len(toks) and (toks[i].startswith("-") or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[i])):
                i += 2 if toks[i] in ("-u", "--unset", "-C", "--chdir") else 1
            toks = toks[i:]
        elif head in ("nohup", "time", "exec", "command", "sudo", "setsid", "stdbuf", "source", ".", "npx", "pnpx"):
            toks = toks[1:]
            while head in ("stdbuf", "npx", "pnpx") and toks and toks[0].startswith("-"):
                toks = toks[1:]
        elif head == "nice":
            i = 1
            while i < len(toks) and toks[i].startswith("-"):
                i += 2 if toks[i] in ("-n", "--adjustment") else 1
            toks = toks[i:]
        elif head in ("bash", "sh"):
            i = 1
            while i < len(toks) and toks[i].startswith("-"):
                flag = toks[i]
                if flag == "-c" or (flag.startswith("-") and not flag.startswith("--") and "c" in flag[1:]):
                    i += 1   # `bash -c "cmd ..."`: the command words follow (quotes already stripped)
                    break
                i += 2 if flag in _SHELL_VALUE_FLAGS else 1
            toks = toks[i:]
        else:
            break
    return toks


def _npm(args):
    """(script it runs: 'test', 'dev', ... or '', True when scoped to one workspace, True for --workspaces) of an npm line."""
    pos, scoped, every, i = [], False, False, 0
    while i < len(args):
        a = args[i]
        if a == "--":
            break
        if a in NPM_SCOPE_FLAGS:
            scoped, i = True, i + 2
            continue
        if any(a.startswith(f + "=") for f in NPM_SCOPE_FLAGS):
            scoped = True
        elif a in ("--workspaces", "-ws"):
            every = True
        elif not a.startswith("-"):
            pos.append(a)
        i += 1
    if not pos:
        return "", scoped, every
    if pos[0] in NPM_TEST:
        return "test", scoped, every
    if pos[0] in NPM_RUN and len(pos) > 1:
        return pos[1], scoped, every
    return pos[0], scoped, every


def _gradle_tasks(args):
    tasks, i = [], 0
    while i < len(args):
        a = args[i]
        if a in GRADLE_VALUE_FLAGS:
            i += 2
            continue
        if not a.startswith("-"):
            tasks.append(a)
        i += 1
    return tasks


def _vitest_watches(args):
    sub = next((a for a in args if not a.startswith("-")), "")
    if sub in ("watch", "dev"):
        return True
    return sub != "run" and "--run" not in args and not any(a in ("--watch=false", "--no-watch") for a in args)


def _vitest_whole(args):
    if any(a in VITEST_SCOPE_FLAGS or a.split("=")[0] in VITEST_SCOPE_FLAGS for a in args):
        return False
    filters = [a for a in args if not a.startswith("-") and a not in ("run", "watch", "dev", "related", "bench")]
    return not filters


def whole_suite(toks):
    """True for a test run across every package or module: root `npm test`, `npm test --workspaces`, `vitest run` with no
    filter at the root, and a Gradle `test`/`check`/`build` with no `:module:` prefix and no `--tests` filter."""
    toks = _strip_wrappers(toks)
    if not toks:
        return False
    head, args = _name(toks[0]), toks[1:]
    if head in NPM_HEADS:
        script, scoped, every = _npm(args)
        return script == "test" and (every or not scoped)
    if head == "vitest":
        return _vitest_whole(args)
    if head in GRADLE_HEADS:
        return "--tests" not in args and any(":" not in t and (t in GRADLE_WHOLE_TASKS or t.startswith("test"))
                                             for t in _gradle_tasks(args))
    return False


def watch_mode(toks):
    """The command's text when it never returns on its own (a dev server, a watcher), else ''."""
    toks = _strip_wrappers(toks)
    if not toks:
        return ""
    head, args = _name(toks[0]), toks[1:]
    text = " ".join(toks[:3])
    if head in NPM_HEADS:
        script = _npm(args)[0]
        return text if script in NPM_LONG_SCRIPTS else ""
    if head == "vitest":
        return text if _vitest_watches(args) else ""
    if head == "vite":   # only `vite build` and `vite optimize` return; a bare `vite --port N` is the dev server
        return "" if any(a in ("build", "optimize") for a in args) else text
    if head in ("tsx", "node") and ("watch" in args[:1] or "--watch" in args):
        return text
    if head == "tsc" and any(a in ("--watch", "-w") for a in args):
        return text
    if head == "nodemon" or (head in GRADLE_HEADS and any(a in ("--continuous", "-t") for a in args)):
        return text
    return ""


def check_bash(cmd, read_only=False, whole_suite_ok=False, background=False):
    """Raise Refuse for the first rule the command breaks. `read_only`: a reviewer, gate, searcher, diagnoser or checker;
    `whole_suite_ok`: the checker; `background`: the Bash call runs in the background (a server may)."""
    for toks in segments(cmd):
        head = _name(toks[0])
        if not whole_suite_ok and whole_suite(toks):
            raise Refuse("whole_suite", WHOLE_SUITE_TEXT)
        long_cmd = watch_mode(toks)
        if long_cmd and not background:
            raise Refuse("watch_mode", WATCH_TEXT % long_cmd)
        if head == "git" and len(toks) >= 2:
            sub = toks[1]
            if sub in GIT_REFUSED or (sub == "reset" and "--hard" in toks) or (sub == "checkout" and "--" not in toks) \
                    or (sub == "branch" and any(t in ("-D", "-d", "-m", "-M") for t in toks)):
                raise Refuse("git_ops", "`git %s` is the coordinator's job. Commit your work and report; the coordinator merges and pushes." % sub)
            if read_only and sub in ("add", "commit", "restore", "checkout", "reset", "apply", "am", "rm", "mv"):
                raise Refuse("read_only", "You are read-only: report what you found; a fixer makes the change.")
        if head == "gh":
            raise Refuse("git_ops", "`gh` is the coordinator's job; report instead.")
