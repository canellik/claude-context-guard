#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  SECRET_PATTERNS,
  BLOAT_PATTERNS,
  matchAny,
  normalize,
} = require('../lib/patterns');
const { exceedsLimit, humanSize } = require('../lib/size');
const { loadConfig } = require('../lib/config');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function pass() {
  process.exit(0);
}

function targetPathFromInput(toolName, ti) {
  if (!ti || typeof ti !== 'object') return null;
  if (typeof ti.file_path === 'string') return ti.file_path;
  if (typeof ti.path === 'string') return ti.path;
  if (typeof ti.notebook_path === 'string') return ti.notebook_path;
  if (toolName === 'Glob' && typeof ti.pattern === 'string') return ti.pattern;
  return null;
}

function isAllowed(rel, allowList) {
  if (!allowList || !allowList.length) return false;
  return matchAny(rel, allowList) !== null;
}

(async () => {
  let payload;
  try {
    payload = JSON.parse((await readStdin()) || '{}');
  } catch {
    pass();
  }

  const toolName = payload.tool_name || payload.toolName;
  const toolInput = payload.tool_input || payload.toolInput || {};
  const cwd = payload.cwd || process.cwd();

  const cfg = loadConfig(cwd);
  if (cfg.disableReadGuard) pass();

  const target = targetPathFromInput(toolName, toolInput);
  if (!target) pass();

  const abs = path.isAbsolute(target) ? target : path.resolve(cfg.root, target);
  const rel = normalize(path.relative(cfg.root, abs) || target);

  if (isAllowed(rel, cfg.fileAllow)) pass();

  const secrets = SECRET_PATTERNS.concat(cfg.extraSecrets);
  const secretHit = matchAny(rel, secrets);
  if (secretHit) {
    deny(
      `context-guard: blocked access to potential secret file (matched "${secretHit}").\n` +
        `Path: ${rel}\n` +
        `If this is intentional, add the path to .contextguardignore.`
    );
  }

  const bloat = BLOAT_PATTERNS.concat(cfg.extraDeny);
  const bloatHit = matchAny(rel, bloat);
  if (bloatHit) {
    deny(
      `context-guard: blocked read of bloat file (matched "${bloatHit}").\n` +
        `Path: ${rel}\n` +
        `Reading large generated/lock/build artifacts wastes context. ` +
        `If you genuinely need it, add an allow rule to .contextguardignore.`
    );
  }

  const overSize = exceedsLimit(abs, cfg.maxFileSize);
  if (overSize !== null) {
    deny(
      `context-guard: file exceeds size limit (${humanSize(overSize)} > ${humanSize(cfg.maxFileSize)}).\n` +
        `Path: ${rel}\n` +
        `Use \`head\`, \`tail\`, \`sed -n\`, or grep with --include to read a slice. ` +
        `Raise the limit via .contextguardrc.json { "maxFileSize": <bytes> }.`
    );
  }

  pass();
})().catch(() => process.exit(0));
