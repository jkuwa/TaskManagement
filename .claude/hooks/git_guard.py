#!/usr/bin/env python3
"""Claude Code の PreToolUse フック（Bash 用）。

CLAUDE.md の Git / GitHub 運用ルールに違反するコマンドを実行前にブロックする。
違反があれば終了コード 2 で終了し、標準エラーに出した理由が Claude Code に伝わる。

チェックすること:
- ブランチ名が `<種類>/<Issue番号>-<内容>` の形式か、その Issue が Open か
- main で commit / push（やコミットを作る操作）をしていないか
- main への push（force push・削除を含む）をしていないか
- コミットメッセージが `<分類>: <内容>` の1行か
- `gh pr create` の本文に `Closes #<Issue番号>` があるか
- `gh pr merge` をしていないか（マージはユーザーが行う）
"""

import json
import os
import re
import shlex
import subprocess
import sys

MAIN_BRANCHES = {"main"}
BRANCH_PATTERN = re.compile(r"^(feature|fix|docs|chore)/([0-9]+)-[a-z0-9]+(-[a-z0-9]+)*$")
COMMIT_PATTERN = re.compile(r"^(Add|Update|Fix|Remove|Rename|Move|Refactor): \S.*$")

BRANCH_RULE = (
    "ブランチ名は `<種類>/<Issue番号>-<内容>` にしてください"
    "（種類: feature / fix / docs / chore、内容: 英小文字・数字・ハイフン。例: feature/12-task-list-api）。"
)
COMMIT_RULE = (
    "コミットメッセージは `<分類>: <日本語の内容>` の1行だけにしてください"
    "（分類: Add / Update / Fix / Remove / Rename / Move / Refactor。例: `Add: タスク一覧 API を追加`）。"
)

PUNCT = ";&|()<>\n"
SEPARATOR_CHARS = set(";|()\n")
WRAPPERS = {"env", "command", "exec", "time", "sudo", "nohup", "!"}
SHELLS = {"bash", "sh", "zsh"}


class Context:
    """1回の Bash 呼び出しの中で、ディレクトリとブランチの移動を追いかける。"""

    def __init__(self, cwd):
        self.cwd = cwd
        self.branches = {}  # ディレクトリ -> このコマンド内で切り替えた先のブランチ
        self.errors = []

    def current_branch(self, cwd):
        if cwd in self.branches:
            return self.branches[cwd]
        return run_git(cwd, ["symbolic-ref", "--short", "-q", "HEAD"])

    def block(self, message):
        if message not in self.errors:
            self.errors.append(message)


def run_git(cwd, args):
    try:
        result = subprocess.run(
            ["git", "-C", cwd] + args, capture_output=True, text=True, timeout=10
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def tokenize(command):
    command = command.replace("\\\n", " ")
    lexer = shlex.shlex(command, posix=True, punctuation_chars=PUNCT)
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    return list(lexer)


def split_segments(tokens):
    """`&&` `;` `|` 改行などで区切り、リダイレクトを取り除いたコマンドのリストにする。"""
    segments, current = [], []
    skip_next = False
    for token in tokens:
        if skip_next:
            skip_next = False
            continue
        if token and all(c in PUNCT for c in token):
            if any(c in SEPARATOR_CHARS for c in token) or set(token) == {"&"}:
                if current:
                    segments.append(current)
                current = []
                continue
            # リダイレクト（>, >>, 2>&1, <<EOF など）: 直前の数字と、直後の対象を捨てる
            if current and current[-1].isdigit():
                current.pop()
            skip_next = True
            continue
        current.append(token)
    if current:
        segments.append(current)
    return segments


def strip_wrappers(tokens):
    tokens = list(tokens)
    while tokens and (
        tokens[0] in WRAPPERS or re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[0])
    ):
        tokens.pop(0)
    return tokens


def check_command(command, ctx, depth=0):
    try:
        tokens = tokenize(command)
    except ValueError:
        if re.search(r"\b(git|gh)\b", command):
            ctx.block("コマンドを解析できませんでした（引用符の閉じ忘れなど）。git / gh は単純な形で実行してください。")
        return
    for segment in split_segments(tokens):
        check_segment(strip_wrappers(segment), ctx, depth)


