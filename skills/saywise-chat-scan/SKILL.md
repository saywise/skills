---
name: saywise-chat-scan
description: Scans the user's recent chat conversations for story-worthy AI work and writes Saywise-ready story drafts for the ones they pick. Use on chat surfaces that have a conversation-history tool but no shell (Claude Desktop, claude.ai, or any chat assistant that keeps history); where shell commands run (Claude Code, Codex CLI, Cowork), use saywise-scan instead.
---

# Scanning recent chats for Saywise stories

The chat-surface counterpart of `saywise-scan`. That skill sweeps local coding-agent
transcripts (Claude Code, Codex CLI); chat surfaces have no local logs, so this one
reviews the user's recent conversations with whatever chat-history tool the surface
provides and writes story drafts from the ones the user selects.

## When to trigger

Only on an explicit ask: "scan my recent chats for Saywise stories", "anything in my
chat history worth posting?". Never spontaneously. If you can run shell commands
(Claude Code, Codex CLI, Cowork), use `saywise-scan` instead — local transcripts beat
chat recall. If this surface has no chat-history tool, say chats can't be scanned here
and stop.

## What counts as story-worthy

Concrete AI-assisted work with an outcome: something built, shipped, debugged, migrated,
automated, analyzed, or genuinely learned. Skip small Q&A, casual chats, and — as a hard
rule — anything sensitive: health, legal, financial, relationships, job applications,
conflicts. A sensitive chat is excluded even if the work in it is impressive; don't
mention it in the shortlist at all.

## Step 1 — enumerate candidates

Ask (or infer from the request) the window to scan — default the last 30 days.

Walk the chat-history tool **page by page** — one call returns one page of recent
chats, never the whole history:

1. Call it newest-first and note the oldest timestamp on the page.
2. While that timestamp is still inside the window, call again with the tool's
   pagination cursor (before the oldest chat seen) and repeat.
3. Stop when a page crosses the window boundary, the history runs out, or you've read
   roughly **300 chats** — whichever comes first. If you hit the cap, tell the user
   the scan covered their most recent ~300 chats, not the full window.

Screen each page's titles/snippets against the bar above as you go, keeping one running
shortlist across pages (dedupe by chat id — a chat can appear on two pages). Never
build the shortlist from the first call alone.

If the user names a topic ("that deploy pipeline work") and the surface has a
chat-search tool, use it to find that conversation; don't use search for general
enumeration — it returns keyword matches, not history.

## Step 2 — propose, let the user pick

Show a shortlist — title, date, one line on why it qualifies — and ask which to turn
into drafts. "None" is a valid answer: report it and stop. Zero drafts is a successful
scan, not a failure.

## Step 3 — draft the selected ones

First get the best material the surface allows: if there is a tool that opens a full
conversation, fetch the full text before drafting — search snippets alone are a
reconstruction, not the chat. Then compose in the user's voice under the `unslop`
skill's style contract — load it before composing; if it isn't installed, ask the user
to add it rather than approximating it from memory. Ground every claim ONLY in what
the history tools actually returned. Snippets are partial recall — keep claims modest,
never invent outcomes, numbers, or technical details the snippets don't show, and tell
the user the material is partial before anything goes to Saywise (that applies to both
delivery lanes below). If there isn't enough context for an honest draft, say so and
suggest the user re-run the scan from inside that conversation instead.

Write 1–2 drafts per selected conversation, following the `saywise-stories` skill's
formats: a short plain-prose post by default, an article only when the journey merits
it, a stat only when the chat contains a real number.

## Step 4 — deliver

Present each draft under a clear label so the user can read it as-is.

- **If the Saywise MCP tools are available on this surface** (a connected Saywise
  server exposing `saywise_create_suggested_drafts`), follow the `saywise-stories`
  delivery contract: create the drafts in `drafts` mode in the same turn — `sourceTool`
  = the product name of this chat surface, one call per conversation, each draft
  carrying its `format` discriminator. They land **private** as Suggested Drafts;
  nothing publishes until the user accepts each one on their profile. Echo the
  returned review link. An explicit "don't submit" from the user stops submission —
  then the drafts stay in chat.
- **`content` mode — only on an explicit ask.** The same tool also accepts raw
  material (`content`) for Saywise to generate the drafts server-side. Use it only
  when the user explicitly asks Saywise to do the writing ("send it over, let Saywise
  generate the drafts") — never as a fallback because composing feels hard. And say
  which lane you're on: in content mode nothing is composed in chat, so tell the user
  their first look at the drafts will be the Suggested Drafts on their profile, and
  that what you're sending is your recall of the conversation — partial if it came
  from snippets.
- **Otherwise**, say the drafts can't reach their profile from this surface — the
  Saywise MCP connection is the only path (the old composer is deprecated) — and
  leave them the drafts in chat.

## Repeat scans

Chat surfaces keep no local scan state. Scope by time window ("since your last scan —
when was that?"), and when unsure whether a chat was already drafted, ask the user.

## Common pitfalls

- **Don't draft unpicked chats.** The shortlist-then-pick step is the consent gate.
- **Don't switch lanes silently.** `drafts` mode is the default; `content` mode runs
  only on the user's explicit ask, and when it does, say so — with nothing composed in
  chat, the profile is the user's first look at the drafts.
- **Don't pad thin recall into a rich story.** Modest and true beats detailed and
  invented.
- **Don't mention sensitive chats**, even as "excluded" entries in the shortlist.
- **Don't dump raw chat content into drafts** — the draft is composed, not pasted.
- **Don't submit through anything but the Saywise MCP tools**, and respect an
  explicit "don't submit". No tools connected means the drafts stay in chat — the old
  composer (saywise.com/posts/new) is deprecated; never link it.
