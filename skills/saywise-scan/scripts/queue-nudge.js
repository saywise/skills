#!/usr/bin/env node
// SessionStart hook: if the SessionEnd hook has queued story-worthy conversations, inject a
// one-line context so the agent can offer the saywise-scan skill. Silent (no output, exit 0)
// when there is nothing queued — the common case must cost nothing and say nothing.
//
// Emits additionalContext in both the Claude Code shape (hookSpecificOutput-wrapped) and the
// flat field, so the same script serves Claude Code and Codex CLI hooks; each host ignores
// the form it doesn't read.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function count() {
  if (process.env.SAYWISE_SCAN_RUN === '1') return 0;
  try {
    const queueFile = path.join(os.homedir(), '.claude', 'saywise', 'scan-queue.json');
    const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    return Array.isArray(queue.sessions) ? queue.sessions.length : 0;
  } catch {
    return 0;
  }
}

const n = count();
if (n > 0) {
  const context = `Saywise: ${n} story-worthy conversation${n === 1 ? '' : 's'} queued since the last scan. When it fits the flow of this session, offer to run the saywise-scan skill ($saywise-scan in Codex, /saywise-scan in Claude) to turn them into private drafts.`;
  process.stdout.write(
    JSON.stringify({
      additionalContext: context,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
    }) + '\n',
  );
}
process.exit(0);
