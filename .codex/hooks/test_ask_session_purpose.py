#!/usr/bin/env python3

import importlib.util
import io
import json
import unittest
from contextlib import redirect_stdout
from pathlib import Path


HOOK_PATH = Path(__file__).with_name("ask_session_purpose.py")
SPEC = importlib.util.spec_from_file_location("ask_session_purpose", HOOK_PATH)
hook = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(hook)


class AskSessionPurposeTest(unittest.TestCase):
    def test_injects_a_purpose_question_for_a_new_session(self) -> None:
        output = io.StringIO()

        with redirect_stdout(output):
            hook.run_hook({"hook_event_name": "SessionStart", "source": "startup"})

        payload = json.loads(output.getvalue())
        context = payload["hookSpecificOutput"]
        self.assertEqual(context["hookEventName"], "SessionStart")
        self.assertIn("このセッションの目的は何ですか？", context["additionalContext"])
        self.assertIn("最初の応答は目的確認だけ", context["additionalContext"])

    def test_skips_resumed_sessions(self) -> None:
        output = io.StringIO()

        with redirect_stdout(output):
            hook.run_hook({"hook_event_name": "SessionStart", "source": "resume"})

        self.assertEqual(output.getvalue(), "")

    def test_skips_other_hook_events(self) -> None:
        output = io.StringIO()

        with redirect_stdout(output):
            hook.run_hook({"hook_event_name": "PreToolUse", "source": "startup"})

        self.assertEqual(output.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