def check_segment(tokens, ctx, depth):
    if not tokens:
        return
    name = os.path.basename(tokens[0])
    if name == "cd":
        target = tokens[1] if len(tokens) > 1 else "~"
        ctx.cwd = os.path.normpath(os.path.join(ctx.cwd, os.path.expanduser(target)))
    elif name in SHELLS and "-c" in tokens and depth < 3:
        index = tokens.index("-c")
        if index + 1 < len(tokens):
            check_command(tokens[index + 1], ctx, depth + 1)
    elif name == "git":
        check_git(tokens[1:], ctx)
    elif name == "gh":
        check_gh(tokens[1:], ctx)


# ---------- git ----------

def check_git(args, ctx):
    cwd = ctx.cwd
    i = 0
    while i < len(args) and args[i].startswith("-"):
        if args[i] in ("-C", "-c") and i + 1 < len(args):
            if args[i] == "-C":
                cwd = os.path.normpath(os.path.join(cwd, os.path.expanduser(args[i + 1])))
            i += 2
        else:
            i += 1
    if i >= len(args):
        return
    sub, rest = args[i], args[i + 1:]

    if sub == "switch":
        check_switch(rest, cwd, ctx)
    elif sub == "checkout":
        check_checkout(rest, cwd, ctx)
    elif sub == "branch":
        check_branch(rest, cwd, ctx)
    elif sub == "worktree":
        check_worktree(rest, cwd, ctx)
    elif sub == "commit":
        check_on_main("commit", cwd, ctx)
        check_commit_message(rest, cwd, ctx)
    elif sub in ("merge", "cherry-pick", "revert", "am"):
        check_on_main(sub, cwd, ctx)
    elif sub == "push":
        check_push(rest, cwd, ctx)


def positionals(args, value_options=()):
    result, i = [], 0
    while i < len(args):
        arg = args[i]
        if arg == "--":
            result.extend(args[i + 1:])
            break
        if arg in value_options:
            i += 2
            continue
        if not arg.startswith("-") or arg == "-":
            result.append(arg)
        i += 1
    return result


def option_value(args, names):
    """`-b name` / `--create=name` のような、オプションの値を返す。"""
    for i, arg in enumerate(args):
        for opt in names:
            if arg == opt and i + 1 < len(args):
                return args[i + 1]
            if opt.startswith("--") and arg.startswith(opt + "="):
                return arg[len(opt) + 1:]
    return None


def check_new_branch(name, cwd, ctx):
    match = BRANCH_PATTERN.match(name)
    if not match:
        ctx.block(f"ブランチ名 `{name}` はルールに合いません。{BRANCH_RULE}")
        return
    number = match.group(2)
    try:
        result = subprocess.run(
            ["gh", "issue", "view", number, "--json", "state", "-q", ".state"],
            cwd=cwd, capture_output=True, text=True, timeout=20,
        )
    except (OSError, subprocess.SubprocessError) as error:
        ctx.block(f"Issue #{number} を確認できませんでした（{error}）。先に Issue を作成してください。")
        return
    if result.returncode != 0:
        detail = result.stderr.strip() or "不明なエラー"
        ctx.block(f"Issue #{number} を確認できませんでした（{detail}）。先に Issue を作成し、その番号でブランチを作ってください。")
        return
    state = result.stdout.strip()
    if state != "OPEN":
        ctx.block(f"Issue #{number} は Open ではありません（{state}）。Open の Issue の番号でブランチを作ってください。")


def check_switch(args, cwd, ctx):
    created = option_value(args, ("-c", "-C", "--create", "--force-create"))
    if created is not None:
        check_new_branch(created, cwd, ctx)
        ctx.branches[cwd] = created
        return
    pos = positionals(args)
    if pos and pos[0] != "-" and "--detach" not in args and "-d" not in args:
        ctx.branches[cwd] = pos[0]
    else:
        ctx.branches[cwd] = None


