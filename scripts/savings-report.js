#!/usr/bin/env node
'use strict';

const log = require('../lib/log');

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function tableRows(rows) {
  if (rows.length === 0) return '_(none)_';
  const lines = ['| count | est. tokens saved | example |', '|---:|---:|:--|'];
  for (const r of rows) {
    lines.push(`| ${r.count} | ${fmt(r.tokens)} | \`${r.example}\` |`);
  }
  return lines.join('\n');
}

function group(events, keyFn, exampleFn) {
  const m = new Map();
  for (const e of events) {
    const k = keyFn(e);
    if (!k) continue;
    if (!m.has(k)) m.set(k, { key: k, count: 0, tokens: 0, example: exampleFn(e) });
    const g = m.get(k);
    g.count += 1;
    g.tokens += e.estTokens || 0;
  }
  return [...m.values()].sort((a, b) => b.tokens - a.tokens);
}

function projectFilter(events, project) {
  if (!project) return events;
  return events.filter((e) => e.project === project);
}

function parseArgs(argv) {
  const args = { project: null, since: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') args.project = argv[++i];
    else if (a === '--since') args.since = argv[++i];
  }
  return args;
}

function applySince(events, since) {
  if (!since) return events;
  const ms = parseSince(since);
  if (!ms) return events;
  const cutoff = Date.now() - ms;
  return events.filter((e) => Date.parse(e.ts) >= cutoff);
}

function parseSince(s) {
  const m = String(s).match(/^(\d+)([smhdw])$/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2];
  return n * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[u];
}

function main() {
  const args = parseArgs(process.argv);
  const all = log.read();
  let events = projectFilter(all, args.project);
  events = applySince(events, args.since);

  const total = events.length;
  const tokens = events.reduce((s, e) => s + (e.estTokens || 0), 0);

  const byKind = group(events, (e) => e.kind, (e) => e.path || e.command || '-');
  const topPatterns = group(
    events.filter((e) => e.kind === 'bloat' || e.kind === 'secret'),
    (e) => e.pattern,
    (e) => e.path || '-'
  ).slice(0, 8);
  const topRules = group(
    events.filter((e) => e.kind === 'bash'),
    (e) => (e.rules && e.rules[0]) || 'unknown',
    (e) => e.command || '-'
  ).slice(0, 8);
  const topProjects = group(
    events.filter((e) => e.project),
    (e) => e.project,
    (e) => e.path || e.command || '-'
  ).slice(0, 5);

  const since = events.length ? events[0].ts.slice(0, 10) : 'no events yet';
  const filterDesc = [
    args.project ? `project=${args.project}` : null,
    args.since ? `since=${args.since}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const lines = [];
  lines.push(`# context-guard — savings report`);
  lines.push('');
  lines.push(
    `**Total blocks:** ${total}   |   **Estimated tokens saved:** ~${fmt(tokens)}   |   **First event:** ${since}` +
      (filterDesc ? `   |   **Filter:** ${filterDesc}` : '')
  );
  lines.push('');
  lines.push(`## By kind`);
  lines.push(tableRows(byKind));
  lines.push('');
  lines.push(`## Top file patterns (bloat + secrets)`);
  lines.push(tableRows(topPatterns));
  lines.push('');
  lines.push(`## Top bash rules`);
  lines.push(tableRows(topRules));
  lines.push('');
  if (topProjects.length > 1) {
    lines.push(`## By project`);
    lines.push(tableRows(topProjects));
    lines.push('');
  }
  lines.push(
    `_Token estimates are heuristic: file reads use \`bytes / 4\`; bash rules use per-rule defaults. Use \`--project <name>\` or \`--since 7d\` to filter._`
  );
  lines.push('');
  lines.push(`_Log file: \`${log.LOG_FILE}\`_`);

  process.stdout.write(lines.join('\n') + '\n');
}

main();
