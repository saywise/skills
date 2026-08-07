---
description: Scan recent Claude Code conversations and draft Saywise stories from any that are worth it.
---

Load the `saywise-scan` skill, then follow it exactly: read the scan state file, enumerate sessions that are new since the last run, triage them locally against the saywise-stories bar, and for the strongest (at most 3) compose 1–2 drafts each — presented in chat when interactive, written to `~/.claude/saywise/drafts/` when unattended.

If there is a new conversation worth turning into a Saywise story, draft it; if nothing clears the bar, draft nothing. Either way, update the state file and report what happened. Interactive runs may submit approved drafts as private Suggested Drafts via the saywise MCP server — only on the user's explicit yes; unattended runs never call MCP tools and only write files.
