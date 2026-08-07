# Can claude.ai / Desktop skills bundle executable scripts?

Researched 2026-08-04, primary sources only (docs.claude.com → platform.claude.com, support.claude.com, github.com/anthropics/skills, anthropic.com/engineering).

**Summary — is the export-parser design viable?** Yes, with three caveats. Custom skills uploaded to
claude.ai/Desktop can bundle executable scripts, and Claude runs them via bash in the server-side code
execution sandbox — this is documented, not incidental. JavaScript/Node is an advertised runtime on
claude.ai (npm install is even allowed there), but no Node *version* is published anywhere, so the
`.cjs` parser needs a smoke test (or a Python 3.11 twin, the only pinned runtime). Whether a user can
attach a `.zip` to a chat and have the sandbox see it is **not confirmed** by any primary source (the
30 MB/file upload cap is), and the export's `conversations.json` schema is likewise undocumented —
both need one empirical test before shipping.

**Why this matters here:** this repo's `skills/saywise-chat-stats` skill counts chats via the built-in
recent-chats tool. The plan is to bundle a deterministic parser (like
`skills/saywise-usage/scripts/usage-scan.cjs`) so a user can upload their claude.ai data-export zip and
the script computes aggregate-only stats (conversation/message counts, active days, streak, date range)
in the sandbox — no improvised parsing by the model.

## 1. Packaging format

- Every skill is a folder with a `SKILL.md`; YAML frontmatter requires `name` (≤64 chars, lowercase
  letters/numbers/hyphens, no XML tags, no reserved words "anthropic"/"claude") and `description`
  (non-empty, ≤1024 chars, no XML tags). — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
  - Discrepancy: the Help Center says description max is **200 characters** for claude.ai uploads.
    Staying ≤200 satisfies both. — https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
- Additional files are first-class: extra markdown, reference material, and `scripts/` ("Executable
  scripts … that Claude runs using bash"); loaded/executed only when needed (progressive disclosure,
  "no practical limit on bundled content"). — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Zip structure is **folder-wrapped, not flat**: "Ensure the folder name matches your skill's name …
  The ZIP should contain the skill folder as its root (not a subfolder)." — https://support.claude.com/en/articles/12512198-how-to-create-custom-skills
- Size limit: no number published. The Help Center only lists "ZIP file exceeds size limits" as an
  upload-error cause. — https://support.claude.com/en/articles/12512180-use-skills-in-claude

## 2. Script execution

- Confirmed: "you can attach executable scripts to custom skills for more advanced functionality."
  — https://support.claude.com/en/articles/12512176-what-are-skills
- Mechanism: "When instructions mention executable scripts, Claude runs them through bash and receives
  only the output (the script code itself never enters context)." — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Runtimes on claude.ai: Claude can "write and run code (for example Python or Javascript)"
  (— https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude); the authoring
  guide adds "claude.ai: Can install packages from npm and PyPI and pull from GitHub repositories"
  (— https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices). Only the API
  container pins versions: **Python 3.11**, Linux x86_64 — no Node version is published for any surface.
  — https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- Invocation convention: paths relative to the skill folder with forward slashes, e.g.
  `python scripts/analyze_form.py input.pdf > fields.json`; instructions must say *run* (vs *read*) the
  script. So the chat-stats SKILL.md should say "Run `node scripts/export-scan.cjs <export-dir>`".
  — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

## 3. User-uploaded files

- The claude.ai sandbox processes user uploads (CSV/TSV, data analysis on attached files); "maximum
  file size is 30MB per file for both uploads and downloads." — https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude
- Zip specifics: **unconfirmed for claude.ai**. No primary source states that `.zip` is an accepted chat
  attachment or where attachments land on the sandbox filesystem. The API container does ship `unzip`,
  `unrar`, and `7zip`, so unzipping is in-family for the sandbox image, but that page documents the API,
  not claude.ai. — https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- Consequence: the skill should also handle a bare `conversations.json` upload (user extracts locally)
  as a fallback if zip attachment fails; large exports may exceed 30 MB even zipped.

## 4. Sandbox constraints

- Network on claude.ai is admin/user-configurable: "Skills may have full, partial, or no network access"
  (— https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview); the four levels are
  disabled / package managers only (Team default) / package managers + allowlisted domains / all domains
  (Enterprise defaults to disabled). — https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude
  The parser needs zero network, so it works at every level — worth stating in the SKILL.md.
