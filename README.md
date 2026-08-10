# Saywise skills

A Claude Code plugin that turns your coding sessions into draft "AI Work stories" for your [Saywise](https://saywise.com) profile, and measures how much you actually use AI. It works in Claude Code, Cowork, Claude Desktop, and Codex.

Drafts are composed locally, in your voice, and shown to you before anything moves. They land on your profile as **private Suggested Drafts** over the bundled Saywise MCP connection: you accept or dismiss each one there, and nothing publishes until you do. Say "don't submit" and nothing is sent at all. Usage stats are aggregate numbers only, submitted per tool and only when you confirm. Six skills, two slash commands.

## The skills

- **`saywise-stories`** — writes 1–2 drafts (post, article, or stat) from the current session. The article format is the long-form lane: told as a story, with placeholders marking where your real screenshots go. Ask ("write this up for my Saywise") or invoke `saywise-stories` directly.
- **`unslop`** — the style contract every writing skill loads first: banned AI vocabulary, engineering LLM-isms, structural tells, a final pass. Distilled from Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), LLM word-frequency studies, and the [humanizer](https://github.com/blader/humanizer) skill. Also works standalone: "apply unslop to this."
- **`saywise-scan` + `/saywise-scan`** — sweeps Claude Code and Codex conversations that are new since the last scan and drafts the ones that clear the bar. Zero drafts is a fine outcome.
- **`saywise-chat-scan`** — the same sweep for chat surfaces, which have no local logs. It shortlists story-worthy conversations from the surface's chat history and you pick which to draft.
- **`saywise-usage` + `/saywise-usage`** — deterministic measurement of your Claude Code and Codex CLI usage from local session logs: sessions, tokens split by cache, tool calls, active hours, streaks, a 26-week activity series, per-model usage. A bundled script computes it, and you see every number before deciding whether to submit.
- **`saywise-chat-stats`** — counts chat conversations (sessions, active days, date range) on surfaces where the script can't run. It measures and displays, and never submits anything.

## Automatic scanning

Two hooks make `/saywise-scan` mostly run itself. When a session ends, a local script pre-screens the conversation with cheap size-and-shape heuristics that never touch an LLM or the network, and queues the story-worthy ones. When your next session starts, a one-line note reports the queue so the agent can offer a scan.

Fully unattended drafting is opt-in. After your first successful scan the skill offers auto-scan once; enable it and closing a session with queued work spawns a background scan, at most once every 6 hours, on that CLI's quota. Drafts land as Markdown files in `~/.claude/saywise/drafts/` — ask any session to submit the keepers. Set `autoScan` to `false` in `~/.claude/saywise/config.json` to go back to nudges.

On Claude Code the hooks ship with the plugin. Codex CLI speaks the same hook contract but doesn't install plugin hooks, so wire them once in `~/.codex/hooks.json` (or an inline `[hooks]` table in `~/.codex/config.toml`), pointing at wherever `npx skills add saywise/skills` placed the scan skill:

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

Codex caps SessionEnd hooks at 3 seconds; the script typically finishes in under 100 ms. Queue and state live in `~/.claude/saywise/`, shared across both hosts. On agents without hooks, run the scan skill manually or on a schedule (documented inside the skill).

## Install

**Claude Code** — add the repo as a marketplace once, then install:

```bash
claude plugin marketplace add saywise/skills
claude plugin install saywise-skills@saywise
```

That covers the skills, commands, hooks, and the Saywise MCP server, on every surface that reads `~/.claude`: the CLI, the IDE extensions, and the Desktop app's Code tab. The first submission asks you to sign in — run `/mcp` and pick `Saywise`.

**Any agent** — the skills also install standalone into 25+ agents (Cursor, Copilot, Gemini CLI, …) via [skills.sh](https://skills.sh):

```bash
npx skills add saywise/skills
```

**Claude Desktop / claude.ai** — Cowork and chat load plugins from your claude.ai account, not from `~/.claude`, so install there separately: Settings → Customize → Plugins → Add marketplace → `https://github.com/saywise/skills`, then install `saywise-skills`. Every release also attaches `saywise-plugin.zip` for the upload option, for when the app can't reach GitHub. For plain chat, zip any `skills/<name>` folder from this repo and upload it under Settings → Capabilities → Skills; `saywise-chat-scan` and `saywise-chat-stats` are the chat-friendly ones.

## Use

> "Write this session up for my Saywise."

Or directly: `/saywise-stories` for the current session, `/saywise-scan` for recent ones, `/saywise-usage` for the numbers.

## Privacy

Everything runs on your machine or inside your chat session. The scan skills read local session logs and never upload them. Stats are aggregate only — timestamps, counts, token counters, model ids; never prompts, project names, file paths, or tool inputs. Exactly two things ever transmit, both over the authenticated MCP connection: composed drafts, created private for you to accept on your profile, and the usage payloads you approve per run. Raw session content leaves your machine only if you explicitly ask Saywise to generate drafts server-side. Unattended runs write local files and transmit nothing.

## Issues

File at [github.com/saywise/saywise/issues](https://github.com/saywise/saywise/issues).
