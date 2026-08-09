#!/usr/bin/env node
// SessionEnd hook: queue this conversation for the saywise-scan skill if it looks story-worthy.
//
// Works on Claude Code and Codex CLI — both deliver the same stdin contract (session_id,
// transcript_path, cwd, hook_event_name); the host is inferred from where the transcript
// lives (~/.claude/projects vs ~/.codex/sessions), which also picks the format markers and
// which CLI an opt-in auto-scan spawns. NOTE: Codex caps SessionEnd hooks at 1–3 s, so this
// script must stay cheap: it reads at most the first 1 MB of the transcript, writes one JSON
// file under ~/.claude/saywise/, and NEVER talks to the network or an LLM.
//
// The only exception is the explicit opt-in: when ~/.claude/saywise/config.json has
// {"autoScan": true}, ANY session end with queued work spawns a detached headless scan —
// not just story-worthy ones, or a backlog queued before the opt-in could wait days for the
// next interesting session. Debounced to one spawn per 6 h, and marked with
// SAYWISE_SCAN_RUN=1 so the scan run's own SessionEnd exits immediately — neither host
// documents built-in headless detection, so the guard is ours. Every failure path exits 0:
// a broken hook must never get in the way of a session ending.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SAYWISE_DIR = path.join(os.homedir(), '.claude', 'saywise');
const QUEUE_FILE = path.join(SAYWISE_DIR, 'scan-queue.json');
const STATE_FILE = path.join(SAYWISE_DIR, 'scan-state.json');
const CONFIG_FILE = path.join(SAYWISE_DIR, 'config.json');

// Mirrors the /saywise-scan skill's worthiness pre-filter: smaller transcripts don't hold a story.
const MIN_TRANSCRIPT_BYTES = 20_000;
// The format markers appear within the first MB of any real conversation; never read more.
const SNIFF_BYTES = 1_048_576;
const MAX_QUEUE = 50;
const AUTO_SCAN_DEBOUNCE_MS = 6 * 60 * 60 * 1000;
// 'spawn'/'error' fire within milliseconds; the fallback only guards a host that
// emits neither, and must stay well under Codex's 3 s SessionEnd cap.
const SPAWN_CONFIRM_MS = 1500;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function hostFor(transcriptPath) {
  return transcriptPath.split(path.sep).includes('.codex') ? 'codex' : 'claude';
}

/** The skill keys sessions as "<parent-dir>/<session-file>" — match that convention. */
function sessionKey(transcriptPath) {
  const parts = transcriptPath.split(path.sep).filter(Boolean);
  return parts.slice(-2).join('/');
}

function looksStoryWorthy(transcriptPath, host) {
  const stat = fs.statSync(transcriptPath);
  if (stat.size < MIN_TRANSCRIPT_BYTES) return false;
  const fd = fs.openSync(transcriptPath, 'r');
  try {
    const buf = Buffer.alloc(Math.min(stat.size, SNIFF_BYTES));
    fs.readSync(fd, buf, 0, buf.length, 0);
    const head = buf.toString('utf8');
    // Cheap pre-filter only — the scan skill's real triage happens with judgment later.
    // Codex rollouts log model output as response_item entries; Claude transcripts log
    // compact user/assistant message lines.
    if (host === 'codex') return head.includes('"response_item"');
    return head.includes('"type":"user"') && head.includes('"type":"assistant"');
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Spawns the headless scan if the opt-in and debounce allow it. Resolves true (and
 * stamps queue.lastAutoScanAt) only once the child actually started — a missing CLI
 * on the hook's PATH must not burn the 6-hour window.
 */
function maybeSpawnAutoScan(queue, host) {
  const config = readJson(CONFIG_FILE);
  if (config?.autoScan !== true) return Promise.resolve(false);
  const last = Date.parse(queue.lastAutoScanAt ?? '') || 0;
  if (Date.now() - last < AUTO_SCAN_DEBOUNCE_MS) return Promise.resolve(false);
  const [cmd, args] =
    host === 'codex'
      ? ['codex', ['exec', 'Use the saywise-scan skill: scan recent conversations and draft Saywise stories.']]
      : ['claude', ['-p', '/saywise-scan']];
  const { spawn } = require('child_process');
  const child = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
    cwd: os.homedir(),
    env: { ...process.env, SAYWISE_SCAN_RUN: '1' },
  });
  child.unref();
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(true), SPAWN_CONFIRM_MS);
    child.once('spawn', () => {
      clearTimeout(timer);
      resolve(true);
    });
    child.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  }).then(started => {
    if (started) queue.lastAutoScanAt = new Date().toISOString();
    return started;
  });
}

function writeQueue(queue) {
  fs.mkdirSync(SAYWISE_DIR, { recursive: true });
  // Atomic replace: concurrent SessionEnd hooks race on this file. Last writer wins,
  // which is accepted (scan-state dedupes drafts and the scan skill falls back to a
  // filesystem walk) — but a torn half-written file is not.
  const tmp = QUEUE_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(queue, null, 2) + '\n');
  fs.renameSync(tmp, QUEUE_FILE);
}

async function main(input) {
  if (process.env.SAYWISE_SCAN_RUN === '1') return;

  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    return;
  }
  const transcriptPath = payload?.transcript_path;
  if (typeof transcriptPath !== 'string' || !fs.existsSync(transcriptPath)) return;
  const host = hostFor(transcriptPath);

  const queue = readJson(QUEUE_FILE) ?? {};
  queue.sessions = Array.isArray(queue.sessions) ? queue.sessions : [];
  let dirty = false;

  let worthy = false;
  try {
    worthy = looksStoryWorthy(transcriptPath, host);
  } catch {
    // Transcript vanished mid-read — still fall through: a queued backlog may drain below.
  }
  if (worthy) {
    const key = sessionKey(transcriptPath);
    const state = readJson(STATE_FILE);
    const drafted = Array.isArray(state?.draftedSessions) && state.draftedSessions.includes(key);
    if (!drafted && !queue.sessions.some(s => s.key === key)) {
      queue.sessions.push({ key, file: transcriptPath, host, queuedAt: new Date().toISOString() });
      queue.sessions = queue.sessions.slice(-MAX_QUEUE);
      dirty = true;
    }
  }

  if (queue.sessions.length > 0 && (await maybeSpawnAutoScan(queue, host))) dirty = true;

  if (dirty) writeQueue(queue);
}

let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  stdin += chunk;
});
process.stdin.on('end', () => {
  Promise.resolve()
    .then(() => main(stdin))
    // Never block a session from ending.
    .catch(() => {})
    .finally(() => process.exit(0));
});
