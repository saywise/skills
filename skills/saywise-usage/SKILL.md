---
name: saywise-usage
description: Use this when the user asks to measure or verify their AI-tool usage stats. Computes aggregate-only stats (sessions, tokens split by input/output/cache, tool calls incl. subagent/MCP/skill/plan-mode/web counters, active hours, daily activity, streaks, models) from local Claude Code and Codex CLI session logs, shows them, and — only on explicit confirmation — submits the per-source payloads via the Saywise MCP server's saywise_submit_usage_stats tool. On chat-only surfaces such as ChatGPT Chat/Work, Claude Desktop, or claude.ai, use saywise-chat-stats instead.
---

# Measuring AI usage stats

## When to trigger

Trigger when the user explicitly asks to measure their AI usage. Examples:

- "Measure my Claude Code usage"
- "What are my AI usage stats?"
- "Verify my AI Stack numbers"
- `$saywise-usage` in Codex, `@saywise-usage` in ChatGPT, or `/saywise-usage`
  in Claude (explicit invocation)

Do NOT trigger spontaneously, without the user asking.

## The privacy contract (non-negotiable)

Measurement stays on the user's machine. The scan reads **aggregate signals only** —
from both log formats: timestamps, message and event types, model ids, token-usage
counters, and tool-call names — never prompts, conversation content, tool arguments
(the one exception: the `run_in_background` boolean on subagent launches, read to
count background runs), project names, cwd, or file paths. Do not read into the logs
beyond what the script extracts. The only thing that may ever leave the machine is the script's JSON output,
and only in Step 3, on the user's explicit confirmation.

## What's measurable where

- **Claude Code (CLI, IDE extensions, and the Desktop app's Code tab)** — full stats. All of them write session transcripts to `~/.claude/projects/**/*.jsonl`.
- **Cowork** — not verified. Where Cowork tasks store transcripts is undocumented; any that do land in `~/.claude/projects` are counted automatically, but don't tell the user Cowork usage is included.
- **Codex CLI** — sessions, hours, streaks, daily activity, tokens (cached input is split out so the four token fields sum exactly), and shell / edit / web-search tool calls from `~/.codex/sessions/**/*.jsonl`. Its logs carry no project count, per-model token attribution, cache-write tokens, or Claude-harness counters (subagents, MCP, skills, plan mode) — those report 0 or are omitted, honestly.
- **Cursor, other tools** — not yet. This skill has no parser for their logs; do not improvise one.
- **ChatGPT Chat/Work, Claude Desktop, claude.ai, and mobile chat** — partially, via
  the sibling `saywise-chat-stats` skill: cloud chats have no local transcripts, so
  that skill counts them with the surface's conversation-history tools instead. If
  this script can't run, hand off to `saywise-chat-stats`; never estimate from memory.

A missing source is not an error: if only one of the two log roots exists, the script
reports that source alone — present what it found without apology.

## Step 1 — compute the stats

Run the script bundled with this skill. Plugin installs expose `PLUGIN_ROOT` in Codex
and `CLAUDE_PLUGIN_ROOT` in Claude Code:

```bash
node "${PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT}}/skills/saywise-usage/scripts/usage-scan.cjs"
```

(For standalone skill installs, run `node scripts/usage-scan.cjs` from this skill's
directory.) Do not modify it and do not improvise your own parser — deterministic
numbers are the point. It reads only timestamps, message/event types, model ids,
per-response token counters, and tool names from the two log roots (including Claude
Code's per-session subagent transcripts); never message content, and from tool inputs
only the single `run_in_background` boolean on subagent launches (to count background
runs) — nothing else.

The script prints `{"payloads": [...]}` — one payload per source with data, each
shaped exactly as the Saywise submit tool expects (`source`, `scannerVersion`,
sessions, active days/hours, streaks, the daily-activity series, token split,
tool-call counters). If it errors ("No completed sessions found"), tell the user and
stop — do not fabricate stats or estimate from memory.

## Step 2 — show the results

Present a short per-source summary table — sessions, tokens (input / output / cache
read / cache write), tool calls (with the interesting sub-counters: file edits,
commands, subagent runs, MCP calls, skills, plan mode, web), active days and hours,
current and longest streak, first activity, models — and include the payload JSON
verbatim for anyone who wants the exact numbers. Note the hours are *active* time
(activity windows merged across sessions, split at 30-minute gaps), not wall-clock
session spans.

## Step 3 — offer to submit (opt-in, explicit)

After showing the stats, offer once: "Want me to submit these stats to your Saywise
profile?" Submit **only** if the user explicitly says yes this run — a previous yes
does not carry over, and never submit unprompted.

To submit, call the Saywise MCP server's **`saywise_submit_usage_stats`** tool once
per payload the user approved, passing that payload object **exactly as the script
printed it** — never edited, rounded, merged, or extended (the server verifies
cross-field invariants and rejects altered payloads). Re-submitting for the same
source updates the stored stats, so repeat runs are safe. Echo the server's
confirmation back to the user.

- If the Saywise MCP server is not connected or not authenticated, tell the user to
  open the Saywise plugin's connection settings (or run `/mcp` in hosts that support
  it) and complete the browser sign-in — then offer again.
- The server also exposes `saywise_get_usage_stats_instructions`, which returns its
  own Claude-Code-only scanner. If `saywise_submit_usage_stats` rejects this skill's
  payload (schema drift), fall back to following those instructions for the
  `claude_code` source, tell the user Codex can't be submitted until the plugin
  updates, and never patch a payload by hand to force it through.
- If the user declines or says nothing, stop after the stats. Declining is a
  complete, valid outcome.

## Common pitfalls

- **Don't improvise the parser.** Run the script as given — hand-rolled one-liners produce inconsistent numbers between runs (token counting in particular needs the script's per-response dedupe).
- **Don't submit without an explicit yes in this conversation.** No standing consent, no "they said yes last week", no submitting because the MCP server happens to be connected.
- **Don't send anything but the script's payloads, verbatim.** Not a summary, not an enriched version, never merged across sources, and never any other data from the session. The server's invariant checks treat an edited payload as fabricated and reject it.
- **Don't retry a failed submission through a non-MCP channel.** The Saywise MCP server is the only sanctioned path; if it fails, report the error and stop.
- **Don't inflate.** If the numbers look small, they're small. Never adjust them to look better.
- **Don't explain away the token split.** `totalTokens` is exactly input + output + cache read + cache write. All four are true — present them as-is.
- **Don't scan other tools' logs (Cursor, Gemini CLI, …) with ad-hoc parsers.** Claude Code and Codex CLI only for now; say so if asked.
- **Don't treat a missing source dir as an error** when the other source produced stats.
