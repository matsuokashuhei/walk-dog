#!/usr/bin/env python3

import json
import sys
from collections.abc import Mapping
from typing import Any


CONTEXT = (
    "このセッションの目的は何ですか？ 最初の応答は目的確認だけにしてください。"
    " ユーザーの回答から簡潔な目的とslugを提示し、承認を受けてから"
    " baseline確認、ブランチ作成、docs/logsの作成、その他のツール実行を開始してください。"
)


def run_hook(hook_input: Mapping[str, Any]) -> None:
    if (
        hook_input.get("hook_event_name") != "SessionStart"
        or hook_input.get("source") != "startup"
    ):
        return

    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": CONTEXT,
                }
            },
            ensure_ascii=False,
        )
    )


def main() -> int:
    run_hook(json.load(sys.stdin))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
