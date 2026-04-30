'use strict';

const fs = require('fs');
const path = require('path');
const { parseIgnoreFile } = require('./patterns');
const { DEFAULT_MAX_BYTES } = require('./size');

function findProjectRoot(startDir) {
  let dir = startDir || process.cwd();
  for (let i = 0; i < 10; i++) {
    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, '.contextguardignore')) ||
      fs.existsSync(path.join(dir, '.contextguardrc.json'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir || process.cwd();
}

function readJSONSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function readTextSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function loadConfig(cwd) {
  const root = findProjectRoot(cwd);
  const rc = readJSONSafe(path.join(root, '.contextguardrc.json'));
  const ignore = parseIgnoreFile(readTextSafe(path.join(root, '.contextguardignore')));
  return {
    root,
    maxFileSize: Number.isFinite(rc.maxFileSize) ? rc.maxFileSize : DEFAULT_MAX_BYTES,
    extraDeny: Array.isArray(rc.extraDeny) ? rc.extraDeny : [],
    extraSecrets: Array.isArray(rc.extraSecrets) ? rc.extraSecrets : [],
    bashGuard: rc.bashGuard === 'warn' ? 'warn' : 'block',
    disableReadGuard: rc.disableReadGuard === true,
    disableBashGuard: rc.disableBashGuard === true,
    fileAllow: ignore.fileAllow,
    bashAllow: ignore.bashAllow,
  };
}

module.exports = { loadConfig, findProjectRoot };
