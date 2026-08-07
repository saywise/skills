---
description: Turn this session into 1–2 Saywise-ready AI Work story drafts.
---

Load the `saywise-stories` skill, then follow it exactly: compose 1–2 story drafts from the current session, present them for review, and on the user's explicit yes submit them as private Suggested Drafts via the saywise MCP server (manual fallback: https://saywise.com/posts/new).

Follow the skill's guidance on format selection (post / article / stat), voice (first person, no "Claude helped me…"), grounding (every claim from the session, no invented numbers), and the `unslop` style contract.

If the user added context after the slash command — e.g. `/saywise-draft as an article about the OAuth migration` — treat that as instructions for format and framing.

Your composed drafts are what gets submitted — server-side generation only on the user's explicit ask. Nothing publishes until the user accepts each draft on their profile, and nothing is sent at all without their yes this run.
