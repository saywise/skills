---
name: saywise-chat-stats
description: Use this on chat surfaces (Claude Desktop, claude.ai, mobile) when the user asks to measure their Claude chat usage. Counts conversations via the built-in recent-chats tool — aggregate numbers only (sessions, active days, date range) — and shows them to the user. Measurement only — nothing is uploaded anywhere. In Claude Code or Cowork, use the saywise-usage skill instead.
---

# Measuring Claude chat usage

The chat-surface counterpart of `saywise-usage`. That skill scans local Claude Code
and Codex CLI session logs with a bundled script; chat surfaces have no local logs and
no filesystem, but they do have the built-in conversation-history tools. This skill
uses those instead.

## When to trigger

Same asks as `saywise-usage` — "measure my Claude usage", "how much do I use Claude?" —
but on a surface where the **recent chats** tool is available and the `saywise-usage`
scan script is not runnable.

- If you can run shell commands (Claude Code, Cowork), use `saywise-usage` — it measures
  far more (tokens, tool calls, streaks, projects, Codex CLI) and can submit to Saywise.
- If the recent-chats tool is not available either, say chat usage can't be measured
  here. Never estimate.
- Never trigger spontaneously; only on an explicit ask.

## Measurement only

This skill **counts and displays** — it uploads nothing. Saywise's usage-submission
schema requires fields chat history cannot measure (tokens, tool calls, active hours),
so no honest payload can be built here — never submit zeros or estimates in their
place, even if a Saywise MCP server happens to be connected on this surface. If the
user asks to put numbers on their Saywise profile, point them at running
`/saywise-usage` in Claude Code (which measures the full payload and can submit it) or
quoting these numbers in a post themselves.

## The privacy contract (non-negotiable)

The recent-chats tool returns conversation **titles and snippets**. You may look at them
only as far as the tool forces you to — never list, summarize, or comment on them. The
only things you may extract are **timestamps and counts**, and nothing is transmitted
anywhere.

## Step 1 — count the conversations

Walk the recent-chats tool from newest to oldest with its pagination cursor (20 chats
per call), keeping a running tally as you go:

- **sessions** — total chats seen (count each chat exactly once; dedupe by id/URI).
- **days** — the set of distinct UTC dates (YYYY-MM-DD) of the chats' timestamps (use
  each chat's updated time if both created and updated are present).
- **first / last activity** — oldest and newest timestamp seen.

Stop after **25 pages (500 chats)** or when the history is exhausted, whichever comes
first. If you stopped at the cap, the stats cover "your most recent 500 chats" — say so
in the summary, and never extrapolate past what you actually counted. Tally page by page
and sum at the end; do not re-derive totals from memory.

Do NOT use the keyword-search tool for counting — it returns matches, not history, and
undercounts silently.

## Step 2 — show the results

Present a short summary — sessions, active days, date range, and whether it covers the
full history or the most recent 500 chats. Then stop. Tokens, tool calls, hours, and
streaks are not measurable from chat history — omit them; never fabricate.

## Common pitfalls

- **Don't estimate.** Only chats actually returned by the tool count. No "probably
  around a thousand".
- **Don't submit anywhere.** The submit schema requires token, tool-call, and hours
  fields this surface can't measure — a payload padded with zeros is fabricated. Do
  not call any tool with these numbers.
- **Don't leak titles or snippets** — not in the summary, not in conversation.
- **Don't run this in Claude Code/Cowork** — `saywise-usage` exists there and measures
  more, honestly.
