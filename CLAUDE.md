# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The **saywise-skills** Claude Code plugin, distributed from this repo acting as its own marketplace (named `saywise`). It turns Claude Code / Cowork / Claude Desktop / Codex sessions into draft "AI Work stories" for the user's Saywise profile, and measures local AI usage. There is no build system, no package.json, and no test suite — the deliverables are Markdown skill files, four slash commands, two small Node hook scripts, and one bundled stats script.

**Composition and measurement are local by design; transmission is opt-in per run.** Skills compose drafts and compute stats locally and always show them to the user first. The sanctioned network paths all run through the `saywise` MCP server (registered in `.mcp.json`), each gated on explicit per-run user confirmation: the story skills submit *composed* drafts via `saywise_create_suggested_drafts` (compose mode is the default — drafts land private as Suggested Drafts and the owner accepts each on their profile before anything publishes; the tool's `content`/generate mode ships raw session material and runs only on the user's explicit ask, never as a fallback), and `saywise-usage` submits its scanner payloads verbatim via `saywise_submit_usage_stats`. Unattended runs never call MCP tools. The manual composer at saywise.com/posts/new stays documented as the always-works path. This is a hard product constraint, restated in every skill — preserve all of it in any change.

## Layout

- `.claude-plugin/plugin.json` — plugin manifest (name, version). `marketplace.json` — makes this repo installable as the `saywise` marketplace.
- `.mcp.json` — registers the OAuth-protected `saywise` MCP server (https://staging.saywise.com/api/mcp/v1). At plugin root it is auto-discovered on plugin install; used only for the opt-in submissions (suggested drafts + usage stats).
- `skills/<name>/SKILL.md` — the seven skills (see relationships below).
- `commands/*.md` — the four slash commands; each is a thin wrapper that loads its skill and adds delivery instructions. Skills carry the real logic.
- `hooks/hooks.json` — SessionEnd/SessionStart hooks bundled with the plugin, pointing at scripts inside `skills/saywise-scan/scripts/` via `${CLAUDE_PLUGIN_ROOT}`.
- `.github/workflows/release-skills.yml` — on a published GitHub release, zips the whole plugin as `saywise-plugin.zip` and attaches it to the release (for Claude Desktop's plugin-upload path).

## How the skills relate

- `unslop` is the shared anti-slop style contract. Every writing skill (`saywise-stories`, `saywise-article`, the scan skills) explicitly loads it before composing and runs its final pass. Changes to writing style rules belong there, not in the individual skills.
- `saywise-stories` composes 1–2 drafts (post / article / stat) from the *current* session; its Deliver section is the shared submission contract (`saywise_create_suggested_drafts`, compose mode, explicit yes) that `saywise-article` and `saywise-scan` follow. `saywise-article` is the dedicated long-form lane (exactly one article). `saywise-scan` sweeps *recent* Claude Code / Codex transcripts and delegates composition to `saywise-stories` + `unslop`; only its interactive mode may submit.
- Chat-surface counterparts exist because Desktop/claude.ai has no filesystem or local logs: `saywise-chat-scan` and `saywise-chat-stats` use the built-in chat-history tools instead of scripts. Each pair's SKILL.md descriptions route between the two (shell available → local skill; chat surface → chat skill). Keep that routing consistent when editing either half.
- `saywise-usage` runs the bundled `skills/saywise-usage/scripts/usage-scan.cjs` (Claude Code + Codex CLI logs) and forbids improvised parsers — deterministic, reproducible numbers are the point. The script is a port of the Saywise server's scanner-v2 semantics and emits one payload per source shaped exactly for the server's `saywise_submit_usage_stats` MCP tool (`usageStatsSubmitSchema` in saywise/saywise); keep the two in sync when the server contract changes. After displaying, the skill may submit payloads verbatim via that tool, but only on explicit per-run confirmation.

## The scan pipeline (hooks + state)

The automatic-scanning flow spans three pieces that must stay in sync:

1. **SessionEnd** → `enqueue-session.js` pre-screens the ended transcript with cheap heuristics (size ≥ 20 KB + format markers in the first 1 MB — no LLM, no network) and queues story-worthy ones in `~/.claude/saywise/scan-queue.json`. If `config.json` has `{"autoScan": true}`, any session end with a non-empty queue spawns a detached headless scan, debounced to once per 6 hours; the debounce stamp is written only after the spawn confirms, so a missing CLI doesn't burn the window.
2. **SessionStart** → `queue-nudge.js` emits a one-line `additionalContext` nudge when the queue is non-empty (silent otherwise).
3. **`/saywise-scan`** consumes the queue, triages with judgment, drafts, then updates `scan-state.json` (high-water mark + `draftedSessions` dedupe list) and drains the queue while preserving `lastAutoScanAt`.

Shared state lives in `~/.claude/saywise/` (`scan-queue.json`, `scan-state.json`, `config.json`, `drafts/`) across both hosts. The scripts serve Claude Code *and* Codex CLI: the host is inferred from the transcript path (`~/.claude/projects` vs `~/.codex/sessions`), and hook output is emitted in both hosts' shapes. `SAYWISE_SCAN_RUN=1` marks a scan's own session so the hooks stand down for it.

Hook script rules: every failure path exits 0 (a broken hook must never block a session ending), stay fast (Codex caps SessionEnd hooks at ~3 s), never touch the network or an LLM.

## Privacy contract

The stats scripts and skills read **aggregate signals only**: timestamps, message/event types, model ids, token counters, tool-use block *names* — never prompts, conversation content, project names, file paths, or tool inputs. `usage-scan.cjs` is written to that contract for both log roots (e.g. projects leave only a count; Codex `cwd` is likewise never read); don't widen what it reads.

## Developing and testing

No build/lint/test commands. To exercise the scripts directly:

```bash
node skills/saywise-usage/scripts/usage-scan.cjs                    # prints the aggregate JSON
echo '{"transcript_path":"'$HOME'/.claude/projects/<dir>/<id>.jsonl"}' \
  | node skills/saywise-scan/scripts/enqueue-session.js             # simulate the SessionEnd hook
node skills/saywise-scan/scripts/queue-nudge.js                     # prints the nudge if queue is non-empty
```

Skills themselves are tested by installing the plugin and invoking them (`/saywise-draft`, `/saywise-scan`, `/saywise-usage`, `/saywise-article`).

## Conventions

- Conventional-commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`), with the new plugin version in parentheses when a change bumps it, e.g. `feat: unslop — shared anti-slop style contract (0.9.0)`.
- Version lives in `.claude-plugin/plugin.json`; releases are GitHub releases (the workflow attaches the zip).
- Keep README.md, plugin.json/marketplace.json descriptions, and the SKILL.md descriptions telling the same story when behavior changes — they are the user-facing spec.
- SKILL.md files follow a common shape: frontmatter `description` written as routing guidance ("Use this when…"), then "When to trigger", the steps, and a "Common pitfalls" section. Match it for new skills.
