---
name: saywise-usage
description: Use this when the user asks to measure or verify their AI-tool usage stats. Computes aggregate-only stats (sessions, tokens split by input/output/cache, tool calls, weekly activity, active days, longest streak, hours, models) from local Claude Code and Codex CLI session logs, shows them, and — only on explicit confirmation — offers to submit the aggregate JSON to the user's Saywise profile via the saywise MCP server. On chat surfaces (Claude Desktop / claude.ai) use saywise-chat-stats instead.
---

# Measuring AI usage stats

## When to trigger

Trigger when the user explicitly asks to measure their AI usage. Examples:

- "Measure my Claude Code usage"
- "What are my AI usage stats?"
- "Verify my AI Stack numbers"
- "/saywise-usage" (the explicit slash command)

Do NOT trigger spontaneously, without the user asking.

## The privacy contract (non-negotiable)

Measurement stays on the user's machine. The scan reads **aggregate signals only** —
from both log formats: timestamps, message and event types, model ids, token-usage
counters, and tool-call names — never prompts, conversation content, tool arguments,
project names, cwd, or file paths. Do not read into the logs beyond what the script
extracts. The only thing that may ever leave the machine is the script's JSON output,
and only in Step 3, on the user's explicit confirmation.

## What's measurable where

- **Claude Code (CLI, IDE) and Cowork** — full stats. Both run the Claude Code harness, so their sessions land in `~/.claude/projects/**/*.jsonl`.
- **Codex CLI** — full stats minus project count and cache-write tokens (its logs in `~/.codex/sessions/**/*.jsonl` carry neither; its `input_tokens` already includes the cached subset).
- **Cursor, other tools** — not yet. This skill has no parser for their logs; do not improvise one.
- **Claude Desktop / claude.ai chat** — partially, via the sibling `saywise-chat-stats` skill: chat conversations are cloud-stored with no local transcripts, so that skill counts them with the built-in recent-chats tool instead. If the user asks from a chat surface where this skill's script can't run, hand off to `saywise-chat-stats`; never estimate usage from memory.

A missing source is not an error: if only one of the two log roots exists, the script
reports that source alone — present what it found without apology.

## Step 1 — compute the stats

Run the script bundled with this skill — in Claude Code:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/usage-scan.cjs"
```

(In other hosts, `scripts/usage-scan.cjs` sits next to this SKILL.md in the installed skill directory — run it from there.) Do not modify it and do not improvise your own parser — deterministic output is the point. It reads only timestamps, message/event types, model ids, per-response token counters, and tool-call names from the two log roots; never message content or tool inputs.

The script prints the aggregates as JSON: one entry per source plus a combined
`totals` block. If it errors ("No … logs found"), tell the user and stop — do not
fabricate stats or estimate from memory.

## Step 2 — show the results

Present a short per-source summary table — sessions, tokens (input / output / cache
read / cache write), tool calls, active days, longest streak, hours, first activity,
models (summarize the weekly series as "N weeks of activity") — plus the combined
totals, and include the JSON for anyone who wants the exact numbers.

## Step 3 — offer to submit (opt-in, explicit)

After showing the stats, offer once: "Want me to submit these aggregate stats to your
Saywise profile?" Submit **only** if the user explicitly says yes this run — a
previous yes does not carry over, and never submit unprompted.

To submit, use the **saywise MCP server's usage-submission tool** (its tools mention
usage or stats submission — list the server's tools to find it) and pass it **exactly
the script's JSON output, nothing else** — no transcript excerpts, no commentary, no
extra fields.

- If the saywise MCP server is not connected or not authenticated, tell the user to
  run `/mcp` and complete the browser sign-in, then offer again.
- If the server has no tool for submitting usage, say so honestly and stop — do not
  approximate with any other tool, HTTP call, or endpoint.
- If the user declines or says nothing, stop after the stats. Declining is a
  complete, valid outcome.

## Common pitfalls

- **Don't improvise the parser.** Run the script as given — hand-rolled one-liners produce inconsistent numbers between runs (token counting in particular needs the script's per-response dedupe).
- **Don't submit without an explicit yes in this conversation.** No standing consent, no "they said yes last week", no submitting because the MCP server happens to be connected.
- **Don't send anything but the script's JSON.** Not a summary of it, not an enriched version of it, and never any other data from the session.
- **Don't retry a failed submission through a non-MCP channel.** The saywise MCP server is the only sanctioned path; if it fails, report the error and stop.
- **Don't inflate.** If the numbers look small, they're small. Never adjust them to look better.
- **Don't explain away the token split.** `totalTokens` counts everything processed; input / output / cache read / cache write are its parts (for Codex, `inputTokens` already contains the cached subset). All are true — present them as-is.
- **Don't scan other tools' logs (Cursor, Gemini CLI, …) with ad-hoc parsers.** Claude Code and Codex CLI only for now; say so if asked.
- **Don't treat a missing source dir as an error** when the other source produced stats.
