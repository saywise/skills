#!/usr/bin/env node
/*
 * Saywise usage scanner — measures aggregate AI-tool usage from local session logs:
 *   Claude Code  ~/.claude/projects/**\/*.jsonl   (including per-session subagent transcripts)
 *   Codex CLI    ~/.codex/sessions/**\/*.jsonl
 *
 * Privacy contract: reads ONLY structural fields — entry/event types, timestamps,
 * request / message / call ids, model ids, token counters, tool names, and the
 * run_in_background boolean. It never reads conversation content, prompts, file
 * paths, project names, cwd, or tool inputs, and its output contains only counts,
 * timestamps, and model ids.
 *
 * Output: {"payloads": [...]} — one entry per source with data, each shaped exactly
 * like the Saywise MCP saywise_submit_usage_stats input (usageStatsSubmitSchema,
 * scanner v2 semantics: activity windows merged across sessions at >30-minute gaps,
 * trailing 182-day dailyActiveMinutes series, current + longest streaks). Submit a
 * payload verbatim or not at all. Errors go to stderr with exit code 1 — the script
 * never fabricates numbers.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const SCANNER_VERSION = 'plugin-2';
const CLAUDE_ROOT = path.join(os.homedir(), '.claude', 'projects');
const CODEX_ROOT = path.join(os.homedir(), '.codex', 'sessions');
const GAP_MS = 30 * 60 * 1000; // >30 min between entries = new activity window
const MIN_WINDOW_MS = 60 * 1000; // a lone timestamp still counts as a minute of activity
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_SERIES_DAYS = 182; // trailing window of the per-day series (26 weeks)

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
// 'Agent' is the current subagent tool name; older CLI versions wrote 'Task'.
const AGENT_TOOLS = new Set(['Agent', 'Task']);

function newState() {
  return {
    sessions: 0,
    projectCount: 0,
    recentSessions: 0,
    timestamps: [],
    days: new Set(), // integer UTC day indexes (ms / DAY_MS)
    models: new Set(),
    modelTokens: Object.create(null), // model id -> output tokens (deduped per response)
    mcpServers: new Set(),
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    toolCalls: 0,
    fileEditCalls: 0,
    commandCalls: 0,
    subagentRuns: 0,
    backgroundAgentRuns: 0,
    mcpToolCalls: 0,
    skillInvocations: 0,
    planModeUses: 0,
    webSearchCalls: 0,
    webFetchCalls: 0,
  };
}

function fail(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

function parseTs(value) {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

// ---------------------------------------------------------------------------
// Claude Code source
// ---------------------------------------------------------------------------

function recordAssistant(state, entry, usageSeen, blockSeen) {
  const message = entry.message;
  if (!message || typeof message !== 'object') return;
  const model =
    typeof message.model === 'string' && message.model && !message.model.startsWith('<') ? message.model : null;
  if (model) state.models.add(model);
  // One API response is logged as several JSONL lines, each carrying the full usage
  // block — dedupe per response before summing. Duplicates always sit within one
  // file, so the seen-sets are per-file (bounds memory on huge histories).
  const usageKey = (entry.requestId || '') + '|' + (message.id || '');
  const usage = message.usage;
  if (usage && typeof usage === 'object' && usageKey !== '|' && !usageSeen.has(usageKey)) {
    usageSeen.add(usageKey);
    state.inputTokens += usage.input_tokens || 0;
    state.outputTokens += usage.output_tokens || 0;
    state.cacheReadTokens += usage.cache_read_input_tokens || 0;
    state.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
    if (model) state.modelTokens[model] = (state.modelTokens[model] || 0) + (usage.output_tokens || 0);
  }
  if (!Array.isArray(message.content)) return;
  for (const block of message.content) {
    if (!block || block.type !== 'tool_use' || typeof block.name !== 'string') continue;
    const blockKey = (message.id || '') + ':' + (block.id || '');
    if (blockKey === ':' || blockSeen.has(blockKey)) continue;
    blockSeen.add(blockKey);
    state.toolCalls += 1;
    const name = block.name;
    if (EDIT_TOOLS.has(name)) state.fileEditCalls += 1;
    else if (name === 'Bash') state.commandCalls += 1;
    if (AGENT_TOOLS.has(name)) {
      state.subagentRuns += 1;
      if (block.input && typeof block.input === 'object' && block.input.run_in_background === true) {
        state.backgroundAgentRuns += 1;
      }
    } else if (name.startsWith('mcp__')) {
      state.mcpToolCalls += 1;
      const server = name.split('__')[1];
      if (server) state.mcpServers.add(server);
    } else if (name === 'Skill') state.skillInvocations += 1;
    else if (name === 'ExitPlanMode') state.planModeUses += 1;
    else if (name === 'WebSearch') state.webSearchCalls += 1;
    else if (name === 'WebFetch') state.webFetchCalls += 1;
  }
}

async function scanClaudeFile(state, file) {
  const result = { hasUser: false, hasAssistant: false, maxTs: null };
  const usageSeen = new Set();
  const blockSeen = new Set();
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    // Cheap substring pre-filter: only conversation entries matter, and the CLI writes
    // compact JSON, so both spellings below are literal. Top-level type is re-checked
    // after parsing, so a content string containing either marker cannot miscount.
    const maybeUser = line.includes('"type":"user"');
    const maybeAssistant = line.includes('"type":"assistant"');
    if (!maybeUser && !maybeAssistant) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!entry || (entry.type !== 'user' && entry.type !== 'assistant')) continue;
    const ms = parseTs(entry.timestamp);
    if (ms === null) continue;
    state.timestamps.push(ms);
    state.days.add(Math.floor(ms / DAY_MS));
    if (result.maxTs === null || ms > result.maxTs) result.maxTs = ms;
    if (entry.type === 'user') result.hasUser = true;
    else {
      result.hasAssistant = true;
      recordAssistant(state, entry, usageSeen, blockSeen);
    }
  }
  return result;
}

// Per-session subagent transcripts: <session-uuid>/subagents/agent-*.jsonl.
// Their tokens/tool calls count; they never count as sessions.
async function scanSubagentDir(state, sessionDir) {
  const subagentsPath = path.join(sessionDir, 'subagents');
  let subFiles;
  try {
    subFiles = fs.readdirSync(subagentsPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const sub of subFiles) {
    if (sub.isFile() && sub.name.endsWith('.jsonl')) await scanClaudeFile(state, path.join(subagentsPath, sub.name));
  }
}

async function scanClaude(state, root, now) {
  let projectDirs;
  try {
    projectDirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return;
  }
  for (const project of projectDirs) {
    const projectPath = path.join(root, project.name);
    let entries;
    try {
      entries = fs.readdirSync(projectPath, { withFileTypes: true });
    } catch {
      continue;
    }
    let hasSession = false;
    for (const entry of entries) {
      const entryPath = path.join(projectPath, entry.name);
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        // A main session file. Counts as a session only when a real conversation
        // happened (>=1 user and >=1 assistant entry with valid timestamps).
        const result = await scanClaudeFile(state, entryPath);
        if (result.hasUser && result.hasAssistant && result.maxTs !== null) {
          state.sessions += 1;
          hasSession = true;
          if (now - result.maxTs <= 7 * DAY_MS) state.recentSessions += 1;
        }
      } else if (entry.isDirectory()) {
        await scanSubagentDir(state, entryPath);
      }
    }
    if (hasSession) state.projectCount += 1;
  }
}

// ---------------------------------------------------------------------------
// Codex CLI source
// ---------------------------------------------------------------------------

// Codex rollout lines are {"timestamp", "type", "payload"}. Only presence and
// aggregate signals are read: payload.type, payload.role, payload.model,
// payload.name, payload.call_id, and payload.info token counters — never message
// text, arguments, or cwd.
const CODEX_TOOL_TYPES = new Set(['function_call', 'local_shell_call', 'custom_tool_call', 'web_search_call']);
const CODEX_SHELL_NAMES = new Set(['shell', 'exec_command', 'shell_command']);

async function scanCodexFile(state, file, now) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
  let hasUser = false;
  let hasAssistant = false;
  let maxTs = null;
  const callSeen = new Set();
  // total_token_usage is cumulative per session — keep the last one seen. If the
  // counter ever resets mid-file (compaction/resume), "last" undercounts, which is
  // the acceptable direction (never inflate). Files with only last_token_usage
  // deltas are summed instead.
  let cumulative = null;
  let deltaSum = null;
  for await (const line of rl) {
    if (!line.includes('"response_item"') && !line.includes('"event_msg"') && !line.includes('"turn_context"'))
      continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const payload = entry && entry.payload;
    if (!payload || typeof payload !== 'object') continue;
    let isActivity = false;
    if (entry.type === 'turn_context') {
      if (typeof payload.model === 'string' && payload.model) state.models.add(payload.model);
    } else if (entry.type === 'event_msg') {
      if (payload.type === 'user_message') {
        hasUser = true;
        isActivity = true;
      } else if (payload.type === 'agent_message') {
        hasAssistant = true;
        isActivity = true;
      } else if (payload.type === 'token_count' && payload.info && typeof payload.info === 'object') {
        const total = payload.info.total_token_usage;
        const last = payload.info.last_token_usage;
        if (total && typeof total === 'object') cumulative = total;
        else if (last && typeof last === 'object') {
          if (!deltaSum) deltaSum = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
          for (const k of Object.keys(deltaSum)) deltaSum[k] += typeof last[k] === 'number' ? last[k] : 0;
        }
      }
    } else if (entry.type === 'response_item') {
      if (payload.type === 'message') {
        if (payload.role === 'user') {
          hasUser = true;
          isActivity = true;
        } else if (payload.role === 'assistant') {
          hasAssistant = true;
          isActivity = true;
        }
      } else if (CODEX_TOOL_TYPES.has(payload.type)) {
        isActivity = true;
        const callId = typeof payload.call_id === 'string' ? payload.call_id : null;
        if (!callId || !callSeen.has(callId)) {
          if (callId) callSeen.add(callId);
          state.toolCalls += 1;
          const name = typeof payload.name === 'string' ? payload.name : '';
          if (payload.type === 'local_shell_call' || CODEX_SHELL_NAMES.has(name)) state.commandCalls += 1;
          else if (name === 'apply_patch') state.fileEditCalls += 1;
          if (payload.type === 'web_search_call') state.webSearchCalls += 1;
        }
      }
    }
    if (isActivity) {
      const ms = parseTs(entry.timestamp);
      if (ms !== null) {
        state.timestamps.push(ms);
        state.days.add(Math.floor(ms / DAY_MS));
        if (maxTs === null || ms > maxTs) maxTs = ms;
      }
    }
  }
  const usage = cumulative || deltaSum;
  if (usage) {
    const input = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
    const cached = typeof usage.cached_input_tokens === 'number' ? usage.cached_input_tokens : 0;
    // Codex input_tokens INCLUDES the cached subset — split it so the payload's
    // four token fields are disjoint and sum exactly to totalTokens, matching the
    // submit schema's invariant. output_tokens already includes reasoning tokens.
    state.inputTokens += Math.max(0, input - cached);
    state.cacheReadTokens += Math.min(cached, input);
    state.outputTokens += typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
  }
  if (hasUser && hasAssistant && maxTs !== null) {
    state.sessions += 1;
    if (now - maxTs <= 7 * DAY_MS) state.recentSessions += 1;
  }
}

async function scanCodex(state, dir, now) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) await scanCodex(state, p, now);
    else if (ent.isFile() && ent.name.endsWith('.jsonl')) await scanCodexFile(state, p, now);
  }
}

// ---------------------------------------------------------------------------
// Payload assembly (usageStatsSubmitSchema shape, scanner v2 semantics)
// ---------------------------------------------------------------------------

function buildPayload(source, state, generatedAtMs) {
  if (state.sessions === 0 || state.timestamps.length === 0) return null;

  // Active time: merge ALL timestamps globally (so parallel sessions never
  // double-count), split at >30-minute gaps, floor each window at one minute.
  const ts = Float64Array.from(state.timestamps).sort();
  const windows = [];
  let windowStart = ts[0];
  let prev = ts[0];
  for (let i = 1; i < ts.length; i++) {
    if (ts[i] - prev > GAP_MS) {
      windows.push([windowStart, prev]);
      windowStart = ts[i];
    }
    prev = ts[i];
  }
  windows.push([windowStart, prev]);

  // Total active time and the per-day split come from the SAME windows so they can't
  // disagree: each window's real span is allocated across the UTC days it covers, and
  // the one-minute floor's shortfall is booked on the window's start day.
  let activeMs = 0;
  const dayActiveMs = new Map(); // integer UTC day index -> active ms
  for (const w of windows) {
    const span = Math.max(w[1] - w[0], MIN_WINDOW_MS);
    activeMs += span;
    const startDay = Math.floor(w[0] / DAY_MS);
    for (let d = startDay, last = Math.floor(w[1] / DAY_MS); d <= last; d++) {
      const overlap = Math.min(w[1], (d + 1) * DAY_MS) - Math.max(w[0], d * DAY_MS);
      if (overlap > 0) dayActiveMs.set(d, (dayActiveMs.get(d) || 0) + overlap);
    }
    const shortfall = span - (w[1] - w[0]);
    if (shortfall > 0) dayActiveMs.set(startDay, (dayActiveMs.get(startDay) || 0) + shortfall);
  }

  // Streaks over the sorted UTC day set: the current one (ending at the most recent
  // active day) and the longest run anywhere in the logs.
  const days = Array.from(state.days).sort((a, b) => a - b);
  let streakDays = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (days[i] - days[i - 1] !== 1) break;
    streakDays += 1;
  }
  let longestStreakDays = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] - days[i - 1] === 1 ? run + 1 : 1;
    if (run > longestStreakDays) longestStreakDays = run;
  }

  // Trailing per-day series, oldest first, anchored at generatedAt's UTC day.
  const endDay = Math.floor(generatedAtMs / DAY_MS);
  const dailyActiveMinutes = [];
  for (let d = endDay - DAILY_SERIES_DAYS + 1; d <= endDay; d++) {
    dailyActiveMinutes.push(Math.min(1440, Math.round((dayActiveMs.get(d) || 0) / 60000)));
  }

  // The 25 cap mirrors models.max(25) in the submit schema; modelUsage is filtered to
  // the emitted list so the two can't disagree, and sorted by usage (id as tiebreak).
  const models = Array.from(state.models).sort().slice(0, 25);
  const modelSet = new Set(models);
  const modelUsage = Object.keys(state.modelTokens)
    .filter((m) => modelSet.has(m))
    .map((m) => ({ model: m, outputTokens: state.modelTokens[m] }))
    .sort((a, b) => b.outputTokens - a.outputTokens || (a.model < b.model ? -1 : 1));

  return {
    source,
    scannerVersion: SCANNER_VERSION,
    generatedAt: new Date(generatedAtMs).toISOString(),
    sessions: state.sessions,
    projectCount: state.projectCount,
    activeDays: state.days.size,
    streakDays,
    longestStreakDays,
    sessionsLast7Days: state.recentSessions,
    totalHours: Math.round((activeMs / (60 * 60 * 1000)) * 10) / 10,
    firstActivityAt: new Date(ts[0]).toISOString(),
    lastActivityAt: new Date(ts[ts.length - 1]).toISOString(),
    models,
    // Codex tokens are per-session cumulative counters, not per-response — per-model
    // attribution is not measurable there, and the field is optional.
    ...(modelUsage.length > 0 ? { modelUsage } : {}),
    dailyActiveMinutes,
    inputTokens: state.inputTokens,
    outputTokens: state.outputTokens,
    cacheReadTokens: state.cacheReadTokens,
    cacheCreationTokens: state.cacheCreationTokens,
    totalTokens: state.inputTokens + state.outputTokens + state.cacheReadTokens + state.cacheCreationTokens,
    toolCalls: state.toolCalls,
    fileEditCalls: state.fileEditCalls,
    commandCalls: state.commandCalls,
    subagentRuns: state.subagentRuns,
    backgroundAgentRuns: state.backgroundAgentRuns,
    mcpToolCalls: state.mcpToolCalls,
    mcpServersUsed: state.mcpServers.size,
    skillInvocations: state.skillInvocations,
    planModeUses: state.planModeUses,
    webSearchCalls: state.webSearchCalls,
    webFetchCalls: state.webFetchCalls,
  };
}

async function main() {
  const now = Date.now();
  const claudeState = newState();
  const codexState = newState();
  await scanClaude(claudeState, CLAUDE_ROOT, now);
  await scanCodex(codexState, CODEX_ROOT, now);

  const payloads = [];
  const claudePayload = buildPayload('claude_code', claudeState, now);
  if (claudePayload) payloads.push(claudePayload);
  const codexPayload = buildPayload('codex', codexState, now);
  if (codexPayload) payloads.push(codexPayload);

  if (payloads.length === 0) {
    return fail('No completed sessions found under ' + CLAUDE_ROOT + ' or ' + CODEX_ROOT);
  }
  process.stdout.write(JSON.stringify({ payloads }, null, 2) + '\n');
}

main().catch((err) => fail(String((err && err.message) || err)));
