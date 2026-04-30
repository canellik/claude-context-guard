#!/usr/bin/env node
'use strict';

const path = require('path');
const { detect, formatHits } = require('../lib/bash-rewriter');
const { loadConfig } = require('../lib/config');
const log = require('../lib/log');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function emit(decision, reason) {
  if (!decision) {
    process.exit(0);
    return;
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function emitWarn(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: reason,
      },
    })
  );
  process.exit(0);
}

(async () => {
  let payload;
  try {
    payload = JSON.parse((await readStdin()) || '{}');
  } catch {
    process.exit(0);
  }

  const toolName = payload.tool_name || payload.toolName;
  if (toolName !== 'Bash') process.exit(0);

  const ti = payload.tool_input || payload.toolInput || {};
  const command = typeof ti.command === 'string' ? ti.command : '';
  if (!command) process.exit(0);

  const cwd = payload.cwd || process.cwd();
  const cfg = loadConfig(cwd);
  if (cfg.disableBashGuard) process.exit(0);

  for (const allow of cfg.bashAllow || []) {
    if (allow && command.includes(allow)) process.exit(0);
  }

  const hits = detect(command);
  if (hits.length === 0) process.exit(0);

  const project = path.basename(cfg.root);
  const totalEst = hits.reduce((s, h) => s + (h.estTokens || 0), 0);
  log.append({
    kind: 'bash',
    tool: 'Bash',
    rules: hits.map((h) => h.id),
    command: command.length > 200 ? command.slice(0, 200) + '…' : command,
    project,
    mode: cfg.bashGuard,
    estTokens: totalEst,
  });

  const body =
    `context-guard: this command may flood the context window.\n` +
    formatHits(hits) +
    `\n\nIf this is intentional, add an override to .contextguardignore using ` +
    `a "bash:<substring>" line, or set "bashGuard": "warn" in .contextguardrc.json.`;

  if (cfg.bashGuard === 'warn') {
    emitWarn(body);
  } else {
    emit('deny', body);
  }
})().catch(() => process.exit(0));
