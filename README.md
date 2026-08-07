# Saywise skills

Turn Claude Code, Cowork, Claude Desktop, or Codex sessions into **Saywise-ready AI Work story drafts** — composed in your voice under an anti-slop style contract — and measure your local AI usage (aggregate numbers only). Measurement and drafting run locally; you review and post drafts on your Saywise profile yourself, and usage stats can optionally be submitted to your profile — per run, on your say-so — over the bundled Saywise MCP connection. Seven skills, four slash commands.

## What it does

- **`saywise-stories` + `/saywise-draft`** — composes 1–2 story drafts (post / article / stat) from the current session, in your voice, ready to post on your profile.
- **`saywise-article` + `/saywise-article`** — a dedicated long-form lane that structures one piece as an actual story (stakes, wrong turns, a concrete resolution), with image placeholders you fill via the Saywise editor when posting.
- **`unslop`** — the shared anti-slop style contract every writing skill loads before composing: banned AI vocabulary (delve, tapestry, seamless…), the engineering LLM-isms ("surface" as a verb, "shape", "gate", "battle-tested"…), structural tells (rule of three, "-ing" analysis tails, negative parallelism), whole-piece tells (survey symmetry, kicker cadence, uniform confidence), voice calibration, guardrails for editing existing text, and a final pass. Distilled from Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) catalog, LLM word-frequency studies, and the [humanizer](https://github.com/blader/humanizer) skill. No slash command — the other skills reference it, and "apply unslop to this" works standalone on any text.
- **`saywise-scan` + `/saywise-scan`** — sweeps your **recent** Claude Code / Codex conversations (new since the last scan) and drafts stories from any that clear the bar — in chat when you run it, into `~/.claude/saywise/drafts/` when scheduled. Zero drafts is a valid outcome.
- **`saywise-chat-scan`** — the same sweep for Claude Desktop / claude.ai chat, where there are no local logs: it shortlists story-worthy conversations via the built-in chat-history tools, you pick which to draft.
- **`saywise-usage` + `/saywise-usage`** — a deterministic, aggregate-only measurement of your Claude Code **and Codex CLI** usage: sessions, tokens split by input / output / cache read / cache write, tool-call counts, weekly activity, active days, longest streak, project count, hours, models. Computed locally by a bundled script and shown to you; then it offers — opt-in, per run — to submit the aggregate JSON to your Saywise profile via the bundled Saywise MCP server. **`saywise-chat-stats`** covers Desktop/claude.ai chat (sessions, active days, date range) via the built-in recent-chats tool.

Drafts are handed to you in chat or as local files, and posting them is your move: the Saywise composer lives at [saywise.com/posts/new](https://saywise.com/posts/new). The one server interaction in this plugin is `saywise-usage`'s opt-in stats submission over the authenticated Saywise MCP connection — nothing else is ever transmitted.

## Automatic scanning (Claude Code & Codex CLI)

Two hooks make `/saywise-scan` mostly run itself:

1. **When a session ends**, a local script pre-screens the conversation (size + shape heuristics — no LLM, no network, nothing leaves your machine) and queues story-worthy ones in `~/.claude/saywise/scan-queue.json`.
2. **When your next session starts**, a one-line note reports the queue ("3 story-worthy conversations queued") so the agent can offer `/saywise-scan`.
3. **Fully unattended drafting is opt-in.** After your first successful scan the skill offers auto-scan once; if you enable it (`{"autoScan": true}` in `~/.claude/saywise/config.json`), closing a session while story-worthy work is queued spawns a background scan on the host you were using — at most once every 6 hours, using that CLI's quota — and drafts land as plain Markdown files in `~/.claude/saywise/drafts/` for you to review and post. Set `autoScan` to `false` anytime to go back to nudges only.

**Claude Code**: the hooks ship with the plugin (you'll see them listed at install) — nothing to wire.

**Codex CLI**: Codex speaks the same hook contract but doesn't install plugin hooks, so wire them once in `~/.codex/hooks.json` (or an inline `[hooks]` table in `~/.codex/config.toml`), pointing at wherever `npx skills add saywise/skills` placed the `saywise-scan` skill — typically:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.codex/skills/saywise-scan/scripts/enqueue-session.js\"",
            "timeout": 3
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "node \"$HOME/.codex/skills/saywise-scan/scripts/queue-nudge.js\"" }]
      }
    ]
  }
}
```

(Codex caps `SessionEnd` hooks at 3 seconds — the script typically finishes in well under 100 ms. Adjust the paths if your skills installed elsewhere.) The same scripts detect which host a transcript came from, so scans, nudges, and auto-runs work identically; queue and state stay shared in `~/.claude/saywise/` across both.

On other agents (Cursor, Gemini CLI, …) hooks aren't available — use the scan skill manually or on a schedule as documented inside it.

## Install

### Claude Code

Add the repo as a marketplace once, then install from it:

```bash
claude plugin marketplace add saywise/skills
claude plugin install saywise-skills@saywise
```

That's the full setup — skills, slash commands, the automatic-scanning hooks, and the Saywise MCP server (used only for opt-in usage submission). The first submission asks you to authenticate: run `/mcp`, pick `saywise`, and finish the browser sign-in.

### Any agent (skills CLI)

The skills also install standalone into 25+ agents (Claude Code, Cursor, Codex, Copilot, Gemini CLI, …) via the [open agent skills ecosystem](https://skills.sh):

```bash
npx skills add saywise/skills            # all seven skills
npx skills add saywise/skills --skill saywise-article   # just one
```

### Claude Desktop / claude.ai

**Cowork** runs the full Saywise plugin — no CLI needed: Settings → Customize → **Plugins** → **Add marketplace** → `https://github.com/saywise/skills`, then install `saywise-skills`. Every release also attaches `saywise-plugin.zip` — the whole plugin in one archive for the Plugins page's upload option, for when your network can't reach GitHub from the app (the marketplace URL is the surer path and auto-updates).

**Plain chat**: any `skills/<name>` folder in this repo, zipped as-is, matches the Settings → Capabilities → **Skills** upload format — `saywise-chat-scan` and `saywise-chat-stats` are the chat-friendly ones.

## Use

Ask:

> "Write this session up for my Saywise."

Or run:

```text
/saywise-draft
```

The model composes 1–2 drafts and hands them to you with a link to the composer. To sweep recent sessions instead of the current one:

```text
/saywise-scan
```

To measure your usage — and optionally push the aggregate numbers to your profile:

```text
/saywise-usage
```

## Privacy

Everything runs on your machine (or inside your chat session). The scan skills read your local session logs and never upload them; the stats skills compute **aggregate numbers only** — timestamps, counts, model ids; never prompts, project names, file paths, or tool inputs — and show them to you. Drafts are text handed to you to review; no skill posts them. The one explicit exception: `saywise-usage` may submit its aggregate JSON — and only that JSON — to Saywise via the authenticated MCP connection, and only when you confirm in that run.

## Issues

File at [github.com/saywise/saywise/issues](https://github.com/saywise/saywise/issues).
