// Aggregate-only scan of local AI-tool session logs:
//   Claude Code  ~/.claude/projects/**/*.jsonl
//   Codex CLI    ~/.codex/sessions/**/*.jsonl
// Reads timestamps, message/event types, model ids, token-usage counters, and
// tool-call names. Never reads message content, tool arguments, project names,
// cwd, or file paths — projects leave only a count, Codex cwd is never touched.
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CLAUDE_ROOT = path.join(os.homedir(), '.claude', 'projects');
const CODEX_ROOT = path.join(os.homedir(), '.codex', 'sessions');
const MAX_SESSION_MS = 12 * 3600_000; // clamp idle-open sessions

function newAgg() {
  return {
    sessions: 0,
    ms: 0,
    first: null,
    last: null,
    days: new Set(),
    weeks: new Map(),
    models: new Set(),
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    seenUsage: new Set(),
    toolCalls: 0,
    fileEditCalls: 0,
    commandCalls: 0,
    seenToolUse: new Set(),
  };
}

async function scanClaudeFile(file, agg) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let hasUser = false;
  let hasAssistant = false;
  let minTs = null;
  let maxTs = null;
  // Days come from actual entry timestamps, not a min→max fill: a resumed session
  // would otherwise credit its idle gap days, and a 24h stride can step over the
  // far side of midnight.
  const fileDays = new Set();
  for await (const line of rl) {
    if (!line) continue;
    // Cheap substring pre-filter: skips the huge non-message lines (tool results,
    // file snapshots) without paying for a full JSON.parse on each.
    if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    if (entry.type === 'user') hasUser = true;
    else hasAssistant = true;
    const ts = Date.parse(entry.timestamp);
    if (!Number.isNaN(ts)) {
      if (minTs === null || ts < minTs) minTs = ts;
      if (maxTs === null || ts > maxTs) maxTs = ts;
      fileDays.add(new Date(ts).toISOString().slice(0, 10));
    }
    if (entry.type === 'assistant' && entry.message) {
      const model = entry.message.model;
      // '<synthetic>' marks locally generated messages, not a model.
      if (typeof model === 'string' && model && !model.startsWith('<')) agg.models.add(model);
      // Tool-call counters read only each block's type/name/id — never its input. Block
      // ids are globally unique, so the Set dedupes replayed lines exactly.
      if (Array.isArray(entry.message.content)) {
        for (const block of entry.message.content) {
          if (!block || block.type !== 'tool_use' || typeof block.id !== 'string') continue;
          if (agg.seenToolUse.has(block.id)) continue;
          agg.seenToolUse.add(block.id);
          agg.toolCalls += 1;
          if (block.name === 'Bash') agg.commandCalls += 1;
          else if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(block.name)) agg.fileEditCalls += 1;
        }
      }
      const usage = entry.message.usage;
      if (usage && typeof usage.output_tokens === 'number') {
        // A multi-block API response is logged as several lines sharing one request and
        // message id, each carrying the full usage block — count tokens once per response.
        const key = (entry.requestId || '') + ':' + (entry.message.id || '');
        if (key === ':' || !agg.seenUsage.has(key)) {
          if (key !== ':') agg.seenUsage.add(key);
          agg.inputTokens += usage.input_tokens || 0;
          agg.outputTokens += usage.output_tokens || 0;
          agg.cacheReadTokens += usage.cache_read_input_tokens || 0;
          agg.cacheWriteTokens += usage.cache_creation_input_tokens || 0;
          agg.totalTokens +=
            (usage.input_tokens || 0) +
            (usage.output_tokens || 0) +
            (usage.cache_read_input_tokens || 0) +
            (usage.cache_creation_input_tokens || 0);
        }
      }
    }
  }
  if (hasUser && hasAssistant && minTs !== null && maxTs !== null) {
    agg.sessions += 1;
    agg.ms += Math.min(maxTs - minTs, MAX_SESSION_MS);
    if (agg.first === null || minTs < agg.first) agg.first = minTs;
    if (agg.last === null || maxTs > agg.last) agg.last = maxTs;
    for (const day of fileDays) agg.days.add(day);
    const weekStart = utcMonday(minTs);
    agg.weeks.set(weekStart, (agg.weeks.get(weekStart) || 0) + 1);
  }
}

