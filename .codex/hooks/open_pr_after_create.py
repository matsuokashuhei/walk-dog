#!/usr/bin/env python3

import json
import shlex
import subprocess
import sys
from collections.abc import Callable, Mapping, Sequence
from typing import Any


def command_is_pr_create(command: str) -> bool:
    try:
        tokens = shlex.split(command)
    except ValueError:
        return False

    return tokens[:3] == ["gh", "pr", "create"]


def command_succeeded(tool_response: Mapping[str, Any]) -> bool:
    return (
        tool_response.get("exit_code") == 0
        or tool_response.get("exitCode") == 0
        or tool_response.get("success") is True
    )


def run_hook(
    hook_input: Mapping[str, Any],
    runner: Callable[[Sequence[str]], Any] = subprocess.run,
) -> None:
    command = hook_input.get("tool_input", {}).get("command", "")
    response = hook_input.get("tool_response", {})

    if isinstance(command, str) and command_is_pr_create(command):
        if isinstance(response, Mapping) and command_succeeded(response):
            runner(["gh", "pr", "view", "--web"])


def main() -> int:
    run_hook(json.load(sys.stdin))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
