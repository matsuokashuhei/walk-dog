#!/usr/bin/env python3

import json
import re
import sys
from pathlib import Path


def direct_docs_directories(command: str) -> set[str]:
    return set(re.findall(r"docs/([^/\s'\"`]+)(?:/|$)", command))


def main() -> None:
    hook_input = json.load(sys.stdin)
    command = hook_input.get("tool_input", {}).get("command", "")
    workspace = Path(hook_input["cwd"])
    docs_directory = workspace / "docs"
    existing_directories = {
        path.name for path in docs_directory.iterdir() if path.is_dir()
    }
    unexpected_directories = sorted(
        directory
        for directory in direct_docs_directories(command)
        if directory not in existing_directories
    )

    if unexpected_directories:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": (
                            "docs 直下には specs、development、logs を使用してください: "
                            + ", ".join(unexpected_directories)
                        ),
                    }
                },
                ensure_ascii=False,
            )
        )


if __name__ == "__main__":
    main()
