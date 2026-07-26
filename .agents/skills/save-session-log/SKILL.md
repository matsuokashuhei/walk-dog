---
name: save-session-log
description: Use at the beginning of every new conversation in this repository, or when a user asks to save an AI development session or its transcript.
---

# Save Session Log

Capture an opted-in development conversation as a readable project artifact.

## Start the session

In the first assistant response of every new conversation, ask only these two questions in one concise message:

1. What is the purpose of this conversation?
2. Should this session be saved?

When the user chooses saving, derive a short lowercase hyphenated English title from the stated purpose. Use the current local timestamp and create:

`docs/logs/YYYYmmddHHMMSS-<title>/transcript.md`

Use `apply_patch` to create the file. Start it with the purpose and creation timestamp, then record the conversation from the first user message onward. Preserve user messages and visible assistant responses in chronological order under `## Transcript`.

## Continue the session

After every visible user or assistant message, append that message to `transcript.md` before ending the turn. Keep one directory and one transcript for the whole conversation. Do not ask about saving again after the user has chosen.

When the user chooses not to save, continue the conversation without creating a log directory.
