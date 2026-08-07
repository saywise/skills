// Aggregate-only scan of Claude Code session logs (~/.claude/projects/**/*.jsonl).
// Reads timestamps, message types, model ids, and token-usage counters. Never reads
// message content, project names, or file paths — projects leave only a count.
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const ROOT = path.join(os.homedir(), '.claude', 'projects');
const MAX_SESSION_MS = 12 * 3600_000; // clamp idle-open sessions

async function scanFile(file, agg) {
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
          agg.outputTokens += usage.output_tokens || 0;
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

(async () => {
  if (!fs.existsSync(ROOT)) {
    console.error('No Claude Code logs found at ' + ROOT);
    process.exit(1);
  }
  const agg = {
    sessions: 0,
    ms: 0,
    first: null,
    last: null,
    days: new Set(),
    weeks: new Map(),
    models: new Set(),
    outputTokens: 0,
    totalTokens: 0,
    seenUsage: new Set(),
    toolCalls: 0,
    fileEditCalls: 0,
    commandCalls: 0,
    seenToolUse: new Set(),
  };
  let projectCount = 0;
  for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(ROOT, dir.name);
    const sessionsBefore = agg.sessions;
    for (const f of fs.readdirSync(dirPath)) {
      if (f.endsWith('.jsonl')) await scanFile(path.join(dirPath, f), agg);
    }
    if (agg.sessions > sessionsBefore) projectCount += 1;
  }
  if (agg.sessions === 0) {
    console.error('No completed Claude Code sessions found under ' + ROOT);
    process.exit(1);
  }
  const out = {
    sources: [
      {
        source: 'claude_code',
        sessions: agg.sessions,
        activeDays: agg.days.size,
        totalHours: Math.round((agg.ms / 3600_000) * 10) / 10,
        firstActivityAt: new Date(agg.first).toISOString(),
        lastActivityAt: new Date(agg.last).toISOString(),
        models: [...agg.models].sort().slice(0, 20),
        // Older transcript formats carry no usage blocks — omit rather than report 0.
        ...(agg.totalTokens > 0 ? { outputTokens: agg.outputTokens, totalTokens: agg.totalTokens } : {}),
        longestStreakDays: longestStreak(agg.days),
        projectCount,
        weeklySessions: [...agg.weeks.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .slice(-200)
          .map(([weekStart, sessions]) => ({ weekStart, sessions })),
        toolCalls: agg.toolCalls,
        fileEditCalls: agg.fileEditCalls,
        commandCalls: agg.commandCalls,
      },
    ],
  };
  console.log(JSON.stringify(out, null, 2));
})();