def check_checkout(args, cwd, ctx):
    created = option_value(args, ("-b", "-B", "--orphan"))
    if created is not None:
        check_new_branch(created, cwd, ctx)
        ctx.branches[cwd] = created
        return
    if "--" in args:
        return  # ファイルの復元
    pos = positionals(args)
    if len(pos) == 1 and run_git(cwd, ["show-ref", "--verify", "--quiet", "refs/heads/" + pos[0]]) is not None:
        ctx.branches[cwd] = pos[0]


def check_branch(args, cwd, ctx):
    pos = positionals(args, value_options=("-u", "--set-upstream-to", "--contains",
                                           "--no-contains", "--merged", "--no-merged",
                                           "--points-at", "--sort", "--format"))
    flags = [a for a in args if a.startswith("-")]
    if any(f in ("-m", "-M", "--move", "-c", "-C", "--copy") for f in flags):
        if pos:
            check_new_branch(pos[-1], cwd, ctx)
        return
    non_create = ("-d", "-D", "--delete", "-l", "--list", "-a", "--all", "-r", "--remotes",
                  "-v", "-vv", "--verbose", "--show-current", "-u", "--set-upstream-to",
                  "--unset-upstream", "--edit-description", "--contains", "--no-contains",
                  "--merged", "--no-merged", "--points-at", "--format", "--sort")
    if any(f.split("=")[0] in non_create for f in flags):
        return
    if pos:
        check_new_branch(pos[0], cwd, ctx)


def check_worktree(args, cwd, ctx):
    if not args or args[0] != "add":
        return
    created = option_value(args[1:], ("-b", "-B"))
    if created is not None:
        check_new_branch(created, cwd, ctx)


def check_on_main(action, cwd, ctx):
    branch = ctx.current_branch(cwd)
    if branch in MAIN_BRANCHES:
        ctx.block(
            f"main ブランチで `git {action}` はできません。"
            "Issue を作成し、`git switch -c <種類>/<Issue番号>-<内容>` で作業ブランチを作ってから行ってください。"
        )


def check_commit_message(args, cwd, ctx):
    messages, i = [], 0
    reuse = amend = no_edit = False
    while i < len(args):
        arg = args[i]
        nxt = args[i + 1] if i + 1 < len(args) else None
        if arg in ("-m", "--message"):
            if nxt is not None:
                messages.append(nxt)
            i += 2
            continue
        if arg.startswith("--message="):
            messages.append(arg[len("--message="):])
        elif arg in ("-F", "--file") or arg.startswith("--file="):
            path = arg[len("--file="):] if arg.startswith("--file=") else nxt
            if arg in ("-F", "--file"):
                i += 1
            messages.append(read_message_file(path, cwd, ctx))
        elif arg in ("-C", "-c", "--reuse-message", "--reedit-message", "--fixup", "--squash") or \
                arg.startswith(("--reuse-message=", "--reedit-message=", "--fixup=", "--squash=")):
            reuse = True
            if arg in ("-C", "-c", "--reuse-message", "--reedit-message", "--fixup", "--squash"):
                i += 1
        elif arg == "--amend":
            amend = True
        elif arg == "--no-edit":
            no_edit = True
        elif arg.startswith("-") and not arg.startswith("--") and "m" in arg[1:]:
            rest = arg[arg.index("m", 1) + 1:]  # -am "..." / -m"..."
            if rest:
                messages.append(rest)
            elif nxt is not None:
                messages.append(nxt)
                i += 1
        i += 1

    if reuse:
        return
    if not messages:
        if amend and no_edit:
            return
        ctx.block("コミットメッセージを `-m` で指定してください。" + COMMIT_RULE)
        return
    if len(messages) > 1:
        ctx.block("コミットメッセージに本文は付けられません（`-m` は1つだけ）。" + COMMIT_RULE)
        return
    message = messages[0]
    if message is None:
        return  # read_message_file がエラーを登録済み
    message = message.strip("\n")
    if "\n" in message:
        ctx.block("コミットメッセージは1行だけにしてください（本文は付けない）。" + COMMIT_RULE)
    elif not COMMIT_PATTERN.match(message):
        ctx.block(f"コミットメッセージ `{message}` は形式に合いません。" + COMMIT_RULE)