- Hard numbers exist only for the API container: 5 GiB RAM, 5 GiB disk, 1 CPU, no internet, containers
  expire after 30 days, checkpointed after ~5 min idle; claude.ai publishes none of these.
  — https://platform.claude.com/docs/en/agents-and-tools/tool-use/code-execution-tool
- State persistence across messages within a claude.ai conversation is undocumented (the API offers
  explicit container reuse; Cowork destroys its sandbox per session). Don't design around files
  surviving between turns.

## 5. Surface differences

- **claude.ai web / mobile (cloud sessions):** "the agent loop and code execution run in an isolated,
  temporary sandbox on Anthropic-managed infrastructure" — scripts run server-side.
  — https://support.claude.com/en/articles/14479288-claude-cowork-architecture-overview
- **Claude Desktop / Cowork local execution:** the agent loop runs natively on the device and "code
  execution runs in an isolated virtual machine (VM)" — a local Linux VM, isolated from the host. Same
  answer for the skill (bash + script in a Linux environment), different machine. Local files come via
  connected folders; cloud sessions reach device files through the Desktop app. — same URL as above.
- **Claude Code:** skills are plain directories (`~/.claude/skills/`, `.claude/skills/`) with full
  network — that's what `saywise-usage` already relies on. Custom skills do **not** sync across
  surfaces; the chat-surface skill must be uploaded to claude.ai separately from this repo's plugin.
  — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview

## 6. Availability gating

- "Skills are available for users on Free, Pro, Max, Team, and Enterprise plans. This feature requires
  code execution to be enabled." — https://support.claude.com/en/articles/12512176-what-are-skills
  - Discrepancy: the platform docs say custom-skill upload is "Available on Pro, Max, Team, and
    Enterprise plans" (no Free). Safest reading: using skills is universal, uploading custom ones needs
    a paid plan. — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Toggle: Free/Pro/Max enable "Code execution and file creation" under Settings > Capabilities;
  Team/Enterprise org owners enable it (default on) plus a separate org "Skills" setting.
  — https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude and
  https://support.claude.com/en/articles/12512180-use-skills-in-claude
- Upload UI: Customize > Skills → "+" → upload zip (Help Center); older docs say Settings > Features.
  Org admins can provision skills org-wide (Team/Enterprise). — https://support.claude.com/en/articles/13119606-provision-and-manage-skills-for-your-organization

## The data export (stat ceiling)

- Primary source confirms only: exports include "conversation data and the user data for your account",
  arrive as an emailed download link (24 h expiry), and are available to Free/Pro/Max individuals — on
  Team/Enterprise **only the Primary Owner** can export, which shrinks the audience for this feature.
  — https://support.claude.com/en/articles/9450526-export-your-claude-data
- **Not confirmed anywhere primary:** the `conversations.json` schema — per-message timestamps, sender
  roles, model ids, token counts. Community export viewers consistently show per-message
  `sender`/`created_at` and no token counts, but that is secondary evidence. If it holds, the stat
  ceiling is: conversation/message counts, active days, streaks, date range — **no token or model stats**.
- **Decision (2026-08-04): chat token usage is out of scope.** Token counts exist only server-side.
  The one workaround — tokenizing exported message text to estimate — is rejected: it reads
  conversation content (the bundled parsers never do), produces an estimate (both stats skills ban
  them), and counts visible text only, missing system prompts, tool traffic, thinking, and cache —
  most of what "token usage" means. The chat ceiling stays counts, active days, streaks, date range.

## Open questions

1. **Zip attachment → sandbox path** — does claude.ai accept a `.zip` chat upload and expose it to bash?
   Resolve: upload a real export zip to a code-execution-enabled chat and `ls` it.
2. **Node.js presence/version in the claude.ai sandbox** — resolve with `node --version` in a test chat;
   if absent or ancient, ship the parser as Python 3.11.
3. **`conversations.json` fields** (timestamps, senders, model, tokens) — resolve by requesting Jordan's
   own export and inspecting it; freeze the parser's schema against that sample.
4. **Skill zip size limit and per-conversation sandbox persistence** — no published numbers; test only if
   the skill grows beyond a few scripts.
5. **Connected-folder route for real token stats** (unaffected by the chat-tokens decision) — in
   Desktop local execution, host files reach the sandbox VM via connected folders. If `~/.claude` can
   be connected (dotfolder pickability untested), a chat-surface skill could run the real
   `usage-scan.cjs` against Claude Code logs from inside a Desktop chat.
