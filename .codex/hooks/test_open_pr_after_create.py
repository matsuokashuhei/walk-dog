#!/usr/bin/env python3

import importlib.util
import unittest
from pathlib import Path


HOOK_PATH = Path(__file__).with_name("open_pr_after_create.py")
SPEC = importlib.util.spec_from_file_location("open_pr_after_create", HOOK_PATH)
hook = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(hook)


class OpenPrAfterCreateTest(unittest.TestCase):
    def test_runs_gh_pr_view_web_after_successful_pr_create(self) -> None:
        calls = []
        payload = {
            "tool_input": {"command": "gh pr create --fill"},
            "tool_response": {"exit_code": 0},
        }

        hook.run_hook(payload, runner=lambda args: calls.append(args))

        self.assertEqual(calls, [["gh", "pr", "view", "--web"]])

    def test_skips_failed_pr_create(self) -> None:
        calls = []
        payload = {
            "tool_input": {"command": "gh pr create --fill"},
            "tool_response": {"exit_code": 1},
        }

        hook.run_hook(payload, runner=lambda args: calls.append(args))

        self.assertEqual(calls, [])

    def test_skips_other_commands(self) -> None:
        calls = []
        payload = {
            "tool_input": {"command": "gh pr view --web"},
            "tool_response": {"exit_code": 0},
        }

        hook.run_hook(payload, runner=lambda args: calls.append(args))

        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
