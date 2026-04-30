'use strict';

const SECRET_PATTERNS = [
  '**/.env',
  '**/.env.*',
  '**/*.pem',
  '**/*.key',
  '**/*.pfx',
  '**/*.p12',
  '**/id_rsa',
  '**/id_dsa',
  '**/id_ecdsa',
  '**/id_ed25519',
  '**/credentials.json',
  '**/credentials',
  '**/secrets.json',
  '**/secrets.yaml',
  '**/secrets.yml',
  '**/.aws/credentials',
  '**/.npmrc',
  '**/.pypirc',
  '**/.netrc',
  '**/service-account*.json',
  '**/gcp-key*.json',
];

const BLOAT_PATTERNS = [
  'node_modules/**',
  '**/node_modules/**',
  'dist/**',
  '**/dist/**',
  'build/**',
  '**/build/**',
  '.next/**',
  '**/.next/**',
  '.nuxt/**',
  '.svelte-kit/**',
  '.turbo/**',
  '.cache/**',
  '**/.cache/**',
  'coverage/**',
  '**/coverage/**',
  'target/**',
  '.gradle/**',
  '.venv/**',
  'venv/**',
  '__pycache__/**',
  '**/__pycache__/**',
  'vendor/**',
  '.pytest_cache/**',
  '.mypy_cache/**',
  '.tox/**',
  'package-lock.json',
  '**/package-lock.json',
  'yarn.lock',
  '**/yarn.lock',
  'pnpm-lock.yaml',
  '**/pnpm-lock.yaml',
  'bun.lockb',
  '**/bun.lockb',
  'Cargo.lock',
  '**/Cargo.lock',
  'composer.lock',
  '**/composer.lock',
  'Gemfile.lock',
  '**/Gemfile.lock',
  'poetry.lock',
  '**/poetry.lock',
  '*.lock',
  '*.log',
  '**/*.log',
  '*.min.js',
  '**/*.min.js',
  '*.min.css',
  '**/*.min.css',
  '*.map',
  '**/*.map',
  '**/generated/**',
  '**/__generated__/**',
  '**/*.generated.*',
  '*.tsbuildinfo',
  '**/*.tsbuildinfo',
  '.DS_Store',
  '**/.DS_Store',
];

function escapeRegex(s) {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 3;
          continue;
        }
        re += '.*';
        i += 2;
        continue;
      }
      re += '[^/]*';
      i += 1;
      continue;
    }
    if (c === '?') {
      re += '[^/]';
      i += 1;
      continue;
    }
    re += escapeRegex(c);
    i += 1;
  }
  return new RegExp('^' + re + '$');
}

function normalize(p) {
  if (!p) return '';
  let s = String(p).replace(/\\/g, '/');
  if (s.startsWith('./')) s = s.slice(2);
  s = s.replace(/^\/+/, '');
  return s;
}

function matchAny(filePath, patterns) {
  const norm = normalize(filePath);
  const base = norm.split('/').pop();
  for (const pat of patterns) {
    const re = globToRegex(pat);
    if (re.test(norm) || re.test(base)) return pat;
  }
  return null;
}

function parseIgnoreFile(text) {
  const fileAllow = [];
  const bashAllow = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('bash:')) {
      bashAllow.push(line.slice(5).trim());
    } else {
      fileAllow.push(line);
    }
  }
  return { fileAllow, bashAllow };
}

module.exports = {
  SECRET_PATTERNS,
  BLOAT_PATTERNS,
  globToRegex,
  matchAny,
  normalize,
  parseIgnoreFile,
};