// Codex rollout lines are {"timestamp", "type", "payload"}. Only presence and
// aggregate signals are read: payload.type, payload.role, payload.model,
// payload.name, payload.call_id, and payload.info token counters — never
// message text, arguments, or cwd.
const CODEX_TOOL_TYPES = new Set(['function_call', 'local_shell_call', 'custom_tool_call', 'web_search_call']);
const CODEX_SHELL_NAMES = new Set(['shell', 'exec_command', 'shell_command']);

async function scanCodexFile(file, agg) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let hasUser = false;
  let hasAssistant = false;
  let minTs = null;
  let maxTs = null;
  const fileDays = new Set();
  // total_token_usage is cumulative per session — keep the last one seen. If the
  // counter ever resets mid-file (compaction/resume), "last" undercounts, which is
  // the acceptable direction (never inflate). Files with only last_token_usage
  // deltas are summed instead.
  let cumulative = null;
  let deltaSum = null;
  for await (const line of rl) {
    if (!line) continue;
    if (!line.includes('"response_item"') && !line.includes('"event_msg"') && !line.includes('"turn_context"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const payload = entry.payload;
    if (!payload || typeof payload !== 'object') continue;
    let isActivity = false;
    if (entry.type === 'turn_context') {
      if (typeof payload.model === 'string' && payload.model) agg.models.add(payload.model);
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
          if (!deltaSum) deltaSum = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0 };
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
        if (!callId || !agg.seenToolUse.has(callId)) {
          if (callId) agg.seenToolUse.add(callId);
          agg.toolCalls += 1;
          const name = typeof payload.name === 'string' ? payload.name : '';
          if (payload.type === 'local_shell_call' || CODEX_SHELL_NAMES.has(name)) agg.commandCalls += 1;
          else if (name === 'apply_patch') agg.fileEditCalls += 1;
        }
      }
    }
    if (isActivity) {
      const ts = Date.parse(entry.timestamp);
      if (!Number.isNaN(ts)) {
        if (minTs === null || ts < minTs) minTs = ts;
        if (maxTs === null || ts > maxTs) maxTs = ts;
        fileDays.add(new Date(ts).toISOString().slice(0, 10));
      }
    }
  }
  const usage = cumulative || deltaSum;
  if (usage) {
    const input = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
    const output = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
    // OpenAI's input_tokens already includes the cached subset — cacheReadTokens
    // is informational, not additive.
    agg.inputTokens += input;
    agg.outputTokens += output;
    agg.cacheReadTokens += typeof usage.cached_input_tokens === 'number' ? usage.cached_input_tokens : 0;
    agg.reasoningOutputTokens += typeof usage.reasoning_output_tokens === 'number' ? usage.reasoning_output_tokens : 0;
    agg.totalTokens += typeof usage.total_tokens === 'number' && usage.total_tokens > 0 ? usage.total_tokens : input + output;
  }
  if (hasUser && hasAssistant && minTs !== null && maxTs !== null) {
    agg.sessions += 1;
    agg.ms += Math.min(maxTs - minTs, MAX_SESSION_MS);
    if (agg.first === null || minTs < agg.first) agg.first = minTs;
    if (agg.last === null || maxTs > agg.last) agg.last = maxTs;
    for (const day of fileDays) agg.days.add(day);
    const weekStart = utcMonday(minTs);
    agg.weeks.set(weekStart, (agg.weeks.get(weekStart) || 0) + 1);
  }
}

async function walkCodex(dir, agg) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) await walkCodex(p, agg);
    else if (ent.isFile() && ent.name.endsWith('.jsonl')) await scanCodexFile(p, agg);
  }
}

function utcMonday(ts) {
  const daysFromMonday = (new Date(ts).getUTCDay() + 6) % 7;
  return new Date(ts - daysFromMonday * 86_400_000).toISOString().slice(0, 10);
}

