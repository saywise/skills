# Saywise skills

A plugin for ChatGPT, Codex, and Claude that turns your AI sessions into draft
"AI Work stories" for your [Saywise](https://saywise.com) profile, and measures how
much you actually use coding agents. The same six skills work across ChatGPT
Chat/Work, Codex, Claude Code, Cowork, and Claude chat surfaces; each host uses the
tools and local data it actually exposes.

Drafts are composed locally, in your voice, and shown to you before anything moves. They land on your profile as **private Suggested Drafts** over the bundled Saywise MCP connection: you accept or dismiss each one there, and nothing publishes until you do. Say "don't submit" and nothing is sent at all. Usage stats are aggregate numbers only, submitted per tool and only when you confirm. Six skills; Claude also gets two slash commands.

## The skills

- **`saywise-stories`** — writes 1–2 drafts (post, article, or stat) from the current session. The article format is the long-form lane: told as a story, with placeholders marking where your real screenshots go. Ask ("write this up for my Saywise") or invoke `saywise-stories` directly.
- **`unslop`** — the style contract every writing skill loads first: banned AI vocabulary, engineering LLM-isms, structural tells, a final pass. Distilled from Wikipedia's [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), LLM word-frequency studies, and the [humanizer](https://github.com/blader/humanizer) skill. Also works standalone: "apply unslop to this."
- **`saywise-scan`** — sweeps Claude Code and Codex conversations that are new since the last scan and drafts the ones that clear the bar. Zero drafts is a fine outcome.
- **`saywise-chat-scan`** — the same sweep for ChatGPT or Claude chat surfaces, which have no local logs. It shortlists story-worthy conversations from the surface's history and you pick which to draft.
- **`saywise-usage`** — deterministic measurement of your Claude Code and Codex CLI usage from local session logs: sessions, tokens split by cache, tool calls, active hours, streaks, a 26-week activity series, per-model usage. A bundled script computes it, and you see every number before deciding whether to submit.
- **`saywise-chat-stats`** — counts chat conversations (sessions, active days, date range) on ChatGPT or Claude surfaces where the script can't run. It measures and displays, and never submits anything.

## Automatic scanning

Two hooks make `saywise-scan` mostly run itself. When a session ends, a local script pre-screens the conversation with cheap size-and-shape heuristics that never touch an LLM or the network, and queues the story-worthy ones. When your next session starts, a one-line note reports the queue so the agent can offer a scan.

Fully unattended drafting is opt-in. After your first successful scan the skill offers auto-scan once; enable it and closing a session with queued work spawns a background scan, at most once every 6 hours, on that CLI's quota. Drafts land as Markdown files in `~/.claude/saywise/drafts/` — ask any session to submit the keepers. Set `autoScan` to `false` in `~/.claude/saywise/config.json` to go back to nudges.

The full plugin bundles the hooks for both Claude Code and Codex CLI. Codex asks you
to review and trust plugin hooks before it runs them. If you install only the
standalone skills, wire the two scripts once in `~/.codex/hooks.json` (or an inline
`[hooks]` table in `~/.codex/config.toml`), replacing the example paths with the
installed `saywise-scan` skill's absolute path:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"/absolute/path/to/saywise-scan/scripts/enqueue-session.js\"",
            "timeout": 3
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "node \"/absolute/path/to/saywise-scan/scripts/queue-nudge.js\"" }]
      }
    ]
  }
}
```

Codex caps SessionEnd hooks at 3 seconds; the script typically finishes in under
100 ms. Queue and state live in `~/.claude/saywise/` for backward compatibility and
are shared across both CLIs. On agents without hooks, run the scan skill manually or
on a schedule (documented inside the skill).

## Install

**ChatGPT desktop + Codex CLI** — add the repository as a plugin marketplace:

```bash
codex plugin marketplace add saywise/skills
```

Open `/plugins` in Codex CLI (or the Plugins directory in the ChatGPT desktop app),
choose the **Saywise** source, and install **saywise-skills**. Start a new task after
installing so the six skills and Saywise MCP tools load. The first MCP action asks you
to sign in; use the plugin's connection settings to reconnect later. Codex also asks
you to review the bundled SessionStart and SessionEnd hooks before trusting them.

The OpenAI package lives in `.codex-plugin/plugin.json`, uses the repository
marketplace at `.agents/plugins/marketplace.json`, and keeps per-skill UI/tool metadata
under `skills/*/agents/openai.yaml`. It is the same plugin that ChatGPT and Codex load;
the chat-only skills take over automatically where local session logs are unavailable.

**Claude Code** — add the same repo as a Claude marketplace, then install:

```bash
claude plugin marketplace add saywise/skills
claude plugin install saywise-skills@saywise
```

That covers the skills, commands, hooks, and the Saywise MCP server on every surface
that reads `~/.claude`: the CLI, the IDE extensions, and the Desktop app's Code tab.
The first submission asks you to sign in — run `/mcp` and pick `Saywise`.

**Standalone skills / IDE extensions / other agents** — install the skills without
plugin packaging via [skills.sh](https://skills.sh):

```bash
npx skills add saywise/skills
```

This is the right path for the Codex IDE extension, which supports standalone skills
but not plugins, and for Cursor, Copilot, Gemini CLI, and other agents. Standalone
installs do not automatically register the Saywise MCP server or hooks; connect the
server at `https://saywise.com/api/mcp/v1` and use the manual hook setup above when
those features are wanted.

**Claude Desktop / claude.ai** — Cowork and chat load plugins from your claude.ai
account, not from `~/.claude`, so install there separately: Settings → Customize →
Plugins → Add marketplace → `https://github.com/saywise/skills`, then install
`saywise-skills`. Every release also attaches `saywise-plugin.zip` for upload paths.
For a plain Claude skill upload, zip any `skills/<name>` folder; `saywise-chat-scan`
and `saywise-chat-stats` are the chat-friendly ones.

## Use

> "Write this session up for my Saywise."

Or invoke a skill directly: `@saywise-stories` in ChatGPT,
`$saywise-stories` in Codex, or `/saywise-stories` in Claude. The matching scan and
usage invocations are `saywise-scan` and `saywise-usage` with the same host prefix.

## Privacy

Everything runs on your machine or inside your chat session. The scan skills read local session logs and never upload them. Stats are aggregate only — timestamps, counts, token counters, model ids; never prompts, project names, file paths, or tool inputs. Exactly two things ever transmit, both over the authenticated MCP connection: composed drafts, created private for you to accept on your profile, and the usage payloads you approve per run. Raw session content leaves your machine only if you explicitly ask Saywise to generate drafts server-side. Unattended runs write local files and transmit nothing.

## Issues

File at [github.com/saywise/saywise/issues](https://github.com/saywise/saywise/issues).
