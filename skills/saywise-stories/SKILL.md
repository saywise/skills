---
name: saywise-stories
description: Use this when the user asks to write up, post, or share their AI work as a Saywise story. Composes 1–2 ready-to-post story drafts from the current session — in the user's voice, under the unslop style contract — and presents them for the user to review and post on their Saywise profile.
---

# Turning an AI Work session into Saywise story drafts

## When to trigger

Trigger when the user explicitly asks to write up, post, or share their work. Examples:

- "Write this up for my Saywise"
- "Turn this session into an AI work story"
- "Draft a post about what we just built"
- "/saywise-draft" (the explicit slash command)

Do NOT trigger:

- Spontaneously, without the user asking.
- In the middle of an active task — wait until the work has a discrete outcome.
- For tiny trivia (a one-line edit, a typo fix). The user should have done _something worth sharing_.

## What to compose

Produce 1–2 drafts (never more) in the formats that fit the work, each clearly labeled
and ready to copy. Pick distinct formats — don't write the same content twice.

### `post` — short, conversational

A paragraph or two of plain prose, ≤200 words. Good for: a quick win, a small shipped
feature, a lesson learned. Title optional; the body should stand on its own.

### `article` — long-form with a title

The goal, the approach, the obstacles, the outcome — 200–400 words of Markdown
(headings, lists, fenced code blocks, links; no embedded images — Saywise's editor
handles image uploads when the user posts). Good for: a multi-step build, a non-trivial
debug, a real architectural decision. For a full long-form pass — story structure,
image placement — use the dedicated `saywise-article` skill instead.

### `stat` — a single hero number

Use _sparingly_, only when a real number came up in the session — _"42% faster cold
start"_, _"$50k/yr saved in S3 egress"_. Give the number (with units), what it measures,
and one line of context. If you're tempted to invent or estimate a number — don't. Skip
the stat.

## How to write the content

- **Write under the `unslop` contract.** Load the `unslop` skill (same plugin/repo) before composing and run its final pass on every draft — it bans the AI vocabulary and structural tells that make a post read machine-written. Tone target: a Slack post for an engineering team — specific, plain, slightly understated.
- **Use the user's voice.** First person ("I did X", "I shipped Y"), not third person ("Claude helped the user…"). Saywise is the user's profile; they're the author.
- **Focus on what _the user_ did with AI**, not what AI produced for them. The interesting story is the user's judgment, iteration, and outcome — not the model's output.
- **Never paste raw chat.** A transcript dump is not a story. Distill what happened into prose.
- **Ground every claim in the session.** If a fact wasn't established in the conversation, don't invent it.

## Deliver

Present each draft under a clear label ("Post" / "Article" / "Stat") so the user can
copy it as-is, then point them at their Saywise profile to post it — the composer lives
at https://saywise.com/posts/new. Offer one round of edits if they want changes. Nothing
is posted anywhere by you; the user publishes it themselves.

## Common pitfalls

- **Don't ask the user "what should the title be?"** — pick one from the session context. They can change it when posting.
- **Don't generate more than 2 drafts.** One strong draft beats three mediocre ones.
- **Don't use stat without a real digit.** Invented stats are the fastest way to lose the user's trust.
- **Don't post or upload anything.** Compose, present, stop — publishing is the user's move.