function longestStreak(days) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of [...days].sort()) {
    const ts = Date.parse(day);
    run = prev !== null && ts - prev === 86_400_000 ? run + 1 : 1;
    prev = ts;
    if (run > best) best = run;
  }
  return best;
}

function finalizeSource(source, agg, extra) {
  return {
    source,
    sessions: agg.sessions,
    activeDays: agg.days.size,
    totalHours: Math.round((agg.ms / 3600_000) * 10) / 10,
    firstActivityAt: new Date(agg.first).toISOString(),
    lastActivityAt: new Date(agg.last).toISOString(),
    models: [...agg.models].sort().slice(0, 20),
    // Older transcript formats carry no usage blocks — omit rather than report 0.
    ...(agg.totalTokens > 0
      ? {
          inputTokens: agg.inputTokens,
          outputTokens: agg.outputTokens,
          cacheReadTokens: agg.cacheReadTokens,
          ...(agg.cacheWriteTokens > 0 ? { cacheWriteTokens: agg.cacheWriteTokens } : {}),
          ...(agg.reasoningOutputTokens > 0 ? { reasoningOutputTokens: agg.reasoningOutputTokens } : {}),
          totalTokens: agg.totalTokens,
        }
      : {}),
    longestStreakDays: longestStreak(agg.days),
    ...(extra || {}),
    weeklySessions: [...agg.weeks.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-200)
      .map(([weekStart, sessions]) => ({ weekStart, sessions })),
    toolCalls: agg.toolCalls,
    fileEditCalls: agg.fileEditCalls,
    commandCalls: agg.commandCalls,
  };
}

(async () => {
  const haveClaude = fs.existsSync(CLAUDE_ROOT);
  const haveCodex = fs.existsSync(CODEX_ROOT);
  if (!haveClaude && !haveCodex) {
    console.error('No Claude Code logs found at ' + CLAUDE_ROOT + ' and no Codex logs found at ' + CODEX_ROOT);
    process.exit(1);
  }

  const sources = [];
  const aggs = [];

  if (haveClaude) {
    const agg = newAgg();
    let projectCount = 0;
    for (const dir of fs.readdirSync(CLAUDE_ROOT, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const dirPath = path.join(CLAUDE_ROOT, dir.name);
      const sessionsBefore = agg.sessions;
      for (const f of fs.readdirSync(dirPath)) {
        if (f.endsWith('.jsonl')) await scanClaudeFile(path.join(dirPath, f), agg);
      }
      if (agg.sessions > sessionsBefore) projectCount += 1;
    }
    if (agg.sessions > 0) {
      sources.push(finalizeSource('claude_code', agg, { projectCount }));
      aggs.push(agg);
    }
  }

  if (haveCodex) {
    const agg = newAgg();
    await walkCodex(CODEX_ROOT, agg);
    if (agg.sessions > 0) {
      sources.push(finalizeSource('codex', agg));
      aggs.push(agg);
    }
  }

  if (sources.length === 0) {
    console.error('No completed sessions found under ' + CLAUDE_ROOT + ' or ' + CODEX_ROOT);
    process.exit(1);
  }

  const allDays = new Set();
  for (const agg of aggs) for (const day of agg.days) allDays.add(day);
  const sum = (key) => aggs.reduce((n, agg) => n + agg[key], 0);
  const totalTokens = sum('totalTokens');
  const totals = {
    sessions: sum('sessions'),
    activeDays: allDays.size,
    totalHours: Math.round((sum('ms') / 3600_000) * 10) / 10,
    ...(totalTokens > 0
      ? {
          inputTokens: sum('inputTokens'),
          outputTokens: sum('outputTokens'),
          cacheReadTokens: sum('cacheReadTokens'),
          // Codex logs carry no cache-write counter — omit rather than report a
          // misleading 0 when no source measured it.
          ...(sum('cacheWriteTokens') > 0 ? { cacheWriteTokens: sum('cacheWriteTokens') } : {}),
          totalTokens,
        }
      : {}),
    toolCalls: sum('toolCalls'),
  };

  console.log(JSON.stringify({ sources, totals }, null, 2));
})();
