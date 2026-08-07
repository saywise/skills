---
name: saywise-chat-scan
description: Scans recent Claude chats for story-worthy AI work and writes Saywise-ready story drafts for the ones the user picks. Use on Claude Desktop/claude.ai when asked to scan chats; in Claude Code use saywise-scan.
---

# Scanning Claude chats for Saywise stories

The chat-surface counterpart of `saywise-scan`. That skill sweeps local Claude Code
transcripts; chat surfaces have no local logs, so this one reviews the user's recent
conversations with the built-in chat-history tools and writes story drafts from the
ones the user selects — presented in chat for the user to post on their Saywise
profile themselves.

## When to trigger

Only on an explicit ask: "scan my recent chats for Saywise stories", "anything in my
Claude history worth posting?". Never spontaneously. If you can run shell commands
(Claude Code, Cowork), use `saywise-scan` instead — local transcripts beat chat recall.
If the recent-chats tool is unavailable, say chats can't be scanned here and stop.

## What counts as story-worthy

Concrete AI-assisted work with an outcome: something built, shipped, debugged, migrated,
automated, analyzed, or genuinely learned. Skip small Q&A, casual chats, and — as a hard
rule — anything sensitive: health, legal, financial, relationships, job applications,
conflicts. A sensitive chat is excluded even if the work in it is impressive; don't
mention it in the shortlist at all.

## Step 1 — enumerate candidates

Ask (or infer from the request) the window to scan — default the last 30 days.

Walk the recent-chats tool **page by page** — one call returns only ~20 chats, never
the whole history:

1. Call it newest-first and note the oldest timestamp on the page.
2. While that timestamp is still inside the window, call again with the pagination
   cursor (before the oldest chat seen) and repeat.
3. Stop when a page crosses the window boundary, the history runs out, or you've read
   **15 pages (~300 chats)** — whichever comes first. If you hit the cap, tell the
   user the scan covered their most recent ~300 chats, not the full window.

Screen each page's titles/snippets against the bar above as you go, keeping one running
shortlist across pages (dedupe by chat id — a chat can appear on two pages). Never
build the shortlist from the first call alone.

If the user names a topic ("that deploy pipeline work"), use the chat-search tool to
find it; don't use search for general enumeration — it returns keyword matches, not
history.

## Step 2 — propose, let the user pick

Show a shortlist — title, date, one line on why it qualifies — and ask which to turn
into drafts. "None" is a valid answer: report it and stop. Zero drafts is a successful
scan, not a failure.

## Step 3 — draft the selected ones

For each selected conversation, compose in the user's voice under the `unslop` skill's
style contract (load it if installed), grounded ONLY in what the history tools actually
returned. Snippets are partial recall — keep claims modest, and never invent outcomes,
numbers, or technical details the snippets don't show. If there isn't enough context for
an honest draft, say so and suggest the user re-run the scan from inside that
conversation instead.

Write 1–2 drafts per selected conversation, following the `saywise-stories` skill's
formats: a short plain-prose post by default, an article only when the journey merits
it, a stat only when the chat contains a real number.

## Step 4 — hand back

Present each draft under a clear label so the user can copy it, and point them at the
Saywise composer (https://saywise.com/posts/new) to post. You post nothing yourself.

## Repeat scans

Chat surfaces keep no local scan state. Scope by time window ("since your last scan —
when was that?"), and when unsure whether a chat was already drafted, ask the user.

## Common pitfalls

- **Don't draft unpicked chats.** The shortlist-then-pick step is the consent gate.
- **Don't pad thin recall into a rich story.** Modest and true beats detailed and
  invented.
- **Don't surface sensitive chats**, even as "excluded" mentions.
- **Don't dump raw chat content into drafts** — the draft is composed, not pasted.
