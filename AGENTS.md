# AGENTS.md

Read `CLAUDE.md` fully before changing this repository. Despite its historical
filename, it is the shared contributor guide for Codex, ChatGPT, Claude Code,
and other agents working here.

OpenAI compatibility adds three surfaces that must stay in sync with their
Claude counterparts:

- `.codex-plugin/plugin.json` mirrors the package version and product copy in
  `.claude-plugin/plugin.json`.
- `.agents/plugins/marketplace.json` exposes the repository-root plugin to
  Codex and the ChatGPT desktop app.
- Each `skills/<name>/agents/openai.yaml` mirrors that skill's current purpose
  and declares the Saywise MCP dependency when the workflow can submit data.

Preserve the feature and privacy contracts in `CLAUDE.md` on every host. Host
differences should change discovery, invocation, or path instructions only.
