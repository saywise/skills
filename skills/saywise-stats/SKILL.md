---
name: saywise-stats
description: Use this when the user asks to measure or verify their AI-tool usage stats. Computes aggregate-only stats (sessions, tokens, tool calls, weekly activity, active days, longest streak, project count, hours, models, date range) from local Claude Code session logs and shows them to the user. Measurement only — nothing is uploaded anywhere.
---

# Measuring AI usage stats

## When to trigger

Trigger when the user explicitly asks to measure their AI usage. Examples:

- "Measure my Claude Code usage"
- "What are my AI usage stats?"
- "Verify my AI Stack numbers"
- "/saywise-stats" (the explicit slash command)

Do NOT trigger spontaneously, without the user asking.

## Measurement only

This skill **computes and displays** stats. It does not upload them anywhere — there is
no submission integration yet, and no other destination is acceptable. If the user asks
to put the numbers on their Saywise profile, say that integration is coming and leave it
there; they can quote the numbers in a post themselves meanwhile.

## The privacy contract (non-negotiable)

Everything stays on the user's machine. The scan reads **aggregate signals only**:
timestamps, message types, model ids, token-usage counters, and tool-use block names —
never prompts, conversation content, project names, file paths, or tool inputs. Do not
read into the logs beyond what the script extracts, and do not transmit any of it.

## What's measurable where

- **Claude Code (CLI, IDE) and Cowork** — full stats. Both run the Claude Code harness, so their sessions land in `~/.claude/projects/**/*.jsonl` and the scan below measures everything, including Cowork sessions.
- **Codex, Cursor, other tools** — not yet. This skill has no parser for their logs; do not improvise one.
- **Claude Desktop / claude.ai chat** — partially, via the sibling `saywise-chat-stats` skill: chat conversations are cloud-stored with no local transcripts, so that skill counts them with the built-in recent-chats tool instead — sessions, active days, and date range only. If the user asks from a chat surface where this skill's script can't run, hand off to `saywise-chat-stats`; never estimate usage from memory.

## Step 1 — compute the stats

Run the script bundled with this skill — in Claude Code:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/usage-scan.cjs"
```

(In other hosts, `scripts/usage-scan.cjs` sits next to this SKILL.md in the installed skill directory — run it from there.) Do not modify it and do not improvise your own parser — deterministic output is the point. It reads only timestamps, message types, model ids, per-message token-usage counters, and tool-use block names from `~/.claude/projects/**/*.jsonl`; never message content or tool inputs.

The script prints the aggregates as JSON. If it errors ("No Claude Code logs found"), tell the user and stop — do not fabricate stats or estimate from memory.

## Step 2 — show the results

Present a short summary table — sessions, tokens, tool calls, active days, longest streak, projects, hours, first activity, models (summarize the weekly series as "N weeks of activity") — and include the JSON for anyone who wants the exact numbers. Then stop.

## Common pitfalls

- **Don't improvise the parser.** Run the script as given — hand-rolled one-liners produce inconsistent numbers between runs (token counting in particular needs the script's per-response dedupe).
- **Don't submit anywhere.** There is no usage endpoint; do not call any tool with these numbers.
- **Don't inflate.** If the numbers look small, they're small. Never adjust them to look better.
- **Don't explain away the token split.** `totalTokens` counts everything processed (input + output + cache); `outputTokens` is what the model wrote. Both are true — present them as-is.
- **Don't scan other tools' logs (Codex, Cursor) with ad-hoc parsers.** This skill supports Claude Code only for now; say so if asked.
