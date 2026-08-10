---
description: Measure local Claude Code and Codex CLI usage, show the aggregate stats, and offer to submit them to Saywise.
---

Load the `saywise-usage` skill, then follow it exactly: run its bundled scan script, show the per-source summary and the payload JSON, then offer to submit the payloads to the user's Saywise profile via the Saywise MCP server's `saywise_submit_usage_stats` tool — only on their explicit yes, each payload verbatim.

Aggregate numbers only — never prompts, project names, file paths, or conversation content. Nothing is transmitted except the script's payloads, and only after the user confirms.
