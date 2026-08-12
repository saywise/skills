# AGENTS.md

This file provides guidance to coding agents working in this repository. Claude Code loads it through `CLAUDE.md`; Codex reads it directly.

## What this repo is

The **saywise-skills** cross-compatible Claude Code and Codex plugin, distributed from this repo acting as its own marketplace (named `saywise`). It turns Claude Code / Cowork / Claude Desktop / Codex sessions into draft "AI Work stories" for the user's Saywise profile, and measures local AI usage. There is no build system, no package.json, and no test suite — the deliverables are plugin manifests, Markdown skill files, two Claude slash-command wrappers, two small Node hook scripts, and one bundled stats script.

**Composition and measurement are local; the profile is where drafts get curated.** Skills compose drafts and compute stats locally and always show them to the user. The sanctioned network paths all run through the `Saywise` MCP server (registered in `.mcp.json`): interactive story runs create their *composed* drafts via `saywise_create_suggested_drafts` in `drafts` mode (the agent writes the story), without an extra chat confirmation — drafts land private as Suggested Drafts and the owner accepts or dismisses each on their profile before anything publishes; that accept step is the consent model, and an explicit "don't submit" from the user always wins. The tool's `content` mode (Saywise writes the story server-side) ships raw session material and runs only on the user's explicit ask, never as a fallback. `saywise-usage` submits its scanner payloads verbatim via `saywise_submit_usage_stats`, gated on explicit per-run confirmation. Unattended runs never call MCP tools. The manual composer (saywise.com/posts/new) is deprecated and there is no self-serve Stories page — the Suggested Drafts flow is the only path to a profile; never link or suggest the composer. This is a hard product constraint, restated in every skill — preserve all of it in any change.

## Layout

