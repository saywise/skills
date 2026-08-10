---
name: saywise-scan
description: Use this when the user asks to scan their recent coding-agent conversations (Claude Code, Codex CLI) for work worth posting to Saywise — the initial run after installing the plugin, or a recurring "/saywise-scan" pass (manual or scheduled). Finds recent story-worthy sessions and composes drafts per the saywise-stories skill — presented in chat when interactive, written to ~/.claude/saywise/drafts/ when unattended. On a chat surface with no shell, use saywise-chat-scan instead.
---

# Scanning recent conversations for Saywise stories

## When to trigger

Trigger when the user asks to sweep their recent AI work rather than write up the current session. Examples:

- "Scan my recent Claude/Codex sessions for anything worth posting"
- "Turn this week's work into Saywise drafts"
- "/saywise-scan" (the explicit slash command — also the periodic entry point)

The standing instruction this skill implements: **"if there is a new conversation worth turning into a Saywise story, draft it."** Drafts stay local — in chat or as files — until the user says yes to submitting them (interactive runs only) or posts them on Saywise themselves.

Do NOT trigger spontaneously. For writing up the _current_ session, use the `saywise-stories` skill instead.

## State — what "new" means

Keep a high-water mark at `~/.claude/saywise/scan-state.json`:

```json
{ "lastScanAt": "2026-07-31T00:00:00.000Z", "draftedSessions": ["<project-dir>/<session-file>", "…"] }
```

A session's key is the last two segments of its transcript path — `<project-dir>/<session-file>` for Claude Code, `<DD>/<rollout-file>` for Codex CLI — matching what the SessionEnd hook queues.

- **No state file** → this is the initial run: consider sessions from the last 14 days.
- **State file exists** → consider only sessions modified after `lastScanAt` and not in `draftedSessions`.
- After a run (even one that drafts nothing), write the file back: `lastScanAt` = now, `draftedSessions` = previous list plus the sessions drafted this run, trimmed to the most recent 200 entries.

## Step 1 — enumerate candidates

**Check the hook queue first.** The plugin's SessionEnd hook pre-screens every ended conversation and queues the story-worthy ones at `~/.claude/saywise/scan-queue.json` (`{ "sessions": [{ "key", "file", "host", "queuedAt" }], "lastAutoScanAt"? }`). If it exists and has sessions, those files ARE the candidate list — skip the filesystem walk. The triage cap below applies here too: if more than 8 are queued, take the 8 newest this run and leave the rest queued — Step 4 drains only what was triaged, so they come up next run.

Otherwise (no queue file, or empty), walk by hand across every host whose logs exist:

- Claude Code: `~/.claude/projects/<project-dir>/<session-id>.jsonl` (one file per session; the dir name encodes the project path).
- Codex CLI: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (one rollout file per session).

List candidate files by modification time against the window above, e.g.:

```bash
find ~/.claude/projects ~/.codex/sessions -name '*.jsonl' -newermt '<window start>' 2>/dev/null | xargs ls -lt | head -30
```

Skip files under ~20 KB — too small to hold a story. Rank the rest largest/newest first and take at most the top 8 for triage.

## Step 2 — triage locally

For each candidate, skim the transcript locally (first user messages + the final assistant summaries are usually enough — the two hosts' JSONL formats differ, so read for content, not a fixed schema) and judge it by the `saywise-stories` bar:

- **Story-worthy**: a discrete outcome — something shipped, fixed, migrated, measured, or learned. A multi-step build, a real debug, an architectural decision.
- **Not story-worthy**: Q&A chatter, tiny edits, aborted work, anything the user would not show a colleague. When unsure, skip — a scan that drafts nothing is a fine outcome.
- Skip any session the user marked private or that is mostly about credentials, personal matters, or another person.

Cap the run at the **3 strongest conversations**. Everything stays local — this skill uploads nothing, at any step.

## Step 3 — compose and deliver

For each selected conversation, follow the `saywise-stories` skill exactly — formats (post / article / stat), the user's voice, ground every claim in that transcript — and write every draft under the `unslop` skill's style contract (load both). 1–2 drafts per conversation.

Delivery depends on how you're running:

- **Interactive session**: present each conversation's drafts under clear labels for the user to review, then follow the `saywise-stories` delivery contract — on the user's explicit yes, submit via the saywise MCP server's `saywise_create_suggested_drafts` tool, one call per conversation with that conversation's drafts, `sourceTool` from the transcript's host ("Claude Code" or "Codex"). The manual composer (https://saywise.com/posts/new) remains the fallback.
- **Unattended run** (scheduled `claude -p "/saywise-scan"` — no user to hand drafts to): write each draft to `~/.claude/saywise/drafts/<YYYY-MM-DD>-<short-slug>.md` (create the directory if needed), with a one-line header naming the source session and format. Never call MCP tools in an unattended run — with no user present there is no consent, so drafts go to files only. Never compose anything you wouldn't show the user first anyway.

## Step 4 — report and update state

Interactive: one line per drafted conversation. Unattended: one line per written file path. If nothing cleared the bar, say so. Either way, write the state file (Step "State" above).

Also drain the queue: rewrite `scan-queue.json` with the triaged sessions removed (drafted AND rejected — a rejected session shouldn't be re-offered next start), **preserving any other fields in the file** (`lastAutoScanAt` belongs to the hook's debounce).

## After a successful interactive run — offer automation once

If this run drafted something, the session is interactive, and `~/.claude/saywise/config.json` doesn't already have an `autoScan` key, offer ONE upgrade, plainly:

> "Want this to run by itself? I can turn on auto-scan: when you close a session while story-worthy work is queued, a background scan drafts it into `~/.claude/saywise/drafts/` automatically (at most once every 6 hours). It uses your Claude Code quota, nothing leaves your machine, and you post drafts yourself. Say the word to enable."

If yes, write `{ "autoScan": true }` to `~/.claude/saywise/config.json` (merge if the file exists). If no, write `{ "autoScan": false }` so the offer never repeats. To disable later: set it back to `false` — the queueing and nudges keep working either way.

## Running this periodically

On Claude Code (bundled with the plugin) and Codex CLI (wired per the README) the hooks already handle cadence: SessionEnd queues story-worthy conversations, SessionStart surfaces the count, and the opt-in auto-scan (above) drafts unattended. Elsewhere, any scheduler that can run the CLI works — for example a weekly cron entry:

```cron
0 18 * * 5 SAYWISE_SCAN_RUN=1 claude -p "/saywise-scan"
```

(or `SAYWISE_SCAN_RUN=1 codex exec "Use the saywise-scan skill: scan recent conversations and draft Saywise stories."` from Codex.)

The state file makes runs idempotent: an already-drafted session is never drafted twice. Unattended runs always carry `SAYWISE_SCAN_RUN=1` in their environment (the auto-scan spawn sets it; cron entries set it as above) so the hooks stand down for the scan's own session.

## Common pitfalls

- **Don't lower the bar to fill a quota.** Zero drafts is a valid result; the periodic run's job is filtering, not producing.
- **Don't paste transcript content into drafts.** Distill, in the user's voice — same rule as `saywise-stories`.
- **Don't post or upload anything.** Drafts go to the user (chat or local files); publishing is theirs.
- **Don't scan unsupported logs** — Claude Code and Codex CLI transcripts only, for now (no Cursor; Gemini CLI's session store rotates at 30 days and is not yet supported).
- **Don't forget the state file**, or the next periodic run re-drafts the same sessions.
