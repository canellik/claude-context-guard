'use strict';

const fs = require('fs');

const DEFAULT_MAX_BYTES = 500 * 1024;

function statSafe(absPath) {
  try {
    return fs.statSync(absPath);
  } catch {
    return null;
  }
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function exceedsLimit(absPath, maxBytes) {
  const st = statSafe(absPath);
  if (!st || !st.isFile()) return null;
  if (st.size > maxBytes) return st.size;
  return null;
}

module.exports = { DEFAULT_MAX_BYTES, statSafe, humanSize, exceedsLimit };
