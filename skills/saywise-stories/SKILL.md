---
name: saywise-stories
description: Use this when the user asks to write up, post, or share their AI work as a Saywise story. Composes 1–2 story drafts from the current session — in the user's voice, under the unslop style contract — shows them, and creates them as private Suggested Drafts on the user's Saywise profile via the Saywise MCP server; nothing publishes until they accept each one there.
---

# Turning an AI Work session into Saywise story drafts

## When to trigger

Trigger when the user explicitly asks to write up, post, or share their work. Examples:

- "Write this up for my Saywise"
- "Turn this session into an AI work story"
- "Draft a post about what we just built"
- "/saywise-stories" (invoking the skill directly)

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
(headings, lists, fenced code blocks, links). Good for: a multi-step build, a
non-trivial debug, a real architectural decision. Tell it as a story, not
documentation: open on the specific moment it hurt (never scene-setting), spend the
middle on the wrong turns and what they taught, resolve with specifics, and end on a
specific — what surprised you, what you'd do differently — never a summary paragraph
or a moral. The title is specific and sentence case ("Cutting our Lambda cold starts
by 8x", not "A Journey of Optimization").

**No embedded Markdown images** — images enter a Saywise article through the editor's
upload when the user posts. Where one belongs, drop an italic placeholder naming the
user's real artifact (`*[Add screenshot: the failing build matrix]*` — a committed
diagram, a PR graph; never stock photos), and when handing the draft over, tell the
user which placeholders to fill with the editor's upload.

### `stat` — a single hero number

Use _sparingly_, only when a real number came up in the session — _"42% faster cold
start"_, _"$50k/yr saved in S3 egress"_. Give the number (with units), what it measures,
and one line of context. If you're tempted to invent or estimate a number — don't. Skip
the stat.

## How to write the content

- **Write under the `unslop` contract.** Load the `unslop` skill (same plugin/repo) before composing and run its final pass on every draft — it bans the AI vocabulary and structural tells that make a post read machine-written. If `unslop` isn't installed, ask the user to add it rather than approximating it from memory. Tone target: a Slack post for an engineering team — specific, plain, slightly understated.
- **Use the user's voice.** First person ("I did X", "I shipped Y"), not third person ("Claude helped the user…"). Saywise is the user's profile; they're the author.
- **Focus on what _the user_ did with AI**, not what AI produced for them. The interesting story is the user's judgment, iteration, and outcome — not the model's output.
- **Never paste raw chat.** A transcript dump is not a story. Distill what happened into prose.
- **Ground every claim in the session.** If a fact wasn't established in the conversation, don't invent it.

## Deliver

Present each draft under a clear label ("Post" / "Article" / "Stat") so the user can
read it as-is, then create them on their profile in the same turn — Suggested Drafts
are themselves the review step, so don't ask permission first:

- Call the Saywise MCP server's `saywise_create_suggested_drafts` tool in **`drafts`
  mode**: `sourceTool` = the product name of the tool this session runs in ("Claude
  Code", "Codex", …) and `drafts` = the drafts exactly as presented. Every draft
  carries its `format` discriminator — post `{format: "post", title?, body}` plain
  prose, article `{format: "article", title, body}` Markdown, stat
  `{format: "stat", value, label, caption?}`. The drafts land **private** on the
  profile's AI Stack as Suggested Drafts — nothing publishes until the user accepts
  each one there. Echo the returned review link, and tell the user they accept or
  dismiss each draft on their profile.
- **An explicit "don't submit" always wins.** If the user said not to send — in this
  run or in how they asked — present the drafts in chat and stop. If they ask for
  changes after submission, submit the revised draft and tell them to dismiss the
  superseded one on their profile.
- **Your composed drafts are the default.** Only send raw session material instead
  (the tool's `content` mode, where Saywise generates the drafts server-side) if the
  user explicitly asks Saywise to generate for them — never as a silent fallback.
  When you do, say so: content mode composes nothing in chat, so the user's first
  look at the drafts will be on their profile.
- If the Saywise MCP server is not connected or authenticated, tell the user to run
  `/mcp`, pick `Saywise`, and sign in — then submit. There is no manual path: the old
  composer (saywise.com/posts/new) is deprecated, and Suggested Drafts are the only
  way drafts reach a profile. Never link it.

## Common pitfalls

- **Don't ask the user "what should the title be?"** — pick one from the session context. They can change it when posting.
- **Don't generate more than 2 drafts.** One strong draft beats three mediocre ones.
- **Don't use stat without a real digit.** Invented stats are the fastest way to lose the user's trust.
- **Don't add a consent gate in chat.** Suggested Drafts land private and the user accepts or dismisses each one on their profile — that is the review step. Only an explicit "don't submit" from the user stops submission.
- **Don't link the old composer.** saywise.com/posts/new is deprecated and there is no self-serve Stories page — the Suggested Drafts flow is the only path to the profile.
- **Don't send session content server-side uninvited.** The tool's `content` mode ships the raw session to Saywise for generation — use it only when the user explicitly asks for that, never because composing feels hard.