- `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` — Claude Code package and marketplace metadata.
- `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json` — Codex package and root-repository marketplace metadata. The marketplace source is `./`; keep its policy fields and category present.
- `.mcp.json` — registers the OAuth-protected `Saywise` MCP server (https://saywise.com/api/mcp/v1). At plugin root it is auto-discovered on plugin install; used only for the opt-in submissions (suggested drafts + usage stats).
- `skills/<name>/SKILL.md` — the six skills (see relationships below).
- `commands/*.md` — two Claude Code slash-command wrappers (`/saywise-scan`, `/saywise-usage`). Skills carry the real logic and are the Codex entry points; never put cross-host behavior only in a command wrapper.
- `hooks/hooks.json` — SessionEnd/SessionStart hooks bundled with both plugin packages, pointing at scripts inside `skills/saywise-scan/scripts/` via `${CLAUDE_PLUGIN_ROOT}`. Codex also provides that variable for Claude-plugin compatibility and requires a user trust review before running bundled hooks.
- `AGENTS.md` — canonical repository guidance for Codex and other agents. `CLAUDE.md` tells Claude Code to load it; keep substantive guidance here rather than duplicating it.
- `.github/workflows/release-skills.yml` — on a published GitHub release, zips the whole plugin as `saywise-plugin.zip` and attaches it to the release (for Claude Desktop's plugin-upload path).

## How the skills relate

- `unslop` is the shared anti-slop style contract. Every writing skill (`saywise-stories`, the scan skills) explicitly loads it before composing and runs its final pass. Changes to writing style rules belong there, not in the individual skills.
- `saywise-stories` is the single writing lane: 1–2 drafts (post / article / stat) from the *current* session, with the article format carrying the long-form guidance (story structure, image placeholders). Its Deliver section is the shared submission contract (`saywise_create_suggested_drafts`, `drafts` mode with the `format` discriminator on every draft, created without an extra chat confirmation, "don't submit" always wins) that the scan skills follow. `saywise-scan` sweeps *recent* Claude Code / Codex transcripts and delegates composition to `saywise-stories` + `unslop`; only its interactive mode may submit.
- Chat-surface counterparts exist because chat surfaces have no filesystem or local logs: `saywise-chat-scan` and `saywise-chat-stats` use the surface's built-in chat-history tools instead of scripts. `saywise-chat-scan` may submit composed drafts through the shared contract when the Saywise MCP tools are connected on the surface; `saywise-chat-stats` never submits (the usage schema requires token/hours fields chat history can't measure — a zero-padded payload would be fabricated). Each pair's SKILL.md descriptions route between the two (shell available → local skill; chat surface → chat skill). Keep that routing consistent when editing either half.
- `saywise-usage` runs the bundled `skills/saywise-usage/scripts/usage-scan.cjs` (Claude Code + Codex CLI logs) and forbids improvised parsers — deterministic, reproducible numbers are the point. The script is a port of the Saywise server's scanner-v2 semantics and emits one payload per source shaped exactly for the server's `saywise_submit_usage_stats` MCP tool (`usageStatsSubmitSchema` in saywise/saywise); keep the two in sync when the server contract changes. After displaying, the skill may submit payloads verbatim via that tool, but only on explicit per-run confirmation.

## The scan pipeline (hooks + state)

The automatic-scanning flow spans three pieces that must stay in sync:

1. **SessionEnd** → `enqueue-session.js` pre-screens the ended transcript with cheap heuristics (size ≥ 20 KB + format markers in the first 1 MB — no LLM, no network) and queues story-worthy ones in `~/.claude/saywise/scan-queue.json`. If `config.json` has `{"autoScan": true}`, any session end with a non-empty queue spawns a detached headless scan, debounced to once per 6 hours; the debounce stamp is written only after the spawn confirms, so a missing CLI doesn't burn the window.
2. **SessionStart** → `queue-nudge.js` emits a one-line `additionalContext` nudge when the queue is non-empty (silent otherwise).
3. **The `saywise-scan` skill** consumes the queue, triages with judgment, drafts, then updates `scan-state.json` (high-water mark + `draftedSessions` dedupe list) and drains the queue while preserving `lastAutoScanAt`.

Shared state lives in `~/.claude/saywise/` (`scan-queue.json`, `scan-state.json`, `config.json`, `drafts/`) across both hosts. The scripts serve Claude Code *and* Codex CLI: the host is inferred from the transcript path (`~/.claude/projects` vs `~/.codex/sessions`), and hook output is emitted in both hosts' shapes. `SAYWISE_SCAN_RUN=1` marks a scan's own session so the hooks stand down for it.

Hook script rules: every failure path exits 0 (a broken hook must never block a session ending), stay fast (Codex caps SessionEnd hooks at ~3 s), never touch the network or an LLM.

## Privacy contract

The stats scripts and skills read **aggregate signals only**: timestamps, message/event types, model ids, token counters, tool-use block *names* — never prompts, conversation content, project names, file paths, or tool inputs (single exception: the `run_in_background` boolean on subagent launches, read to count background runs). `usage-scan.cjs` is written to that contract for both log roots (e.g. projects leave only a count; Codex `cwd` is likewise never read); don't widen what it reads.

## Developing and testing

No build/lint/test commands. To exercise the scripts directly:

```bash
node skills/saywise-usage/scripts/usage-scan.cjs                    # prints the aggregate JSON
echo '{"transcript_path":"'$HOME'/.claude/projects/<dir>/<id>.jsonl"}' \
  | node skills/saywise-scan/scripts/enqueue-session.js             # simulate the SessionEnd hook
node skills/saywise-scan/scripts/queue-nudge.js                     # prints the nudge if queue is non-empty
```

Validate every changed JSON file, confirm the Claude and Codex manifest names and versions match, then validate all six skill folders. When the local Codex system skills are available, run the plugin-creator validator against the repository root and the skill-creator quick validator against each changed skill.

Test the package from both marketplaces: Claude Code uses `/saywise-scan` and `/saywise-usage`; Codex uses `$saywise-scan` and `$saywise-usage`. Both hosts should discover the same skills, `.mcp.json`, and `hooks/hooks.json` without copied host-specific implementations.

## Conventions

- Conventional-commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`), with the new plugin version in parentheses when a change bumps it, e.g. `feat: unslop — shared anti-slop style contract (0.9.0)`.
- Version lives in both `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`; they must match. Releases are GitHub releases (the workflow attaches the zip).
- Keep README.md, both plugin manifests, both marketplace files, and the SKILL.md descriptions telling the same story when behavior changes — they are the user-facing spec.
- SKILL.md files follow a common shape: frontmatter `description` written as routing guidance ("Use this when…"), then "When to trigger", the steps, and a "Common pitfalls" section. Match it for new skills.