def read_message_file(path, cwd, ctx):
    if path in (None, "-"):
        ctx.block("コミットメッセージは標準入力ではなく `-m` で指定してください。" + COMMIT_RULE)
        return None
    try:
        with open(os.path.join(cwd, os.path.expanduser(path)), encoding="utf-8") as file:
            return file.read()
    except OSError:
        ctx.block(f"コミットメッセージのファイル `{path}` を読めませんでした。`-m` で指定してください。")
        return None


def check_push(args, cwd, ctx):
    if "--all" in args or "--mirror" in args:
        ctx.block("`git push --all` / `--mirror` は main も push するため使えません。作業ブランチだけを push してください。")
        return
    pos = positionals(args, value_options=("-o", "--push-option", "--repo", "--receive-pack", "--exec"))
    refspecs = pos[1:]
    current = ctx.current_branch(cwd)
    if not refspecs:
        if current in MAIN_BRANCHES:
            ctx.block("main ブランチから push はできません。作業ブランチに切り替えてから push してください。")
        return
    for refspec in refspecs:
        spec = refspec.lstrip("+")
        dest = spec.split(":", 1)[1] if ":" in spec else spec
        if dest in ("HEAD", "@"):
            dest = current or ""
        if dest.startswith("refs/heads/"):
            dest = dest[len("refs/heads/"):]
        if dest in MAIN_BRANCHES:
            ctx.block("main への push（force push・削除を含む）はできません。作業ブランチを push して PR を作ってください。")
            return


# ---------- gh ----------

def check_gh(args, ctx):
    pos = positionals(args, value_options=("-R", "--repo"))
    if len(pos) < 2 or pos[0] != "pr":
        return
    if pos[1] == "merge":
        ctx.block("PR のマージはユーザーが行います。Claude Code は `gh pr merge` を実行しません。")
    elif pos[1] == "create":
        check_pr_create(args, ctx)


def check_pr_create(args, ctx):
    if "--web" in args or "-w" in args:
        ctx.block("`gh pr create --web` は使えません。`--body` で本文（`Closes #<Issue番号>` を含む）を指定してください。")
        return
    head = option_value(args, ("-H", "--head"))
    branch = head.split(":")[-1] if head else ctx.current_branch(ctx.cwd)
    match = BRANCH_PATTERN.match(branch or "")
    if not match:
        ctx.block(f"ブランチ `{branch}` はルールに合わないため PR を作れません。{BRANCH_RULE}")
        return
    number = match.group(2)

    body = option_value(args, ("-b", "--body"))
    body_file = option_value(args, ("-F", "--body-file"))
    if body is None and body_file is not None:
        if body_file == "-":
            ctx.block("PR 本文は標準入力ではなく `--body` で指定してください。")
            return
        try:
            with open(os.path.join(ctx.cwd, os.path.expanduser(body_file)), encoding="utf-8") as file:
                body = file.read()
        except OSError:
            ctx.block(f"PR 本文のファイル `{body_file}` を読めませんでした。")
            return
    if body is None:
        ctx.block(f"PR 本文を `--body` で指定し、最後に `Closes #{number}` を書いてください。")
        return
    if not re.search(rf"(?i)\bcloses #{number}\b", body):
        ctx.block(f"PR 本文に `Closes #{number}`（ブランチの Issue 番号）を書いてください。")


def main():
    try:
        data = json.load(sys.stdin)
    except (ValueError, OSError):
        return 0
    command = (data.get("tool_input") or {}).get("command")
    if not isinstance(command, str) or not re.search(r"\b(git|gh)\b", command):
        return 0
    ctx = Context(data.get("cwd") or os.getcwd())
    check_command(command, ctx)
    if ctx.errors:
        print("Git 運用ルール（CLAUDE.md）に違反するため、このコマンドはブロックされました。", file=sys.stderr)
        for error in ctx.errors:
            print("- " + error, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
