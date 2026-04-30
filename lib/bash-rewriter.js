'use strict';

const RULES = [
  {
    id: 'find-unbounded',
    test: (cmd) => /\bfind\s+(\.|\/|\$HOME|~)/.test(cmd) && !/-maxdepth\s+\d+/.test(cmd),
    reason: '`find` without -maxdepth scans the entire tree and floods context.',
    suggest: 'find . -maxdepth 2 -type f -name "*.ts"',
  },
  {
    id: 'ls-recursive',
    test: (cmd) => /\bls\s+(-[a-zA-Z]*R[a-zA-Z]*)/.test(cmd),
    reason: '`ls -R` recursively dumps every entry in the tree.',
    suggest: 'ls -la <dir>   # or: find . -maxdepth 2 -type d',
  },
  {
    id: 'grep-recursive-broad',
    test: (cmd) => /\bgrep\s+[^|;]*-[a-zA-Z]*[Rr][a-zA-Z]*/.test(cmd) && !/--include=/.test(cmd),
    reason: 'Recursive grep without --include scans binaries, lockfiles and build artifacts.',
    suggest: "grep -R --include='*.ts' --include='*.tsx' <pattern> src/",
  },
  {
    id: 'tree-unbounded',
    test: (cmd) => /\btree\b/.test(cmd) && !/-L\s+\d+/.test(cmd) && !/--noreport/.test(cmd),
    reason: '`tree` without -L prints the entire directory tree.',
    suggest: 'tree -L 2',
  },
  {
    id: 'cat-log',
    test: (cmd) => /\bcat\s+[^|;&]*\.(log|csv|tsv|jsonl|ndjson)\b/.test(cmd),
    reason: '`cat` on a log/data file may dump megabytes into context.',
    suggest: 'tail -n 200 <file>   # or: head -n 200 <file>',
  },
  {
    id: 'cat-lockfile',
    test: (cmd) => /\bcat\s+[^|;&]*(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|composer\.lock|Gemfile\.lock|poetry\.lock)\b/.test(cmd),
    reason: 'Lockfiles are huge and almost never useful to read in full.',
    suggest: 'jq ".dependencies | keys" package-lock.json   # or read package.json instead',
  },
  {
    id: 'git-log-unbounded',
    test: (cmd) => /\bgit\s+log\b/.test(cmd) && !/-n\s*\d+|--max-count|-\d+|--oneline/.test(cmd),
    reason: '`git log` without -n / --oneline can return thousands of commits.',
    suggest: 'git log --oneline -n 30',
  },
  {
    id: 'npm-ls',
    test: (cmd) => /\bnpm\s+ls\b/.test(cmd) && !/--depth\s*=?\s*0/.test(cmd),
    reason: '`npm ls` walks the full dependency tree.',
    suggest: 'npm ls --depth=0',
  },
  {
    id: 'du-unbounded',
    test: (cmd) => /\bdu\s+/.test(cmd) && !/--max-depth|-d\s*\d+/.test(cmd) && !/\|\s*(head|sort)/.test(cmd),
    reason: '`du` without --max-depth recurses through every subtree.',
    suggest: 'du -ah --max-depth=2 . | sort -rh | head -30',
  },
  {
    id: 'find-slash',
    test: (cmd) => /\bfind\s+\/(\s|$)/.test(cmd),
    reason: '`find /` scans the entire filesystem.',
    suggest: 'find . -maxdepth 3   # scope to the project',
  },
];

function detect(command) {
  if (!command || typeof command !== 'string') return [];
  const hits = [];
  for (const r of RULES) {
    try {
      if (r.test(command)) hits.push(r);
    } catch {}
  }
  return hits;
}

function formatHits(hits) {
  return hits
    .map((h) => `• [${h.id}] ${h.reason}\n  → suggest: ${h.suggest}`)
    .join('\n');
}

module.exports = { RULES, detect, formatHits };
